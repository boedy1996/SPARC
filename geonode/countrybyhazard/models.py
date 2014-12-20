from django.db import models
class Area(models.Model):
	id = models.IntegerField(unique=True, db_index=True, primary_key=True)	
	name = models.CharField(max_length=255)
	def __unicode__(self):
		return self.name
	class Meta:
		ordering = ("id",)
        verbose_name_plural = 'Metadata Continent Group'

# Create your models here.
class Country(models.Model):
	iso3 = models.CharField(max_length=3, unique=True, db_index=True, primary_key=True)
	wfp_area=models.ForeignKey(Area)
	name = models.CharField(max_length=255)
	extended_name = models.CharField(max_length=255)
	def __unicode__(self):
		return self.name

class FloodedPopAtRisk(models.Model):
	iso3 = models.ForeignKey(Country)
	adm2code = models.CharField(max_length=8)
	adm2name = models.CharField(max_length=255)
	rper = models.IntegerField(null=True, blank=True)
	mjan = models.IntegerField(null=True, blank=True)
	mfeb = models.IntegerField(null=True, blank=True)
	mmar = models.IntegerField(null=True, blank=True)
	mapr = models.IntegerField(null=True, blank=True)
	mmay = models.IntegerField(null=True, blank=True)
	mjun = models.IntegerField(null=True, blank=True)
	mjul = models.IntegerField(null=True, blank=True)
	maug = models.IntegerField(null=True, blank=True)
	msep = models.IntegerField(null=True, blank=True)
	moct = models.IntegerField(null=True, blank=True)
	mnov = models.IntegerField(null=True, blank=True)
	mdes = models.IntegerField(null=True, blank=True)
	def __unicode__(self):
		return self.adm2name

class CountryGeneralInfo(models.Model):
	country 	= models.OneToOneField(Country)
	tot_pop 	= models.IntegerField(null=True, blank=True)
	gdp_per_cap	= models.DecimalField(null=True, blank=True, max_digits=12, decimal_places=2)
	hdi			= models.DecimalField(null=True, blank=True, max_digits=12, decimal_places=2)
	num_cat_0_5_cyclones = models.IntegerField(null=True, blank=True)
	num_cat_1_5_cyclones = models.IntegerField(null=True, blank=True)
	exposed_pop = models.IntegerField(null=True, blank=True)
	storm_surge_exposed_pop = models.IntegerField(null=True, blank=True)
	low_risk_cyclone	 = models.IntegerField(null=True, blank=True)
	low_med_risk_cyclone = models.IntegerField(null=True, blank=True)
	med_risk_cyclone 	 = models.IntegerField(null=True, blank=True)
	med_high_risk_cyclone= models.IntegerField(null=True, blank=True)
	high_risk_cyclone 	 = models.IntegerField(null=True, blank=True)
	def __unicode__(self):
		return self.country.name

class CountryMonthlyCyclonesInfo(models.Model):
	country 	= models.ForeignKey(Country)
	category    = models.CharField(max_length=15)		
	jan	= models.IntegerField(null=True, blank=True)
	feb	= models.IntegerField(null=True, blank=True)
	mar	= models.IntegerField(null=True, blank=True)
	apr	= models.IntegerField(null=True, blank=True)
	may	= models.IntegerField(null=True, blank=True)
	jun	= models.IntegerField(null=True, blank=True)
	jul	= models.IntegerField(null=True, blank=True)
	aug	= models.IntegerField(null=True, blank=True)
	sep	= models.IntegerField(null=True, blank=True)
	oct	= models.IntegerField(null=True, blank=True)
	nov	= models.IntegerField(null=True, blank=True)
	dec	= models.IntegerField(null=True, blank=True)
	storm_serial = models.TextField()
	def __unicode__(self):
		return self.country.category
