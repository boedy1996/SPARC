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