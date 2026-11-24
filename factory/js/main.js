import * as THREE from 'three';
import {World,B,BIOME_NAMES} from './world.js';
import {placeNodes,createNodeMeshes,nodeLabel} from './nodes.js';
import {Vegetation} from './vegetation.js';
import {Sky} from './sky.js';
import {Wildlife} from './wildlife.js';
import {Factory,recipesFor,RMAP} from './factory.js';
import {Player} from './player.js';
import {UI} from './ui.js';
import {sfx} from './audio.js';
import {WORLD,HALF,CELL,SEG,ITEMS,RECIPES,BUILDINGS,START_UNLOCKED,START_INV,MILESTONES,RESOURCES,PURITY} from './data.js';

const $=id=>document.getElementById(id);
const SAVE='ironvale-save-v1';
class Inventory{constructor(){this.c={};}get(k){return this.c[k]||0;}add(k,n=1){this.c[k]=(this.c[k]||0)+n;}has(k,n=1){return this.get(k)>=n;}remove(k,n=1){this.c[k]=Math.max(0,this.get(k)-n);}
  canAfford(cost){return Object.entries(cost).every(([k,n])=>this.has(k,n));}pay(cost){for(const k in cost)this.remove(k,cost[k]);}}

const game={inv:new Inventory(),stats:{mined:0,supply:0,demand:0,kills:0},unlocked:new Set(START_UNLOCKED),done:[],delivered:{},sunk:0,beacon:false,time:0,scanned:false};
window.ironvale=game;
const setLoad=(p,t)=>{$('loadfill').style.width=(p*100)+'%';$('loadtxt').textContent=t;};
const yieldUI=()=>new Promise(r=>setTimeout(r,16));

async function init(){
  const renderer=new THREE.WebGLRenderer({canvas:$('gl'),antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setSize(innerWidth,innerHeight);
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,0.1,3500);
  addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
  setLoad(0.02,'Shaping the terrain…');await yieldUI();
  const world=new World(1337);await world.generate(p=>setLoad(0.02+p*0.35,'Shaping the terrain…'));
  setLoad(0.4,'Reading the land…');await yieldUI();world.paintAll();
  setLoad(0.45,'Seeding resource cores…');await yieldUI();
  const nodes=placeNodes(world);
  const terrain=world.buildMesh();scene.add(terrain);
  const water=makeWater();scene.add(water.mesh);
  createNodeMeshes(nodes,world,scene);
  setLoad(0.55,'Growing forests…');await yieldUI();
  const veg=new Vegetation(world,scene,nodes);
  setLoad(0.75,'Releasing wildlife…');await yieldUI();
  const sky=new Sky(scene,renderer);game.sky=sky;
  const wild=new Wildlife(world,scene,sky);
  const factory=new Factory(world,scene,veg,game);factory.nodes=nodes;game.factory=factory;game.nodes=nodes;game.world=world;
  const player=new Player(world,veg,factory,camera,scene);game.player=player;game.wild=wild;
  setLoad(0.9,'Surveying…');await yieldUI();
  const ui=new UI(game,{world,nodes,factory,player,sky,camera,wild});game.ui=ui;
  game.notify=ui.notify.bind(ui);
  START_INV&&Object.entries(START_INV).forEach(([k,v])=>game.inv.add(k,v));
  // ---- game logic helpers
  game.curMilestone=()=>MILESTONES.find(m=>!game.done.includes(m.id));
  game.depotAccept=type=>{
    const m=game.curMilestone();
    if(m){const need=m.req[type];if(!need||(game.delivered[type]||0)>=need)return false;game.delivered[type]=(game.delivered[type]||0)+1;game.checkMilestone();return true;}
    game.sunk++;return true;
  };
  game.checkMilestone=()=>{
    const m=game.curMilestone();if(!m)return;
    if(Object.entries(m.req).every(([k,n])=>(game.delivered[k]||0)>=n)){
      game.done.push(m.id);game.delivered={};
      for(const u of m.unlock){game.unlocked.add(u);if(u==='boots')player.speedMul=1.35;if(u==='beacon'){game.beacon=true;}}
      game.notify(`Milestone complete: ${m.name}`,'good');game.notify(m.text,'good');sfx.unlock();if(game.curMilestone())game.notify('Next: '+game.curMilestone().name);
      ui.refreshMilestones&&ui.refreshMilestones();
    }
  };
  game.craft=(rid,n=1)=>{
    const r=RMAP[rid];for(let i=0;i<n;i++){if(!game.inv.canAfford(r.in))break;game.inv.pay(r.in);for(const k in r.out)game.inv.add(k,r.out[k]);}sfx.ui();
  };
  game.deposit=(item,n)=>{const m=game.curMilestone();if(!m)return;const need=(m.req[item]||0)-(game.delivered[item]||0);const q=Math.min(n,need,game.inv.get(item));if(q>0){game.inv.remove(item,q);game.delivered[item]=(game.delivered[item]||0)+q;game.checkMilestone();sfx.ui();}};
  game.save=()=>{
    try{localStorage.setItem(SAVE,JSON.stringify({v:1,inv:game.inv.c,unlocked:[...game.unlocked],done:game.done,delivered:game.delivered,sunk:game.sunk,time:sky.time,
      pos:[player.pos.x,player.pos.y,player.pos.z],yaw:player.yaw,hp:player.hp,disc:nodes.filter(n=>n.discovered).map(n=>n.id),buildings:factory.serialize(),stats:game.stats}));return true;}catch(e){console.warn(e);return false;}
  };
  game.hasSave=()=>!!localStorage.getItem(SAVE);
  game.loadSave=()=>{
    try{const s=JSON.parse(localStorage.getItem(SAVE));if(!s)return false;
      game.inv.c=s.inv;game.unlocked=new Set(s.unlocked);game.done=s.done;game.delivered=s.delivered||{};game.sunk=s.sunk||0;sky.time=s.time;
      player.pos.set(...s.pos);player.yaw=s.yaw;player.hp=s.hp||100;Object.assign(game.stats,s.stats||{});
      for(const id of s.disc||[])nodes[id]&&(nodes[id].discovered=true);
      factory.load(s.buildings||[]);if(game.unlocked.has('boots'))player.speedMul=1.35;
      return true;}catch(e){console.warn(e);return false;}
  };
  setLoad(1,'Ready');
  $('btnNew').classList.remove('hidden');if(game.hasSave())$('btnContinue').classList.remove('hidden');
  $('loadbar').classList.add('hidden');
  const start=(cont)=>{
    if(cont){game.loadSave();}else{localStorage.removeItem(SAVE);game.notify('Welcome to Ironvale. Find a glowing resource node and build a Miner (Q).');game.notify('Hold E on a node to mine by hand. Swing with LMB.');}
    $('title').classList.add('hidden');$('hud').classList.remove('hidden');ui.lock();game.running=true;
  };
  $('btnNew').onclick=()=>start(false);$('btnContinue').onclick=()=>start(true);
  $('btnQuit').onclick=()=>{localStorage.removeItem(SAVE);location.reload();};
  setInterval(()=>{if(game.running)game.save();},30000);addEventListener('beforeunload',()=>{if(game.running)game.save();});
  game.start=start;

  // ---- main loop
  const clock=new THREE.Clock();let frames=0,fps=60,fpsT=0;
  function loop(){
    requestAnimationFrame(loop);
    const dt=Math.min(clock.getDelta(),0.05);game.time+=dt;
    if(game.running){
      const active=ui.active();
      player.update(dt,active);
      if(!ui.paused()){sky.update(dt,player.pos);factory.update(dt);wild.update(dt,player,game.time);}
      ui.update(dt);
    }else{sky.update(dt*0.3,player.pos);camera.position.set(Math.cos(game.time*0.04)*60,world.heightAt(0,0)+25,Math.sin(game.time*0.04)*60);camera.lookAt(0,world.heightAt(0,0)+8,0);}
    veg.update(dt,game.time,camera.position.x,camera.position.z);
    factory.animate(dt,player.pos,sky.sunDir);
    water.update(game.time,camera.position,sky);
    nodes.forEach(n=>{if(n.discovered&&n.beam)n.beam.visible=true;});
    renderer.render(scene,camera);
    fpsT+=dt;frames++;if(fpsT>1){fps=frames/fpsT;frames=0;fpsT=0;game.fps=fps;}
  }
  loop();
}
function makeWater(){
  const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),id=x.createImageData(128,128);
  for(let j=0;j<128;j++)for(let i=0;i<128;i++){const a=Math.sin(i/128*Math.PI*6)*0.5+Math.sin(j/128*Math.PI*8+i/40)*0.5,b=Math.sin((i+j)/128*Math.PI*10)*0.5;const o=(j*128+i)*4;id.data[o]=128+a*50;id.data[o+1]=128+b*50;id.data[o+2]=255;id.data[o+3]=255;}
  x.putImageData(id,0,0);const nm=new THREE.CanvasTexture(c);nm.wrapS=nm.wrapT=THREE.RepeatWrapping;nm.repeat.set(220,220);
  const mat=new THREE.MeshStandardMaterial({color:0x2a7fa6,roughness:0.08,metalness:0.25,transparent:true,opacity:0.8,normalMap:nm,normalScale:new THREE.Vector2(0.5,0.5)});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(WORLD*1.6,WORLD*1.6),mat);mesh.rotation.x=-Math.PI/2;mesh.position.y=0;mesh.renderOrder=2;
  return {mesh,update(t,cam,sky){nm.offset.set(t*0.004,t*0.0025);mat.color.setHex(0x2a7fa6).multiplyScalar(0.25+0.75*sky.daylight);mesh.position.x=0;}};
}
init().catch(e=>{console.error(e);document.getElementById('loadtxt').textContent='Error: '+e.message;});
