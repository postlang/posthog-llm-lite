import os
import time
from random import randrange

from celery import Celery
from celery.schedules import crontab
from celery.signals import task_postrun, task_prerun
from constance import config
from django.conf import settings
from django.db import connection
from django.utils import timezone
from sentry_sdk.api import capture_exception

from posthog.redis import get_client

# set the default Django settings module for the 'celery' program.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "posthog.settings")

app = Celery("posthog")

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
# - namespace='CELERY' means all celery-related configuration keys
#   should have a `CELERY_` prefix.
app.config_from_object("django.conf:settings", namespace="CELERY")

# Load task modules from all registered Django app configs.
app.autodiscover_tasks()

# Make sure Redis doesn't add too many connections
# https://stackoverflow.com/questions/47106592/redis-connections-not-being-released-after-celery-task-is-complete
app.conf.broker_pool_limit = 0

# How frequently do we want to calculate action -> event relationships if async is enabled
ACTION_EVENT_MAPPING_INTERVAL_SECONDS = settings.ACTION_EVENT_MAPPING_INTERVAL_SECONDS

# How frequently do we want to calculate event property stats if async is enabled
EVENT_PROPERTY_USAGE_INTERVAL_SECONDS = settings.EVENT_PROPERTY_USAGE_INTERVAL_SECONDS

# How frequently do we want to check if dashboard items need to be recalculated
UPDATE_CACHED_DASHBOARD_ITEMS_INTERVAL_SECONDS = settings.UPDATE_CACHED_DASHBOARD_ITEMS_INTERVAL_SECONDS


@app.on_after_configure.connect
def setup_periodic_tasks(sender: Celery, **kwargs):
    if not settings.DEBUG:
        sender.add_periodic_task(1.0, redis_celery_queue_depth.s(), name="1 sec queue probe", priority=0)
    # Heartbeat every 10sec to make sure the worker is alive
    sender.add_periodic_task(10.0, redis_heartbeat.s(), name="10 sec heartbeat", priority=0)

    # Update events table partitions twice a week
    sender.add_periodic_task(
        crontab(day_of_week="mon,fri", hour=0, minute=0),
        update_event_partitions.s(),  # check twice a week
    )

    if getattr(settings, "MULTI_TENANCY", False):
        sender.add_periodic_task(crontab(minute=0, hour="*/12"), run_session_recording_retention.s())

    # Send weekly status report on self-hosted instances
    if not getattr(settings, "MULTI_TENANCY", False):
        sender.add_periodic_task(crontab(day_of_week="mon", hour=0, minute=0), status_report.s())

    # Cloud (posthog-cloud) cron jobs
    if getattr(settings, "MULTI_TENANCY", False):
        sender.add_periodic_task(crontab(hour=0, minute=0), calculate_billing_daily_usage.s())  # every day midnight UTC

    # Send weekly email report (~ 8:00 SF / 16:00 UK / 17:00 EU)
    sender.add_periodic_task(crontab(day_of_week="mon", hour=15, minute=0), send_weekly_email_report.s())

    sender.add_periodic_task(crontab(day_of_week="fri", hour=0, minute=0), clean_stale_partials.s())

    # delete old plugin logs every 4 hours
    sender.add_periodic_task(crontab(minute=0, hour="*/4"), delete_old_plugin_logs.s())

    # sync all Organization.available_features every hour
    sender.add_periodic_task(crontab(minute=30, hour="*"), sync_all_organization_available_features.s())

    sender.add_periodic_task(
        UPDATE_CACHED_DASHBOARD_ITEMS_INTERVAL_SECONDS, check_cached_items.s(), name="check dashboard items"
    )

    sender.add_periodic_task(crontab(minute=30, hour="*"), check_async_migration_health.s())

    sender.add_periodic_task(
        crontab(
            hour=0, minute=randrange(0, 40)
        ),  # every day at a random minute past midnight. Sends data from the preceding whole day.
        send_org_usage_report.s(),
        name="send event usage report",
    )

    sender.add_periodic_task(120, calculate_cohort.s(), name="recalculate cohorts")

    if settings.ASYNC_EVENT_PROPERTY_USAGE:
        sender.add_periodic_task(
            EVENT_PROPERTY_USAGE_INTERVAL_SECONDS,
            calculate_event_property_usage.s(),
            name="calculate event property usage",
        )


@app.task(ignore_result=True)
def redis_heartbeat():
    get_client().set("POSTHOG_HEARTBEAT", int(time.time()))


def materialized_columns_enabled() -> bool:
    return False


@app.task(ignore_result=True)
def send_org_usage_report():
    from posthog.tasks.org_usage_report import send_all_org_usage_reports as send_reports_postgres

    send_reports_postgres()


@app.task(ignore_result=True)
def redis_celery_queue_depth():
    from posthog.internal_metrics import gauge

    try:
        llen = get_client().llen("celery")
        gauge(f"posthog_celery_queue_depth", llen)
    except:
        # if we can't connect to statsd don't complain about it.
        # not every installation will have statsd available
        return


@app.task(ignore_result=True)
def update_event_partitions():
    with connection.cursor() as cursor:
        cursor.execute(
            "DO $$ BEGIN IF (SELECT exists(select * from pg_proc where proname = 'update_partitions')) THEN PERFORM update_partitions(); END IF; END $$"
        )


@app.task(ignore_result=True)
def clean_stale_partials():
    """Clean stale (meaning older than 7 days) partial social auth sessions."""
    from social_django.models import Partial

    Partial.objects.filter(timestamp__lt=timezone.now() - timezone.timedelta(7)).delete()


@app.task(ignore_result=True)
def status_report():
    from posthog.tasks.status_report import status_report

    status_report()


@app.task(ignore_result=True)
def run_session_recording_retention():
    from posthog.tasks.session_recording_retention import session_recording_retention_scheduler

    session_recording_retention_scheduler()


@app.task(ignore_result=True)
def calculate_event_action_mappings():
    from posthog.tasks.calculate_action import calculate_actions_from_last_calculation

    calculate_actions_from_last_calculation()


@app.task(ignore_result=True)
def calculate_cohort():
    from posthog.tasks.calculate_cohort import calculate_cohorts

    calculate_cohorts()


@app.task(ignore_result=True)
def check_cached_items():
    from posthog.tasks.update_cache import update_cached_items

    update_cached_items()


@app.task(ignore_result=True)
def update_cache_item_task(key: str, cache_type, payload: dict) -> None:
    from posthog.tasks.update_cache import update_cache_item

    update_cache_item(key, cache_type, payload)


@app.task(ignore_result=True)
def send_weekly_email_report():
    if settings.EMAIL_REPORTS_ENABLED:
        from posthog.tasks.email import send_weekly_email_reports

        send_weekly_email_reports()


@app.task(ignore_result=True, bind=True)
def debug_task(self):
    print(f"Request: {self.request!r}")


@app.task(ignore_result=True)
def calculate_event_property_usage():
    from posthog.tasks.calculate_event_property_usage import calculate_event_property_usage

    calculate_event_property_usage()


@app.task(ignore_result=True)
def calculate_billing_daily_usage():
    try:
        from multi_tenancy.tasks import compute_daily_usage_for_organizations  # noqa: F401
    except ImportError:
        pass
    else:
        compute_daily_usage_for_organizations()


@app.task(ignore_result=True)
def delete_old_plugin_logs():
    from posthog.tasks.delete_old_plugin_logs import delete_old_plugin_logs

    delete_old_plugin_logs()


@app.task(ignore_result=True)
def sync_all_organization_available_features():
    from posthog.tasks.sync_all_organization_available_features import sync_all_organization_available_features

    sync_all_organization_available_features()


@app.task(ignore_result=False, track_started=True, max_retries=0)
def check_async_migration_health():
    from posthog.tasks.async_migrations import check_async_migration_health

    check_async_migration_health()
