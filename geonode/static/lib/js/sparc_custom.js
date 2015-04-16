$('#opener').on('click', function() {   
    var panel = $('#left-slide-pane');
    var mainPanel = $('#main_slide_pane');
    var icon = $(this).children();

    if (panel.hasClass("visible")) {
      panel.removeClass('visible').animate({'margin-left':'-300px'});
      mainPanel.removeClass('col-md-9');
      mainPanel.addClass('col-md-auto');
      icon.removeClass('fa-angle-double-left');
      icon.addClass('fa-angle-double-right');
    } else {
      panel.addClass('visible').animate({'margin-left':'0px'});
      mainPanel.removeClass('col-md-auto');
      mainPanel.addClass('col-md-9');
      icon.removeClass('fa-angle-double-right');
      icon.addClass('fa-angle-double-left');
    } 
    return false; 
});

$(function(){
    var appElement = document.querySelector('[ng-controller=hazard_map_Controller]');
    var $scope = angular.element(appElement).scope(); 
    $('#menu').on('click', function(){
        $('#sidebar').toggle('slide', { direction: 'left' }, 250);
        $('#main-content').animate({
            'margin-left' : $('#main-content').css('margin-left') == '0px' ? '375px' : '0px'
        }, 250);
         $scope.refreshMAPSize();
    });
    
    $scope.refreshMAPSize();
});