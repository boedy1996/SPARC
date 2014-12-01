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

	
