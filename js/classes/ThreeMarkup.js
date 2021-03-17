import {THREE} from '../libs';
import sheetBlock from '../models/sheetBlock';
import MathUtils from 'MathUtils';
import ThreeUtils from 'ThreeUtils';
import Delaunay from 'Delaunay';

export default class ThreeMarkup {

  constructor(block, side, poly, props) {
    const poly0 = poly;
    this.ivs = ThreeUtils.findInternalVertices(block.geometry, poly, block.p.sideFaces[side].first, block.p.sideFaces[side].last);
    poly = MathUtils.refinePoly(poly, 1/Math.max(sheetBlock.resX, sheetBlock.resZ));
    this.block = block;
    const geometry = new THREE.Geometry();
    this.geometry = geometry;
    this.polyFaces = ThreeUtils.findUvTris(block.geometry, poly, block.p.sideFaces[side].first, block.p.sideFaces[side].last);

    for(let iv of this.ivs) {
      poly.push(iv.p);
    }
    geometry.vertices = [];
    for(let i=0; i<poly.length; ++i) {
      geometry.vertices.push(new THREE.Vector3());
    }

    const dTri = Delaunay.triangulate(poly.map((p)=> [p.x, p.y]));
    for(let i=0; i<dTri.length; i+=3) {
      if(!THREE.ShapeUtils.isClockWise([poly[dTri[i+0]],poly[dTri[i+1]],poly[dTri[i+2]]])) {
        geometry.faces.push(new THREE.Face3(dTri[i+0], dTri[i+1], dTri[i+2]));
      }
      else {
        geometry.faces.push(new THREE.Face3(dTri[i+0], dTri[i+2], dTri[i+1]));
      }
    }

    this.computeVertices();
    const material = new THREE.MeshBasicMaterial({color: 0x00ff00, transparent: true, opacity: 0.5});
    this.three = new THREE.Mesh(geometry, material);
    block.three.add(this.three);
  }

  computeVertices() {
    const blGm = this.block.geometry , scale = this.block.p.scale*0.001;
    for(let i= 0; i<this.polyFaces.length; ++i) {
      const f = blGm.faces[this.polyFaces[i].i], {coefs} = this.polyFaces[i];
      const v = [blGm.vertices[f.a], blGm.vertices[f.b], blGm.vertices[f.c]], n = {
        x: coefs[0]*f.vertexNormals[0].x+coefs[1]*f.vertexNormals[1].x+coefs[2]*f.vertexNormals[2].x,
        y: coefs[0]*f.vertexNormals[0].y+coefs[1]*f.vertexNormals[1].y+coefs[2]*f.vertexNormals[2].y,
        z: coefs[0]*f.vertexNormals[0].z+coefs[1]*f.vertexNormals[1].z+coefs[2]*f.vertexNormals[2].z
      };
      this.geometry.vertices[i].set(
        coefs[0]*v[0].x+coefs[1]*v[1].x+coefs[2]*v[2].x+scale*n.x,
        coefs[0]*v[0].y+coefs[1]*v[1].y+coefs[2]*v[2].y+scale*n.y,
        coefs[0]*v[0].z+coefs[1]*v[1].z+coefs[2]*v[2].z+scale*n.z
      );
    }
    for(let i=this.polyFaces.length, j=0; j<this.ivs.length; ++i, ++j) {
      const v = blGm.vertices[this.ivs[j].i], n = this.ivs[j].n;
      this.geometry.vertices[i].set(
        v.x+scale*n.x,
        v.y+scale*n.y,
        v.z+scale*n.z
      );
    }
    this.geometry.computeVertexNormals();
    //this.geometry.computeFaceNormals();
    this.geometry.computeBoundingSphere();
    //this.geometry.computeBoundingBox();
    this.geometry.verticesNeedUpdate = true;
  }

}
