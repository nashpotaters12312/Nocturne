export const clamp=(v,a,b)=>v<a?a:v>b?b:v;
export const lerp=(a,b,t)=>a+(b-a)*t;
export function smooth(e0,e1,x){const t=clamp((x-e0)/(e1-e0),0,1);return t*t*(3-2*t);}
export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const GRAD=[[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
const F2=0.5*(Math.sqrt(3)-1),G2=(3-Math.sqrt(3))/6;
export class Simplex{
  constructor(seed){
    const r=mulberry32(seed),p=new Uint8Array(256);
    for(let i=0;i<256;i++)p[i]=i;
    for(let i=255;i>0;i--){const j=(r()*(i+1))|0;const t=p[i];p[i]=p[j];p[j]=t;}
    this.perm=new Uint8Array(512);this.pm=new Uint8Array(512);
    for(let i=0;i<512;i++){this.perm[i]=p[i&255];this.pm[i]=this.perm[i]&7;}
  }
  noise(x,y){
    const s=(x+y)*F2,i=Math.floor(x+s),j=Math.floor(y+s),t=(i+j)*G2;
    const x0=x-(i-t),y0=y-(j-t);
    const i1=x0>y0?1:0,j1=x0>y0?0:1;
    const x1=x0-i1+G2,y1=y0-j1+G2,x2=x0-1+2*G2,y2=y0-1+2*G2;
    const ii=i&255,jj=j&255,P=this.perm,M=this.pm;
    let n0=0,n1=0,n2=0,t0=0.5-x0*x0-y0*y0;
    if(t0>0){t0*=t0;const g=GRAD[M[ii+P[jj]]];n0=t0*t0*(g[0]*x0+g[1]*y0);}
    let t1=0.5-x1*x1-y1*y1;
    if(t1>0){t1*=t1;const g=GRAD[M[ii+i1+P[jj+j1]]];n1=t1*t1*(g[0]*x1+g[1]*y1);}
    let t2=0.5-x2*x2-y2*y2;
    if(t2>0){t2*=t2;const g=GRAD[M[ii+1+P[jj+1]]];n2=t2*t2*(g[0]*x2+g[1]*y2);}
    return 70*(n0+n1+n2);
  }
}
export function fbm(n,x,y,oct=4,lac=2,gain=0.5){let a=1,f=1,s=0,m=0;for(let i=0;i<oct;i++){s+=a*n.noise(x*f,y*f);m+=a;a*=gain;f*=lac;}return s/m;}
export function ridged(n,x,y,oct=4){let a=1,f=1,s=0,m=0,w=1;for(let i=0;i<oct;i++){let v=1-Math.abs(n.noise(x*f,y*f));v*=v;v*=w;w=clamp(v*2,0,1);s+=v*a;m+=a;a*=0.5;f*=2.1;}return s/m;}
