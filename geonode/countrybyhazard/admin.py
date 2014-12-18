from geonode.countrybyhazard.models import Country, Area, FloodedPopAtRisk, CountryGeneralInfo
from django.contrib import admin

# Register your models here.
admin.site.register(Country)
admin.site.register(Area)
admin.site.register(FloodedPopAtRisk)
admin.site.register(CountryGeneralInfo)
