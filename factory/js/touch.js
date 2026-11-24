// On-screen controls for phones and tablets: left stick to move, drag anywhere else to look,
// buttons for every keyboard action.
const BTN=[
  // [id, label, kind, arg] kind: hold=key held, tap=onKey, act=primary action, use=E
  ['act','⛏','act'],['use','E','use'],['jump','⤒','hold','Space'],['run','RUN','toggle','ShiftLeft'],
  ['rot','⟳','tap','KeyR'],['cancel','✕','cancel'],['del','DEL','tap','KeyX'],['eat','EAT','tap','KeyF'],
  ['build','BUILD','tap','KeyQ'],['inv','BAG','tap','Tab'],['upg','UPG','tap','KeyU'],['goal','GOALS','tap','KeyJ'],['map','MAP','tap','KeyM'],['scan','SCAN','tap','KeyV'],['pause','❚❚','pause'],
];
export class TouchControls{
  constructor(ui){
    this.ui=ui;this.player=ui.player;this.stick={x:0,y:0};this.player.stick=this.stick;
    const root=document.createElement('div');root.id='touch';document.body.appendChild(root);this.root=root;
    root.innerHTML=`<div id="tstick"><div id="tknob"></div></div><div id="tmenu"></div><div id="tactions"></div><div id="trotate">Turn your device sideways for the best view</div>`;
    this.base=root.querySelector('#tstick');this.knob=root.querySelector('#tknob');
    const menu=root.querySelector('#tmenu'),acts=root.querySelector('#tactions');this.btn={};
    for(const [id,label,kind,arg] of BTN){
      const b=document.createElement('button');b.className='tb tb-'+id;b.textContent=label;b.dataset.id=id;
      (['build','inv','upg','goal','map','scan','pause'].includes(id)?menu:acts).appendChild(b);this.btn[id]=b;
      b.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();try{b.setPointerCapture(e.pointerId);}catch(_){}b.classList.add('on');this.press(id,kind,arg,true);});
      const up=e=>{e.preventDefault();e.stopPropagation();if(!b.classList.contains('on'))return;b.classList.remove('on');this.press(id,kind,arg,false);};
      b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);
    }
    this.look=new Map();this.stickId=null;
    root.addEventListener('pointerdown',e=>this.down(e));root.addEventListener('pointermove',e=>this.move(e));
    root.addEventListener('pointerup',e=>this.up(e));root.addEventListener('pointercancel',e=>this.up(e));
    root.addEventListener('contextmenu',e=>e.preventDefault());
  }
  press(id,kind,arg,on){
    const ui=this.ui,k=this.player.keys;
    if(kind==='hold'){k[arg]=on;return;}
    if(!on&&kind!=='act'&&kind!=='use')return;
    switch(kind){
      case 'tap':ui.onKey(arg);break;
      case 'toggle':k[arg]=!k[arg];this.btn[id].classList.toggle('lit',!!k[arg]);break;
      case 'act':ui.mouse.l=on;if(on)ui.onClick();else{ui.lastBelt=null;ui.lastCell=null;}break;
      case 'use':if(on){k.KeyE=true;this.useT=performance.now();ui.onKey('KeyE');}else k.KeyE=false;break;
      case 'cancel':ui.setMode('hand');break;
      case 'pause':ui.togglePause();break;
    }
  }
  down(e){
    if(e.target!==this.root)return;e.preventDefault();
    const w=innerWidth,h=innerHeight;
    if(this.stickId===null&&e.clientX<w*0.4&&e.clientY>h*0.35){
      this.stickId=e.pointerId;this.sx=e.clientX;this.sy=e.clientY;
      this.base.style.left=(e.clientX-60)+'px';this.base.style.top=(e.clientY-60)+'px';this.base.style.bottom='auto';this.base.classList.add('on');this.knob.style.transform='translate(0,0)';
    }else this.look.set(e.pointerId,{x:e.clientX,y:e.clientY});
    try{this.root.setPointerCapture(e.pointerId);}catch(_){}
  }
  move(e){
    if(e.pointerId===this.stickId){
      let dx=e.clientX-this.sx,dy=e.clientY-this.sy;const d=Math.hypot(dx,dy),m=55;if(d>m){dx*=m/d;dy*=m/d;}
      this.stick.x=dx/m;this.stick.y=dy/m;this.knob.style.transform=`translate(${dx}px,${dy}px)`;
      // push the stick far forward to sprint
      this.player.keys.TouchSprint=d>m*0.98&&dy<-m*0.8;return;
    }
    const l=this.look.get(e.pointerId);if(!l)return;
    if(this.ui.active())this.player.look((e.clientX-l.x)*2.1,(e.clientY-l.y)*2.1);
    l.x=e.clientX;l.y=e.clientY;
  }
  up(e){
    if(e.pointerId===this.stickId){this.stickId=null;this.stick.x=this.stick.y=0;this.player.keys.TouchSprint=false;this.base.style.left=this.base.style.top=this.base.style.bottom='';this.base.classList.remove('on');this.knob.style.transform='translate(0,0)';}
    this.look.delete(e.pointerId);
  }
  update(){
    const ui=this.ui,b=this.btn,build=ui.mode==='build',del=ui.mode==='delete';
    b.rot.hidden=!build;b.cancel.hidden=ui.mode==='hand';b.del.hidden=build||del;
    b.act.textContent=build?'✚':del?'✖':'⛏';b.eat.hidden=!(this.ui.game.inv.get('meat')>0&&this.player.hp<this.player.maxHp);
    this.root.hidden=!!(ui.panel||ui.pauseShown||!ui.game.running);
  }
}
export const TOUCH_CSS=`
#touch{position:fixed;inset:0;z-index:5;touch-action:none;-webkit-user-select:none;user-select:none}
#tstick{position:absolute;left:calc(28px + env(safe-area-inset-left,0px));bottom:calc(28px + env(safe-area-inset-bottom,0px));width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.08);border:2px solid rgba(255,255,255,.25);opacity:.55;pointer-events:none}
#tstick.on{opacity:1}
#tknob{position:absolute;left:35px;top:35px;width:50px;height:50px;border-radius:50%;background:rgba(255,176,46,.85);box-shadow:0 2px 10px rgba(0,0,0,.5)}
.tb{position:relative;touch-action:none;font:700 13px system-ui,sans-serif;color:#fff;background:rgba(16,22,30,.72);border:2px solid rgba(255,255,255,.28);border-radius:50%;width:56px;height:56px;padding:0;pointer-events:auto}
.tb.on{background:rgba(255,176,46,.85);border-color:#ffb02e}.tb.lit{border-color:#38c8ff;color:#38c8ff}
#tactions{position:absolute;right:calc(18px + env(safe-area-inset-right,0px));bottom:calc(18px + env(safe-area-inset-bottom,0px));width:220px;height:210px;pointer-events:none}
#tactions .tb{position:absolute}
.tb-act{right:0;bottom:0;width:84px!important;height:84px!important;font-size:30px!important;background:rgba(185,122,18,.8)!important}
.tb-use{right:96px;bottom:6px;font-size:18px!important}.tb-jump{right:12px;bottom:96px;font-size:22px!important}.tb-run{right:160px;bottom:6px}
.tb-rot{right:84px;bottom:84px;font-size:22px!important}.tb-cancel{right:150px;bottom:74px;font-size:20px!important}.tb-del{right:150px;bottom:74px}.tb-eat{right:76px;bottom:150px}
#tmenu{position:absolute;right:calc(8px + env(safe-area-inset-right,0px));top:calc(130px + env(safe-area-inset-top,0px));display:flex;flex-direction:column;gap:6px;pointer-events:none}
#tmenu .tb{width:52px;height:34px;border-radius:8px;font-size:11px}
#trotate{display:none;position:absolute;left:50%;top:40%;transform:translateX(-50%);padding:10px 16px;background:rgba(16,22,30,.88);border:1px solid #2c3644;border-radius:8px;font-size:14px;color:#e6ebf2;pointer-events:none;text-align:center}
@media (orientation:portrait){#trotate{display:block}}
`;
