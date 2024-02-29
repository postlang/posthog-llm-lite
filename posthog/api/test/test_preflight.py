from typing import cast

from django.conf import settings
from rest_framework import status

from posthog.test.base import APIBaseTest
from posthog.version import VERSION


class TestPreflight(APIBaseTest):
    def instance_preferences(self, **kwargs):
        return {
            "debug_queries": False,
            "disable_paid_fs": False,
            **kwargs,
        }

    def test_preflight_request_unauthenticated(self):
        """
        For security purposes, the information contained in an unauthenticated preflight request is minimal.
        """
        self.client.logout()
        with self.settings(MULTI_TENANCY=False):
            response = self.client.get("/_preflight/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.json(),
            {
                "django": True,
                "redis": True,
                "plugins": True,
                "celery": True,
                "db": True,
                "initiated": True,
                "cloud": False,
                "realm": "hosted",
                "available_social_auth_providers": {
                    "google-oauth2": False,
                    "github": False,
                    "gitlab": False,
                    "saml": False,
                },
                "can_create_org": True,
                "email_service_available": False,
            },
        )

    def test_preflight_request(self):
        with self.settings(MULTI_TENANCY=False, INSTANCE_PREFERENCES=self.instance_preferences(debug_queries=True)):
            response = self.client.get("/_preflight/")
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            response = response.json()
            available_timezones = cast(dict, response).pop("available_timezones")

            self.assertEqual(
                response,
                {
                    "django": True,
                    "redis": True,
                    "plugins": True,
                    "celery": True,
                    "db": True,
                    "initiated": True,
                    "cloud": False,
                    "realm": "hosted",
                    "ee_available": False,
                    "is_clickhouse_enabled": False,
                    "db_backend": "postgres",
                    "available_social_auth_providers": {
                        "google-oauth2": False,
                        "github": False,
                        "gitlab": False,
                        "saml": False,
                    },
                    "opt_out_capture": False,
                    "posthog_version": VERSION,
                    "email_service_available": False,
                    "is_debug": False,
                    "is_event_property_usage_enabled": False,
                    "licensed_users_available": None,
                    "site_url": "http://localhost:8000",
                    "can_create_org": True,
                    "instance_preferences": {
                        "debug_queries": True,
                        "disable_paid_fs": False,
                    },
                },
            )
            self.assertDictContainsSubset({"Europe/Moscow": 3, "UTC": 0}, available_timezones)
