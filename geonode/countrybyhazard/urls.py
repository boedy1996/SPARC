
from django.conf.urls import patterns, url
from geonode.countrybyhazard import views

urlpatterns = patterns('',
    url(r'^$', views.index, name='country_browse'),
    url(r'^flood/$', views.hazard_detail, name='hazard_detail'),
    url(r'^getFloodedGeoJSON/$', views.getGeoJSON_Flood_Data, name='getGeoJSON_Flood_Data'),
    url(r'^cyclones/detail/$', views.cyclone_detail, name='cyclone_detail'),
    url(r'^cyclones/$', views.cyclone_country_list, name='cyclone_country_list'),
    url(r'^getCycloneGeoJSON/$', views.getGeoJSON_Cyclone_Data, name='getGeoJSON_Cyclone_Data'),
    url(r'^getCountry/$', views.getCountry, name='getCountry'),
    url(r'^getEmdatData/$', views.getEmdatData, name='getEmdatData'),
    url(r'^getHeatMapData/$', views.getHeatMapData, name='getHeatMapData'),
    
)