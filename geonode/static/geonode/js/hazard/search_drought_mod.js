'use strict';

(function(){


  function n(n){
      return n > 9 ? "" + n: "0" + n;
  }

  var module = angular.module('hazard_main_search', [], function($locationProvider) {
      $locationProvider.html5Mode({
        enabled: true,
        requireBase: false
      });

      // make sure that angular doesn't intercept the page links
      angular.element("a").prop("target", "_self");
  });

  module.controller('hazard_map_Controller', function($injector, $scope, $location, $http, leafletData){
    $('#droughtQL').removeClass('hide');
    var date = new Date(),
        month = date.getMonth();
    var _shortMonthName = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    $scope.maxPopAllProbs = 0;
    $scope.selectedProbClass = ['1-10'];
    $scope.selectedCategory = 'wldds9freq';
    $scope.selectedStyle = ['drought10']
    $scope.countryName = $location.search()['country'];
    $scope.countryISO3 = $location.search()['iso'];
    $scope.selectedMonth = _shortMonthName[month];
    $scope.selectedMonthStrNumber = n(month+1);
    $scope.popFloodedData = null;
    $scope.selectedObject = null;
    $scope.FCS = false;
    $scope.Country = [];
    $scope.emdatData = [];
    $scope.FlagFCS = ['c_poor','c_borderline'];
    $scope.FlagCSI = ['c_low'];
    $scope.geojson = {
      data: [],
      style: style,
      //onEachFeature: onEachFeature,
      resetStyleOnMouseout: true
    };
    $scope.legendRangePercentage = [0.25,0.50,0.75];
    $scope.legendRange = [0,1000];

    var popup = new L.Popup({offset:new L.Point(0,-3)});

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
            name:'Drought Probabilities',
            type: 'wms',
            url:'http://10.11.40.84/geoserver/geonode/wms',
            visible : true,
            layerOptions: {
              layers: 'geonode:'+$scope.selectedCategory+$scope.selectedMonthStrNumber+'dd',
              format: 'image/png',
              styles : 'drought10',
              opacity:0.8,
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
    });

    function onEachFeature(feature, layer) {
        
    }

    function style(feature) {
        return {
            fillColor: getColor(feature.properties['active_month']),
            weight: 1,
            opacity: 1,
            color: 'white',
            dashArray: '1',
            fillOpacity: 0.4
        };
    }

    function getColor(x) {
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
    $http.get("../../getDroughtGeoJSON/?iso3="+$location.search()['iso']).success(function(data, status) {
      var _shortMonthNameDef = ['mjan','mfeb','mmar','mapr','mmay','mjun','mjul','maug','msep','moct','mnov','mde'];
      var last_adm1_code = 0;
      $scope.popFloodedData = data;

      $http.get("../../getEmdatData/?type=drought&iso3="+$location.search()['iso']).success(function(dataEmdat,status){
        $scope.emdatData = dataEmdat.data;
      });

      angular.forEach(data.features, function(rowC){
        //console.log(rowC);
        angular.forEach(rowC.properties.addinfo, function(rowProb){
          //console.log(rowProb);
          var tempValue = 0;
          angular.forEach(_shortMonthNameDef, function(monthName){        
            tempValue += rowProb[monthName]
            if (tempValue > $scope.maxPopAllProbs) $scope.maxPopAllProbs = tempValue;
          });
        });
      });
      //console.log($scope.maxPopAllProbs);

      var threshold = 100000;
      if ($scope.maxPopAllProbs.toString().length == 6){
        threshold = 100000;
      } else if ($scope.maxPopAllProbs.toString().length == 5){
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

      /// add FCS
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

      $scope.updateGEOJSON($scope.popFloodedData);
      $scope.addChartSeries($scope.selectedProbClass,$scope.popFloodedData);
      $scope.addTableSeries($scope.selectedProbClass,$scope.popFloodedData,$scope.selectedCategory);
      NProgress.done(true);
      NProgress.remove();
      $('#screen').css({"display":"none"});
    });

    $http.get("../../getCountry/").success(function(data, status) {
      angular.forEach(data, function(row){
        if ($scope.IsJsonString(row[0]))
          $scope.Country.push(JSON.parse(row[0]))
        else
          $scope.Country.push(row[0]);  
      });
      ///console.log($scope.Country);
    });

    $http.get("https://maps.googleapis.com/maps/api/geocode/json?address="+$location.search()['country']).success(function(data, status) {
      leafletData.getMap().then(function (map) {
        var southWest = L.latLng(data.results[0].geometry.bounds.southwest.lat, data.results[0].geometry.bounds.southwest.lng);
        var northEast = L.latLng(data.results[0].geometry.bounds.northeast.lat, data.results[0].geometry.bounds.northeast.lng);
        var bounds = L.latLngBounds(southWest, northEast);           
        map.fitBounds(bounds);
      });  
    });

    $scope.updateGEOJSON = function(data){
      //console.log(data);
      leafletData.getMap().then(function (map) {  
        
        leafletData.getGeoJSON().then(function(geoJSON) { 
          angular.forEach(geoJSON._layers, function(rows){
            map.removeLayer(rows);
          });
          angular.forEach(data.features, function(rows){
            geoJSON.addData(rows);
          });
          geoJSON.addTo(map);
          //geoJSON.resetStyle();
          //console.log(geoJSON);
        });

      });
            
    }

    $scope.addPrivateChartSeries = function(rps, data, cat){
      //console.log(data);
      var _shortMonthName = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

      for (var x=$scope.privateHighchartsNG.series.length;x>0;x--){
        $scope.privateHighchartsNG.series.pop();
      }
      
      angular.forEach(rps, function(rp){
        var _each = {'name':rp, data : [0,0,0,0,0,0,0,0,0,0,0,0]};
        if ($scope.FCS)
          var FCS_value = data.properties.FCS/100
        else 
          var FCS_value = 1;
        angular.forEach(data.properties.addinfo, function(item){
          if ($.inArray(item.category, $scope.getProbArrayShortRange(rp)) > -1){
            for (var monthNumber in _shortMonthName){
             _each.data[monthNumber] += item['m'+_shortMonthName[monthNumber]]*FCS_value;
            }
          }  
        });
        $scope.privateHighchartsNG.series.push(_each);
      });
      
    }

    $scope.getProbArrayShortRange = function(rp){
      var probRangeArray = [];
      
        var temp = rp.split("-");
        for (var i=temp[0];i<=temp[1];i++){
          probRangeArray.push(parseInt(i));
        }

      return probRangeArray;
    }

    $scope.addChartSeries = function(rps, data){
      var _shortMonthName = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
      for (var x=$scope.highchartsNG.series.length;x>0;x--){
        $scope.highchartsNG.series.pop();
      }

      angular.forEach(rps, function(rp){
        //console.log($scope.getProbArrayShortRange(rp));
        var _each = {'name':rp, data : [0,0,0,0,0,0,0,0,0,0,0,0]};
        angular.forEach(data.features, function(row){
          if ($scope.FCS)
            var FCS_value = $scope.popFloodedData.features[x].properties.FCS/100
          else 
            var FCS_value = 1;
          angular.forEach(row.properties.addinfo, function(single){
            //console.log(single);
            for (var monthNumber in _shortMonthName){
              //console.log(single);
              if ($.inArray(single.category, $scope.getProbArrayShortRange(rp)) > -1){
                _each.data[monthNumber] += single['m'+_shortMonthName[monthNumber]]*FCS_value;
              }  
            }
          });  
        });
        $scope.highchartsNG.series.push(_each);
      });

    }

    $scope.addTableSeries = function(rps, data, cat){
      //console.log($scope.rowCollection);
      //console.log(data);
      for (var x=$scope.rowCollection.length;x>0;x--){
        $scope.rowCollection.pop();
      }

      angular.forEach(data.features, function(row){
        var _each = {adm2_code:'',region:'',jan :0,feb:0,mar:0,apr:0,may:0,jun:0,jul:0,aug:0,sep:0,oct:0,nov:0,dec:0};
        _each.region = row.properties.adm2_name;
        if ($scope.FCS)
          var FCS_value = $scope.popFloodedData.features[x].properties.FCS/100
        else 
          var FCS_value = 1;
        angular.forEach(row.properties.addinfo, function(item){
          if ($.inArray(item.prob_class, rps) > -1 && item.category == cat){
            _each.jan += item.jan*FCS_value;
            _each.feb += item.feb*FCS_value;
            _each.mar += item.mar*FCS_value;
            _each.apr += item.apr*FCS_value;
            _each.may += item.may*FCS_value;
            _each.jun += item.jun*FCS_value;
            _each.jul += item.jul*FCS_value;
            _each.aug += item.aug*FCS_value;
            _each.sep += item.sep*FCS_value;
            _each.oct += item.oct*FCS_value;
            _each.nov += item.nov*FCS_value;
            _each.dec += item.dec*FCS_value;           
          }
        });
        $scope.rowCollection.push(_each);
      });
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

      if ($.inArray('raster', selectedLayerOverlay)>=0){
        $scope.layers.overlays.probabilities.visible = true;
      } else {
        $scope.layers.overlays.probabilities.visible = false;  
      }

      if ($.inArray('landscan', selectedLayerOverlay)>=0){
        console.log($scope.layers.overlays);
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

      $scope.manage_featuredata();
      $scope.refreshGEOJSON(); 
      $scope.addChartSeries($scope.selectedProbClass,$scope.popFloodedData);
      $scope.addTableSeries($scope.selectedProbClass,$scope.popFloodedData,$scope.selectedCategory);
      $scope.generateLegend();
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

      $scope.manage_featuredata();
      
      $scope.refreshGEOJSON();
      $scope.refreshCycloneWMS();
      //console.log(element.parents('div').find('a'));
      if(!element.hasClass('active')){
        // Add the entry in the correct query
        query_entry = value;
        // clear the active class from it
        element.parents('div.leaflet-bar-hor').find('a').removeClass('active');
        element.addClass('active');
      }     
    }

    $scope.refreshGEOJSON = function(){
      leafletData.getMap().then(function (map) {      
        leafletData.getGeoJSON().then(function(geoJSON) { 
          angular.forEach(geoJSON._layers, function(rows){
            geoJSON.resetStyle(rows);
          });
        });

      });
    }

    $scope.cat_choice_listener = function($event){
      var element = $($event.target);
      var query_entry = [];
      var data_filter = element.attr('data-filter');
      var value = element.attr('data-value');
      $scope.selectedCategory = value;
      
      $scope.manage_featuredata();
      

      var allElement = angular.element(element).parent().parent();
      if(!element.hasClass('active')){
        // Add the entry in the correct query
        query_entry = value;
        // clear the active class from it
        element.parents('ul').find('a').removeClass('active');
        element.addClass('active');
      } 

      $scope.refreshGEOJSON();
      $scope.addChartSeries($scope.selectedProbClass,$scope.popFloodedData); 
      $scope.addTableSeries($scope.selectedProbClass,$scope.popFloodedData,$scope.selectedCategory);
      $scope.refreshCycloneWMS();
    }

    $scope.RP_choice_listener = function($event){
      $scope.selectedProbClass = [];
      $scope.selectedStyle = [];
      var element = $($event.target);
      var query_entry = [];
      var data_filter = element.attr('data-filter');
      var value = element.attr('data-value');
      //console.log(data_filter);
      //console.log(element);
      var allElement = angular.element(element).parent().parent();
      //console.log(allElement[0].children);

      angular.forEach(allElement[0].children, function(rows){
        var temp = $(rows.children);
        if (temp.hasClass('active')){
          if (temp.attr('data-value')!=value){
            $scope.selectedProbClass.push(temp.attr('data-value'));
          }  
          if (temp.attr('data-filter')!=data_filter){
            $scope.selectedStyle.push(temp.attr('data-filter'));
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
        $scope.selectedProbClass.push(value);
        $scope.selectedStyle.push(data_filter);
      }  

      //console.log($scope.selectedProbClass);
      //console.log($scope.selectedStyle);

      $scope.manage_featuredata();
      
      $scope.refreshGEOJSON(); 
      $scope.addChartSeries($scope.selectedProbClass,$scope.popFloodedData);
      $scope.addTableSeries($scope.selectedProbClass,$scope.popFloodedData,$scope.selectedCategory);
      $scope.refreshCycloneWMS();
    }

    $scope.getProbArray = function(){
      var probRangeArray = [];
      for (var x in $scope.selectedProbClass){
        var temp = $scope.selectedProbClass[x].split("-");
        for (var i=temp[0];i<=temp[1];i++){
          probRangeArray.push(parseInt(i));
        }
      }
      return probRangeArray;
    }

    $scope.manage_featuredata = function(){

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

        $scope.popFloodedData.features[x].properties.active_month = 0;
        //console.log($scope.popFloodedData.features[x].properties.FCS);
        /*if ($scope.FCS)
          var FCS_value = $scope.popFloodedData.features[x].properties.FCS/100
        else 
          var FCS_value = 1;*/
        for (var y in $scope.popFloodedData.features[x].properties.addinfo){
          //console.log($scope.popFloodedData.features[x].properties.addinfo[y].category);
          //console.log($scope.getProbArray());
          if ($.inArray($scope.popFloodedData.features[x].properties.addinfo[y].category, $scope.getProbArray()) > -1){
            $scope.popFloodedData.features[x].properties.active_month += $scope.popFloodedData.features[x].properties.addinfo[y]['m'+$scope.selectedMonth]*FCS_value;
          }
        }  
      }
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
      //console.log(layer);
      layer.bringToFront();
      var bounds = layer.getBounds();
      var popupContent = "<h6>"+layer.feature.properties.adm2_name+"</h6>Pop at risk : "+layer.feature.properties.active_month;
      popup.setLatLng(bounds.getCenter());
      popup.setContent(popupContent);
      leafletData.getMap().then(function(map) {
        map.openPopup(popup);
      });
    }

    $scope.floodMouseClick = function(feature) {
      var layer = feature.target;
      layer.setStyle({
          weight: 2,
          color: '#666',
          fillColor: 'red'
      });
      layer.bringToFront();
      $scope.selectedObject = layer.feature;
      $scope.addPrivateChartSeries($scope.selectedProbClass, $scope.selectedObject, $scope.selectedCategory);
    }

    $scope.getMonthStrNumber = function(){
      var month = '';
        if($scope.selectedMonth=='jan')
          month = '01'
        else if($scope.selectedMonth=='feb')
          month = '02'
        else if($scope.selectedMonth=='mar')
          month = '03'
        else if($scope.selectedMonth=='apr')
          month = '04'
        else if($scope.selectedMonth=='may')
          month = '05'
        else if($scope.selectedMonth=='jun')
          month = '06'
        else if($scope.selectedMonth=='jul')
          month = '07'
        else if($scope.selectedMonth=='aug')
          month = '08'
        else if($scope.selectedMonth=='sep')
          month = '09'
        else if($scope.selectedMonth=='oct')
          month = '10'
        else if($scope.selectedMonth=='nov')
          month = '11'
        else if($scope.selectedMonth=='dec')
          month = '12';

      return month;     
    }

    $scope.refreshCycloneWMS = function(){
       var layer = '';
       var style = '';
       var sep = '';
       
       for (var x=0;x<$scope.selectedStyle.length;x++){
          if (layer!='') sep = ','; 
          layer += sep+'geonode:'+$scope.selectedCategory+$scope.getMonthStrNumber()+'dd';
          style += sep+$scope.selectedStyle[x];
       }

       leafletData.getMap().then(function(map) {
          leafletData.getLayers().then(function (layers) {
              layers.overlays.probabilities.setParams({'layers':layer,'styles':style},false);
          });
       });
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
      $scope.addChartSeries($scope.selectedProbClass,$scope.popFloodedData);
      $scope.addTableSeries($scope.selectedProbClass,$scope.popFloodedData,$scope.selectedCategory);
    }


  });
})();

