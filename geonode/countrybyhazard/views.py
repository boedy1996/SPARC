from django.shortcuts import HttpResponse, render,render_to_response
from django.template import RequestContext, Template
import psycopg2
import json, requests
import datetime


try:
    import simplejson as json
except ImportError:
    import json
    
# Create your views here.
__dbConnect= "dbname='geonode-imports' user='geonode' host='10.11.40.84' password='geonode'"
def index(request):
	return render_to_response('country_list.html', context_instance=RequestContext(request))

def cyclone_country_list(request):
	return render_to_response('cyclone_country_list.html', context_instance=RequestContext(request))

def drought_country_list(request):
	return render_to_response('drought_country_list.html', context_instance=RequestContext(request))	

def hazard_detail(request):
	currentDate = datetime.datetime.now()
	return render_to_response('hazard_detail/hazard_detail.html', {'monthName':currentDate.strftime("%B")}, context_instance=RequestContext(request))

# belon siap, segera siapkan detail dan country list untuk type hazard drought
def drought_detail(request):
	currentDate = datetime.datetime.now()
	return render_to_response('drought_detail/drought_detail.html', {'monthName':currentDate.strftime("%B")}, context_instance=RequestContext(request))	

def cyclone_detail(request):
	currentDate = datetime.datetime.now()
	return render_to_response('cyclone_detail/cyclone_detail.html', {'monthName':currentDate.strftime("%B")}, context_instance=RequestContext(request))	

def getCountry(request):
	connection = psycopg2.connect(__dbConnect)
	cursor = connection.cursor()
	query = "select row_to_json(fin) from (select row_to_json(row) from (select * from countrybyhazard_country) row) fin"
	cursor.execute(query)
	rows = cursor.fetchall()
	cursor.close()
	del cursor
	connection.close()
	data = json.dumps(rows, default=jdefault)
	return HttpResponse(data, mimetype = 'application/json')

def getHeatMapData(request):
	connection = psycopg2.connect(__dbConnect)
	cursor = connection.cursor()

	query = "SELECT row_to_json(fc) "
	query += "FROM ( SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features "
	query += "FROM (SELECT 'Feature' As type "
	query += ", ST_AsGeoJSON(lg.geom)::json As geometry "
	#query += ", ST_AsGeoJSON(ST_Centroid(lg.the_geom))::json As geometry_points "
	query += ", row_to_json((SELECT l FROM (SELECT adm2_name, count) As l "
	query += "  )) As properties "
	query += "FROM sparc_flood_events As lg where "
	query += " lg.iso3='"+request.GET.get('iso3')
	query += "') As f )  As fc" 	
	cursor.execute(query)
	res = cursor.fetchone()
	geom = json.dumps(res, default=jdefault)
	return HttpResponse(geom, mimetype = 'application/json')

def getEmdatData(request):
	if request.GET.get('type') == 'flood':
		url = "http://emdat.be/advanced_search/php/search.php?_dc=1421829005944&start_year=1900&end_year=2025&continent=&region=&country_name="+request.GET.get('iso3')+"&dis_group=&dis_subgroup=Hydrological&dis_type=&dis_subtype=&aggreg=start_year&page=1&start=0&limit=1000&sort=%5B%7B%22property%22%3A%22occurrence%22%2C%22direction%22%3A%22ASC%22%7D%5D"	
	elif request.GET.get('type') == 'cyclone':
		url = "http://emdat.be/advanced_search/php/search.php?_dc=1421836347780&start_year=1900&end_year=2025&continent=&region=&country_name="+request.GET.get('iso3')+"&dis_group=Natural&dis_subgroup=Meteorological&dis_type=Storm&dis_subtype=&aggreg=start_year&page=1&start=0&limit=1000"	
	elif request.GET.get('type') == 'drought':
		url = "http://emdat.be/advanced_search/php/search.php?_dc=1421836347780&start_year=1900&end_year=2025&continent=&region=&country_name="+request.GET.get('iso3')+"&dis_group=Natural&dis_subgroup=Climatological&dis_type=Drought&dis_subtype=&aggreg=start_year&page=1&start=0&limit=1000"
	resp = requests.get(url=url)
	return HttpResponse(resp, mimetype = 'application/json')

def getGeoJSON_Drought_Data(request):
	print '>>> querying the admin2 level data from database'
	connection = psycopg2.connect(__dbConnect)
	cursor = connection.cursor()
	query = "SELECT row_to_json(fc) "
	query += "FROM ( SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features "
	query += "FROM (SELECT 'Feature' As type "
	query += ", ST_AsGeoJSON(ST_Simplify(lg.geom, 0.01))::json As geometry "
	#query += ", ST_AsGeoJSON(ST_Centroid(lg.the_geom))::json As geometry_points "
	query += ", row_to_json((SELECT l FROM (SELECT adm2_code, adm2_name, adm1_code, adm1_name, adm0_code, 0 as active_month) As l "
	query += "  )) As properties "
	query += "FROM sparc_gaul_wfp_iso As lg where "
	query += " lg.iso3='"+request.GET.get('iso3')
	query += "') As f )  As fc" 	
	cursor.execute(query)
	res = cursor.fetchone()
	#print type(res[0])
	if type(res[0]) is not dict :
		results = json.loads(res[0])
	else:
		results = res[0]

	query = "select row_to_json(fin) "
	query += "from (select row_to_json(row) "
	query += "from ("
	query += "select iso3_id, trim(adm2code) as adm2code, freq as category, mjan, mfeb, mmar, mapr, mmay, mjun, mjul, maug, msep, moct, mnov, mdes from countrybyhazard_droughtinfo where iso3_id='"+request.GET.get('iso3')+"'"
	query += ") row) fin;"
	cursor.execute(query)
	rows = cursor.fetchall()	

	currentDate = datetime.datetime.now()
	monthNameTemp = currentDate.strftime("%b").lower()



	for x in results["features"]:
		x["properties"]["addinfo"]=[]
		x["properties"]["FCS"]=0
		for row in rows:
			if type(row[0]) is not dict :
				newRow = json.loads(row[0])
			else:
				newRow = row[0]	
			if newRow["adm2code"] == str(x["properties"]["adm2_code"]):
				x["properties"]["addinfo"].append(newRow)	
				if newRow["category"]>0 and newRow["category"]<=10:
					x["properties"]["active_month"] += newRow['m'+monthNameTemp]

	cursor.close()
	del cursor
	connection.close()	

	geom = json.dumps(results, default=jdefault)
	return HttpResponse(geom, mimetype = 'application/json')	


def getGeoJSON_Cyclone_Data(request):
	print '>>> querying the admin2 level data from database'
	connection = psycopg2.connect(__dbConnect)
	cursor = connection.cursor()

	query = "SELECT row_to_json(fc) "
	query += "FROM ( SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features "
	query += "FROM (SELECT 'Feature' As type "
	query += ", ST_AsGeoJSON(ST_Simplify(lg.geom, 0.01))::json As geometry "
	#query += ", ST_AsGeoJSON(ST_Centroid(lg.the_geom))::json As geometry_points "
	query += ", row_to_json((SELECT l FROM (SELECT adm2_code, adm2_name, adm1_code, adm1_name, adm0_code, 0 as active_month) As l "
	query += "  )) As properties "
	query += "FROM sparc_gaul_wfp_iso As lg where "
	query += " lg.iso3='"+request.GET.get('iso3')
	query += "') As f )  As fc" 	
	cursor.execute(query)
	res = cursor.fetchone()
	#print type(res[0])
	if type(res[0]) is not dict :
		results = json.loads(res[0])
	else:
		results = res[0]	

	query = "select row_to_json(fin) "
	query += "from (select row_to_json(row) "
	query += "from ("
	query += "select iso3, trim(adm2_code) as adm2_code, trim(category) as category, trim(prob_class) as prob_class, annual, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec from sparc_admin2_cyclones_exposed_population where iso3='"+request.GET.get('iso3')+"'"
	query += ") row) fin;"
	cursor.execute(query)
	rows = cursor.fetchall()

	currentDate = datetime.datetime.now()
	monthNameTemp = currentDate.strftime("%b").lower()



	for x in results["features"]:
		x["properties"]["addinfo"]=[]
		x["properties"]["FCS"]=0
		x["properties"]["FCS_border"]=0
		x["properties"]["FCS_acceptable"]=0
		x["properties"]["CSI_no"]=0
		x["properties"]["CSI_low"]=0
		x["properties"]["CSI_med"]=0
		x["properties"]["CSI_high"]=0
		for row in rows:
			if type(row[0]) is not dict :
				newRow = json.loads(row[0])
			else:
				newRow = row[0]	
			if newRow["adm2_code"] == str(x["properties"]["adm2_code"]):
				x["properties"]["addinfo"].append(newRow)	
				if newRow["category"]=='cat1_5' and newRow["prob_class"]=='0.01-0.1':
					x["properties"]["active_month"] += newRow[monthNameTemp]
					
		#hasil = [row[0] for row in rows if row[0]["adm2_code"] == str(x["properties"]["adm2_code"])]
		#hasil = [row for row in rows if json.loads(row[0])["adm2_code"] == str(x["properties"]["adm2_code"])]
		#x["properties"]["addinfo"] = hasil
		#for item in hasil:
		#	if item["category"]=='cat1_5' and item["prob_class"]=='0.01-0.1':
		#		x["properties"]["active_month"] += item[monthNameTemp]
	
	cursor.close()
	del cursor
	connection.close()	

	geom = json.dumps(results, default=jdefault)
	return HttpResponse(geom, mimetype = 'application/json')

def getGeoJSON_Flood_Data(request):
	print '>>> querying the admin2 level data from database'
	connection = psycopg2.connect(__dbConnect)
	cursor = connection.cursor()

	query = "SELECT row_to_json(fc) "
	query += "FROM ( SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features "
	query += "FROM (SELECT 'Feature' As type "
	query += ", ST_AsGeoJSON(ST_Simplify(lg.geom, 0.01))::json As geometry "
	#query += ", ST_AsGeoJSON(ST_Centroid(lg.the_geom))::json As geometry_points "
	query += ", row_to_json((SELECT l FROM (SELECT adm2_code, adm2_name, adm1_code, adm1_name, adm0_code) As l "
	query += "  )) As properties "
	query += "FROM sparc_gaul_wfp_iso As lg where "
	query += " lg.iso3='"+request.GET.get('iso3')
	query += "') As f )  As fc" 	
	#print 'test'
	cursor.execute(query)
	res = cursor.fetchone()
	#print type(res[0])
	if type(res[0]) is not dict :
		results = json.loads(res[0])
	else:
		results = res[0]	

	query = "select row_to_json(fin) "
	query += "from (select row_to_json(row) "
	query += "from ("
	query += "select iso3, trim(adm2_code) as adm2_code, rp, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec, 0 as active_month from sparc_population_month where iso3='"+request.GET.get('iso3')+"'"
	query += ") row) fin;"
	cursor.execute(query)
	rows = cursor.fetchall()

	for x in results["features"]:
		for y in rows:

			if type(y[0]) is not dict :
				newY = json.loads(y[0])
			else:
				newY = y[0]	

			if newY["rp"]==25 and str(newY["adm2_code"])==str(x["properties"]["adm2_code"]):
				x["properties"]["RP25"]=newY
			elif newY["rp"]==50 and str(newY["adm2_code"])==str(x["properties"]["adm2_code"]):	
				x["properties"]["RP50"]=newY
			elif newY["rp"]==100 and str(newY["adm2_code"])==str(x["properties"]["adm2_code"]):	
				x["properties"]["RP100"]=newY	
			elif newY["rp"]==200 and str(newY["adm2_code"])==str(x["properties"]["adm2_code"]):	
				x["properties"]["RP200"]=newY
			elif newY["rp"]==500 and str(newY["adm2_code"])==str(x["properties"]["adm2_code"]):	
				x["properties"]["RP500"]=newY
			elif newY["rp"]==1000 and str(newY["adm2_code"])==str(x["properties"]["adm2_code"]):	
				x["properties"]["RP1000"]=newY
		x["properties"]["FCS"]=0
		x["properties"]["FCS_border"]=0
		x["properties"]["FCS_acceptable"]=0
		x["properties"]["CSI_no"]=0
		x["properties"]["CSI_low"]=0
		x["properties"]["CSI_med"]=0
		x["properties"]["CSI_high"]=0
		currentDate = datetime.datetime.now()
		monthNameTemp = currentDate.strftime("%b").lower()
		try:
		  x["properties"]["active"]=x["properties"]["RP25"]		
		  x["properties"]["active"]["active_month"] = x["properties"]["active"][monthNameTemp]
		except: 
		  x["properties"]["active"]={'iso3':'0','adm2_code':x["properties"]["adm2_code"],'adm2_code':x["properties"]["adm2_code"], 'rp': 0, 'jan':0,'feb':0,'mar':0,'apr':0,'may':0,'jun':0,'jul':0,'aug':0,'sep':0,'oct':0,'nov':0,'dec':0,'active_month':0}		
		
		

	cursor.close()
	del cursor
	connection.close()	

	geom = json.dumps(results, default=jdefault)

	return HttpResponse(geom, mimetype = 'application/json')

def jdefault(o):
  return o.__dict__