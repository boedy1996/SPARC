'use strict';

(function(){
  
  var module = angular.module('hazard_main_search', [], function($locationProvider) {
      $locationProvider.html5Mode({
        enabled: true,
        requireBase: false
      });

      // make sure that angular doesn't intercept the page links
      angular.element("a").prop("target", "_self");
  });

  module.controller('hazard_map_Controller', function($injector, $scope, $location, $http, leafletData){
    $('#floodQL').removeClass('hide');
    var date = new Date(),
        month = date.getMonth();
    var _shortMonthName = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    $scope.selectedRP = ['RP25','RP50','RP100','RP200','RP500','RP1000'];
    $scope.selectedMultipleMonth = [_shortMonthName[month]];
    $scope.countryName = $location.search()['country'];
    $scope.countryISO3 = $location.search()['iso'];
    $scope.selectedMonth = _shortMonthName[month];
    $scope.FlagFCS = ['c_poor','c_borderline'];
    $scope.FlagCSI = ['c_low'];
    $scope.legendRangePercentage = [0.25,0.50,0.75];
    $scope.popFloodedData = null;
    $scope.selectedObject = null;
    $scope.FCS = false;
    $scope.CSI = false;
    $scope.maxPopAllProbs = 0;
    $scope.Country = [];
    $scope.hazard = true;
    //$scope.legendRange = [0,100,1000];
    $scope.legendRange = [0,100];
    $scope.floodEvents = {'max': 8, 'data' : []};
    $scope.EIV = [];
    $scope.geojson = {
      data: [],
      style: style,
      //onEachFeature: onEachFeature,
      resetStyleOnMouseout: true
    };
    $scope.emdatData = [];
    $scope.markers = new Array();

    var popup = new L.Popup({offset:new L.Point(0,-3)});

    $scope.rowCollection = [];

    function bestFitZoom()
    { 

      leafletData.getMap().then(function (map) {
        // declaring the group variable  
        var group = new L.featureGroup;
        // map._layers gives all the layers of the map including main container
        // so looping in all those layers filtering those having feature  

        leafletData.getGeoJSON().then(function(geoJSON) { 
          angular.forEach(geoJSON._layers, function(rows){
            //console.log(rows.feature);
             //if(rows.feature){  
                group.addLayer(rows);
              //}  
          });
          map.fitBounds(group.getBounds());
        }); 
        
      });   
    }

    $scope.privateHighchartsNG = {
        options: {
            chart: {
                type: 'column',
                width: 325,
                height: 150
            },
            plotOptions: {
                column: {
                    stacking: 'normal'
                }
            }
        },
        series: [],
        title: {
            text: ''
        },
        xAxis: {
                  categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        },
        yAxis: {
                  title: {
                      text: 'Pop'
                  },
                  min :0
        },
        loading: false
    }

    $scope.highchartsNG = {
        options: {
            chart: {
                type: 'column'
            },
            plotOptions: {
                column: {
                    stacking: 'normal'
                }
            }
        },
        series: [],
        title: {
            text: ''
        },
        xAxis: {
                  categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        },
        yAxis: {
                  title: {
                      text: 'Population'
                  },
                  min :0
        },
        loading: false
    }

    var radius = 0.5;
    if ($scope.countryISO3=='IND'){
      radius = 2;
    }

    var cfg = {
      // radius should be small ONLY if scaleRadius is true (or small radius is intended)
      // if scaleRadius is false it will be the constant radius used in pixels
      "radius": radius,
      "maxOpacity": .8, 
      // scales the radius based on map zoom
      "scaleRadius": true, 
      // if set to false the heatmap uses the global maximum for colorization
      // if activated: uses the data maximum within the current map boundaries 
      //   (there will always be a red spot with useLocalExtremas true)
      "useLocalExtrema": true,
      // which field name in your data represents the latitude - default "lat"
      latField: 'lat',
      // which field name in your data represents the longitude - default "lng"
      lngField: 'lng',
      // which field name in your data represents the data value - default "value"
      valueField: 'count'
    };

    var heatmapLayer = new HeatmapOverlay(cfg);

    $scope.defaults = {
       scrollWheelZoom: false
    }
    angular.extend($scope, {
      /*legend: {
          position: 'bottomleft',
          colors: [ '#ff0000', '#28c9ff', '#0000ff', '#ecf386' ],
          labels: [ 'National Cycle Route', 'Regional Cycle Route', 'Local Cycle Network', 'Cycleway' ]
      },*/
      center: {
                lat: 40.8471,
                lng: 14.0625,
                zoom: 2
      },
      layers: {
        overlays: {
          warehouses : {
            name:'Population Landscan',
            type: 'wms',
            url:'http://geonode.wfp.org/geoserver/wms',
            visible : false,
            layerOptions: {
              layers: 'geonode:wld_poi_warehouses_wfp',
              format: 'image/png',
              //opacity: 0.5,
              styles : '',
              crs: L.CRS.EPSG4326,
              transparent : true
            }
          },
          landscan : {
            name:'Population Landscan',
            type: 'wms',
            url:'http://10.11.40.84/geoserver/geonode/wms',
            visible : false,
            layerOptions: {
              layers: 'geonode:lscan13',
              format: 'image/png',
              opacity: 0.5,
              styles : 'lscan',
              crs: L.CRS.EPSG4326,
              transparent : true
            }
          },
          probabilities : {
            name:'Flood Probabilities',
            type: 'wms',
            url:'http://10.11.40.84/geoserver/geonode/wms',
            visible : true,
            layerOptions: {
              layers: 'geonode:f_'+$scope.countryISO3.toLowerCase(),
              format: 'image/png',
              //opacity: 0.25,
              styles : 'RP25',
              crs: L.CRS.EPSG4326,
              transparent : true
            }
          },
          EIVLayer : {
            name:'EIV',
            type: 'wms',
            url:'http://10.11.40.84/geoserver/geonode/wms',
            visible : false,
            layerOptions: {
              layers: 'geonode:eiv_cmr_real',
              format: 'image/png',
              //opacity: 0.25,
              styles : '',
              crs: L.CRS.EPSG4326,
              transparent : true
            }
          },
          FCSLayer : {
            name:'FCS',
            type: 'wms',
            url:'http://10.11.40.84/geoserver/geonode/wms',
            visible : false,
            layerOptions: {
              layers: 'geonode:vam',
              format: 'image/png',
              opacity: 0.25,
              styles : 'fcs',
              crs: L.CRS.EPSG4326,
              transparent : true
            }
          },
          CSILayer : {
            name:'FCS',
            type: 'wms',
            url:'http://10.11.40.84/geoserver/geonode/wms',
            visible : false,
            layerOptions: {
              layers: 'geonode:vam',
              format: 'image/png',
              opacity: 0.25,
              styles : 'csi',
              crs: L.CRS.EPSG4326,
              transparent : true
            }
          }
        },
        baselayers:{
          warden: {
            name: 'Warden-MapBox',
            type: 'xyz',
            //url: 'http://{s}.tiles.mapbox.com/v3/mapbox.mapbox-warden/{z}/{x}/{y}.png',
            url: 'http://{s}.tile.thunderforest.com/outdoors/{z}/{x}/{y}.png',
            layerOptions: {
                subdomains: ['a', 'b', 'c'],
                //attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                continuousWorld: true
            }
          },
          opencyclemap: {
            name: 'OpenCycleMap',
            type: 'xyz',
            url: 'http://{s}.tile.opencyclemap.org/cycle/{z}/{x}/{y}.png',
            layerOptions: {
                subdomains: ['a', 'b', 'c'],
                attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                continuousWorld: true
            }
          },
          outdoors: {
            name: 'Outdoors',
            type: 'xyz',
            url: 'http://{s}.tile.thunderforest.com/outdoors/{z}/{x}/{y}.png',
            layerOptions: {
                subdomains: ['a', 'b', 'c'],
                attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                continuousWorld: true
            }
          },
          osm: {
            name: 'OpenStreetMap',
            type: 'xyz',
            url: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            layerOptions: {
                subdomains: ['a', 'b', 'c'],
                attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                continuousWorld: true
            }
          }

        }
      }

    });

    leafletData.getMap().then(function (map) {
      var loadingControl = L.Control.loading({
        separate: true
      });
      
      map.addControl(loadingControl);
      //map.addLayer(heatmapLayer);
      //console.log(heatmapLayer)
      //console.log(map);
      
    });

    function onEachFeature(feature, layer) {
        
    }

    function style(feature) {
        return {
            fillColor: getColor(feature.properties.active['active_month']),
            weight: 1,
            opacity: 1,
            color: 'white',
            dashArray: '1',
            fillOpacity: 0.75
        };
    }

    function getColor(x) {
      /*
      return x > 10000 ? '#FF0000' :
             x > 7500  ? '#EF000F' :
             x > 5000  ? '#DF001F' :
             x > 2500  ? '#CF002F' :
             x > 1000  ? '#BF003F' :
             x >  750  ? '#AF004F' :
             x >  500  ? '#9F005F' :
             x >  250  ? '#8F006F' :
             x >  100  ? '#7F007F' :
             x >   75  ? '#6F008F' :
             x >   50  ? '#5F009F' :
             x >   25  ? '#4F00AF' :
             x >   10  ? '#3F00BF' :
             x >    7  ? '#2F00CF' :
             x >    5  ? '#1F00DF' :
             x >    2  ? '#0F00EF' :
             x >    0  ? '#0000FF' :
                         '#FFFFFF' ;*/
      //console.log($scope.FCS);
      var multiply = 1;
      if ($scope.FCS || $scope.CSI){
        multiply = 0.1;
      }                   
      return x > ($scope.legendRange[4]*multiply) ? '#FF0000' :
             x > ($scope.legendRange[3]*multiply) ? '#FFA500' :
             x > ($scope.legendRange[2]*multiply) ? '#eff76a' :                   
             x > ($scope.legendRange[1]*multiply) ? '#76f579' :
             x > ($scope.legendRange[0]*multiply) ? '#e1d3d3' :
                                         '#FFFFFF' ;

    }

    NProgress.start();
    $('#screen').css({  "display": "block", opacity: 0.25, "width":$(document).width(),"height":$(document).height(), "z-index":1000000});
    $http.get("../getFloodedGeoJSON/?iso3="+$location.search()['iso']).success(function(data, status) {
      var last_adm1_code = 0;
      var RPs = ['RP25','RP50','RP100','RP200','RP500','RP1000'];
      $scope.popFloodedData = data;
      $scope.manage_featuredata();
      $scope.updateGEOJSON(data);
      $scope.addChartSeries($scope.selectedRP,$scope.popFloodedData);
      $scope.addTableSeries($scope.selectedRP,$scope.popFloodedData);

      angular.forEach(data.features, function(rowC){
        angular.forEach(_shortMonthName, function(monthName){
          var tempValue = 0;
          angular.forEach(RPs, function(RP){
            tempValue += rowC.properties[RP][monthName]
          });
          if (tempValue > $scope.maxPopAllProbs) $scope.maxPopAllProbs = tempValue;
        });
      });
      //console.log($scope.maxPopAllProbs);
      //console.log($scope.legendRangePercentage);
      //console.log($scope.legendRange);
      //console.log(Math.ceil($scope.maxPopAllProbs/1000)*1000);
      var threshold = 100000;
      //console.log($scope.maxPopAllProbs.toString().length);
      if ($scope.maxPopAllProbs.toString().length == 5){
        threshold = 10000;
      } else if ($scope.maxPopAllProbs.toString().length == 4){
        threshold = 1000;
      } else if ($scope.maxPopAllProbs.toString().length == 3){
        threshold = 100;
      } else if ($scope.maxPopAllProbs.toString().length == 2){
        threshold = 10;
      }

      $scope.maxPopAllProbs = Math.ceil($scope.maxPopAllProbs/(-threshold))*(-threshold);
      //console.log($scope.maxPopAllProbs);
      //var eachRange = $scope.maxPopAllProbs/4;
      for (var tt=0;tt<3;tt++){
        //console.log($scope.legendRangePercentage[tt]*$scope.maxPopAllProbs);
        $scope.legendRange.push($scope.legendRangePercentage[tt]*$scope.maxPopAllProbs);
      }

      //console.log($scope.legendRange);
      $scope.generateLegend();

      $http.get("../getEmdatData/?type=flood&iso3="+$location.search()['iso']).success(function(dataEmdat,status){
        $scope.emdatData = dataEmdat.data;
      });

      $http.get("../getHeatMapData/?type=flood&iso3="+$location.search()['iso']).success(function(heatRes,status){
        //console.log(heatRes);
        if ($scope.IsJsonString(heatRes[0]))
           var finData = JSON.parse(heatRes[0])
        else
          var finData = heatRes[0];  
        angular.forEach(finData.features, function(item){
          $scope.floodEvents.data.push({'lat':item.geometry.coordinates[1], 'lng':item.geometry.coordinates[0], 'count':item.properties.count});
        });
      });

      //console.log($scope.popFloodedData);
      angular.forEach($scope.popFloodedData.features, function(row){

          last_adm1_code = row.properties.adm1_code;
          $http.get("http://reporting.vam.wfp.org/JSON/SPARC_GetFCS.aspx?adm0="+row.properties.adm0_code+"&adm1="+row.properties.adm1_code+"&indTypeID=2").success(function(response, status) {
              var maxMonthYear = new Date(2000, 0, 1, 0, 0, 0, 0);
              angular.forEach(response, function(item){
                var currentMonthYear = new Date(item.FCS_year, item.FCS_month-1, 1, 0, 0, 0, 0);
                if (currentMonthYear>maxMonthYear){
                  row.properties.FCS = item.FCS_poor;
                  row.properties.FCS_border = item.FCS_borderline;
                  row.properties.FCS_acceptable = item.FCS_acceptable;
                }
              });
          });
          http://reporting.vam.wfp.org/JSON/GetCsi.aspx ?type=cs&adm0=45&adm1=822&adm2=0&adm3=0&adm4=0&adm5=0&indTypeID=2 
          $http.get("http://reporting.vam.wfp.org/JSON/GetCsi.aspx?type=cs&adm0="+row.properties.adm0_code+"&adm1="+row.properties.adm1_code+"&indTypeID=2").success(function(response, status) {
              var maxMonthYear = new Date(2000, 0, 1, 0, 0, 0, 0);
              angular.forEach(response, function(item){
                var currentMonthYear = new Date(item.CSI_rYear, item.CSI_rMonth-1, 1, 0, 0, 0, 0);
                if (currentMonthYear>maxMonthYear){
                  row.properties.CSI_no = item.CSI_rNoCoping;
                  row.properties.CSI_low = item.CSI_rLowCoping;
                  row.properties.CSI_med = item.CSI_rMediumCoping;
                  row.properties.CSI_high = item.CSI_rHighCoping;
                }
              });
          });

        
      });
      //console.log($scope.popFloodedData.features);
      NProgress.done(true);
      NProgress.remove();
      $('#screen').css({"display":"none"});
      bestFitZoom();
    });
    
    /*
    $http.get("https://maps.googleapis.com/maps/api/geocode/json?address="+$location.search()['country']).success(function(data, status) {
      leafletData.getMap().then(function (map) {
        //console.log(data);
        var southWest = L.latLng(data.results[0].geometry.bounds.southwest.lat, data.results[0].geometry.bounds.southwest.lng);
        var northEast = L.latLng(data.results[0].geometry.bounds.northeast.lat, data.results[0].geometry.bounds.northeast.lng);
        var bounds = L.latLngBounds(southWest, northEast);           
        map.fitBounds(bounds);
      });  
    });*/

    $http.get("../getCountry/").success(function(data, status) {
      angular.forEach(data, function(row){
        if ($scope.IsJsonString(row[0]))
          $scope.Country.push(JSON.parse(row[0]))
        else
          $scope.Country.push(row[0]);  
      });
    });

    $scope.refreshGEOJSON = function(){
      leafletData.getMap().then(function (map) {      
        leafletData.getGeoJSON().then(function(geoJSON) { 
          angular.forEach(geoJSON._layers, function(rows){
            geoJSON.resetStyle(rows);
          });
        });

      });
    }

    $scope.updateGEOJSON = function(data){
      //console.log(data);
      leafletData.getMap().then(function (map) {  
        leafletData.getGeoJSON().then(function(geoJSON) { 

          angular.forEach(geoJSON._layers, function(rows){
            map.removeLayer(rows);
          });
          
          //$scope.updateGEOJSON($scope.popFloodedData);
          angular.forEach(data.features, function(rows){
            //console.log(rows);
            geoJSON.addData(rows);
          });
          geoJSON.addTo(map);
        });

      });
            
    }

    $scope.addPrivateChartSeries = function(rps, data){
      var _shortMonthName = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

      for (var x=$scope.privateHighchartsNG.series.length;x>0;x--){
        $scope.privateHighchartsNG.series.pop();
      }
      
      if ($scope.FCS)
        var FCS_value = data.properties.FCS/100
      else 
        var FCS_value = 1;

      angular.forEach(rps, function(rp){
        var color='';
        if (rp=="RP25"){
          color='#082155';
        } else if (rp=="RP50"){
          color='#193C84';
        } else if (rp=="RP100"){
          color='#2F5BB4';
        } else if (rp=="RP200"){
          color='#4F7CD5';
        }else if (rp=="RP500"){
          color='#82A3E5';
        }else if (rp=="RP1000"){
          color='#B5CAF3';
        }
        var _each = {'name':rp, color:color, data : [0,0,0,0,0,0,0,0,0,0,0,0]};

        for (var monthNumber in _shortMonthName){
          if (typeof data.properties[rp] != 'undefined')
            _each.data[monthNumber] += Math.floor(data.properties[rp][_shortMonthName[monthNumber]]*FCS_value);
        }

        $scope.privateHighchartsNG.series.push(_each);
      });
      
    }

    $scope.addChartSeries = function(rps, data){
      $scope.EIV = []
      var _shortMonthName = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

      for (var x=$scope.highchartsNG.series.length;x>0;x--){
        $scope.highchartsNG.series.pop();
      }

      //console.log(rps);
      rps.sort(function(a, b){
        //console.log(a.substring(2, a.length),b.substring(2, b.length))
        var tempA = parseInt(a.substring(2, a.length));
        var tempB = parseInt(b.substring(2, b.length));
        return tempB-tempA;
      });

      angular.forEach(rps, function(rp){
        var color='';
        if (rp=="RP25"){
          color='#082155';
        } else if (rp=="RP50"){
          color='#193C84';
        } else if (rp=="RP100"){
          color='#2F5BB4';
        } else if (rp=="RP200"){
          color='#4F7CD5';
        }else if (rp=="RP500"){
          color='#82A3E5';
        }else if (rp=="RP1000"){
          color='#B5CAF3';
        }
        var _each = {'name':rp, color:color,data : [0,0,0,0,0,0,0,0,0,0,0,0]};
        $scope.EIV[rp]=0;
        angular.forEach(data.features, function(row){
          if ($scope.FCS)
            var FCS_value = row.properties.FCS/100
          else 
            var FCS_value = 1;
          if (typeof row.properties[rp] != 'undefined')
            for (var monthNumber in _shortMonthName){
              _each.data[monthNumber] += Math.floor(row.properties[rp][_shortMonthName[monthNumber]]*FCS_value);
            }
        });
        //console.log(Math.max.apply( Math, _each.data ));
        $scope.EIV[rp] = Math.max.apply( Math, _each.data );
        $scope.highchartsNG.series.push(_each);
      });
      //console.log($scope.highchartsNG.series);
      //console.log($scope.EIV);
    }

    $scope.addTableSeries = function(rps, data){
      //console.log($scope.rowCollection);
      //console.log(data);
      for (var x=$scope.rowCollection.length;x>0;x--){
        $scope.rowCollection.pop();
      }

      angular.forEach(data.features, function(row){
        var _each = {adm2_code:'',region:'',jan :0,feb:0,mar:0,apr:0,may:0,jun:0,jul:0,aug:0,sep:0,oct:0,nov:0,dec:0};
        _each.region = row.properties.adm2_name;
        if ($scope.FCS)
          var FCS_value = row.properties.FCS/100
        else 
          var FCS_value = 1;
        angular.forEach(rps, function(rp){
          if (typeof row.properties[rp] != 'undefined'){
            _each.jan += Math.floor(row.properties[rp].jan*FCS_value);
            _each.feb += Math.floor(row.properties[rp].feb*FCS_value);
            _each.mar += Math.floor(row.properties[rp].mar*FCS_value);
            _each.apr += Math.floor(row.properties[rp].apr*FCS_value);
            _each.may += Math.floor(row.properties[rp].may*FCS_value);
            _each.jun += Math.floor(row.properties[rp].jun*FCS_value);
            _each.jul += Math.floor(row.properties[rp].jul*FCS_value);
            _each.aug += Math.floor(row.properties[rp].aug*FCS_value);
            _each.sep += Math.floor(row.properties[rp].sep*FCS_value);
            _each.oct += Math.floor(row.properties[rp].oct*FCS_value);
            _each.nov += Math.floor(row.properties[rp].nov*FCS_value);
            _each.dec += Math.floor(row.properties[rp].dec*FCS_value);
          }  
        });
        $scope.rowCollection.push(_each);
      });
      //console.log($scope.rowCollection);
    }     

    $scope.multiple_choice_listener = function($event){    
      var selectedLayerOverlay = [];
      var element = $($event.target);
      var query_entry = [];
      var data_filter = element.attr('data-filter');
      var value = element.attr('data-value');
      //console.log(element);
      var allElement = angular.element(element).parent().parent();
      //console.log(allElement[0].children);

      angular.forEach(allElement[0].children, function(rows){
        var temp = $(rows.children);
        if (temp.hasClass('active')){
          if (temp.attr('data-value')!=value){
            //console.log(temp.attr('data-value'));
            selectedLayerOverlay.push(temp.attr('data-value'));
          }  
        }  
      });


      // If the element is active active then deactivate it
      if(element.hasClass('active')){
        // clear the active class from it
        element.removeClass('active');
        // Remove the entry from the correct query in scope        
        query_entry.splice(query_entry.indexOf(value), 1);
      }
      // if is not active then activate it
      else if(!element.hasClass('active')){
        // Add the entry in the correct query
        if (query_entry.indexOf(value) == -1){
          query_entry.push(value);  
        }         
        element.addClass('active');
        selectedLayerOverlay.push(value);
      }  


      if ($.inArray('popatrisk_block', selectedLayerOverlay)>=0){        
        $scope.updateGEOJSON($scope.popFloodedData); 
      } else {
        $scope.updateGEOJSON({
              type : "FeatureCollection",
              features : []
          });   
      }
      //alert($.inArray('raster', selectedLayerOverlay));

      if ($.inArray('raster', selectedLayerOverlay)>=0){
        $scope.layers.overlays.probabilities.visible = true;
      } else {
        $scope.layers.overlays.probabilities.visible = false;  
      }

      if ($.inArray('popatrisk_heat', selectedLayerOverlay)>=0){
         leafletData.getMap().then(function (map) {
            map.addLayer(heatmapLayer);
            heatmapLayer.setData($scope.floodEvents);
          });
      } else {
        leafletData.getMap().then(function (map) {
          map.removeLayer(heatmapLayer);
        });  
      }
      
      if ($.inArray('landscan', selectedLayerOverlay)>=0){
        $scope.layers.overlays.landscan.visible = true;
      } else {
        $scope.layers.overlays.landscan.visible = false;  
      }

      if ($.inArray('warehouses', selectedLayerOverlay)>=0){
        $scope.layers.overlays.warehouses.visible = true;
      } else {
        $scope.layers.overlays.warehouses.visible = false;  
      }

      if ($.inArray('EIVLayer', selectedLayerOverlay)>=0){
        $scope.layers.overlays.EIVLayer.visible = true;
      } else {
        $scope.layers.overlays.EIVLayer.visible = false;  
      }
      
      if ($.inArray('FCS', selectedLayerOverlay)>=0){
        $scope.layers.overlays.FCSLayer.visible = true;
      } else {
        $scope.layers.overlays.FCSLayer.visible = false;  
      }

      if ($.inArray('CSI', selectedLayerOverlay)>=0){
        $scope.layers.overlays.CSILayer.visible = true;
      } else {
        $scope.layers.overlays.CSILayer.visible = false;  
      }

    }

    $scope.external_choice_listener = function($event){    
      var filtered = [];
      var element = $($event.target);
      var query_entry = [];
      var data_filter = element.attr('data-filter');
      var value = element.attr('data-value');
      //console.log(element);
      var allElement = angular.element(element).parent().parent();

      angular.forEach(allElement[0].children, function(rows){
        var temp = $(rows.children);
        //console.log(temp);
        
        if (temp.hasClass('active')){
          if (temp.attr('data-value')!=value){
            filtered.push(temp.attr('data-value'));
          }  
        }  
      });

      /*// If the element is active active then deactivate it
      if(element.hasClass('active')){
        // clear the active class from it
        element.removeClass('active');
        // Remove the entry from the correct query in scope        
        query_entry.splice(query_entry.indexOf(value), 1);
      }
      // if is not active then activate it
      else if(!element.hasClass('active')){
        // Add the entry in the correct query
        if (query_entry.indexOf(value) == -1){
          query_entry.push(value);  
        }         
        element.addClass('active');
        filtered.push(value);
      } */ 

      if(element.hasClass('active')){
        // clear the active class from it
        element.removeClass('active');
        // Remove the entry from the correct query in scope        
        query_entry.splice(query_entry.indexOf(value), 1);

        if (value == 'FCS'){
          angular.forEach(element.parents('li').find('input'), function(rows){
            $(rows).prop( "disabled", true );
          });
          $scope.FCS = false;
        } else if (value == 'CSI'){
          angular.forEach(element.parents('li').find('input'), function(rows){
            $(rows).prop( "disabled", true );
          });
          $scope.CSI = false;
        }  
      }

      else if(!element.hasClass('active')){
        // Add the entry in the correct query
        query_entry = value;
        // clear the active class from it
        element.parents('ul').find('a').removeClass('active');
        element.addClass('active');
        filtered.push(value);
        if (value=='FCS'){
          angular.forEach(element.parents('li').find('input'), function(rows){
            $(rows).prop( "disabled", false );
          });
          $scope.CSI = false;
          $scope.FCS = true;
          $('#c_no').prop( "disabled", true );
          $('#c_low').prop( "disabled", true );
          $('#c_med').prop( "disabled", true );
          $('#c_high').prop( "disabled", true );
        } else if (value=='CSI'){
          angular.forEach(element.parents('li').find('input'), function(rows){
            $(rows).prop( "disabled", false );
          });
          $scope.CSI = true;
          $scope.FCS = false;
          $('#c_poor').prop( "disabled", true );
          $('#c_borderline').prop( "disabled", true );
          $('#c_accepptable').prop( "disabled", true );
        }
      } 
      //console.log(filtered);
      /*
      if ($.inArray('FCS', filtered)>=0){
        angular.forEach(element.parents('li').find('input'), function(rows){
          $(rows).prop( "disabled", false );
          console.log(rows);
        });
        $scope.FCS = true;
      } else {
        angular.forEach(element.parents('li').find('input'), function(rows){
          $(rows).prop( "disabled", true );
        });
        $scope.FCS = false;
      }

      if ($.inArray('CSI', filtered)>=0){
        angular.forEach(element.parents('li').find('input'), function(rows){
          $(rows).prop( "disabled", false );
          console.log(rows);
        });
        $scope.FCS = true;
      } else {
        angular.forEach(element.parents('li').find('input'), function(rows){
          $(rows).prop( "disabled", true );
        });
        $scope.FCS = false;
      }
      */
      $scope.manage_featuredata();
      $scope.refreshGEOJSON(); 
      $scope.addChartSeries($scope.selectedRP,$scope.popFloodedData);
      $scope.addTableSeries($scope.selectedRP,$scope.popFloodedData);
      $scope.generateLegend();
    }

    $scope.resetGeoJSONLayer = function(layer){
      ///
    }

    $scope.single_choice_listener = function($event){
      var element = $($event.target);
      var query_entry = [];
      var data_filter = element.attr('data-filter');
      var value = element.attr('data-value');
      
      leafletData.getMap().then(function(map) {
        leafletData.getLayers().then(function (layers) {
            $.each(map._layers, function (layer) {
                if (typeof map._layers[layer]._layers == "undefined" ){
                  map.removeLayer(map._layers[layer]);
                }  
            });
            map.addLayer(layers.baselayers[value]);
            $scope.updateGEOJSON($scope.popFloodedData);
        });
      });
      
      if(!element.hasClass('active')){
        // Add the entry in the correct query
        query_entry = value;
        // clear the active class from it
        element.parents('ul').find('a').removeClass('active');
        element.addClass('active');
      }     
    }

    $scope.manage_featuredata = function(){
      //console.log($scope.selectedRP);
      // $scope.EIV["RP25"] = 0;  
      // $scope.EIV["RP50"] = 0;
      // $scope.EIV["RP100"] = 0;
      // $scope.EIV["RP200"] = 0;
      // $scope.EIV["RP500"] = 0;
      // $scope.EIV["RP1000"] = 0;
      for (var x in $scope.popFloodedData.features){
        
        var pertama = true;
        var tempValue = 0;
        if ($scope.FCS){
          if ($.inArray('c_poor', $scope.FlagFCS)>=0){
            tempValue += $scope.popFloodedData.features[x].properties.FCS;
          }
          if ($.inArray('c_borderline', $scope.FlagFCS)>=0){
            tempValue += $scope.popFloodedData.features[x].properties.FCS_border;
          }
          if ($.inArray('c_accepptable', $scope.FlagFCS)>=0){
            tempValue += $scope.popFloodedData.features[x].properties.FCS_acceptable;
          }
          var FCS_value = (tempValue)/100;
        } else if ($scope.CSI){
          if ($.inArray('c_no', $scope.FlagCSI)>=0){
            tempValue += $scope.popFloodedData.features[x].properties.CSI_no;
          }
          if ($.inArray('c_low', $scope.FlagCSI)>=0){
            tempValue += $scope.popFloodedData.features[x].properties.CSI_low;
          }
          if ($.inArray('c_med', $scope.FlagCSI)>=0){
            tempValue += $scope.popFloodedData.features[x].properties.CSI_med;
          }
           if ($.inArray('c_high', $scope.FlagCSI)>=0){
            tempValue += $scope.popFloodedData.features[x].properties.CSI_high;
          }
          var FCS_value = (tempValue)/100;
        } else{ 
          var FCS_value = 1;
        }  

        for (var key in $scope.selectedRP){  
          //console.log($scope.selectedRP[key]);
          //console.log($scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].jan,$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].feb,$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].mar,$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].apr,$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].may,$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].jun,$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].jul,$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].aug,$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].sep,$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].oct,$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].nov,$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].dec);
          //var temp = [$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].jan,$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].feb,$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].mar,$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].apr,$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].may,$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].jun,$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].jul,$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].aug,$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].sep,$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].oct,$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].nov,$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].dec];
          //console.log(temp);
          //console.log(Math.max.apply(Math, temp));
          //$scope.EIV[$scope.selectedRP[key]] += Math.max.apply(Math, temp)*FCS_value;
          if (pertama){
            $scope.popFloodedData.features[x].properties.active.jan=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].jan*FCS_value;
            $scope.popFloodedData.features[x].properties.active.feb=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].feb*FCS_value;
            $scope.popFloodedData.features[x].properties.active.mar=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].mar*FCS_value;
            $scope.popFloodedData.features[x].properties.active.apr=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].apr*FCS_value;
            $scope.popFloodedData.features[x].properties.active.may=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].may*FCS_value;
            $scope.popFloodedData.features[x].properties.active.jun=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].jun*FCS_value;
            $scope.popFloodedData.features[x].properties.active.jul=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].jul*FCS_value;
            $scope.popFloodedData.features[x].properties.active.aug=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].aug*FCS_value;
            $scope.popFloodedData.features[x].properties.active.sep=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].sep*FCS_value;
            $scope.popFloodedData.features[x].properties.active.oct=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].oct*FCS_value;
            $scope.popFloodedData.features[x].properties.active.nov=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].nov*FCS_value;
            $scope.popFloodedData.features[x].properties.active.dec=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].dec*FCS_value;
            pertama = false;
          } else {
            $scope.popFloodedData.features[x].properties.active.jan+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].jan*FCS_value;
            $scope.popFloodedData.features[x].properties.active.feb+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].feb*FCS_value;
            $scope.popFloodedData.features[x].properties.active.mar+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].mar*FCS_value;
            $scope.popFloodedData.features[x].properties.active.apr+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].apr*FCS_value;
            $scope.popFloodedData.features[x].properties.active.may+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].may*FCS_value;
            $scope.popFloodedData.features[x].properties.active.jun+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].jun*FCS_value;
            $scope.popFloodedData.features[x].properties.active.jul+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].jul*FCS_value;
            $scope.popFloodedData.features[x].properties.active.aug+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].aug*FCS_value;
            $scope.popFloodedData.features[x].properties.active.sep+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].sep*FCS_value;
            $scope.popFloodedData.features[x].properties.active.oct+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].oct*FCS_value;
            $scope.popFloodedData.features[x].properties.active.nov+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].nov*FCS_value;
            $scope.popFloodedData.features[x].properties.active.dec+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].dec*FCS_value;
          }
          
        } 
        $scope.popFloodedData.features[x].properties.active.active_month=0;

        for (var key in $scope.selectedMultipleMonth){
          //console.log($scope.selectedMultipleMonth[key]);
          if ($scope.popFloodedData.features[x].properties.active[$scope.selectedMultipleMonth[key]] > $scope.popFloodedData.features[x].properties.active.active_month)
            $scope.popFloodedData.features[x].properties.active.active_month=Math.floor($scope.popFloodedData.features[x].properties.active[$scope.selectedMultipleMonth[key]]);
        }
       
        
      }

      //console.log($scope.EIV);
    }

    $scope.month_multiple_choice_listener = function($event){
      var element = $($event.target);
      var query_entry = [];
      var data_filter = element.attr('data-filter');
      var value = element.attr('data-value');
      $scope.selectedMultipleMonth = [];

      var allElement = angular.element(element).parent();

      angular.forEach(allElement[0].children, function(rows){
        var temp = $(rows);
        if (temp.hasClass('active')){
          if (temp.attr('data-value')!=value){
            $scope.selectedMultipleMonth.push(temp.attr('data-value'));
          }  
        }  
      });

      if (value!='clear' && value !='all'){
        // If the element is active active then deactivate it
        if(element.hasClass('active')){
          // clear the active class from it
          element.removeClass('active');
          // Remove the entry from the correct query in scope        
          query_entry.splice(query_entry.indexOf(value), 1);
        }
        // if is not active then activate it
        else if(!element.hasClass('active')){
          // Add the entry in the correct query
          if (query_entry.indexOf(value) == -1){
            query_entry.push(value);  
          }         
          element.addClass('active');
          $scope.selectedMultipleMonth.push(value);
        }
      } else {
        if (value == 'clear'){
          angular.forEach(allElement[0].children, function(rows){
            var temp = $(rows);
            temp.removeClass('active');  
          });
          $scope.selectedMultipleMonth = [];
        } else if (value == 'all'){
          angular.forEach(allElement[0].children, function(rows){
            var temp = $(rows);
            if (temp.attr('data-value') != 'all' && temp.attr('data-value') != 'clear')
              temp.addClass('active');  
          });
          $scope.selectedMultipleMonth = _shortMonthName;
        }
      }  
      
      $scope.manage_featuredata();     
      $scope.refreshGEOJSON();
    }

    $scope.month_choice_listener = function($event){
      var element = $($event.target);
      var query_entry = [];
      var data_filter = element.attr('data-filter');
      var value = element.attr('data-value');
      $scope.selectedMonth = value;

      $scope.manage_featuredata();
      
      $scope.refreshGEOJSON(); 
      //console.log($scope.popFloodedData);

      if(!element.hasClass('active')){
        // Add the entry in the correct query
        query_entry = value;
        // clear the active class from it
        element.parents('ul').find('a').removeClass('active');
        element.addClass('active');
      }     
    }

    $scope.RP_choice_listener = function($event){
      var tempDownTo = ['RP1000','RP500','RP200','RP100','RP50','RP25'];
      var tempDownToUse = [];
      $scope.selectedRP = [];
      var element = $($event.target);
      var query_entry = [];
      var data_filter = element.attr('data-filter');
      var value = element.attr('data-value');

      for (var i=tempDownTo.indexOf(value);i<tempDownTo.length;i++){
        tempDownToUse.push(tempDownTo[i]);
      }

      //console.log(tempDownToUse);
      var allElement = angular.element(element).parent().parent();
      //console.log(allElement[0].children);


      angular.forEach(allElement[0].children, function(rows){
        var temp = $(rows.children);
        temp.removeClass('active');
        if ($.inArray(temp.attr('data-value'), tempDownToUse)>=0){
          //console.log(temp.attr('data-value'));
          temp.addClass('active');
          $scope.selectedRP.push(temp.attr('data-value'));
        }
        /*
        if (temp.hasClass('active')){
          if (temp.attr('data-value')!=value){
            //console.log(temp.attr('data-value'));
            $scope.selectedRP.push(temp.attr('data-value'));
          }  
        } 
        */ 
      });

      /*
      console.log($scope.selectedRP);
      // If the element is active active then deactivate it
      if(element.hasClass('active')){
        // clear the active class from it
        element.removeClass('active');
        // Remove the entry from the correct query in scope        
        query_entry.splice(query_entry.indexOf(value), 1);
      }
      // if is not active then activate it
      else if(!element.hasClass('active')){
        // Add the entry in the correct query
        if (query_entry.indexOf(value) == -1){
          query_entry.push(value);  
        }         
        element.addClass('active');
        $scope.selectedRP.push(value);
      }  
      */
      $scope.manage_featuredata();

      $scope.refreshGEOJSON(); 
      $scope.addChartSeries($scope.selectedRP,$scope.popFloodedData);
      $scope.addTableSeries($scope.selectedRP,$scope.popFloodedData);
     // console.log($scope.selectedRP.length);
      
      //$scope.layers.overlays.probabilities.layerOptions.layers = 'flood:CMR,flood:CMR,flood:CMR,flood:CMR,flood:CMR,flood:CMR';  
      //$scope.layers.overlays.probabilities.layerOptions.styles = 'RP25,RP50,RP100,RP200,RP500,RP1000';
     // console.log($scope.layers.overlays);

     leafletData.getMap().then(function(map) {
        leafletData.getLayers().then(function (layers) {
            layers.overlays.probabilities.setParams({'layers':$scope.prepLayerNameAndStyle().layer,'styles':$scope.prepLayerNameAndStyle().style},false);
        });
     });

    }

    $scope.prepLayerNameAndStyle = function(){
      var obj={'layer':'','style':''};
      var sep = '';
      for (var x=0;x<$scope.selectedRP.length;x++){
         if (obj.layer!='') sep = ','; 
         obj.layer += sep+'geonode:f_'+$scope.countryISO3.toLowerCase();
         obj.style += sep+$scope.selectedRP[x];
      }
      return obj;
    }

    $scope.$on("leafletDirectiveMap.geojsonMouseout", function(ev, feature, leafletEvent) {
      leafletData.getMap().then(function(map) {
        map.closePopup();
      });
    });

    $scope.$on("leafletDirectiveMap.geojsonMouseover", function(ev, feature, leafletEvent) {
      $scope.floodMouseOver(feature);
    });

    $scope.$on("leafletDirectiveMap.geojsonClick", function(ev, featureSelected, leafletEvent) {
      $scope.floodMouseClick(leafletEvent);
      $('#info').show();
    });

    $scope.floodMouseOver = function(feature){

      var layer = feature.target;
      layer.setStyle({
          weight: 2,
          color: '#666',
          fillColor: 'red'
      });
      layer.bringToFront();
      var bounds = layer.getBounds();
      var popupContent = "<h6>"+layer.feature.properties.adm2_name+"</h6>Pop at risk : "+layer.feature.properties.active.active_month;
      popup.setLatLng(bounds.getCenter());
      popup.setContent(popupContent);
      leafletData.getMap().then(function(map) {
        map.openPopup(popup);
      });
    }

    $scope.floodMouseClick = function(feature) {
      console.log(feature);
      var layer = feature.target;
      layer.setStyle({
          weight: 2,
          color: '#666',
          fillColor: 'red'
      });
      layer.bringToFront();
      $scope.selectedObject = layer.feature;
      $scope.addPrivateChartSeries($scope.selectedRP, $scope.selectedObject);
    }

    $scope.generateLegend = function(){
      leafletData.getMap().then(function (map) {
          var multiply=1;
          if ($scope.FCS || $scope.CSI){
            multiply = 0.1;
          }  
          var div = L.DomUtil.get('legendCustom'),
              grades = $scope.legendRange,
              labels = [];
          div.innerHTML = '';    
          // loop through our density intervals and generate a label with a colored square for each interval
          for (var i = 0; i < grades.length; i++) {
            if (i==0)
              div.innerHTML +=
                  '<li><a class=""><i style="background:' + getColor(grades[i]*multiply + 1) + '"></i>'+ (grades[i + 1]*multiply ? ' < ' + grades[i + 1]*multiply  : '+')+'</a></li>'
            else  
              div.innerHTML +=
                  '<li><a class=""><i style="background:' + getColor(grades[i]*multiply + 1) + '"></i>'+grades[i]*multiply + (grades[i + 1]*multiply ? '&ndash;' + grades[i + 1]*multiply  : '+')+'</a></li>';
          }
      });
    }  

    $scope.quicklinks = function($event){
      var element = $($event.target);
      var query_entry = [];
      var data_filter = element.attr('data-filter');
      var value = element.attr('data-value');
      var childElement = angular.element(element).parent().find('#_links');

      // If the element is active active then deactivate it
      if(element.hasClass('active')){
        // clear the active class from it
        element.removeClass('active');
        childElement.removeClass('openn');
        childElement.addClass('closed');
        // Remove the entry from the correct query in scope        
        query_entry.splice(query_entry.indexOf(value), 1);
      }
      // if is not active then activate it
      else if(!element.hasClass('active')){
        // Add the entry in the correct query
        if (query_entry.indexOf(value) == -1){
          query_entry.push(value);  
        }     
        childElement.removeClass('closed');    
        element.addClass('active');
        childElement.addClass('open');
      }     
    }

    leafletData.getMap().then(function(map) {
        leafletData.getLayers().then(function (layers) {
            layers.overlays.probabilities.setParams({'layers':$scope.prepLayerNameAndStyle().layer,'styles':$scope.prepLayerNameAndStyle().style},false);
        });
     });

    $scope.IsJsonString = function(str) {
        try {
            JSON.parse(str);
        } catch (e) {
            return false;
        }
        return true;
    }

    $('#c_poor').on('click', function(){
      if ($(this).is(':checked')){
        $scope.FlagFCS.push('c_poor');
      } else {
        $scope.FlagFCS.splice( $.inArray('c_poor',$scope.FlagFCS) ,1 );
      }
      $scope.procDataRefresh();
    });

    $('#c_borderline').on('click', function(){
      if ($(this).is(':checked')){
        $scope.FlagFCS.push('c_borderline');
      } else {
        $scope.FlagFCS.splice( $.inArray('c_borderline',$scope.FlagFCS) ,1 );
      }
      $scope.procDataRefresh();
    });

    $('#c_accepptable').on('click', function(){
      if ($(this).is(':checked')){
        $scope.FlagFCS.push('c_accepptable');
      } else {
        $scope.FlagFCS.splice( $.inArray('c_accepptable',$scope.FlagFCS) ,1 );
      }
      $scope.procDataRefresh();
    });

    $('#c_no').on('click', function(){
      if ($(this).is(':checked')){
        $scope.FlagCSI.push('c_no');
      } else {
        $scope.FlagCSI.splice( $.inArray('c_no',$scope.FlagCSI) ,1 );
      }
      $scope.procDataRefresh();
    });

    $('#c_low').on('click', function(){
      if ($(this).is(':checked')){
        $scope.FlagCSI.push('c_low');
      } else {
        $scope.FlagCSI.splice( $.inArray('c_low',$scope.FlagCSI) ,1 );
      }
      $scope.procDataRefresh();
    });

    $('#c_med').on('click', function(){
      if ($(this).is(':checked')){
        $scope.FlagCSI.push('c_med');
      } else {
        $scope.FlagCSI.splice( $.inArray('c_med',$scope.FlagCSI) ,1 );
      }
      $scope.procDataRefresh();
    });

    $('#c_high').on('click', function(){
      if ($(this).is(':checked')){
        $scope.FlagCSI.push('c_high');
      } else {
        $scope.FlagCSI.splice( $.inArray('c_high',$scope.FlagCSI) ,1 );
      }
      $scope.procDataRefresh();
    });

    $scope.procDataRefresh = function() {
      $scope.manage_featuredata();
      $scope.updateGEOJSON($scope.popFloodedData);
      $scope.addChartSeries($scope.selectedRP,$scope.popFloodedData);
      $scope.addTableSeries($scope.selectedRP,$scope.popFloodedData);
    }

  });
})();


