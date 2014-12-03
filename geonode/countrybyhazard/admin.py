from geonode.countrybyhazard.models import Country, Area, FloodedPopAtRisk
from django.contrib import admin

# Register your models here.
admin.site.register(Country)
admin.site.register(Area)
admin.site.register(FloodedPopAtRisk)