import {THREE} from '../libs';
import sheetBlock from '../models/sheetBlock';
import MathUtils from 'MathUtils';
import ThreeUtils from 'ThreeUtils';
// import ThreeMarkup from './ThreeMarkup';

export default class SheetBlock {

  constructor(visual, p, first, last, angle=0, state='closed', height=0) {
    this.visual = visual;
    this.p = {
      ...p,
      first,
      last
    };
    const props = this.getProps();

    const loadedPoints = this.loadPoints();
    Object.keys(loadedPoints).map((k)=> {
      this[k] = loadedPoints[k][props.shape] || loadedPoints[k][0];
    });

    this.pSpline = new THREE.CatmullRomCurve3([]);
    for(let i=0; i<this.interpolationPoints.x[0].length; ++i) {
    	this.pSpline.points.push(new THREE.Vector3());
    }

    this.iSpline = new THREE.CatmullRomCurve3([]);
    for(let i=0; i<sheetBlock.resX; ++i) {
    	this.iSpline.points.push(new THREE.Vector3());
    }

    this.aSplines = [];

    //this.three = new THREE.Object3D();

    this.geometry = sheetBlock.geometry.clone();

    this.p.sideFaces = [{
        first: 0,
        last: sheetBlock.faces[0]
      }, {
        first: sheetBlock.faces[0],
        last: sheetBlock.faces[1]
      }
    ];

    this.sideTexture = new THREE.Texture();
    this.sideTexture.wrapT = THREE.RepeatWrapping;
    this.sideTexture.repeat.set(0, last-first);
    this.sideTexture.image = props.sideTexture;
    this.sideTexture.needsUpdate = true;

    this.materials = [
                    new THREE.MeshPhongMaterial(),
                    new THREE.MeshPhongMaterial(),
                    new THREE.MeshPhongMaterial({map: this.sideTexture}),
                    new THREE.MeshPhongMaterial({map: this.sideTexture}),
                    new THREE.MeshPhongMaterial({map: this.sideTexture}),
                    new THREE.MeshPhongMaterial({map: this.sideTexture})
                  ];

    this.p.setTexture(this.materials[0], 2*first);
    this.p.setTexture(this.materials[1], 2*last-1);

    this.mesh = new THREE.Mesh(this.geometry, this.materials);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    // this.mesh.frustumCulled = true;

    //this.three.add(this.mesh);
    this.three = this.mesh;
    this.three.userData.self = this;

    this.markers = [];
    if(this.p.marker.use) {
      const l=this.geometry.vertices.length;
      let is;
      // is = [0, sheetBlock.resX-1, (sheetBlock.resZ-1)*sheetBlock.resX, sheetBlock.resZ*sheetBlock.resX-1];
      is = Array.apply(0, Array(l)).map((_, i)=> i);

      for(let i of is) {
        const marker = ThreeUtils.createMarker(this.geometry.vertices[i], i<l/2?0xFF0000:0x00FF00, this.p.marker.size);
        this.markers.push({
          marker,
          vertex: i
        });
        this.three.add(marker);
      }
    }

    this.corner = {
      use: true,
      height: 0,
      maxDistance: 0,
      points: [],
      OZ: new THREE.Vector3(0,0,1),
      axis: new THREE.Vector3()
    };
    this.set(0, 'closed', height, first, last); // calculate corner points

    this.set(angle, state, height, first, last); // init position

    // if(!SheetBlock.markup) {
    //   SheetBlock.markup=true;
    //   this.markup = new ThreeMarkup(this, 0, [{
    //     x: 0,
    //     y: 0,
    //   }, {
    //     x: 0.5,
    //     y: 1
    //   }, {
    //     x: 1,
    //     y: 0
    //   }].map((p)=>new THREE.Vector2(p.x, p.y)), {});
    // }

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
    this.geometry.dispose();
  }

  getSize() {
    return this.p.last-this.p.first;
  }

  getProps() {
    return {
      ...this.p.page,
      sheets: this.p.sheets
    };
  }

  getTopCerners() {
    const off = this.angle>Math.PI/2? this.geometry.vertices.length/2: 0;
    return [
        this.geometry.vertices[off],
        this.geometry.vertices[sheetBlock.resX-1+off],
        this.geometry.vertices[(sheetBlock.resZ-1)*sheetBlock.resX+off],
        this.geometry.vertices[sheetBlock.resZ*sheetBlock.resX-1+off]
      ];
  }

  getTopSize() {
    // const l=this.geometry.vertices.length, off = this.angle>Math.PI/2? l/2: 0,
    //   v0 = this.geometry.vertices[off], v1 = this.geometry.vertices[sheetBlock.resZ*sheetBlock.resX-1+off];
    // // is = [0, sheetBlock.resX-1, (sheetBlock.resZ-1)*sheetBlock.resX, sheetBlock.resZ*sheetBlock.resX-1];
    // return {
    //   width: Math.abs(v1.x-v0.x),
    //   height: Math.abs(v1.z-v0.z)
    // };
    const vs = this.getTopCerners();
    return {
      width: vs[0].distanceTo(vs[1]),
      height: vs[0].distanceTo(vs[2])
    };
  }

  getTopWorldRotation(q) {
    q.x = -Math.PI/2;
    return q;
  }

  getTopWorldPosition(v) {
    const l=this.geometry.vertices.length, off = this.angle>Math.PI/2? l/2: 0, vs = [
        this.geometry.vertices[off],
        this.geometry.vertices[sheetBlock.resX-1+off],
        this.geometry.vertices[(sheetBlock.resZ-1)*sheetBlock.resX+off],
        this.geometry.vertices[sheetBlock.resZ*sheetBlock.resX-1+off]
      ];
    v.set(0, 0, 0);
    for(let vi of vs) {
      v.x += 0.25*vi.x;
      v.y += 0.25*vi.y;
      v.z += 0.25*vi.z;
    }
    this.three.localToWorld(v);
    return v;
  }

  getInterpolationPoints(inds, mod) {
    const ps = {x: [], y: []}, K = this.getProps().wave;
    for(let i of inds) {
      ps.x.push([...this.interpolationPoints.x[i]]);
      ps.y.push(~mod.indexOf(i)? this.interpolationPoints.y[i].map((n)=> K*n): [...this.interpolationPoints.y[i]]);
    }
    return ps;
  }

  set(angle, state=this.state, height=this.corner.height, first=this.p.first, last=this.p.last) {
    const PI = Math.PI;
    this.state = state;
    let closedAngle, binderTurn;
    if(typeof angle==='object') {
      this.angle = angle.openedAngle;
      closedAngle = angle.closedAngle;
      binderTurn = angle.binderTurn>PI/2?PI-angle.binderTurn:angle.binderTurn;
    }
    else {
      this.angle = angle;
    }
    this.corner.height = height;
    if(this.p.first!==first || this.p.last!==last) {
      this.sideTexture.repeat.set(0, last-first);
      this.sideTexture.needsUpdate = true;
      if(this.p.first!==first) {
        this.p.setTexture(this.materials[0], 2*first);
      }
      if(this.p.last!==last) {
        this.p.setTexture(this.materials[1], 2*last-1);
      }
    }
    this.p.first = first;
    this.p.last = last;
    let points;
    const props = this.getProps();
    if(this.state === 'closed') {
      points = this.getInterpolationPoints(this.closedInterpolationIndeces, this.closedInterpolationIndeces);
    }
    else if(this.state === 'opened') {
      if(closedAngle!==undefined && Math.abs(closedAngle-PI/2)>1e-2) {
        points = this.getInterpolationPoints(this.flatInterpolationIndeces, []);
        const ps = this.getPointsAtAngle(this.getInterpolationPoints(this.closedInterpolationIndeces, this.closedInterpolationIndeces), closedAngle>PI/2?PI-closedAngle:closedAngle);
        points.x = [ps.x,...points.x];
        points.y = [ps.y,...points.y];
        // console.log(ps);
      }
      else {
        points = this.getInterpolationPoints(this.openedInterpolationIndeces, this.closedInterpolationIndeces);
      }
    }
    let hl, hr, offset = 0.5*props.sheets*props.depth;
    if(this.state==='closed') {
      offset -= 7e-6*this.p.scale;
    }
    if(this.angle<=PI/2) {
      hl = (props.sheets-first)*props.depth;
      hr = (props.sheets-last)*props.depth;
    }
    else {
      hl = first*props.depth;
      hr = last*props.depth;
    }

    const inAngle = this.angle>PI/2?PI-this.angle:this.angle, hAngle = this.state === 'closed'? inAngle: (binderTurn===undefined? PI/2: binderTurn);
    const [left, right] = this.getPointsAtAngleAndHs(points, inAngle, hAngle, [hl/props.width, hr/props.width]);
    if(this.angle>PI/2) {
      this.inverse(left);
      this.inverse(right);
      offset = -offset;
    }
    this.setPoints(left, right, offset);
  }

  setPoints(left, right, offset) {
    const p = this.getProps();
    let i = 0;

    const ys = [right, left];
    for(let y = 0; y<sheetBlock.resY; ++y) {
      for(let z = 0; z<sheetBlock.resZ; ++z) {
        for(let x = 0; x<sheetBlock.resX; ++x) {
          this.geometry.vertices[i++].set(
            ys[y].x[x]*p.width+offset,
            ys[y].y[x]*p.width,
            z*p.height/(sheetBlock.resZ-1)-0.5*p.height
          );
        }
      }
    }
    if(i!==this.geometry.vertices.length) {
      console.warn('setPoints: bad mapping!');
    }

    if(this.corner.use && !this.corner.points.length) {
      const plane = new THREE.Plane(), normal = plane.normal, planeOffset = (1-this.getProps().flexibleCorner)*Math.min(p.width, p.height), proj = new THREE.Vector3();
      plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(-1,0,-1).normalize(), new THREE.Vector3(planeOffset+offset, 0, 0.5*p.height));
      for(let i=0, l=this.geometry.vertices.length;i<l;++i) {
        plane.projectPoint(this.geometry.vertices[i], proj);
        proj.sub(this.geometry.vertices[i]);
        if(proj.x*normal.x+proj.y*normal.y+proj.z*normal.z>0) {
          const d = proj.length()/planeOffset;
          this.corner.maxDistance = Math.max(this.corner.maxDistance, d);
          this.corner.points.push({vertex: i, distance: d});
        }
      }
    }

    if(this.corner.use && Math.abs(this.corner.height)>1e-3) {
      const d2Angle = (d)=> p.cornerDeviation*this.corner.height/(1+Math.exp(-p.bending*(d-0.5*this.corner.maxDistance)));
      this.corner.axis.set(-1,0,1).normalize();
      this.corner.axis.applyAxisAngle(this.corner.OZ, this.angle);
      for(let point of this.corner.points) {
        this.geometry.vertices[point.vertex].applyAxisAngle(this.corner.axis, d2Angle(point.distance))
      }
    }

    for(let m of this.markers) {
      m.marker.position.copy(this.geometry.vertices[m.vertex]);
    }

    this.geometry.computeVertexNormals();
    //this.geometry.computeFaceNormals();
    this.geometry.computeBoundingSphere();
    //this.geometry.computeBoundingBox();
    this.geometry.verticesNeedUpdate = true;

    if(this.markup) {
      this.markup.computeVertices();
    }
  }

  inverse(ps) {
    for(let i = 0;i<ps.x.length; ++i) {
      ps.x[i]=-ps.x[i];
    }
    return ps;
  }

  getPointsAtHs(ps, angle, hs) {
    const N = 1000;
    MathUtils.setSplinePoints(this.pSpline, ps);
    let bl = MathUtils.splitSpline(this.pSpline, N), r=[];
    {
      const p1 = {...this.pSpline.getPoint((N-1)/N)}, p2 = {...this.pSpline.getPoint(1)},
        dp = {x: p2.x-p1.x, y: p2.y-p1.y}, ln = Math.sqrt(dp.x*dp.x+dp.y*dp.y),
        sp = this.pSpline.points[this.pSpline.points.length-1];
      sp.set(sp.x+0.1*dp.x/ln, sp.y+0.1*dp.y/ln, 0);
      bl = MathUtils.splitSpline(this.pSpline, N);
    }
    bl.ls.push(1e7);
    MathUtils.mapl2L(bl.ls, bl.len, sheetBlock.resX, (i)=> {
      for(let j=0; j<hs.length; ++j) {
        if(!i) {
          r[j] = {x: [-hs[j]*Math.sin(angle)], y: [hs[j]*Math.cos(angle)]};
        }
        else {
          const p0 = {...this.pSpline.getPoint((i-1)/N)},
                p1 = this.pSpline.getPoint(i/N),
                x=-(p1.y-p0.y), y=(p1.x-p0.x), l=Math.sqrt(x*x+y*y);
          r[j].x.push(p1.x+x/l*hs[j]);
          r[j].y.push(p1.y+y/l*hs[j]);
        }
      }
    });

    const nps=[];
    for(let j=0; j<hs.length; ++j) {
      nps[j]={x:[],y:[]};
      MathUtils.setSplinePoints(this.iSpline, r[j]);
      const l = MathUtils.splitSpline(this.iSpline, N);
      l.ls.push(1e7);
      MathUtils.mapl2L(l.ls, 1, sheetBlock.resX, (i)=> {
        const p = this.iSpline.getPoint(i/N);
        nps[j].x.push(p.x);
        nps[j].y.push(p.y);
      });
    }
    return nps;
  }

  getPointsAtAngleAndHs(points, angle, hAngle, hs) {
    const ps = this.getPointsAtAngle(points, angle);
    return this.getPointsAtHs(ps, hAngle, hs);
  }

  getPointsAtAngle(points, angle) {
    const ps={x: [], y:[]}, angles=[];
    angle/=Math.PI/2;
    for(let j = 0; j<points.x.length; ++j) {
      angles.push(j/(points.x.length-1));
    }
    for(let i = 0; i<points.x[0].length; ++i) {
      const xps = [], yps = [];
      for(let j = 0; j<points.x.length; ++j) {
        xps.push(points.x[j][i]);
        yps.push(points.y[j][i]);
      }
      ps.x.push(this.interpolate(angles,xps,angle));
      ps.y.push(this.interpolate(angles,yps,angle));
    }
    return ps;
  }

  interpolate(x,y,xi) {
    if(!this.aSplines[x.length]) {
      this.aSplines[x.length] = new THREE.CatmullRomCurve3([]);
      const ps = this.aSplines[x.length].points;
      for(let i=0;i<x.length;++i) {
        ps.push(new THREE.Vector3());
      }
    }
    const spline = this.aSplines[x.length];
    for(let i=0;i<x.length;++i) {
      spline.points[i].set(x[i], y[i], 0);
    }
    return spline.getPoint(Math.min(1, Math.max(xi, 0))).y;
  }

  loadPoints() {
    const x=[],y=[];
    for(let r of [0, 0.2877, 0.6347, 0.8174, 1.0000]) {
      x.push(r*Math.cos(0.9*Math.PI/4));
      y.push(r*Math.sin(0.9*Math.PI/4))
    }

    const openedInterpolationIndeces = [
      [2,3,4],
      [2,3,4,5,6]
    ],
    closedInterpolationIndeces = [
      [0,1,2],
      [0,1,2]
    ],
    flatInterpolationIndeces = [
      [5,4],
      [7,6]
    ],
    interpolationPoints = [
      {
        x: [
          [0,0.2877,0.6347,0.8174,1.0000],
          [0.000,0.286,0.632,0.815,0.997],
          [0.000,0.279,0.623,0.806,0.988],
          [0.000,0.126,0.411,0.593,0.774],
          [0,0,0,0,0],
          x
        ],
        y: [
          [0,0,0,0,0],
          [0.000,0.030,0.010,0.002,0.000],
          [0.000,0.060,0.017,0.004,0.000],
          [0.000,0.259,0.440,0.446,0.429],
          [0, 0.2877, 0.6347, 0.8174, 1.0000],
          y
        ]
      },
      {
        x: [
          [0,0.2877,0.6347,0.8174,1.0000],
          [0.000,0.286,0.632,0.815,0.997],
          [0.000,0.279,0.623,0.806,0.988],
          [0.000,0.233,0.563,0.746,0.927],
          [0.000,0.144,0.433,0.613,0.796],
          [0.000,0.070,0.288,0.455,0.626],
          [0,0,0,0,0],
          x
        ],
        y: [
          [0,0,0,0,0],
          [0.000,0.030,0.010,0.002,0.000],
          [0.000,0.060,0.017,0.004,0.000],
          [0.000,0.168,0.269,0.270,0.255],
          [0.000,0.245,0.435,0.458,0.460],
          [0.000,0.278,0.544,0.614,0.673],
          [0, 0.2877, 0.6347, 0.8174, 1.0000],
          y
        ]
      }
    ];

    return {
      interpolationPoints,
      openedInterpolationIndeces,
      closedInterpolationIndeces,
      flatInterpolationIndeces
    };
  }
}
