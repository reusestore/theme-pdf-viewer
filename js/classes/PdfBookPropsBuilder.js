import BookPropsBuilder from './BookPropsBuilder';
import Pdf from 'Pdf';

export default class PdfBookPropsBuilder extends BookPropsBuilder {

  constructor(src, onReady, style) {
    super(onReady, style);
    this.pdf = new Pdf(src);
    this.pageDescription = {
      type: 'pdf',
      src: this.pdf,
      interactive: true
    };
    this.binds = {
      pageCallback: this.pageCallback.bind(this)
    };
    this.pdf.getHandler(this.init.bind(this));
  }

  dispose() {
    this.pdf.dispose();
    super.dispose();
  }

  init(handler) {
    const pages = this.pdf.getPagesNum();
    this.calcSheets(pages);
    if(pages>0) {
      handler.getPage(1).
      then((page)=> {
        const viewport = page.getViewport({scale: 1}), size = {width: viewport.width, height: viewport.height};
        this.calcProps(size.width, size.height);
        this.ready();
      }).
      catch((e)=> {
        console.error(e);
      });
    }
    else {
      this.props = this.defaults;
      this.ready();
    }
  }

  pageCallback(n) {
    return this.pageDescription;
  }

}
