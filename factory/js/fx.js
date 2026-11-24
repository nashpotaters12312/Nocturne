import * as THREE from 'three';
// Debris particles and floating pickup text for mining.
export class FX{
  constructor(scene,cap=160){
    this.mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({roughness:0.8,flatShading:true}),cap);
    this.mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(cap*3),3);this.mesh.count=0;this.mesh.frustumCulled=false;scene.add(this.mesh);
    this.p=[];this.cap=cap;this.m=new THREE.Matrix4();this.q=new THREE.Quaternion();this.e=new THREE.Euler();this.v=new THREE.Vector3();this.s=new THREE.Vector3();this.c=new THREE.Color();
    this.layer=document.getElementById('hud');
  }
  burst(pos,color,n=10,spd=4){
    for(let i=0;i<n;i++){if(this.p.length>=this.cap)this.p.shift();
      this.p.push({x:pos.x,y:pos.y,z:pos.z,vx:(Math.random()-.5)*spd,vy:Math.random()*spd*0.9+1,vz:(Math.random()-.5)*spd,r:Math.random()*6,s:0.08+Math.random()*0.14,t:0,life:0.6+Math.random()*0.5,col:color});}
  }
  popup(text,color='#fff'){
    const d=document.createElement('div');d.className='popup';d.textContent=text;d.style.color=color;
    d.style.left=(50+(Math.random()-.5)*6)+'%';this.layer.appendChild(d);setTimeout(()=>d.remove(),1100);
  }
  update(dt){
    let k=0;
    for(let i=this.p.length-1;i>=0;i--){const p=this.p[i];p.t+=dt;if(p.t>p.life){this.p.splice(i,1);continue;}
      p.vy-=14*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.r+=dt*8;
      const f=1-p.t/p.life;this.e.set(p.r,p.r*0.7,0);this.q.setFromEuler(this.e);this.v.set(p.x,p.y,p.z);this.s.setScalar(p.s*(0.4+0.6*f));
      this.m.compose(this.v,this.q,this.s);this.mesh.setMatrixAt(k,this.m);this.c.set(p.col);this.mesh.setColorAt(k,this.c);k++;}
    this.mesh.count=k;this.mesh.instanceMatrix.needsUpdate=true;this.mesh.instanceColor.needsUpdate=true;
  }
}
