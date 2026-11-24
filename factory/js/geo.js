import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_e=new THREE.Euler(),_p=new THREE.Vector3(),_s=new THREE.Vector3();
export function prep(geo,color,o={}){
  const g=geo.index?geo.toNonIndexed():geo.clone();
  g.deleteAttribute('uv');
  _e.set(o.rx||0,o.ry||0,o.rz||0);_q.setFromEuler(_e);_p.set(o.x||0,o.y||0,o.z||0);
  const sc=o.s||1;_s.set((o.sx||1)*sc,(o.sy||1)*sc,(o.sz||1)*sc);
  _m.compose(_p,_q,_s);g.applyMatrix4(_m);
  const c=new THREE.Color(color),n=g.attributes.position.count,arr=new Float32Array(n*3),jit=o.jit??0.07;
  for(let i=0;i<n;i+=3){const k=1+(Math.random()-0.5)*2*jit;for(let v=0;v<3;v++){const a=(i+v)*3;arr[a]=c.r*k;arr[a+1]=c.g*k;arr[a+2]=c.b*k;}}
  g.setAttribute('color',new THREE.BufferAttribute(arr,3));
  return g;
}
export const box=(w,h,d,c,o)=>prep(new THREE.BoxGeometry(w,h,d),c,o);
export const cyl=(rt,rb,h,seg,c,o)=>prep(new THREE.CylinderGeometry(rt,rb,h,seg),c,o);
export const cone=(r,h,seg,c,o)=>prep(new THREE.ConeGeometry(r,h,seg),c,o);
export function blob(r,c,o={},j=0.28,detail=1){
  const g=new THREE.IcosahedronGeometry(r,detail),p=g.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const h=Math.sin(x*12.9898+y*78.233+z*37.719+(o.seed||0))*43758.5453;
    const k=1+((h-Math.floor(h))-0.5)*j;p.setXYZ(i,x*k,y*k,z*k);
  }
  return prep(g,c,o);
}
export const merge=a=>mergeGeometries(a,false);
export function windify(mat,uniform,amp=0.1){
  mat.onBeforeCompile=sh=>{
    sh.uniforms.uTime=uniform;
    sh.vertexShader='uniform float uTime;\n'+sh.vertexShader.replace('#include <begin_vertex>',
`#include <begin_vertex>
#ifdef USE_INSTANCING
float sw=sin(uTime*1.7+instanceMatrix[3].x*0.35+instanceMatrix[3].z*0.27)*${amp.toFixed(3)}*max(position.y,0.0)*0.35;
transformed.x+=sw;transformed.z+=sw*0.6;
#endif`);
  };
}
