
from django.conf.urls import patterns, url
from geonode.countrybyhazard import views

urlpatterns = patterns('',
    url(r'^$', views.index, name='country_browse')
    
)