import json
from collections import defaultdict

from rest_framework import exceptions, request, response, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.mixins import ListModelMixin, RetrieveModelMixin

from ee.clickhouse.client import sync_execute
from ee.clickhouse.sql.person import GET_TEAM_PERSON_DISTINCT_IDS
from posthog.api.routing import StructuredViewSetMixin
from posthog.models.group_type_mapping import GroupTypeMapping
from posthog.utils import convert_property_value


class GroupTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = GroupTypeMapping
        fields = ["group_type", "group_type_index"]


class ClickhouseGroupsView(StructuredViewSetMixin, ListModelMixin, viewsets.GenericViewSet):
    serializer_class = GroupTypeSerializer
    queryset = GroupTypeMapping.objects.all()
    pagination_class = None

    @action(methods=["GET"], detail=False)
    def property_definitions(self, request: request.Request, **kw):
        rows = sync_execute(
            f"""
            SELECT group_type_index, tupleElement(keysAndValues, 1) as key, count(*) as count
            FROM groups
            ARRAY JOIN JSONExtractKeysAndValuesRaw(group_properties) as keysAndValues
            WHERE team_id = %(team_id)s
            GROUP BY group_type_index, tupleElement(keysAndValues, 1)
            ORDER BY group_type_index ASC, count DESC, key ASC
            """,
            {"team_id": self.team.pk},
        )

        group_type_index_to_properties = defaultdict(list)
        for group_type_index, key, count in rows:
            group_type_index_to_properties[group_type_index].append({"name": key, "count": count})

        return response.Response(group_type_index_to_properties)

    @action(methods=["GET"], detail=False)
    def property_values(self, request: request.Request, **kw):
        rows = sync_execute(
            f"""
            SELECT trim(BOTH '"' FROM tupleElement(keysAndValues, 2)) as value
            FROM groups
            ARRAY JOIN JSONExtractKeysAndValuesRaw(group_properties) as keysAndValues
            WHERE team_id = %(team_id)s AND group_type_index = %(group_type_index)s AND tupleElement(keysAndValues, 1) = %(key)s
            GROUP BY tupleElement(keysAndValues, 2)
            ORDER BY value ASC
        """,
            {"team_id": self.team.pk, "group_type_index": request.GET["group_type_index"], "key": request.GET["key"]},
        )

        return response.Response([{"name": name[0]} for name in rows])