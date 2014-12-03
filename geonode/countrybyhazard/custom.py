from django.http import HttpResponse
from django.conf import settings
from tastypie.resources import ModelResource
from tastypie import fields
from geonode.api.api import TagResource, ContinentResource
from tastypie.utils.mime import build_content_type
from geonode.countrybyhazard.models import Country, Area
from django.db.models import Q

FILTER_TYPES = {
    'continent':Area
}

class HazardModelApi(ModelResource):
    continent = fields.ToOneField(
        ContinentResource,
        'wfp_area',
        null=True,
        full=True)

    def build_filters(self, filters=None):
        if filters is None:
            filters = {}
        orm_filters = super(HazardModelApi, self).build_filters(filters)
        if('wfp_area__id__in' in filters):
            query = filters['wfp_area__id__in']
            orm_filters['wfp_area__id__in']  = query
        return orm_filters

    def build_haystack_filters(self, parameters):
        from haystack.inputs import Raw
        from haystack.query import SearchQuerySet, SQ  # noqa

        sqs = None

        sqs = (
                SearchQuerySet() if sqs is None else sqs).order_by("name")    
  

    

                