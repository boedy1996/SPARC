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
	