import * as THREE from 'three';
import {BUILDINGS,CELL,HALF,SEG,N,DIRS} from './data.js';
import {makeGhost,setGhostValid,HEIGHT} from './models.js';
import {recipesFor} from './factory.js';
import {sfx} from './audio.js';

export const HOTBAR=['belt','miner','smelter','constructor','splitter','storage','solar','assembler','depot'];
const MAXLEN=60,GR=7;
const dirTo=(a,b)=>b[0]>a[0]?0:b[1]>a[1]?1:b[0]<a[0]?2:3;

// Build-mode helpers: terrain grid, two-click belt lines, delete highlight, recipe presets.
export class BuildTool{
  constructor(ui){
    this.ui=ui;this.f=ui.factory;this.w=ui.world;const scene=ui.scene;this.scene=scene;
    const n=(2*GR+1)*2*2*GR*2;this.gpos=new Float32Array(n*3);
    const gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.BufferAttribute(this.gpos,3));
    this.grid=new THREE.LineSegments(gg,new THREE.LineBasicMaterial({color:0xffd27a,transparent:true,opacity:0.32,depthWrite:false}));
    this.grid.frustumCulled=false;this.grid.visible=false;this.grid.renderOrder=3;scene.add(this.grid);this.gkey='';
    this.pool=[];this.start=null;this.path=[];this.recipe=Object.create(null);
    this.hl=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xff4a3a,transparent:true,opacity:0.28,depthWrite:false}));this.hl.visible=false;scene.add(this.hl);
    this.mark=new THREE.Mesh(new THREE.RingGeometry(1.3,1.9,20),new THREE.MeshBasicMaterial({color:0xffb02e,transparent:true,opacity:0.8,side:THREE.DoubleSide,depthWrite:false}));
    this.mark.rotation.x=-Math.PI/2;this.mark.visible=false;scene.add(this.mark);
  }
  // Where the build cursor is: terrain under the crosshair, or a point 24 m ahead when aiming at the sky.
  aimPoint(){
    const a=this.ui.aim(45);if(a)return a;
    const p=this.ui.player,d=p.forward(),l=Math.hypot(d.x,d.z)||1,x=p.pos.x+d.x/l*24,z=p.pos.z+d.z/l*24;
    return new THREE.Vector3(x,this.w.heightAt(x,z),z);
  }
  cellOf(a){return [Math.floor((a.x+HALF)/CELL),Math.floor((a.z+HALF)/CELL)];}
  drawGrid(cx,cz){
    const k=cx+','+cz;this.grid.visible=true;if(k===this.gkey)return;this.gkey=k;
    const h=this.w.hgt,P=this.gpos;let o=0;
    const v=(i,j)=>{i=Math.max(0,Math.min(SEG,i));j=Math.max(0,Math.min(SEG,j));P[o++]=-HALF+i*CELL;P[o++]=h[j*N+i]+0.12;P[o++]=-HALF+j*CELL;};
    for(let a=-GR;a<=GR;a++)for(let b=-GR;b<GR;b++){v(cx+a,cz+b);v(cx+a,cz+b+1);v(cx+b,cz+a);v(cx+b+1,cz+a);}
    this.grid.geometry.attributes.position.needsUpdate=true;
  }
  ghost(i){while(this.pool.length<=i){const g=makeGhost('belt');g.visible=false;this.scene.add(g);this.pool.push(g);}return this.pool[i];}
  hidePool(from=0){for(let i=from;i<this.pool.length;i++)this.pool[i].visible=false;}
  hideAll(){this.grid.visible=false;this.hidePool();this.mark.visible=false;this.hl.visible=false;}
  reset(){this.start=null;this.path=[];this.hideAll();}
  cancel(){if(this.start){this.start=null;this.path=[];this.hidePool();this.mark.visible=false;return true;}return false;}
  planPath(a,b,firstAxis,endRot){
    const out=[[a[0],a[1]]];let [x,z]=a;const sx=Math.sign(b[0]-x),sz=Math.sign(b[1]-z);
    const stepX=()=>{while(x!==b[0]&&out.length<MAXLEN){x+=sx;out.push([x,z]);}},stepZ=()=>{while(z!==b[1]&&out.length<MAXLEN){z+=sz;out.push([x,z]);}};
    const xFirst=firstAxis?firstAxis==='x':Math.abs(b[0]-a[0])>=Math.abs(b[1]-a[1]);
    if(xFirst){stepX();stepZ();}else{stepZ();stepX();}
    const fallback=a.rot!==undefined?a.rot:this.ui.rot;
    const p=out.map((c,i)=>({cx:c[0],cz:c[1],rot:i<out.length-1?dirTo(c,out[i+1]):out.length>1?dirTo(out[i-1],c):fallback}));
    if(endRot!==undefined)p[p.length-1].rot=endRot;
    return p;
  }
  // building under the crosshair (not belts)
  hovered(){const p=this.ui.player,b=this.f.pick(p.eye(),p.forward(),45);return b&&b.type!=='belt'?b:null;}
  // the free cell in front of a building's output nearest to the aim point
  outputCell(b,a){
    const cells=this.f.frontCells(b);let best=null,bd=1e9;
    for(const [cx,cz] of cells){if(this.f.at(cx,cz)&&this.f.at(cx,cz).type!=='belt')continue;const d=Math.hypot((cx+0.5)*CELL-HALF-a.x,(cz+0.5)*CELL-HALF-a.z);if(d<bd){bd=d;best=[cx,cz];}}
    if(best)best.rot=b.rot;return best;
  }
  // the free cell beside a building closest to `from`, plus the direction pointing into the building
  inputCell(b,from){
    const out=[],front=new Set(this.f.frontCells(b).map(c=>c[0]+','+c[1]));
    for(let i=0;i<b.w;i++){out.push([b.minCx+i,b.minCz-1,1],[b.minCx+i,b.minCz+b.d,3]);}
    for(let j=0;j<b.d;j++){out.push([b.minCx-1,b.minCz+j,0],[b.minCx+b.w,b.minCz+j,2]);}
    let best=null,bd=1e9;
    for(const [cx,cz,r] of out){const o=this.f.at(cx,cz);if(o&&o.type!=='belt')continue;
      const hasOut=!['solar','coal_gen','nuclear','depot','storage'].includes(b.type);
      const d=Math.abs(cx-from[0])+Math.abs(cz-from[1])+(hasOut&&front.has(cx+','+cz)?50:0);if(d<bd){bd=d;best={cell:[cx,cz],rot:r};}}
    return best;
  }
  // evaluate a planned path: which cells can be built with current materials
  check(path){
    const inv=this.ui.game.inv;let plates=inv.get('iron_plate'),cost=0,built=0;
    for(const p of path){const c=this.f.canPlace('belt',p.cx,p.cz,p.rot);p.ok=c.ok;p.replace=c.replace;p.reason=c.reason;
      if(c.ok&&!c.replace){if(plates>=1){plates--;cost++;}else{p.ok=false;p.reason='Not enough Iron Plate';}}if(p.ok)built++;}
    return {cost,built};
  }
  update(){
    const ui=this.ui;
    if(ui.mode==='delete'&&ui.target&&ui.target.b){const b=ui.target.b,H=HEIGHT[b.type]||3;
      this.hl.visible=true;this.hl.position.set(b.x,(b.y||0)+H/2,b.z);this.hl.scale.set(b.w*CELL+0.4,H+0.4,b.d*CELL+0.4);}
    else this.hl.visible=false;
    if(ui.mode!=='build'||!ui.active()){this.grid.visible=false;this.hidePool();this.mark.visible=false;return null;}
    const a=this.aimPoint(),[cx,cz]=this.cellOf(a);this.drawGrid(cx,cz);
    if(ui.type!=='belt'){this.hidePool();this.mark.visible=false;return a;}
    ui.factory.hideGhost();
    const hb=this.hovered();let path,hint='';
    if(!this.start){
      if(hb){const oc=this.outputCell(hb,a);if(oc){path=this.planPath(oc,oc);hint=`Click to start a belt from the <b>${hb.def.name}</b> output`;}}
      if(!path)path=this.planPath([cx,cz],[cx,cz]);
    }else{
      const s=this.start,axis=s.rot!==undefined&&s.fromMachine?(s.rot%2===0?'x':'z'):undefined;
      if(hb){const ic=this.inputCell(hb,s);if(ic){path=this.planPath(s,ic.cell,axis,ic.rot);hint=`Click to connect into the <b>${hb.def.name}</b>`;this.endTarget=hb;}}
      if(!path){path=this.planPath(s,[cx,cz],axis);this.endTarget=null;}
    }
    this.path=path;this.snapHint=hint;
    const {cost,built}=this.check(path);
    path.forEach((p,i)=>{const g=this.ghost(i);g.visible=true;g.position.set((p.cx+0.5)*CELL-HALF,this.w.cellH(p.cx,p.cz)+0.3,(p.cz+0.5)*CELL-HALF);g.rotation.y=-p.rot*Math.PI/2;setGhostValid(g,p.ok);});
    this.hidePool(path.length);
    if(this.start){const s=this.start;this.mark.visible=true;this.mark.position.set((s[0]+0.5)*CELL-HALF,this.w.cellH(s[0],s[1])+0.5,(s[1]+0.5)*CELL-HALF);}else this.mark.visible=false;
    const bad=path.find(p=>!p.ok);
    ui.ghostMsg=bad&&built===0?bad.reason:'';
    ui.buildInfo=(this.snapHint&&this.start?this.snapHint+' · ':!this.start&&this.snapHint?this.snapHint:'')+(this.start?`Belt line: <b>${path.length}</b> long · costs <b>${cost}</b> Iron Plate${bad?` · stops early: ${bad.reason}`:''}`:this.snapHint?'':'Click to set the start of a belt line (or click a machine to start at its output)');
    return a;
  }
  click(){
    const ui=this.ui;if(ui.type!=='belt')return false;
    const a=this.aimPoint(),cur=this.cellOf(a);
    if(!this.start){
      const hb=this.hovered(),oc=hb&&this.outputCell(hb,a);
      if(oc){const c=this.f.canPlace('belt',oc[0],oc[1],oc.rot);if(!c.ok){ui.notify(c.reason,'bad');sfx.bad();return true;}this.start=oc;this.start.fromMachine=true;sfx.ui();return true;}
      const c=this.f.canPlace('belt',cur[0],cur[1],ui.rot);if(!c.ok){ui.notify(c.reason,'bad');sfx.bad();return true;}this.start=cur;sfx.ui();return true;}
    const path=this.path.length?this.path:this.planPath(this.start,cur);this.check(path);
    let n=0,last=null,why='';
    for(const p of path){if(!p.ok){why=p.reason;break;}if(!p.replace)ui.game.inv.pay({iron_plate:1});const b=this.f.place('belt',p.cx,p.cz,p.rot);if(!b)break;last=p;n++;}
    if(n){sfx.place();ui.rot=last.rot;
      if(this.endTarget&&n===path.length){ui.notify(`Connected to ${this.endTarget.def.name}`,'good');this.start=null;this.endTarget=null;}
      else{this.start=[last.cx,last.cz];this.start.rot=last.rot;}
      if(why)ui.notify(`Built ${n} belts, stopped: ${why}`,'bad');}
    else{ui.notify(why||'Cannot build here','bad');sfx.bad();}
    return true;
  }
  cycleRecipe(){
    const ui=this.ui,d=BUILDINGS[ui.type];if(!d||!d.machine)return;
    const rs=recipesFor(d.machine),i=((this.recipe[ui.type]??-1)+1)%(rs.length+1);this.recipe[ui.type]=i===rs.length?-1:i;
    ui.notify('Recipe for new '+d.name+': '+(i===rs.length?'automatic (from first input)':rs[i].name));
  }
  recipeFor(type){const d=BUILDINGS[type];if(!d||!d.machine)return null;const i=this.recipe[type];return i>=0?recipesFor(d.machine)[i]:null;}
}
