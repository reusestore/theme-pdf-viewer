import {$, THREE} from '../libs'
import Cache from 'Cache';
import LoadingAnimation from 'LoadingAnimation';
import ImageFactory from 'ImageFactory';
import TextureAnimator from 'TextureAnimator';

export default class PageManager {

  constructor(visual, book, p) {
    this.visual = visual;
    this.book = book;
    this.pageQuery = '';
    this.p = p;
    this.pageCache = new Cache(p.cachedPages);
    this.resourcesCache = new Cache();

    this.canvases = [];
    for(let i=0; i<10; ++i) {
      const c = $('<canvas>')[0];
      this.canvases.push({c, ctx: c.getContext('2d')});
    }
    this.nextCanvas = 0;

    this.imageFactory = new ImageFactory({...visual, dispatchEvent: book.dispatchEvent.bind(book), renderCanvas: this.canvases[0].c, renderCanvasCtx: this.canvases[0].ctx}, this.resourcesCache);

    this.loadings = [];
    this.renderQueue = [];
    this.predictedRequests = [];

    this.tmpMaterial = new THREE.MeshBasicMaterial();
    visual.addObject(new THREE.Mesh(new THREE.PlaneGeometry(1e-3, 1e-3), this.tmpMaterial));

    this.loadingAnimation = true;
    this.loading = {};
    this.loading[p.cover.color] = this.createLoadingTexture(p.cover);
    if(p.page.color!==p.cover.color) {
      this.loading[p.page.color] = this.createLoadingTexture(p.page);
    }

    this.book.addEventListener('afterAnimation', this.loadPredictedPages.bind(this));

    this.turnOnEvents();

    visual.addRenderCallback(this.update.bind(this));

    Promise.resolve().then(this.updateRenderQueue.bind(this));
  }

  createLoadingTexture(p) {
    const spriteTiles = 6, heightTexels = p.height/p.width*p.widthTexels,
      scale = Math.sqrt(4.5*210*4.5*297/(p.widthTexels*heightTexels)),
      animation = new LoadingAnimation(scale*p.widthTexels, scale*heightTexels, p.color),
      animator = new TextureAnimator(animation.createSprite(spriteTiles), spriteTiles, 1, spriteTiles, 0.2);
    animation.dispose();
    return animator;
  }

  dispose() {
    this.turnOffEvents();
    for(let color of Object.keys(this.loading)) {
      this.loading[color].dispose();
    }
    delete this.loading;
    this.resourcesCache.dispose();
    this.pageCache.dispose();
    for(let o of this.canvases) {
      o.c.height = o.c.width = 0;
    }
    delete this.canvases;
  }

  isCover(n) {
    return n<2 || n>=2*(this.p.sheets+1);
  }

  isMobile() {
      return this.visual.isMobile();
  }

  getPageState(n) {
    const object = this.pageCache.get(n);
    return object? object.state: undefined;
  }

  enableLoadingAnimation(enable) {
    this.loadingAnimation = enable;
    for(let o of this.loadings) {
      this.setupMaterial(o);
    }
  }

  update(dt) {
    if(this.loadingAnimation) {
      const loading = {};
      for(let o of this.loadings) {
        if(o.isActive()) {
          loading[o.color] = true;;
        }
      }
      for(let color of Object.keys(loading)) {
        this.loading[color].update(dt);
        this.book.updateThree();
      }
    }
  }

  removeFromLoadings(o) {
    const i = this.loadings.indexOf(o);
    if(~i) {
      this.loadings.splice(i, 1);
    }
  }

  removeFromRenderQueue(o) {
    const i = this.renderQueue.indexOf(o);
    if(~i) {
      this.renderQueue.splice(i, 1);
    }
  }

  refreshPageQuery(n, query='') {
    this.pageQuery = query;
    const object = this.pageCache.get(n);
    if(object && object.wrapper && object.wrapper.setQuery) {
      if(!this.pageCache.remove(n)) {
        object.wrapper.setQuery(query);
        this.pushInRenderQueue(object);
      }
    }
  }

  refreshZoom() {
    if(this.p.autoResolution.enable) {
      const es = [];
      this.pageCache.forEach((e)=> {
        es.push(e);
      });
      es.forEach((e)=> {
        const object = e[1];
        if(object && object.wrapper) {
          if(!this.pageCache.remove(e[0])) {
            this.pushInRenderQueue(object);
          }
        }
      });
    }
  }

  getLayers(n, clb) {
    if(this.p.cssLayersLoader) {
      this.p.cssLayersLoader(n, (...args)=> {
        const object = this.pageCache.get(n);
        if(object) {
          if(object.state!=='active') {
            object.pendings.push({clb, args});
          }
          else {
            clb(...args);
          }
        }
      });
    }
    else {
      clb([]);
    }
  }

  resolvePendings(pendings) {
    for(let p of pendings) {
      try {
        p.clb(...p.args);
      }
      catch(e) {
        console.error(e);
      }
    }
    pendings.splice(0, pendings.length);
  }

  rtlPageN(n) {
    return this.p.rtl? 2*(this.p.sheets+2)-1-n: n;
  }

  load(material, n) {
    const pi = this.p.pageCallback(this.rtlPageN(n)), p = this.isCover(n)? this.p.cover: this.p.page;
    const o = {
      n,
      texture: new THREE.Texture(),
      wrapper: null,
      state: 'loading',
      locked: (n)=> o.state === 'loading' || o.state === 'rendering' || this.book.isActivePage(n),
      color: p.color,
      isActive: ()=> this.book.isActivePage(n),
      isTop: ()=> ~this.book.getTopPages().indexOf(n),
      dispose: ()=> {
        this.removeFromLoadings(o);
        this.removeFromRenderQueue(o);
        if(o.wrapper && o.wrapper.dispose) {
          o.wrapper.dispose();
        }
        o.texture.dispose();
        delete o.texture;
        delete o.wrapper;
      },
      pendings: []
    };
    o.texture.minFilter = THREE.LinearFilter;
    this.loadings.push(o);
    this.setMaterial(o, material);

    Promise.resolve().then(()=> {
      if(o.texture) {
        o.widthTexels = pi.widthTexels || p.widthTexels;
        o.heightTexels = p.height/p.width*p.widthTexels;
        const res = this.calcResolution(o);
        o.wrapper = this.imageFactory.build(pi, pi.number===undefined? this.rtlPageN(n): pi.number, res.width, res.height, p.color, this.p.injector);
        if(o.wrapper.setQuery) {
          o.wrapper.setQuery(this.pageQuery);
        }
        o.simulate = pi.interactive? (o.wrapper.simulate || (()=> undefined)).bind(o.wrapper): undefined;
        o.wrapper.onLoad = ()=> {
          o.state = 'loaded';
          this.pushInRenderQueue(o);
          this.book.dispatchEvent({
            type: 'loadedPage',
            page: n
          });
        };
        o.wrapper.onChange = (image)=> {
          if(o.texture) {
            this.removeFromLoadings(o);
            if(o.material) {
              o.material.map = o.texture;
              o.material.color = new THREE.Color(0xFFFFFF);
              o.material.needsUpdate = true;
            }
            o.texture.image = image;
            o.texture.needsUpdate = true;
            o.texture.onUpdate = ()=> {
              setTimeout(()=>{
                if(o.state !== 'queuedForRender') {
                  o.state = 'active';
                  this.resolvePendings(o.pendings);
                }
                delete this.rendering;
                //this.updateRenderQueue();
              }, 100);
            };
            this.tmpMaterial.map = o.texture;
            this.tmpMaterial.needsUpdate = true;
          }
        };
      }
    });
    this.book.dispatchEvent({
      type: 'loadPage',
      page: n
    });
    return this.pageCache.put(n, o);
  }

  isSinglePage(o) {
    return this.p.singlePage || !o.n || o.n===this.book.getPages()-1;
  }

  calcResolution(o) {
    let res;
    if(this.p.autoResolution.enable) {
      const k = Math.min((this.isSinglePage(o)? 1: 0.5)*this.visual.width()/o.widthTexels, this.visual.height()/o.heightTexels);
      res = {
        width: this.p.autoResolution.k*this.p.zoom*k*o.widthTexels,
        height: this.p.autoResolution.k*this.p.zoom*k*o.heightTexels
      };
    }
    else {
      res = {
        width: o.widthTexels,
        height: o.heightTexels
      };
    }
    return res;
  }

  pushInRenderQueue(o) {
    if(o.state!=='queuedForRender' && o.state!=='loading') {
      o.state = 'queuedForRender';
      this.renderQueue.push(o);
      // this.updateRenderQueue();
    }
  }

  updateRenderQueue() {
    if(this.canvases) {
      const p = this.p;
      if(!this.rendering) {
        if(p.renderWhileFlipping || !this.book.isProcessing()) {
          let active, top;
          for(let o of this.renderQueue) {
            if(!active && o.isActive()) {
              active = o;
            }
            if(o.isTop()) {
              top = o;
              break;
            }
          }
          this.rendering = top || active;

          if(this.isMobile() && p.renderInactivePagesOnMobile || !this.isMobile() && p.renderInactivePages) {
            if(!this.rendering) {
              const ud = this.book.getUserDirection(), near = {};
              for(let o of this.renderQueue) {
                const id = ud.lastTopPage<o.n;
                if(!near[id] || Math.abs(near[id].n-ud.lastTopPage)>Math.abs(o.n-ud.lastTopPage)) {
                  near[id] = o;
                }
                this.rendering = near[ud.direction===1] || near[ud.direction!==1];
              }
            }
          }
          if(this.rendering) {
            if(this.rendering.wrapper.startRender) {
              this.removeFromRenderQueue(this.rendering);
              this.rendering.state = 'rendering';
              const o = this.canvases[this.nextCanvas];
              this.nextCanvas = (this.nextCanvas+1)%this.canvases.length;
              this.rendering.wrapper.setRenderCanvas(o.c, o.ctx);
              this.rendering.wrapper.setResolution(this.calcResolution(this.rendering));
              this.rendering.wrapper.startRender();
            }
            else {
              delete this.rendering;
            }
          }
        }
      }
      else {
        this.book.updateThree();
      }
      setTimeout(this.updateRenderQueue.bind(this), 100);
    }
  }

  turnOnEvents() {
    this.transferEvents = true;
  }

  turnOffEvents() {
    const mouseup = $.Event('mouseup'), mouseout = $.Event('mouseout');
    this.pageCache.forEach((ent)=> {
      const object = ent[1];
      if(object.simulate) {
        object.simulate(mouseup, undefined, 0, 0);
        object.simulate(mouseout, undefined, 0, 0);
      }
    });
    this.transferEvents = false;
  }

  transferEventToTexture(n, e, data) {
    if(this.transferEvents) {
      const toObject = this.getOrLoadTextureObject(undefined, n);
      if(toObject.wrapper) {
        const {uv} = data, toDoc = toObject.wrapper.getSimulatedDoc();
        this.pageCache.forEach((ent)=> {
          const object = ent[1];
          if(object.simulate) {
            object.simulate(e, toDoc, uv.x, uv.y);
          }
        });
      }
    }
  }

  loadPredictedPages() {
    Promise.resolve().then(()=> {
      const ud = this.book.getUserDirection();
      this.predictedRequests = [];
      for(let i = 0, p = ud.lastTopPage + ud.direction; i<this.p.preloadPages; ++i, p+=ud.direction) {
        this.predictedRequests.push(p);
      }
      for(let p of this.predictedRequests) {
        if(p>=0 && p<this.book.getPages() && !this.pageCache.get(p)) {
          this.load(undefined, p);
        }
      }
    });
  }

  setMaterial(o, material) {
    this.pageCache.forEach((e)=> {
      const ob = e[1];
      if(o!==ob && ob.material===material) {
        delete ob.material;
      }
    });
    if(material && material!==o.material) {
      o.material = material;
      this.setupMaterial(o);
    }
  }

  setupMaterial(o) {
    o.material.map = o.texture.image? o.texture: (this.loadingAnimation? this.loading[o.color].texture: null);
    if(!o.material.map) {
      o.material.color = new THREE.Color(o.color);
    }
    o.material.needsUpdate = true;
  }

  getOrLoadTextureObject(material, n) {
    let object = this.pageCache.get(n);
    if(!object) {
      object = this.load(material, n);
    }
    else {
      this.setMaterial(object, material);
    }

    return object;
  }

  setTexture(material, n) {
    this.getOrLoadTextureObject(material, n);
  }
}
