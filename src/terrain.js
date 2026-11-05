import * as THREE from 'three';
import { fbm, ridged, noise2, smoothstep, lerp, clamp, distToPolyline } from './util.js';
import { LOCATIONS, ROADS, RIVER, WORLD_HALF, WATER_LEVEL } from './data.js';

export const GRID = 640;               // cells per side
export const CELL = (WORLD_HALF * 2) / GRID;
const N1 = GRID + 1;
export const heights = new Float32Array(N1 * N1);
const roadDist = new Float32Array(N1 * N1);
const riverDist = new Float32Array(N1 * N1);

const SPIRE = LOCATIONS.spire, KEEP = LOCATIONS.bloodmoon, ABBEY = LOCATIONS.abbey, PIT = LOCATIONS.gnashpit;
const GORGE_C = { x: 1400, z: -420 };
const SWAMP_C = { x: -1300, z: 230 };

export function swampWeight(x, z) {
  return 1 - smoothstep(380, 720, Math.hypot(x - SWAMP_C.x, z - SWAMP_C.z));
}
export function gorgeWeight(x, z) {
  return 1 - smoothstep(450, 760, Math.hypot(x - GORGE_C.x, z - GORGE_C.z));
}
export function abbeyWeight(x, z) {
  return 1 - smoothstep(250, 600, Math.hypot(x - ABBEY.x, z - ABBEY.z));
}
export function pitWeight(x, z) {
  return 1 - smoothstep(200, 450, Math.hypot(x - PIT.x, z - PIT.z));
}
export function northWeight(x, z) {
  return smoothstep(-500, -1000, z) * (1 - gorgeWeight(x, z));
}

function minRoad(x, z) {
  let d = Infinity;
  for (const r of ROADS) d = Math.min(d, distToPolyline(x, z, r));
  return d;
}

function rawHeight(x, z, dRoad, dRiver) {
  let h = 12 + fbm(x * 0.0011, z * 0.0011, 4) * 30 + fbm(x * 0.006, z * 0.006, 3) * 6;
  // Edge mountains
  const e = Math.max(Math.abs(x), Math.abs(z));
  h += smoothstep(1450, 1950, e) * (190 + ridged(x * 0.004, z * 0.004, 4) * 160);
  // Northern highlands rise gently toward the Spire
  h += smoothstep(-600, -1300, z) * 30 * (1 - smoothstep(600, 1200, Math.abs(x)));

  // Spire crag: a tall rock with a flat top
  {
    const d = Math.hypot(x - SPIRE.x, z - SPIRE.z);
    const crag = 1 - smoothstep(110, 360, d);
    const top = 150 + ridged(x * 0.02, z * 0.02, 2) * 6;
    h = lerp(h, top + ridged(x * 0.012, z * 0.012, 3) * 25 * (1 - crag), crag * crag * (3 - 2 * crag));
    if (d < 135) h = lerp(h, 152, 1 - smoothstep(95, 135, d));
  }
  // Crimson Gorge walls (leave corridors for the river and the road)
  {
    const gw = gorgeWeight(x, z);
    if (gw > 0) {
      const wall = smoothstep(50, 200, dRiver) * smoothstep(18, 80, dRoad);
      h += gw * wall * (120 + ridged(x * 0.008, z * 0.008, 4) * 110);
    }
  }
  // Swamp: flat, wet, patchy
  {
    const sw = swampWeight(x, z);
    if (sw > 0) h = lerp(h, -0.7 + fbm(x * 0.012, z * 0.012, 3) * 2.2 + Math.max(0, fbm(x * 0.004, z * 0.004, 2)) * 4, sw);
  }
  // Abbey plateau
  {
    const aw = abbeyWeight(x, z);
    h = lerp(h, 18 + fbm(x * 0.01, z * 0.01, 2) * 3, aw * 0.9);
  }
  // The Gnashpit: crater with a rim and a gap facing north-west
  {
    const d = Math.hypot(x - PIT.x, z - PIT.z);
    const ang = Math.atan2(z - PIT.z, x - PIT.x);
    const gapDir = Math.atan2(-1, -1);
    let da = Math.abs(ang - gapDir); if (da > Math.PI) da = Math.PI * 2 - da;
    const gap = 1 - smoothstep(0.18, 0.42, da);
    const rim = (smoothstep(95, 140, d) - smoothstep(150, 230, d)) * 45 * (1 - gap);
    const pw = pitWeight(x, z);
    h = lerp(h, 6 + rim + ridged(x * 0.02, z * 0.02, 2) * 4 * rim / 45, pw);
  }
  return h;
}

function flattenAt(x, z, h) {
  for (const k in LOCATIONS) {
    const L = LOCATIONS[k];
    if (L.type === 'spire' || L.type === 'pit' || L.type === 'witch') continue;
    if (L.baseH === undefined) continue;
    const d = Math.hypot(x - L.x, z - L.z);
    const w = 1 - smoothstep(L.r * 0.75, L.r * 1.35, d);
    if (w > 0) h = lerp(h, L.baseH, w);
  }
  return h;
}

export function generateHeights(onProgress) {
  // Base height for every flattened location
  for (const k in LOCATIONS) {
    const L = LOCATIONS[k];
    const dr = minRoad(L.x, L.z), dv = distToPolyline(L.x, L.z, RIVER);
    let h = rawHeight(L.x, L.z, dr, dv);
    if (L.type === 'keep') h = Math.max(h, 26);
    if (L.type === 'village' || L.type === 'shrine' || L.type === 'stones') h = Math.max(h, 4);
    if (k === 'brackwater') h = 1.6;
    L.baseH = h;
  }
  for (let j = 0; j <= GRID; j++) {
    const z = -WORLD_HALF + j * CELL;
    for (let i = 0; i <= GRID; i++) {
      const x = -WORLD_HALF + i * CELL;
      const idx = j * N1 + i;
      const dRoad = minRoad(x, z);
      const dRiver = distToPolyline(x, z, RIVER);
      roadDist[idx] = dRoad; riverDist[idx] = dRiver;
      let h = rawHeight(x, z, dRoad, dRiver);
      h = flattenAt(x, z, h);
      // roads: smooth bumps a little
      const rw = 1 - smoothstep(5, 14, dRoad);
      if (rw > 0) h = lerp(h, Math.max(h - 1.2, Math.min(h, 3 + h * 0.97)), rw * 0.5);
      // river carve (not under road crossings => stone bridges/fords)
      const cw = (1 - smoothstep(10, 34, dRiver)) * (1 - (1 - smoothstep(6, 16, dRoad)));
      if (cw > 0) h = lerp(h, -4.5, cw);
      heights[idx] = h;
    }
  }
  if (onProgress) onProgress(1);
}

export function hAt(i, j) {
  i = clamp(i, 0, GRID); j = clamp(j, 0, GRID);
  return heights[j * N1 + i];
}

export function getHeight(x, z) {
  const fx = (x + WORLD_HALF) / CELL, fz = (z + WORLD_HALF) / CELL;
  const i = Math.floor(fx), j = Math.floor(fz);
  const tx = fx - i, tz = fz - j;
  // match triangle split of PlaneGeometry (a: i,j ; b: i,j+1 ; c: i+1,j+1 ; d: i+1,j)
  const h00 = hAt(i, j), h10 = hAt(i + 1, j), h01 = hAt(i, j + 1), h11 = hAt(i + 1, j + 1);
  if (tx + tz < 1) {
    // triangle (00, 01, 10)? plane geometry uses (a,b,d) and (b,c,d)
    return h00 + (h10 - h00) * tx + (h01 - h00) * tz;
  }
  return h11 + (h01 - h11) * (1 - tx) + (h10 - h11) * (1 - tz);
}

export function getNormalSlope(x, z) {
  const e = CELL;
  const hx = getHeight(x + e, z) - getHeight(x - e, z);
  const hz = getHeight(x, z + e) - getHeight(x, z - e);
  return Math.hypot(hx, hz) / (2 * e);
}

export function sampleField(arr, x, z) {
  const i = clamp(Math.round((x + WORLD_HALF) / CELL), 0, GRID);
  const j = clamp(Math.round((z + WORLD_HALF) / CELL), 0, GRID);
  return arr[j * N1 + i];
}
export const roadDistAt = (x, z) => sampleField(roadDist, x, z);
export const riverDistAt = (x, z) => sampleField(riverDist, x, z);

// ---------------------------------------------------------------------------
// Meshes
const C = (hex) => new THREE.Color(hex);
const PAL = {
  grass: C(0x1c3a30), grass2: C(0x274a35), moss: C(0x1d4a36),
  rock: C(0x343d58), rock2: C(0x2a2f48), snow: C(0x8f9fcc),
  mud: C(0x231f1a), swamp: C(0x26301d), swamp2: C(0x1e2a22),
  road: C(0x4a4752), cobble: C(0x3a7472), ashen: C(0x352f4a), ashen2: C(0x2b3e48),
  pit: C(0x3a2822), sand: C(0x2c2c30), gorge: C(0x1a3d2e),
};

function terrainColor(x, z, h, slope, dRoad, out) {
  const n = noise2(x * 0.02, z * 0.02) * 0.5 + 0.5;
  const n2 = noise2(x * 0.11, z * 0.11) * 0.5 + 0.5;
  out.copy(PAL.grass).lerp(PAL.grass2, n * 0.8);
  out.lerp(PAL.moss, n2 * 0.3);
  const sw = swampWeight(x, z), gw = gorgeWeight(x, z), aw = abbeyWeight(x, z), pw = pitWeight(x, z);
  if (sw > 0) { _t.copy(PAL.swamp).lerp(PAL.swamp2, n2); out.lerp(_t, sw); }
  if (gw > 0) out.lerp(PAL.gorge, gw * 0.7);
  if (aw > 0) { _t.copy(PAL.ashen).lerp(PAL.ashen2, n); out.lerp(_t, aw); }
  if (pw > 0) out.lerp(PAL.pit, pw * 0.8);
  if (h < 1.2) out.lerp(sw > 0.3 ? PAL.mud : PAL.sand, smoothstep(1.2, -0.5, h));
  // rock on steep slopes / heights
  const rockW = clamp(smoothstep(0.55, 1.1, slope) + smoothstep(130, 200, h) * 0.6, 0, 1);
  if (rockW > 0) { _t.copy(PAL.rock).lerp(PAL.rock2, n2); out.lerp(_t, rockW); }
  if (h > 240) out.lerp(PAL.snow, smoothstep(240, 300, h) * (1 - smoothstep(1.3, 2.2, slope)));
  const rw = 1 - smoothstep(3.5, 7.5, dRoad);
  if (rw > 0) out.lerp(aw > 0.4 ? PAL.cobble : PAL.road, rw * 0.85);
  return out;
}
const _t = new THREE.Color();

export function buildTerrain(scene) {
  const CHUNKS = 10;
  const per = GRID / CHUNKS;
  const size = per * CELL;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.0, flatShading: false });
  const chunks = [];
  const col = new THREE.Color();
  for (let cj = 0; cj < CHUNKS; cj++) {
    for (let ci = 0; ci < CHUNKS; ci++) {
      const g = new THREE.PlaneGeometry(size, size, per, per);
      g.rotateX(-Math.PI / 2);
      const pos = g.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      const normals = new Float32Array(pos.count * 3);
      const ox = -WORLD_HALF + ci * size + size / 2, oz = -WORLD_HALF + cj * size + size / 2;
      for (let v = 0; v < pos.count; v++) {
        const lx = pos.getX(v), lz = pos.getZ(v);
        const x = lx + ox, z = lz + oz;
        const gi = Math.round((x + WORLD_HALF) / CELL), gj = Math.round((z + WORLD_HALF) / CELL);
        const h = hAt(gi, gj);
        pos.setY(v, h);
        const sx = hAt(gi + 1, gj) - hAt(gi - 1, gj), sz = hAt(gi, gj + 1) - hAt(gi, gj - 1);
        const slope = Math.hypot(sx, sz) / (2 * CELL);
        const nx = -sx / (2 * CELL), nz = -sz / (2 * CELL), nl = Math.hypot(nx, 1, nz);
        normals[v * 3] = nx / nl; normals[v * 3 + 1] = 1 / nl; normals[v * 3 + 2] = nz / nl;
        terrainColor(x, z, h, slope, roadDist[clamp(gj, 0, GRID) * N1 + clamp(gi, 0, GRID)], col);
        colors[v * 3] = col.r; colors[v * 3 + 1] = col.g; colors[v * 3 + 2] = col.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat);
      m.position.set(ox, 0, oz);
      m.receiveShadow = true;
      m.matrixAutoUpdate = false; m.updateMatrix();
      scene.add(m);
      chunks.push({ mesh: m, x: ox, z: oz });
    }
  }
  return chunks;
}

function makeWaterNormal() {
  const S = 256;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(S, S);
  const hgt = (x, y) => noise2(x / 18, y / 18) * 0.6 + noise2(x / 7, y / 7) * 0.3 + noise2(x / 3.2, y / 3.2) * 0.1;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    // tileable: sample on a torus approximation by wrapping
    const dx = hgt((x + 1) % S, y) - hgt((x - 1 + S) % S, y);
    const dy = hgt(x, (y + 1) % S) - hgt(x, (y - 1 + S) % S);
    const i = (y * S + x) * 4;
    img.data[i] = 128 + dx * 160; img.data[i + 1] = 128 + dy * 160; img.data[i + 2] = 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(220, 220);
  return tex;
}

export function buildWater(scene) {
  const seg = 80;
  const g = new THREE.PlaneGeometry(WORLD_HALF * 2, WORLD_HALF * 2, seg, seg);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const deep = C(0x0a2236), swamp = C(0x142a1c), gorge = C(0x0f2c44), c = new THREE.Color();
  for (let v = 0; v < pos.count; v++) {
    const x = pos.getX(v), z = pos.getZ(v);
    c.copy(deep).lerp(swamp, swampWeight(x, z)).lerp(gorge, gorgeWeight(x, z) * 0.6);
    colors[v * 3] = c.r; colors[v * 3 + 1] = c.g; colors[v * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const normalMap = makeWaterNormal();
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.12, metalness: 0.2, transparent: true, opacity: 0.88,
    normalMap, normalScale: new THREE.Vector2(0.5, 0.5),
    emissive: 0x06121c, emissiveIntensity: 1,
  });
  const m = new THREE.Mesh(g, mat);
  m.position.y = WATER_LEVEL;
  m.receiveShadow = true;
  scene.add(m);
  return { mesh: m, update(t) { normalMap.offset.set(t * 0.004, t * 0.0025); } };
}
