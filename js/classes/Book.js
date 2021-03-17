import {$, THREE} from '../libs';
import {props as  bookProps} from '../props/book';
import GraphUtils from 'GraphUtils';
import Binder from './Binder';
import Cover from './Cover';
import SheetBlock from './SheetBlock';
import SheetPhysics from './SheetPhysics';
import PageManager from './PageManager';
import CSSLayer from 'CSSLayer';
import CssLayersManager from './CssLayersManager';
import SearchEngine from './SearchEngine';
import CustomEventConverter from 'CustomEventConverter';
import CircleTarget from 'targets/CircleTarget';
import YouTubeApi from 'YouTubeApi';

export default class Book extends THREE.EventDispatcher {
  // pageCallback samples

  // (n)=> ({
  //   type: 'image',
  //   src: 'sample.png',
  //   interactive: false
  // });
  //
  // (n)=> ({
  //   type: 'html',
  //   src: 'sample.html',
  //   interactive: true
  // });
  //
  // const pdf = new Pdf('sample.pdf');
  // (n)=> ({
  //   type: 'pdf',
  //   src: pdf,
  //   interactive: false
  // });

  constructor(visual, sheets, pageCallback, props) {
    super();
    this.visual = visual;
    this.mouseController = true;
    this.p = {
      ...this.prepareProps(props),
      sheets,
      pageCallback,
      zoom: 1,
      singlePage: false,
      autoResolution: {
        enable: false,
        k: 1.5
      }
    };
    this.userDirection = {
      lastTopPage: 0,
      direction: 1
    };
    this.pageManager = new PageManager(visual, this, this.p);
    CSSLayer.init(visual.doc);
    this.layerManager = new CssLayersManager(this);
    this.searchEngine = new SearchEngine(pageCallback, 2*(sheets+2));
    this.searchEngine.onPageHitsChanged = (page, query)=> {
      this.pageManager.refreshPageQuery(page, query);
      this.dispatchEvent({
        type: 'searchResults',
        results: this.searchEngine.results,
        lastPage: page,
        query
      });
    };

    this.three = new THREE.Object3D();

    this.binder = new Binder(visual, this.p);
    this.three.add(this.binder.three);

    this.leftCover = new Cover(visual, {...this.p, setTexture: this.setLeftCoverTexture.bind(this)}, Math.PI/2, 'opened');
    this.binder.joinLeftCover(this.leftCover);
    this.subscribeSheetBlock(this.leftCover, 0);
    this.rightCover = new Cover(visual, {...this.p, setTexture: this.setRightCoverTexture.bind(this)}, 0, 'closed');
    this.binder.joinRightCover(this.rightCover);
    this.subscribeSheetBlock(this.rightCover, 2*(this.p.sheets+1));

    this.threeSheetBlocks = new THREE.Object3D();
    this.three.add(this.threeSheetBlocks);
    this.threeSheetBlocks.position.set(0.5*this.p.cover.depth-0.5*sheets*this.p.page.depth,-0.5*sheets*this.p.page.depth,0);

    this.sheetBlocks = [];
    if(sheets>0) {
      this.addSheetBlock(0, new SheetBlock(visual, {...this.p, setTexture: this.setPageTexture.bind(this)}, 0, sheets, 0, 'closed'));
    }

    this.angle = this.p.rtl? Math.PI: 0;
    this.closedAngle = 0;
    this.set(this.angle,0);
    this.lastMousePos = {
      t: 0
    };

    this.pendingPlayers = [];

    this.three.position.set(-0.5*this.p.cover.depth+0.5*sheets*this.p.page.depth,0,0);
    this.sheetPhysics = new SheetPhysics(this.p.page.width/this.p.scale, this.p.gravity, this.p.page.cornerDeviation);

    this.binds = {
      update: this.update.bind(this),
      lastMousePos: (e)=> {
        this.lastMousePos = {
          ...this.lastMousePos,
          pageX: e.pageX,
          pageY: e.pageY
        };
      }
    };
    this.visual.addRenderCallback(this.binds.update);
    $(this.visual.element).on('mousemove', this.binds.lastMousePos);

    this.binds.onPickCallback = this.onPickCallback.bind(this)
    this.visual.drag.onPickCallback = this.binds.onPickCallback;
    this.binds.onDragCallback = this.onDragCallback.bind(this)
    this.visual.drag.onDragCallback = this.binds.onDragCallback;
    this.binds.onReleaseCallback = this.onReleaseCallback.bind(this)
    this.visual.drag.onReleaseCallback = this.binds.onReleaseCallback;

    this.dragAngle = 0.05;
    this.tmp = {
      boxs: [
        new THREE.Box3(),
        new THREE.Box3()
      ]
    };

    this.visual.addObject(this.three);
    this.visual.addEventListener('resize', this.pageManager.refreshZoom.bind(this.pageManager));

    setTimeout(()=> {
      if(!this.isProcessing()) {
        this.notifyBeforeAnimation();
        this.notifyAfterAnimation();
      }
    }, 100);

    this.updateThree();
  }

  dispose() {
    this.visual.removeObject(this.three);
    this.sheetPhysics.dispose();
    delete this.visual.drag.onPickCallback;
    delete this.visual.drag.onDragCallback;
    delete this.visual.drag.onReleaseCallback;
    $(this.visual.element).off('mousemove', this.binds.lastMousePos);
    this.visual.removeRenderCallback(this.binds.update);
    this.removeSheetBlocks(0, this.sheetBlocks.length);
    this.binder.disconnectLeftCover(this.leftCover);
    this.removeSheetBlock(this.leftCover);
    this.binder.disconnectRightCover(this.rightCover);
    this.removeSheetBlock(this.rightCover);
    this.binder.dispose();
    this.layerManager.dispose();
    CSSLayer.dispose();
    this.pageManager.dispose();
  }

  // publics {

  hasPendingPlayers() {
    return this.pendingPlayers.length>0;
  }

  resolvePendingPlayers() {
    for(let p of this.pendingPlayers) {
      p.play();
    }
    this.pendingPlayers = [];
    this.dispatchEvent({
      type: 'pendingPlayers'
    });
  }

  updateThree() {
    this.three.userData.needsUpdate = true;
  }

  setAutoResolution(enable, k=1.5) {
    this.p.autoResolution = {
      ...this.p.autoResolution,
      enable,
      k
    };
  }

  setZoom(zoom, singlePage) {
    if(Math.abs(this.p.zoom-zoom)>1e-3 || singlePage!==this.p.singlePage) {
      this.p.zoom = zoom;
      this.p.singlePage = singlePage;
      this.pageManager.refreshZoom();
    }
  }

  getPageCallback() {
    return this.p.pageCallback;
  }

  setQuery(query) {
    this.searchEngine.setQuery(query);
  }

  isProcessing() {
    return this.sheetPhysics.getSize()!==0;
  }

  getPages() {
    return 4+2*this.p.sheets;
  }

  setFlipProgressClb(clb) {
    this.p.flipProgressClb = clb;
  }

  setInjector(injector) {
    this.p.injector = injector;
  }

  isActivePage(n) {
    let res = true;
    if(n>1 && n<this.getPages()-2) {
      for(let b of this.sheetBlocks) {
        if(n-2>2*b.p.first && n-2<2*b.p.last-1) {
          res = false;
          break
        }
      }
    }
    return res;
  }

  getBlockByPage(n) {
    let block;
    if(n<2) {
      block = this.leftCover;
    }
    else if(n<2*(this.p.sheets+1)) {
      for(let b of this.sheetBlocks) {
        if(n-2>=2*b.p.first && n-2<2*b.p.last) {
          block = b;
          break;
        }
      }
    }
    else {
      block = this.rightCover;
    }
    return block;
  }

  getBlockPages(block) {
    let range;
    switch (block) {
      case this.leftCover: {
          range = [0, 1];
        break;
      }
      case this.rightCover: {
        range = [2*(this.p.sheets+1), 2*(this.p.sheets+1)+1];
        break;
      }
      default: {
        range = block? [2*(block.p.first+1), 2*(block.p.last+1)-1]: undefined;
      }
    }
    return range;
  }

  getPage() {
    const PI = Math.PI;
    let p;
    if(this.angle === PI/2 || this.angle === 3*PI/2) {
      for(let block of this.sheetBlocks) {
        if(block.angle<=PI/2) {
          p = this.getBlockPages(block)[0]-1;
          break;
        }
      }
      if(!p) {
        p = this.getPages()-3;
      }
    }
    else if(this.angle<PI/2) {
      p = 0;
    }
    else if(this.angle>3*PI/2) {
      p = 1;
    }
    else if(this.angle<PI) {
      p = this.getPages()-3;
    }
    else if(this.angle>=PI) {
      p = this.getPages()-1;
    }
    return p;
  }

  getTopPages() {
    const p = this.getPage();
    return p===0 || p===this.getPages()-1? [p]: [p, p+1];
  }

  getPageState(n) {
    return this.pageManager.getPageState(n);
  }

  enableLoadingAnimation(enable) {
    this.pageManager.enableLoadingAnimation(enable);
  }

  getLeftFlipping() {
    let block;
    const left = this.sheetBlocks[0], PI = Math.PI;
    if(this.angle===PI) {
      block = this.rightCover;
    }
    else {
      if(left && left.state==='closed' && left.angle>PI/2) {
        block = left;
      }
      else if(this.angle === PI/2 || this.angle === 3*PI/2) {
        block = this.leftCover;
      }
    }
    return block;
  }

  getRightFlipping() {
    let block;
    const right = this.sheetBlocks[this.sheetBlocks.length-1], PI = Math.PI;
    if(this.angle===0) {
      block = this.leftCover;
    }
    else {
      if(right && right.state==='closed' && right.angle<=PI/2) {
        block = right;
      }
      else if(this.angle===PI/2 || this.angle === 3*PI/2) {
        block = this.rightCover;
      }
    }
    return block;
  }

  getClosedBlockAngle(angle) {
    let closedAngle, {PI} = Math;

    if(this.leftCover.physicId) {
      let test;
      try {
        test = Math.abs(this.sheetPhysics.getParametr(this.leftCover.physicId, 'angle')-angle)
      }
      catch(e) {
        test = 0;
      }
      closedAngle = angle>PI/2 || test>PI/6? PI/2: this.closedAngle;
    }
    else if(this.rightCover.physicId) {
      let test;
      try {
        test = Math.abs(this.sheetPhysics.getParametr(this.rightCover.physicId, 'angle')-angle)
      }
      catch(e) {
        test = 0;
      }
      closedAngle = angle<PI/2 || test>PI/6? PI/2+1e-7: this.closedAngle;
    }
    else {
      closedAngle = PI/2+(angle!==0)*1e-7;
    }

    return {
      openedAngle: angle,
      closedAngle,
      binderTurn: this.closedAngle
    };
  }

  flipLeft(size=1, progressClb=this.p.flipProgressClb) {
    let block, res;
    if(this.sheetPhysics.getSize()<25) {
      const left = this.sheetBlocks[0], PI = Math.PI;
      if(this.angle===PI) {
        res = this.connectPhysics(
          block=this.rightCover,
          this.p.cover.mass,
          PI,
          -this.p.cover.startVelocity,
          this.p.cover.flexibility,
          0,
          (angle,height)=>this.set(3*PI/2-angle/2,height),
          (angle,height)=> {
            this.set(3*PI/2-angle/2,0);
            this.setSheetBlocks(angle? PI: PI/2+1e-7,'closed');
          },
          progressClb
        );
      }
      else {
        if(left && left.state==='closed' && left.angle>PI/2) {
          block = size<left.getSize()? this.splitSheetBlock(0, left.getSize()-size)[1]: left;
          res = this.connectPhysics(
            block,
            this.p.page.mass*block.getSize(),
            PI,
            -this.p.page.startVelocity,
            this.p.page.flexibility,
            0,
            (angle,height)=>block.set(this.getClosedBlockAngle(angle),'opened',height),
            Book.finishAnimationClb.bind({book: this, block}),
            progressClb
          );
        }
        else if(this.angle === PI/2 || this.angle === 3*PI/2) {
          res = this.connectPhysics(
            block=this.leftCover,
            this.p.cover.mass,
            PI,
            -this.p.cover.startVelocity,
            this.p.cover.flexibility,
            0,
            (angle,height)=> {
              this.set(2*PI-angle/2,height);
              if(angle>PI/2) {
                this.setSheetBlocks(angle? PI/2: 0,'closed');
              }
            },
            (angle,height)=> this.set(angle===0? 0: 2*PI-angle/2,0),
            progressClb
          );
        }
      }
    }
    return res;
  }

  flipRight(size=1, progressClb=this.p.flipProgressClb) {
    let block, res;
    if(this.sheetPhysics.getSize()<25) {
      const right = this.sheetBlocks[this.sheetBlocks.length-1], PI = Math.PI;
      if(this.angle===0) {
        res = this.connectPhysics(
          block=this.leftCover,
          this.p.cover.mass,
          0,
          this.p.cover.startVelocity,
          this.p.cover.flexibility,
          0,
          (angle,height)=>this.set(angle/2,height),
          (angle,height)=> {
            this.set(angle/2,0);
            this.setSheetBlocks(angle? PI/2: 0,'closed');
          },
          progressClb
        );
      }
      else {
        if(right && right.state==='closed' && right.angle<=PI/2) {
          block = size<right.getSize()? this.splitSheetBlock(this.sheetBlocks.length-1, size)[0]: right;
          res = this.connectPhysics(
            block,
            this.p.page.mass*block.getSize(),
            0,
            this.p.page.startVelocity,
            this.p.page.flexibility,
            0,
            (angle,height)=>block.set(this.getClosedBlockAngle(angle),'opened',height),
            Book.finishAnimationClb.bind({book: this, block}),
            progressClb
          );
        }
        else if(this.angle===PI/2 || this.angle === 3*PI/2) {
          res = this.connectPhysics(
            block=this.rightCover,
            this.p.cover.mass,
            0,
            this.p.cover.startVelocity,
            this.p.cover.flexibility,
            0,
            (angle,height)=> {
              this.set(PI/2+angle/2,height);
              if(angle<PI/2) {
                this.setSheetBlocks(PI/2+1e-7,'closed');
              }
            },
            (angle,height)=>this.set(PI/2+angle/2,0),
            progressClb
          );
        }
      }
    }
    return res;
  }

  // }

  clearHoverInfo() {
    this.pageManager.turnOnEvents();
    delete this.hoverInfo.block.force;
    delete this.hoverInfo.block.cornerForce;
    delete this.hoverInfo;
  }

  xSegment() {
    const boxs = this.tmp.boxs, res = {};
    if(this.leftCover.physicId) {
      boxs[0].setFromObject(this.rightCover.three);
      res.min = -(res.max = boxs[0].max.x);
    }
    else if(this.rightCover.physicId) {
      boxs[0].setFromObject(this.leftCover.three);
      res.max = -(res.min = boxs[0].min.x);
    }
    else {
      boxs[0].setFromObject(this.leftCover.three);
      boxs[1].setFromObject(this.rightCover.three);
      boxs[0].union(boxs[1]);
      res.min = boxs[0].min.x;
      res.max = boxs[0].max.x;
    }
    return res;
  }

  computeTarget(point) {
    let {x, y} = point, seg = this.xSegment(), angle;
    angle = (seg.max-x)/(seg.max-seg.min)*Math.PI;
    // angle = Math.acos(x/Math.sqrt(x*x+y*y));
    return Math.max(this.dragAngle, Math.min(Math.PI-this.dragAngle, angle));
  }

  onPickCallback(object) {
    let res = false;
    const block = object.object.userData.self,
          p = {...object.uv}, i = object.face.materialIndex;
    if(i<2) {
      p.x = i===0? p.x: 1-p.x;
      if(block.cornerTarget.testIntersection(null, p) && block.physicId) {
        if(this.hoverInfo) {
          this.clearHoverInfo();
        }
        block.force = SheetPhysics.dragForceClb;
        block.cornerForce = SheetPhysics.getDragCornerForceClb(this.computeTarget(object.point));
        this.dragInfo = {
          object,
          block
        };
        res = true;
        this.pageManager.turnOffEvents();
      }
    }
    return res;
  }

  onDragCallback(point) {
    const block = this.dragInfo.block, p = block.getProps();
    block.force = SheetPhysics.dragForceClb;
    block.cornerForce = SheetPhysics.getDragCornerForceClb(this.computeTarget(point));
    return true;
  }

  onReleaseCallback() {
    delete this.dragInfo.block.force;
    delete this.dragInfo.block.cornerForce;
    delete this.dragInfo;
    this.pageManager.turnOnEvents();
  }

  getFlipping(i) {
    return i? this.getLeftFlipping(): this.getRightFlipping();
  }

  flip(i, size=1) {
    return i? this.flipLeft(size): this.flipRight(size);
  }

  enableMouse(enable) {
    this.mouseController = enable;
  }

  cornerCallback(e, data) {
    if(this.mouseController) {
      const {i, n} = data.data;
      if(e.type==='mouseover') {
        if(this.hoverInfo && this.hoverInfo.pendings!==undefined) {
          ++this.hoverInfo.pendings;
        }
        else {
          if(this.hoverInfo) {
            console.warn('Wrong state: element is already hover');
            if(this.hoverInfo.n!==n) {
              this.clearHoverInfo();
            }
          }
          if(!this.hoverInfo && !this.dragInfo) {
            let res = Promise.resolve(undefined);
            const hoverAngle = 0.02,
                  hover = this.getBlockByPage(n),
                  possible = this.getFlipping(i);
            if(n>1 && n<2*(this.p.sheets+1) && hover.physicId && (hover.angle<hoverAngle || hover.angle>Math.PI-hoverAngle)) {
              res = Promise.resolve(hover);
            }
            else if(hover===possible) {
              const sheetBlocks = [
                this.leftCover,
                ...this.sheetBlocks,
                this.rightCover
              ];
              const j = sheetBlocks.indexOf(hover), nextBlock = ~j? sheetBlocks[j+2*i-1]: undefined;
              if(!nextBlock || !nextBlock.physicId || nextBlock.angle>hoverAngle && nextBlock.angle<Math.PI-hoverAngle) {
                res = this.flip(i, 1).then((block)=> {
                  if(!block) {
                    delete this.hoverInfo;
                  }
                  else {
                    this.sheetPhysics.setParametr(block.physicId, 'velocity', 0);
                  }
                  return block;
                });
                this.hoverInfo = {
                  pendings: 1
                };
              }
            }
            res.then((block)=> {
              if(this.hoverInfo && this.hoverInfo.pendings<1) {
                block = undefined;
                delete this.hoverInfo;
              }
              if(block) {
                this.pageManager.turnOffEvents();
                const  p = block.getProps();
                block.force = this.sheetPhysics.getTargetForceClb(p.mass*block.getSize(), i? Math.PI-hoverAngle: hoverAngle);
                block.cornerForce = ()=> (i? -1: 1)*SheetPhysics.hoverCornerForceClb();
                this.sheetPhysics.setParametr(block.physicId, 'angle', i? Math.PI-0.5*hoverAngle: 0.5*hoverAngle);
                this.hoverInfo = {
                  n,
                  block
                };
                this.update(1/30);
              }
            });
          }
        }

      }
      else if(this.hoverInfo && e.type==='mouseout') {
        if(this.hoverInfo.pendings!==undefined) {
          --this.hoverInfo.pendings;
        }
        else if(n===this.hoverInfo.n) {
          this.clearHoverInfo();
        }
      }
      else if(e.type==='mousedown') {
        this.cornerClickData = {
          x: e.pageX,
          y: e.pageY
        };
      }
      else if(e.type==='click') {
        if(Math.sqrt(Math.pow(this.cornerClickData.x-e.pageX,2)+Math.pow(this.cornerClickData.y-e.pageY,2))<5) {
          const hover = this.getBlockByPage(n);
          if(hover.physicId) {
            const id = hover.physicId,
                  props = hover.getProps();
            this.sheetPhysics.setParametr(id, 'velocity', (i? -1: 1)*props.startVelocity);
          }
        }
        delete this.cornerClickData;
      }
    }
  }

  addSheetBlock(p, block) {
    this.sheetBlocks.splice(p, 0, block);
    this.subscribeSheetBlock(block, 2);
    this.threeSheetBlocks.add(block.three);
  }

  subscribeSheetBlock(block, offset) {
    const eventConverter = new CustomEventConverter(this.visual.wnd, this.visual.doc, CircleTarget.test),
          r = 0.15,
          target = new CircleTarget(1-0.5*r, 0.5*r, r);
    target.block = block;
    target.callback = this.cornerCallback.bind(this);
    eventConverter.addCustom(target);
    block.cornerTarget = target;
    block.three.userData.mouseCallback = (e, data)=> {
      const i = data.face.materialIndex;
      if(i<2) {
        const n = i===0? offset+2*block.p.first: offset+2*block.p.last-1;
        eventConverter.convert(e, {x: i===0? data.uv.x: 1-data.uv.x, y: data.uv.y, i, n});
        this.pageManager.transferEventToTexture(n, e, data);
      }
    };
    block.three.userData.touchCallback = (e, data)=> {
      const i = data.face.materialIndex;
      if(i<2) {
        const n = i===0? offset+2*block.p.first: offset+2*block.p.last-1;
        this.pageManager.transferEventToTexture(n, e, data);
      }
    };
    this.visual.drag.addThree(block.three);
    this.visual.mouseEvents.addThree(block.three);
    this.visual.touchEvents.addThree(block.three);
  }

  removeSheetBlock(block) {
    this.visual.mouseEvents.removeThree(block.three);
    this.visual.touchEvents.removeThree(block.three);
    this.visual.drag.removeThree(block.three);
    this.threeSheetBlocks.remove(block.three);
    block.dispose();
  }

  removeSheetBlocks(first, size) {
    const blocks = this.sheetBlocks.splice(first, size);
    for(let block of blocks) {
      this.removeSheetBlock(block);
    }
  }

  setTexture(material, n) {
    this.pageManager.setTexture(material, n);
  }

  setPageTexture(material, n) {
    this.setTexture(material, n+2);
  }

  setLeftCoverTexture(material, n) {
    this.setTexture(material, n);
  }

  setRightCoverTexture(material, n) {
    this.setTexture(material, n+2*(this.p.sheets+1));
  }

  static finishAnimationClb(angle) {
    this.block.set(this.book.getClosedBlockAngle(angle).closedAngle,'closed',0);
    const i = this.book.sheetBlocks.indexOf(this.block);
    if(~i) {
      if(angle===0) {
        this.book.mergeSheetBlocks(i, this.book.sheetBlocks.length-i);
      }
      else {
        this.book.mergeSheetBlocks(0, i+1);
      }
    }
  }

  calcBlockForce(block, object, angle, velocity, cornerHeight) {
    return block.force? block.force(object, angle, velocity, cornerHeight): 0;
  }

  calcBlockCornerForce(block, object, angle, velocity, cornerHeight) {
    return block.cornerForce? block.cornerForce(object, angle, velocity, cornerHeight): 0;
  }

  notifyBeforeAnimation() {
    let res;
    if(this.animationNotification) {
      res = Promise.reject();
    }
    else {
      this.animationNotification = true;
      this.dispatchEvent({
        type: 'beforeAnimation'
      });
      res = this.layerManager.hide();
    }
    return res;
  }

  notifyAfterAnimation() {
    if(this.animationNotification) {
      const p = this.getPage();
      if(this.userDirection.lastTopPage!==p) {
        this.userDirection.direction = Math.sign(p-this.userDirection.lastTopPage);
        this.userDirection.lastTopPage = p;
      }
      delete this.animationNotification;
      this.layerManager.show();
      this.dispatchEvent({
        type: 'afterAnimation'
      });
    }
  }

  getUserDirection() {
    return this.userDirection;
  }

  connectPhysics(block, mass, angle, velocity, flexibility, coverHeight, simulateClb, removeClb, progressClb) {
    const type = ()=> this.hoverInfo? 'hover': (this.dragInfo? 'drag': 'free'),
      res = this.sheetPhysics.getSize()? Promise.resolve(): this.notifyBeforeAnimation();
    return res.then(()=> {
      block.physicId = this.sheetPhysics.addObject(
        mass,
        angle,
        velocity,
        flexibility,
        coverHeight,
        (angl, ch)=> {
          simulateClb(angl, ch);
          progressClb(block, Math.abs(angle-angl)/Math.PI, 'process', type());
          this.updateThree();
        },
        (angl, ch)=> {
          removeClb(angl, ch);
          delete block.physicId;
          progressClb(block, Math.abs(angle-angl)/Math.PI, 'finish', type());
          Promise.resolve().then(()=> {
            if(!this.sheetPhysics.getSize()) {
              this.notifyAfterAnimation();
            }
          });
          this.updateThree();
        },
        (object, angle, velocity, cornerHeight)=> this.calcBlockForce(block, object, angle, velocity, cornerHeight),
        (object, angle, velocity, cornerHeight)=> this.calcBlockCornerForce(block, object, angle, velocity, cornerHeight)
      );
      progressClb(block, 0, 'init', type());
      return block;
    }).catch(()=> undefined);
  }

  update(dt) {
    this.lastMousePos.t+=dt;
    if(this.isProcessing() && this.lastMousePos.pageX!==undefined && this.lastMousePos.t-(this.lastMousePos.lastT || 0)>0.25 && !this.hoverInfo && !this.dragInfo) {
      this.lastMousePos.lastT = this.lastMousePos.t;
      Promise.resolve().then(()=> {
        $(this.visual.element).trigger($.Event('mousemove', this.lastMousePos));
      });
    }
    this.sheetPhysics.simulate(dt);
  }

  splitSheetBlock(i, leftSize) {
    const block = this.sheetBlocks[i];
    if(block && leftSize<block.getSize()) {
      const newBlock = new SheetBlock(this.visual, {...this.p, setTexture: this.setPageTexture.bind(this)}, block.p.first, block.p.first+leftSize, block.angle, block.state);
      block.set(block.angle, block.state, block.corner.height, block.p.first+leftSize, block.p.last);
      this.addSheetBlock(i, newBlock);
      return [newBlock, block];
    }
  }

  mergeSheetBlocks(first, size) {
    if(first<this.sheetBlocks.length) {
      size = Math.min(this.sheetBlocks.length-first, size);
      const firstBlock = this.sheetBlocks[first], lastBlock = this.sheetBlocks[first+size-1];
      firstBlock.set(firstBlock.angle, firstBlock.state, firstBlock.corner.height, firstBlock.p.first, lastBlock.p.last);
      this.removeSheetBlocks(first+1, size-1);
    }
  }

  setSheetBlocks(angle, state) {
    if(state==='closed') {
      this.closedAngle = angle;
    }
    this.sheetBlocks.forEach((s)=> {
      if(!s.physicId) {
        s.set(angle, state);
      }
    });
  }

  set(angle, height=0) {
    this.angle = angle;
    const PI = Math.PI;
    if(angle<PI/4) {
      this.binder.set(0);

      this.binder.setLeft(-PI/2+2*angle);
      this.leftCover.set(PI/2,'opened',height);

      this.setSheetBlocks(0,'closed');

      this.binder.setRight(0);
      this.rightCover.set(0,'closed',0);
    }
    else if(angle<2*PI/4) {
      const a=2*(angle-PI/4);
      this.binder.set(a);

      this.binder.setLeft(-a);
      this.leftCover.set(PI/2+a,'opened',height);

      this.setSheetBlocks(a,'closed');

      this.binder.setRight(-a);
      this.rightCover.set(a,'closed',0);
    }
    else if(angle<3*PI/4) {
      const a=2*(angle-PI/2);
      this.binder.set(PI/2);

      this.binder.setLeft(-PI/2);
      this.leftCover.set(PI,'opened',0);

      this.binder.setRight(-PI/2);
      this.rightCover.set(a,'opened',height);
    }
    else if(angle<4*PI/4) {
      const a=2*(angle-3*PI/4)+PI/2;
      this.binder.set(a);

      this.binder.setLeft(-a);
      this.leftCover.set(a,'closed',0);

      this.setSheetBlocks(a,'closed');

      this.binder.setRight(-PI/2);
      this.rightCover.set(PI/2,'opened',height);
    }
    else if(angle<5*PI/4) {
      this.binder.set(PI);

      this.binder.setLeft(-PI);
      this.leftCover.set(PI,'closed',0);

      this.setSheetBlocks(PI,'closed');

      this.binder.setRight(-PI/2-2*(angle-PI));
      this.rightCover.set(PI/2,'opened',height);
    }
    else if(angle<6*PI/4) {
      const a=2*(angle-5*PI/4);
      this.binder.set(PI-a);

      this.binder.setLeft(-PI+a);
      this.leftCover.set(PI-a,'closed',0);

      this.setSheetBlocks(PI-a,'closed');

      this.binder.setRight(-PI+a);
      this.rightCover.set(PI/2-a,'opened',height);
    }
    else if(angle<7*PI/4) {
      const a=2*(angle-6*PI/4);
      this.binder.set(PI/2);

      this.binder.setLeft(-PI/2);
      this.leftCover.set(PI-a,'opened',height);

      this.binder.setRight(-PI/2);
      this.rightCover.set(0,'opened',0);
    }
    else if(angle<8*PI/4) {
      const a=2*(angle-7*PI/4);
      this.binder.set(PI/2-a);

      this.binder.setLeft(-PI/2);
      this.leftCover.set(PI/2,'opened',height);

      this.setSheetBlocks(PI/2-a,'closed');

      this.binder.setRight(-PI/2+a);
      this.rightCover.set(PI/2-a,'closed',0);
    }
  }

  static createSideTexture(color, type) {
    const jC = $('<canvas width="8" height="8"></canvas>');
    if(type==='color') {
      const ctx = jC[0].getContext('2d');
      ctx.beginPath();
      ctx.fillStyle = GraphUtils.color2Rgba(color, 1);
      ctx.rect(0, 0, 8, 7);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = GraphUtils.color2Rgba(GraphUtils.inverseColor(color,0.5), 1);
      ctx.rect(0, 7, 8, 1);
      ctx.fill();
    }
    return jC[0];
  }

  prepareProps(props) {
    return this.calcProps(Book.mergeProps(bookProps(), props));
  }

  static mergeProps(first, second) {
    second = second || {};
    return {
      ...first,
      ...second,
      sheet: {
        ...first.sheet,
        ...second.sheet,
      },
      cover: {
        ...first.cover,
        ...second.cover,
      },
      page: {
        ...first.page,
        ...second.page,
      },
      cssLayerProps: {
        ...first.cssLayerProps,
        ...second.cssLayerProps,
      }
    };
  }

  calcProps(props) {
    const p = {
      ...props,
      sheet: {
        ...props.sheet
      },
      cover: {
        ...props.sheet,
        ...props.cover
      },
      page: {
        ...props.sheet,
        ...props.page
      },
      cssLayerProps: {
        ...props.cssLayerProps,
        $
      }
    },
    scale = 10,
    height = scale*p.height,
    width = scale*p.width,
    flipProgressClb = ()=> undefined,
    sheet = {
      sideTexture: p.sheet.sideTexture || Book.createSideTexture(p.sheet.color, p.sheet.side),
    },
    cover = {
      ...sheet,
      ...p.cover,
      depth: scale*p.cover.depth,
      width: width,
      height: height,
      padding: scale*p.cover.padding
    },
    page = {
      ...sheet,
      ...p.page,
      depth: scale*p.page.depth,
      width: cover.width - cover.padding,
      height: cover.height - 2*cover.padding
    },
    marker = {
      use: false,
      color: 0XFF0000,
      size: scale*0.001
    };
    if(cover.color!==sheet.color && !p.cover.sideTexture) {
      cover.sideTexture = Book.createSideTexture(cover.color, cover.side);
    }
    if(page.color!==sheet.color && !p.page.sideTexture) {
      page.sideTexture = Book.createSideTexture(page.color, page.side);
    }
    if(p.cssLayersLoader) {
      p.cssLayersLoader = this.cssLayersLoader(p.cssLayersLoader);
    }
    return {...p, scale, height, width, flipProgressClb, cover, page, marker};
  }

  cssLayersLoader(loader) {
    return (n, clb)=> {
      return loader(n, (ls)=> {
        const nls = [];
        for(let l of ls) {
          nls.push({
            ...l,
            js: this.cssLayerJsObject(l)
          });
        }
        return clb(nls);
      });
    };
  }

  cssLayerJsObject(l) {
    const clIfEx = (f)=> {
      let r;
      if(f) {
        try {
          r = f();
        }
        catch(e) {
          console.error(e);
        }
      }
      return r;
    };
    return (c, p)=> {
      let o = {};
      try {
        const init = eval(l.js);
        o = init? init(c, p) || {}: {};
      }
      catch(e) {
        console.error(e);
      }
      const no = this.cssLayerJsObjectInit(c,  p), ro = {};
      for(let n of ['hide', 'hidden', 'show', 'shown', 'dispose']) {
        ro[n] = ()=> {
          clIfEx(no[n]);
          clIfEx(o[n]);
        };
      }
      return ro;
    };
  }

  cssLayerJsObjectInit(c, p) {
    c.find('.go-to-page').on('click', (e)=> {
      let n = $(e.target);
      while(n.length && !n.hasClass('go-to-page')) {
        n = $(n[0].parentNode);
      }
      n = parseInt(n.attr('data-number'));
      if(!isNaN(n)) {
        e.preventDefault();
        p.scene.ctrl.goToPage(n-1);
      }
    });
    const ys = c.find('.youtube');
    if(ys.length) {
      ys.html('<div style="width:100%;height:100%;"></div>');
      YouTubeApi.init().then(()=> {
        for(let i=0; i<ys.length; ++i) {
          let y = ys[i];
          const n = $(y), player = new YT.Player(n.find('div')[0], {videoId: n.attr('data-id')});
          n[0].player = player;
        }
      });
    }
    return {
      hide: ()=> {
        if(this.pendingPlayers.length) {
          this.pendingPlayers = [];
          this.dispatchEvent({
            type: 'pendingPlayers'
          });
        }
        c.find('.pause-on-hide').each((_, p)=> this.cssFs.pause(p));
      },
      shown: ()=> c.find('.play-on-shown').each((_, p)=> this.cssFs.play(p)),
      dispose: ()=> c.find('.pause-on-hide').each((_, p)=> this.cssFs.pause(p))
    };
  }

  cssFs = {
    play: (player)=> {
      if(player.play) {
        player.fb3dNoPlay = false;
        (player.play()||{catch: ()=> undefined}).catch((e)=> {
          if(!player.fb3dNoPlay && e.name==='NotAllowedError') {
            this.pendingPlayers.push(player);
            this.dispatchEvent({
              type: 'pendingPlayers'
            });
          }
        });
      }
      else if($(player).hasClass('youtube')) {
        const p = player.player;
        player.fb3dNoPlay = false;
        if(p && p.playVideo) {
          p.playVideo();
        }
        else {
          setTimeout(()=> {
            if(!player.fb3dNoPlay) {
              this.cssFs.play(player);
            }
          }, 200);
        }
      }
    },
    pause: (player)=> {
      if(player.pause) {
        player.fb3dNoPlay = true;
        player.pause();
      }
      else if($(player).hasClass('youtube')) {
        const p = player.player;
        player.fb3dNoPlay = true;
        if(p && p.pauseVideo) {
          p.pauseVideo();
        }
      }
    }
  };

}
