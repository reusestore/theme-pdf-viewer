import {THREE} from '../libs';
import ThreeUtils from 'ThreeUtils';

const resX = 11,
      resY = 2,
      resZ = 15,
      scale = 1,
      faces = [];

const frontGeometry = new THREE.PlaneGeometry(scale, scale, resX-1, resY-1);
frontGeometry.translate(0.5*scale,0.5*scale,scale);
const backGeometry = new THREE.PlaneGeometry(scale, scale, resX-1, resY-1);
backGeometry.rotateY(Math.PI);
backGeometry.translate(0.5*scale,0.5*scale,0);
const leftGeometry = new THREE.PlaneGeometry(scale, scale, resZ-1, resY-1);
leftGeometry.rotateY(-Math.PI/2);
leftGeometry.translate(0,0.5*scale,0.5*scale);
const rightGeometry = new THREE.PlaneGeometry(scale, scale, resZ-1, resY-1);
rightGeometry.rotateY(Math.PI/2);
rightGeometry.translate(scale,0.5*scale,0.5*scale);
const topGeometry = new THREE.PlaneGeometry(scale, scale, resX-1, resZ-1);
topGeometry.rotateX(-Math.PI/2);
topGeometry.translate(0.5*scale,scale,0.5*scale);
const bottomGeometry = topGeometry.clone();
bottomGeometry.translate(0,-scale,0);
for(let f of bottomGeometry.faces) {
  [f.a, f.b] = [f.b, f.a];
}

const geometry = new THREE.Geometry();
geometry.vertices = [...bottomGeometry.vertices, ...topGeometry.vertices];

const addFaces = (fs, map)=> {
  for(let f of fs) {
    geometry.faces.push(new THREE.Face3(map(f.a), map(f.b), map(f.c)));
  }
  faces.push(geometry.faces.length);
};

const mapVertices = (src, dst)=> {
  const map = [];
  const eq = (a, b)=> Math.abs(a.x-b.x)+Math.abs(a.y-b.y)+Math.abs(a.z-b.z)<1e-4;
  for(let i=0; i<src.length; ++i) {
    for(let j=0; j<dst.length; ++j) {
      if(eq(src[i], dst[j])) {
        map[i]=j;
        break;
      }
    }
  }
  return map;
};

const frontMap = mapVertices(frontGeometry.vertices, geometry.vertices);
const backMap = mapVertices(backGeometry.vertices, geometry.vertices);
const leftMap = mapVertices(leftGeometry.vertices, geometry.vertices);
const rightMap = mapVertices(rightGeometry.vertices, geometry.vertices);

addFaces(topGeometry.faces, (i)=> i+bottomGeometry.vertices.length);
addFaces(bottomGeometry.faces, (i)=> i);
addFaces(frontGeometry.faces, (i)=> frontMap[i]);
addFaces(backGeometry.faces, (i)=> backMap[i]);
addFaces(leftGeometry.faces, (i)=> leftMap[i]);
addFaces(rightGeometry.faces, (i)=> rightMap[i]);
faces.pop();

ThreeUtils.computeFaceVertexUvs(geometry, faces);

geometry.computeVertexNormals();
//geometry.computeFaceNormals();
geometry.computeBoundingSphere();
//geometry.computeBoundingBox();
geometry.verticesNeedUpdate = true;

export default {
	resX,
	resY,
	resZ,
	faces,
	geometry
};
