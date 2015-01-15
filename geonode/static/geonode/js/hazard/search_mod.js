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
    var date = new Date(),
        month = date.getMonth();
    var _shortMonthName = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    $scope.selectedRP = ['RP25'];
    $scope.countryName = $location.search()['country'];
    $scope.countryISO3 = $location.search()['iso'];
    $scope.selectedMonth = _shortMonthName[month];
    $scope.popFloodedData = null;
    $scope.selectedObject = null;
    $scope.geojson = {
      data: [],
      style: style,
      //onEachFeature: onEachFeature,
      resetStyleOnMouseout: true
    };

    $scope.rowCollection = [];

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
          probabilities : {
            name:'Flood Probabilities',
            type: 'wms',
            url:'http://10.11.40.84/geoserver/geonode/wms',
            visible : false,
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
            url: 'http://{s}.tiles.mapbox.com/v3/mapbox.mapbox-warden/{z}/{x}/{y}.png',
            layerOptions: {
                subdomains: ['a', 'b', 'c'],
                attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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
                         '#FFFFFF' ;
    }

    NProgress.start();
    $('#screen').css({  "display": "block", opacity: 0.25, "width":$(document).width(),"height":$(document).height(), "z-index":1000000});
    $http.get("../getFloodedGeoJSON/?iso3="+$location.search()['iso']).success(function(data, status) {
      $scope.popFloodedData = data;
      $scope.updateGEOJSON(data);
      $scope.addChartSeries(['RP25'],$scope.popFloodedData);
      $scope.addTableSeries(['RP25'],$scope.popFloodedData);
      NProgress.done(true);
      NProgress.remove();
      $('#screen').css({"display":"none"});
    });

    $http.get("https://maps.googleapis.com/maps/api/geocode/json?address="+$location.search()['country']).success(function(data, status) {
      leafletData.getMap().then(function (map) {
        var southWest = L.latLng(data.results[0].geometry.bounds.southwest.lat, data.results[0].geometry.bounds.southwest.lng);
        var northEast = L.latLng(data.results[0].geometry.bounds.northeast.lat, data.results[0].geometry.bounds.northeast.lng);
        var bounds = L.latLngBounds(southWest, northEast);           
        map.fitBounds(bounds);
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
      
      angular.forEach(rps, function(rp){
        var _each = {'name':rp, data : [0,0,0,0,0,0,0,0,0,0,0,0]};

        for (var monthNumber in _shortMonthName){
          _each.data[monthNumber] += data.properties[rp][_shortMonthName[monthNumber]];
        }

        $scope.privateHighchartsNG.series.push(_each);
      });
      
    }

    $scope.addChartSeries = function(rps, data){
      var _shortMonthName = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

      for (var x=$scope.highchartsNG.series.length;x>0;x--){
        $scope.highchartsNG.series.pop();
      }

      angular.forEach(rps, function(rp){
        var _each = {'name':rp, data : [0,0,0,0,0,0,0,0,0,0,0,0]};
        angular.forEach(data.features, function(row){
          for (var monthNumber in _shortMonthName){
            _each.data[monthNumber] += row.properties[rp][_shortMonthName[monthNumber]];
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
        angular.forEach(rps, function(rp){
          _each.jan += row.properties[rp].jan;
          _each.feb += row.properties[rp].feb;
          _each.mar += row.properties[rp].mar;
          _each.apr += row.properties[rp].apr;
          _each.may += row.properties[rp].may;
          _each.jun += row.properties[rp].jun;
          _each.jul += row.properties[rp].jul;
          _each.aug += row.properties[rp].aug;
          _each.sep += row.properties[rp].sep;
          _each.oct += row.properties[rp].oct;
          _each.nov += row.properties[rp].nov;
          _each.dec += row.properties[rp].dec;
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

    $scope.month_choice_listener = function($event){
      var element = $($event.target);
      var query_entry = [];
      var data_filter = element.attr('data-filter');
      var value = element.attr('data-value');
      $scope.selectedMonth = value;

      for (var x in $scope.popFloodedData.features){
        var pertama = true;
        for (var key in $scope.selectedRP){
          if (pertama){
            $scope.popFloodedData.features[x].properties.active.jan=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].jan;
            $scope.popFloodedData.features[x].properties.active.feb=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].feb;
            $scope.popFloodedData.features[x].properties.active.mar=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].mar;
            $scope.popFloodedData.features[x].properties.active.apr=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].apr;
            $scope.popFloodedData.features[x].properties.active.may=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].may;
            $scope.popFloodedData.features[x].properties.active.jun=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].jun;
            $scope.popFloodedData.features[x].properties.active.jul=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].jul;
            $scope.popFloodedData.features[x].properties.active.aug=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].aug;
            $scope.popFloodedData.features[x].properties.active.sep=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].sep;
            $scope.popFloodedData.features[x].properties.active.oct=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].oct;
            $scope.popFloodedData.features[x].properties.active.nov=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].nov;
            $scope.popFloodedData.features[x].properties.active.dec=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].dec;
            pertama = false;
          } else {
            $scope.popFloodedData.features[x].properties.active.jan+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].jan;
            $scope.popFloodedData.features[x].properties.active.feb+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].feb;
            $scope.popFloodedData.features[x].properties.active.mar+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].mar;
            $scope.popFloodedData.features[x].properties.active.apr+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].apr;
            $scope.popFloodedData.features[x].properties.active.may+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].may;
            $scope.popFloodedData.features[x].properties.active.jun+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].jun;
            $scope.popFloodedData.features[x].properties.active.jul+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].jul;
            $scope.popFloodedData.features[x].properties.active.aug+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].aug;
            $scope.popFloodedData.features[x].properties.active.sep+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].sep;
            $scope.popFloodedData.features[x].properties.active.oct+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].oct;
            $scope.popFloodedData.features[x].properties.active.nov+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].nov;
            $scope.popFloodedData.features[x].properties.active.dec+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].dec;
          }
        }   
        $scope.popFloodedData.features[x].properties.active.active_month=$scope.popFloodedData.features[x].properties.active[value];
      }
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
      $scope.selectedRP = [];
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
            $scope.selectedRP.push(temp.attr('data-value'));
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
        $scope.selectedRP.push(value);
      }  

      for (var x in $scope.popFloodedData.features){
        var pertama = true;
        for (var key in $scope.selectedRP){
          if (pertama){
            $scope.popFloodedData.features[x].properties.active.jan=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].jan;
            $scope.popFloodedData.features[x].properties.active.feb=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].feb;
            $scope.popFloodedData.features[x].properties.active.mar=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].mar;
            $scope.popFloodedData.features[x].properties.active.apr=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].apr;
            $scope.popFloodedData.features[x].properties.active.may=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].may;
            $scope.popFloodedData.features[x].properties.active.jun=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].jun;
            $scope.popFloodedData.features[x].properties.active.jul=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].jul;
            $scope.popFloodedData.features[x].properties.active.aug=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].aug;
            $scope.popFloodedData.features[x].properties.active.sep=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].sep;
            $scope.popFloodedData.features[x].properties.active.oct=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].oct;
            $scope.popFloodedData.features[x].properties.active.nov=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].nov;
            $scope.popFloodedData.features[x].properties.active.dec=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].dec;
            pertama = false;
          } else {
            $scope.popFloodedData.features[x].properties.active.jan+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].jan;
            $scope.popFloodedData.features[x].properties.active.feb+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].feb;
            $scope.popFloodedData.features[x].properties.active.mar+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].mar;
            $scope.popFloodedData.features[x].properties.active.apr+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].apr;
            $scope.popFloodedData.features[x].properties.active.may+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].may;
            $scope.popFloodedData.features[x].properties.active.jun+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].jun;
            $scope.popFloodedData.features[x].properties.active.jul+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].jul;
            $scope.popFloodedData.features[x].properties.active.aug+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].aug;
            $scope.popFloodedData.features[x].properties.active.sep+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].sep;
            $scope.popFloodedData.features[x].properties.active.oct+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].oct;
            $scope.popFloodedData.features[x].properties.active.nov+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].nov;
            $scope.popFloodedData.features[x].properties.active.dec+=$scope.popFloodedData.features[x].properties[$scope.selectedRP[key]].dec;
          }
        }   
        $scope.popFloodedData.features[x].properties.active.active_month=$scope.popFloodedData.features[x].properties.active[$scope.selectedMonth];
      }

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
            console.log(layers.overlays.probabilities);
            layers.overlays.probabilities.setParams({'layers':layer,'styles':style},false);
        });
     });

    }

    $scope.$on("leafletDirectiveMap.geojsonMouseover", function(ev, feature, leafletEvent) {
      //$scope.floodMouseOver(feature);
    });

    $scope.$on("leafletDirectiveMap.geojsonClick", function(ev, featureSelected, leafletEvent) {
      $scope.floodMouseOver(leafletEvent);
      $('#info').show();
    });

    $scope.floodMouseOver = function(feature) {
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

    
    leafletData.getMap().then(function (map) {
      //console.log(L);
        var div = L.DomUtil.get('legendCustom'),
            grades = [0, 2, 5, 7, 10, 25, 50, 75,100,250,500,750,1000,2500,5000,7500,10000],
            labels = [];
        // loop through our density intervals and generate a label with a colored square for each interval
        for (var i = 0; i < grades.length; i++) {
            div.innerHTML +=
                '<li><a class=""><i style="background:' + getColor(grades[i] + 1) + '"></i>'+grades[i] + (grades[i + 1] ? '&ndash;' + grades[i + 1]  : '+')+'</a></li>';
        }
    });

  });
})();

