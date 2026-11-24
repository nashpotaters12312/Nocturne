import * as THREE from 'three';
import {mulberry32} from './noise.js';
import {WORLD,HALF} from './data.js';
import {B} from './world.js';
import * as G from './geo.js';
import {Q} from './quality.js';

// species: body dims, colors, behaviour
const SP={
  deer:{n:'Deer',biomes:[B.GRASS,B.FOREST],count:9,herd:[3,6],hp:30,walk:2,run:10,flee:30,beh:'prey',s:1,meat:3,
    m:{L:2.1,H:1.0,W:0.7,leg:1.3,lt:0.14,head:0.42,neck:0.9,c:0xa8703c,belly:0xe8d8b8,tail:0xe8e0d0,antler:true,ear:true}},
  rabbit:{n:'Rabbit',biomes:[B.GRASS,B.FOREST,B.DESERT],count:16,herd:[1,3],hp:6,walk:1.5,run:9,flee:16,beh:'prey',hop:true,s:1,meat:1,
    m:{L:0.5,H:0.3,W:0.26,leg:0.2,lt:0.07,head:0.16,neck:0.1,c:0x9a8468,belly:0xeeeeee,tail:0xffffff,ear:true,earL:0.3}},
  hare:{n:'Snow Hare',biomes:[B.SNOW,B.ROCK],count:12,herd:[1,2],hp:6,walk:1.5,run:11,flee:18,beh:'prey',hop:true,s:1.1,meat:1,
    m:{L:0.55,H:0.32,W:0.28,leg:0.22,lt:0.08,head:0.17,neck:0.1,c:0xf2f4f8,belly:0xffffff,tail:0xffffff,ear:true,earL:0.35}},
  boar:{n:'Wild Boar',biomes:[B.FOREST,B.SWAMP,B.GRASS],count:10,herd:[1,3],hp:55,walk:2,run:8,flee:0,beh:'neutral',aggro:7,dmg:9,s:1,meat:4,
    m:{L:1.4,H:0.8,W:0.6,leg:0.5,lt:0.15,head:0.45,neck:0.3,c:0x4a3a30,belly:0x5a4a3c,tail:0x3a2a22,tusk:true,snout:true,ear:true}},
  wolf:{n:'Wolf',biomes:[B.FOREST,B.ROCK,B.SNOW],count:9,herd:[2,4],hp:50,walk:2.5,run:11,flee:0,beh:'hunter',aggro:34,dmg:7,s:1,meat:3,
    m:{L:1.3,H:0.65,W:0.42,leg:0.7,lt:0.1,head:0.34,neck:0.35,c:0x6e7176,belly:0xa4a6ac,tail:0x55585c,snout:true,ear:true,tailL:0.8}},
  bear:{n:'Brown Bear',biomes:[B.FOREST,B.ROCK],count:8,herd:[1,1],hp:150,walk:2,run:7.5,flee:0,beh:'neutral',aggro:11,dmg:22,s:1,meat:8,
    m:{L:2.2,H:1.3,W:1.1,leg:0.8,lt:0.3,head:0.6,neck:0.3,c:0x5a3d28,belly:0x4a3220,tail:0x4a3220,snout:true,ear:true,hump:true}},
  goat:{n:'Mountain Goat',biomes:[B.ROCK,B.SNOW],count:12,herd:[2,4],hp:35,walk:2,run:9,flee:22,beh:'prey',s:1,meat:3,
    m:{L:1.3,H:0.75,W:0.45,leg:0.8,lt:0.1,head:0.3,neck:0.4,c:0xe8e4da,belly:0xffffff,tail:0xdddddd,horn:true,ear:true}},
  camel:{n:'Camel',biomes:[B.DESERT],count:12,herd:[2,4],hp:80,walk:2,run:8,flee:20,beh:'prey',s:1,meat:6,
    m:{L:2.4,H:1.2,W:0.9,leg:1.7,lt:0.15,head:0.4,neck:1.4,c:0xc59a5c,belly:0xd8b878,tail:0xb08848,hump:true,ear:true}},
  scorpion:{n:'Sand Scorpion',biomes:[B.DESERT],count:12,herd:[1,2],hp:25,walk:1.8,run:6,flee:0,beh:'hunter',aggro:14,dmg:6,s:1,meat:1,crawl:true,
    m:{L:0.9,H:0.25,W:0.5,leg:0.2,lt:0.05,head:0.2,neck:0.1,c:0x8a3a1a,belly:0x6a2a12,tail:0x8a3a1a,scorp:true}},
  lizard:{n:'Desert Lizard',biomes:[B.DESERT,B.SAND],count:12,herd:[1,2],hp:5,walk:1.5,run:7,flee:10,beh:'prey',crawl:true,s:1,meat:1,
    m:{L:0.55,H:0.12,W:0.14,leg:0.12,lt:0.04,head:0.12,neck:0.05,c:0x7a9a3a,belly:0xb8c870,tail:0x6a8a30,tailL:0.7}},
  frog:{n:'Swamp Frog',biomes:[B.SWAMP],count:12,herd:[2,5],hp:3,walk:1,run:6,flee:8,beh:'prey',hop:true,s:1,meat:0,
    m:{L:0.3,H:0.2,W:0.24,leg:0.12,lt:0.06,head:0.14,neck:0.02,c:0x3f9a4a,belly:0xd8e8a0,tail:0x3f9a4a,tailL:0.01}},
};
function buildAnimal(m,sp){
  const parts=[],hy=m.leg+m.H/2,fx=m.L/2;
  parts.push(G.box(m.L,m.H,m.W,m.c,{y:hy,jit:0.05}));
  parts.push(G.box(m.L*0.8,m.H*0.4,m.W*0.9,m.belly,{y:hy-m.H*0.35,jit:0.03}));
  const hx=fx+m.neck*0.35,hyy=hy+m.H*0.25+m.neck*0.45;
  if(m.neck>0.05)parts.push(G.box(m.neck*0.9,m.H*0.45+m.neck*0.2,m.W*0.55,m.c,{x:fx*0.9+m.neck*0.15,y:hy+m.H*0.25+m.neck*0.2,rz:-0.6-m.neck*0.12,sx:1}));
  parts.push(G.box(m.head*1.3,m.head,m.head*0.85,m.c,{x:hx+m.head*0.4,y:hyy,jit:0.04}));
  if(m.snout)parts.push(G.box(m.head*0.7,m.head*0.5,m.head*0.5,m.belly,{x:hx+m.head*1.05,y:hyy-m.head*0.18}));
  if(m.ear)for(const s of [-1,1])parts.push(G.cone(m.head*0.22,(m.earL||m.head*0.6),4,m.c,{x:hx+m.head*0.1,y:hyy+m.head*0.7,z:s*m.head*0.32,rz:-0.2,rx:s*0.25}));
  if(m.antler)for(const s of [-1,1]){parts.push(G.cyl(0.03,0.04,0.7,4,0xd8ccb0,{x:hx+m.head*0.1,y:hyy+m.head*1.1,z:s*m.head*0.3,rx:s*0.3}));
    parts.push(G.cyl(0.025,0.03,0.4,4,0xd8ccb0,{x:hx+m.head*0.35,y:hyy+m.head*1.5,z:s*m.head*0.5,rz:-0.8,rx:s*0.3}));}
  if(m.horn)for(const s of [-1,1])parts.push(G.cone(0.05,0.5,4,0x2a2622,{x:hx,y:hyy+m.head*0.8,z:s*m.head*0.3,rz:0.7,rx:s*0.2}));
  if(m.tusk)for(const s of [-1,1])parts.push(G.cone(0.04,0.22,4,0xf0e8d0,{x:hx+m.head*0.9,y:hyy-m.head*0.35,z:s*m.head*0.3,rz:-0.3}));
  if(m.hump)parts.push(G.blob(m.H*0.55,m.c,{x:-m.L*0.1,y:hy+m.H*0.55,sy:0.9},0.1,1));
  parts.push(G.box(m.tailL||m.L*0.2,0.1+m.W*0.18,0.1+m.W*0.18,m.tail,{x:-fx-(m.tailL||m.L*0.2)/2*0.8,y:hy+m.H*0.25,rz:0.5}));
  if(m.scorp){parts.push(G.box(0.1,0.1,0.1,m.c,{}));for(let i=0;i<4;i++)parts.push(G.box(0.14,0.14,0.14,m.c,{x:-fx-0.1-i*0.05,y:hy+0.1+i*0.15,jit:0.02}));parts.push(G.cone(0.07,0.2,4,0x2a1008,{x:-fx-0.3,y:hy+0.75,rz:2.4}));
    for(const s of [-1,1])parts.push(G.box(0.4,0.1,0.14,m.c,{x:fx+0.3,y:hy,z:s*0.3,ry:s*0.4}));}
  const body=G.merge(parts);
  const legG=G.box(m.lt,m.leg,m.lt,m.c,{y:-m.leg/2,jit:0.03});
  return {body,legG,m,hy};
}
const DEAD=Symbol('dead');
export class Wildlife{
  constructor(world,scene,sky,seed=21){
    this.world=world;this.scene=scene;this.sky=sky;this.rng=mulberry32(seed);this.animals=[];this.birds=[];this.fish=[];this.group=new THREE.Group();scene.add(this.group);this.t=0;
    this.mat=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:0.9});
    this.build();this.buildBirds();this.buildFish();this.buildFireflies();
  }
  randPos(biomes){
    const w=this.world,rng=this.rng;
    for(let t=0;t<600;t++){const x=(rng()*2-1)*(HALF-100),z=(rng()*2-1)*(HALF-100);if(Math.hypot(x,z)<70)continue;
      const h=w.heightAt(x,z);if(h<1.2||w.slopeAt(x,z)>0.8)continue;if(biomes.includes(w.biomeAt(x,z)))return [x,z];}
    return null;
  }
  build(){
    const rng=this.rng;
    for(const [id,sp] of Object.entries(SP)){
      const model=buildAnimal(sp.m,sp);sp.model=model;
      const herds=sp.count;
      for(let hd=0;hd<herds;hd++){
        const p=this.randPos(sp.biomes);if(!p)continue;
        const k=sp.herd[0]+Math.floor(rng()*(sp.herd[1]-sp.herd[0]+1));
        for(let i=0;i<k;i++)this.spawn(id,p[0]+(rng()-.5)*14,p[1]+(rng()-.5)*14,hd);
      }
    }
  }
  spawn(id,x,z,herd){
    const sp=SP[id],w=this.world,model=sp.model,g=new THREE.Group(),sc=sp.s*(0.9+this.rng()*0.25);
    const body=new THREE.Mesh(model.body,this.mat);body.castShadow=true;g.add(body);
    const legs=[];const m=sp.m,hy=model.hy;
    const L=sp.m.leg>0?[[m.L*0.38,m.W*0.33],[m.L*0.38,-m.W*0.33],[-m.L*0.38,m.W*0.33],[-m.L*0.38,-m.W*0.33]]:[];
    for(const [lx,lz] of L){const lg=new THREE.Group();lg.position.set(lx,m.leg,lz);const lm=new THREE.Mesh(model.legG,this.mat);lg.add(lm);g.add(lg);legs.push(lg);}
    g.scale.setScalar(sc);g.position.set(x,w.heightAt(x,z),z);g.rotation.y=this.rng()*6.28;g.visible=false;this.group.add(g);
    const a={id,sp,g,body,legs,x,z,y:g.position.y,yaw:g.rotation.y,hp:sp.hp,state:'idle',timer:this.rng()*3,tx:x,tz:z,hx:x,hz:z,speed:0,phase:this.rng()*6,herd,dead:false,deadT:0,hopT:0,atk:0,sc,pitch:0,hurt:0};
    this.animals.push(a);return a;
  }
  buildBirds(){
    const rng=this.rng,mk=(c,s)=>{const g=new THREE.Group();g.add(new THREE.Mesh(G.merge([G.box(0.4*s,0.25*s,0.9*s,c,{}),G.box(0.2*s,0.2*s,0.3*s,c,{z:0.55*s,y:0.05*s})]),this.mat));
      const wg=G.box(1.1*s,0.04,0.45*s,c,{x:0.55*s});const wg2=G.box(1.1*s,0.04,0.45*s,c,{x:-0.55*s});
      const L=new THREE.Group(),R=new THREE.Group();L.add(new THREE.Mesh(wg,this.mat));R.add(new THREE.Mesh(wg2,this.mat));L.position.x=0.15*s;R.position.x=-0.15*s;g.add(L,R);g.userData={L,R};return g;};
    for(let f=0;f<Q.birds;f++){
      const x=(rng()*2-1)*(HALF-150),z=(rng()*2-1)*(HALF-150),vulture=this.world.biomeAt(x,z)===B.DESERT,n=vulture?2+Math.floor(rng()*2):4+Math.floor(rng()*5);
      for(let i=0;i<n;i++){const g=mk(vulture?0x2a2420:[0x4a6a8a,0xb85a3a,0x3a3a3a,0xd0d0d8][f%4],vulture?2.2:1);g.visible=false;this.group.add(g);
        this.birds.push({g,cx:x,cz:z,r:25+rng()*30+(vulture?30:0),a:rng()*6.28,sp:(vulture?9:14)/(30),alt:vulture?55:28+rng()*14,ph:rng()*6,off:rng()*6.28});}
    }
  }
  buildFish(){
    const rng=this.rng,w=this.world,fm=G.merge([G.box(0.8,0.25,0.2,0x6f98a8,{}),G.cone(0.14,0.3,4,0x5f8898,{x:-0.5,rz:Math.PI/2}),G.box(0.12,0.3,0.03,0x4f7888,{y:0.18})]);
    let tries=0;
    while(this.fish.length<70&&tries++<4000){
      const x=(rng()*2-1)*(HALF-100),z=(rng()*2-1)*(HALF-100);if(w.heightAt(x,z)>-1.6)continue;
      const k=3+Math.floor(rng()*4);const cx=x,cz=z;
      for(let i=0;i<k;i++){const m=new THREE.Mesh(fm,this.mat);m.visible=false;this.group.add(m);this.fish.push({m,x:x+rng()*6,z:z+rng()*6,yaw:rng()*6,tx:x,tz:z,t:0,jump:0,sp:2+rng()*2,ph:rng()*6});}
    }
  }
  buildFireflies(){
    const n=260,pos=new Float32Array(n*3),ph=new Float32Array(n);for(let i=0;i<n;i++){pos[i*3]=(Math.random()-.5)*110;pos[i*3+1]=0.5+Math.random()*3;pos[i*3+2]=(Math.random()-.5)*110;ph[i]=Math.random()*6;}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('ph',new THREE.BufferAttribute(ph,1));
    this.ffU={uTime:{value:0},uVis:{value:0}};
    this.ff=new THREE.Points(g,new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:this.ffU,
      vertexShader:'attribute float ph;uniform float uTime;varying float vA;void main(){vec3 p=position;p.x+=sin(uTime*0.6+ph*3.)*2.;p.z+=cos(uTime*0.5+ph*5.)*2.;p.y+=sin(uTime*0.9+ph)*0.6;vec4 mv=modelViewMatrix*vec4(p,1.);vA=0.5+0.5*sin(uTime*2.+ph*9.);gl_PointSize=clamp(120./-mv.z,2.,9.);gl_Position=projectionMatrix*mv;}',
      fragmentShader:'varying float vA;uniform float uVis;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(0.8,1.,0.35,(1.-d*2.)*vA*uVis);}'}));
    this.ff.frustumCulled=false;this.ff.visible=Q.fireflies;this.ffBase=pos.slice();this.scene.add(this.ff);
  }
  // damage from player; returns {killed,meat}
  hit(a,dmg,from){
    if(a.dead)return null;a.hp-=dmg;a.hurt=0.25;
    if(a.hp<=0){a.dead=true;a.state='dead';a.deadT=0;return {killed:true,meat:a.sp.meat,name:a.sp.n};}
    if(a.sp.beh!=='prey'||a.sp.aggro){a.state='chase';a.aggroT=12;}else{a.state='flee';a.timer=6;}
    return {killed:false,name:a.sp.n};
  }
  nearestInFront(pos,dir,range){
    let best=null,bd=range;
    for(const a of this.animals){if(a.dead||!a.g.visible)continue;const dx=a.x-pos.x,dz=a.z-pos.z,d=Math.hypot(dx,dz);
      if(d>bd+a.sc)continue;const dot=(dx*dir.x+dz*dir.z)/(d||1);if(dot<0.65&&d>1.6)continue;
      if(Math.abs(a.y+0.5-pos.y)>3.5)continue;if(d<bd){bd=d;best=a;}}
    return best;
  }
  update(dt,player,time){
    this.t+=dt;const w=this.world,pp=player.pos,night=1-this.sky.daylight;
    for(const a of this.animals){
      const dx=pp.x-a.x,dz=pp.z-a.z,dist=Math.hypot(dx,dz);
      if(dist>Q.animalR){a.g.visible=false;continue;}
      a.g.visible=true;
      if(a.dead){a.deadT+=dt;a.g.rotation.order='YXZ';a.g.rotation.y=a.yaw-Math.PI/2;a.g.rotation.x=Math.min(1.5,a.deadT*3);a.g.position.y=a.y-Math.min(0.2,a.deadT*0.3);if(a.deadT>25){a.g.position.y-=(a.deadT-25)*0.5;if(a.deadT>30)a.g.visible=false;}continue;}
      const sp=a.sp;a.timer-=dt;a.hurt=Math.max(0,a.hurt-dt);
      // behaviour
      if(sp.beh==='prey'&&dist<sp.flee*(player.sprinting?1.2:1)&&a.state!=='flee'&&!player.dead){a.state='flee';a.timer=3+Math.random()*3;}
      const aggro=sp.aggro?sp.aggro*(sp.beh==='hunter'?(1+night*0.5):1):0;
      if(sp.aggro&&a.state!=='chase'&&!player.dead&&dist<(sp.beh==='hunter'?aggro:aggro*(a.hurt>0?2:1))&&(sp.beh==='hunter'||player.sprinting===false&&dist<aggro)){a.state='chase';a.aggroT=10;}
      let spd=0,tx=a.tx,tz=a.tz;
      if(a.state==='flee'){const d=Math.max(dist,1);tx=a.x-dx/d*30;tz=a.z-dz/d*30;spd=sp.run;if(a.timer<0&&dist>sp.flee*1.3){a.state='idle';a.timer=2;}}
      else if(a.state==='chase'){tx=pp.x;tz=pp.z;spd=sp.run;a.aggroT-=dt;a.atk-=dt;
        if(dist<1.8*a.sc+0.6){spd=0;if(a.atk<=0){a.atk=1.1;player.damage(sp.dmg*(0.85+Math.random()*0.3),a.x,a.z);a.lunge=0.25;}}
        if(player.dead||a.aggroT<0&&dist>aggro*1.4){a.state='idle';a.timer=2;}}
      else if(a.state==='idle'){spd=0;if(a.timer<0){a.state='wander';a.timer=4+Math.random()*6;
          const ang=Math.random()*6.28,r=6+Math.random()*14;a.tx=a.hx+Math.cos(ang)*r;a.tz=a.hz+Math.sin(ang)*r;}}
      else if(a.state==='wander'){tx=a.tx;tz=a.tz;spd=sp.walk;if(a.timer<0||Math.hypot(a.tx-a.x,a.tz-a.z)<2){a.state='idle';a.timer=2+Math.random()*6;a.hx+=(a.x-a.hx)*0.4;a.hz+=(a.z-a.hz)*0.4;}}
      if(spd>0){
        const want=Math.atan2(tx-a.x,tz-a.z);let df=want-a.yaw;while(df>Math.PI)df-=6.283;while(df<-Math.PI)df+=6.283;
        a.yaw+=Math.max(-1,Math.min(1,df))*Math.min(1,dt*(a.state==='chase'||a.state==='flee'?7:3.5));
        const turnSlow=Math.abs(df)>1.2?0.3:1,mv=spd*turnSlow*dt;
        const nx=a.x+Math.sin(a.yaw)*mv,nz=a.z+Math.cos(a.yaw)*mv,nh=w.heightAt(nx,nz);
        if(nh<0.2||Math.abs(nh-a.y)>2.4*mv+0.3&&Math.abs(nh-a.y)/mv>1.4){a.state='idle';a.timer=1;spd=0;if(nh<0.2){a.yaw+=2.2;}}
        else{a.x=nx;a.z=nz;}
        a.speed=spd;
      }else a.speed*=0.9;
      const gy=w.heightAt(a.x,a.z);a.y+= (gy-a.y)*Math.min(1,dt*12);
      // pitch to slope
      const f=w.heightAt(a.x+Math.sin(a.yaw)*sp.m.L*0.5,a.z+Math.cos(a.yaw)*sp.m.L*0.5),b2=w.heightAt(a.x-Math.sin(a.yaw)*sp.m.L*0.5,a.z-Math.cos(a.yaw)*sp.m.L*0.5);
      a.pitch+=(Math.atan2(b2-f,sp.m.L*a.sc)-a.pitch)*Math.min(1,dt*6);
      const g=a.g;g.position.set(a.x,a.y,a.z);g.rotation.set(0,0,0);g.rotation.order='YXZ';g.rotation.y=a.yaw-Math.PI/2;g.rotation.z=-a.pitch;
      // lunge
      if(a.lunge>0){a.lunge-=dt;g.position.x+=Math.sin(a.yaw)*Math.sin(a.lunge*12)*0.6;g.position.z+=Math.cos(a.yaw)*Math.sin(a.lunge*12)*0.6;}
      // animate
      a.phase+=dt*(a.speed*1.9+0.3);const amp=Math.min(1,a.speed/3)*0.8;
      if(sp.hop){a.hopT+=dt*(a.speed>0.1?(a.state==='flee'?9:5):0);const hh=a.speed>0.1?Math.abs(Math.sin(a.hopT))*(sp.m.L*1.2):0;g.position.y+=hh;
        a.legs.forEach((l,i)=>l.rotation.z=(i<2?-1:1)*Math.sin(a.hopT)*amp*0.9);}
      else a.legs.forEach((l,i)=>{l.rotation.z=Math.sin(a.phase+(i===0||i===3?0:Math.PI))*amp*(sp.crawl?1.2:1);});
      if(a.hurt>0)a.body.position.y=Math.sin(a.hurt*60)*0.03;else a.body.position.y=a.speed>0.1?Math.abs(Math.sin(a.phase))*0.05:0;
      if(sp.m.neck>0.8&&!sp.crawl&&a.state==='idle')g.rotation.x=0;
    }
    // birds
    for(const b of this.birds){
      const d=Math.hypot(b.cx-pp.x,b.cz-pp.z);if(d>b.r+Q.animalR+70){b.g.visible=false;continue;}b.g.visible=true;
      b.a+=b.sp*dt;const x=b.cx+Math.cos(b.a)*b.r,z=b.cz+Math.sin(b.a)*b.r,y=w.heightAt(x,z)+b.alt+Math.sin(time*0.5+b.ph)*3;
      b.g.position.set(x,Math.max(y,4),z);b.g.rotation.y=-b.a;b.g.rotation.z=-0.25;
      const fl=Math.sin(time*9+b.ph)*0.55*(Math.sin(time*0.7+b.ph)>0.4?0.15:1);b.g.userData.L.rotation.z=fl;b.g.userData.R.rotation.z=-fl;
    }
    // fish
    for(const f of this.fish){
      const d=Math.hypot(f.x-pp.x,f.z-pp.z);if(d>Q.animalR*0.55){f.m.visible=false;continue;}f.m.visible=true;
      f.t-=dt;if(f.t<0){f.t=2+Math.random()*4;f.tx=f.x+(Math.random()-.5)*24;f.tz=f.z+(Math.random()-.5)*24;if(w.heightAt(f.tx,f.tz)>-1.4){f.tx=f.x;f.tz=f.z;}if(Math.random()<0.08&&f.jump<=0)f.jump=1;}
      const want=Math.atan2(f.tz-f.z,f.tx-f.x);let df=want-f.yaw;while(df>Math.PI)df-=6.283;while(df<-Math.PI)df+=6.283;f.yaw+=df*Math.min(1,dt*2);
      f.x+=Math.cos(f.yaw)*f.sp*dt;f.z+=Math.sin(f.yaw)*f.sp*dt;if(w.heightAt(f.x,f.z)>-1.2){f.yaw+=3;f.x-=Math.cos(f.yaw)*0.2;}
      let y=-0.7+Math.sin(time*2+f.ph)*0.08;
      if(f.jump>0){f.jump-=dt*1.1;y=-0.3+Math.sin((1-Math.max(f.jump,0))*Math.PI)*1.6;}
      f.m.position.set(f.x,y,f.z);f.m.rotation.set(0,-f.yaw,f.jump>0?Math.cos((1-f.jump)*Math.PI)*0.9:0);f.m.rotation.order='YXZ';
      f.m.children.length;f.m.scale.z=1+Math.sin(time*9+f.ph)*0.0;
    }
    // fireflies
    const vis=night*(this.sky.daylight<0.5?1:0);const b=w.biomeAt(pp.x,pp.z);
    this.ffU.uTime.value=time;this.ffU.uVis.value=(b===B.FOREST||b===B.SWAMP||b===B.GRASS)?Math.min(1,night*1.4):0;
    this.ff.position.set(Math.round(pp.x/110)*110*0+pp.x,w.heightAt(pp.x,pp.z),pp.z);
  }
}
