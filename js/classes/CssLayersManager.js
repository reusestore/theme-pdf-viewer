import SheetCssLayer from './SheetCssLayer';

export default class CssLayersManager {
  constructor(book) {
    this.book = book;
    this.props = book.p.cssLayerProps;
    this.visual = book.visual;
    this.pageManager = book.pageManager;
    this.wrappers = {};
    this.pendings = [];
  }

  getActives() {
    let page = this.book.getPage(), pages = this.book.getPages(), acs = page===0 || page===pages-1? [page]: [page, page+1];
    if(!this.wrappers[0] && page!==0) {
      acs = [0, ...acs];
    }
    return acs;
  }

  dispose() {
    for(let w of Object.values(this.wrappers)) {
      w.layers.forEach((l)=> l.dispose());
    }
    delete this.wrappers;
  }

  show() {
    this.hidden = false;
    for(let n of this.getActives()) {
      const w = this.wrappers[n];
      if(w) {
        if(w.state==='ready' && w.layers.length) {
          const block = this.book.getBlockByPage(n);
          w.layers.forEach((l)=> {
            if(l.isHidden()) {
              l.update(block);
              l.show();
            }
          });
        }
      }
      else {
        const w = this.wrappers[n] = {
          state: 'loading',
          layers: []
        };
        Promise.resolve().then(()=> {
          this.pageManager.getLayers(n, (layers)=> {
            const finish = ()=> {
              if(layers.length && this.wrappers) {
                const block = this.book.getBlockByPage(n);
                for(let l of layers) {
                  const sl = new SheetCssLayer(this.visual, block, {...this.props, pageNumber: n});
                  w.layers.push(sl);
                  sl.set(l.css, l.html, l.js);
                }
                setTimeout(()=> {
                  if(!this.hidden && ~this.getActives().indexOf(n)) {
                    w.layers.forEach((l)=> l.show());
                  }
                }, 10);
              }
              w.state = 'ready';
            };
            if(this.wrappers && (n===0 || this.wrappers[0].state!=='loading')) {
              finish();
              if(n===0) {
                for(let f of this.pendings) {
                  f();
                }
                this.pendings = [];
              }
            }
            else {
              this.pendings.push(finish);
            }
          });

        });
      }
    }

  }

  hide() {
    this.hidden = true;
    const wait = [];
    for(let w of Object.values(this.wrappers)) {
      w.layers.forEach((l)=> wait.push(l.hide()));
    }
    return Promise.all(wait);
  }
}
