import * as THREE from 'three';
import {Simplex,fbm,ridged,smooth,lerp,clamp} from './noise.js';
import {WORLD,SEG,CELL,HALF,N} from './data.js';

export const B={SAND:0,GRASS:1,FOREST:2,SWAMP:3,DESERT:4,ROCK:5,SNOW:6};
export const BIOME_NAMES=['Beach','Grassland','Forest','Swamp','Desert','Highlands','Snowfields'];
const COL={grass:[0.42,0.5,0.29],dry:[0.52,0.52,0.34],forest:[0.27,0.36,0.22],moss:[0.3,0.38,0.24],swamp:[0.31,0.33,0.23],mud:[0.27,0.24,0.18],desert:[0.74,0.65,0.48],red:[0.58,0.4,0.31],
  rock:[0.47,0.45,0.42],rock2:[0.38,0.36,0.34],scree:[0.55,0.52,0.47],snow:[0.88,0.9,0.92],sand:[0.76,0.71,0.56],wetsand:[0.55,0.5,0.4],dirt:[0.44,0.38,0.28],pad:[0.48,0.48,0.46]};
const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const toLin=c=>c.map(v=>Math.pow(v,2.2));

export class World{
  constructor(seed=1337){
    this.seed=seed;
    this.hgt=new Float32Array(N*N);this.moist=new Float32Array(N*N);this.temp=new Float32Array(N*N);
    this.mesa=new Float32Array(N*N);this.biome=new Uint8Array(N*N);this.slope=new Float32Array(N*N);
    this.col=new Float32Array(N*N*3);this.lock=new Uint8Array(N*N);this.tintAmt=new Float32Array(N*N);this.tintCol=new Float32Array(N*N*3);
    this.nColor=new Simplex(seed+99);this.nPatch=new Simplex(seed+77);
  }
  async generate(progress){
    const s=this.seed,nC=new Simplex(s),nH=new Simplex(s+1),nH2=new Simplex(s+2),nM=new Simplex(s+3),nR=new Simplex(s+4),
      nRv=new Simplex(s+5),nL=new Simplex(s+6),nT=new Simplex(s+7),nW=new Simplex(s+8),nMesa=new Simplex(s+9),nWa=new Simplex(s+10),nWb=new Simplex(s+11);
    for(let j=0;j<N;j++){
      const z=-HALF+j*CELL;
      for(let i=0;i<N;i++){
        const x=-HALF+i*CELL,k=j*N+i;
        const wx=x+70*fbm(nWa,x*0.004,z*0.004,2),wz=z+70*fbm(nWb,x*0.004,z*0.004,2);
        const cont=fbm(nC,wx*0.0016,wz*0.0016,4);
        const hills=fbm(nH,wx*0.006,wz*0.006,4)*5+fbm(nH2,x*0.025,z*0.025,3)*1.3;
        const mountM=smooth(0.0,0.5,fbm(nM,wx*0.0011+50,wz*0.0011,3)+0.12);
        let h=9+cont*16+hills+fbm(nH2,x*0.08+31,z*0.08,2)*0.4+mountM*(ridged(nR,wx*0.003,wz*0.003,5)*72+6);
        let temp=fbm(nT,x*0.0013,z*0.0013,3)*1.4-Math.max(0,h-16)*0.018;
        let moist=fbm(nW,x*0.0016+9,z*0.0016,3)*1.4;
        // rivers
        const rv=Math.abs(fbm(nRv,wx*0.0028,wz*0.0028,3));
        let river=(1-smooth(0.006,0.03,rv))*(1-smooth(0.35,0.8,mountM));
        h=h*(1-river*0.93)+(-3.2)*river*0.93;
        // lakes
        const lk=fbm(nL,x*0.0021+20,z*0.0021,3);
        const lake=smooth(0.3,0.46,lk)*(1-smooth(0.4,0.8,mountM));
        h=lerp(h,-5,lake);
        // desert mesas
        const desertW=smooth(0.12,0.3,temp)*smooth(0.05,-0.15,moist);
        let mesa=smooth(0.0,0.3,fbm(nMesa,x*0.004,z*0.004,2))*desertW;
        if(mesa>0.01&&h>1){h+=mesa*16;const t=h/7;h=lerp(h,(Math.floor(t)+smooth(0.0,0.3,t-Math.floor(t)))*7,mesa*0.9);}
        // spawn meadow
        const sd=Math.hypot(x,z),sp=1-smooth(70,200,sd);
        h=lerp(h,8.5+hills*0.4,sp);moist=lerp(moist,-0.12,sp);temp=lerp(temp,0.0,sp);mesa*=1-sp;
        const e=smooth(0.8,0.99,Math.max(Math.abs(x),Math.abs(z))/HALF);
        h+=e*75;temp-=e*0.4;
        this.hgt[k]=h;this.moist[k]=moist;this.temp[k]=temp;this.mesa[k]=mesa;
      }
      if(j%48===0){progress&&progress(j/N);await new Promise(r=>setTimeout(r,0));}
    }
  }
  idx(i,j){return j*N+i;}
  gradient(i,j){
    const h=this.hgt,i0=Math.max(i-1,0),i1=Math.min(i+1,SEG),j0=Math.max(j-1,0),j1=Math.min(j+1,SEG);
    return [(h[j*N+i1]-h[j*N+i0])/((i1-i0)*CELL),(h[j1*N+i]-h[j0*N+i])/((j1-j0)*CELL)];
  }
  paint(i,j){
    const k=j*N+i,h=this.hgt[k],[gx,gz]=this.gradient(i,j),slope=Math.hypot(gx,gz);this.slope[k]=slope;
    const moist=this.moist[k],temp=this.temp[k],x=-HALF+i*CELL,z=-HALF+j*CELL;
    const desert=smooth(0.12,0.3,temp)*smooth(0.05,-0.15,moist);
    const swamp=smooth(0.1,0.3,moist)*smooth(5.5,2.5,h)*(1-desert);
    const forest=smooth(-0.05,0.18,moist)*(1-desert)*(1-swamp);
    const snow=smooth(40,52,h-temp*14),rock=Math.max(smooth(0.6,1.0,slope),smooth(32,44,h))*(1-snow);
    const sand=smooth(2.4,0.7,h);
    const pn=this.nPatch.noise(x*0.03,z*0.03),cn=this.nColor.noise(x*0.18,z*0.18)*0.5+this.nColor.noise(x*0.6,z*0.6)*0.25;
    let c=mix(COL.grass,COL.dry,smooth(0.1,0.7,this.nPatch.noise(x*0.012+5,z*0.012)));
    c=mix(c,COL.dirt,smooth(0.45,0.8,pn)*0.7);
    c=mix(c,mix(COL.forest,COL.moss,smooth(0.2,0.8,cn+0.3)),forest);c=mix(c,mix(COL.swamp,COL.mud,smooth(0.0,0.6,pn)),swamp);
    let dc=mix(COL.desert,COL.red,Math.max(smooth(0.3,0.7,slope),this.mesa[k]*0.6));
    c=mix(c,dc,desert);
    // rock strata on steep faces, scree at the foot of slopes
    const strata=0.5+0.5*Math.sin(h*1.7+cn*3);c=mix(c,mix(COL.rock,COL.rock2,strata),rock);
    c=mix(c,COL.scree,smooth(0.35,0.55,slope)*(1-rock)*(1-snow)*0.55);
    c=mix(c,COL.snow,snow*(1-smooth(0.9,1.4,slope)*0.6));c=mix(c,mix(COL.wetsand,COL.sand,smooth(0.2,1.6,h)),sand);
    const ta=this.tintAmt[k];if(ta>0)c=mix(c,[this.tintCol[k*3],this.tintCol[k*3+1],this.tintCol[k*3+2]],ta);
    const lk=this.lock[k];if(lk>0)c=mix(c,COL.pad,0.75);
    // curvature: hollows darker, ridges catch light
    const N2=SEG+1,hh=this.hgt,ii=Math.min(Math.max(i,1),SEG-1),jj=Math.min(Math.max(j,1),SEG-1),kk=jj*N2+ii;
    const lap=(hh[kk-1]+hh[kk+1]+hh[kk-N2]+hh[kk+N2]-4*hh[kk]);
    const br=(1+cn*0.22)*clamp(1-lap*0.045,0.72,1.12);
    const L=toLin([c[0]*br,c[1]*br,c[2]*br]);
    this.col[k*3]=L[0];this.col[k*3+1]=L[1];this.col[k*3+2]=L[2];
    let id=B.GRASS;
    if(sand>0.5)id=B.SAND;else if(snow>0.5)id=B.SNOW;else if(rock>0.5)id=B.ROCK;else if(desert>0.5)id=B.DESERT;else if(swamp>0.5)id=B.SWAMP;else if(forest>0.5)id=B.FOREST;
    this.biome[k]=id;
  }
  paintAll(){for(let j=0;j<N;j++)for(let i=0;i<N;i++)this.paint(i,j);}
  heightAt(x,z){
    let gx=(x+HALF)/CELL,gz=(z+HALF)/CELL;
    gx=clamp(gx,0,SEG-1e-4);gz=clamp(gz,0,SEG-1e-4);
    const i=gx|0,j=gz|0,u=gx-i,v=gz-j,h=this.hgt,k=j*N+i;
    const ha=h[k],hc=h[k+1],hb=h[k+N],hd=h[k+N+1];
    return u+v<=1?ha+u*(hc-ha)+v*(hb-ha):hd+(1-u)*(hb-hd)+(1-v)*(hc-hd);
  }
  nearest(arr,x,z){const i=clamp(Math.round((x+HALF)/CELL),0,SEG),j=clamp(Math.round((z+HALF)/CELL),0,SEG);return arr[j*N+i];}
  biomeAt(x,z){return this.nearest(this.biome,x,z);}
  slopeAt(x,z){return this.nearest(this.slope,x,z);}
  moistAt(x,z){return this.nearest(this.moist,x,z);}
  tempAt(x,z){return this.nearest(this.temp,x,z);}
  cellH(cx,cz){const k=cz*N+cx,h=this.hgt;return (h[k]+h[k+1]+h[k+N]+h[k+N+1])/4;}
  flatDisc(cx,cz,r,h){
    const i0=Math.max(0,Math.floor((cx+HALF-r)/CELL)),i1=Math.min(SEG,Math.ceil((cx+HALF+r)/CELL)),j0=Math.max(0,Math.floor((cz+HALF-r)/CELL)),j1=Math.min(SEG,Math.ceil((cz+HALF+r)/CELL));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
      const x=-HALF+i*CELL,z=-HALF+j*CELL,d=Math.hypot(x-cx,z-cz);if(d>r)continue;
      const k=j*N+i;if(this.lock[k])continue;
      const w=1-smooth(r*0.45,r,d);this.hgt[k]=lerp(this.hgt[k],h,w);
    }
  }
  tint(cx,cz,r,color,amt){
    const c=new THREE.Color(color);
    const i0=Math.max(0,Math.floor((cx+HALF-r)/CELL)),i1=Math.min(SEG,Math.ceil((cx+HALF+r)/CELL)),j0=Math.max(0,Math.floor((cz+HALF-r)/CELL)),j1=Math.min(SEG,Math.ceil((cz+HALF+r)/CELL));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
      const d=Math.hypot(-HALF+i*CELL-cx,-HALF+j*CELL-cz);if(d>r)continue;
      const k=j*N+i,w=(1-smooth(r*0.3,r,d))*amt;
      if(w>this.tintAmt[k]){this.tintAmt[k]=w;this.tintCol[k*3]=Math.pow(c.r,1/2.2)*0.55;this.tintCol[k*3+1]=Math.pow(c.g,1/2.2)*0.55;this.tintCol[k*3+2]=Math.pow(c.b,1/2.2)*0.55;}
    }
  }
  // Flatten and lock the vertices under a footprint (cells minCx..minCx+w), return pad height
  claim(minCx,minCz,w,d){
    let locked=null,sum=0,cnt=0;
    for(let j=minCz;j<=minCz+d;j++)for(let i=minCx;i<=minCx+w;i++){const k=j*N+i;if(this.lock[k]&&locked===null)locked=this.hgt[k];sum+=this.hgt[k];cnt++;}
    const ph=locked!==null?locked:sum/cnt;
    for(let j=minCz;j<=minCz+d;j++)for(let i=minCx;i<=minCx+w;i++){const k=j*N+i;this.hgt[k]=ph;this.lock[k]++;}
    this.refresh(minCx-1,minCz-1,minCx+w+1,minCz+d+1);
    return ph;
  }
  release(minCx,minCz,w,d){
    for(let j=minCz;j<=minCz+d;j++)for(let i=minCx;i<=minCx+w;i++){const k=j*N+i;if(this.lock[k])this.lock[k]--;}
    this.refresh(minCx,minCz,minCx+w,minCz+d);
  }
  buildMesh(){
    const g=new THREE.BufferGeometry();
    const pos=new Float32Array(N*N*3),nor=new Float32Array(N*N*3),uv=new Float32Array(N*N*2),idx=new Uint32Array(SEG*SEG*6);
    for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=j*N+i;pos[k*3]=-HALF+i*CELL;pos[k*3+2]=-HALF+j*CELL;uv[k*2]=i/6;uv[k*2+1]=j/6;}
    let t=0;for(let j=0;j<SEG;j++)for(let i=0;i<SEG;i++){const a=j*N+i,b=a+N,c=a+1,d=b+1;idx[t++]=a;idx[t++]=b;idx[t++]=c;idx[t++]=c;idx[t++]=b;idx[t++]=d;}
    g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('normal',new THREE.BufferAttribute(nor,3));
    g.setAttribute('color',new THREE.BufferAttribute(this.col,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setIndex(new THREE.BufferAttribute(idx,1));
    this.geo=g;this.refresh(0,0,SEG,SEG);
    g.computeBoundingSphere();g.computeBoundingBox();
    const tex=this.detailTex();
    const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,map:tex,roughness:0.95,metalness:0}));
    m.receiveShadow=true;this.mesh=m;return m;
  }
  refresh(i0,j0,i1,j1){
    i0=Math.max(0,i0);j0=Math.max(0,j0);i1=Math.min(SEG,i1);j1=Math.min(SEG,j1);
    const pos=this.geo.attributes.position.array,nor=this.geo.attributes.normal.array;
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
      const k=j*N+i;pos[k*3+1]=this.hgt[k];
      const [gx,gz]=this.gradient(i,j),l=Math.hypot(gx,1,gz);nor[k*3]=-gx/l;nor[k*3+1]=1/l;nor[k*3+2]=-gz/l;
      this.paint(i,j);
    }
    this.geo.attributes.position.needsUpdate=true;this.geo.attributes.normal.needsUpdate=true;this.geo.attributes.color.needsUpdate=true;
  }
  detailTex(){
    const S=1024,K=S/256,c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d');
    x.fillStyle='rgb(236,236,236)';x.fillRect(0,0,S,S);
    const sp=(n,rmin,rmax,lo,hi,a)=>{n*=K;for(let i=0;i<n;i++){const v=lo+Math.random()*(hi-lo)|0,r=(rmin+Math.random()*(rmax-rmin))*K,px=Math.random()*S,py=Math.random()*S;x.fillStyle=`rgba(${v},${v},${v},${a})`;
      for(const [ox,oy] of [[0,0],[S,0],[-S,0],[0,S],[0,-S]]){x.beginPath();x.arc(px+ox,py+oy,r,0,7);x.fill();}}};
    sp(60,10,26,200,255,0.18);sp(900,1,3,150,255,0.35);sp(2500,0.4,1.2,120,255,0.5);
    const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
  }
  mapImage(){
    const c=document.createElement('canvas');c.width=c.height=SEG;const x=c.getContext('2d'),id=x.createImageData(SEG,SEG);
    for(let j=0;j<SEG;j++)for(let i=0;i<SEG;i++){
      const k=j*N+i,o=(j*SEG+i)*4,h=this.hgt[k];
      const [gx,gz]=this.gradient(i,j),sh=clamp(0.8+(gx*0.7+gz*0.7)*-0.8,0.45,1.3);
      if(h<0.2){const d=clamp(-h/5,0,1);id.data[o]=40-d*20;id.data[o+1]=100-d*40;id.data[o+2]=140-d*30;}
      else{for(let q=0;q<3;q++)id.data[o+q]=clamp(Math.pow(this.col[k*3+q],1/2.2)*255*sh,0,255);}
      id.data[o+3]=255;
    }
    x.putImageData(id,0,0);return c;
  }
}
