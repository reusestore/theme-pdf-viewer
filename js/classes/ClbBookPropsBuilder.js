import BookPropsBuilder from './BookPropsBuilder';
import ImageFactory from 'ImageFactory';

export default class ClbBookPropsBuilder extends BookPropsBuilder {
  constructor(context, pageCallback, pages, onReady, style) {
    super(onReady, style);
    this.calcSheets(pages);
    this.pageCallback = pageCallback;
    this.binds = {
      pageCallback: pageCallback.bind(this)
    };
    this.imageFactory = new ImageFactory(context);

    if(pages>0) {
      const test = this.imageFactory.build(pageCallback(0), 0, this.defaults.sheet.widthTexels, this.defaults.sheet.heightTexels, this.defaults.sheet.color);
      test.onLoad = ()=> {
        this.calcProps(test.width, test.height);
        test.dispose();
        this.ready();
      };
    }
    else {
      this.props = this.defaults;
      this.ready();
    }
  }

}
