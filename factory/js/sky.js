import * as THREE from 'three';
import {smooth,lerp,mulberry32} from './noise.js';
import {Q} from './quality.js';

export const DAY_LEN=540;
export class Sky{
  constructor(scene,renderer){
    this.scene=scene;this.time=0.33; // 0..1 (0.25 sunrise, 0.5 noon, 0.75 sunset)
    this.sunDir=new THREE.Vector3();
    this.sun=new THREE.DirectionalLight(0xfff2dd,3);this.sun.castShadow=Q.shadows;
    const sm=Q.shadowMap||512,sr=sm>1024?90:65;this.sun.shadow.mapSize.set(sm,sm);const sc=this.sun.shadow.camera;sc.left=sc.bottom=-sr;sc.right=sc.top=sr;sc.near=1;sc.far=500;this.sun.shadow.bias=-0.0006;this.sun.shadow.normalBias=0.4;
    scene.add(this.sun,this.sun.target);
    this.hemi=new THREE.HemisphereLight(0x9ec8ff,0x4a4030,0.8);scene.add(this.hemi);
    this.fog=new THREE.FogExp2(0xb8d4ee,0.0032);scene.fog=this.fog;
    const uni={uSun:{value:this.sunDir},uZen:{value:new THREE.Color()},uHor:{value:new THREE.Color()},uNight:{value:0},uSunCol:{value:new THREE.Color()}};
    this.uni=uni;
    this.dome=new THREE.Mesh(new THREE.SphereGeometry(Math.min(3000,Q.far*0.85),24,12),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:uni,
      vertexShader:'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec3 vP;uniform vec3 uSun,uZen,uHor,uSunCol;uniform float uNight;
      void main(){vec3 d=normalize(vP);float h=clamp(d.y,-0.2,1.);
        vec3 c=mix(uHor,uZen,pow(max(h,0.),0.55));
        float s=max(dot(d,normalize(uSun)),0.);
        c+=uSunCol*(pow(s,6.)*0.35+pow(s,300.)*3.0);
        float m=max(dot(d,-normalize(uSun)),0.);c+=vec3(0.75,0.8,0.95)*pow(m,900.)*2.0*uNight;
        if(d.y<0.)c=mix(c,uHor*0.8,smoothstep(0.,-0.2,d.y));
        gl_FragColor=vec4(c,1.);}`}));
    this.dome.renderOrder=-10;scene.add(this.dome);
    // stars
    const rng=mulberry32(4),sp=new Float32Array(1500*3);
    for(let i=0;i<1500;i++){const u=rng()*2-1,a=rng()*6.283,r=Math.sqrt(1-u*u);const y=Math.abs(u);sp[i*3]=Math.cos(a)*r*2800;sp[i*3+1]=y*2800;sp[i*3+2]=Math.sin(a)*r*2800;}
    const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(sp,3));
    this.stars=new THREE.Points(sg,new THREE.PointsMaterial({color:0xffffff,size:6,sizeAttenuation:false,transparent:true,opacity:0,fog:false,depthWrite:false}));this.stars.size=1.5;this.scene.add(this.stars);
    // clouds
    this.clouds=new THREE.Group();const cm=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.85,fog:false,depthWrite:false});this.cloudMat=cm;
    for(let i=0;i<Q.clouds;i++){
      const g=new THREE.Group(),n=4+Math.floor(rng()*5);
      for(let k=0;k<n;k++){const s=new THREE.Mesh(new THREE.IcosahedronGeometry(30+rng()*40,Q.clouds>30?1:0),cm);s.position.set((k-n/2)*45+rng()*20,rng()*10,rng()*40);s.scale.y=0.35;g.add(s);}
      const a=rng()*6.283,d=300+rng()*1700;g.position.set(Math.cos(a)*d,260+rng()*140,Math.sin(a)*d);g.rotation.y=rng()*6;this.clouds.add(g);
    }
    scene.add(this.clouds);
    this.update(0,new THREE.Vector3());
  }
  get daylight(){return smooth(-0.05,0.25,this.sunDir.y);}
  get hour(){return (this.time*24)%24;}
  update(dt,playerPos){
    this.time=(this.time+dt/DAY_LEN)%1;
    const a=(this.time-0.25)*Math.PI*2;
    this.sunDir.set(Math.cos(a)*0.85,Math.sin(a),Math.cos(a)*0.3+0.25).normalize();
    const day=smooth(-0.08,0.22,this.sunDir.y),dusk=1-Math.abs(this.sunDir.y*3.2);const glow=smooth(0,1,Math.max(0,Math.min(1,dusk)))*smooth(-0.15,0.05,this.sunDir.y);
    const zen=new THREE.Color(0x02030a).lerp(new THREE.Color(0x2f6fc4),day);
    const hor=new THREE.Color(0x070a16).lerp(new THREE.Color(0xa6cdef),day).lerp(new THREE.Color(0xff8a4a),glow*0.75);
    this.uni.uZen.value.copy(zen);this.uni.uHor.value.copy(hor);this.uni.uNight.value=1-day;
    this.uni.uSunCol.value.set(1,0.75,0.45).multiplyScalar(smooth(-0.1,0.1,this.sunDir.y));
    this.fog.color.copy(hor).lerp(new THREE.Color(0x889ab0),0.1);this.fog.density=lerp(0.0045,0.0031,day)*Q.fogMul;
    const up=this.sunDir.y>0?1:0,moon=!up;
    const L=moon?new THREE.Vector3(-this.sunDir.x,-this.sunDir.y,-this.sunDir.z):this.sunDir;
    this.sun.position.copy(playerPos).addScaledVector(L,250);this.sun.target.position.copy(playerPos);
    this.sun.color.set(moon?0x8fa6ff:new THREE.Color(0xfff0d8).lerp(new THREE.Color(0xff9a55),glow));
    this.sun.intensity=moon?0.35*(1-day):3.0*smooth(-0.02,0.3,this.sunDir.y)+0.2;
    this.hemi.intensity=0.12+0.78*day;this.hemi.color.set(0x7090c0).lerp(new THREE.Color(0xb4d6ff),day);this.hemi.groundColor.set(0x1a1a22).lerp(new THREE.Color(0x6a6a50),day);
    this.stars.material.opacity=smooth(0.1,-0.15,this.sunDir.y);this.stars.position.copy(playerPos);this.dome.position.copy(playerPos);
    this.cloudMat.color.set(0x10131c).lerp(new THREE.Color(0xffffff),day).lerp(new THREE.Color(0xffb890),glow*0.6);
    for(const c of this.clouds.children){c.position.x+=dt*4;if(c.position.x>2200)c.position.x=-2200;}
  }
}
