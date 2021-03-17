import {props as  bookProps} from '../props/book';
import BaseMathUtils from 'BaseMathUtils';

export default class BookPropsBuilder {
  constructor(onReady, style) {
    this.onReady = onReady;
    this.defaults = bookProps(style);
  }

  dispose() {

  }

  calcSize(width, height) {
    const scale = BaseMathUtils.calcScale(width, height, this.defaults.width, this.defaults.height);
    return {
      width: scale*width,
      height: scale*height
    };
  }

  calcTexels(width, height) {
    const sheet = this.defaults.sheet, scale = BaseMathUtils.calcScale(width, height, sheet.widthTexels, sheet.heightTexels);
    return {
      widthTexels: scale*width,
      heightTexels: scale*height
    };
  }

  calcProps(width, height) {
    this.props = {
      ...this.defaults,
      ...this.calcSize(width, height),
      sheet: {
        ...this.defaults.sheet,
        ...this.calcTexels(width, height)
      },
      cover: {
        ...this.defaults.cover,
      },
      page: {
        ...this.defaults.page,
      }
    };
  }

  calcSheets(pages) {
    return this.sheets = Math.ceil(Math.max(0, pages-4)/2);
  }

  getSheets() {
    return this.sheets;
  }

  getProps() {
    return this.props;
  }

  getPageCallback() {
    return this.binds.pageCallback;
  }

  ready() {
    if(this.onReady) {
      this.onReady(this.getProps(), this.getSheets(), this.getPageCallback());
    }
  }
}
