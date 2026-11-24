let ctx=null;
function c(){if(!ctx){try{ctx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}}return ctx;}
export function tone(f,d=0.1,type='sine',vol=0.08,slide=0){
  const a=c();if(!a)return;if(a.state==='suspended')a.resume();
  const o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.value=f;if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,f+slide),a.currentTime+d);
  g.gain.value=vol;g.gain.exponentialRampToValueAtTime(0.0001,a.currentTime+d);o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+d);
}
export function noise(d=0.1,vol=0.08,freq=800){
  const a=c();if(!a)return;const n=a.sampleRate*d,b=a.createBuffer(1,n,a.sampleRate),dd=b.getChannelData(0);for(let i=0;i<n;i++)dd[i]=(Math.random()*2-1)*(1-i/n);
  const s=a.createBufferSource();s.buffer=b;const f=a.createBiquadFilter();f.type='lowpass';f.frequency.value=freq;const g=a.createGain();g.gain.value=vol;s.connect(f);f.connect(g);g.connect(a.destination);s.start();
}
export const sfx={place:()=>{tone(220,0.12,'square',0.06,-80);noise(0.08,0.1,1200);},del:()=>{tone(180,0.15,'sawtooth',0.05,-120);},ui:()=>tone(660,0.05,'sine',0.04),
  hit:()=>{noise(0.12,0.16,500);tone(120,0.1,'square',0.05,-60);},swing:()=>noise(0.12,0.05,2500),mine:()=>{noise(0.07,0.12,1500);tone(300+Math.random()*80,0.05,'triangle',0.04);},
  scan:()=>tone(300,0.9,'sine',0.07,900),bad:()=>tone(140,0.15,'square',0.05),unlock:()=>{tone(523,0.15,'triangle',0.08);setTimeout(()=>tone(784,0.3,'triangle',0.08),150);},hurt:()=>{noise(0.2,0.2,400);tone(90,0.2,'sawtooth',0.07,-40);},eat:()=>noise(0.2,0.08,900)};
