(function ( angular ) {
    'use strict';
    
    angular.module( 'treeControl', [] )
        .directive( 'treecontrol', ['$compile', function( $compile ) {
            /**
             * @param cssClass - the css class
             * @param addClassProperty - should we wrap the class name with class=""
             */
            function classIfDefined(cssClass, addClassProperty) {
                if (cssClass) {
                    if (addClassProperty)
                        return 'class="' + cssClass + '"';
                    else
                        return cssClass;
                }
                else
                    return "";
            }
            
            function ensureDefault(obj, prop, value) {
                if (!obj.hasOwnProperty(prop))
                    obj[prop] = value;
            }
            
            return {
                restrict: 'EA',
                require: "treecontrol",
                transclude: true,
                scope: {
                    treeModel: "=",
                    selectedNode: "=?",
                    selectedNodes: "=?",
                    expandedNodes: "=?",
                    onSelection: "&",
                    onNodeToggle: "&",
                    options: "=?",
                    orderBy: "@",
                    reverseOrder: "@",
                    filterExpression: "=?",
                    filterComparator: "=?"
                },
                controller: ['$scope', function( $scope ) {

                    function defaultIsLeaf(node) {
                        return !node[$scope.options.nodeChildren] || node[$scope.options.nodeChildren].length === 0;
                    }

                    function shallowCopy(src, dst) {
                        if (angular.isArray(src)) {
                            dst = dst || [];

                            for ( var i = 0; i < src.length; i++) {
                                dst[i] = src[i];
                            }
                        } else if (angular.isObject(src)) {
                            dst = dst || {};

                            for (var key in src) {
                                if (hasOwnProperty.call(src, key) && !(key.charAt(0) === '$' && key.charAt(1) === '$')) {
                                    dst[key] = src[key];
                                }
                            }
                        }

                        return dst || src;
                    }
                    function defaultEquality(a, b) {
                        if (a === undefined || b === undefined)
                            return false;
                        a = shallowCopy(a);
                        a[$scope.options.nodeChildren] = [];
                        b = shallowCopy(b);
                        b[$scope.options.nodeChildren] = [];
                        return angular.equals(a, b);
                    }

                    $scope.options = $scope.options || {};
                    ensureDefault($scope.options, "multiSelection", false);
                    ensureDefault($scope.options, "nodeChildren", "children");
                    ensureDefault($scope.options, "dirSelectable", "true");
                    ensureDefault($scope.options, "injectClasses", {});
                    ensureDefault($scope.options.injectClasses, "ul", "");
                    ensureDefault($scope.options.injectClasses, "li", "");
                    ensureDefault($scope.options.injectClasses, "liSelected", "");
                    ensureDefault($scope.options.injectClasses, "iExpanded", "");
                    ensureDefault($scope.options.injectClasses, "iCollapsed", "");
                    ensureDefault($scope.options.injectClasses, "iLeaf", "");
                    ensureDefault($scope.options.injectClasses, "label", "");
                    ensureDefault($scope.options.injectClasses, "labelSelected", "");
                    ensureDefault($scope.options, "equality", defaultEquality);
                    ensureDefault($scope.options, "isLeaf", defaultIsLeaf);

                    $scope.selectedNodes = $scope.selectedNodes || [];
                    $scope.expandedNodes = $scope.expandedNodes || [];
                    $scope.expandedNodesMap = {};
                    for (var i=0; i < $scope.expandedNodes.length; i++) {
                        $scope.expandedNodesMap[""+i] = $scope.expandedNodes[i];
                    }
                    $scope.parentScopeOfTree = $scope.$parent;

                    $scope.isSelectedHasNoChild = function(node){
                        if (node.children.length == 0 && isSelectedNode(node))
                            return true
                        else 
                            return false;
                    }

                    function isSelectedNode(node) {
                        if (!$scope.options.multiSelection && ($scope.options.equality(node, $scope.selectedNode)))
                            return true;
                        else if ($scope.options.multiSelection && $scope.selectedNodes) {
                            for (var i = 0; (i < $scope.selectedNodes.length); i++) {
                                if ($scope.options.equality(node, $scope.selectedNodes[i])) {
                                    return true;
                                }
                            }
                            return false;
                        }
                    }

                    $scope.headClass = function(node) {
                        var liSelectionClass = classIfDefined($scope.options.injectClasses.liSelected, false);
                        var injectSelectionClass = "";
                        if (liSelectionClass && isSelectedNode(node))
                            injectSelectionClass = " " + liSelectionClass;
                        if ($scope.options.isLeaf(node))
                            return "tree-leaf" + injectSelectionClass;
                        if ($scope.expandedNodesMap[this.$id])
                            return "tree-expanded" + injectSelectionClass;
                        else
                            return "tree-collapsed" + injectSelectionClass;
                    };

                    $scope.iBranchClass = function() {
                        if ($scope.expandedNodesMap[this.$id])
                            return classIfDefined($scope.options.injectClasses.iExpanded);
                        else
                            return classIfDefined($scope.options.injectClasses.iCollapsed);
                    };

                    $scope.nodeExpanded = function() {
                        return !!$scope.expandedNodesMap[this.$id];
                    };

                    $scope.selectNodeHead = function() {
                        var expanding = $scope.expandedNodesMap[this.$id] === undefined;
                        $scope.expandedNodesMap[this.$id] = (expanding ? this.node : undefined);
                        if (expanding) {
                            $scope.expandedNodes.push(this.node);
                        }
                        else {
                            var index;
                            for (var i=0; (i < $scope.expandedNodes.length) && !index; i++) {
                                if ($scope.options.equality($scope.expandedNodes[i], this.node)) {
                                    index = i;
                                }
                            }
                            if (index != undefined)
                                $scope.expandedNodes.splice(index, 1);
                        }
                        if ($scope.onNodeToggle)
                            $scope.onNodeToggle({node: this.node, expanded: expanding});
                    };

                    $scope.selectNodeLabel = function( selectedNode ){
                        if (selectedNode[$scope.options.nodeChildren] && selectedNode[$scope.options.nodeChildren].length > 0 &&
                            !$scope.options.dirSelectable) {
                            this.selectNodeHead();
                        }
                        else {
                            var selected = false;
                            if ($scope.options.multiSelection) {
                                var pos = -1;
                                for (var i=0; i < $scope.selectedNodes.length; i++) {
                                    if($scope.options.equality(selectedNode, $scope.selectedNodes[i])) {
                                        pos = i;
                                        break;
                                    }
                                }
                                if (pos === -1) {
                                    $scope.selectedNodes.push(selectedNode);
                                    selected = true;
                                } else {
                                    $scope.selectedNodes.splice(pos, 1);
                                }
                            } else {
                                if (!$scope.options.equality(selectedNode, $scope.selectedNode)) {
                                    $scope.selectedNode = selectedNode;
                                    selected = true;
                                }
                                else {
                                    $scope.selectedNode = undefined;
                                }
                            }
                            if ($scope.onSelection)
                                $scope.onSelection({node: selectedNode, selected: selected});
                        }
                    };

                    $scope.selectedClass = function() {
                        var isThisNodeSelected = isSelectedNode(this.node);
                        var labelSelectionClass = classIfDefined($scope.options.injectClasses.labelSelected, false);
                        var injectSelectionClass = "";
                        if (labelSelectionClass && isThisNodeSelected)
                            injectSelectionClass = " " + labelSelectionClass;

                        return isThisNodeSelected?"tree-selected" + injectSelectionClass:"";
                    };

                    //tree template
                    var orderBy = $scope.orderBy ? ' | orderBy:orderBy:reverseOrder' : '';

                    $scope.parent = $scope.$parent.$parent.$parent;
                    
                    var template =
                        '<ul '+classIfDefined($scope.options.injectClasses.ul, true)+'>' +
                            '<li ng-repeat="node in node.' + $scope.options.nodeChildren + ' | filter:filterExpression:filterComparator ' + orderBy + '" ng-class="headClass(node)" '+classIfDefined($scope.options.injectClasses.li, true)+'>' +
                            '<i class="tree-branch-head" ng-class="iBranchClass()" ng-click="selectNodeHead(node)"></i>' +
                            '<i class="tree-leaf-head '+classIfDefined($scope.options.injectClasses.iLeaf, false)+'"></i>' +
                            '<div class="tree-label '+classIfDefined($scope.options.injectClasses.label, false)+'" ng-class="selectedClass()" ng-click="selectNodeLabel(node)" tree-transclude></div>' +
                            '<ul id="external" class="vamControl" ng-if="isSelectedHasNoChild(node)">'+
                                '<li ng-if="node.legend != \'\'"><img ng-src="{{node.legend}}"></li>'+
                                '<li ng-if="node.exp == \'popatrisk\'">'+
                                    'Filter by <a class="linkButton" data-value="FCS" data-filter="" ng-class="parent.getVulnerabilityClass(\'FCS\')" ng-click="parent.external_choice_listener($event)">FCS</a>'+
                                    '<a class="linkButton" data-value="CSI" data-filter="" ng-class="parent.getVulnerabilityClass(\'CSI\')" ng-click="parent.external_choice_listener($event)">CSI</a>'+
                                '</li>'+
                                '<li id="extFCS" ng-class="parent.getExternalClass(\'CSI\')" ng-if="node.exp == \'popatrisk\'">'+
                                    '<input type="checkbox" id="c_no" ng-model="parent.fcsFilter.c_no" ng-change="parent.FCSChange(\'c_no\',\'CSI\')" class="checkbox"/>'+
                                    '<label for="c_no">No</label>'+
                                    '<input type="checkbox" id="c_low" ng-model="parent.fcsFilter.c_low" ng-change="parent.FCSChange(\'c_low\',\'CSI\')" class="checkbox" checked/>'+
                                    '<label for="c_low">Low</label>'+
                                    '<input type="checkbox" id="c_med" ng-model="parent.fcsFilter.c_med" ng-change="parent.FCSChange(\'c_med\')" class="checkbox"/>'+
                                    '<label for="c_med">Med</label>'+
                                    '<input type="checkbox" id="c_high" ng-model="parent.fcsFilter.c_high" ng-change="parent.FCSChange(\'c_high\',\'CSI\')" class="checkbox"/>'+
                                    '<label for="c_high">High</label>'+
                                '</li>'+
                                '<li id="extCSI" ng-class="parent.getExternalClass(\'FCS\')" ng-if="node.exp == \'popatrisk\'">'+
                                    '<input type="checkbox" ng-change="parent.FCSChange(\'c_poor\',\'FCS\')" id="c_poor" ng-model="parent.fcsFilter.c_poor" class="checkbox" checked />'+
                                    '<label for="c_poor">Poor</label>'+
                                    '<input type="checkbox" ng-change="parent.FCSChange(\'c_borderline\',\'FCS\')" id="c_borderline" ng-model="parent.fcsFilter.c_borderline" class="checkbox" checked/>'+
                                    '<label for="c_borderline">borderline</label>'+
                                    '<input type="checkbox" ng-change="parent.FCSChange(\'c_accepptable\',\'FCS\')" id="c_accepptable" ng-model="parent.fcsFilter.c_accepptable" class="checkbox"/>'+
                                    '<label for="c_accepptable">Acceptable</label>'+
                                '</li>'+
                            '</ul>' +
                            '<ul class="legend" id="legendCustom" ng-if="node.exp == \'popatrisk\' && isSelectedHasNoChild(node)">'+
                            '</ul>'+
                            '<span ng-if="node.exp == \'popatrisk\'  && isSelectedHasNoChild(node)" style="font-size:10px">    Affected = living in flood prone area</span>'+
                            
                            '<ul class="vamControl" id="rps" ng-if="isSelectedHasNoChild(node) && node.exp == \'floodprob\'">'+
                                '<li class="RP25"><a title="A return period is an estimate of the likelihood of an event, such as a flood, to occur. The theoretical return period is the inverse of the probability that the event will be exceeded in any one year (or more accurately the inverse of the expected number of occurrences in a year). In this case, a 25 year flood has a 0.04 or 4% chance of being exceeded in any one year." data-tooltip-position="right" data-value="RP25" data-filter="" ng-click="parent.RP_choice_listener($event)" ng-class="parent.getRPClass(\'RP25\')">4%</a><li>'+
                                '<li class="RP50"><a title="A return period is an estimate of the likelihood of an event, such as a flood, to occur. The theoretical return period is the inverse of the probability that the event will be exceeded in any one year (or more accurately the inverse of the expected number of occurrences in a year). In this case, a 50 year flood has a 0.02 or 2% chance of being exceeded in any one year." data-value="RP50" data-filter="" ng-click="parent.RP_choice_listener($event)" ng-class="parent.getRPClass(\'RP50\')">2%</a><li>'+
                                '<li class="RP100"><a title="A return period is an estimate of the likelihood of an event, such as a flood, to occur. The theoretical return period is the inverse of the probability that the event will be exceeded in any one year (or more accurately the inverse of the expected number of occurrences in a year). In this case, a 100 year flood has a 0.01 or 1% chance of being exceeded in any one year." data-value="RP100" data-filter="" ng-click="parent.RP_choice_listener($event)" ng-class="parent.getRPClass(\'RP100\')">1%</a><li>'+
                                '<li class="RP200"><a title="A return period is an estimate of the likelihood of an event, such as a flood, to occur. The theoretical return period is the inverse of the probability that the event will be exceeded in any one year (or more accurately the inverse of the expected number of occurrences in a year). In this case, a 200 year flood has a 0.005 or 0.5% chance of being exceeded in any one year." data-value="RP200" data-filter="" ng-click="parent.RP_choice_listener($event)" ng-class="parent.getRPClass(\'RP200\')">0.5%</a><li>'+
                                '<li class="RP500"><a title="A return period is an estimate of the likelihood of an event, such as a flood, to occur. The theoretical return period is the inverse of the probability that the event will be exceeded in any one year (or more accurately the inverse of the expected number of occurrences in a year). In this case, a 500 year flood has a 0.002 or 0.2% chance of being exceeded in any one year." data-value="RP500" data-filter="" ng-click="parent.RP_choice_listener($event)" ng-class="parent.getRPClass(\'RP500\')">0.2%</a><li>'+
                                '<li class="RP1000"><a title="A return period is an estimate of the likelihood of an event, such as a flood, to occur. The theoretical return period is the inverse of the probability that the event will be exceeded in any one year (or more accurately the inverse of the expected number of occurrences in a year). In this case, a 1000 year flood has a 0.001 or 0.1% chance of being exceeded in any one year." data-value="RP1000" data-filter="" ng-click="parent.RP_choice_listener($event)" ng-class="parent.getRPClass(\'RP1000\')">0.1%</a><li>'+
                            '</ul>'+

                            '<treeitem ng-if="nodeExpanded()"></treeitem>' +
                            
                            '</li>' +
                            '</ul>';

                    this.template = $compile(template);
                }],
                compile: function(element, attrs, childTranscludeFn) {
                    return function ( scope, element, attrs, treemodelCntr ) {

                        scope.$watch("treeModel", function updateNodeOnRootScope(newValue) {
                            if (angular.isArray(newValue)) {
                                if (angular.isDefined(scope.node) && angular.equals(scope.node[scope.options.nodeChildren], newValue))
                                    return;
                                scope.node = {};
                                scope.synteticRoot = scope.node;
                                scope.node[scope.options.nodeChildren] = newValue;
                            }
                            else {
                                if (angular.equals(scope.node, newValue))
                                    return;
                                scope.node = newValue;
                            }
                        });

                        scope.$watchCollection('expandedNodes', function(newValue) {
                            var notFoundIds = 0;
                            var newExpandedNodesMap = {};
                            var $liElements = element.find('li');
                            var existingScopes = [];
                            // find all nodes visible on the tree and the scope $id of the scopes including them
                            angular.forEach($liElements, function(liElement) {
                                var $liElement = angular.element(liElement);
                                var liScope = $liElement.scope();
                                existingScopes.push(liScope);
                            });
                            // iterate over the newValue, the new expanded nodes, and for each find it in the existingNodesAndScopes
                            // if found, add the mapping $id -> node into newExpandedNodesMap
                            // if not found, add the mapping num -> node into newExpandedNodesMap
                            angular.forEach(newValue, function(newExNode) {
                                var found = false;
                                for (var i=0; (i < existingScopes.length) && !found; i++) {
                                    var existingScope = existingScopes[i];
                                    if (scope.options.equality(newExNode, existingScope.node)) {
                                        newExpandedNodesMap[existingScope.$id] = existingScope.node;
                                        found = true;
                                    }
                                }
                                if (!found)
                                    newExpandedNodesMap[notFoundIds++] = newExNode;
                            });
                            scope.expandedNodesMap = newExpandedNodesMap;
                        });

//                        scope.$watch('expandedNodesMap', function(newValue) {
//
//                        });

                        //Rendering template for a root node
                        treemodelCntr.template( scope, function(clone) {
                            element.html('').append( clone );
                        });
                        // save the transclude function from compile (which is not bound to a scope as apposed to the one from link)
                        // we can fix this to work with the link transclude function with angular 1.2.6. as for angular 1.2.0 we need
                        // to keep using the compile function
                        scope.$treeTransclude = childTranscludeFn;
                    }
                }
            };
        }])
        .directive("treeitem", function() {
            return {
                restrict: 'E',
                require: "^treecontrol",
                link: function( scope, element, attrs, treemodelCntr) {
                    // Rendering template for the current node
                    treemodelCntr.template(scope, function(clone) {
                        element.html('').append(clone);
                    });
                }
            }
        })
        .directive("treeTransclude", function() {
            return {
                link: function(scope, element, attrs, controller) {
                    if (!scope.options.isLeaf(scope.node)) {
                        angular.forEach(scope.expandedNodesMap, function (node, id) {
                            if (scope.options.equality(node, scope.node)) {
                                scope.expandedNodesMap[scope.$id] = scope.node;
                                scope.expandedNodesMap[id] = undefined;
                            }
                        });
                    }
                    if (!scope.options.multiSelection && scope.options.equality(scope.node, scope.selectedNode)) {
                        scope.selectedNode = scope.node;
                    } else if (scope.options.multiSelection) {
                        var newSelectedNodes = [];
                        for (var i = 0; (i < scope.selectedNodes.length); i++) {
                            if (scope.options.equality(scope.node, scope.selectedNodes[i])) {
                                newSelectedNodes.push(scope.node);
                            }
                        }
                        scope.selectedNodes = newSelectedNodes;
                    }

                    // create a scope for the transclusion, whos parent is the parent of the tree control
                    scope.transcludeScope = scope.parentScopeOfTree.$new();
                    scope.transcludeScope.node = scope.node;
                    scope.transcludeScope.$parentNode = (scope.$parent.node === scope.synteticRoot)?null:scope.$parent.node;
                    scope.transcludeScope.$index = scope.$index;
                    scope.transcludeScope.$first = scope.$first;
                    scope.transcludeScope.$middle = scope.$middle;
                    scope.transcludeScope.$last = scope.$last;
                    scope.transcludeScope.$odd = scope.$odd;
                    scope.transcludeScope.$even = scope.$even;
                    scope.$on('$destroy', function() {
                        scope.transcludeScope.$destroy();
                    });

                    scope.$treeTransclude(scope.transcludeScope, function(clone) {
                        element.empty();
                        element.append(clone);
                    });
                }
            }
        });
})( angular );
