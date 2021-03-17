
export default class AutoNavigator {

  constructor(context, bookCtrl, props={}) {
    props = {
      ...props,
      urlParam: props.urlParam || 'fb3d-page',
      navigates: props.navigates===undefined? 1: props.navigates,
      pageN: props.pageN || 0
    };
    this.props = props;
    this.context = context;
    this.bookCtrl = bookCtrl;
    this.urlParam = props.urlParam;
    this.pageN = props.pageN;
    this.wnd = context.wnd;

    this.wnd.fb3d = {
      ...this.wnd.fb3d
    };
    this.wnd.fb3d.navigator = {
      ...this.wnd.fb3d.navigator
    };
    this.navigator = this.wnd.fb3d.navigator[this.urlParam] = {
      ...this.wnd.fb3d.navigator[this.urlParam]
    };
    this.navigator.instances = (this.navigator.instances || 0)+1;

    if(this.navigator.instances<=this.props.navigates) {
      this.bookCtrl.goToPage(this.getPageNumber());
    }
  }

  dispose() {

  }

  getParameterByName(name, url) {
    if (!url) {
      url = window.location.href;
    }
    name = name.replace(/[\[\]]/g, '\\$&');
    const regex = new RegExp('[?&]' + name + '(=([^]*)|&|#|$)'),
    results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
  }

  getPageNumber() {
    let number = parseInt(this.pageN);
    if(isNaN(number)||number===0) {
      number = this.getParameterByName(this.urlParam);
      number = parseInt(number);
      if(isNaN(number)) {
        number = 1;
      }
    }
    return number-1;
  }

}
