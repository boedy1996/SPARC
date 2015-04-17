
$(function(){
    var appElement = document.querySelector('[ng-controller=hazard_map_Controller]');
    var $scope = angular.element(appElement).scope(); 
    $('#menu').on('click', function(){
        $('#sidebar').toggle('slide', { direction: 'left' }, 250);
        $('#main-content').animate({
            'margin-left' : $('#main-content').css('margin-left') == '0px' ? '375px' : '0px'
        }, 250, 'swing', $scope.refreshMAPSize());
    });
    
    $scope.refreshMAPSize();
});