import CSSLayer from 'CSSLayer';

export default class SheetCssLayer {
  constructor(visual, block, props) {
    this.visual = visual;
    const size = block.getTopSize();
    this.layer = new CSSLayer(size.width, size.height, props);

    this.update(block);
    this.visual.addCssObject(this.layer);
  }

  dispose() {
    this.layer.dispose();
    this.visual.removeCssObject(this.layer);
  }

  isHidden() {
    return this.layer.isHidden();
  }

  hide() {
    return this.layer.hide();
  }

  show() {
    return this.layer.show();
  }

  set(css, html, js) {
    this.layer.setData(css, html, js);
  }

  update(block) {
    this.block = block;
    this.block.getTopWorldRotation(this.layer.rotation);
    this.block.getTopWorldPosition(this.layer.position);
  }
}
