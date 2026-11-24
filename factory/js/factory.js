import * as THREE from 'three';
import {BUILDINGS,RECIPES,ITEMS,PURITY,DIRS,CELL,HALF,SEG} from './data.js';
import {makeModel,makeGhost,setGhostValid,BeltRenderer,lightMats,HEIGHT,plinth} from './models.js';
import {Dust} from './dust.js';

const GAP=0.5,BELT_V=1.0;
const RMAP={};for(const r of RECIPES)RMAP[r.id]=r;
export const recipesFor=m=>RECIPES.filter(r=>r.machine===m);
const opp=d=>(d+2)%4;

export class Factory{
  constructor(world,scene,veg,game){
    this.world=world;this.scene=scene;this.veg=veg;this.game=game;this.cells=new Map();this.list=[];this.belts=[];this.nid=1;
    this.group=new THREE.Group();scene.add(this.group);this.br=new BeltRenderer(scene);
    this.mods={belt:1,miner:1,mach:1,power:1,solar:1};this.supply=0;this.demand=0;this.eff=1;this.acc=0;this.time=0;this.nodes=[];
    this.ghosts=Object.create(null);this.ghost=null;this.ghostType=null;this.dust=new Dust(scene);
  }
  key(cx,cz){return cz*SEG+cx;}
  at(cx,cz){return cx<0||cz<0||cx>=SEG||cz>=SEG?null:this.cells.get(cz*SEG+cx);}
  cellOf(x,z){return [Math.floor((x+HALF)/CELL),Math.floor((z+HALF)/CELL)];}
  center(b){return [(b.minCx+b.w/2)*CELL-HALF,(b.minCz+b.d/2)*CELL-HALF];}
  // ---- placement
  footprint(type,gx,gz){const d=BUILDINGS[type];return [Math.round(gx-d.w/2),Math.round(gz-d.d/2)];}
  rate(b){return b.node?60*PURITY[b.node.purity].mult*(b.def.mine||1)*this.mods.miner:0;}
  findNode(x,z){let best=null,bd=11;for(const n of this.nodes){const d=Math.hypot(n.x-x,n.z-z);if(d<bd){bd=d;best=n;}}return best;}
  canPlace(type,minCx,minCz,rot){
    const d=BUILDINGS[type],w=this.world;
    if(minCx<1||minCz<1||minCx+d.w>=SEG-1||minCz+d.d>=SEG-1)return {ok:false,reason:'Out of bounds'};
    let mn=1e9,mx=-1e9,sum=0,cnt=0,replace=null;
    for(let j=minCz;j<=minCz+d.d;j++)for(let i=minCx;i<=minCx+d.w;i++){const h=w.hgt[j*(SEG+1)+i];mn=Math.min(mn,h);mx=Math.max(mx,h);sum+=h;cnt++;}
    if(type==='belt'?mn<0.5:sum/cnt<0.9)return {ok:false,reason:'Too close to water'};
    // machines sit on an automatic foundation, so only very steep ground is refused
    if(mx-mn>(type==='belt'?4:14))return {ok:false,reason:'Terrain too steep, even for a foundation'};
    for(let j=minCz;j<minCz+d.d;j++)for(let i=minCx;i<minCx+d.w;i++){const o=this.at(i,j);if(o){if(type==='belt'&&o.type==='belt'&&d.w===1)replace=o;else return {ok:false,reason:'Space is occupied'};}}
    let node=null;
    if(d.mine){const [cx,cz]=[(minCx+d.w/2)*CELL-HALF,(minCz+d.d/2)*CELL-HALF];node=this.findNode(cx,cz);
      if(!node)return {ok:false,reason:'Miner must be placed on a resource node'};if(node.occupied)return {ok:false,reason:'Node already has a miner'};
      if(Math.hypot(node.x-cx,node.z-cz)>0.5)return {ok:false,reason:'Align with node',snap:node};}
    return {ok:true,node,replace};
  }
  place(type,minCx,minCz,rot,saved){
    const d=BUILDINGS[type],chk=this.canPlace(type,minCx,minCz,rot);
    if(!chk.ok)return null;
    if(chk.replace){chk.replace.rot=rot;this.afterBeltChange(chk.replace);return chk.replace;}
    const b={id:this.nid++,type,def:d,minCx,minCz,w:d.w,d:d.d,rot,in:{},out:{},prog:0,status:'idle',node:chk.node||null,store:{},fuel:0,burn:0,rr:0,buf:null,recipe:null,mt:0,anim:Math.random()*6,sink:0};
    const [cx,cz]=this.center(b);b.x=cx;b.z=cz;
    let lowest=1e9;if(type!=='belt')for(let j=minCz;j<=minCz+d.d;j++)for(let i=minCx;i<=minCx+d.w;i++)lowest=Math.min(lowest,this.world.hgt[j*(SEG+1)+i]);
    if(type!=='belt'){b.y=this.world.claim(minCx,minCz,d.w,d.d);}else b.y=this.world.cellH(minCx,minCz);
    if(d.machine){const rs=recipesFor(d.machine);b.recipe=saved&&saved.rec?RMAP[saved.rec]:null;}
    if(type==='belt'){b.items=[];b.slot=this.br.alloc();this.belts.push(b);}
    else{b.group=makeModel(type);b.group.position.set(cx,b.y,cz);b.group.rotation.y=-rot*Math.PI/2;this.group.add(b.group);
      const ph=b.y-lowest;if(ph>0.5)b.group.add(plinth(d.w,d.d,ph+1));}
    if(chk.node){chk.node.occupied=b;}
    for(let j=minCz;j<minCz+d.d;j++)for(let i=minCx;i<minCx+d.w;i++)this.cells.set(this.key(i,j),b);
    this.list.push(b);
    if(type!=='belt'){this.veg.removeRect(cx-d.w*2,cz-d.d*2,cx+d.w*2,cz+d.d*2,0.5);}
    else this.veg.removeRect(cx-2,cz-2,cx+2,cz+2,0);
    if(saved){if(saved.in)b.in=saved.in;if(saved.out)b.out=saved.out;if(saved.store)b.store=saved.store;if(saved.fuel)b.fuel=saved.fuel;}
    this.refreshNear(b);return b;
  }
  remove(b){
    const g=this.game;
    for(const k in b.def.cost)g.inv.add(k,b.def.cost[k]);
    for(const m of [b.in,b.out,b.store])for(const k in m)if(m[k]>0)g.inv.add(k,m[k]);
    if(b.type==='belt'){for(const it of b.items)g.inv.add(it.type,1);this.br.release(b.slot);this.belts.splice(this.belts.indexOf(b),1);}
    else{this.group.remove(b.group);this.world.release(b.minCx,b.minCz,b.w,b.d);}
    if(b.node)b.node.occupied=null;
    for(let j=b.minCz;j<b.minCz+b.d;j++)for(let i=b.minCx;i<b.minCx+b.w;i++)this.cells.delete(this.key(i,j));
    this.list.splice(this.list.indexOf(b),1);this.refreshNear(b);
  }
  afterBeltChange(b){this.refreshNear(b);}
  refreshNear(b){
    // refresh belt transforms in a ring around b
    for(let j=b.minCz-2;j<=b.minCz+b.d+1;j++)for(let i=b.minCx-2;i<=b.minCx+b.w+1;i++){const o=this.at(i,j);if(o&&o.type==='belt')this.setBelt(o);}
    if(b.type==='belt')this.setBelt(b);
  }
  edgeH(cx,cz,ox,oz){const a=this.world.cellH(cx,cz),o=(ox<1||oz<1||ox>=SEG-1||oz>=SEG-1)?a:this.world.cellH(ox,oz);return (a+o)/2;}
  setBelt(b){
    const [dx,dz]=DIRS[b.rot],cx=b.minCx,cz=b.minCz;
    const hH=this.world.cellH(cx,cz);
    const y0=this.edgeH(cx,cz,cx-dx,cz-dz),y1=this.edgeH(cx,cz,cx+dx,cz+dz);
    b.y0=y0+0.25;b.y1=y1+0.25;b.y=hH;
    this.br.set(b.slot,b.x,b.y0,b.y1,b.z,dx,dz);
  }
  // ---- ghost preview
  showGhost(type,pos,rot,valid){
    if(this.ghostType!==type){if(this.ghost)this.scene.remove(this.ghost);this.ghost=this.ghosts[type]||(this.ghosts[type]=makeGhost(type));this.scene.add(this.ghost);this.ghostType=type;}
    this.ghost.position.copy(pos);this.ghost.rotation.y=-rot*Math.PI/2;setGhostValid(this.ghost,valid);this.ghost.visible=true;
  }
  hideGhost(){if(this.ghost)this.ghost.visible=false;}
  clearGhost(){if(this.ghost){this.scene.remove(this.ghost);this.ghost=null;this.ghostType=null;}}
  // ---- picking
  pick(origin,dir,maxD=40){
    const p=new THREE.Vector3();
    for(let t=1;t<maxD;t+=0.5){
      p.copy(origin).addScaledVector(dir,t);const [cx,cz]=this.cellOf(p.x,p.z),b=this.at(cx,cz);
      if(b){const top=(b.y||0)+HEIGHT[b.type];if(p.y<top&&p.y>(b.y||0)-1.5)return b;}
    }
    return null;
  }
  blocked(x,z,r){
    for(let cz=Math.floor((z-r+HALF)/CELL);cz<=Math.floor((z+r+HALF)/CELL);cz++)for(let cx=Math.floor((x-r+HALF)/CELL);cx<=Math.floor((x+r+HALF)/CELL);cx++){
      const b=this.at(cx,cz);if(b&&b.type!=='belt')return b;}
    return null;
  }
  // ---- item transfer
  deliver(t,type,dirIdx){
    if(!t)return false;
    if(t.type==='belt'){
      if(dirIdx===opp(t.rot))return false;
      const t0=dirIdx===t.rot?0:0.5;
      for(const it of t.items)if(Math.abs(it.t-t0)<GAP*0.99)return false;
      let i=0;while(i<t.items.length&&t.items[i].t>t0)i++;t.items.splice(i,0,{t:t0,type});return true;
    }
    return this.accept(t,type);
  }
  accept(b,type){
    const g=this.game;
    switch(b.type){
      case 'splitter':if(b.buf)return false;b.buf=type;return true;
      case 'storage':{let s=0;for(const k in b.store)s+=b.store[k];if(s>=500)return false;b.store[type]=(b.store[type]||0)+1;return true;}
      case 'depot':return g.depotAccept(type);
      case 'coal_gen':if(type!=='coal'||b.fuel>=8)return false;b.fuel++;return true;
      case 'nuclear':if(type!=='fuel_rod'||b.fuel>=4)return false;b.fuel++;return true;
      case 'smelter':case 'constructor':case 'assembler':case 'foundry':{
        if(!b.recipe){const r=recipesFor(b.def.machine).find(r=>r.in[type]);if(!r)return false;b.recipe=r;}
        const need=b.recipe.in[type];if(!need)return false;
        if((b.in[type]||0)>=need*3+2)return false;b.in[type]=(b.in[type]||0)+1;return true;
      }
    }
    return false;
  }
  frontCells(b){
    const r=b.rot,out=[];
    if(r===0)for(let k=0;k<b.d;k++)out.push([b.minCx+b.w,b.minCz+k]);
    else if(r===1)for(let k=0;k<b.w;k++)out.push([b.minCx+k,b.minCz+b.d]);
    else if(r===2)for(let k=0;k<b.d;k++)out.push([b.minCx-1,b.minCz+k]);
    else for(let k=0;k<b.w;k++)out.push([b.minCx+k,b.minCz-1]);
    return out;
  }
  push(b,type){for(const [cx,cz] of this.frontCells(b)){const t=this.at(cx,cz);if(t&&t!==b&&this.deliver(t,type,b.rot))return true;}return false;}
  // ---- simulation
  update(dt){
    this.acc+=dt;let steps=0;while(this.acc>=1/30&&steps<4){this.acc-=1/30;steps++;this.step(1/30);}
    if(steps===4)this.acc=0;
  }
  step(dt){
    this.time+=dt;const eff=this.eff,M=this.mods,day=this.game.sky.daylight;let supply=0,demand=0;
    for(const b of this.belts){
      const it=b.items;if(!it.length)continue;
      for(let i=0;i<it.length;i++){const lim=i===0?1:it[i-1].t-GAP;it[i].t=Math.min(it[i].t+BELT_V*this.mods.belt*dt,lim);}
      const f=it[0];
      if(f.t>=0.999){const [dx,dz]=DIRS[b.rot],t=this.at(b.minCx+dx,b.minCz+dz);if(t&&this.deliver(t,f.type,b.rot))it.shift();}
    }
    for(const b of this.list){
      const def=b.def;
      switch(b.type){
        case 'miner':case 'miner2':case 'miner3':{
          if(!b.node){b.status='nonode';break;}
          const mult=PURITY[b.node.purity].mult*def.mine;
          const tot=Object.values(b.out).reduce((a,c)=>a+c,0);
          if(tot>=5){b.status='blocked';}else{demand+=def.power*M.power;if(eff<=0.01)b.status='nopower';else{b.status='working';b.prog+=dt*eff*mult*M.miner;while(b.prog>=1){b.prog-=1;b.out[b.node.type]=(b.out[b.node.type]||0)+1;this.game.stats.mined++;}}}
          const ty=b.node.type;for(let k=0;k<2&&b.out[ty]>0;k++){if(this.push(b,ty))b.out[ty]--;else break;}
          break;}
        case 'smelter':case 'constructor':case 'assembler':case 'foundry':{
          const r=b.recipe;
          const tot=Object.values(b.out).reduce((a,c)=>a+c,0);
          if(!r){b.status='norecipe';}
          else{
            let has=true;for(const k in r.in)if((b.in[k]||0)<r.in[k]){has=false;break;}
            const outCap=Object.values(r.out).reduce((a,c)=>a+c,0)*4;
            if(b.prog>0||has){
              if(tot>=outCap&&b.prog<=0)b.status='blocked';
              else{demand+=def.power*M.power;if(eff<=0.01)b.status='nopower';else{
                if(b.prog===0)for(const k in r.in)b.in[k]-=r.in[k];
                b.status='working';b.prog+=dt*eff*M.mach/r.time;if(b.prog>=1){b.prog=0;for(const k in r.out)b.out[k]=(b.out[k]||0)+r.out[k];}}}
            }else b.status='waiting';
          }
          for(const k in b.out)if(b.out[k]>0){if(this.push(b,k))b.out[k]--;break;}
          break;}
        case 'splitter':{
          if(b.buf){const [dx,dz]=DIRS[b.rot];const outs=[b.rot,(b.rot+1)%4,(b.rot+3)%4];
            for(let k=0;k<3;k++){const d=outs[(b.rr+k)%3],t=this.at(b.minCx+DIRS[d][0],b.minCz+DIRS[d][1]);if(t&&this.deliver(t,b.buf,d)){b.buf=null;b.rr=(b.rr+k+1)%3;break;}}}
          b.status=b.buf?'working':'idle';break;}
        case 'solar':supply+=def.gen*M.solar*Math.max(0,Math.min(1,(day-0.05)*1.3));b.status=day>0.08?'working':'nopower';break;
        case 'coal_gen':case 'nuclear':{
          const life=b.type==='coal_gen'?8:90;
          if(b.burn<=0&&b.fuel>0){b.fuel--;b.burn=life;}
          if(b.burn>0){b.burn-=dt;supply+=def.gen;b.status='working';}else b.status='nofuel';break;}
        case 'depot':b.status='working';break;
        default:break;
      }
    }
    this.supply=supply;this.demand=demand;
    this.eff=demand<=0?1:Math.min(1,supply/demand);
    this.game.stats.supply=supply;this.game.stats.demand=demand;
  }
  // ---- visuals
  animate(dt,playerPos,sunDir){
    this.br.scroll(dt*this.mods.belt);this.br.beginItems();
    const t=this.time;
    for(const b of this.belts){
      const [dx,dz]=DIRS[b.rot],yaw=Math.atan2(-dz,dx);
      for(const it of b.items){
        const u=it.t,px=b.x+dx*(u-0.5)*CELL,pz=b.z+dz*(u-0.5)*CELL,py=b.y0+(b.y1-b.y0)*u+0.55;
        this.br.item(it.type,px,py,pz,yaw);
      }
    }
    this.br.endItems();this.dust.update(dt);
    for(const b of this.list){
      if(b.type==='belt'||!b.group)continue;
      const d2=(b.x-playerPos.x)**2+(b.z-playerPos.z)**2;
      b.group.visible=d2<650*650;if(d2>200*200)continue;
      const ud=b.group.userData,working=b.status==='working';
      b.anim+=dt*(working?1:0.15);
      for(const [m,sp,ax] of ud.spin){if(ax==='z')m.rotation.z+=dt*sp*(working?1:0.3);else m.rotation.y+=dt*sp*(working?1:0);}
      if(ud.drill)ud.drill.position.y=ud.drill.userData.y0+Math.sin(b.anim*9)*(working?0.3:0);
      if(working&&b.node&&d2<140*140&&Math.random()<dt*14)this.dust.emit(b.x+(Math.random()-0.5)*5,b.y+0.8,b.z+(Math.random()-0.5)*5,b.node.type);
      if(ud.arm)ud.arm.position.z=Math.sin(b.anim*4)*(working?1.6:0);
      if(ud.arms)ud.arms.forEach((a,i)=>{a.position.x=Math.sin(b.anim*3+i*2)*(working?1.4:0);});
      if(ud.panel){ud.panel.rotation.set(0,0,0);ud.panel.lookAt(b.x+sunDir.x*50,b.y+3+Math.max(sunDir.y,0.15)*50,b.z+sunDir.z*50);ud.panel.rotateX(Math.PI/2);}
      const lm=b.status==='working'?lightMats.working:b.status==='waiting'||b.status==='idle'||b.status==='blocked'?lightMats.idle:lightMats.off;
      for(const l of ud.lights)l.material=lm;
      for(const gl of ud.glows)gl.material.emissiveIntensity=working||b.type==='nuclear'&&b.status==='working'?(1.8+Math.sin(t*6+b.id)*0.4):(b.type==='depot'?1.5:0.15);
    }
  }
  // ---- save/load
  serialize(){return this.list.map(b=>({t:b.type,x:b.minCx,z:b.minCz,r:b.rot,rec:b.recipe&&b.recipe.id,in:b.in,out:b.out,store:b.store,fuel:b.fuel}));}
  load(arr){for(const s of arr)this.place(s.t,s.x,s.z,s.r,{rec:s.rec,in:s.in,out:s.out,store:s.store,fuel:s.fuel});}
  setRecipe(b,id){
    for(const m of [b.in,b.out])for(const k in m)if(m[k]>0)this.game.inv.add(k,m[k]);
    b.in={};b.out={};b.prog=0;b.recipe=RMAP[id]||null;
  }
}
export {RMAP};
