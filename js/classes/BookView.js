import {$} from '../libs';
import View from 'View';

export default class BookView extends View {

  static PAGE_HANDLER_DELAY = 1000;

  constructor(container, onLoad, template, handler) {
    super(container, onLoad, template, handler);
  }

  initView() {
    this.view = this.container.find('.view');
    this.bookmarksView = this.container.find('.widBookmarks');
    this.thumbnailsView = this.container.find('.widThumbnails');
    this.searchView = this.container.find('.widSearch');
  }

  getHandlers(id) {
    let handlers;
    if(id==='inpPage') {
      handlers = [{
        inpPage: (e, data)=> this.callLater(super.getHandlers(id), id, e, data, BookView.PAGE_HANDLER_DELAY)
      }];
    }
    else {
      handlers = super.getHandlers(id);
    }
    return handlers;
  }

  onItemStateChanged(id, state) {
    if(id==='cmdFullScreen') {
      if(state.active) {
        this.parentContainer.addClass('fullscreen');
      }
      else {
        this.parentContainer.removeClass('fullscreen');
      }
    }
  }

  getView() {
    return this.view;
  }

  getBookmarksView() {
    return this.bookmarksView;
  }

  getThumbnailsView() {
    return this.thumbnailsView;
  }

  getSearchView() {
    return this.searchView;
  }

  getForms() {
    return [
    ];
  }

  getLinks() {
    return [
      'cmdZoomIn',
      'cmdZoomOut',
      'cmdDefaultZoom',
      'cmdToc',
      'cmdFastBackward',
      'cmdBackward',
      'cmdBigBackward',
      'cmdForward',
      'cmdBigForward',
      'cmdFastForward',
      'cmdSave',
      'cmdPrint',
      'cmdFullScreen',
      'cmdSmartPan',
      'cmdSinglePage',
      'cmdSounds',
      'cmdStats',
      'cmdLightingUp',
      'cmdLightingDown',
      'cmdCloseToc',
      'cmdBookmarks',
      'cmdSearch',
      'cmdThumbnails',
      'cmdPendingPlay'
    ];
  }

  getWidgets() {
    return [
      'widLoadingProgress',
      'widFloatWnd',
      'widTocMenu',
      'widBookmarks',
      'widThumbnails',
      'widSearch',
      'widSettings',
      'widLoading',
      'widPendingPlay'
    ];
  }

  getInputs() {
    return [
      'inpPage',
      'inpPages'
    ];
  }

  getTexts() {
    return [
      'txtLoadingProgress'
    ];
  }

  getTemplate() {
    return {
      html: 'templates/default-book-view.html',
      styles: [
        'css/black-book-view.css'
      ],
      links: [
        {
          rel: 'stylesheet',
          href: 'css/font-awesome.min.css'
        }
      ],
      script: 'js/default-book-view.js'
    };
  }

}
