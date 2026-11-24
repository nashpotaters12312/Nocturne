import * as THREE from 'three';
import {RESOURCES} from './data.js';

// Small pool of drifting dust puffs thrown up by working miners.
export class Dust{
  constructor(scene,cap=260){
    this.cap=cap;this.i=0;
    const pos=new Float32Array(cap*3),col=new Float32Array(cap*3);
    this.vel=new Float32Array(cap*3);this.age=new Float32Array(cap).fill(9);this.life=new Float32Array(cap).fill(1);
    for(let k=0;k<cap;k++)pos[k*3+1]=-9999;
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));
    const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),gr=x.createRadialGradient(32,32,2,32,32,30);
    gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=gr;x.fillRect(0,0,64,64);
    const m=new THREE.PointsMaterial({size:2.4,map:new THREE.CanvasTexture(c),vertexColors:true,transparent:true,opacity:0.55,depthWrite:false,sizeAttenuation:true,fog:true});
    this.pts=new THREE.Points(g,m);this.pts.frustumCulled=false;scene.add(this.pts);
    this.tint={};for(const k in RESOURCES)this.tint[k]=new THREE.Color(RESOURCES[k].color).lerp(new THREE.Color(0x8a8378),0.55);
  }
  emit(x,y,z,type){
    const k=this.i;this.i=(this.i+1)%this.cap;const p=this.pts.geometry.attributes.position.array,c=this.pts.geometry.attributes.color.array,t=this.tint[type]||this.tint.iron_ore;
    p[k*3]=x;p[k*3+1]=y;p[k*3+2]=z;c[k*3]=t.r;c[k*3+1]=t.g;c[k*3+2]=t.b;
    this.vel[k*3]=(Math.random()-0.5)*1.6;this.vel[k*3+1]=1.2+Math.random()*1.6;this.vel[k*3+2]=(Math.random()-0.5)*1.6;
    this.age[k]=0;this.life[k]=1.2+Math.random()*0.9;
  }
  update(dt){
    const p=this.pts.geometry.attributes.position.array;let any=false;
    for(let k=0;k<this.cap;k++){
      if(this.age[k]>=this.life[k]){if(p[k*3+1]>-9000)p[k*3+1]=-9999;continue;}
      this.age[k]+=dt;any=true;
      p[k*3]+=this.vel[k*3]*dt;p[k*3+1]+=this.vel[k*3+1]*dt;p[k*3+2]+=this.vel[k*3+2]*dt;this.vel[k*3+1]*=1-0.5*dt;
    }
    this.pts.geometry.attributes.position.needsUpdate=true;this.pts.geometry.attributes.color.needsUpdate=true;
  }
}
