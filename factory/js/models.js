import * as THREE from 'three';
import * as G from './geo.js';
import {BUILDINGS,CELL,ITEMS} from './data.js';

export const stdMat=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:0.65,metalness:0.35});
const glow=(c,i=1.6)=>new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:i,flatShading:true});
export const lightMats={working:new THREE.MeshBasicMaterial({color:0x3dff7a}),idle:new THREE.MeshBasicMaterial({color:0xffb347}),off:new THREE.MeshBasicMaterial({color:0xff4040}),none:new THREE.MeshBasicMaterial({color:0x555555})};
export const HEIGHT={belt:0.8,splitter:1.6,storage:2.6,depot:7,miner:9,miner2:9,miner3:9,smelter:8,constructor:5,assembler:8,foundry:6,solar:4,coal_gen:10,nuclear:12};
const SIDE={x:0,y:0,z:0};
const mesh=(g,m=stdMat)=>{const o=new THREE.Mesh(g,m);o.castShadow=o.receiveShadow=true;return o;};
const slab=(w,d,c=0x4a4d52)=>G.merge([G.box(w*CELL-0.3,0.5,d*CELL-0.3,c,{y:0.25}),G.box(w*CELL-1,0.25,d*CELL-1,0x5c6068,{y:0.6})]);
const light=(x,y,z)=>{const l=new THREE.Mesh(new THREE.BoxGeometry(0.45,0.45,0.45),lightMats.none);l.position.set(x,y,z);return l;};

export function makeModel(type){
  const def=BUILDINGS[type],g=new THREE.Group(),W=def.w*CELL,D=def.d*CELL,ud=g.userData={spin:[],lights:[],glows:[]};
  const add=(geo,m)=>{const o=mesh(geo,m);g.add(o);return o;};
  const base=()=>add(slab(def.w,def.d));
  const orange=0xe08a1e,steel=0x6d747e,dark=0x2f3338,blue=0x3d6a99;
  switch(type){
    case 'miner':case 'miner2':case 'miner3':{
      // Satisfactory-style gantry miner: four legs, a top frame, a hydraulic drill head that hangs over the node,
      // and an output chute on the front (+x, the arrow side) where a belt connects.
      const tier=type==='miner3'?3:type==='miner2'?2:1;
      const body=tier===3?0x7a4bd6:tier===2?0x2f9fd0:orange, trim=tier===3?0x4b2a96:tier===2?0x1d6f94:0xc77510, glowc=tier===3?0xc08bff:tier===2?0x58d6ff:0xffb02e;
      base();
      const legs=[[-3.3,-3.3],[3.3,-3.3],[-3.3,3.3],[3.3,3.3]];
      add(G.merge([
        ...legs.map(([x,z])=>G.cyl(0.45,0.6,6.6,8,steel,{x,y:3.9,z})),
        ...legs.map(([x,z])=>G.box(1.3,0.5,1.3,dark,{x,y:0.9,z})),
        G.box(7.6,0.7,0.7,trim,{y:6.9,z:-3.3}),G.box(7.6,0.7,0.7,trim,{y:6.9,z:3.3}),G.box(0.7,0.7,7.6,trim,{y:6.9,x:-3.3}),G.box(0.7,0.7,7.6,trim,{y:6.9,x:3.3}),
        G.box(6.4,0.5,6.4,dark,{y:6.6}),
        G.box(4.2,2.6,4.2,body,{y:8.4}),G.box(4.6,0.5,4.6,trim,{y:9.9}),G.box(2.2,1.2,2.2,steel,{y:10.7}),
        G.cyl(0.3,0.3,3.4,6,steel,{x:-1.6,y:8.1,z:-1.6}),G.cyl(0.3,0.3,3.4,6,steel,{x:1.6,y:8.1,z:1.6}),
        G.box(0.6,2.8,0.6,steel,{x:-3.3,y:5.2,z:0,rz:0.0}),G.box(0.6,0.6,7,steel,{x:-3.3,y:3.4}),G.box(7,0.6,0.6,steel,{y:3.4,z:-3.3}),G.box(7,0.6,0.6,steel,{y:3.4,z:3.3}),
        ...(tier>=2?[G.box(1.2,3.6,1.2,steel,{x:-2.8,y:8.4,z:0}),G.box(1.2,3.6,1.2,steel,{x:2.8,y:8.4,z:0})]:[]),
        ...(tier===3?[G.box(5.2,0.4,5.2,0xd9c2ff,{y:7.35})]:[]),
        // output chute
        G.box(2.2,1.5,2.4,steel,{x:3.8,y:2.6}),G.box(1.0,1.1,2.0,dark,{x:4.8,y:2.5}),G.cone(0.7,1.4,3,0xffc83a,{x:4.0,y:3.8,rz:-Math.PI/2}),
      ]));
      // drill head (moves up and down while working, drill bit spins)
      const drill=new THREE.Group();drill.userData.y0=0;g.add(drill);ud.drill=drill;
      const shaft=mesh(G.merge([G.cyl(0.55,0.55,5.2,8,0x9aa0a8,{y:5.2}),G.cyl(1.1,1.1,0.6,8,dark,{y:7.9}),G.cyl(1.5,1.5,0.5,8,steel,{y:7.4})]));drill.add(shaft);
      const bit=mesh(G.merge([G.cone(1.55,3.4,7,0xd2d6dc,{y:1.4,rx:Math.PI}),G.cyl(1.0,1.0,0.5,7,steel,{y:3.3}),G.cone(0.9,2,7,0xb4bac2,{y:3.5,ry:0.4,rx:Math.PI}),G.cyl(0.4,0.4,1.4,6,dark,{y:3.9})]));
      bit.position.y=0.4;drill.add(bit);ud.spin.push([bit,9]);
      const core=new THREE.Mesh(new THREE.CylinderGeometry(2.35,2.35,0.5,14,1,true),glow(glowc,1.6));core.position.y=8.4;g.add(core);ud.glows.push(core);
      const port=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.9,1.5),glow(glowc,1.8));port.position.set(5.35,2.5,0);g.add(port);ud.glows.push(port);
      const l=light(0,11.6,0);g.add(l);ud.lights.push(l);break;}
    case 'smelter':{
      base();
      add(G.merge([G.box(5.2,4.2,5.2,0x6a6f78,{y:2.9}),G.box(5.6,0.5,5.6,dark,{y:5.2}),G.cyl(0.75,0.9,6,7,0x4a4e55,{x:-1.5,y:8,z:1.4}),G.cyl(0.9,0.75,0.5,7,dark,{x:-1.5,y:11,z:1.4}),
        G.box(1.8,1.6,3,steel,{x:-3.1,y:5.2,rz:0.4}),G.cyl(0.25,0.25,4,5,0xb0743a,{x:1,y:6,z:-2.4,rz:Math.PI/2})]));
      const m=add(new THREE.BoxGeometry(0.2,1.8,2.6),glow(0xff7a1a,2));m.position.set(2.65,2.4,0);ud.glows.push(m);
      const l=light(2.7,4.6,1.9);g.add(l);ud.lights.push(l);break;}
    case 'constructor':{
      base();
      add(G.merge([G.box(5.2,3.2,5.2,blue,{y:2.2}),G.box(5.4,0.5,5.4,dark,{y:3.95}),G.box(1.8,1.6,2.6,steel,{x:3.2,y:1.6}),G.box(0.8,3,0.8,steel,{x:-2,y:5.2,z:2}),G.box(0.8,3,0.8,steel,{x:-2,y:5.2,z:-2})]));
      const arm=new THREE.Group();arm.add(mesh(G.merge([G.box(0.7,0.7,5.2,0xe0b030,{}),G.box(0.5,1.8,0.5,steel,{y:-1,z:1.4})])));arm.position.set(-1.9,6.5,0);arm.rotation.y=Math.PI/2;g.add(arm);ud.arm=arm;
      const w=add(new THREE.BoxGeometry(0.2,1.2,2.4),glow(0x58d6ff,1.4));w.position.set(2.65,2.6,0);ud.glows.push(w);
      const l=light(2.65,3.6,2.2);g.add(l);ud.lights.push(l);break;}
    case 'assembler':{
      base();
      add(G.merge([G.box(9,3.2,9,0x4a6f5e,{y:2.2}),G.box(9.4,0.5,9.4,dark,{y:3.95}),G.box(3,2,5,steel,{x:5.2,y:1.8}),G.box(1,5,1,steel,{x:-3.5,y:6,z:3.5}),G.box(1,5,1,steel,{x:-3.5,y:6,z:-3.5}),G.box(1,5,1,steel,{x:3.5,y:6,z:3.5}),G.box(1,5,1,steel,{x:3.5,y:6,z:-3.5}),G.box(8,0.6,8,dark,{y:8.7})]));
      for(const z of [-2,2]){const arm=new THREE.Group();arm.add(mesh(G.merge([G.box(5,0.7,0.7,0xe08a1e,{}),G.box(0.5,2.2,0.5,steel,{x:2,y:-1.2})])));arm.position.set(0,7.3,z);g.add(arm);(ud.arms=ud.arms||[]).push(arm);}
      const w=add(new THREE.BoxGeometry(0.2,1.4,5),glow(0x6dffa0,1.2));w.position.set(4.55,2.7,0);ud.glows.push(w);
      const l=light(4.6,4.5,4);g.add(l);ud.lights.push(l);break;}
    case 'foundry':{
      base();
      add(G.merge([G.cyl(2.6,2.9,5.4,10,0x7a4a3a,{y:3.2}),G.cyl(2.7,2.7,0.6,10,dark,{y:6}),G.cyl(0.8,0.8,4,7,0x4a4e55,{x:-1.2,y:8,z:-1}),G.box(2,1.8,2.4,steel,{x:3.3,y:1.7}),G.box(2.4,1.2,1.2,steel,{x:-3.4,y:3.5,rz:0.3})]));
      const m=add(new THREE.CylinderGeometry(2.95,2.95,0.6,10,1,true),glow(0xff5a10,2.2));m.position.y=3.8;ud.glows.push(m);
      const l=light(2.3,6.4,0);g.add(l);ud.lights.push(l);break;}
    case 'splitter':{
      add(G.merge([G.box(3.4,0.5,3.4,dark,{y:0.25}),G.box(2.8,1,2.8,0x5a6068,{y:1}),G.cone(0.8,1.4,3,0xffc83a,{x:0.4,y:2,rz:-Math.PI/2}),G.cone(0.5,1,3,0xffc83a,{z:1,y:1.8,rx:Math.PI/2}),G.cone(0.5,1,3,0xffc83a,{z:-1,y:1.8,rx:-Math.PI/2})]));break;}
    case 'storage':{
      add(G.merge([G.box(3.3,2.2,3.3,0xb8942e,{y:1.2}),G.box(3.5,0.35,3.5,0x6a5a22,{y:2.4}),G.box(3.5,0.3,3.5,0x6a5a22,{y:0.3}),G.box(0.3,2.4,3.5,0x6a5a22,{x:1.5,y:1.2}),G.box(0.3,2.4,3.5,0x6a5a22,{x:-1.5,y:1.2})]));break;}
    case 'depot':{
      add(G.merge([slab(3,3,0x3a4048),G.box(8,1,8,0x4d545e,{y:1}),G.cyl(1.6,2.2,5.5,8,0x2f6ea8,{y:4}),G.cyl(2.4,2.4,0.5,8,dark,{y:7}),...[[-5,-5],[5,-5],[-5,5],[5,5]].map(([x,z])=>G.cyl(0.35,0.5,3.5,6,steel,{x,y:2.2,z}))]));
      const ring=add(new THREE.TorusGeometry(2.4,0.25,6,16),glow(0x38c8ff,2));ring.position.y=5.4;ring.rotation.x=Math.PI/2;ud.spin.push([ring,1.4,'z']);
      const l=light(0,7.7,0);g.add(l);ud.lights.push(l);break;}
    case 'solar':{
      add(G.merge([slab(2,2,0x4a4d52),G.cyl(0.3,0.4,2.6,6,steel,{y:1.5})]));
      const pan=new THREE.Group();pan.position.y=3;
      const parts=[G.box(7,0.25,6,0x1c3a6c,{}),G.box(0.15,0.3,6.1,0xb0c4d8,{x:-1.75}),G.box(0.15,0.3,6.1,0xb0c4d8,{x:1.75}),G.box(0.15,0.3,6.1,0xb0c4d8,{x:0}),G.box(7.1,0.3,0.15,0xb0c4d8,{z:0})];
      pan.add(mesh(G.merge(parts)));g.add(pan);ud.panel=pan;
      const l=light(0,2.6,1.2);g.add(l);ud.lights.push(l);break;}
    case 'coal_gen':{
      base();
      add(G.merge([G.box(8,4.4,6,0x3a3f46,{y:2.9,x:-0.5}),G.box(8.2,0.5,6.2,dark,{y:5.3,x:-0.5}),G.cyl(0.9,1.1,8,8,0x4a4e55,{x:-2.5,y:9,z:1.6}),G.cyl(0.9,1.1,8,8,0x4a4e55,{x:-2.5,y:9,z:-1.6}),G.box(2.6,2.2,4,steel,{x:-5,y:2,rz:0}),G.cyl(0.3,0.3,5,5,0xb0743a,{x:1.5,y:6.2,z:0,rx:Math.PI/2})]));
      const m=add(new THREE.BoxGeometry(0.2,1.6,3.6),glow(0xff6a10,2.2));m.position.set(3.55,2.4,0);ud.glows.push(m);
      const l=light(3.6,5.2,2.4);g.add(l);ud.lights.push(l);break;}
    case 'nuclear':{
      base();
      add(G.merge([G.cyl(4.4,5.6,13,14,0x8a8f96,{y:7.5,x:-2.5,z:0}),G.cyl(4.5,4.5,0.6,14,dark,{y:14,x:-2.5}),G.blob(3.6,0x59616b,{x:4.5,y:3,sy:0.9},0.05,1),G.cyl(0.6,0.6,8,6,steel,{x:1,y:3,rz:Math.PI/2,z:0})]));
      const m=add(new THREE.SphereGeometry(1.8,10,8),glow(0x58ff6a,2.2));m.position.set(4.5,4.2,0);ud.glows.push(m);
      const l=light(6.5,5.5,0);g.add(l);ud.lights.push(l);break;}
  }
  return g;
}
const ghostMat={ok:new THREE.MeshBasicMaterial({color:0x44ff88,transparent:true,opacity:0.45,depthWrite:false}),bad:new THREE.MeshBasicMaterial({color:0xff4444,transparent:true,opacity:0.45,depthWrite:false})};
export function makeGhost(type){
  const g=type==='belt'?beltGhost():makeModel(type);
  g.traverse(o=>{if(o.isMesh){o.userData.keep=true;o.material=ghostMat.ok;o.castShadow=false;}});
  return g;
}
function beltGhost(){const g=new THREE.Group();g.add(new THREE.Mesh(new THREE.BoxGeometry(4,0.5,2.4),ghostMat.ok));const a=new THREE.Mesh(new THREE.ConeGeometry(0.8,1.6,3),ghostMat.ok);a.rotation.z=-Math.PI/2;a.position.y=0.7;g.add(a);return g;}
export function setGhostValid(g,ok){g.traverse(o=>{if(o.isMesh)o.material=ok?ghostMat.ok:ghostMat.bad;});}

// Belts and item instancing
export class BeltRenderer{
  constructor(scene,cap=4000,itemCap=6000){
    this.cap=cap;const c=document.createElement('canvas');c.width=64;c.height=64;const x=c.getContext('2d');x.fillStyle='#2a2d33';x.fillRect(0,0,64,64);x.fillStyle='#3c414a';
    for(let i=0;i<2;i++){x.beginPath();x.moveTo(i*32,8);x.lineTo(i*32+14,32);x.lineTo(i*32,56);x.lineTo(i*32+8,56);x.lineTo(i*32+22,32);x.lineTo(i*32+8,8);x.fill();}
    x.fillStyle='#ffb02e';for(let i=0;i<2;i++){x.beginPath();x.moveTo(i*32+4,22);x.lineTo(i*32+14,32);x.lineTo(i*32+4,42);x.lineTo(i*32+8,42);x.lineTo(i*32+18,32);x.lineTo(i*32+8,22);x.fill();}
    this.tex=new THREE.CanvasTexture(c);this.tex.wrapS=this.tex.wrapT=THREE.RepeatWrapping;this.tex.repeat.set(2,1);this.tex.colorSpace=THREE.SRGBColorSpace;
    this.top=new THREE.InstancedMesh(new THREE.BoxGeometry(4,0.3,2.2),new THREE.MeshStandardMaterial({map:this.tex,roughness:0.8,metalness:0.2}),cap);
    this.rail=new THREE.InstancedMesh(G.merge([G.box(4,0.55,0.2,0x8a9099,{z:1.2,y:0.1}),G.box(4,0.55,0.2,0x8a9099,{z:-1.2,y:0.1}),G.box(4,0.15,2.6,0x3a3e44,{y:-0.2})]),stdMat,cap);
    for(const m of [this.top,this.rail]){m.count=0;m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;scene.add(m);}
    this.free=[];this.n=0;
    this.items=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({roughness:0.6,metalness:0.3}),itemCap);
    this.items.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(itemCap*3),3);this.items.count=0;this.items.frustumCulled=false;this.items.castShadow=true;scene.add(this.items);this.itemCap=itemCap;
    this.cols={};for(const k in ITEMS)this.cols[k]=new THREE.Color(ITEMS[k].color);
  }
  alloc(){const i=this.free.length?this.free.pop():this.n++;this.top.count=this.rail.count=this.n;return i;}
  release(i){const z=new THREE.Matrix4().makeScale(0,0,0);this.top.setMatrixAt(i,z);this.rail.setMatrixAt(i,z);this.free.push(i);this.top.instanceMatrix.needsUpdate=this.rail.instanceMatrix.needsUpdate=true;}
  set(i,x,y0,y1,z,dx,dz){
    const dy=y1-y0,len=Math.hypot(CELL,dy),m=new THREE.Matrix4(),q=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,Math.atan2(-dz,dx),0,'YXZ')),
      q2=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.atan2(dy,CELL));q.multiply(q2);
    m.compose(new THREE.Vector3(x,(y0+y1)/2+0.2,z),q,new THREE.Vector3(len/CELL,1,1));
    this.top.setMatrixAt(i,m);this.rail.setMatrixAt(i,m);this.top.instanceMatrix.needsUpdate=this.rail.instanceMatrix.needsUpdate=true;
  }
  scroll(dt){this.tex.offset.x=(this.tex.offset.x-dt*2)%1;}
  beginItems(){this.ic=0;this._m=this._m||new THREE.Matrix4();this._q=this._q||new THREE.Quaternion();this._p=this._p||new THREE.Vector3();this._s=this._s||new THREE.Vector3();}
  item(type,x,y,z,yaw){
    if(this.ic>=this.itemCap)return;const sh=ITEMS[type].shape,m=this._m;
    this._q.setFromAxisAngle(SIDE.up||(SIDE.up=new THREE.Vector3(0,1,0)),yaw);this._p.set(x,y,z);this._s.set(sh[0],sh[1],sh[2]);m.compose(this._p,this._q,this._s);
    this.items.setMatrixAt(this.ic,m);this.items.setColorAt(this.ic,this.cols[type]);this.ic++;
  }
  endItems(){this.items.count=this.ic;this.items.instanceMatrix.needsUpdate=true;if(this.items.instanceColor)this.items.instanceColor.needsUpdate=true;}
}
