// World layout: named places, roads, rivers, regions.
// Coordinates: x = east, z = south. North is -z.

export const WORLD_HALF = 2000;
export const PLAY_HALF = 1880;
export const WATER_LEVEL = 0;

export const LOCATIONS = {
  wakeshrine: { name: "Aldric's Wayshrine", x: 150, z: -170, r: 26, type: 'shrine', shrine: true },
  hollowmere: { name: 'Hollowmere', x: 0, z: 60, r: 95, type: 'village', shrine: true, houses: 11 },
  greyhallow: { name: 'Greyhallow', x: -300, z: -820, r: 80, type: 'village', shrine: true, houses: 8 },
  brackwater: { name: 'Brackwater', x: -760, z: 330, r: 80, type: 'village', shrine: true, houses: 7, stilts: true },
  emberfall: { name: 'Emberfall', x: 720, z: 640, r: 85, type: 'village', shrine: true, houses: 8 },
  spire: { name: 'Spire of Vael', x: 0, z: -1480, r: 150, type: 'spire', shrine: true },
  bloodmoon: { name: 'Bloodmoon Keep', x: 1330, z: -420, r: 120, type: 'keep', shrine: true },
  mirefen: { name: "Morwen's Hollow", x: -1440, z: 170, r: 70, type: 'witch', shrine: true },
  abbey: { name: 'Ashen Abbey', x: 0, z: 1420, r: 190, type: 'abbey', shrine: true },
  gnashpit: { name: 'The Gnashpit', x: 1100, z: 1100, r: 150, type: 'pit', shrine: false },
  tower: { name: "Hermit's Tower", x: -640, z: -1180, r: 40, type: 'tower', shrine: false },
  camp_n: { name: 'Thornwood Raider Camp', x: 380, z: -760, r: 45, type: 'camp' },
  camp_w: { name: 'Mire Goblin Camp', x: -1050, z: -150, r: 45, type: 'camp' },
  camp_e: { name: 'Gorge Raider Camp', x: 950, z: -560, r: 45, type: 'camp' },
  camp_s: { name: 'Ashroad Camp', x: 420, z: 1050, r: 45, type: 'camp' },
  camp_c: { name: 'Hollow Hill Camp', x: -400, z: 430, r: 40, type: 'camp' },
  graveyard: { name: 'Sunken Graveyard', x: -480, z: 1220, r: 70, type: 'graves' },
  standing: { name: 'The Weeping Stones', x: 650, z: -60, r: 40, type: 'stones', shrine: true },
};

// Road network (polylines)
export const ROADS = [
  [[150, -170], [80, -60], [0, 60]],
  [[0, 60], [-120, -300], [-260, -600], [-300, -820], [-200, -1040], [-40, -1220], [0, -1340]],
  [[0, 60], [-300, 200], [-560, 300], [-760, 330], [-1000, 260], [-1250, 210], [-1380, 180]],
  [[0, 60], [300, 240], [520, 470], [720, 640], [900, 860], [1010, 990]],
  [[0, 60], [40, 420], [-40, 820], [-20, 1120], [0, 1260]],
  [[0, 60], [320, 0], [650, -60], [900, -40], [1120, -200], [1250, -330]],
  [[720, 640], [500, 920], [260, 1180], [140, 1300]],
  [[-300, -820], [-500, -1000], [-640, -1150]],
];

// Main river: from the north-east mountains, through the Crimson Gorge, across the vale, into the swamp.
export const RIVER = [
  [1950, -950], [1650, -600], [1450, -330], [1260, -130], [1000, 120], [700, 330],
  [380, 470], [60, 560], [-300, 560], [-620, 500], [-950, 420], [-1250, 330], [-1600, 300], [-1950, 260],
];

export const REGIONS = [
  { id: 'vale', name: 'The Hollow Vale', x: 0, z: 100, r: 700 },
  { id: 'thornwood', name: 'Thornwood', x: -150, z: -950, r: 650 },
  { id: 'mirefen', name: 'The Mirefen', x: -1300, z: 250, r: 700 },
  { id: 'gorge', name: 'The Crimson Gorge', x: 1380, z: -420, r: 650 },
  { id: 'ashen', name: 'The Ashen Vale', x: 0, z: 1350, r: 600 },
  { id: 'gnash', name: 'The Gnashlands', x: 1050, z: 1000, r: 500 },
];

export function regionAt(x, z) {
  let best = REGIONS[0], bd = Infinity;
  for (const r of REGIONS) {
    const d = Math.hypot(x - r.x, z - r.z) / r.r;
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}
