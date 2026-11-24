import * as THREE from 'three';
import {B,BIOME_NAMES} from './world.js';
import {ITEMS,RECIPES,BUILDINGS,MILESTONES,RESOURCES,PURITY,CELL,HALF,SEG,UPGRADES} from './data.js';
import {level as QLEVEL,Q} from './quality.js';
import {nodeLabel} from './nodes.js';
import {recipesFor,RMAP} from './factory.js';
import {sfx} from './audio.js';
import {HEIGHT} from './models.js';
import {MINE} from './vegetation.js';
import {BuildTool,HOTBAR} from './buildtool.js';
// What loose rocks drop, by biome (weights).
const DROPS={0:{limestone:6,copper_ore:2,tin_ore:2},1:{limestone:5,iron_ore:3,copper_ore:2,coal:1,tin_ore:1},2:{limestone:4,iron_ore:3,coal:2,copper_ore:2},
  3:{limestone:3,copper_ore:3,bauxite:2,coal:2,tin_ore:1},4:{limestone:3,sulfur:3,iron_ore:2,caterium_ore:2,ruby_ore:1},5:{iron_ore:3,limestone:2,coal:2,caterium_ore:2,quartz:2,titanium_ore:1},
  6:{quartz:4,iron_ore:2,limestone:2,titanium_ore:2,uranium:1}};
const roll=t=>{let s=0;for(const k in t)s+=t[k];let r=Math.random()*s;for(const k in t){r-=t[k];if(r<=0)return k;}return Object.keys(t)[0];};

const $=id=>document.getElementById(id);
const hex=c=>'#'+c.toString(16).padStart(6,'0');
const chip=k=>`<i style="background:${hex(ITEMS[k].color)}"></i>`;
const STATUS={working:'Working',waiting:'Waiting for input',blocked:'Output blocked',nopower:'No power',norecipe:'No recipe set',nonode:'Not on a node',idle:'Idle',nofuel:'Out of fuel'};
const DEG=Math.PI/180;

export class UI{
  constructor(game,ctx){
    Object.assign(this,ctx);this.game=game;this.mode='hand';this.type='belt';this.rot=0;this.panel=null;this.pauseShown=false;this.locked=false;this.force=false;
    this.keys=this.player.keys;this.mouse={l:false,r:false};this.mineT=0;this.swingCd=0;this.lastCell=null;this.lastBelt=null;this.hint='';this.miniT=0;this.cat='Logistics';
    this.mapImg=this.world.mapImage();this.canvas=$('gl');this.mini=$('minimap').getContext('2d');this.scanFx=null;this.discT=0;
    this.dpr=Math.min(2.5,window.devicePixelRatio||1);const mc=$('minimap');mc.width=mc.height=Math.round(180*this.dpr);
    this.mkScan();this.mkRing();this.bt=new BuildTool(this);this.bind();
    this.player.onDamage=()=>{sfx.hurt();};
    this.player.onDeath=()=>{this.game.notify('You were killed. Respawning at the landing site…','bad');};
  }
  active(){return (this.locked||this.force||this.mobile)&&!this.panel&&!this.pauseShown;}
  setMobile(){this.mobile=true;this.noLock=true;this.force=true;document.body.classList.add('mobile');}
  togglePause(){this.pauseShown=!this.pauseShown;$('pause').classList.toggle('hidden',!this.pauseShown);}
  paused(){return this.pauseShown;}
  lock(){this.pauseShown=false;$('pause').classList.add('hidden');if(this.mobile||this.noLock){this.force=true;return;}try{const p=this.canvas.requestPointerLock();if(p&&p.catch)p.catch(()=>this.lockFailed());}catch(e){this.lockFailed();}}
  lockFailed(){if(this.noLock||this.mobile)return;this.noLock=true;this.force=true;this.notify('Mouse capture is unavailable here: hold the right mouse button and drag to look. P pauses.');}
  notify(msg,type=''){const d=document.createElement('div');d.className='notif '+type;d.textContent=msg;const n=$('notifs');n.appendChild(d);while(n.children.length>6)n.removeChild(n.firstChild);setTimeout(()=>{d.style.opacity=0;setTimeout(()=>d.remove(),500);},4500);}
  mkScan(){const m=new THREE.Mesh(new THREE.SphereGeometry(1,32,16),new THREE.MeshBasicMaterial({color:0x38c8ff,transparent:true,opacity:0.18,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));m.visible=false;this.scene=this.camera.parent;this.scanMesh=m;}
  mkRing(){
    // Highlight ring drawn around the resource node a Miner would snap to.
    const mat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.85,side:THREE.DoubleSide,depthWrite:false,depthTest:false,fog:false});
    const r=new THREE.Mesh(new THREE.RingGeometry(5.4,6.2,48),mat);r.rotation.x=-Math.PI/2;r.renderOrder=5;r.visible=false;
    const r2=new THREE.Mesh(new THREE.RingGeometry(4.0,4.25,48),mat);r2.rotation.x=-Math.PI/2;r2.renderOrder=5;r.add(r2);r2.rotation.x=0;
    this.ring=r;
  }
  bind(){
    const g=this.game;
    document.addEventListener('pointerlockchange',()=>{this.locked=document.pointerLockElement===this.canvas;if(!this.locked&&g.running&&!this.panel&&!this.force){this.pauseShown=true;$('pause').classList.remove('hidden');}});
    document.addEventListener('pointerlockerror',()=>this.lockFailed());
    document.addEventListener('mousemove',e=>{if(this.active()&&(this.locked||this.noLock&&this.mouse.r))this.player.look(e.movementX,e.movementY);});
    addEventListener('keydown',e=>{
      if(!g.running)return;
      if(e.code==='Tab'||e.code==='Space'&&this.locked)e.preventDefault();
      if(e.repeat)return;
      this.keys[e.code]=true;
      if(e.target&&e.target.tagName==='SELECT')return;
      this.onKey(e.code,e);
    });
    addEventListener('keyup',e=>{this.keys[e.code]=false;});
    addEventListener('blur',()=>{for(const k in this.keys)this.keys[k]=false;});
    this.canvas.addEventListener('mousedown',e=>{
      if(!g.running||this.pauseShown||this.panel||this.mobile)return;
      if(!this.locked&&!this.force){this.lock();return;}
      if(e.button===0){this.mouse.l=true;this.onClick();}if(e.button===2){this.mouse.r=true;if(this.noLock)return;if(this.bt.cancel())return;if(this.mode!=='hand'){this.setMode('hand');}else this.onKey('KeyX');}
    });
    addEventListener('mouseup',e=>{if(e.button===0){this.mouse.l=false;this.lastBelt=null;this.lastCell=null;}if(e.button===2)this.mouse.r=false;});
    addEventListener('contextmenu',e=>e.preventDefault());
    addEventListener('wheel',e=>{if(this.active()&&this.mode==='build'){this.rot=(this.rot+(e.deltaY>0?1:3))%4;}},{passive:true});
    $('pclose').onclick=()=>this.closePanel();
    $('btnResume').onclick=()=>{this.lock();};$('btnSave').onclick=()=>{g.save();this.notify('Game saved','good');};$('btnHelp').onclick=()=>{this.pauseShown=false;$('pause').classList.add('hidden');this.openPanel('help');};
    setInterval(()=>{if(this.panel&&!this.mouse.l&&!this.hold)this.refreshPanel();},800);
  }
  onKey(code,e){
    const g=this.game;
    if(code==='Escape'||code==='KeyP'&&this.noLock){if(this.panel){this.closePanel();}else if(this.mode==='build'&&this.bt.cancel()){}else if(this.mode!=='hand'){this.setMode('hand');}else if(this.noLock){this.pauseShown=!this.pauseShown;$('pause').classList.toggle('hidden',!this.pauseShown);}return;}
    if(this.pauseShown)return;
    const panelKeys={KeyQ:'build',Tab:'inv',KeyI:'inv',KeyJ:'mile',KeyU:'upg',KeyM:'map',KeyH:'help'};
    if(panelKeys[code]){if(this.panel===panelKeys[code])this.closePanel();else this.openPanel(panelKeys[code]);return;}
    if(this.panel)return;
    if(code.startsWith('Digit')&&+code[5]>=1){const t=HOTBAR[+code[5]-1];if(t){if(this.game.unlocked.has(t)){this.setMode('build',t);sfx.ui();}else this.notify(BUILDINGS[t].name+' is locked: complete milestones to unlock it','bad');}return;}
    if(code==='KeyT'&&this.mode==='build'){this.bt.cycleRecipe();return;}
    if(code==='KeyR'){this.rot=(this.rot+1)%4;}
    else if(code==='KeyX'){this.setMode(this.mode==='delete'?'hand':'delete');}
    else if(code==='KeyV')this.scan();
    else if(code==='KeyF')this.eat();
    else if(code==='KeyE'&&this.mode==='hand')this.interact();
    else if(code==='KeyN'&&e&&e.shiftKey){this.player.fly=!this.player.fly;this.notify(this.player.fly?'Fly mode on':'Fly mode off');}
    else if(code==='KeyO'){if(!Q.shadows){this.notify('Shadows are off in Low graphics (change in Pause menu)');return;}const r=this.sky.sun.castShadow=!this.sky.sun.castShadow;this.notify('Shadows '+(r?'on':'off'));}
    else if(code==='KeyG'&&this.mode==='hand'){const b=this.target&&this.target.b;if(b&&this.game.unlocked.has(b.type)){this.type=b.type;this.rot=b.rot;this.setMode('build');}}
  }
  setMode(m,t){this.mode=m;if(t)this.type=t;this.factory.hideGhost();this.lastBelt=null;this.bt&&this.bt.reset();$('cross').classList.toggle('build',m!=='hand');}
  openPanel(p,extra){
    this.panel=p;this.pextra=extra;document.exitPointerLock&&document.exitPointerLock();this.factory.hideGhost();
    $('panel').classList.remove('hidden');this.refreshPanel(true);
  }
  closePanel(){if(!this.panel)return;this.panel=null;$('panel').classList.add('hidden');this.lock();}
  // ---------- terrain ray
  aim(maxD=70){
    const o=this.player.eye(),d=this.player.forward(),p=new THREE.Vector3();let prev=0;
    for(let t=1;t<maxD;t+=0.6){p.copy(o).addScaledVector(d,t);if(p.y<this.world.heightAt(p.x,p.z)){let a=prev,b=t;for(let i=0;i<8;i++){const m=(a+b)/2;p.copy(o).addScaledVector(d,m);if(p.y<this.world.heightAt(p.x,p.z))b=m;else a=m;}p.copy(o).addScaledVector(d,b);return p;}prev=t;}
    return null;
  }
  // ---------- actions
  onClick(){
    if(this.player.dead)return;
    if(this.mode==='build'){if(!this.bt.click())this.placeAtAim(true);}
    else if(this.mode==='delete'){const t=this.target;if(t&&t.b){this.factory.remove(t.b);sfx.del();this.game.notify('Deconstructed '+t.b.def.name+' (refunded)');}}
    else if(!(this.target&&(this.target.node||this.target.rock)))this.swing();
  }
  swing(){
    if(this.swingCd>0)return;this.swingCd=0.5;this.player.swing=1;sfx.swing();
    const a=this.wild.nearestInFront(this.player.pos,{x:this.player.forward().x,z:this.player.forward().z},3.8);
    if(a){const r=this.wild.hit(a,26+10*this.lv('pick'),this.player.pos);sfx.hit();
      if(r&&r.killed){this.game.stats.kills++;if(r.meat>0){this.game.inv.add('meat',r.meat);this.game.notify(`Killed ${r.name}: +${r.meat} Raw Meat`,'good');}else this.game.notify('Killed '+r.name);}}
  }
  eat(){
    const g=this.game;if(!g.inv.has('meat')||this.player.hp>=this.player.maxHp)return;g.inv.remove('meat');this.player.hp=Math.min(this.player.maxHp,this.player.hp+35);sfx.eat();this.notify('Ate raw meat (+35 HP)');
  }
  interact(){
    const t=this.target;if(!t)return;
    if(t.b){const b=t.b;if(b.type==='depot')this.openPanel('mile',b);else if(b.def.machine||b.type==='storage'||b.type==='coal_gen'||b.type==='nuclear'||b.def.mine||b.type==='solar'||b.type==='splitter')this.openPanel('machine',b);}
  }
  scan(){
    if(this.scanCd>this.game.time)return;this.scanCd=this.game.time+6;sfx.scan();this.scanR=0;
    const R=420*(1+0.4*this.lv('scan'));this.scanMax=R;
    this.scanMesh.visible=true;if(!this.scanMesh.parent)this.scene.add(this.scanMesh);this.scanMesh.position.copy(this.player.pos);
    let found=0;const types={};
    for(const n of this.nodes){if(Math.hypot(n.x-this.player.pos.x,n.z-this.player.pos.z)<R&&!n.discovered){n.discovered=true;found++;types[n.type]=1;}}
    this.notify(found?`Scanner found ${found} new resource node${found>1?'s':''}: ${Object.keys(types).map(t=>RESOURCES[t].name).join(', ')}`:'Scanner: no new nodes in range','good');
  }
  placeAtAim(click){
    const aim=this.bt.aimPoint();const d=BUILDINGS[this.type];
    if(!this.game.unlocked.has(this.type)){this.notify('Not unlocked yet','bad');return false;}
    const [minCx,minCz,c]=this.footprintAt(aim);
    const f=this.factory;
    if(!c.ok){if(click)this.notify(c.reason,'bad'),sfx.bad();return false;}
    const free=c.replace;
    if(!free&&!this.game.inv.canAfford(d.cost)){this.notify('Not enough materials','bad');sfx.bad();return false;}
    if(!free)this.game.inv.pay(d.cost);
    const b=f.place(this.type,minCx,minCz,this.rot);
    if(b){sfx.place();const r=this.bt.recipeFor(this.type);if(r)f.setRecipe(b,r.id);}
    return !!b;
  }
  footprintAt(aim){
    const d=BUILDINGS[this.type],gx=(aim.x+HALF)/CELL,gz=(aim.z+HALF)/CELL;
    let [minCx,minCz]=this.factory.footprint(this.type,gx,gz);
    if(d.mine){const n=this.factory.findNode(aim.x,aim.z);if(n){minCx=Math.round((n.x+HALF)/CELL)-d.w/2;minCz=Math.round((n.z+HALF)/CELL)-d.d/2;}}
    let c=this.factory.canPlace(this.type,minCx,minCz,this.rot);
    if(c.ok&&this.type!=='belt'){const p=this.player.pos,x0=minCx*CELL-HALF-0.5,z0=minCz*CELL-HALF-0.5;
      if(p.x>x0&&p.x<x0+d.w*CELL+1&&p.z>z0&&p.z<z0+d.d*CELL+1)c={ok:false,reason:'You are standing in the way: step back'};}
    return [minCx,minCz,c];
  }
  // ---------- per-frame
  update(dt){
    const p=this.player,g=this.game;this.swingCd-=dt;let showRing=null;
    this.updateTarget();this.buildInfo='';
    const bAim=this.bt.update();
    if(this.mode==='build'&&this.active()&&this.type==='belt'){if(!this.ghostMsg)this.prompt=this.buildInfo;}
    else if(this.mode==='build'&&this.active()){
      const aim=bAim;
      if(aim){const [minCx,minCz,c]=this.footprintAt(aim),d=BUILDINGS[this.type];
        const cx=(minCx+d.w/2)*CELL-HALF,cz=(minCz+d.d/2)*CELL-HALF,afford=this.game.inv.canAfford(d.cost)||c.replace;
        const y=this.world.cellH(Math.max(0,Math.min(SEG-1,minCx+Math.floor(d.w/2))),Math.max(0,Math.min(SEG-1,minCz+Math.floor(d.d/2))));
        this.factory.showGhost(this.type,new THREE.Vector3(cx,y+(this.type==='belt'?0.3:0),cz),this.rot,c.ok&&afford&&this.game.unlocked.has(this.type));
        this.ghostMsg=!c.ok?c.reason:!afford?'Not enough materials':'';
        if(d.machine&&!this.ghostMsg){const r=this.bt.recipeFor(this.type);this.prompt=`${d.name} · recipe: <b>${r?r.name:'automatic'}</b> (<b>${this.mobile?'RCP':'T'}</b> to change) · output on the orange arrow`;}
        if(d.mine){const n=c.node||this.factory.findNode(aim.x,aim.z);
          if(n){showRing=n;const mult=PURITY[n.purity].mult,rate=60*mult*d.mine*this.factory.mods.miner;
            if(c.ok&&afford)this.prompt=`<b>${RESOURCES[n.type].name} node (${PURITY[n.purity].name})</b> · ${d.name} makes <b>${rate.toFixed(0)}</b>/min · ${d.power} MW · <b>LMB</b> place`;}
          else this.ghostMsg='Aim at a glowing resource node';}}
      else this.factory.hideGhost();
    }
    if(showRing){const r=this.ring,n=showRing;if(!r.parent)this.scene.add(r);r.visible=true;r.position.set(n.x,n.y+0.4,n.z);
      const col=RESOURCES[n.type].color;r.material.color.setHex(col);const s=1+Math.sin(this.game.time*4)*0.05;r.scale.set(s,s,1);}
    else if(this.ring.visible)this.ring.visible=false;
    // hand mining: hold LMB or E on a node or rock
    const tg=this.target,want=this.mode==='hand'&&this.active()&&(this.keys['KeyE']||this.mouse.l)&&tg&&(tg.node||tg.rock)&&!p.dead;
    const iv=0.5*(1-0.15*this.lv('pick'));
    if(want){this.mineT-=dt;if(this.mineT<=0){this.mineT=iv;this.strike(tg);}}else this.mineT=0;
    p.mining=0;const ring=$('ring');ring.style.display=want?'block':'none';if(want)ring.style.setProperty('--p',(1-this.mineT/iv)*100+'%');
    if(this.scanMesh.visible){this.scanR+=dt*this.scanMax*0.9;this.scanMesh.scale.setScalar(Math.max(1,this.scanR));this.scanMesh.material.opacity=0.2*(1-this.scanR/this.scanMax);this.scanMesh.position.copy(p.pos);if(this.scanR>this.scanMax)this.scanMesh.visible=false;}
    this.discT-=dt;if(this.discT<0){this.discT=1;for(const n of this.nodes)if(!n.discovered&&Math.hypot(n.x-p.pos.x,n.z-p.pos.z)<90)n.discovered=true;}
    // hud
    this.hud(dt);
  }
  strike(tg){
    const g=this.game,p=this.player,pk=this.lv('pick');p.swing=1;sfx.mine();g.stats.handMined=(g.stats.handMined||0)+1;
    if(tg.node){const n=tg.node,q=1+(pk>=2?1:0)+(n.purity===2&&Math.random()<0.5?1:0)-(n.purity===0&&Math.random()<0.4?1:0);
      const pos=new THREE.Vector3(n.x,n.y+1.6,n.z).lerp(p.eye(),0.25);this.fx.burst(pos,RESOURCES[n.type].color,8);
      if(q>0){g.inv.add(n.type,q);this.fx.popup(`+${q} ${ITEMS[n.type].name}`,hex(RESOURCES[n.type].color));}return;}
    const r=tg.rock,b=this.world.biomeAt(r.it.x,r.it.z),item=r.type==='ice'?(Math.random()<0.7?'quartz':'titanium_ore'):roll(DROPS[b]||DROPS[1]);
    const q=1+(pk>=3?1:0)+(r.type==='spire'&&Math.random()<0.5?1:0);
    const pos=p.eye().addScaledVector(p.forward(),Math.max(0.6,r.t-r.R*0.6));
    this.fx.burst(pos,0x8a8680,7);this.fx.burst(pos,ITEMS[item].color,4);
    g.inv.add(item,q);this.fx.popup(`+${q} ${ITEMS[item].name}`,hex(ITEMS[item].color));
    if(this.veg.hitRock(r)){const bonus=r.type==='boulder'?2+Math.floor(Math.random()*3):r.type==='spire'?4:0;
      this.fx.burst(pos,0x8a8680,22,7);sfx.hit();if(bonus){const b2=roll(DROPS[b]||DROPS[1]);g.inv.add(b2,bonus);setTimeout(()=>this.fx.popup(`${MINE[r.type].name} broken: +${bonus} ${ITEMS[b2].name}`,'#ffb02e'),250);}this.target=null;}
  }
  updateTarget(){
    this.target=null;this.prompt='';if(!this.active()&&!this.force)return;
    const p=this.player,o=p.eye(),d=p.forward();
    if(this.mode==='hand'||this.mode==='delete'){
      const b=this.factory.pick(o,d,this.mode==='delete'?30:12);
      if(b){this.target={b};
        if(this.mode==='delete')this.prompt=`<b>LMB</b> Deconstruct ${b.def.name}`;
        else{const act=b.type==='depot'?'Milestones':b.type==='belt'?'':'Open';this.prompt=`${b.def.name}${b.status&&b.type!=='belt'?' — '+(STATUS[b.status]||b.status):''}${b.def.mine&&b.node?` · ${RESOURCES[b.node.type].name} ${this.factory.rate(b).toFixed(0)}/min`:''}${act&&b.type!=='splitter'?` · <b>E</b> ${act}`:''}${this.mobile?'':' · <b>G</b> Copy'}`;}
        return;}
      if(this.mode==='hand'){
        let best=null,bd=8;for(const n of this.nodes){const dx=n.x-p.pos.x,dz=n.z-p.pos.z,dist=Math.hypot(dx,dz);if(dist>bd+2)continue;
          const to=new THREE.Vector3(dx,n.y+1-(p.pos.y+1.65),dz),len=to.length();to.divideScalar(len);if(to.dot(d)>0.8&&len<bd+2){bd=len;best=n;}}
        const mk=this.mobile?'⛏':'LMB';
        if(best){this.target={node:best};this.prompt=best.occupied?`${nodeLabel(best)} — Miner installed`:`${nodeLabel(best)} · hold <b>${mk}</b> to mine · ${this.mobile?'BUILD':'<b>Q</b>'} a Miner for automation`;return;}
        const rk=this.veg.findMineable(o,d,5.5);
        if(rk){this.target={rock:rk};const left=rk.it.hp===undefined?'':` (${rk.it.hp}/${rk.it.maxHp})`;this.prompt=`${MINE[rk.type].name}${left} · hold <b>${mk}</b> to mine ore`;return;}
        const a=this.wild.nearestInFront(p.pos,{x:d.x,z:d.z},9);if(a&&a.g.visible){this.prompt=`${a.sp.n}${a.hp<a.sp.hp?` (${Math.ceil(a.hp)} HP)`:''}`;}
      }
    }
  }
  hud(dt){
    const p=this.player,g=this.game;
    $('prompt').innerHTML=this.mode==='build'&&this.ghostMsg?`<span style="color:var(--bad)">${this.ghostMsg}</span>`:this.prompt;
    const hp=Math.ceil(p.hp);$('hpbar').style.width=(hp/p.maxHp*100)+'%';$('hptxt').textContent=`${hp} HP`;
    $('food').innerHTML=`Raw Meat: ${g.inv.get('meat')} (<b style="color:var(--acc)">F</b> eat) · Kills: ${g.stats.kills}`;
    $('hitflash').style.boxShadow=`inset 0 0 160px 40px rgba(255,0,0,${p.hitFlash*1.4})`;$('death').classList.toggle('hidden',!p.dead);
    const s=g.stats,pc=s.demand>0?Math.min(1,s.supply/s.demand):1;
    $('pwbar').style.width=(s.supply>0||s.demand>0?Math.min(100,pc*100):0)+'%';
    $('pwtxt').innerHTML=`Power: <b style="color:${s.supply<s.demand?'var(--bad)':'var(--acc2)'}">${s.supply.toFixed(0)}</b> / ${s.demand.toFixed(0)} MW`;
    const h=this.sky.hour,hh=Math.floor(h),mm=Math.floor((h-hh)*60);
    $('clock').textContent=`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')} · ${hh>=6&&hh<18?'Day':'Night'}${g.fps?' · '+g.fps.toFixed(0)+' fps':''}${g.res?' · '+g.res.toFixed(2)+'x res':''}`;
    const m=g.curMilestone();
    $('objective').innerHTML=m?`<h4>Milestone ${g.done.length+1}/${MILESTONES.length}</h4><div><b>${m.name}</b></div>`+Object.entries(m.req).map(([k,n])=>{const d=g.delivered[k]||0;return `<div class="req ${d>=n?'ok':''}"><span>${chip(k)}${ITEMS[k].name}</span><span>${d}/${n}</span></div>`;}).join('')+`<div class="small">Deliver via Depot (J)</div>`:`<h4>All milestones complete</h4><div>The Beacon is lit. Keep building!</div>`;
    const hint={hand:'<b>Hold LMB</b> Mine rocks / swing · <b>E</b> Use · <b>Q</b> Build · <b>X</b> Deconstruct · <b>V</b> Scan · <b>Tab</b> Inventory',build:`<b>${BUILDINGS[this.type].name}</b> · `+(this.type==='belt'?'<b>LMB</b> start, <b>LMB</b> end (keeps going) · <b>RMB</b> stop':'<b>LMB</b> Place · <b>R</b>/<b>Wheel</b> Rotate'+(BUILDINGS[this.type].machine?' · <b>T</b> Recipe':'')+' · <b>RMB</b> Cancel')+' · <b>1-9</b> Hotbar',delete:'<b>Deconstruct</b> · <b>LMB</b> Remove building (full refund) · <b>RMB</b> Cancel'};
    $('toolhint').innerHTML=this.mobile?(this.mode==='build'?`<b>${BUILDINGS[this.type].name}</b> · ✚ place · ⟳ rotate · ✕ cancel`+(this.type==='belt'?' · tap ✚ at the start, then ✚ at the end':''):this.mode==='delete'?'Aim and tap ✖ to remove · ✕ cancel':'Left: move · Drag: look · hold ⛏ on rocks to mine · E use'):hint[this.mode];
    this.hotbarT=(this.hotbarT||0)-dt;if(this.hotbarT<=0){this.hotbarT=0.3;this.drawHotbar();}
    this.miniT-=dt;if(this.miniT<=0){this.miniT=0.1;this.drawMini();this.drawCompass();
      const b=this.world.biomeAt(p.pos.x,p.pos.z);$('biome').textContent=`${BIOME_NAMES[b]} · alt ${p.pos.y.toFixed(0)}m · (${p.pos.x.toFixed(0)}, ${p.pos.z.toFixed(0)})`;}
  }
  drawHotbar(){
    const el=$('hotbar');if(!el)return;const g=this.game;
    const key=HOTBAR.map(t=>(g.unlocked.has(t)?1:0)+(this.mode==='build'&&this.type===t?'s':'')).join('')+this.mobile;
    if(key===this.hbKey)return;this.hbKey=key;
    el.innerHTML=HOTBAR.map((t,i)=>{const u=g.unlocked.has(t);return `<button class="hb ${u?'':'lock'} ${this.mode==='build'&&this.type===t?'sel':''}" data-hb="${i}"><kbd>${i+1}</kbd>${BUILDINGS[t].name.replace('Conveyor ','').replace('Delivery ','').replace(' Crate','').replace(' Array','')}</button>`;}).join('');
    el.querySelectorAll('[data-hb]').forEach(b=>b.onpointerdown=e=>{e.preventDefault();e.stopPropagation();this.onKey('Digit'+(+b.dataset.hb+1));});
  }
  drawMini(){
    const c=this.mini,S=180,p=this.player,R=260,scale=S/(2*R)*(WORLDSCALE);
    c.setTransform(this.dpr,0,0,this.dpr,0,0);c.imageSmoothingQuality='high';
    c.save();c.clearRect(0,0,S,S);c.beginPath();c.arc(S/2,S/2,S/2,0,7);c.clip();c.fillStyle='#0a0e14';c.fillRect(0,0,S,S);
    c.translate(S/2,S/2);c.rotate(p.yaw);// north-up rotates with heading
    const px=(p.pos.x+HALF)/(HALF*2)*this.mapImg.width,pz=(p.pos.z+HALF)/(HALF*2)*this.mapImg.height,k=S/(2*R)*(HALF*2/this.mapImg.width);
    c.imageSmoothingEnabled=true;c.drawImage(this.mapImg,-px*k,-pz*k,this.mapImg.width*k,this.mapImg.height*k);
    const to=(x,z)=>[(x-p.pos.x)*S/(2*R),(z-p.pos.z)*S/(2*R)];
    for(const b of this.factory.list){if(b.type==='belt')continue;const [x,y]=to(b.x,b.z);if(Math.abs(x)>S/2||Math.abs(y)>S/2)continue;c.fillStyle='#ffb02e';c.fillRect(x-2,y-2,4,4);}
    for(const n of this.nodes){if(!n.discovered)continue;const [x,y]=to(n.x,n.z);if(Math.hypot(x,y)>S/2-3)continue;c.fillStyle=hex(RESOURCES[n.type].color);c.beginPath();c.arc(x,y,4,0,7);c.fill();c.strokeStyle='#000';c.lineWidth=1;c.stroke();}
    for(const a of this.wild.animals){if(a.dead||!a.g.visible||!a.sp.aggro)continue;const [x,y]=to(a.x,a.z);if(Math.hypot(x,y)>S/2-3)continue;c.fillStyle='#ff4a3a';c.fillRect(x-1.5,y-1.5,3,3);}
    c.restore();
    c.save();c.translate(S/2,S/2);c.fillStyle='#fff';c.strokeStyle='#000';c.beginPath();c.moveTo(0,-8);c.lineTo(5,6);c.lineTo(0,3);c.lineTo(-5,6);c.closePath();c.fill();c.stroke();c.restore();
    c.fillStyle='#ff5a4a';c.font='bold 11px sans-serif';c.textAlign='center';const nx=Math.sin(-p.yaw+Math.PI)*0,ny=0;c.save();c.translate(S/2,S/2);c.rotate(p.yaw);c.fillText('N',0,-(S/2-10));c.restore();
  }
  drawCompass(){
    const p=this.player,yaw=((-p.yaw/DEG)%360+360)%360;let html='';
    const lab=(deg,txt,cls)=>{let r=((deg-yaw+540)%360)-180;if(Math.abs(r)>95)return;html+=`<span class="${cls||''}" style="left:${180+r*2}px">${txt}</span>`;};
    [['N',0],['E',90],['S',180],['W',270]].forEach(([t,d])=>lab(d,t,t==='N'?'n':''));
    for(const n of this.nodes){if(!n.discovered)continue;const dx=n.x-p.pos.x,dz=n.z-p.pos.z;if(Math.hypot(dx,dz)>500)continue;const ang=((Math.atan2(dx,-dz)/DEG)+360)%360;let r=((ang-yaw+540)%360)-180;if(Math.abs(r)>95)continue;html+=`<span class="m" style="left:${180+r*2}px;color:${hex(RESOURCES[n.type].color)}">◆</span>`;}
    $('cstrip').innerHTML=html;
  }
  // ---------- panels
  refreshMilestones(){if(this.panel==='mile')this.refreshPanel();}
  refreshPanel(first){
    const body=$('pbody'),g=this.game,P=this.panel;let h='';
    if(P==='upg')h=this.upgHTML();else if(P==='build')h=this.buildHTML();else if(P==='inv')h=this.invHTML();else if(P==='machine')h=this.machineHTML();else if(P==='mile')h=this.mileHTML();else if(P==='map')h=this.mapHTML();else if(P==='help')h=this.helpHTML();
    const sc=body.parentElement.scrollTop;body.innerHTML=h;body.parentElement.scrollTop=sc;this.wire(body);if(P==='map')this.drawMap();
  }
  wire(body){
    body.querySelectorAll('[data-act]').forEach(el=>{el.onclick=()=>{const [a,v,v2]=el.dataset.act.split('|');this.act(a,v,v2);};});
    const sel=body.querySelector('select[data-rec]');if(sel){sel.onfocus=()=>this.hold=true;sel.onblur=()=>this.hold=false;sel.onchange=()=>{this.factory.setRecipe(this.pextra,sel.value);this.hold=false;sfx.ui();this.refreshPanel();};}
  }
  act(a,v,v2){
    const g=this.game;
    if(a==='cat'){this.cat=v;}
    else if(a==='pick'){if(!g.unlocked.has(v))return;this.panel=null;$('panel').classList.add('hidden');this.setMode('build',v);this.rot=this.rot||0;this.lock();sfx.ui();return;}
    else if(a==='craft')g.craft(v,+v2||1);
    else if(a==='take'){const b=this.pextra;const n=b.store[v]||0;if(n>0){g.inv.add(v,n);b.store[v]=0;sfx.ui();}}
    else if(a==='takeall'){const b=this.pextra;for(const k in b.store){if(b.store[k]>0)g.inv.add(k,b.store[k]);b.store[k]=0;}sfx.ui();}
    else if(a==='upg'){g.buyUpgrade(v);}
    else if(a==='dep')g.deposit(v,+v2||1);
    else if(a==='depall'){const m=g.curMilestone();if(m)for(const k in m.req)g.deposit(k,999);}
    this.refreshPanel();
  }
  cost(c){return '<div class="cost">'+Object.entries(c).map(([k,n])=>`<span class="${this.game.inv.has(k,n)?'':'no'}">${chip(k)}${n} ${ITEMS[k].name}</span>`).join('')+'</div>';}
  buildHTML(){
    const g=this.game,cats=['Logistics','Production','Power'];
    let h=`<h3 style="font-size:20px">Build Menu</h3><div class="tabs">${cats.map(c=>`<button data-act="cat|${c}" class="${this.cat===c?'on':''}">${c}</button>`).join('')}</div><div class="grid">`;
    for(const [id,d] of Object.entries(BUILDINGS)){if(d.cat!==this.cat)continue;const un=g.unlocked.has(id);
      h+=`<div class="item ${un?'':'locked'} ${un&&!g.inv.canAfford(d.cost)?'nocost':''}" data-act="pick|${id}"><h4>${d.name}${un?'':' 🔒'}</h4><p>${d.desc}</p>${this.cost(d.cost)}${d.power?`<div class="small">Uses ${d.power} MW · ${d.w}×${d.d}</div>`:d.gen?`<div class="small">Generates ${d.gen} MW · ${d.w}×${d.d}</div>`:`<div class="small">${d.w}×${d.d}</div>`}${un?'':'<div class="small" style="color:var(--bad)">Complete milestones to unlock</div>'}</div>`;}
    return h+'</div>';
  }
  invHTML(){
    const g=this.game;const items=Object.entries(g.inv.c).filter(([k,n])=>n>0).sort((a,b)=>Object.keys(ITEMS).indexOf(a[0])-Object.keys(ITEMS).indexOf(b[0]));
    let h=`<div class="two"><div><h3>Inventory</h3><div class="inv">${items.length?items.map(([k,n])=>`<div class="l"><span>${chip(k)}${ITEMS[k].name}</span><b>${n}</b></div>`).join(''):'<div class="small">Empty</div>'}</div></div><div><h3>Hand Crafting</h3><div class="small" style="margin-bottom:8px">Craft parts from materials in your inventory.</div>`;
    for(const r of RECIPES.filter(r=>r.machine==='constructor')){
      const can=g.inv.canAfford(r.in);
      h+=`<div class="rec"><div><b>${r.name}</b><div class="in">${Object.entries(r.in).map(([k,n])=>`${n}× ${ITEMS[k].name}`).join(', ')} → ${Object.entries(r.out).map(([k,n])=>`${n}× ${ITEMS[k].name}`).join(', ')}</div></div><div><button data-act="craft|${r.id}|1" ${can?'':'disabled'}>Craft</button> <button data-act="craft|${r.id}|5" ${can?'':'disabled'}>×5</button></div></div>`;}
    return h+'</div></div>';
  }
  machineHTML(){
    const b=this.pextra,g=this.game;if(!b||!this.factory.list.includes(b)){this.closePanel();return '';}
    let h=`<h3 style="font-size:20px">${b.def.name}</h3><div class="small">${STATUS[b.status]||b.status} · ${b.def.power?`Uses ${b.def.power} MW`:b.def.gen?`Generates up to ${b.def.gen} MW`:''}</div><br>`;
    if(b.def.machine){
      h+=`<div><b>Recipe:</b> <select data-rec="1"><option value="">— none —</option>${recipesFor(b.def.machine).map(r=>`<option value="${r.id}" ${b.recipe&&b.recipe.id===r.id?'selected':''}>${r.name}</option>`).join('')}</select></div><br>`;
      if(b.recipe){const r=b.recipe;h+=`<div class="rec sel"><div><b>${r.name}</b> · ${r.time}s<div class="in">Needs: ${Object.entries(r.in).map(([k,n])=>`${n}× ${ITEMS[k].name} (${b.in[k]||0})`).join(', ')}<br>Makes: ${Object.entries(r.out).map(([k,n])=>`${n}× ${ITEMS[k].name}`).join(', ')}</div></div><div>${Math.round(b.prog*100)}%</div></div>`;
        h+=`<div class="small">Output buffer: ${Object.entries(b.out).filter(([k,n])=>n>0).map(([k,n])=>n+'× '+ITEMS[k].name).join(', ')||'empty'}</div>`;}
      h+=`<br><div class="small">Items arrive from belts pointing into the machine. Output leaves from the front (arrow side).</div>`;
    }
    else if(b.def.mine){const n=b.node,f=this.factory,full=Object.values(b.out).reduce((a,c)=>a+c,0);
      if(!n)h+='<div>Not on a node</div>';
      else{const base=60*PURITY[n.purity].mult*b.def.mine,rate=f.rate(b),eff=b.status==='working'?f.eff:0;
        h+=`<div class="rec sel"><div><b>${chip(n.type)}${RESOURCES[n.type].name} node</b> · ${PURITY[n.purity].name}<div class="in">${b.def.name}: ${base.toFixed(0)}/min base${f.mods.miner>1?` x${f.mods.miner.toFixed(2)} overclock`:''}</div></div><div style="text-align:right"><b style="font-size:20px">${(rate*eff).toFixed(0)}</b>/min<div class="in">of ${rate.toFixed(0)} possible</div></div></div>
        <div class="prog"><i style="width:${Math.min(100,eff*100)}%;background:${eff<1?'var(--bad)':'var(--good)'}"></i></div>
        <div class="small">Power: ${(b.def.power*f.mods.power).toFixed(1)} MW · Supply ${f.supply.toFixed(0)} / Demand ${f.demand.toFixed(0)} MW${eff<1&&b.status==='working'?' (running slow, add power)':''}<br>Output buffer: ${full}/5${b.status==='blocked'?' (belt is full or missing)':''}<br>Items leave from the front (arrow side). A belt belongs there. Each Mk level up doubles output.</div>`;}}
    else if(b.type==='storage'){const ents=Object.entries(b.store).filter(([k,n])=>n>0);h+=ents.length?`<div class="inv">${ents.map(([k,n])=>`<div class="l"><span>${chip(k)}${ITEMS[k].name}</span><span><b>${n}</b> <button data-act="take|${k}">Take</button></span></div>`).join('')}</div><div class="row" style="justify-content:flex-start"><button data-act="takeall">Take All</button></div>`:'<div class="small">Empty. Belts pointing into the crate fill it (max 500).</div>';}
    else if(b.type==='coal_gen'||b.type==='nuclear')h+=`<div>Fuel: ${b.fuel} · Burning: ${b.burn>0?Math.ceil(b.burn)+'s':'no'}</div><div class="small">Feed ${b.type==='coal_gen'?'Coal':'Uranium Fuel Rods'} by belt.</div>`;
    else if(b.type==='solar')h+=`<div>Output scales with sunlight (currently ${(this.sky.daylight*100).toFixed(0)}%).</div>`;
    return h;
  }
  lv(id){return this.game.upg[id]||0;}
  upgHTML(){
    const g=this.game,done=g.done.length;
    let h=`<h3 style="font-size:20px">Upgrades</h3><div class="small">Pay materials from your inventory. Higher levels need more milestones completed (${done}/${MILESTONES.length} done).</div><br><div class="grid">`;
    for(const u of UPGRADES){
      const l=this.lv(u.id),next=u.lv[l],max=l>=u.lv.length,gate=next&&done<next.tier,can=next&&!gate&&g.inv.canAfford(next.cost);
      h+=`<div class="item ${max?'':can?'':'nocost'}" style="cursor:default"><h4>${u.name} <span class="small">Lv ${l}/${u.lv.length}</span></h4><p>${u.desc}</p><div class="prog"><i style="width:${l/u.lv.length*100}%;background:var(--acc)"></i></div>`+
        (max?'<div class="small" style="color:var(--good)">Maxed</div>':`${this.cost(next.cost)}${gate?`<div class="small" style="color:var(--bad)">Requires ${next.tier} milestones</div>`:''}<div style="margin-top:6px"><button class="pri" data-act="upg|${u.id}" ${can?'':'disabled'}>Upgrade to Lv ${l+1}</button></div>`)+'</div>';
    }
    return h+'</div>';
  }
  mileHTML(){
    const g=this.game;let h=`<h3 style="font-size:20px">Milestones</h3><div class="small">Items delivered to a Delivery Depot (by belt) or handed in below count toward the current milestone.</div><br>`;
    for(const m of MILESTONES){const done=g.done.includes(m.id),cur=g.curMilestone()===m;
      h+=`<div class="ms ${done?'done':''} ${cur?'cur':''}"><b>${done?'✔ ':''}${m.name}</b> <span class="small">— ${m.text}</span>`;
      if(!done)for(const [k,n] of Object.entries(m.req)){const d=cur?(g.delivered[k]||0):0;h+=`<div class="req"><span>${chip(k)}${ITEMS[k].name}</span><span>${d}/${n} ${cur?`<button data-act="dep|${k}|999" ${g.inv.has(k)&&d<n?'':'disabled'}>Hand in (${g.inv.get(k)})</button>`:''}</span></div><div class="prog"><i style="width:${Math.min(100,d/n*100)}%"></i></div>`;}
      h+='</div>';}
    return h+(g.sunk?`<div class="small">Items sunk into the depot: ${g.sunk}</div>`:'');
  }
  mapHTML(){return `<h3 style="font-size:20px">Map</h3><canvas id="mapc" width="1600" height="1600"></canvas><div class="small">Scan (V) to reveal resource nodes. ◆ nodes · ■ buildings · ▲ you</div>`;}
  drawMap(){
    const cv=$('mapc');if(!cv)return;const c=cv.getContext('2d'),S=900,k=S/(HALF*2),p=this.player;
    c.setTransform(cv.width/S,0,0,cv.width/S,0,0);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(this.mapImg,0,0,S,S);
    const X=x=>(x+HALF)*k;
    for(const b of this.factory.list){c.fillStyle=b.type==='belt'?'#ffd98a':'#ffb02e';const s=b.type==='belt'?2:5;c.fillRect(X(b.x)-s/2,X(b.z)-s/2,s,s);}
    c.font='11px sans-serif';c.textAlign='center';
    for(const n of this.nodes){if(!n.discovered)continue;c.fillStyle=hex(RESOURCES[n.type].color);c.strokeStyle='#000';c.lineWidth=2;c.beginPath();c.moveTo(X(n.x),X(n.z)-7);c.lineTo(X(n.x)+6,X(n.z));c.lineTo(X(n.x),X(n.z)+7);c.lineTo(X(n.x)-6,X(n.z));c.closePath();c.stroke();c.fill();
      c.fillStyle='#fff';c.fillText(RESOURCES[n.type].name[0]+(['·','','★'][n.purity]),X(n.x),X(n.z)-10);}
    c.save();c.translate(X(p.pos.x),X(p.pos.z));c.rotate(-p.yaw+Math.PI);c.fillStyle='#fff';c.strokeStyle='#000';c.lineWidth=2;c.beginPath();c.moveTo(0,-10);c.lineTo(7,8);c.lineTo(0,4);c.lineTo(-7,8);c.closePath();c.stroke();c.fill();c.restore();
  }
  helpHTML(){
    const rows=[['W A S D','Move'],['Shift','Sprint'],['Space','Jump / swim up'],['Mouse','Look'],['LMB','Swing pickaxe / place / deconstruct'],['RMB / Esc','Cancel tool'],['LMB (hold)','Mine resource nodes and loose rocks, boulders, spires (biome ores)'],['E','Use machines · hold to mine'],['Q','Build menu'],['R / Wheel','Rotate building'],['X','Deconstruct mode'],['G','Copy the building you look at'],['Tab / I','Inventory &amp; hand crafting'],['V','Resource scanner (reveals nodes)'],['M','Map'],['J','Milestones'],['U','Upgrades'],['F','Eat raw meat'],['O','Toggle shadows (Medium/High graphics)']];
    return `<h3 style="font-size:20px">Controls &amp; Guide</h3><table class="k">${rows.map(r=>`<tr><td><kbd>${r[0]}</kbd></td><td>${r[1]}</td></tr>`).join('')}</table><br>
    <h3>How to build a factory</h3><div class="small" style="font-size:13px;line-height:1.6">1. Press <b>V</b> to scan for resource nodes — look for glowing crystals (colour = resource, more crystals = purer).<br>2. Press <b>Q</b> and pick a <b>Miner</b>: a ring marks the node it will snap to and the prompt shows the output per minute (Impure 0.5x, Normal 1x, Pure 2x). Add a <b>Solar Array</b> for power (weaker at dawn/dusk, dead at night; Coal Generators fix that). Miner Mk.2 and Mk.3 unlock with milestones and make 2x and 4x as much.<br>3. Lay <b>Conveyor Belts</b> from the miner's front (arrow side). Hold LMB and drag to paint belt lines. Belts accept items from behind and from the sides.<br>4. Feed ore into a <b>Smelter</b>, then ingots into a <b>Constructor</b> (choose the recipe with E). Chain machines with belts.<br>5. End your line at a <b>Delivery Depot</b> to complete milestones and unlock new machines.<br>6. Beware the wilds: wolves hunt in packs (more at night), bears and boars fight back, scorpions lurk in the desert.</div>`;
  }
}
const WORLDSCALE=1;
