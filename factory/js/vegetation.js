import * as THREE from 'three';
import {mulberry32,Simplex,fbm,smooth} from './noise.js';
import {WORLD,HALF,CELL} from './data.js';
import {B} from './world.js';
import * as G from './geo.js';
import {Q} from './quality.js';

const CH=128,wind={value:0};
const GREEN=(r,g,b)=>new THREE.Color(r,g,b);
function T(){ // geometry factories
  const trunk=0x5b4129,snowC=0xe8eef5;
  const pine=(top)=>G.merge([G.cyl(0.3,0.5,4,5,trunk,{y:2}),G.cone(2.7,4.2,7,top??0x2b4632,{y:5.2}),G.cone(2.1,3.6,7,top??0x304f36,{y:7.4}),G.cone(1.35,3.2,7,top??0x36583b,{y:9.4})]);
  return {
    pine:pine(),
    snow_pine:G.merge([G.cyl(0.3,0.5,4,5,trunk,{y:2}),G.cone(2.7,4.2,7,0x2a5a45,{y:5.2}),G.cone(2.1,3.6,7,0xdfe9ef,{y:7.4}),G.cone(1.35,3.2,7,snowC,{y:9.4})]),
    oak:G.merge([G.cyl(0.4,0.65,4.6,6,trunk,{y:2.3}),G.blob(3,0x4b6b36,{y:6.2},0.3),G.blob(2.2,0x587a3e,{x:1.9,y:5.2,z:0.6},0.3),G.blob(2.1,0x425f31,{x:-1.7,y:5.4,z:-0.9},0.3)]),
    willow:G.merge([G.cyl(0.35,0.6,3.6,6,0x4b4030,{y:1.8,rz:0.12}),G.blob(2.8,0x5f6e44,{y:4.8,sy:0.65,x:0.4},0.3),
      ...[0,1,2,3,4,5].map(i=>G.cone(0.4,3.2,4,0x6b7a50,{x:Math.cos(i)*2.2+0.4,z:Math.sin(i)*2.2,y:3.3,rx:Math.PI}))]),
    dead:G.merge([G.cyl(0.18,0.45,5,5,0x6b6358,{y:2.5}),G.cyl(0.08,0.16,2.6,4,0x6b6358,{x:0.9,y:3.8,rz:-0.9}),G.cyl(0.07,0.14,2.2,4,0x6b6358,{x:-0.7,y:4.3,rz:0.8}),G.cyl(0.06,0.12,1.6,4,0x6b6358,{y:5.4,rz:0.3})]),
    cactus:G.merge([G.cyl(0.55,0.6,5,7,0x4e7550,{y:2.5}),G.cyl(0.32,0.32,1.5,6,0x4e7550,{x:0.95,y:2.4,rz:Math.PI/2}),G.cyl(0.32,0.32,1.9,6,0x4e7550,{x:1.55,y:3.3}),
      G.cyl(0.3,0.3,1.3,6,0x4e7550,{x:-0.85,y:3.1,rz:Math.PI/2}),G.cyl(0.3,0.3,1.6,6,0x4e7550,{x:-1.4,y:3.8})]),
    palm:G.merge([G.cyl(0.25,0.4,3,6,0x8a6a40,{y:1.5,rz:0.06}),G.cyl(0.22,0.28,3,6,0x8a6a40,{x:0.3,y:4.4,rz:0.14}),
      ...[0,1,2,3,4,5,6].map(i=>G.box(3.2,0.08,0.7,0x52764a,{x:0.7+Math.cos(i*0.9)*1.3,y:6.1,z:Math.sin(i*0.9)*1.3,ry:-i*0.9,rz:-0.45,jit:0.15}))]),
    bush:G.merge([G.blob(1,0x4a6236,{y:0.7},0.3),G.blob(0.8,0x566e3c,{x:0.8,y:0.5,z:0.3},0.3),G.blob(0.7,0x435a33,{x:-0.6,y:0.5,z:-0.5},0.3)]),
    rock:G.merge([G.blob(1,0x8a8680,{y:0.35,sy:0.7},0.45)]),
    boulder:G.merge([G.blob(2.6,0x8a8680,{y:1.1,sy:0.8},0.5),G.blob(1.7,0x7c7872,{x:2.2,y:0.6,z:0.9,sy:0.8},0.5)]),
    reed:G.merge([0,1,2,3,4,5].map(i=>G.cone(0.08,1.6+(i%3)*0.4,3,0x7d8f4a,{x:Math.cos(i*1.7)*0.35,z:Math.sin(i*1.7)*0.35,y:0.9,rx:Math.sin(i)*0.15}))),
    grass:(()=>{const P=[],Nn=[],C=[];const bl=5;for(let i=0;i<bl;i++){const a=i*2.4+0.3,c=Math.cos(a),s=Math.sin(a),h=0.45+((i*37)%5)*0.12,r=0.1,l=0.25+(i%3)*0.08,w=0.075;
      const bx=c*r,bz=s*r,tx=c*(r+l),tz=s*(r+l);P.push(bx-s*w,0,bz+c*w,bx+s*w,0,bz-c*w,tx,h,tz);for(let k=0;k<3;k++)Nn.push(0,1,0);C.push(0.06,0.1,0.04,0.06,0.1,0.04,0.32,0.42,0.18);}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(Nn,3));g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));return g;})(),
    log:G.merge([G.cyl(0.42,0.48,6,7,0x5a4632,{y:0.4,rz:Math.PI/2}),G.cyl(0.38,0.38,0.05,7,0x8a7258,{x:3,y:0.4,rz:Math.PI/2}),G.cyl(0.1,0.14,1.2,4,0x4e3e2c,{x:1,y:0.8,z:0.3,rx:0.6}),G.blob(0.35,0x4f6038,{x:-1.5,y:0.75},0.5,0)]),
    stump:G.merge([G.cyl(0.5,0.65,0.8,7,0x5a4632,{y:0.4}),G.cyl(0.48,0.48,0.04,7,0x9a8264,{y:0.82}),G.blob(0.18,0x8a5a3a,{x:0.55,y:0.15,z:0.2,sy:0.6},0.2,0)]),
    mushroom:G.merge([G.cyl(0.06,0.08,0.35,5,0xd8cfc0,{y:0.17}),G.cone(0.22,0.18,7,0x9a4a3a,{y:0.4}),G.cyl(0.05,0.06,0.22,5,0xd8cfc0,{x:0.25,y:0.11,z:0.1}),G.cone(0.14,0.12,7,0x9a6a4a,{x:0.25,y:0.27,z:0.1})]),
    fern:G.merge([0,1,2,3,4,5,6].map(i=>G.box(1.1,0.03,0.22,0x4a6038,{x:Math.cos(i*0.9)*0.5,y:0.35,z:Math.sin(i*0.9)*0.5,ry:-i*0.9,rz:0.45,jit:0.12}))),
    pebbles:G.merge([0,1,2,3,4].map(i=>G.blob(0.14+(i%3)*0.08,0x8a8680,{x:Math.cos(i*2.3)*0.6,y:0.06,z:Math.sin(i*2.3)*0.6,sy:0.6,seed:i},0.4,0))),
    deadbush:G.merge([0,1,2,3,4,5].map(i=>G.cyl(0.02,0.04,0.9,3,0x7a6a50,{x:Math.cos(i)*0.15,y:0.4,z:Math.sin(i)*0.15,rx:Math.cos(i*2)*0.6,rz:Math.sin(i*2)*0.6}))),
    spire:G.merge([G.blob(1.6,0x8a7464,{y:2,sy:2.2,sx:0.8},0.35),G.blob(1.2,0x7e6a5c,{y:5,sy:1.6,sx:0.7,x:0.3},0.35),G.blob(0.8,0x8a7464,{y:7.2,sy:1.2,x:0.1},0.35)]),
    ice:G.merge([0,1,2,3].map(i=>G.cone(0.35+i*0.08,1.4+i*0.7,5,0xbfd4e0,{x:Math.cos(i*1.7)*0.6,y:(1.4+i*0.7)/2-0.1,z:Math.sin(i*1.7)*0.6,rx:Math.cos(i)*0.25,rz:Math.sin(i*1.3)*0.25,jit:0.15}))),
    cattail:G.merge([0,1,2,3].map(i=>G.merge([G.cyl(0.02,0.03,1.8+i*0.2,3,0x6a7a48,{x:Math.cos(i*1.6)*0.3,y:0.9+i*0.1,z:Math.sin(i*1.6)*0.3}),G.cyl(0.06,0.06,0.35,5,0x5a3a26,{x:Math.cos(i*1.6)*0.3,y:1.75+i*0.2,z:Math.sin(i*1.6)*0.3})]))),
    lily:G.merge([G.cyl(0.55,0.55,0.03,8,0x4d6a3e,{}),G.cyl(0.35,0.35,0.03,7,0x557244,{x:0.9,z:0.4}),G.blob(0.09,0xd8c8d0,{x:0.1,y:0.06},0.1,0)]),
    flower:G.merge([G.cyl(0.03,0.03,0.7,3,0x4b7a2a,{y:0.35}),G.blob(0.16,0xffffff,{y:0.75},0.1,0)]),
  };
}
export class Vegetation{
  constructor(world,scene,nodes,seed=11){
    this.world=world;this.scene=scene;this.rng=mulberry32(seed);this.chunks=new Map();this.hash=new Map();this.windU=wind;this.meshes=[];this.timer=0;
    this.build(nodes);
  }
  build(nodes){
    const w=this.world,rng=this.rng,geos=T(),nd=new Simplex(31),buckets=new Map();
    const mats={};
    const mk=(name,o={})=>{const m=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:0.9,side:o.side||THREE.FrontSide});if(o.wind!==undefined)G.windify(m,wind,o.wind);mats[name]=m;return m;};
    const spec={pine:{r:0.6,view:520,wind:0.25,shadow:true},snow_pine:{r:0.6,view:500,wind:0.2,shadow:true},oak:{r:0.7,view:520,wind:0.3,shadow:true},willow:{r:0.7,view:450,wind:0.3,shadow:true},dead:{r:0.4,view:420,shadow:true},
      cactus:{r:0.7,view:420,shadow:true},palm:{r:0.4,view:450,wind:0.3,shadow:true},bush:{r:0,view:260,wind:0.2},rock:{r:0,view:300},boulder:{r:2.4,view:520,shadow:true},reed:{r:0,view:200,wind:0.3},log:{r:0,view:240,shadow:true},stump:{r:0.5,view:240,shadow:true},mushroom:{r:0,view:110},fern:{r:0,view:150,wind:0.4},pebbles:{r:0,view:130},deadbush:{r:0,view:180},spire:{r:1.3,view:600,shadow:true},ice:{r:0.8,view:320,shadow:true},cattail:{r:0,view:180,wind:0.35},lily:{r:0,view:160},
      grass:{r:0,view:150,wind:0.9,side:THREE.DoubleSide},flower:{r:0,view:140,wind:0.5}};
    for(const k in spec)mk(k,{wind:spec[k].wind,side:spec[k].side});
    this.spec=spec;this.geos=geos;this.mats=mats;
    const add=(type,x,z,scale,yaw,tint,sink=0.1,yOver)=>{
      const y=yOver!==undefined?yOver:w.heightAt(x,z)-sink,key=`${Math.floor((x+HALF)/CH)},${Math.floor((z+HALF)/CH)},${type}`;
      let b=buckets.get(key);if(!b){b={type,items:[]};buckets.set(key,b);}
      b.items.push({x,y,z,s:scale,yaw,tint});
      const r=spec[type].r*scale;if(r>0){const hk=Math.floor(x/8)+','+Math.floor(z/8);let a=this.hash.get(hk);if(!a){a=[];this.hash.set(hk,a);}a.push({x,z,r,alive:true});}
    };
    const nearNode=(x,z,r)=>nodes.some(n=>Math.abs(n.x-x)<r&&Math.abs(n.z-z)<r);
    const sp=6.5;
    for(let gz=-HALF+10;gz<HALF-10;gz+=sp)for(let gx=-HALF+10;gx<HALF-10;gx+=sp){
      const x=gx+rng()*sp,z=gz+rng()*sp,h=w.heightAt(x,z);
      if(h<1.0||nearNode(x,z,12)||rng()>Q.trees)continue;
      if(x*x+z*z<3600&&rng()<0.85)continue;
      const b=w.biomeAt(x,z),slope=w.slopeAt(x,z),d=fbm(nd,x*0.012,z*0.012,2),temp=w.tempAt(x,z),r=rng();
      const sc=0.75+rng()*0.8,yaw=rng()*6.28;
      if(slope>0.75&&b!==B.ROCK)continue;
      switch(b){
        case B.FOREST:if(r>0.93){const q=rng();add(q<0.35?'log':q<0.6?'stump':q<0.85?'fern':'mushroom',x,z,0.8+rng()*0.5,yaw,null,q<0.35?0.25:0.05);}else if(d>-0.25||r<0.25){if(r<(temp<0.05||h>16?0.75:0.3))add('pine',x,z,sc,yaw);else if(r<0.93)add('oak',x,z,sc,yaw);else add('bush',x,z,1,yaw);}else if(r<0.1)add('rock',x,z,sc,yaw);break;
        case B.GRASS:if(d>0.35&&r<0.55)add('oak',x,z,sc,yaw);else if(r<0.05)add('oak',x,z,sc,yaw);else if(r<0.14)add('bush',x,z,1,yaw);else if(r<0.17)add('rock',x,z,sc,yaw);else if(r<0.19)add('boulder',x,z,0.6+rng()*0.5,yaw);else if(r<0.22)add('pebbles',x,z,1,yaw,null,0);else if(r<0.225)add('stump',x,z,1,yaw);break;
        case B.SWAMP:if(r>0.8)add(rng()<0.6?'cattail':'mushroom',x,z,1,yaw,null,0);else if(r>0.72)add('log',x,z,1,yaw,null,0.3);else if(r<0.2)add('willow',x,z,sc,yaw);else if(r<0.3)add('dead',x,z,sc,yaw);else if(r<0.45)add('reed',x,z,1,yaw);break;
        case B.DESERT:if(r<0.12)add('cactus',x,z,sc,yaw);else if(r<0.17)add('dead',x,z,sc*0.8,yaw);else if(r<0.24)add('rock',x,z,sc*1.2,yaw);else if(r<0.26)add('boulder',x,z,sc,yaw);else if(r<0.34)add('deadbush',x,z,1,yaw,null,0);else if(r<0.37)add('pebbles',x,z,1.2,yaw,null,0);else if(r<0.385&&slope<0.4)add('spire',x,z,0.8+rng()*0.9,yaw,null,0.6);break;
        case B.ROCK:if(r<0.16&&h<32&&slope<0.6)add('pine',x,z,sc,yaw);else if(r<0.3)add('rock',x,z,sc*1.3,yaw);else if(r<0.36)add('boulder',x,z,0.7+rng()*0.9,yaw);else if(r<0.42)add('pebbles',x,z,1.3,yaw,null,0);else if(r<0.43)add('spire',x,z,0.6+rng()*0.7,yaw,null,0.6);break;
        case B.SNOW:if(r<0.1&&h<50&&slope<0.6)add('snow_pine',x,z,sc,yaw);else if(r<0.2)add('rock',x,z,sc,yaw);else if(r<0.24)add('boulder',x,z,sc,yaw);else if(r<0.28)add('ice',x,z,0.7+rng()*0.8,yaw,null,0.2);break;
        case B.SAND:if(temp>-0.1&&r<0.06)add('palm',x,z,sc,yaw);else if(r<0.1)add('rock',x,z,sc*0.7,yaw);else if(r<0.2&&h<2)add('reed',x,z,1,yaw);else if(r<0.26)add('pebbles',x,z,1,yaw,null,0);break;
      }
    }
    // lily pads on calm shallow water near wet ground
    for(let i=0;i<9000;i++){const x=(rng()*2-1)*(HALF-30),z=(rng()*2-1)*(HALF-30),h=w.heightAt(x,z);
      if(h>-0.3||h<-2.2)continue;if(w.moistAt(x,z)<0.05&&rng()<0.8)continue;for(let k=0;k<3;k++)add('lily',x+rng()*4,z+rng()*4,0.7+rng()*0.6,rng()*6.28,null,0,0.03);}
    // grass + flowers
    const gs=2.6,gcol=[[0.9,1.1,0.8],[1.1,1.1,0.7],[0.9,1.0,0.7]];
    for(let gz=-HALF+10;gz<HALF-10;gz+=gs)for(let gx=-HALF+10;gx<HALF-10;gx+=gs){
      const x=gx+rng()*gs,z=gz+rng()*gs,h=w.heightAt(x,z);
      if(h<0.9)continue;
      const b=w.biomeAt(x,z),r=rng();let p=0,t=null;
      switch(b){case B.GRASS:p=0.55;t=GREEN(1.05,1.0,0.8);break;case B.FOREST:p=0.4;t=GREEN(0.7,1,0.7);break;case B.SWAMP:p=0.5;t=GREEN(0.6,0.75,0.5);break;
        case B.DESERT:p=0.07;t=GREEN(1.9,1.4,0.6);break;case B.SAND:p=0.05;t=GREEN(1.6,1.4,0.8);break;case B.ROCK:p=0.06;t=GREEN(0.9,0.9,0.7);break;}
      if(!p||w.slopeAt(x,z)>0.8||nearNode(x,z,7))continue;
      if(r>p*Q.grass)continue;
      add('grass',x,z,0.8+rng()*0.8,rng()*6.28,t,0);
      if((b===B.GRASS||b===B.FOREST)&&rng()<0.06*Q.flowers){const fc=[[0.85,0.78,0.35],[0.75,0.42,0.5],[0.6,0.52,0.75],[0.9,0.88,0.84],[0.82,0.55,0.35]][Math.floor(rng()*5)];add('flower',x+0.5,z+0.4,0.8+rng()*0.6,0,GREEN(...fc),0);}
    }
    // build instanced meshes
    const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),pv=new THREE.Vector3(),sv=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
    for(const [key,b] of buckets){
      const sp2=spec[b.type],im=new THREE.InstancedMesh(geos[b.type],mats[b.type],b.items.length);
      b.items.forEach((it,i)=>{q.setFromAxisAngle(up,it.yaw);pv.set(it.x,it.y,it.z);sv.set(it.s,it.s*(b.type==='grass'?1:1),it.s);m4.compose(pv,q,sv);im.setMatrixAt(i,m4);
        if(it.tint)im.setColorAt(i,it.tint);else if(b.type==='rock'||b.type==='boulder'){const bi=w.biomeAt(it.x,it.z);im.setColorAt(i,bi===B.DESERT?GREEN(1.3,0.9,0.65):bi===B.SNOW?GREEN(1.2,1.25,1.3):GREEN(1,1,1));}});
      im.instanceMatrix.needsUpdate=true;im.computeBoundingSphere();im.castShadow=!!sp2.shadow;im.receiveShadow=false;
      im.userData={type:b.type,items:b.items,view:sp2.view*Q.view,cx:0,cz:0};
      this.scene.add(im);this.meshes.push(im);
      const [ccx,ccz]=key.split(',').map(Number);im.userData.cx=-HALF+(ccx+0.5)*CH;im.userData.cz=-HALF+(ccz+0.5)*CH;
      const ck=ccx+','+ccz;let a=this.chunks.get(ck);if(!a){a=[];this.chunks.set(ck,a);}a.push(im);
    }
  }
  update(dt,time,px,pz,sunDir){
    wind.value=time;this.timer-=dt;if(this.timer>0)return;this.timer=0.25;
    for(const m of this.meshes){const u=m.userData,d=Math.hypot(u.cx-px,u.cz-pz)-CH*0.75;m.visible=d<u.view;}
  }
  addCollider(x,z,r){const hk=Math.floor(x/8)+','+Math.floor(z/8);let a=this.hash.get(hk);if(!a){a=[];this.hash.set(hk,a);}a.push({x,z,r,alive:true});}
  removeRect(x0,z0,x1,z1,pad=1){
    const c0=Math.floor((x0-pad-4+HALF)/CH),c1=Math.floor((x1+pad+4+HALF)/CH),d0=Math.floor((z0-pad-4+HALF)/CH),d1=Math.floor((z1+pad+4+HALF)/CH);
    const zero=new THREE.Matrix4().makeScale(0,0,0);
    for(let a=c0;a<=c1;a++)for(let b=d0;b<=d1;b++){
      const list=this.chunks.get(a+','+b);if(!list)continue;
      for(const im of list){let dirty=false;const items=im.userData.items,type=im.userData.type,gr=type==='grass'||type==='flower'?0.3:this.spec[type].r+0.6;
        for(let i=0;i<items.length;i++){const it=items[i];if(it.dead)continue;
          if(it.x>x0-pad-gr&&it.x<x1+pad+gr&&it.z>z0-pad-gr&&it.z<z1+pad+gr){it.dead=true;im.setMatrixAt(i,zero);dirty=true;}}
        if(dirty)im.instanceMatrix.needsUpdate=true;}
    }
    for(let hx=Math.floor((x0-8)/8);hx<=Math.floor((x1+8)/8);hx++)for(let hz=Math.floor((z0-8)/8);hz<=Math.floor((z1+8)/8);hz++){
      const a=this.hash.get(hx+','+hz);if(!a)continue;
      for(const t of a)if(t.x>x0-pad-t.r&&t.x<x1+pad+t.r&&t.z>z0-pad-t.r&&t.z<z1+pad+t.r)t.alive=false;
    }
  }
  // push position out of trunks
  collide(p,rad){
    const hx=Math.floor(p.x/8),hz=Math.floor(p.z/8);
    for(let a=hx-1;a<=hx+1;a++)for(let b=hz-1;b<=hz+1;b++){
      const l=this.hash.get(a+','+b);if(!l)continue;
      for(const t of l){if(!t.alive)continue;const dx=p.x-t.x,dz=p.z-t.z,d=Math.hypot(dx,dz),m=t.r+rad;
        if(d<m&&d>1e-4){p.x=t.x+dx/d*m;p.z=t.z+dz/d*m;}}
    }
  }
}
