from django.shortcuts import HttpResponse, render,render_to_response
from django.template import RequestContext, Template
import psycopg2
import json
import datetime

# Create your views here.
__dbConnect= "dbname='geonode-imports' user='geonode' host='10.11.40.84' password='geonode'"
def index(request):
	return render_to_response('country_list.html', context_instance=RequestContext(request))

def hazard_detail(request):
	currentDate = datetime.datetime.now()
	return render_to_response('hazard_detail/hazard_detail.html', {'monthName':currentDate.strftime("%B")}, context_instance=RequestContext(request))

def getGeoJSON_Flood_Data(request):
	print '>>> querying the admin2 level data from database'
	connection = psycopg2.connect(__dbConnect)
	cursor = connection.cursor()

	query = "SELECT row_to_json(fc) "
	query += "FROM ( SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features "
	query += "FROM (SELECT 'Feature' As type "
	query += ", ST_AsGeoJSON(lg.the_geom)::json As geometry "
	query += ", ST_AsGeoJSON(ST_Centroid(lg.the_geom))::json As geometry_points "
	query += ", row_to_json((SELECT l FROM (SELECT adm2_code, adm2_name, adm1_name) As l "
	query += "  )) As properties "
	query += "FROM sparc_gaul_wfp_iso As lg where "
	query += " lg.iso3='"+request.GET.get('iso3')
	query += "') As f )  As fc" 	
	#print 'test'
	cursor.execute(query)
	res = cursor.fetchone()
	
	query = "select row_to_json(fin) "
	query += "from (select row_to_json(row) "
	query += "from ("
	query += "select iso3, trim(adm2_code) as adm2_code, rp, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec, 0 as active_month from sparc_population_month where iso3='"+request.GET.get('iso3')+"'"
	query += ") row) fin;"
	cursor.execute(query)
	rows = cursor.fetchall()

	for x in res[0]["features"]:
		for y in rows:
			if y[0]["rp"]==25 and str(y[0]["adm2_code"])==str(x["properties"]["adm2_code"]):
				x["properties"]["RP25"]=y[0]
			elif y[0]["rp"]==50 and str(y[0]["adm2_code"])==str(x["properties"]["adm2_code"]):	
				x["properties"]["RP50"]=y[0]
			elif y[0]["rp"]==100 and str(y[0]["adm2_code"])==str(x["properties"]["adm2_code"]):	
				x["properties"]["RP100"]=y[0]	
			elif y[0]["rp"]==200 and str(y[0]["adm2_code"])==str(x["properties"]["adm2_code"]):	
				x["properties"]["RP200"]=y[0]	
			elif y[0]["rp"]==500 and str(y[0]["adm2_code"])==str(x["properties"]["adm2_code"]):	
				x["properties"]["RP500"]=y[0]
			elif y[0]["rp"]==1000 and str(y[0]["adm2_code"])==str(x["properties"]["adm2_code"]):	
				x["properties"]["RP1000"]=y[0]
		x["properties"]["active"]=x["properties"]["RP25"]
		currentDate = datetime.datetime.now()
		monthNameTemp = currentDate.strftime("%b").lower()
		x["properties"]["active"]["active_month"] = x["properties"]["active"][monthNameTemp]

	cursor.close()
	del cursor
	connection.close()	

	geom = json.dumps(res, default=jdefault)

	return HttpResponse(geom, mimetype = 'application/json')

def jdefault(o):
  return o.__dict__