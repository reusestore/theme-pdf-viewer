const _$ = GLOBAL_LIBS.jQuery? window.jQuery: require('jquery'),
      _html2canvas = GLOBAL_LIBS.html2canvas? window.html2canvas: require('html2canvas'),
      _THREE = GLOBAL_LIBS.THREE? window.THREE: require('three'),
      _PDFJS = GLOBAL_LIBS.PDFJS? window.PDFJS: require('pdfjs'),
      _tr = (s)=> (window.iberezansky || {}).tr && window.iberezansky.tr(s) || s;

if(window.FB3D_LOCALE) {
  window.iberezansky = {
    ...window.iberezansky,
    tr: (s)=> (FB3D_LOCALE.dictionary || {})[s] || s
  };
}

export {
  _$ as $,
  _html2canvas as html2canvas,
  _THREE as THREE,
  _PDFJS as PDFJS,
  _tr as tr
};
