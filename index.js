import {$, tr} from './js/libs';
import Detector from 'Detector';
import VisualWorld from 'VisualWorld';
import PdfLinksHandler from './js/classes/PdfLinksHandler';
import Book from './js/classes/Book';
import BookView from './js/classes/BookView';
import BookController from './js/classes/BookController';
import PdfBookPropsBuilder from './js/classes/PdfBookPropsBuilder';
import ClbBookPropsBuilder from './js/classes/ClbBookPropsBuilder';
import LoadingController from 'LoadingController';
import Search from 'Search';
import Bookmarks from 'Bookmarks';
import Thumbnails from 'Thumbnails';
import TocController from './js/classes/TocController';
import BookPrinter from './js/classes/BookPrinter';
import AutoNavigator from './js/classes/AutoNavigator';
import SoundsEnviroment from './js/classes/SoundsEnviroment';
import FullScreenX from 'FullScreenX';

$.fn.FlipBook = function(options) {
  const scene = {
    dispose() {
      if(this.ready) {
        !scene.pdfLinksHandler || scene.pdfLinksHandler.dispose();
        delete scene.pdfLinksHandler;
        scene.sounds.dispose();
        delete scene.sounds;
        scene.tocCtrl.dispose();
        delete scene.tocCtrl;
        scene.thumbnails.dispose();
        delete scene.thumbnails;
        !scene.bookmarks || scene.bookmarks.dispose();
        delete scene.bookmarks;
        scene.ctrl.dispose();
        delete scene.ctrl;
        scene.bookPrinter.dispose();
        delete scene.bookPrinter;
        scene.book.dispose();
        delete scene.book;
        scene.propsBuilder.dispose();
        delete scene.propsBuilder;
        delete scene.bookBuilder;
        scene.visual.dispose();
        delete scene.visual;
        scene.view.dispose();
        delete scene.view;
        delete scene.dispose;
      }
      else {
        this.pendingDispose = true;
      }
    }
  };
  options = {...options};
  const parentContainer = this.length? this[0]: $('<div>').appendTo('body');
  if(options.activateFullScreen) {
    FullScreenX.request(parentContainer);
  }
  scene.view = new BookView(parentContainer, ()=> {
    if(!Detector.webgl) {
      Detector.addGetWebGLMessage({parent: scene.view.getView()});
    }
    else {
      scene.loadingCtrl = new LoadingController(scene.view, true, (progress)=> progress===0? tr('Please wait... the Application is Loading'): tr('PDF is Loading:')+' '+progress+'%');
      scene.visual = new VisualWorld(scene.view.getContainer().ownerDocument.defaultView, scene.view.getContainer().ownerDocument, scene.view.getView());
      scene.bookBuilder = (props, sheets, pageCallback)=> {
        props.cssLayerProps = {
          ...props.cssLayerProps,
          scene
        };
        if(options.propertiesCallback) {
          props = options.propertiesCallback(props);
        }
        scene.book = new Book(scene.visual, sheets, pageCallback, props);
        scene.bookPrinter = new BookPrinter(scene.visual, scene.book, (options.template || {}).printStyle);
        scene.loadingCtrl.dispose();
        delete scene.loadingCtrl;
        scene.ctrl = new BookController(scene.book, scene.view, options.controlsProps);
        scene.book.setInjector((w)=> {
          w.jQuery = w.$ = $;
          w.book = scene.book;
          w.bookCtrl = scene.ctrl;
          if(props.injector) {
            props.injector(w);
          }
        });
        scene.view.addHandler(scene.ctrl);
        scene.ctrl.setPrinter(scene.bookPrinter);
        const test = pageCallback(0);

        scene.search = new Search(scene.view.getSearchView(), scene.book.getPages());
        scene.search.onQuery = scene.book.setQuery.bind(scene.book);
        scene.book.addEventListener('searchResults', (e)=> {
          scene.search.setResults(e.results, e.lastPage);
        });

        scene.thumbnails = new Thumbnails(scene.visual, scene.view.getThumbnailsView(), pageCallback, 2*(sheets+2), {kWtoH: props.width/props.height});
        scene.tocCtrl = new TocController(scene.view, scene.ctrl);
        scene.tocCtrl.setThumbnails(scene.thumbnails);
        scene.tocCtrl.setSearch(scene.search);
        scene.ctrl.setTocCtrl(scene.tocCtrl);
        scene.view.addHandler(scene.tocCtrl);

        if(test.type==='pdf') {
          scene.pdfLinksHandler = new PdfLinksHandler(test.src, scene.ctrl, scene.visual.element);
          scene.book.addEventListener('pdfAnnotation', scene.pdfLinksHandler.handleEvent.bind(scene.pdfLinksHandler));
          test.src.getHandler((handler)=> {
            handler.getOutline().
              then((outline)=> {
                scene.bookmarks = new Bookmarks(scene.view.getBookmarksView(), outline);
                scene.tocCtrl.setBookmarks(scene.bookmarks, test.src);
              });
          });
          if(options.pdfLinks && options.pdfLinks.handler) {
            scene.pdfLinksHandler.setHandler(options.pdfLinks.handler);
          }
        }

        scene.sounds = new SoundsEnviroment(options.template);
        scene.ctrl.setSounds(scene.sounds);
        scene.sounds.subscribeFlips(scene.ctrl);

        scene.ready = true;
        new AutoNavigator(scene.visual, scene.ctrl, options.autoNavigation).dispose();
        if(options.ready) {
          options.ready(scene);
        }
        if(scene.pendingDispose) {
          scene.dispose();
        }
      };
      if(options.pdf) {
        scene.propsBuilder = new PdfBookPropsBuilder(options.pdf, scene.bookBuilder, options.bookStyle);
        scene.propsBuilder.pdf.setLoadingProgressClb(scene.loadingCtrl.setProgress.bind(scene.loadingCtrl));
        if(options.error) {
          scene.propsBuilder.pdf.setErrorHandler(options.error);
        }
      }
      else if(options.pageCallback) {
        scene.propsBuilder = new ClbBookPropsBuilder(scene.visual, options.pageCallback, options.pages, scene.bookBuilder, options.bookStyle);
      }
      else {
        scene.propsBuilder = new ClbBookPropsBuilder(scene.visual, Book.pageCallback, 6, scene.bookBuilder, options.bookStyle);
      }
    }
  }, options.template);
  return scene;
}

$(()=> {
  let containers = $('.flip-book-container');
  for(let i = 0; i<containers.length; ++i) {
    const jContainer = $(containers[i]), src = jContainer.attr('src');
    if(!!src) {
      jContainer.FlipBook({pdf: src});
    }
  }
});

window.jQuery = window.$ = $;
