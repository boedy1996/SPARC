import re
from django.db.models import Q
from django.http import HttpResponse
from django.conf import settings

from tastypie.constants import ALL, ALL_WITH_RELATIONS
from tastypie.resources import ModelResource
from tastypie import fields
from tastypie.utils import trailing_slash

from guardian.shortcuts import get_objects_for_user

from django.conf.urls import url
from django.core.paginator import Paginator, InvalidPage
from django.http import Http404

from tastypie.utils.mime import build_content_type
if settings.HAYSTACK_SEARCH:
    from haystack.query import SearchQuerySet  # noqa

from geonode.layers.models import Layer
from geonode.maps.models import Map
from geonode.documents.models import Document
from geonode.base.models import ResourceBase

#added for hazard
from geonode.countrybyhazard.models import Country, FloodedPopAtRisk, CountryGeneralInfo, CountryMonthlyCyclonesInfo, DroughtInfo
from geonode.countrybyhazard.custom import HazardModelApi

from .authorization import GeoNodeAuthorization

from .api import TagResource, ProfileResource, TopicCategoryResource, \
    FILTER_TYPES, ContinentResource

from django.db.models import Sum 

import operator  
import copy

from datetime import datetime

LAYER_SUBTYPES = {
    'vector': 'dataStore',
    'raster': 'coverageStore',
    'remote': 'remoteStore',
}
FILTER_TYPES.update(LAYER_SUBTYPES)


class CommonMetaApi:
    authorization = GeoNodeAuthorization()
    allowed_methods = ['get']
    filtering = {'title': ALL,
                 'name':ALL,
                 'keywords': ALL_WITH_RELATIONS,
                 'category': ALL_WITH_RELATIONS,
                 'owner': ALL_WITH_RELATIONS,
                 'date': ALL,
                 'continent' : ALL_WITH_RELATIONS,
                 'country': ALL_WITH_RELATIONS
                 }
    ordering = ['date', 'title', 'popular_count']
    max_limit = None

class CommonModelApi(ModelResource):
    keywords = fields.ToManyField(TagResource, 'keywords', null=True)
    category = fields.ToOneField(
        TopicCategoryResource,
        'category',
        null=True,
        full=True)
    owner = fields.ToOneField(ProfileResource, 'owner', full=True)

    def build_filters(self, filters={}):
        orm_filters = super(CommonModelApi, self).build_filters(filters)
        if 'type__in' in filters and filters[
                'type__in'] in FILTER_TYPES.keys():
            orm_filters.update({'type': filters.getlist('type__in')})
        if 'extent' in filters:
            orm_filters.update({'extent': filters['extent']})
        # Nothing returned if +'s are used instead of spaces for text search,
        # so swap them out. Must be a better way of doing this?
        for filter in orm_filters:
            if filter in ['title__contains', 'q']:
                orm_filters[filter] = orm_filters[filter].replace("+", " ")
        return orm_filters

    def apply_filters(self, request, applicable_filters):
        types = applicable_filters.pop('type', None)
        extent = applicable_filters.pop('extent', None)
        semi_filtered = super(
            CommonModelApi,
            self).apply_filters(
            request,
            applicable_filters)
        filtered = None
        if types:
            for the_type in types:
                if the_type in LAYER_SUBTYPES.keys():
                    if filtered:
                        filtered = filtered | semi_filtered.filter(
                            Layer___storeType=LAYER_SUBTYPES[the_type])
                    else:
                        filtered = semi_filtered.filter(
                            Layer___storeType=LAYER_SUBTYPES[the_type])
                else:
                    if filtered:
                        filtered = filtered | semi_filtered.instance_of(
                            FILTER_TYPES[the_type])
                    else:
                        filtered = semi_filtered.instance_of(
                            FILTER_TYPES[the_type])
        else:
            filtered = semi_filtered

        if extent:
            filtered = self.filter_bbox(filtered, extent)
        return filtered

    def filter_bbox(self, queryset, bbox):
        """
        modify the queryset q to limit to data that intersects with the
        provided bbox

        bbox - 4 tuple of floats representing 'southwest_lng,southwest_lat,
        northeast_lng,northeast_lat'
        returns the modified query
        """
        bbox = bbox.split(
            ',')  # TODO: Why is this different when done through haystack?
        bbox = map(str, bbox)  # 2.6 compat - float to decimal conversion

        intersects = ~(Q(bbox_x0__gt=bbox[2]) | Q(bbox_x1__lt=bbox[0]) |
                       Q(bbox_y0__gt=bbox[3]) | Q(bbox_y1__lt=bbox[1]))

        return queryset.filter(intersects)

    def build_haystack_filters(self, parameters):
        from haystack.inputs import Raw
        from haystack.query import SearchQuerySet, SQ  # noqa

        sqs = None

        # Retrieve Query Params

        # Text search
        query = parameters.get('q', None)

        # Types and subtypes to filter (map, layer, vector, etc)
        type_facets = parameters.getlist("type__in", [])

        # If coming from explore page, add type filter from resource_name
        resource_filter = self._meta.resource_name.rstrip("s")
        if resource_filter != "base" and resource_filter not in type_facets:
            type_facets.append(resource_filter)

        # Publication date range (start,end)
        date_range = parameters.get("date_range", ",").split(",")

        # Topic category filter
        category = parameters.getlist("category__identifier__in")

        # Keyword filter
        keywords = parameters.getlist("keywords__slug__in")

        # Sort order
        sort = parameters.get("order_by", "relevance")

        # Geospatial Elements
        bbox = parameters.get("extent", None)

        # Filter by Type and subtype
        if type_facets is not None:

            types = []
            subtypes = []

            for type in type_facets:
                if type in ["map", "layer", "document", "user"]:
                    # Type is one of our Major Types (not a sub type)
                    types.append(type)
                elif type in LAYER_SUBTYPES.keys():
                    subtypes.append(type)

            if len(subtypes) > 0:
                types.append("layer")
                sqs = SearchQuerySet().narrow("subtype:%s" %
                                              ','.join(map(str, subtypes)))

            if len(types) > 0:
                sqs = (SearchQuerySet() if sqs is None else sqs).narrow(
                    "type:%s" % ','.join(map(str, types)))

        # Filter by Query Params
        # haystack bug? if boosted fields aren't included in the
        # query, then the score won't be affected by the boost
        if query:
            if query.startswith('"') or query.startswith('\''):
                # Match exact phrase
                phrase = query.replace('"', '')
                sqs = (SearchQuerySet() if sqs is None else sqs).filter(
                    SQ(title__exact=phrase) |
                    SQ(description__exact=phrase) |
                    SQ(content__exact=phrase)
                )
            else:
                words = [
                    w for w in re.split(
                        '\W',
                        query,
                        flags=re.UNICODE) if w]
                for i, search_word in enumerate(words):
                    if i == 0:
                        sqs = (SearchQuerySet() if sqs is None else sqs) \
                            .filter(
                            SQ(title=Raw(search_word)) |
                            SQ(description=Raw(search_word)) |
                            SQ(content=Raw(search_word))
                        )
                    elif search_word in ["AND", "OR"]:
                        pass
                    elif words[i - 1] == "OR":  # previous word OR this word
                        sqs = sqs.filter_or(
                            SQ(title=Raw(search_word)) |
                            SQ(description=Raw(search_word)) |
                            SQ(content=Raw(search_word))
                        )
                    else:  # previous word AND this word
                        sqs = sqs.filter(
                            SQ(title=Raw(search_word)) |
                            SQ(description=Raw(search_word)) |
                            SQ(content=Raw(search_word))
                        )

        # filter by category
        if category:
            sqs = (SearchQuerySet() if sqs is None else sqs).narrow(
                'category:%s' % ','.join(map(str, category)))

        # filter by keyword: use filter_or with keywords_exact
        # not using exact leads to fuzzy matching and too many results
        # using narrow with exact leads to zero results if multiple keywords
        # selected
        if keywords:
            for keyword in keywords:
                sqs = (
                    SearchQuerySet() if sqs is None else sqs).filter_or(
                    keywords_exact=keyword)

        # filter by date
        if date_range[0]:
            sqs = (SearchQuerySet() if sqs is None else sqs).filter(
                SQ(date__gte=date_range[0])
            )

        if date_range[1]:
            sqs = (SearchQuerySet() if sqs is None else sqs).filter(
                SQ(date__lte=date_range[1])
            )

        # Filter by geographic bounding box
        if bbox:
            left, bottom, right, top = bbox.split(',')
            sqs = (
                SearchQuerySet() if sqs is None else sqs).exclude(
                SQ(
                    bbox_top__lte=bottom) | SQ(
                    bbox_bottom__gte=top) | SQ(
                    bbox_left__gte=right) | SQ(
                        bbox_right__lte=left))

        # Apply sort
        if sort.lower() == "-date":
            sqs = (
                SearchQuerySet() if sqs is None else sqs).order_by("-modified")
        elif sort.lower() == "date":
            sqs = (
                SearchQuerySet() if sqs is None else sqs).order_by("modified")
        elif sort.lower() == "title":
            sqs = (SearchQuerySet() if sqs is None else sqs).order_by(
                "title_sortable")
        elif sort.lower() == "-title":
            sqs = (SearchQuerySet() if sqs is None else sqs).order_by(
                "-title_sortable")
        elif sort.lower() == "-popular_count":
            sqs = (SearchQuerySet() if sqs is None else sqs).order_by(
                "-popular_count")
        else:
            sqs = (
                SearchQuerySet() if sqs is None else sqs).order_by("-modified")

        return sqs

    def get_search(self, request, **kwargs):
        self.method_check(request, allowed=['get'])
        self.is_authenticated(request)
        self.throttle_check(request)

        # Get the list of objects that matches the filter
        sqs = self.build_haystack_filters(request.GET)

        if not settings.SKIP_PERMS_FILTER:
            # Get the list of objects the user has access to
            filter_set = set(
                get_objects_for_user(
                    request.user,
                    'base.view_resourcebase'
                )
            )
            if settings.RESOURCE_PUBLISHING:
                filter_set = filter_set.filter(is_published=True)

            filter_set_ids = filter_set.values_list('id', flat=True)
            # Do the query using the filterset and the query term. Facet the
            # results
            if len(filter_set) > 0:
                sqs = sqs.filter(oid__in=filter_set_ids).facet('type').facet('subtype').facet('owner').facet('keywords')\
                    .facet('category')
            else:
                sqs = None
        else:
            sqs = sqs.facet('type').facet('subtype').facet(
                'owner').facet('keywords').facet('category')

        if sqs:
            # Build the Facet dict
            facets = {}
            for facet in sqs.facet_counts()['fields']:
                facets[facet] = {}
                for item in sqs.facet_counts()['fields'][facet]:
                    facets[facet][item[0]] = item[1]

            # Paginate the results
            paginator = Paginator(sqs, request.GET.get('limit'))

            try:
                page = paginator.page(
                    int(request.GET.get('offset')) /
                    int(request.GET.get('limit'), 0) + 1)
            except InvalidPage:
                raise Http404("Sorry, no results on that page.")

            if page.has_previous():
                previous_page = page.previous_page_number()
            else:
                previous_page = 1
            if page.has_next():
                next_page = page.next_page_number()
            else:
                next_page = 1
            total_count = sqs.count()
            objects = page.object_list
        else:
            next_page = 0
            previous_page = 0
            total_count = 0
            facets = {}
            objects = []

        object_list = {
           "meta": {"limit": 100,  # noqa
                    "next": next_page,
                    "offset": int(getattr(request.GET, 'offset', 0)),
                    "previous": previous_page,
                    "total_count": total_count,
                    "facets": facets,
                    },
            'objects': map(lambda x: x.get_stored_fields(), objects),
        }
        self.log_throttled_access(request)
        return self.create_response(request, object_list)

    def get_list(self, request, **kwargs):
        """
        Returns a serialized list of resources.

        Calls ``obj_get_list`` to provide the data, then handles that result
        set and serializes it.

        Should return a HttpResponse (200 OK).
        """
        # TODO: Uncached for now. Invalidation that works for everyone may be
        # impossible.
        base_bundle = self.build_bundle(request=request)
        objects = self.obj_get_list(
            bundle=base_bundle,
            **self.remove_api_resource_names(kwargs))
        sorted_objects = self.apply_sorting(objects, options=request.GET)

        paginator = self._meta.paginator_class(
            request.GET,
            sorted_objects,
            resource_uri=self.get_resource_uri(),
            limit=self._meta.limit,
            max_limit=self._meta.max_limit,
            collection_name=self._meta.collection_name)
        to_be_serialized = paginator.page()

        to_be_serialized = self.alter_list_data_to_serialize(
            request,
            to_be_serialized)
        return self.create_response(request, to_be_serialized)

    def create_response(
            self,
            request,
            data,
            response_class=HttpResponse,
            **response_kwargs):
        """
        Extracts the common "which-format/serialize/return-response" cycle.

        Mostly a useful shortcut/hook.
        """
        VALUES = [
            # fields in the db
            'id',
            'uuid',
            'title',
            'abstract',
            'csw_wkt_geometry',
            'csw_type',
            'distribution_description',
            'distribution_url',
            'owner_id',
            'share_count',
            'popular_count',
            'srid',
            'category',
            'supplemental_information',
            'thumbnail_url',
            'detail_url',
            'rating',
        ]

        if isinstance(
                data,
                dict) and 'objects' in data and not isinstance(
                data['objects'],
                list):
            data['objects'] = list(data['objects'].values(*VALUES))

        desired_format = self.determine_format(request)
        serialized = self.serialize(request, data, desired_format)

        return response_class(
            content=serialized,
            content_type=build_content_type(desired_format),
            **response_kwargs)

    def prepend_urls(self):
        if settings.HAYSTACK_SEARCH:
            return [
                url(r"^(?P<resource_name>%s)/search%s$" % (
                    self._meta.resource_name, trailing_slash()
                    ),
                    self.wrap_view('get_search'), name="api_get_search"),
            ]
        else:
            return []


class ResourceBaseResource(CommonModelApi):

    """ResourceBase api"""

    class Meta(CommonMetaApi):
        queryset = ResourceBase.objects.polymorphic_queryset() \
            .distinct().order_by('-date')
        if settings.RESOURCE_PUBLISHING:
            queryset = queryset.filter(is_published=True)
        resource_name = 'base'
        excludes = ['csw_anytext', 'metadata_xml']


class FeaturedResourceBaseResource(CommonModelApi):

    """Only the featured resourcebases"""

    class Meta(CommonMetaApi):
        queryset = ResourceBase.objects.filter(featured=True).order_by('-date')
        if settings.RESOURCE_PUBLISHING:
            queryset = queryset.filter(is_published=True)
        resource_name = 'featured'


class LayerResource(CommonModelApi):

    """Layer API"""

    class Meta(CommonMetaApi):
        queryset = Layer.objects.distinct().order_by('-date')
        if settings.RESOURCE_PUBLISHING:
            queryset = queryset.filter(is_published=True)
        resource_name = 'layers'
        excludes = ['csw_anytext', 'metadata_xml']


class MapResource(CommonModelApi):

    """Maps API"""

    class Meta(CommonMetaApi):
        queryset = Map.objects.distinct().order_by('-date')
        if settings.RESOURCE_PUBLISHING:
            queryset = queryset.filter(is_published=True)
        resource_name = 'maps'


class DocumentResource(CommonModelApi):

    """Maps API"""

    class Meta(CommonMetaApi):
        filtering = CommonMetaApi.filtering
        filtering.update({'doc_type': ALL})
        queryset = Document.objects.distinct().order_by('-date')
        if settings.RESOURCE_PUBLISHING:
            queryset = queryset.filter(is_published=True)
        resource_name = 'documents'

class CountryResource(HazardModelApi):
    """Country API"""
    def alter_list_data_to_serialize(self, request, data):
        def getKey(item):
            return item.data['max_pop']
        def getKey1(item):
            return item.data['popCurrentMonth']  
        def getKey2(item):
            return item.data['totEIV']
        def getJan(item):
            return item.data['popMonth']['mjan__sum'] 
        def getFeb(item):
            return item.data['popMonth']['mfeb__sum'] 
        def getMar(item):
            return item.data['popMonth']['mmar__sum'] 
        def getApr(item):
            return item.data['popMonth']['mapr__sum']
        def getMay(item):
            return item.data['popMonth']['mmay__sum'] 
        def getJun(item):
            return item.data['popMonth']['mjun__sum'] 
        def getJul(item):
            return item.data['popMonth']['mjul__sum']   
        def getAug(item):
            return item.data['popMonth']['maug__sum']  
        def getSep(item):
            return item.data['popMonth']['msep__sum'] 
        def getOct(item):
            return item.data['popMonth']['moct__sum'] 
        def getNov(item):
            return item.data['popMonth']['mnov__sum']   
        def getDec(item):
            return item.data['popMonth']['mdes__sum']                                        

        if "rank_by" in request.GET:
            data_med = copy.copy(data)
            data['objects']=[]
            if request.GET["rank_by"]=='max_pop':      
                data['objects'] = sorted(data_med['objects'], key=getKey, reverse=True)
            elif request.GET["rank_by"]=='max_pop_month':
                data['objects'] = sorted(data_med['objects'], key=getKey1, reverse=True)
            elif request.GET["rank_by"]=='max_eiv':
                data['objects'] = sorted(data_med['objects'], key=getKey2, reverse=True) 

            elif request.GET["rank_by"]=='max_jan':
                data['objects'] = sorted(data_med['objects'], key=getJan, reverse=True)
            elif request.GET["rank_by"]=='max_feb':
                data['objects'] = sorted(data_med['objects'], key=getFeb, reverse=True)
            elif request.GET["rank_by"]=='max_mar':
                data['objects'] = sorted(data_med['objects'], key=getMar, reverse=True) 
            elif request.GET["rank_by"]=='max_apr':
                data['objects'] = sorted(data_med['objects'], key=getApr, reverse=True)  
            elif request.GET["rank_by"]=='max_may':
                data['objects'] = sorted(data_med['objects'], key=getMay, reverse=True) 
            elif request.GET["rank_by"]=='max_jun':
                data['objects'] = sorted(data_med['objects'], key=getJun, reverse=True)
            elif request.GET["rank_by"]=='max_jul':
                data['objects'] = sorted(data_med['objects'], key=getJul, reverse=True) 
            elif request.GET["rank_by"]=='max_aug':
                data['objects'] = sorted(data_med['objects'], key=getAug, reverse=True) 
            elif request.GET["rank_by"]=='max_sep':
                data['objects'] = sorted(data_med['objects'], key=getSep, reverse=True)  
            elif request.GET["rank_by"]=='max_oct':
                data['objects'] = sorted(data_med['objects'], key=getOct, reverse=True) 
            elif request.GET["rank_by"]=='max_nov':
                data['objects'] = sorted(data_med['objects'], key=getNov, reverse=True) 
            elif request.GET["rank_by"]=='max_dec':
                data['objects'] = sorted(data_med['objects'], key=getDec, reverse=True)                                              
        return data

    def dehydrate(self, bundle):
        extreme = {'pop': 0, 'month' : "No Data", 'RP':'No Data'}
        totFinEIV = 0
        totEIV = 0
        totAbs = 0
        popMonth = {'mjan__sum':0,'mfeb__sum':0,'mmar__sum':0,'mapr__sum':0,'mmay__sum':0,'mjun__sum':0,'mjul__sum':0,'maug__sum':0,'msep__sum':0,'moct__sum':0,'mnov__sum':0,'mdes__sum':0}
        RPExtreme = {'RP25':{'month':'','pop':0}, 'RP50':{'month':'','pop':0}, 'RP100':{'month':'','pop':0}, 'RP200':{'month':'','pop':0}, 'RP500':{'month':'','pop':0}, 'RP1000':{'month':'','pop':0}}
        monthCode = ['mjan','mfeb','mmar','mapr','mmay','mjun','mjul','maug','msep','moct','mnov','mdes']
        transaction = FloodedPopAtRisk.objects.filter(iso3_id=bundle.data['iso3']).values('iso3', 'rper').order_by('iso3').annotate(Sum(monthCode[0])).annotate(Sum(monthCode[1])).annotate(Sum(monthCode[2])).annotate(Sum(monthCode[3])).annotate(Sum(monthCode[4])).annotate(Sum(monthCode[5])).annotate(Sum(monthCode[6])).annotate(Sum(monthCode[7])).annotate(Sum(monthCode[8])).annotate(Sum(monthCode[9])).annotate(Sum(monthCode[10])).annotate(Sum(monthCode[11]))
        bundle.data['popatrisk'] = transaction
        ttt = bundle.data['popatrisk']
        currentMonth = datetime.now().month
        popCurrentMonth = 0
        for x in ttt :
            popCurrentMonth += x[monthCode[currentMonth-1]+'__sum']
            for y in x:
                if x[y]>RPExtreme['RP'+str(x['rper'])]['pop']:
                    if y not in ['rper','iso3']:
                        popMonth[y] += x[y]
                        RPExtreme['RP'+str(x['rper'])]['pop']=x[y]
                        if y=='mjan__sum':
                            month = 'January'
                        elif y=='mfeb__sum':
                            month = 'February' 
                        elif y=='mmar__sum':
                            month = 'March'
                        elif y=='mapr__sum':
                            month = 'April'  
                        elif y=='mmay__sum':
                            month = 'May' 
                        elif y=='mjun__sum':
                            month = 'June'   
                        elif y=='mjul__sum':
                            month = 'July'
                        elif y=='maug__sum':
                            month = 'August'  
                        elif y=='msep__sum':
                            month = 'September'   
                        elif y=='moct__sum':
                            month = 'October'  
                        elif y=='mnov__sum':
                            month = 'November' 
                        elif y=='mdes__sum':
                            month = 'December'
                        RPExtreme['RP'+str(x['rper'])]['month'] = month   
                if x[y]>extreme['pop']:
                    if y not in ['rper','iso3']:
                        extreme['pop'] = x[y]
                        if y=='mjan__sum':
                            month = 'January'
                        elif y=='mfeb__sum':
                            month = 'February' 
                        elif y=='mmar__sum':
                            month = 'March'
                        elif y=='mapr__sum':
                            month = 'April'  
                        elif y=='mmay__sum':
                            month = 'May' 
                        elif y=='mjun__sum':
                            month = 'June'   
                        elif y=='mjul__sum':
                            month = 'July'
                        elif y=='maug__sum':
                            month = 'August'  
                        elif y=='msep__sum':
                            month = 'September'   
                        elif y=='moct__sum':
                            month = 'October'  
                        elif y=='mnov__sum':
                            month = 'November' 
                        elif y=='mdes__sum':
                            month = 'December'                                                           
                        extreme['month'] = month
                        extreme['RP'] = x['rper']
        grab = {'25':'', '50' : '', '100':'', '200':'', '500':'', '1000':''}              
        for x in ttt :
            if extreme['pop'] == 0 :
                break
            if x['rper']==25:
                #grab['25']=str(float(x['mjan__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mfeb__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mmar__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mapr__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mmay__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mjun__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mjul__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['maug__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['msep__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['moct__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mnov__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mdes__sum'])/float(extreme['pop'])*100.0)
                grab['25']=str(float(x['mjan__sum']))+','+str(float(x['mfeb__sum']))+','+str(float(x['mmar__sum']))+','+str(float(x['mapr__sum']))+','+str(float(x['mmay__sum']))+','+str(float(x['mjun__sum']))+','+str(float(x['mjul__sum']))+','+str(float(x['maug__sum']))+','+str(float(x['msep__sum']))+','+str(float(x['moct__sum']))+','+str(float(x['mnov__sum']))+','+str(float(x['mdes__sum']))
            if x['rper']==50:
                #grab['50']=str(float(x['mjan__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mfeb__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mmar__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mapr__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mmay__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mjun__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mjul__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['maug__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['msep__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['moct__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mnov__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mdes__sum'])/float(extreme['pop'])*100.0)
                grab['50']=str(float(x['mjan__sum']))+','+str(float(x['mfeb__sum']))+','+str(float(x['mmar__sum']))+','+str(float(x['mapr__sum']))+','+str(float(x['mmay__sum']))+','+str(float(x['mjun__sum']))+','+str(float(x['mjul__sum']))+','+str(float(x['maug__sum']))+','+str(float(x['msep__sum']))+','+str(float(x['moct__sum']))+','+str(float(x['mnov__sum']))+','+str(float(x['mdes__sum']))
            if x['rper']==100:
                #grab['100']=str(float(x['mjan__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mfeb__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mmar__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mapr__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mmay__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mjun__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mjul__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['maug__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['msep__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['moct__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mnov__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mdes__sum'])/float(extreme['pop'])*100.0)
                grab['100']=str(float(x['mjan__sum']))+','+str(float(x['mfeb__sum']))+','+str(float(x['mmar__sum']))+','+str(float(x['mapr__sum']))+','+str(float(x['mmay__sum']))+','+str(float(x['mjun__sum']))+','+str(float(x['mjul__sum']))+','+str(float(x['maug__sum']))+','+str(float(x['msep__sum']))+','+str(float(x['moct__sum']))+','+str(float(x['mnov__sum']))+','+str(float(x['mdes__sum']))
            if x['rper']==200:
                #grab['200']=str(float(x['mjan__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mfeb__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mmar__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mapr__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mmay__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mjun__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mjul__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['maug__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['msep__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['moct__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mnov__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mdes__sum'])/float(extreme['pop'])*100.0)
                grab['200']=str(float(x['mjan__sum']))+','+str(float(x['mfeb__sum']))+','+str(float(x['mmar__sum']))+','+str(float(x['mapr__sum']))+','+str(float(x['mmay__sum']))+','+str(float(x['mjun__sum']))+','+str(float(x['mjul__sum']))+','+str(float(x['maug__sum']))+','+str(float(x['msep__sum']))+','+str(float(x['moct__sum']))+','+str(float(x['mnov__sum']))+','+str(float(x['mdes__sum']))
            if x['rper']==500:
                #grab['500']=str(float(x['mjan__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mfeb__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mmar__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mapr__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mmay__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mjun__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mjul__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['maug__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['msep__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['moct__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mnov__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mdes__sum'])/float(extreme['pop'])*100.0)
                grab['500']=str(float(x['mjan__sum']))+','+str(float(x['mfeb__sum']))+','+str(float(x['mmar__sum']))+','+str(float(x['mapr__sum']))+','+str(float(x['mmay__sum']))+','+str(float(x['mjun__sum']))+','+str(float(x['mjul__sum']))+','+str(float(x['maug__sum']))+','+str(float(x['msep__sum']))+','+str(float(x['moct__sum']))+','+str(float(x['mnov__sum']))+','+str(float(x['mdes__sum']))
            if x['rper']==1000:
                #grab['1000']=str(float(x['mjan__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mfeb__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mmar__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mapr__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mmay__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mjun__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mjul__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['maug__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['msep__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['moct__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mnov__sum'])/float(extreme['pop'])*100.0)+','+str(float(x['mdes__sum'])/float(extreme['pop'])*100.0)
                grab['1000']=str(float(x['mjan__sum']))+','+str(float(x['mfeb__sum']))+','+str(float(x['mmar__sum']))+','+str(float(x['mapr__sum']))+','+str(float(x['mmay__sum']))+','+str(float(x['mjun__sum']))+','+str(float(x['mjul__sum']))+','+str(float(x['maug__sum']))+','+str(float(x['msep__sum']))+','+str(float(x['moct__sum']))+','+str(float(x['mnov__sum']))+','+str(float(x['mdes__sum']))

        transaction2 = CountryGeneralInfo.objects.filter(country=bundle.data['iso3']).values('tot_pop', 'gdp_per_cap','hdi')
        for x in transaction2:
            for y in x:
                if x[y] == None:
                    x[y]=0   

        bundle.data['tot_pop'] = transaction2[0]['tot_pop']
        bundle.data['gdp_per_cap'] = transaction2[0]['gdp_per_cap']
        bundle.data['hdi'] = transaction2[0]['hdi']  


        bundle.data['chartvalue']=grab['25']+'|'+grab['50']+'|'+grab['100']+'|'+grab['200']+'|'+grab['500']+'|'+grab['1000']
        bundle.data['extreme'] = extreme
        bundle.data['max_pop'] = extreme['pop']
        bundle.data['RPExtreme'] = RPExtreme
        
        for item in RPExtreme :
            if item=='RP25':
                totEIV += (0.04*RPExtreme[item]['pop'])
            elif item=='RP50':
                totEIV += (0.02*RPExtreme[item]['pop'])  
            elif item=='RP100':
                totEIV += (0.01*RPExtreme[item]['pop']) 
            elif item=='RP200':
                totEIV += (0.005*RPExtreme[item]['pop'])
            elif item=='RP500':
                totEIV += (0.002*RPExtreme[item]['pop']) 
            elif item=='RP1000':
                totEIV += (0.001*RPExtreme[item]['pop'])                
        
        bundle.data['popCurrentMonth'] = popCurrentMonth
        bundle.data['totEIV'] = totEIV
        bundle.data['popMonth'] = popMonth
        return bundle

    class Meta:
        filtering = CommonMetaApi.filtering
        filtering.update({'doc_type': ALL})
        queryset = Country.objects.all()
        ordering = ['name','extended_name','max_pop']
        if settings.RESOURCE_PUBLISHING:
            queryset = queryset.filter(is_published=True)
        resource_name = 'hazards'  

class CycloneCountryResource(HazardModelApi):
    """Country API"""
    def alter_list_data_to_serialize(self, request, data): 
        def getKey(item):
            return item.data['exposed_pop']
        def getKey1(item):
            return item.data['storm_surge_exposed_pop']   
        def getJan(item):
            return item.data['popMonth']['mjan__sum'] 
        def getFeb(item):
            return item.data['popMonth']['mfeb__sum'] 
        def getMar(item):
            return item.data['popMonth']['mmar__sum'] 
        def getApr(item):
            return item.data['popMonth']['mapr__sum']
        def getMay(item):
            return item.data['popMonth']['mmay__sum'] 
        def getJun(item):
            return item.data['popMonth']['mjun__sum'] 
        def getJul(item):
            return item.data['popMonth']['mjul__sum']   
        def getAug(item):
            return item.data['popMonth']['maug__sum']  
        def getSep(item):
            return item.data['popMonth']['msep__sum'] 
        def getOct(item):
            return item.data['popMonth']['moct__sum'] 
        def getNov(item):
            return item.data['popMonth']['mnov__sum']   
        def getDec(item):
            return item.data['popMonth']['mdec__sum']     

        if "rank_by" in request.GET:
            data_med = copy.copy(data)
            data['objects']=[]
            if request.GET["rank_by"]=='max_pop':      
                data['objects'] = sorted(data_med['objects'], key=getKey, reverse=True)
            elif request.GET["rank_by"]=='-max_pop':
                data['objects'] = sorted(data_med['objects'], key=getKey)   
            elif request.GET["rank_by"]=='max_surge':
                data['objects'] = sorted(data_med['objects'], key=getKey1, reverse=True)   
            elif request.GET["rank_by"]=='-max_surge':
                data['objects'] = sorted(data_med['objects'], key=getKey1)

            elif request.GET["rank_by"]=='max_jan':
                data['objects'] = sorted(data_med['objects'], key=getJan, reverse=True)
            elif request.GET["rank_by"]=='max_feb':
                data['objects'] = sorted(data_med['objects'], key=getFeb, reverse=True)
            elif request.GET["rank_by"]=='max_mar':
                data['objects'] = sorted(data_med['objects'], key=getMar, reverse=True) 
            elif request.GET["rank_by"]=='max_apr':
                data['objects'] = sorted(data_med['objects'], key=getApr, reverse=True)  
            elif request.GET["rank_by"]=='max_may':
                data['objects'] = sorted(data_med['objects'], key=getMay, reverse=True) 
            elif request.GET["rank_by"]=='max_jun':
                data['objects'] = sorted(data_med['objects'], key=getJun, reverse=True)
            elif request.GET["rank_by"]=='max_jul':
                data['objects'] = sorted(data_med['objects'], key=getJul, reverse=True) 
            elif request.GET["rank_by"]=='max_aug':
                data['objects'] = sorted(data_med['objects'], key=getAug, reverse=True) 
            elif request.GET["rank_by"]=='max_sep':
                data['objects'] = sorted(data_med['objects'], key=getSep, reverse=True)  
            elif request.GET["rank_by"]=='max_oct':
                data['objects'] = sorted(data_med['objects'], key=getOct, reverse=True) 
            elif request.GET["rank_by"]=='max_nov':
                data['objects'] = sorted(data_med['objects'], key=getNov, reverse=True) 
            elif request.GET["rank_by"]=='max_dec':
                data['objects'] = sorted(data_med['objects'], key=getDec, reverse=True)

        return data

    def dehydrate(self, bundle):
        monthCode = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
        popMonth = {'mjan__sum':0,'mfeb__sum':0,'mmar__sum':0,'mapr__sum':0,'mmay__sum':0,'mjun__sum':0,'mjul__sum':0,'maug__sum':0,'msep__sum':0,'moct__sum':0,'mnov__sum':0,'mdec__sum':0}
        high_risk = {'max':0,'month':''}
        transaction3 = CountryMonthlyCyclonesInfo.objects.filter(country=bundle.data['iso3']).values('country').annotate(Sum(monthCode[0])).annotate(Sum(monthCode[1])).annotate(Sum(monthCode[2])).annotate(Sum(monthCode[3])).annotate(Sum(monthCode[4])).annotate(Sum(monthCode[5])).annotate(Sum(monthCode[6])).annotate(Sum(monthCode[7])).annotate(Sum(monthCode[8])).annotate(Sum(monthCode[9])).annotate(Sum(monthCode[10])).annotate(Sum(monthCode[11]))
        for x in transaction3:
            for y in monthCode:
                popMonth['m'+y+'__sum'] += x[y+'__sum']
                print y
                print x
                if x[y+'__sum'] > high_risk['max']:
                    high_risk['max'] = x[y+'__sum']
                    high_risk['month'] = y

        transaction = CountryGeneralInfo.objects.filter(country=bundle.data['iso3']).values('tot_pop', 'gdp_per_cap','hdi','num_cat_0_5_cyclones','num_cat_1_5_cyclones','exposed_pop','storm_surge_exposed_pop','low_risk_cyclone','low_med_risk_cyclone','med_risk_cyclone','med_high_risk_cyclone','high_risk_cyclone')
        for x in transaction:
            for y in x:
                if x[y] == None:
                    x[y]=0
                              
        bundle.data['tot_pop'] = transaction[0]['tot_pop']
        bundle.data['gdp_per_cap'] = transaction[0]['gdp_per_cap']
        bundle.data['hdi'] = transaction[0]['hdi']
        bundle.data['num_cat_0_5_cyclones'] = transaction[0]['num_cat_0_5_cyclones']
        bundle.data['num_cat_1_5_cyclones'] = transaction[0]['num_cat_1_5_cyclones']
        bundle.data['exposed_pop'] = transaction[0]['exposed_pop']
        bundle.data['storm_surge_exposed_pop'] = transaction[0]['storm_surge_exposed_pop']
        bundle.data['low_risk_cyclone'] = transaction[0]['low_risk_cyclone']
        bundle.data['low_med_risk_cyclone'] = transaction[0]['low_med_risk_cyclone']
        bundle.data['med_risk_cyclone'] = transaction[0]['med_risk_cyclone']
        bundle.data['med_high_risk_cyclone'] = transaction[0]['med_high_risk_cyclone']
        bundle.data['high_risk_cyclone'] = transaction[0]['high_risk_cyclone']
        bundle.data['high_risk'] = high_risk

        ##### CountryMonthlyCyclonesInfo
        transaction2 = CountryMonthlyCyclonesInfo.objects.filter(country=bundle.data['iso3']).values('country', 'category', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec')
        grab = {'Cat 0':'', 'Cat 1' : '', 'Cat 2':'', 'Cat 3':'', 'Cat 4':'', 'Cat 5':''}  
        for x in transaction2 :
            if x['category']=='Cat 0':
                grab['Cat 0']=str(x['jan'])+','+str(x['feb'])+','+str(x['mar'])+','+str(x['apr'])+','+str(x['may'])+','+str(x['jun'])+','+str(x['jul'])+','+str(x['aug'])+','+str(x['sep'])+','+str(x['oct'])+','+str(x['nov'])+','+str(x['dec'])         
            if x['category']=='Cat 1':
                grab['Cat 1']=str(x['jan'])+','+str(x['feb'])+','+str(x['mar'])+','+str(x['apr'])+','+str(x['may'])+','+str(x['jun'])+','+str(x['jul'])+','+str(x['aug'])+','+str(x['sep'])+','+str(x['oct'])+','+str(x['nov'])+','+str(x['dec'])         
            if x['category']=='Cat 2':
                grab['Cat 2']=str(x['jan'])+','+str(x['feb'])+','+str(x['mar'])+','+str(x['apr'])+','+str(x['may'])+','+str(x['jun'])+','+str(x['jul'])+','+str(x['aug'])+','+str(x['sep'])+','+str(x['oct'])+','+str(x['nov'])+','+str(x['dec'])         
            if x['category']=='Cat 3':
                grab['Cat 3']=str(x['jan'])+','+str(x['feb'])+','+str(x['mar'])+','+str(x['apr'])+','+str(x['may'])+','+str(x['jun'])+','+str(x['jul'])+','+str(x['aug'])+','+str(x['sep'])+','+str(x['oct'])+','+str(x['nov'])+','+str(x['dec'])         
            if x['category']=='Cat 4':
                grab['Cat 4']=str(x['jan'])+','+str(x['feb'])+','+str(x['mar'])+','+str(x['apr'])+','+str(x['may'])+','+str(x['jun'])+','+str(x['jul'])+','+str(x['aug'])+','+str(x['sep'])+','+str(x['oct'])+','+str(x['nov'])+','+str(x['dec'])         
            if x['category']=='Cat 5':
                grab['Cat 5']=str(x['jan'])+','+str(x['feb'])+','+str(x['mar'])+','+str(x['apr'])+','+str(x['may'])+','+str(x['jun'])+','+str(x['jul'])+','+str(x['aug'])+','+str(x['sep'])+','+str(x['oct'])+','+str(x['nov'])+','+str(x['dec'])         
        bundle.data['chartvalue']=grab['Cat 0']+'|'+grab['Cat 1']+'|'+grab['Cat 2']+'|'+grab['Cat 3']+'|'+grab['Cat 4']+'|'+grab['Cat 5']
        bundle.data['popMonth'] = popMonth
        return bundle

    class Meta:
        filtering = CommonMetaApi.filtering
        filtering.update({'doc_type': ALL})
        queryset = Country.objects.all()
        ordering = ['name','extended_name']
        if settings.RESOURCE_PUBLISHING:
            queryset = queryset.filter(is_published=True)
        resource_name = 'cyclones'         

class DroughtCountryResource(HazardModelApi):

    """Country API"""
    def dehydrate(self, bundle):
        monthCode = ['mjan','mfeb','mmar','mapr','mmay','mjun','mjul','maug','msep','moct','mnov','mdes']
        transaction = DroughtInfo.objects.filter(iso3_id=bundle.data['iso3']).values('iso3', 'freq').order_by('iso3').annotate(Sum(monthCode[0])).annotate(Sum(monthCode[1])).annotate(Sum(monthCode[2])).annotate(Sum(monthCode[3])).annotate(Sum(monthCode[4])).annotate(Sum(monthCode[5])).annotate(Sum(monthCode[6])).annotate(Sum(monthCode[7])).annotate(Sum(monthCode[8])).annotate(Sum(monthCode[9])).annotate(Sum(monthCode[10])).annotate(Sum(monthCode[11]))
        
        RP = {
            'R10':{},
            'R20':{},
            'R20':{},
            'R30':{},
            'R40':{},
            'R50':{},
            'R60':{},
            'R70':{},
            'R80':{},
            'R90':{},
            'R100':{},
            'total':0
        }

        for temp in monthCode :
            RP['R10'][temp] = 0
            RP['R20'][temp] = 0
            RP['R30'][temp] = 0
            RP['R40'][temp] = 0
            RP['R50'][temp] = 0
            RP['R60'][temp] = 0
            RP['R70'][temp] = 0
            RP['R80'][temp] = 0
            RP['R90'][temp] = 0
            RP['R100'][temp] = 0

        for x in transaction :
            wheel = 0
            if x["freq"] <= 10:
                for temp in monthCode :
                    RP['R10'][temp] += x[temp+'__sum']
                    if wheel < RP['R10'][temp]:
                        wheel = RP['R10'][temp]
                    RP['R10']["total"]=wheel   
                if RP["total"] < RP['R10']["total"]: 
                   RP["total"] = RP['R10']["total"]  

            if x["freq"] > 10 and x["freq"] <=20:
                for temp in monthCode :
                    RP['R20'][temp] += x[temp+'__sum']
                    if wheel < RP['R20'][temp]:
                        wheel = RP['R20'][temp]
                    RP['R20']["total"]=wheel   
                if RP["total"] < RP['R20']["total"]: 
                   RP["total"] = RP['R20']["total"]  

            if x["freq"] > 20 and x["freq"] <=30:
                for temp in monthCode :
                    RP['R30'][temp] += x[temp+'__sum']
                    if wheel < RP['R30'][temp]:
                        wheel = RP['R30'][temp]
                    RP['R30']["total"]=wheel   
                if RP["total"] < RP['R30']["total"]: 
                   RP["total"] = RP['R30']["total"]
            
            if x["freq"] > 30 and x["freq"] <=40:
                for temp in monthCode :
                    RP['R40'][temp] += x[temp+'__sum']
                    if wheel < RP['R40'][temp]:
                        wheel = RP['R40'][temp]
                    RP['R40']["total"]=wheel   
                if RP["total"] < RP['R40']["total"]: 
                   RP["total"] = RP['R40']["total"] 

            if x["freq"] > 40 and x["freq"] <=50:
                for temp in monthCode :
                    RP['R50'][temp] += x[temp+'__sum']
                    if wheel < RP['R50'][temp]:
                        wheel = RP['R50'][temp]
                    RP['R50']["total"]=wheel   
                if RP["total"] < RP['R50']["total"]: 
                   RP["total"] = RP['R50']["total"]  

            if x["freq"] > 50 and x["freq"] <=60:
                for temp in monthCode :
                    RP['R60'][temp] += x[temp+'__sum']
                    if wheel < RP['R60'][temp]:
                        wheel = RP['R60'][temp]
                    RP['R60']["total"]=wheel   
                if RP["total"] < RP['R60']["total"]: 
                   RP["total"] = RP['R60']["total"]  

            if x["freq"] > 60 and x["freq"] <=70:
                for temp in monthCode :
                    RP['R70'][temp] += x[temp+'__sum']
                    if wheel < RP['R70'][temp]:
                        wheel = RP['R70'][temp]
                    RP['R70']["total"]=wheel   
                if RP["total"] < RP['R70']["total"]: 
                   RP["total"] = RP['R70']["total"] 

            if x["freq"] > 70 and x["freq"] <=80:
                for temp in monthCode :
                    RP['R80'][temp] += x[temp+'__sum']
                    if wheel < RP['R80'][temp]:
                        wheel = RP['R80'][temp]
                    RP['R80']["total"]=wheel   
                if RP["total"] < RP['R80']["total"]: 
                   RP["total"] = RP['R80']["total"]

            if x["freq"] > 80 and x["freq"] <=90:
                for temp in monthCode :
                    RP['R90'][temp] += x[temp+'__sum']
                    if wheel < RP['R90'][temp]:
                        wheel = RP['R90'][temp]
                    RP['R90']["total"]=wheel   
                if RP["total"] < RP['R90']["total"]: 
                   RP["total"] = RP['R90']["total"] 

            if x["freq"] > 90 :
                for temp in monthCode :
                    RP['R100'][temp] += x[temp+'__sum']
                    if wheel < RP['R100'][temp]:
                        wheel = RP['R100'][temp]
                    RP['R100']["total"]=wheel   
                if RP["total"] < RP['R100']["total"]: 
                   RP["total"] = RP['R100']["total"]  
        grab={}
        
        tempX = 'R10'
        grab[tempX]=str(float(RP[tempX]['mjan']))+','+str(float(RP[tempX]['mfeb']))+','+str(float(RP[tempX]['mmar']))+','+str(float(RP[tempX]['mapr']))+','+str(float(RP[tempX]['mmay']))+','+str(float(RP[tempX]['mjun']))+','+str(float(RP[tempX]['mjul']))+','+str(float(RP[tempX]['maug']))+','+str(float(RP[tempX]['msep']))+','+str(float(RP[tempX]['moct']))+','+str(float(RP[tempX]['mnov']))+','+str(float(RP[tempX]['mdes']))
        
        tempX = 'R20'
        grab[tempX]=str(float(RP[tempX]['mjan']))+','+str(float(RP[tempX]['mfeb']))+','+str(float(RP[tempX]['mmar']))+','+str(float(RP[tempX]['mapr']))+','+str(float(RP[tempX]['mmay']))+','+str(float(RP[tempX]['mjun']))+','+str(float(RP[tempX]['mjul']))+','+str(float(RP[tempX]['maug']))+','+str(float(RP[tempX]['msep']))+','+str(float(RP[tempX]['moct']))+','+str(float(RP[tempX]['mnov']))+','+str(float(RP[tempX]['mdes']))
        
        tempX = 'R30'
        grab[tempX]=str(float(RP[tempX]['mjan']))+','+str(float(RP[tempX]['mfeb']))+','+str(float(RP[tempX]['mmar']))+','+str(float(RP[tempX]['mapr']))+','+str(float(RP[tempX]['mmay']))+','+str(float(RP[tempX]['mjun']))+','+str(float(RP[tempX]['mjul']))+','+str(float(RP[tempX]['maug']))+','+str(float(RP[tempX]['msep']))+','+str(float(RP[tempX]['moct']))+','+str(float(RP[tempX]['mnov']))+','+str(float(RP[tempX]['mdes']))
        
        tempX = 'R40'
        grab[tempX]=str(float(RP[tempX]['mjan']))+','+str(float(RP[tempX]['mfeb']))+','+str(float(RP[tempX]['mmar']))+','+str(float(RP[tempX]['mapr']))+','+str(float(RP[tempX]['mmay']))+','+str(float(RP[tempX]['mjun']))+','+str(float(RP[tempX]['mjul']))+','+str(float(RP[tempX]['maug']))+','+str(float(RP[tempX]['msep']))+','+str(float(RP[tempX]['moct']))+','+str(float(RP[tempX]['mnov']))+','+str(float(RP[tempX]['mdes']))
        
        tempX = 'R50'
        grab[tempX]=str(float(RP[tempX]['mjan']))+','+str(float(RP[tempX]['mfeb']))+','+str(float(RP[tempX]['mmar']))+','+str(float(RP[tempX]['mapr']))+','+str(float(RP[tempX]['mmay']))+','+str(float(RP[tempX]['mjun']))+','+str(float(RP[tempX]['mjul']))+','+str(float(RP[tempX]['maug']))+','+str(float(RP[tempX]['msep']))+','+str(float(RP[tempX]['moct']))+','+str(float(RP[tempX]['mnov']))+','+str(float(RP[tempX]['mdes']))
        
        tempX = 'R60'
        grab[tempX]=str(float(RP[tempX]['mjan']))+','+str(float(RP[tempX]['mfeb']))+','+str(float(RP[tempX]['mmar']))+','+str(float(RP[tempX]['mapr']))+','+str(float(RP[tempX]['mmay']))+','+str(float(RP[tempX]['mjun']))+','+str(float(RP[tempX]['mjul']))+','+str(float(RP[tempX]['maug']))+','+str(float(RP[tempX]['msep']))+','+str(float(RP[tempX]['moct']))+','+str(float(RP[tempX]['mnov']))+','+str(float(RP[tempX]['mdes']))
        
        tempX = 'R70'
        grab[tempX]=str(float(RP[tempX]['mjan']))+','+str(float(RP[tempX]['mfeb']))+','+str(float(RP[tempX]['mmar']))+','+str(float(RP[tempX]['mapr']))+','+str(float(RP[tempX]['mmay']))+','+str(float(RP[tempX]['mjun']))+','+str(float(RP[tempX]['mjul']))+','+str(float(RP[tempX]['maug']))+','+str(float(RP[tempX]['msep']))+','+str(float(RP[tempX]['moct']))+','+str(float(RP[tempX]['mnov']))+','+str(float(RP[tempX]['mdes']))
        
        tempX = 'R80'
        grab[tempX]=str(float(RP[tempX]['mjan']))+','+str(float(RP[tempX]['mfeb']))+','+str(float(RP[tempX]['mmar']))+','+str(float(RP[tempX]['mapr']))+','+str(float(RP[tempX]['mmay']))+','+str(float(RP[tempX]['mjun']))+','+str(float(RP[tempX]['mjul']))+','+str(float(RP[tempX]['maug']))+','+str(float(RP[tempX]['msep']))+','+str(float(RP[tempX]['moct']))+','+str(float(RP[tempX]['mnov']))+','+str(float(RP[tempX]['mdes']))
        
        tempX = 'R90'
        grab[tempX]=str(float(RP[tempX]['mjan']))+','+str(float(RP[tempX]['mfeb']))+','+str(float(RP[tempX]['mmar']))+','+str(float(RP[tempX]['mapr']))+','+str(float(RP[tempX]['mmay']))+','+str(float(RP[tempX]['mjun']))+','+str(float(RP[tempX]['mjul']))+','+str(float(RP[tempX]['maug']))+','+str(float(RP[tempX]['msep']))+','+str(float(RP[tempX]['moct']))+','+str(float(RP[tempX]['mnov']))+','+str(float(RP[tempX]['mdes']))
        
        tempX = 'R100'
        grab[tempX]=str(float(RP[tempX]['mjan']))+','+str(float(RP[tempX]['mfeb']))+','+str(float(RP[tempX]['mmar']))+','+str(float(RP[tempX]['mapr']))+','+str(float(RP[tempX]['mmay']))+','+str(float(RP[tempX]['mjun']))+','+str(float(RP[tempX]['mjul']))+','+str(float(RP[tempX]['maug']))+','+str(float(RP[tempX]['msep']))+','+str(float(RP[tempX]['moct']))+','+str(float(RP[tempX]['mnov']))+','+str(float(RP[tempX]['mdes']))
        
        bundle.data["popatrisk"] = RP 
        bundle.data["chartvalue"] = grab['R10']+'|'+grab['R20']+'|'+grab['R30']+'|'+grab['R40']+'|'+grab['R50']+'|'+grab['R60']+'|'+grab['R70']+'|'+grab['R80']+'|'+grab['R90']+'|'+grab['R100']                               
        return bundle

    class Meta:
        filtering = CommonMetaApi.filtering
        filtering.update({'doc_type': ALL})
        queryset = Country.objects.all()
        ordering = ['name','extended_name']
        if settings.RESOURCE_PUBLISHING:
            queryset = queryset.filter(is_published=True)
        resource_name = 'drought'  
