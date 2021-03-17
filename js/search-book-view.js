function init(container) {
  var instance;
  if(window.jQuery) {
    var $ = window.jQuery;
    instance = {
      floatWnd: container.find('.float-wnd'),
      binds: {
        showDropMenu: function(e) {
          e.preventDefault();
          var el = $(e.target);
          while(!el.hasClass('toggle')) {
            el = $(el[0].parentNode);
          }
          var menu = el.find('.menu');
          if(menu.hasClass('hidden')) {
            container.find('.ctrl .fnavbar .menu').addClass('hidden');
            menu.removeClass('hidden');
            e.stopPropagation();
          }
        },
        hideDropMenu: function() {
          container.find('.ctrl .fnavbar .menu').addClass('hidden');
        },
        pickFloatWnd: function(e) {
          if(instance.pos) {
            instance.binds.dropFloatWnd();
          }
          else {
            instance.pos = {
              x: e.pageX,
              y: e.pageY
            };
          }
        },
        moveFloatWnd: function(e) {
          if(instance.pos) {
            var dv = {
              x: e.pageX-instance.pos.x,
              y: e.pageY-instance.pos.y
            }, old = {
              x: parseInt(instance.floatWnd.css('left')),
              y: parseInt(instance.floatWnd.css('top'))
            };
            instance.floatWnd.css('left', old.x+dv.x+'px').css('top', old.y+dv.y+'px');
            instance.pos = {
              x: e.pageX,
              y: e.pageY
            };
          }
        },
        dropFloatWnd: function() {
          delete instance.pos;
        }
      },
      appLoaded: function() {
        // instance.binds.jsCenter();
        var widFloatWnd = container.find('.widFloatWnd'),
            cmdToc = container.find('.cmdToc'),
            cmdSearch = widFloatWnd.find('.cmdSearch'),
            inpQuery = widFloatWnd.find('.inpQuery'),
            searchBar = container.find('.search-bar');
        inpQuery.on('keyup', function() {
          searchBar[0].value = inpQuery[0].value;
        });
        searchBar.on('keyup', function() {
          var stamp = instance.searchBarStamp = Date.now();
          if(searchBar[0].value!=='') {
            setTimeout(function() {
              if(stamp === instance.searchBarStamp) {
                if(widFloatWnd.hasClass('hidden')) {
                  cmdToc.trigger('click');
                }
                cmdSearch.trigger('click');
              }
            }, 1000);
          }
          inpQuery[0].value = searchBar[0].value;
          inpQuery.trigger('keydown');
        });


      },
      // linkLoaded: function(link) {
      //   instance.binds.jsCenter();
      // },
      dispose: function() {
        container.find('.ctrl .fnavbar .fnav .toggle').off('click', instance.binds.showDropMenu);
        $(container[0].ownerDocument).off('click', instance.binds.hideDropMenu);

        $(container[0].ownerDocument).off('mousemove', instance.binds.moveFloatWnd);
        $(container[0].ownerDocument).off('mouseup', instance.binds.dropFloatWnd);
        instance.floatWnd.find('.header').off('mousedown', instance.binds.pickFloatWnd);

        // $(container[0].ownerDocument.defaultView).off('resize', instance.binds.jsCenter);
      }
    };
    container.find('.ctrl .fnavbar .fnav .toggle').on('click', instance.binds.showDropMenu);
    $(container[0].ownerDocument).on('click', instance.binds.hideDropMenu);

    $(container[0].ownerDocument).on('mousemove', instance.binds.moveFloatWnd);
    $(container[0].ownerDocument).on('mouseup', instance.binds.dropFloatWnd);
    instance.floatWnd.find('.header').on('mousedown', instance.binds.pickFloatWnd);

    // $(container[0].ownerDocument.defaultView).on('resize', instance.binds.jsCenter);
    // instance.binds.jsCenter();
  }
  else {
    instance = {
      dispose: function() {
      }
    };
    console.error('jQuery is not found');
  }
  return instance;
} init
