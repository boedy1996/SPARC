from django.shortcuts import render,render_to_response
from django.template import RequestContext, Template
# Create your views here.

def index(request):
	return render_to_response('country_list.html', context_instance=RequestContext(request))

def hazard_detail(request):
	return render_to_response('hazard_detail/hazard_detail.html', context_instance=RequestContext(request))
