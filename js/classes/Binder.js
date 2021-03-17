import {THREE} from '../libs';
import MathUtils from 'MathUtils'

export default class Binder {

  constructor(visual, p) {
    this.visual = visual;
    this.p = {
      ...p,
      backSize: 2*p.cover.depth+p.sheets*p.page.depth
    };
    this.OZ = new THREE.Vector3(0,0,1);

    this.backG = new THREE.BoxGeometry(p.cover.depth, this.p.backSize, p.cover.height);

    const color = this.p.cover.side==='color'? {color: p.cover.color}: {
      color: p.cover.color,
      opacity: 0,
      transparent: true
    };

    this.materials = [
                      new THREE.MeshPhongMaterial(color),
                      new THREE.MeshPhongMaterial(color),
                      new THREE.MeshPhongMaterial(color),
                      new THREE.MeshPhongMaterial(color),
                      new THREE.MeshPhongMaterial(color),
                      new THREE.MeshPhongMaterial(color)
                     ];

    const backM = new THREE.Mesh(this.backG, this.materials);

    if(p.cover.binderTexture!=='') {
      this.visual.textureLoader.load(p.cover.binderTexture, (texture)=> {
        this.materials[1].color.setHex(0xFFFFFF);
        this.materials[1].map = texture;
        texture.minFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        this.materials[1].needsUpdate = true;
      });
    }

    this.three = new THREE.Object3D();
    this.back = new THREE.Object3D();
    this.backRT = new THREE.Object3D();
    this.backRR = new THREE.Object3D();
    this.backLT = new THREE.Object3D();
    this.backLR = new THREE.Object3D();
    this.leftPivot = new THREE.Object3D();
    this.rightPivot = new THREE.Object3D();

    this.back.add(backM);
    this.back.add(this.leftPivot);
    this.back.add(this.rightPivot);
    this.backRT.add(this.back);
    this.backRR.add(this.backRT);
    this.backLT.add(this.backRR);
    this.backLR.add(this.backLT);
    this.three.add(this.backLR);
  }

  dispose() {
    for(let m of this.materials) {
      if(m.map) {
        m.map = null;
        m.needsUpdate = true;
      }
      m.dispose();
    }
    delete this.materials;
    this.backG.dispose();
  }

  set(angle) {
    let right, left;
    if(angle>Math.PI/2) {
      right = Math.PI/2;
      left = angle-Math.PI/2;
    }
    else {
      right = angle;
      left = 0;
    }
    const p = this.p,tr1={x:-0.5*p.cover.depth,y:0.5*p.backSize-p.cover.depth};
    this.backRT.position.set(tr1.x,tr1.y,0);
    this.backRR.position.set(-tr1.x,-tr1.y,0);
    this.backRR.quaternion.setFromAxisAngle(this.OZ, right);

    const tr2={x:p.backSize-2*p.cover.depth-0.5*p.cover.depth,y:0.5*p.backSize-p.cover.depth};
    this.backLT.position.set(tr2.x,tr2.y,0);
    this.backLR.position.set(-tr2.x,-tr2.y,0);
    this.backLR.quaternion.setFromAxisAngle(this.OZ, left);
  }

  setLeft(angle) {
    const PI = Math.PI;
    this.leftPivot.position.set(MathUtils.interpolateLinear([-PI,-PI/2],[0,this.p.cover.depth],angle),0.5*this.p.backSize-0.5*this.p.cover.depth,0);
    this.leftPivot.quaternion.setFromAxisAngle(this.OZ, angle);
  }

  setRight(angle) {
    const PI = Math.PI;
      this.rightPivot.position.set(MathUtils.interpolateLinear([-PI/2,0],[this.p.cover.depth,0],angle),-0.5*this.p.backSize+0.5*this.p.cover.depth,0);
      this.rightPivot.quaternion.setFromAxisAngle(this.OZ, angle);
  }

  joinLeftCover(cover) {
    cover.three.position.set(0,-0.5*this.p.cover.depth,0);
    this.leftPivot.add(cover.three);
  }

  disconnectLeftCover(cover) {
    this.leftPivot.remove(cover.three);
  }

  joinRightCover(cover) {
    cover.three.position.set(0,-0.5*this.p.cover.depth,0);
    this.rightPivot.add(cover.three);
  }

  disconnectRightCover(cover) {
    this.rightPivot.remove(cover.three);
  }


}
