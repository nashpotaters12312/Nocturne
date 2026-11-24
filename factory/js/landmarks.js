import * as THREE from 'three';
import * as G from './geo.js';
import {mulberry32} from './noise.js';
import {HALF} from './data.js';
import {B} from './world.js';

// Hand-made points of interest scattered through the world.
export function buildLandmarks(world,scene,veg,nodes){
  const rng=mulberry32(77),mat=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:0.85,metalness:0.1});
  const metal=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:0.5,metalness:0.6});
  const out=[];
  const put=(geo,x,z,yaw,m=mat,sink=0.3,clear=8)=>{
    const y=world.heightAt(x,z)-sink,o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.rotation.y=yaw;o.castShadow=o.receiveShadow=true;scene.add(o);
    veg.removeRect(x-clear,z-clear,x+clear,z+clear,0);out.push({x,z,o});return o;};
  const col=(x,z,yaw,lx,lz,r)=>{const c=Math.cos(yaw),s=Math.sin(yaw);veg.addCollider(x+lx*c+lz*s,z-lx*s+lz*c,r);};
  const nearNode=(x,z,r)=>nodes.some(n=>Math.hypot(n.x-x,n.z-z)<r);
  const find=(biomes,minD=120)=>{for(let t=0;t<800;t++){const x=(rng()*2-1)*(HALF-110),z=(rng()*2-1)*(HALF-110);
      if(Math.hypot(x,z)<minD||nearNode(x,z,30)||out.some(o=>Math.hypot(o.x-x,o.z-z)<90))continue;
      if(world.heightAt(x,z)<2||world.slopeAt(x,z)>0.3||!biomes.includes(world.biomeAt(x,z)))continue;return [x,z];}return null;};

  // 1. Crashed drop pod near the landing site
  {const x=16,z=-14,yaw=0.7;
    const pod=G.merge([G.cyl(2.2,2.6,7,10,0xb9bcc0,{y:3,}),G.cone(2.2,3,10,0xd07a1e,{y:7.6,x:-1.25,}),G.cyl(2.7,2.7,0.6,10,0x3a3d42,{y:0.6,x:0.95,}),
      G.box(0.25,5,1.2,0xd07a1e,{x:2.2,y:3.2,z:0,}),G.box(2,0.2,1.6,0x3a3d42,{x:3,y:0.4,z:2.3,ry:0.4,rz:0.2}),G.box(1.4,0.15,1,0xb9bcc0,{x:-3.5,y:0.2,z:-2.5,ry:1.2}),
      G.box(3.2,0.3,0.6,0x3a3d42,{x:-1,y:0.3,z:3.6,ry:-0.3}),G.blob(2.6,0x4a3d2e,{x:2,y:-0.6,z:0,sy:0.4},0.4)]);
    const po=put(pod,x,z,yaw,metal,0.9,9);po.rotation.order='YXZ';po.rotation.x=0.55;po.rotation.z=0.15;col(x,z,yaw,0,0,2.8);
    const glow=new THREE.Mesh(new THREE.BoxGeometry(0.1,1.2,0.8),new THREE.MeshStandardMaterial({color:0x6fc8ff,emissive:0x6fc8ff,emissiveIntensity:1.2}));
    glow.position.set(x+0.8,world.heightAt(x,z)+3,z-1.6);glow.rotation.y=yaw;scene.add(glow);}
  // 2. Standing stone circles in the grassland
  for(let i=0;i<5;i++){const p=find([B.GRASS]);if(!p)break;const [x,z]=p,n=7+Math.floor(rng()*4),R=7+rng()*4,parts=[];
    for(let k=0;k<n;k++){const a=k/n*6.283;if(rng()<0.15)continue;const h=2.5+rng()*2;parts.push(G.box(1.1,h,0.7,0x8d8a82,{x:Math.cos(a)*R,y:h/2-0.3,z:Math.sin(a)*R,ry:-a,rz:(rng()-0.5)*0.15,jit:0.1}));}
    parts.push(G.box(2.6,0.5,1.4,0x7d7a72,{y:0.2,jit:0.1}));put(G.merge(parts),x,z,rng()*6,mat,0.2,R+3);
    for(let k=0;k<n;k++){const a=k/n*6.283;veg.addCollider(x+Math.cos(a)*R,z+Math.sin(a)*R,0.7);}}
  // 3. Rock arches in the desert
  for(let i=0;i<5;i++){const p=find([B.DESERT]);if(!p)break;const [x,z]=p,s=1+rng()*0.6,yaw=rng()*6;
    put(G.merge([G.blob(2.2*s,0x9a6a50,{x:-5*s,y:3.5*s,sy:2.2},0.3),G.blob(2.2*s,0x946650,{x:5*s,y:3.5*s,sy:2.2},0.3),G.blob(2*s,0xa07258,{y:8.5*s,sx:3.6,sy:0.7},0.3),
      G.blob(1.5*s,0x8a5c46,{x:-3*s,y:7.5*s,sy:0.8},0.3),G.blob(1.5*s,0x8a5c46,{x:3*s,y:7.5*s,sy:0.8},0.3)]),x,z,yaw,mat,0.5,9*s);
    col(x,z,yaw,-5*s,0,2.2*s);col(x,z,yaw,5*s,0,2.2*s);}
  // 4. Overgrown ruins in the forest
  for(let i=0;i<5;i++){const p=find([B.FOREST,B.SWAMP]);if(!p)break;const [x,z]=p,yaw=rng()*6,parts=[];
    const wall=(lx,lz,len,h,ry)=>{for(let k=0;k<len;k++){const hh=h*(0.4+rng()*0.6);parts.push(G.box(1.9,hh,0.8,0x7c7a70,{x:lx+Math.cos(ry)*k*2,y:hh/2-0.2,z:lz-Math.sin(ry)*k*2,ry,jit:0.12}));
      if(rng()<0.4)parts.push(G.blob(0.5,0x4c6038,{x:lx+Math.cos(ry)*k*2,y:hh,z:lz-Math.sin(ry)*k*2,sy:0.5},0.5,0));}};
    wall(-5,-5,5,3.5,0);wall(-5,-5,5,3,-Math.PI/2);wall(5,-5,3,2.5,-Math.PI/2);
    for(let k=0;k<4;k++)parts.push(G.cyl(0.5,0.6,1+rng()*4,7,0x8a877c,{x:-2+k*1.6,y:1,z:2+rng(),jit:0.1}));
    parts.push(G.box(2.2,0.4,0.9,0x8a877c,{x:1,y:0.2,z:-1,ry:0.5,rz:0.2}));
    put(G.merge(parts),x,z,yaw,mat,0.2,9);for(let k=0;k<5;k++){col(x,z,yaw,-5+k*2,-5,1);col(x,z,yaw,-5,-5+k*2,1);}}
  // 5. Abandoned survey towers on high ground
  for(let i=0;i<4;i++){const p=find([B.ROCK,B.SNOW],150);if(!p)break;const [x,z]=p,yaw=rng()*6,parts=[];
    for(const [a,b] of [[-1.5,-1.5],[1.5,-1.5],[-1.5,1.5],[1.5,1.5]])parts.push(G.cyl(0.15,0.2,10,5,0x6a6e74,{x:a*0.8,y:5,z:b*0.8,rx:-b*0.05,rz:a*0.05}));
    for(let k=1;k<4;k++)parts.push(G.box(3,0.12,0.12,0x6a6e74,{y:k*2.6,z:1.2}),G.box(0.12,0.12,3,0x6a6e74,{y:k*2.6+0.5,x:1.2}));
    parts.push(G.box(3.2,0.3,3.2,0x55585e,{y:10}),G.box(2.4,1.6,2.4,0x9a5a2a,{y:11,rz:0.1}),G.cyl(0.05,0.05,3,4,0x2a2c30,{y:13.2}));
    parts.push(G.box(2.4,0.2,1.4,0x9a5a2a,{x:3,y:0.1,z:2,ry:0.6,rz:0.3}));
    put(G.merge(parts),x,z,yaw,metal,0.1,4);col(x,z,yaw,0,0,1.8);}
  return out;
}
