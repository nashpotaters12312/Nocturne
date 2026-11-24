import * as THREE from 'three';
import {mulberry32} from './noise.js';
import {RESOURCES,PURITY,CELL,HALF} from './data.js';
import {B} from './world.js';
import * as G from './geo.js';

const DEFS={
  iron_ore:{count:22,biomes:[B.GRASS,B.FOREST,B.ROCK,B.DESERT],near:[70,160]},
  copper_ore:{count:16,biomes:[B.GRASS,B.SWAMP,B.FOREST,B.SAND],near:[90,190]},
  limestone:{count:16,biomes:[B.GRASS,B.SAND,B.FOREST,B.DESERT],near:[80,170]},
  coal:{count:14,biomes:[B.FOREST,B.ROCK,B.SWAMP],near:[160,300]},
  caterium_ore:{count:11,biomes:[B.ROCK,B.DESERT,B.SNOW]},
  sulfur:{count:11,biomes:[B.DESERT,B.ROCK,B.SWAMP]},
  quartz:{count:12,biomes:[B.SNOW,B.ROCK,B.DESERT]},
  bauxite:{count:11,biomes:[B.SWAMP,B.ROCK,B.FOREST]},
  uranium:{tol:6.5,count:7,biomes:[B.SNOW,B.ROCK],minH:24},
  tin_ore:{count:14,biomes:[B.GRASS,B.SWAMP,B.SAND,B.FOREST],near:[100,210]},
  titanium_ore:{tol:6.5,count:9,biomes:[B.SNOW,B.ROCK],minH:14},
  ruby_ore:{count:9,biomes:[B.DESERT,B.ROCK]},
};
export function placeNodes(world,seed=5){
  const rng=mulberry32(seed),nodes=[];
  const free=(x,z,r)=>nodes.every(n=>Math.hypot(n.x-x,n.z-z)>r);
  const flat=(x,z,tol=3.2)=>{let mn=1e9,mx=-1e9;for(let a=-8;a<=8;a+=4)for(let b=-8;b<=8;b+=4){const h=world.heightAt(x+a,z+b);mn=Math.min(mn,h);mx=Math.max(mx,h);}return mx-mn<tol&&mn>2.2;};
  const snap=v=>Math.round(v/CELL)*CELL;
  const purity=()=>{const r=rng();return r<0.3?0:r<0.78?1:2;};
  for(const [type,def] of Object.entries(DEFS)){
    let made=0,clusters=0;
    while(made<def.count&&clusters<400){
      clusters++;
      let x,z,ok=false;
      for(let t=0;t<3000&&!ok;t++){
        if(def.near&&made===0){const a=rng()*Math.PI*2,d=def.near[0]+rng()*(def.near[1]-def.near[0]);x=snap(Math.cos(a)*d);z=snap(Math.sin(a)*d);}
        else{x=snap((rng()*2-1)*(HALF-120));z=snap((rng()*2-1)*(HALF-120));}
        if(!flat(x,z,def.tol)||!free(x,z,42))continue;
        if(!(def.near&&made===0)&&!def.biomes.includes(world.biomeAt(x,z)))continue;
        if(def.minH&&world.heightAt(x,z)<def.minH)continue;
        ok=true;
      }
      if(!ok)continue;
      const size=made===0?1+(rng()<0.5?1:0):1+Math.floor(rng()*3);
      const group=[{x,z}];
      for(let k=1;k<size;k++){
        for(let t=0;t<40;t++){const a=rng()*Math.PI*2,d=16+rng()*8,px=snap(x+Math.cos(a)*d),pz=snap(z+Math.sin(a)*d);
          if(flat(px,pz,def.tol)&&free(px,pz,13)&&group.every(g=>Math.hypot(g.x-px,g.z-pz)>12)){group.push({x:px,z:pz});break;}}
      }
      for(const p of group){if(made>=def.count)break;
        let pu=purity();if(made===0&&def.near)pu=1;
        nodes.push({id:nodes.length,type,x:p.x,z:p.z,y:0,purity:pu,occupied:null,discovered:false,seed:rng()*100});made++;}
    }
  }
  for(const n of nodes){
    const h=world.heightAt(n.x,n.z);world.flatDisc(n.x,n.z,9,h);n.y=world.heightAt(n.x,n.z);
    world.tint(n.x,n.z,8.5,RESOURCES[n.type].color,0.8);
  }
  return nodes;
}
export function createNodeMeshes(nodes,world,scene){
  const rockMat=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:0.9});
  const crystalMats={};
  const group=new THREE.Group();scene.add(group);
  const beamGeo=new THREE.CylinderGeometry(0.35,0.35,140,8,1,true);
  for(const n of nodes){
    const col=RESOURCES[n.type].color,rr=mulberry32(Math.floor(n.seed*1000));
    const rocks=[],crys=[];
    const rc=new THREE.Color(0x4a4742).lerp(new THREE.Color(col),0.18);
    for(let k=0;k<4;k++){const a=rr()*6.28,d=k===0?0:2+rr()*2.2;
      rocks.push(G.blob(1.6+rr()*1.3,rc,{x:Math.cos(a)*d,y:0.6,z:Math.sin(a)*d,sy:0.7,seed:k+n.seed},0.4,1));}
    const nc=n.purity===2?8:n.purity===1?5:3;
    for(let k=0;k<nc;k++){const a=rr()*6.28,d=rr()*2.6,h=1.2+rr()*2.2+n.purity*0.5;
      crys.push(G.cone(0.35+rr()*0.25,h,5,0xffffff,{x:Math.cos(a)*d,y:1.1+h/2,z:Math.sin(a)*d,rx:(rr()-.5)*0.7,rz:(rr()-.5)*0.7,jit:0.12}));}
    const rock=new THREE.Mesh(G.merge(rocks),rockMat);
    if(!crystalMats[n.type])crystalMats[n.type]=new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:n.type==='coal'?0.15:0.9,flatShading:true,roughness:0.35,metalness:n.type==='coal'?0.6:0});
    const cr=new THREE.Mesh(G.merge(crys),crystalMats[n.type]);
    const g=new THREE.Group();g.add(rock,cr);g.position.set(n.x,n.y,n.z);g.rotation.y=rr()*6;
    rock.castShadow=cr.castShadow=true;
    const beam=new THREE.Mesh(beamGeo,new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.13,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}));
    beam.position.y=70;beam.visible=false;g.add(beam);
    n.mesh=g;n.beam=beam;group.add(g);
  }
  return group;
}
export function nodeLabel(n){return `${RESOURCES[n.type].name} Node (${PURITY[n.purity].name})`;}
