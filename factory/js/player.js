import * as THREE from 'three';
import {HALF} from './data.js';

export class Player{
  constructor(world,veg,factory,camera,scene){
    this.world=world;this.veg=veg;this.factory=factory;this.camera=camera;
    this.pos=new THREE.Vector3(0,world.heightAt(0,0)+1,0);this.vel=new THREE.Vector3();
    this.yaw=0.6;this.pitch=-0.1;this.onGround=false;this.sprinting=false;this.inWater=false;this.hp=100;this.maxHp=100;this.jumpMul=1;this.dead=false;this.speedMul=1;this.fly=false;
    this.keys={};this.hurt=0;this.swing=0;this.mining=0;this.bob=0;this.hitFlash=0;this.regenT=0;this.deathT=0;
    // held pickaxe
    const m=new THREE.MeshStandardMaterial({color:0x9a9fa8,metalness:0.7,roughness:0.4}),wm=new THREE.MeshStandardMaterial({color:0x7a5230,roughness:0.9});
    const g=new THREE.Group();const h=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.035,0.8,6),wm);h.position.y=0.1;const hd=new THREE.Mesh(new THREE.BoxGeometry(0.45,0.07,0.07),m);hd.position.y=0.5;
    const tip=new THREE.Mesh(new THREE.ConeGeometry(0.05,0.15,4),m);tip.position.set(0.28,0.5,0);tip.rotation.z=-Math.PI/2;const tip2=tip.clone();tip2.position.x=-0.28;tip2.rotation.z=Math.PI/2;
    g.add(h,hd,tip,tip2);g.scale.setScalar(0.5);g.position.set(0.5,-0.5,-0.9);g.rotation.set(0.3,0.2,-0.2);camera.add(g);scene.add(camera);this.tool=g;this.toolRest=g.position.clone();
  }
  setSpawn(){this.pos.set(0,this.world.heightAt(0,0)+1,0);this.vel.set(0,0,0);}
  damage(n,fx,fz){
    if(this.dead)return;this.hp-=n;this.hitFlash=0.4;
    const dx=this.pos.x-fx,dz=this.pos.z-fz,d=Math.hypot(dx,dz)||1;this.vel.x+=dx/d*4;this.vel.z+=dz/d*4;this.vel.y+=2;
    this.regenT=6;if(this.onDamage)this.onDamage(n);
    if(this.hp<=0){this.hp=0;this.dead=true;this.deathT=0;if(this.onDeath)this.onDeath();}
  }
  respawn(){this.hp=this.maxHp;this.dead=false;this.setSpawn();}
  look(dx,dy){this.yaw-=dx*0.0022;this.pitch=Math.max(-1.5,Math.min(1.5,this.pitch-dy*0.0022));}
  forward(){return new THREE.Vector3(-Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),-Math.cos(this.yaw)*Math.cos(this.pitch));}
  eye(){return new THREE.Vector3(this.pos.x,this.pos.y+1.65,this.pos.z);}
  update(dt,active){
    const w=this.world,k=this.keys;
    if(this.dead){this.deathT+=dt;if(this.deathT>3.5)this.respawn();}
    const fx=-Math.sin(this.yaw),fz=-Math.cos(this.yaw),rx=-fz,rz=fx;
    let mx=0,mz=0;
    if(active&&!this.dead){if(k['KeyW']){mx+=fx;mz+=fz;}if(k['KeyS']){mx-=fx;mz-=fz;}if(k['KeyD']){mx+=rx;mz+=rz;}if(k['KeyA']){mx-=rx;mz-=rz;}}
    let l=Math.hypot(mx,mz);if(l>0){mx/=l;mz/=l;}
    const st=this.stick;if(active&&!this.dead&&st&&(st.x||st.y)){const a=Math.min(1,Math.hypot(st.x,st.y));mx=fx*-st.y+rx*st.x;mz=fz*-st.y+rz*st.x;const n=Math.hypot(mx,mz)||1;mx=mx/n*a;mz=mz/n*a;l=a;}
    this.sprinting=active&&(k['ShiftLeft']||k['ShiftRight']||k['TouchSprint'])&&l>0;
    const ground=w.heightAt(this.pos.x,this.pos.z);
    this.inWater=ground<-0.4&&this.pos.y<0.7;
    let sp=(this.sprinting?13:7)*this.speedMul;if(this.inWater)sp=4.2;if(this.fly)sp=this.sprinting?60:25;
    const acc=this.onGround||this.inWater||this.fly?14:3;
    this.vel.x+=(mx*sp-this.vel.x)*Math.min(1,acc*dt);this.vel.z+=(mz*sp-this.vel.z)*Math.min(1,acc*dt);
    if(this.fly){const vy=(active&&k['Space']?1:0)-(active&&k['KeyC']?1:0);this.vel.y+=(vy*sp*0.7-this.vel.y)*Math.min(1,10*dt);}
    else if(this.inWater){this.vel.y+=(-this.vel.y)*Math.min(1,3*dt);this.vel.y+=(0.2-this.pos.y)*3*dt+(active&&k['Space']?25*dt:0);this.vel.y-=6*dt;}
    else{this.vel.y-=24*dt;if(active&&k['Space']&&this.onGround&&!this.dead){this.vel.y=8.4*this.jumpMul;this.onGround=false;}}
    // move with collisions
    const np=this.pos.clone().addScaledVector(this.vel,dt);
    const tryX=new THREE.Vector3(np.x,this.pos.y,this.pos.z);if(this.factory.blocked(tryX.x,tryX.z,0.45)&&this.pos.y<(this.factory.blocked(tryX.x,tryX.z,0.45).y||0)+5){np.x=this.pos.x;this.vel.x=0;}
    const tryZ=new THREE.Vector3(np.x,this.pos.y,np.z);if(this.factory.blocked(tryZ.x,tryZ.z,0.45)&&this.pos.y<(this.factory.blocked(tryZ.x,tryZ.z,0.45).y||0)+5){np.z=this.pos.z;this.vel.z=0;}
    np.x=Math.max(-HALF+6,Math.min(HALF-6,np.x));np.z=Math.max(-HALF+6,Math.min(HALF-6,np.z));
    this.veg.collide(np,0.45);
    const gy=w.heightAt(np.x,np.z);
    // slope limit
    if(this.onGround&&gy-this.pos.y>1.1&&!this.fly){np.x=this.pos.x;np.z=this.pos.z;this.vel.x*=0.2;this.vel.z*=0.2;}
    this.pos.copy(np);
    const gh=w.heightAt(this.pos.x,this.pos.z);
    if(this.pos.y<=gh){if(!this.fly&&this.vel.y<-16&&!this.inWater){this.damage(Math.min(60,(-this.vel.y-16)*3),this.pos.x,this.pos.z);}this.pos.y=gh;this.vel.y=Math.max(0,this.vel.y);this.onGround=true;}
    else this.onGround=this.pos.y-gh<0.08&&this.vel.y<=0;
    if(this.onGround&&this.pos.y-gh<0.3)this.pos.y=gh;
    this.hitFlash=Math.max(0,this.hitFlash-dt);
    if(this.regenT>0)this.regenT-=dt;else if(!this.dead&&this.hp<this.maxHp)this.hp=Math.min(this.maxHp,this.hp+2*dt);
    this.swing=Math.max(0,this.swing-dt*3.2);
    // camera
    const spd=Math.hypot(this.vel.x,this.vel.z);this.bob+=dt*spd*1.1;
    const bobY=this.onGround?Math.sin(this.bob)*0.035*Math.min(1,spd/6):0;
    const eyeY=this.dead?0.4:1.65;
    this.camera.position.set(this.pos.x,this.pos.y+eyeY+bobY,this.pos.z);
    this.camera.rotation.order='YXZ';this.camera.rotation.set(this.dead?-0.2:this.pitch,this.yaw,this.dead?Math.min(1.4,this.deathT*3):0);
    const sw=this.swing,mine=this.mining>0?Math.abs(Math.sin(performance.now()*0.012))*0.7:0;
    this.tool.position.set(this.toolRest.x+Math.sin(this.bob*0.5)*0.01,this.toolRest.y+Math.abs(Math.sin(this.bob))*0.012,this.toolRest.z);
    this.tool.rotation.set(0.3-Math.sin(sw*Math.PI)*1.5-mine*1.2,0.2,-0.2);
    this.tool.visible=!this.hideTool&&!this.dead;
  }
}
