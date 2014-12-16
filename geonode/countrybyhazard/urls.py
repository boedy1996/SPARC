
from django.conf.urls import patterns, url
from geonode.countrybyhazard import views

urlpatterns = patterns('',
    url(r'^$', views.index, name='country_browse'),
    url(r'^flood/$', views.hazard_detail, name='hazard_detail'),
    url(r'^getFloodedGeoJSON/$', views.getGeoJSON_Flood_Data, name='getGeoJSON_Flood_Data'),
)