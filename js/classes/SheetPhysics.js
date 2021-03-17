import MathUtils from 'MathUtils';

export default class SheetPhysics {

  static targetForceClb(o,a,v,ch) {
    const l = a*this.r;
    return 100*this.m*this.g*(2/(1+Math.exp(10*(l-this.tl)))-1)-this.m*40*v;
  }

  static hoverCornerForceClb(o,v,l,ch) {
    return 5;
  }

  getTargetForceClb(mass, targetAngle) {
    return SheetPhysics.targetForceClb.bind({
      g: this.p.gravity,
      m: mass,
      tl: targetAngle*this.p.r,
      r: this.p.r
    });
  }

  static dragForceClb(o,a,v,ch) {
    return o.flbt*o.m*(10*o.g*ch-50*v/(1+Math.exp(3.5*Math.abs(ch))));
  }

  static dragCornerForceClb(o,a,v,ch) {
    return 15*(2/(1+Math.exp(10*(a-this.ta)*o.r))-1);
  }

  static getDragCornerForceClb(targetAngle) {
    return SheetPhysics.dragCornerForceClb.bind({
      ta: targetAngle
    });
  }

  constructor(r=1, gravity=1, cornerDeviation=0.15, fps=240) {
    this.p = {
      r,
      cornerDeviation,
      l: Math.PI*r,
      startDt: 1/fps,
      gravity,
      margin: 0.002*r,
      infM: 1e4,
      attempts: 16,
      maxIterations: 100
    };
    this.os = [];
  }

  dispose() {
    this.os = [];
  }

  getSize() {
    return this.os.length;
  }

  addObject(mass, angle, velocity, flexibility, cornerHeight, simulateClb, removeClb, forceClb=()=> 0, cornerForceClb=()=> 0) {
    const no = {
      id: MathUtils.getUnique(),
      m: mass,
      v: velocity,
      l: angle*this.p.r,
      f: forceClb,
      cf: cornerForceClb,
      ch: cornerHeight,
      flbt: flexibility,
      simulateClb,
      removeClb
    };
    let i = this.os.findIndex((o)=> no.l<=o.l);
    i = ~i? i: this.os.length;
    this.os.splice(i, 0, no);
    return no.id;
  }

  getParametrMap(name) {
    const map = {
      mass: 'm',
      velocity: 'v',
      flexibility: 'flbt',
      cornerHeight: 'ch',
      simulateClb: 'simulateClb',
      removeClb: 'removeClb',
      forceClb: 'f',
      cornerForceClb: 'cf'
    };
    return map[name];
  }

  setParametr(id, name, value) {
    const o = this.os.find((o)=> o.id===id);
    if(name === 'angle') {
      o.l = value*this.p.r;
    }
    else {
      o[this.getParametrMap(name)] = value;
    }
  }

  getParametr(id, name) {
    const o = this.os.find((o)=> o.id===id);
    let value;
    if(name === 'angle') {
      value = o.l/this.p.r;
    }
    else {
      value = o[this.getParametrMap(name)];
    }
    return value;
  }

  simulate(T) {
    let t=0,
        dt=this.p.startDt,
        attempt=0,
        it=0;

    while(t<T && it<this.p.maxIterations) {
      if(dt>T-t) {
        dt = T-t;
      }
      const nos = this.integrate(this.os, dt),
            ci = this.findCollisions(nos);
      if(ci.num>1 && attempt<this.p.attempts) {
        dt/=2;
        ++attempt;
      }
      else {
        if(ci.num===1) {
          const scos = this.solveCollision(nos[ci.last-1], nos[ci.last]);
          nos[ci.last-1] = scos[0];
          nos[ci.last] = scos[1];
        }
        else if(ci.num>1) {
          const gs = [];
          let last = -2;
          for(let i of ci.all) {
            if(i-last>1) {
              gs.push([]);
            }
            gs[gs.length-1].push(i);
            last = i;
          }
          for(let g of gs) {
            let sg, i0;
            if(nos[g[0]].l>Math.PI/2*this.p.r) {
              sg = -1;
              i0 = g[g.length-1];
            }
            else {
              sg = 1;
              i0 = g[0];
            }
            for(let i=i0; i<nos.length && i>-1; i+=sg) {
              const o = nos[i+sg];
              if(o && sg*(o.l-nos[i].l)<=this.p.margin) {
                o.l=nos[i].l+sg*2*this.p.margin;
                if(o.l>this.p.l || o.l<0) {
                  o.l = o.l>this.p.l? this.p.l: 0;
                  o.ch = 0;
                  o.v=0;
                  console.error('Bad collision');
                }
              }
              else {
                break;
              }
            }
          }
        }
        this.os = nos;
        this.findAndSolveCornerCollisions();
        t+=dt;
        dt=this.p.startDt;
        attempt=0;
      }
      ++it;
    }

    this.removeStatics();
  }

  removeStatics() {
    const nos = [], notify = [[],[]];
    for(let o of this.os) {
      if(o.simulateClb) {
        o.simulateClb(o.l/this.p.r, o.ch);
      }
      if((o.l===this.p.l || o.l===0) && o.v===0) {
        if(o.removeClb !== undefined) {
          notify[(o.l!==this.p.l)+0].push(o);
        }
      }
      else {
        nos.push(o);
      }
    }
    this.os = nos;
    for(let o of notify[0].reverse()) {
      o.removeClb(Math.PI, o.ch);
    }
    for(let o of notify[1]) {
      o.removeClb(0, o.ch);
    }
  }

  findAndSolveCornerCollisions() {
    if(this.os.length) {
      const os = [
        {
          ...this.os[0],
          l: 0,
          m: this.p.infM,
          ch: 0
        },
        ...this.os,
        {
          ...this.os[0],
          l: 1.05*this.p.l,
          m: this.p.infM,
          ch: 0
        }
      ];

      for(let i=1; i<os.length; ++i) {
        const a=os[i-1], b=os[i],
              al=a.l+this.p.cornerDeviation*a.ch*this.p.r,
              bl=b.l+this.p.cornerDeviation*b.ch*this.p.r;
        if(1.05*al>bl && a.ch>b.ch) {
          const dCh = a.ch-b.ch, dv=a.m/a.flbt+b.m/b.flbt, ka=a.m/a.flbt/dv, kb=b.m/b.flbt/dv;
          a.ch=a.ch-kb*dCh;
          b.ch=b.ch+ka*dCh;
        }
      }
    }
  }

  solveCollision(a, b) {
    const mm=(b.m+a.m),
      av = (-a.v*b.m+a.m*a.v+2*b.m*b.v)/mm,
      bv = (b.m*b.v-b.v*a.m+2*a.m*a.v)/mm;
    return [{...a, v: av}, {...b, v: bv}];
  }

  findCollisions(os) {
    const ci = {
      num: 0,
      last: 0,
      all: []
    };
    for(let i = 1; i<os.length && ci.num<2; ++i) {
      if(os[i-1].l>os[i].l || this.isCollision(os[i-1], os[i])) {
        if(os[i-1].l>os[i].l) {
          ++ci.num;
        }
        ++ci.num;
        ci.last = i;
        if(ci.all.indexOf(i-1)===-1) {
          ci.all.push(i-1);
        }
        if(ci.all.indexOf(i)===-1) {
          ci.all.push(i);
        }
      }
    }
    return ci;
  }

  isCollision(a, b) {
    return Math.abs(a.l-b.l)<this.p.margin && a.v>b.v;
  }

  integrate(os, dt) {
    const nos = [];
    for(let o of os) {
      const vl = MathUtils.rk4(
        this.dy.bind({
          g: this.p.gravity,
          r: this.p.r,
          m: o.m,
          f: o.f,
          cf: o.cf,
          ch: o.ch,
          flbt: o.flbt
        }),
        0,
        dt,
        [o.v, o.l, o.ch]
      );
      const no = {
        ...o,
        v: vl[0],
        l: vl[1],
        ch: vl[2]
      };
      if(no.l<=0 || no.l>=this.p.l) {
        no.l=no.l<=0? 0: this.p.l;
        no.v=0;
        no.ch=0;
      }
      nos.push(no);
    }
    return nos;
  }

  dy(t,y) {
    const v=y[0], l=y[1], ch=y[2], alf = l/this.r, f=this.f(this,alf,v,ch), cf=this.cf(this,alf,v,ch), cosAlf=Math.cos(alf),
    brf=0.006*Math.abs((Math.sign(cosAlf)-Math.sign(v))*v)*Math.pow(cosAlf,5);
    return [
      (-this.g*cosAlf*this.m+brf+f)/this.m,
      v+0.01*(Math.random()-0.5),
      this.flbt*((2/(1+Math.exp(-0.2*cf))-1)*(1-2/(1+Math.exp(-5*(Math.abs(ch)-2))))-ch)
    ];
  }

}
