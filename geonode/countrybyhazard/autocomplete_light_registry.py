import autocomplete_light
from geonode.countrybyhazard.models import Country

autocomplete_light.register(Country,
                            search_fields=['^name'],
                            autocomplete_js_attributes={'placeholder': 'Region/Country ..', },)
