// Graphics presets. "auto" picks Low on Chromebooks / weak CPUs.
const PRESETS={
  low:{pr:1,minPr:0.5,aa:false,shadows:false,shadowMap:0,grass:0.25,trees:0.65,view:0.55,animalR:130,clouds:10,fireflies:false,fogMul:1.6,far:1400,flowers:0.2,birds:3},
  medium:{pr:1,minPr:0.6,aa:false,shadows:true,shadowMap:1024,grass:0.55,trees:0.85,view:0.8,animalR:190,clouds:26,fireflies:true,fogMul:1.2,far:2200,flowers:0.6,birds:6},
  high:{pr:1.5,minPr:0.7,aa:true,shadows:true,shadowMap:2048,grass:1,trees:1,view:1,animalR:260,clouds:46,fireflies:true,fogMul:1,far:3500,flowers:1,birds:8},
};
export function detect(){
  let q='auto';try{q=localStorage.getItem('ironvale-q')||'auto';}catch(e){}
  if(q==='auto'){const cros=/CrOS/.test(navigator.userAgent),cores=navigator.hardwareConcurrency||4,mem=navigator.deviceMemory||4;
    q=cros||cores<=4||mem<=4?'low':cores<=8?'medium':'high';}
  return q;
}
export const setting=(()=>{try{return localStorage.getItem('ironvale-q')||'auto';}catch(e){return 'auto';}})();
export const level=detect();
export const Q=PRESETS[level];
