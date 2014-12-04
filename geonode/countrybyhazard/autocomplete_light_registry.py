import autocomplete_light
from geonode.countrybyhazard.models import Country

class CountryHazardAutocomplete(autocomplete_light.AutocompleteModelBase):
	search_fields = ['^name']

autocomplete_light.register(Country,CountryHazardAutocomplete)