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
    $scope.selectedRP = ['RP25'];
    $scope.selectedMultipleMonth = [_shortMonthName[month]];
    $scope.countryName = $location.search()['country'];
    $scope.countryISO3 = $location.search()['iso'];
    $scope.selectedMonth = _shortMonthName[month];
    $scope.legendRangePercentage = [0.5,0.75,1];
    $scope.popFloodedData = null;
    $scope.selectedObject = null;
    $scope.FCS = false;
    $scope.maxPopAllProbs = 0;
    $scope.Country = [];
    $scope.hazard = true;
    $scope.legendRange = [0,100,1000];
    $scope.floodEvents = {'max': 8, 'data' : []};
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
            fillOpacity: 0.4
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
      return x > $scope.legendRange[4] ? '#FF0000' :
             x > $scope.legendRange[3] ? '#9933FF' :
             x > $scope.legendRange[2] ? '#FF9933' :                   
             x > $scope.legendRange[1] ? '#99CC33' :
             x > $scope.legendRange[0] ? '#0000FF' :
                                         '#FFFFFF' ;

    }

    NProgress.start();
    $('#screen').css({  "display": "block", opacity: 0.25, "width":$(document).width(),"height":$(document).height(), "z-index":1000000});
    $http.get("../getFloodedGeoJSON/?iso3="+$location.search()['iso']).success(function(data, status) {
      var last_adm1_code = 0;
      var RPs = ['RP25','RP50','RP100','RP200','RP500','RP1000'];
      $scope.popFloodedData = data;
      $scope.updateGEOJSON(data);
      $scope.addChartSeries(['RP25'],$scope.popFloodedData);
      $scope.addTableSeries(['RP25'],$scope.popFloodedData);

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
      //console.log(Math.ceil($scope.maxPopAllProbs/1000)*1000);
      $scope.maxPopAllProbs = Math.ceil($scope.maxPopAllProbs/1000)*1000;

      //var eachRange = $scope.maxPopAllProbs/4;
      for (var tt=0;tt<2;tt++){
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
        var _each = {'name':rp, data : [0,0,0,0,0,0,0,0,0,0,0,0]};

        for (var monthNumber in _shortMonthName){
          if (typeof data.properties[rp] != 'undefined')
            _each.data[monthNumber] += Math.floor(data.properties[rp][_shortMonthName[monthNumber]]*FCS_value);
        }

        $scope.privateHighchartsNG.series.push(_each);
      });
      
    }

    $scope.addChartSeries = function(rps, data){
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
        var _each = {'name':rp, data : [0,0,0,0,0,0,0,0,0,0,0,0]};
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
        $scope.highchartsNG.series.push(_each);
      });
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
        if (temp.hasClass('active')){
          if (temp.attr('data-value')!=value){
            filtered.push(temp.attr('data-value'));
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
        filtered.push(value);
      }  

      if ($.inArray('FCS', filtered)>=0){
        console.log('FCS-in');
        $scope.FCS = true;
      } else {
        console.log('FCS-out');
        $scope.FCS = false;
      }
      $scope.manage_featuredata($scope.FCS);
      $scope.refreshGEOJSON(); 
      $scope.addChartSeries($scope.selectedRP,$scope.popFloodedData);
      $scope.addTableSeries($scope.selectedRP,$scope.popFloodedData);
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

    $scope.manage_featuredata = function(selFCS){
      for (var x in $scope.popFloodedData.features){
        var pertama = true;
        if (selFCS)
          var FCS_value = $scope.popFloodedData.features[x].properties.FCS/100
        else 
          var FCS_value = 1;

        for (var key in $scope.selectedRP){
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
        //$scope.popFloodedData.features[x].properties.active.active_month=Math.floor($scope.popFloodedData.features[x].properties.active[$scope.selectedMonth]);
      }
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
      
      $scope.manage_featuredata($scope.FCS);     
      $scope.refreshGEOJSON();
    }

    $scope.month_choice_listener = function($event){
      var element = $($event.target);
      var query_entry = [];
      var data_filter = element.attr('data-filter');
      var value = element.attr('data-value');
      $scope.selectedMonth = value;

      $scope.manage_featuredata($scope.FCS);
      
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

      console.log(tempDownToUse);
      var allElement = angular.element(element).parent().parent();
      //console.log(allElement[0].children);


      angular.forEach(allElement[0].children, function(rows){
        var temp = $(rows.children);
        temp.removeClass('active');
        if ($.inArray(temp.attr('data-value'), tempDownToUse)>=0){
          console.log(temp.attr('data-value'));
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
      $scope.manage_featuredata($scope.FCS);

      $scope.refreshGEOJSON(); 
      $scope.addChartSeries($scope.selectedRP,$scope.popFloodedData);
      $scope.addTableSeries($scope.selectedRP,$scope.popFloodedData);
     // console.log($scope.selectedRP.length);
      
      //$scope.layers.overlays.probabilities.layerOptions.layers = 'flood:CMR,flood:CMR,flood:CMR,flood:CMR,flood:CMR,flood:CMR';  
      //$scope.layers.overlays.probabilities.layerOptions.styles = 'RP25,RP50,RP100,RP200,RP500,RP1000';
     // console.log($scope.layers.overlays);
     var layer = '';
     var style = '';
     var sep = '';
     for (var x=0;x<$scope.selectedRP.length;x++){
        if (layer!='') sep = ','; 
        layer += sep+'geonode:f_'+$scope.countryISO3.toLowerCase();
        style += sep+$scope.selectedRP[x];
     }

     leafletData.getMap().then(function(map) {
        leafletData.getLayers().then(function (layers) {
            layers.overlays.probabilities.setParams({'layers':layer,'styles':style},false);
        });
     });

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
          var div = L.DomUtil.get('legendCustom'),
              grades = $scope.legendRange,
              labels = [];
          // loop through our density intervals and generate a label with a colored square for each interval
          for (var i = 0; i < grades.length; i++) {
              div.innerHTML +=
                  '<li><a class=""><i style="background:' + getColor(grades[i] + 1) + '"></i>'+grades[i] + (grades[i + 1] ? '&ndash;' + grades[i + 1]  : '+')+'</a></li>';
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

    $scope.IsJsonString = function(str) {
        try {
            JSON.parse(str);
        } catch (e) {
            return false;
        }
        return true;
    }

  });
})();

