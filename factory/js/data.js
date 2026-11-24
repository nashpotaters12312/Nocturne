export const WORLD=1536,SEG=384,CELL=4,HALF=WORLD/2,N=SEG+1;
export const DIRS=[[1,0],[0,1],[-1,0],[0,-1]];

const O=[.55,.5,.55],I=[.9,.28,.5],P=[.8,.1,.8],R=[1,.12,.12],C=[.5,.5,.5];
export const ITEMS={
  iron_ore:{name:'Iron Ore',color:0x8fa3b5,shape:O},copper_ore:{name:'Copper Ore',color:0xe07b39,shape:O},
  limestone:{name:'Limestone',color:0xefe9d2,shape:O},coal:{name:'Coal',color:0x2b2b2e,shape:O},
  caterium_ore:{name:'Caterium Ore',color:0xffd23f,shape:O},sulfur:{name:'Sulfur',color:0xd4f03a,shape:O},
  quartz:{name:'Raw Quartz',color:0xf2a6ff,shape:O},bauxite:{name:'Bauxite',color:0xd9533a,shape:O},uranium:{name:'Uranium',color:0x4dff5a,shape:O},
  tin_ore:{name:'Tin Ore',color:0x4fd6c0,shape:O},titanium_ore:{name:'Titanium Ore',color:0x5b8cff,shape:O},ruby_ore:{name:'Ruby Ore',color:0xe0245e,shape:O},
  tin_ingot:{name:'Tin Ingot',color:0x8fe3d6,shape:I},bronze_ingot:{name:'Bronze Ingot',color:0xb8803a,shape:I},titanium_ingot:{name:'Titanium Ingot',color:0x8fb0ff,shape:I},
  bronze_plate:{name:'Bronze Plate',color:0xc9893f,shape:P},titanium_plate:{name:'Titanium Plate',color:0xa8c0ff,shape:P},cut_ruby:{name:'Cut Ruby',color:0xff3d7a,shape:[.4,.4,.4]},
  power_core:{name:'Power Core',color:0xff5aa0,shape:[.6,.6,.6]},titanium_frame:{name:'Titanium Frame',color:0x7f9cf0,shape:[.8,.8,.8]},
  iron_ingot:{name:'Iron Ingot',color:0xb8bfc7,shape:I},copper_ingot:{name:'Copper Ingot',color:0xd98a52,shape:I},
  caterium_ingot:{name:'Caterium Ingot',color:0xf3c33b,shape:I},aluminum_ingot:{name:'Aluminum Ingot',color:0xdfe6ea,shape:I},
  steel_ingot:{name:'Steel Ingot',color:0x596a78,shape:I},glass:{name:'Glass',color:0xbfe9f5,shape:P},
  iron_plate:{name:'Iron Plate',color:0xaab2ba,shape:P},iron_rod:{name:'Iron Rod',color:0x9aa2aa,shape:R},
  screw:{name:'Screw',color:0xc8ccd0,shape:[.2,.2,.2]},wire:{name:'Wire',color:0xe9a15f,shape:R},
  cable:{name:'Cable',color:0x2e3440,shape:[.7,.2,.2]},concrete:{name:'Concrete',color:0x9b9b94,shape:[.7,.4,.7]},
  quickwire:{name:'Quickwire',color:0xffe27a,shape:R},steel_beam:{name:'Steel Beam',color:0x6f8394,shape:[1,.2,.2]},
  alu_sheet:{name:'Aluminum Sheet',color:0xe8eff2,shape:P},reinforced_plate:{name:'Reinforced Plate',color:0x8b95a0,shape:[.8,.25,.8]},
  rotor:{name:'Rotor',color:0xb0743a,shape:C},circuit_board:{name:'Circuit Board',color:0x3fa66b,shape:[.7,.1,.5]},
  modular_frame:{name:'Modular Frame',color:0x7d8794,shape:[.8,.8,.8]},battery:{name:'Battery',color:0x44d4ff,shape:[.4,.6,.4]},
  black_powder:{name:'Black Powder',color:0x44443f,shape:[.5,.4,.5]},computer:{name:'Computer',color:0x59616e,shape:[.9,.5,.7]},
  fuel_rod:{name:'Uranium Fuel Rod',color:0x7dff6b,shape:[.15,1,.15]},meat:{name:'Raw Meat',color:0xc2453f,shape:C},
};
export const RESOURCES={
  iron_ore:{name:'Iron',color:0x8fa3b5},copper_ore:{name:'Copper',color:0xe07b39},limestone:{name:'Limestone',color:0xefe9d2},
  coal:{name:'Coal',color:0x3a3a40},caterium_ore:{name:'Caterium',color:0xffd23f},sulfur:{name:'Sulfur',color:0xd4f03a},
  quartz:{name:'Quartz',color:0xf2a6ff},bauxite:{name:'Bauxite',color:0xd9533a},uranium:{name:'Uranium',color:0x4dff5a},
  tin_ore:{name:'Tin',color:0x4fd6c0},titanium_ore:{name:'Titanium',color:0x5b8cff},ruby_ore:{name:'Ruby',color:0xe0245e},
};
export const PURITY=[{name:'Impure',mult:0.5},{name:'Normal',mult:1},{name:'Pure',mult:2}];

const r=(id,machine,name,inn,out,time)=>({id,machine,name,in:inn,out,time});
export const RECIPES=[
  r('iron_ingot','smelter','Iron Ingot',{iron_ore:1},{iron_ingot:1},2),
  r('copper_ingot','smelter','Copper Ingot',{copper_ore:1},{copper_ingot:1},2),
  r('caterium_ingot','smelter','Caterium Ingot',{caterium_ore:2},{caterium_ingot:1},3),
  r('aluminum_ingot','smelter','Aluminum Ingot',{bauxite:2},{aluminum_ingot:1},3),
  r('glass','smelter','Glass',{quartz:1},{glass:1},2),
  r('tin_ingot','smelter','Tin Ingot',{tin_ore:1},{tin_ingot:1},2),
  r('titanium_ingot','smelter','Titanium Ingot',{titanium_ore:2},{titanium_ingot:1},4),
  r('bronze_plate','constructor','Bronze Plate',{bronze_ingot:2},{bronze_plate:1},3),
  r('titanium_plate','constructor','Titanium Plate',{titanium_ingot:2},{titanium_plate:1},4),
  r('cut_ruby','constructor','Cut Ruby',{ruby_ore:2},{cut_ruby:1},4),
  r('power_core','assembler','Power Core',{cut_ruby:2,bronze_plate:2},{power_core:1},10),
  r('titanium_frame','assembler','Titanium Frame',{titanium_plate:4,steel_beam:2},{titanium_frame:1},12),
  r('bronze_ingot','foundry','Bronze Ingot',{copper_ingot:1,tin_ingot:1},{bronze_ingot:2},4),
  r('iron_plate','constructor','Iron Plate',{iron_ingot:3},{iron_plate:2},4),
  r('iron_rod','constructor','Iron Rod',{iron_ingot:1},{iron_rod:1},3),
  r('screw','constructor','Screw',{iron_rod:1},{screw:4},3),
  r('wire','constructor','Wire',{copper_ingot:1},{wire:2},3),
  r('cable','constructor','Cable',{wire:2},{cable:1},3),
  r('concrete','constructor','Concrete',{limestone:3},{concrete:1},4),
  r('quickwire','constructor','Quickwire',{caterium_ingot:1},{quickwire:4},3),
  r('steel_beam','constructor','Steel Beam',{steel_ingot:2},{steel_beam:1},4),
  r('alu_sheet','constructor','Aluminum Sheet',{aluminum_ingot:3},{alu_sheet:2},4),
  r('reinforced_plate','assembler','Reinforced Plate',{iron_plate:4,screw:8},{reinforced_plate:1},8),
  r('rotor','assembler','Rotor',{iron_rod:3,screw:10},{rotor:1},8),
  r('circuit_board','assembler','Circuit Board',{cable:4,glass:2},{circuit_board:1},8),
  r('modular_frame','assembler','Modular Frame',{reinforced_plate:2,iron_rod:6},{modular_frame:1},10),
  r('battery','assembler','Battery',{sulfur:3,alu_sheet:2},{battery:1},10),
  r('black_powder','assembler','Black Powder',{coal:1,sulfur:2},{black_powder:2},6),
  r('computer','assembler','Computer',{circuit_board:3,quickwire:8},{computer:1},14),
  r('fuel_rod','assembler','Uranium Fuel Rod',{uranium:4,steel_beam:2},{fuel_rod:1},20),
  r('steel_ingot','foundry','Steel Ingot',{iron_ingot:1,coal:1},{steel_ingot:1},3),
];
export const MACHINE_TYPES=['smelter','constructor','assembler','foundry'];

export const BUILDINGS={
  belt:{name:'Conveyor Belt',w:1,d:1,cat:'Logistics',cost:{iron_plate:1},power:0,desc:'Moves items (120/min). Hold LMB and drag to lay a line.'},
  splitter:{name:'Splitter',w:1,d:1,cat:'Logistics',cost:{iron_plate:3,wire:4},power:0,unlock:'splitter',desc:'Splits input across front, left and right outputs.'},
  storage:{name:'Storage Crate',w:1,d:1,cat:'Logistics',cost:{iron_plate:4,iron_rod:4},power:0,desc:'Stores up to 500 items. Press E to take items.'},
  depot:{name:'Delivery Depot',w:3,d:3,cat:'Logistics',cost:{iron_plate:10,wire:10,concrete:10},power:0,desc:'Deliver items here to complete milestones.'},
  miner:{name:'Miner Mk.1',w:2,d:2,cat:'Production',cost:{iron_plate:8,iron_rod:4,concrete:4},power:5,mine:1,desc:'Place on a resource node. 30 / 60 / 120 per min on Impure / Normal / Pure.'},
  miner2:{name:'Miner Mk.2',w:2,d:2,cat:'Production',cost:{iron_plate:20,iron_rod:12,concrete:12,reinforced_plate:3},power:12,mine:2,unlock:'miner2',desc:'Twice the output of a Mk.1: up to 240 per min on a Pure node.'},
  miner3:{name:'Miner Mk.3',w:2,d:2,cat:'Production',cost:{steel_beam:8,concrete:20,reinforced_plate:6,circuit_board:4},power:30,mine:4,unlock:'miner3',desc:'Four times a Mk.1: up to 480 per min on a Pure node. Split or upgrade belts to carry it.'},
  smelter:{name:'Smelter',w:2,d:2,cat:'Production',cost:{iron_rod:6,wire:6},power:4,machine:'smelter',desc:'Smelts ores into ingots.'},
  constructor:{name:'Constructor',w:2,d:2,cat:'Production',cost:{iron_plate:6,iron_rod:6,wire:8},power:4,machine:'constructor',desc:'Makes parts from one input.'},
  assembler:{name:'Assembler',w:3,d:3,cat:'Production',cost:{iron_plate:20,iron_rod:10,cable:10,concrete:10},power:15,machine:'assembler',unlock:'assembler',desc:'Combines two inputs into advanced parts.'},
  foundry:{name:'Foundry',w:2,d:2,cat:'Production',cost:{iron_rod:10,concrete:10,wire:10,screw:20},power:16,machine:'foundry',unlock:'foundry',desc:'Alloys two inputs (steel).'},
  solar:{name:'Solar Array',w:2,d:2,cat:'Power',cost:{iron_plate:6,wire:10,concrete:4},gen:12,desc:'12 MW at noon. Nothing at night.'},
  coal_gen:{name:'Coal Generator',w:3,d:3,cat:'Power',cost:{iron_plate:20,wire:20,concrete:20},gen:75,unlock:'coal_gen',desc:'75 MW. Feed with coal by belt.'},
  nuclear:{name:'Nuclear Reactor',w:4,d:4,cat:'Power',cost:{steel_beam:30,concrete:100,computer:5},gen:250,unlock:'nuclear',desc:'250 MW. Feed with Uranium Fuel Rods.'},
};
export const START_UNLOCKED=['belt','storage','depot','miner','smelter','constructor','solar'];

export const MILESTONES=[
  {id:'m1',name:'Spark of Industry',req:{iron_plate:30,wire:20},unlock:['splitter','coal_gen'],text:'Unlocks Splitter and Coal Generator.'},
  {id:'m2',name:'Foundations',req:{concrete:40,iron_rod:30,screw:60},unlock:['assembler','miner2'],text:'Unlocks Assembler and Miner Mk.2.'},
  {id:'m3',name:'Steel Age',req:{reinforced_plate:8,cable:20},unlock:['foundry'],text:'Unlocks Foundry.'},
  {id:'m4',name:'Advanced Alloys',req:{steel_beam:20,circuit_board:10,bronze_plate:15},unlock:['tier3','miner3'],text:'Unlocks Miner Mk.3 and level 3 of most upgrades.'},
  {id:'m5',name:'Atomic Dawn',req:{computer:5,battery:10,modular_frame:5},unlock:['nuclear'],text:'Unlocks Nuclear Reactor.'},
  {id:'m6',name:'The Ironvale Beacon',req:{computer:15,fuel_rod:5,titanium_frame:10,power_core:10,battery:15},unlock:['beacon'],text:'Light the beacon. Final milestone.'},
];
export const START_INV={iron_plate:120,iron_rod:60,screw:100,wire:80,cable:20,concrete:60};

// Upgrades: each level has a cost and the number of milestones that must be done first.
const L=(cost,tier=0)=>({cost,tier});
export const UPGRADES=[
  {id:'boots',name:'Running Boots',desc:'+15% walk and sprint speed per level.',lv:[L({iron_plate:30,iron_rod:20}),L({bronze_plate:15,screw:60},1),L({titanium_plate:20,circuit_board:5},4)]},
  {id:'jump',name:'Jump Springs',desc:'+15% jump height per level.',lv:[L({iron_rod:20,wire:20}),L({rotor:4,bronze_plate:10},2)]},
  {id:'vital',name:'Vitality',desc:'+25 max health per level.',lv:[L({concrete:20,iron_plate:20}),L({reinforced_plate:4},2),L({battery:5,titanium_plate:5},4)]},
  {id:'pick',name:'Prospector Pickaxe',desc:'Faster hand mining and +10 melee damage per level.',lv:[L({iron_plate:20,iron_rod:10}),L({steel_beam:8},3),L({titanium_plate:10,cut_ruby:3},4)]},
  {id:'scan',name:'Scanner Range',desc:'+40% scanner radius per level.',lv:[L({wire:30,glass:5},1),L({circuit_board:6,cut_ruby:2},4)]},
  {id:'belt',name:'Belt Speed',desc:'Belts move x1.5 (Mk2) then x2 (Mk3): 180 / 240 items per min.',lv:[L({iron_plate:80,iron_rod:20},2),L({steel_beam:20,reinforced_plate:6},4)]},
  {id:'miner',name:'Miner Overclock',desc:'+25% miner output per level.',lv:[L({iron_plate:30,concrete:10},1),L({bronze_plate:20,rotor:4},3),L({titanium_plate:20,power_core:2},4)]},
  {id:'mach',name:'Machine Overclock',desc:'+20% smelter/constructor/assembler/foundry speed per level.',lv:[L({cable:20,iron_plate:20},2),L({circuit_board:8},3),L({computer:2,power_core:2},4)]},
  {id:'eff',name:'Efficiency Core',desc:'-20% power use of all machines per level.',lv:[L({wire:40,bronze_plate:10},3),L({power_core:4,battery:6},5)]},
  {id:'solar',name:'Solar Efficiency',desc:'+40% solar output per level.',lv:[L({glass:10,wire:30},2),L({power_core:3,titanium_plate:10},4)]},
];
