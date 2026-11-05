// Castles, villages, ruins and props — built as merged vertex-coloured meshes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LOCATIONS, ROADS, RIVER } from './data.js';
import { getHeight, riverDistAt } from './terrain.js';
import { addBox, addCircle } from './physics.js';
import { mulberry32, randRange, pick, distToPolyline } from './util.js';

export const structMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.88, metalness: 0.05 });
export const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false });
const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff8a30).multiplyScalar(3), toneMapped: false, transparent: true, opacity: 0.9, depthWrite: false });
const flameMat2 = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd070).multiplyScalar(3.5), toneMapped: false, transparent: true, opacity: 0.9, depthWrite: false });
const greenFlame = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x60ff70).multiplyScalar(3), toneMapped: false, transparent: true, opacity: 0.85, depthWrite: false });
const blueFlame = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x60b0ff).multiplyScalar(3), toneMapped: false, transparent: true, opacity: 0.85, depthWrite: false });
const redFlame = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3040).multiplyScalar(3), toneMapped: false, transparent: true, opacity: 0.9, depthWrite: false });

export const lightPoints = [];   // {x,y,z,color,intensity,dist}
export const flames = [];        // meshes to flicker
export const interactables = []; // {id, kind, x, y, z, r, label, loc}
export const npcSpots = [];      // {loc, x, z, role, ...}
export const spawnZones = [];    // {kind, x, z, r, count, loc}
export const shrines = [];       // {id, name, x, y, z}
export const bridges = [];

const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();

function colorize(geo, color, mul = 1) {
  geo = geo.index ? geo : geo;
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  if (geo.attributes.uv1) geo.deleteAttribute('uv1');
  const c = new THREE.Color(color).multiplyScalar(mul);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

// Triangular prism roof (ridge along local x)
function prismGeo(w, h, d) {
  const g = new THREE.CylinderGeometry(1, 1, 1, 3, 1);
  g.rotateZ(Math.PI / 2); // axis along x
  g.rotateX(-Math.PI / 2); // ridge up
  g.computeBoundingBox();
  const bb = g.boundingBox;
  g.translate(0, -bb.min.y, 0);
  g.scale(w, h / (bb.max.y - bb.min.y), d / (bb.max.z - bb.min.z));
  return g;
}

export class Builder {
  constructor(x, y, z, yaw = 0) {
    this.ox = x; this.oy = y; this.oz = z; this.yaw = yaw;
    this.c = Math.cos(yaw); this.s = Math.sin(yaw);
    this.solid = []; this.glow = [];
  }
  wx(x, z) { return this.ox + x * this.c + z * this.s; }
  wz(x, z) { return this.oz - x * this.s + z * this.c; }
  ground(x, z) { return getHeight(this.wx(x, z), this.wz(x, z)) - this.oy; }
  _place(geo, x, y, z, o) {
    tmpE.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
    tmpQ.setFromEuler(tmpE);
    tmpS.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
    tmpP.set(x, y, z);
    tmpM.compose(tmpP, tmpQ, tmpS);
    geo.applyMatrix4(tmpM);
    return geo;
  }
  add(geo, color, x, y, z, o = {}) { this.solid.push(this._place(colorize(geo, color), x, y, z, o)); return this; }
  addGlow(geo, color, mul, x, y, z, o = {}) { this.glow.push(this._place(colorize(geo, color, mul), x, y, z, o)); return this; }
  // y is the bottom of the box
  box(w, h, d, color, x, y, z, o = {}) { return this.add(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z, o); }
  cyl(rt, rb, h, color, x, y, z, seg = 10, o = {}) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), color, x, y + h / 2, z, o); }
  cone(r, h, color, x, y, z, seg = 10, o = {}) { return this.add(new THREE.ConeGeometry(r, h, seg), color, x, y + h / 2, z, o); }
  prism(w, h, d, color, x, y, z, o = {}) { return this.add(prismGeo(w, h, d), color, x, y, z, o); }
  window(w, h, color, x, y, z, ry = 0, mul = 2.2) {
    return this.addGlow(new THREE.BoxGeometry(w, h, 0.25), color, mul, x, y, z, { ry });
  }
  colBox(x, z, hw, hd, rot = 0, top = Infinity) { addBox(this.wx(x, z), this.wz(x, z), hw, hd, this.yaw + rot, top === Infinity ? top : top + this.oy); }
  colCircle(x, z, r, top = Infinity) { addCircle(this.wx(x, z), this.wz(x, z), r, top === Infinity ? top : top + this.oy); }
  light(x, y, z, color = 0xff9a50, intensity = 30, dist = 30) {
    lightPoints.push({ x: this.wx(x, z), y: this.oy + y, z: this.wz(x, z), color, intensity, dist });
  }
  flame(x, y, z, s = 1, kind = 'fire', scene) {
    const m = new THREE.Mesh(flameGeo, kind === 'green' ? greenFlame : kind === 'blue' ? blueFlame : kind === 'red' ? redFlame : flameMat);
    m.position.set(this.wx(x, z), this.oy + y, this.wz(x, z));
    m.scale.setScalar(s);
    m.userData.s = s; m.userData.ph = Math.random() * 10;
    scene.add(m); flames.push(m);
    if (kind === 'fire' && s > 0.8) {
      const m2 = new THREE.Mesh(flameGeo, flameMat2);
      m2.position.copy(m.position); m2.scale.setScalar(s * 0.55); m2.userData.s = s * 0.55; m2.userData.ph = Math.random() * 10;
      scene.add(m2); flames.push(m2);
    }
  }
  interact(id, kind, x, y, z, label, r = 3, extra = {}) {
    interactables.push({ id, kind, x: this.wx(x, z), y: this.oy + y, z: this.wz(x, z), r, label, ...extra });
  }
  finish(scene, name) {
    const grp = new THREE.Group(); grp.name = name || 'struct';
    if (this.solid.length) {
      const g = mergeGeometries(this.solid, false);
      const m = new THREE.Mesh(g, structMat); m.castShadow = true; m.receiveShadow = true; grp.add(m);
    }
    if (this.glow.length) {
      const g = mergeGeometries(this.glow, false);
      grp.add(new THREE.Mesh(g, glowMat));
    }
    grp.position.set(this.ox, this.oy, this.oz);
    grp.rotation.y = this.yaw;
    grp.updateMatrixWorld(true);
    grp.traverse((o) => { o.matrixAutoUpdate = false; o.updateMatrix(); });
    scene.add(grp);
    this.solid = []; this.glow = [];
    return grp;
  }
}
const flameGeo = (() => { const g = new THREE.ConeGeometry(0.35, 1.2, 6); g.translate(0, 0.6, 0); return g; })();

// ---------------------------------------------------------------------------
const STONE = 0x3e4458, STONE2 = 0x30364a, DSTONE = 0x24283a, SLATE = 0x1c2034, WOOD = 0x3a2a20, DWOOD = 0x2a1e18;
const WARM = 0xffa050, PINK = 0xff7a8a, AMBER = 0xffc070;

function roundTower(b, x, z, r, h, spireH, color = STONE, roof = SLATE, win = WARM, seg = 10, base = 0) {
  b.cyl(r, r * 1.08, h, color, x, base, z, seg);
  b.cyl(r * 1.15, r * 1.15, 1.2, STONE2, x, base + h - 0.6, z, seg);
  if (spireH > 0) b.cone(r * 1.2, spireH, roof, x, base + h + 0.6, z, seg);
  if (spireH > 0) b.cyl(0.08, 0.08, 3, 0x6a6a7a, x, base + h + spireH, z, 4);
  const rows = Math.max(1, Math.floor(h / 9));
  for (let i = 0; i < rows; i++) {
    const a = (i * 2.3 + x * 0.1) % (Math.PI * 2);
    if ((i + Math.floor(x)) % 3 === 2) continue;
    b.window(0.7, 1.5, win, x + Math.sin(a) * r, base + h * (0.35 + 0.6 * i / rows), z + Math.cos(a) * r, a, 2.4);
  }
  b.colCircle(x, z, r * 1.08);
}

function shrine(scene, id, name, wx, wz, yaw = 0) {
  const y = getHeight(wx, wz);
  const b = new Builder(wx, y, wz, yaw);
  b.cyl(3.2, 3.6, 0.5, STONE2, 0, -0.3, 0, 8);
  b.box(1.6, 1.0, 1.0, STONE, 0, 0.2, 0);
  b.addGlow(new THREE.OctahedronGeometry(0.4, 0), 0x70b0ff, 3, 0, 1.9, 0, { sy: 1.6 });
  for (const x of [-2.2, 2.2]) { b.box(0.6, 3.6, 0.6, STONE, x, 0.2, -0.5); b.box(0.8, 0.4, 0.8, STONE2, x, 3.8, -0.5); }
  b.box(5.2, 0.5, 0.7, STONE2, 0, 4.2, -0.5);
  b.light(0, 2.5, 0, 0x6fa8ff, 18, 22);
  b.colBox(0, 0, 0.9, 0.6);
  b.interact(id, 'shrine', 0, 1.5, 1.6, `Rest at ${name}`, 3.2, { name });
  shrines.push({ id, name, x: wx, y, z: wz + 3 });
  b.finish(scene, 'shrine');
}

// --------------------------- Villages --------------------------------------
function house(b, rng, x, z, ry, o = {}) {
  const w = randRange(rng, 6, 9), d = randRange(rng, 5, 6.5), h = randRange(rng, 3.4, 4.6);
  const base = o.base ?? b.ground(x, z) - 0.3;
  const plaster = pick(rng, [0x4a4e5c, 0x3e4250, 0x524c4a, 0x3a3e4a]);
  const roof = pick(rng, [SLATE, 0x2e2622, 0x262a3a]);
  const c = Math.cos(ry), s = Math.sin(ry);
  const L = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  if (o.stilts) {
    for (const [px, pz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, d / 2 + 1.6]]) {
      const [qx, qz] = L(px * 0.95, pz * 0.95);
      const g = b.ground(qx, qz);
      b.box(0.35, base - g + 0.4, 0.35, DWOOD, qx, g - 0.5, qz);
    }
    const [dx, dz] = L(0, d / 2 + 1.5);
    b.box(2.2, 0.2, 3, WOOD, dx, base - 0.1, dz, { ry });
  }
  b.box(w, 0.5, d, STONE2, x, base, z, { ry });
  b.box(w, h, d, plaster, x, base + 0.4, z, { ry });
  // timber frame accents
  for (const lx of [-w / 2, w / 2]) for (const lz of [-d / 2, d / 2]) {
    const [qx, qz] = L(lx, lz); b.box(0.3, h, 0.3, DWOOD, qx, base + 0.4, qz, { ry });
  }
  { const [qx, qz] = L(0, d / 2 + 0.05); b.box(w, 0.25, 0.1, DWOOD, qx, base + 0.4 + h * 0.55, qz, { ry }); }
  b.prism(w + 0.8, h * 0.75, d + 1.2, roof, x, base + 0.4 + h, z, { ry });
  // chimney
  { const [qx, qz] = L(w * 0.3, -d * 0.2); b.box(0.8, h * 0.9, 0.8, STONE, qx, base + 0.4 + h * 0.6, qz, { ry }); }
  // door + windows on the front (+z local)
  { const [qx, qz] = L(-w * 0.15, d / 2 + 0.06); b.box(1.2, 2.1, 0.15, DWOOD, qx, base + 0.4, qz, { ry }); }
  const wc = rng() < 0.5 ? WARM : AMBER;
  for (const lx of [w * 0.22]) { const [qx, qz] = L(lx, d / 2 + 0.06); b.window(0.9, 0.9, wc, qx, base + 2.1, qz, ry, rng() < 0.3 ? 0.3 : 2.2); }
  { const [qx, qz] = L(w / 2 + 0.06, 0); b.window(0.9, 0.9, wc, qx, base + 2.1, qz, ry + Math.PI / 2, 2); }
  { const [qx, qz] = L(-w / 2 - 0.06, 0); b.window(0.8, 0.8, wc, qx, base + 2.2, qz, ry + Math.PI / 2, rng() < 0.5 ? 0.3 : 2); }
  b.colBox(x, z, w / 2 + 0.2, d / 2 + 0.2, ry, o.stilts ? base + h : Infinity);
  if (rng() < 0.6) { const [qx, qz] = L(0, d / 2 + 2.4); b.light(qx, base + 2.5, qz, 0xffa060, 14, 16); }
  return { w, d };
}

function lanternPost(b, scene, x, z, color = 0xffb060, kind = 'fire') {
  const g = b.ground(x, z);
  b.box(0.25, 3.4, 0.25, DWOOD, x, g, z);
  b.box(1.0, 0.18, 0.18, DWOOD, x + 0.4, g + 3.2, z);
  b.box(0.45, 0.6, 0.45, DSTONE, x + 0.8, g + 2.5, z);
  b.addGlow(new THREE.BoxGeometry(0.32, 0.4, 0.32), color, 3, x + 0.8, g + 2.8, z);
  b.light(x + 0.8, g + 2.8, z, color, 16, 18);
  b.colCircle(x, z, 0.35);
}

function village(scene, key, L, rng) {
  const b = new Builder(L.x, L.baseH, L.z, 0);
  const n = L.houses ?? 8;
  const placed = [];
  const stilts = !!L.stilts;
  let tries = 0;
  while (placed.length < n && tries++ < 400) {
    const a = rng() * Math.PI * 2, rr = randRange(rng, 27, L.r * 0.75);
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < 13)) continue;
    const wx = L.x + x, wz = L.z + z;
    let dRoad = Infinity; for (const r of ROADS) dRoad = Math.min(dRoad, distToPolyline(wx, wz, r));
    if (dRoad < 9) continue;
    if (riverDistAt(wx, wz) < 30) continue;
    const ry = Math.atan2(-x, -z) + randRange(rng, -0.3, 0.3); // face center
    house(b, rng, x, z, ry, stilts ? { stilts: true, base: Math.max(b.ground(x, z), 0) + 2.6 } : {});
    placed.push({ x, z, ry });
  }
  // central feature
  const g0 = b.ground(0, 0);
  if (key === 'hollowmere' || key === 'greyhallow') {
    b.cyl(1.6, 1.7, 1.1, STONE, 6, g0, 4, 10);
    b.cyl(1.2, 1.2, 0.2, 0x0a1a2a, 6, g0 + 0.95, 4, 10);
    for (const x of [-1.3, 1.3]) b.box(0.2, 2.6, 0.2, DWOOD, 6 + x, g0, 4);
    b.prism(3.4, 1, 2.4, SLATE, 6, g0 + 2.6, 4);
    b.colCircle(6, 4, 1.8);
  }
  // bonfire
  b.cyl(1.4, 1.6, 0.3, DSTONE, -8, g0, -6, 8);
  for (let i = 0; i < 5; i++) b.box(0.3, 0.3, 2, DWOOD, -8, g0 + 0.3, -6, { ry: i * 1.2, rx: 0.3 });
  b.flame(-8, g0 + 0.3, -6, 1.5, 'fire', scene);
  b.light(-8, g0 + 2, -6, 0xff8040, 45, 35);
  b.colCircle(-8, -6, 1.6);
  // lantern posts on the outskirts
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    const x = Math.cos(a) * L.r * 0.4, z = Math.sin(a) * L.r * 0.4;
    if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < 8)) continue;
    lanternPost(b, scene, x, z);
  }
  // fences
  for (let i = 0; i < 14; i++) {
    const a = rng() * Math.PI * 2, rr = randRange(rng, L.r * 0.6, L.r * 0.95);
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < 9)) continue;
    const gg = b.ground(x, z);
    const ry = a + Math.PI / 2;
    for (let k = -2; k <= 2; k++) { const c = Math.cos(ry), s = Math.sin(ry); b.box(0.18, 1.3, 0.18, DWOOD, x + k * 1.2 * c, gg, z - k * 1.2 * s); }
    b.box(5, 0.15, 0.12, WOOD, x, gg + 0.9, z, { ry });
    b.box(5, 0.15, 0.12, WOOD, x, gg + 0.45, z, { ry });
  }
  // notice board (bounties)
  {
    const x = 10, z = -9, gg = b.ground(x, z);
    for (const dx of [-1, 1]) b.box(0.2, 2.6, 0.2, DWOOD, x + dx, gg, z);
    b.box(2.4, 1.5, 0.15, WOOD, x, gg + 1, z);
    b.addGlow(new THREE.BoxGeometry(0.5, 0.6, 0.05), 0xd8c8a0, 0.6, x - 0.5, gg + 1.8, z + 0.1);
    b.addGlow(new THREE.BoxGeometry(0.5, 0.6, 0.05), 0xd8c8a0, 0.6, x + 0.5, gg + 1.6, z + 0.1);
    b.colBox(x, z, 1.3, 0.3);
    b.interact(`board_${key}`, 'board', x, gg + 1.5, z + 1.2, 'Read the Bounty Board', 3, { loc: key });
  }
  // market stall
  {
    const x = -14, z = 8, gg = b.ground(x, z);
    b.box(3.5, 1, 1.6, WOOD, x, gg, z);
    for (const dx of [-1.6, 1.6]) for (const dz of [-0.7, 0.7]) b.box(0.15, 2.6, 0.15, DWOOD, x + dx, gg, z + dz);
    b.box(4, 0.15, 2.4, pick(rng, [0x5a1e28, 0x1e3a5a, 0x3a4a1e]), x, gg + 2.6, z, { rx: 0.15 });
    b.colBox(x, z, 1.8, 0.9);
    npcSpots.push({ loc: key, role: 'merchant', x: L.x + x, z: L.z + z + 1.8, face: 0 });
  }
  npcSpots.push({ loc: key, role: 'elder', x: L.x - 2, z: L.z - 2, face: 0.5 });
  for (let i = 0; i < 4; i++) {
    const a = rng() * 6.28, rr = randRange(rng, 8, L.r * 0.5);
    npcSpots.push({ loc: key, role: 'villager', x: L.x + Math.cos(a) * rr, z: L.z + Math.sin(a) * rr, face: rng() * 6.28 });
  }
  b.finish(scene, key);
  shrine(scene, `shrine_${key}`, L.name, L.x + 14, L.z + 12, -0.6);
}

// --------------------------- Spire of Vael ---------------------------------
function spireCastle(scene, L) {
  const b = new Builder(L.x, L.baseH ?? getHeight(L.x, L.z), L.z, 0);
  const y0 = b.ground(0, -20) - 1;
  // curtain wall ring with gate at +z
  const R = 62;
  for (let i = 0; i < 18; i++) {
    const a0 = (i / 18) * Math.PI * 2, a1 = ((i + 1) / 18) * Math.PI * 2;
    const am = (a0 + a1) / 2;
    if (Math.abs(am - Math.PI / 2) < 0.25) continue; // gate gap facing +z
    const x = Math.cos(am) * R, z = Math.sin(am) * R - 20;
    const len = 2 * R * Math.sin(Math.PI / 18) + 0.6;
    const ry = -am + Math.PI / 2;
    b.box(len, 9, 2.4, STONE2, x, y0, z, { ry });
    for (let k = -1; k <= 1; k += 2) b.box(1.2, 1.4, 2.6, STONE2, x + Math.cos(ry) * k * len * 0.3, y0 + 9, z - Math.sin(ry) * k * len * 0.3, { ry });
    b.colBox(x, z, len / 2, 1.3, ry);
    if (i % 3 === 0) roundTower(b, Math.cos(a0) * R, Math.sin(a0) * R - 20, 3.2, 16, 9, STONE, SLATE, PINK, 10, y0);
  }
  // gate towers
  for (const gx of [-7, 7]) roundTower(b, gx, R - 20 + 1, 3.6, 18, 11, STONE, SLATE, WARM, 10, y0);
  b.box(10, 4, 3, STONE2, 0, y0 + 9, R - 19);
  // main keep cluster
  const towers = [
    [0, -28, 7, 46, 34], [-12, -20, 4.5, 36, 24], [12, -20, 4.5, 38, 24], [-6, -40, 4, 42, 28], [7, -42, 4, 40, 30],
    [-20, -34, 3.2, 30, 20], [20, -32, 3.2, 28, 22], [0, -10, 3.6, 30, 22], [-26, -14, 2.8, 22, 16], [26, -12, 2.8, 24, 16],
    [-14, -50, 2.6, 26, 18], [15, -52, 2.6, 30, 19],
  ];
  for (const [x, z, r, h, sp] of towers) roundTower(b, x, z, r, h, sp, STONE, SLATE, Math.random() < 0.5 ? WARM : PINK, 12, y0);
  // great hall
  b.box(34, 18, 16, STONE, 0, y0, -24);
  b.prism(35, 10, 17, SLATE, 0, y0 + 18, -24);
  for (let i = -3; i <= 3; i++) {
    b.window(1.2, 3.6, i % 2 ? WARM : PINK, i * 4.6, y0 + 9, -24 + 8.1, 0, 2.6);
    b.window(1.2, 2.4, WARM, i * 4.6, y0 + 14, -24 + 8.1, 0, 2.2);
  }
  b.colBox(0, -24, 17, 8);
  // courtyard: obelisks + braziers for the boss
  for (const [x, z] of [[-14, 30], [14, 30], [-14, 6], [14, 6]]) {
    b.box(1.6, 7, 1.6, STONE2, x, y0, z);
    b.cone(1.1, 2, STONE2, x, y0 + 7, z, 4);
    b.addGlow(new THREE.OctahedronGeometry(0.5), 0x70a0ff, 3, x, y0 + 9.5, z);
    b.light(x, y0 + 9.5, z, 0x70a0ff, 25, 26);
    b.colBox(x, z, 0.8, 0.8);
  }
  b.interact('spire_gate', 'boss', 0, y0 + 1, 18, 'Approach the Archmage', 0);
  b.finish(scene, 'spire');
  shrine(scene, 'shrine_spire', L.name, L.x + 24, L.z + 86, 0);
}

// --------------------------- Bloodmoon Keep --------------------------------
function bloodKeep(scene, L) {
  const road = ROADS[5][ROADS[5].length - 1];
  const yaw = Math.atan2(road[0] - L.x, road[1] - L.z);
  const b = new Builder(L.x, L.baseH, L.z, yaw);
  const y0 = -0.5;
  const DARK = 0x262838, DARK2 = 0x1e2030, ROOF = 0x15182a;
  // main hall with steep roof
  b.box(18, 20, 44, DARK, 0, y0, -14);
  b.prism(44, 16, 19, ROOF, 0, y0 + 20, -14, { ry: Math.PI / 2 });
  // buttresses
  for (let i = -2; i <= 2; i++) for (const sx of [-1, 1]) {
    b.box(2, 14, 3, DARK2, sx * 10, y0, -14 + i * 9, { rz: sx * 0.08 });
    b.window(1.3, 5, i % 2 ? 0xff6040 : 0xffa050, sx * 9.05, y0 + 10, -14 + i * 9 + 4.5, Math.PI / 2, i === 0 ? 0.25 : 2.5);
  }
  // facade with rose window
  b.box(20, 26, 3, DARK, 0, y0, 8.5);
  b.addGlow(new THREE.CylinderGeometry(2.6, 2.6, 0.3, 12), 0xff4050, 2.6, 0, y0 + 18, 10.1, { rx: Math.PI / 2 });
  b.box(5, 8, 0.5, 0x0a0608, 0, y0, 10.2);
  b.prism(20, 8, 3.2, ROOF, 0, y0 + 26, 8.5);
  // great tower with spire
  b.box(9, 44, 9, DARK, -12, y0, -28);
  b.cone(7.5, 30, ROOF, -12, y0 + 44, -28, 4, { ry: Math.PI / 4 });
  for (let k = 0; k < 4; k++) b.window(1.1, 3, 0xffa050, -12 + 4.6, y0 + 14 + k * 8, -28, Math.PI / 2, k === 2 ? 0.2 : 2.4);
  for (const [x, z, h] of [[-12, -38, 26], [11, -36, 32], [11, 6, 30], [-11, 6, 30], [12, -14, 36]]) {
    b.cyl(2.6, 2.8, h, DARK, x, y0, z, 8);
    b.cone(3.2, 14, ROOF, x, y0 + h, z, 8);
    b.window(0.7, 1.8, 0xff7040, x + 2.7, y0 + h * 0.7, z, Math.PI / 2, 2.4);
    b.colCircle(x, z, 2.8);
  }
  // little spires along the roof ridge
  for (let i = -3; i <= 3; i++) b.cone(0.8, 6, ROOF, 0, y0 + 35, -14 + i * 6, 6);
  b.colBox(0, -14, 9.5, 23);
  b.colBox(-12, -28, 4.5, 4.5);
  b.colBox(0, 8.5, 10, 1.5);
  // courtyard walls & gate pillars
  for (const sx of [-1, 1]) {
    b.box(2, 7, 30, DARK2, sx * 22, y0, 22);
    b.colBox(sx * 22, 22, 1, 15);
    b.box(3, 12, 3, DARK, sx * 7, y0, 38);
    b.cone(2.2, 5, ROOF, sx * 7, y0 + 12, 38, 4);
    b.flame(sx * 7, y0 + 12.3, 39.6, 0.8, 'red', scene);
    b.colBox(sx * 7, 38, 1.5, 1.5);
    b.box(13, 6, 2, DARK2, sx * 15.5, y0, 38);
    b.colBox(sx * 15.5, 38, 6.5, 1);
  }
  // blood fountain
  b.cyl(4, 4.4, 1, DARK2, 0, y0, 24, 12);
  b.addGlow(new THREE.CylinderGeometry(3.4, 3.4, 0.2, 12), 0xa01020, 1.4, 0, y0 + 1, 24);
  b.cyl(0.6, 0.8, 4, DARK, 0, y0, 24, 8);
  b.colCircle(0, 24, 4.2);
  for (const [x, z] of [[-14, 14], [14, 14], [-14, 32], [14, 32]]) { b.flame(x, y0 + 0.2, z, 0.9, 'red', scene); b.cyl(0.6, 0.4, 1.2, DARK2, x, y0 - 1, z, 6); b.light(x, y0 + 1.5, z, 0xff3040, 30, 22); }
  b.interact('keep_gate', 'boss', 0, 1, 18, '', 0);
  b.finish(scene, 'bloodmoon');
  shrine(scene, 'shrine_bloodmoon', L.name, b.wx(0, 62), b.wz(0, 62), yaw + Math.PI);
}

// --------------------------- Ashen Abbey -----------------------------------
function abbey(scene, L, rng) {
  const b = new Builder(L.x, L.baseH, L.z, Math.PI); // front faces north
  const y0 = b.ground(0, 0) - 0.4;
  const ST = 0x3a5a62, ST2 = 0x2c4650, ST3 = 0x45505e;
  // nave side walls with ruined heights
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const z = -48 + i * 11;
      const h = rng() < 0.3 ? randRange(rng, 3, 8) : randRange(rng, 14, 22);
      b.box(2.2, h, 9, ST2, sx * 16, y0, z);
      b.colBox(sx * 16, z, 1.1, 4.6);
      // buttress pillars
      b.box(3, Math.min(h + 3, 25), 2.4, ST, sx * 17.5, y0, z + 5);
      if (h > 12) b.cone(1.2, 4, ST, sx * 17.5, y0 + Math.min(h + 3, 25), z + 5, 4);
    }
  }
  // front facade with towers (one broken)
  b.box(12, 20, 3, ST2, 0, y0, 50);
  b.box(6, 7, 3.2, 0x080810, 0, y0, 50.1);
  b.colBox(-4.5, 50, 1.6, 1.5); b.colBox(4.5, 50, 1.6, 1.5);
  b.box(10, 34, 10, ST, -12, y0, 52); b.cone(8, 22, 0x1e2a36, -12, y0 + 34, 52, 4, { ry: Math.PI / 4 });
  b.box(10, 18, 10, ST, 12, y0, 52); b.box(4, 6, 6, ST2, 13, y0 + 18, 50);
  b.colBox(-12, 52, 5, 5); b.colBox(12, 52, 5, 5);
  b.addGlow(new THREE.CylinderGeometry(2.2, 2.2, 0.3, 10), 0xb070ff, 2.5, 0, y0 + 14, 48.3, { rx: Math.PI / 2 });
  // apse ruined back wall + altar
  b.box(30, 12, 2.5, ST2, 0, y0, -54);
  b.colBox(0, -54, 15, 1.3);
  b.box(8, 1.5, 4, ST3, 0, y0, -44);
  b.box(4, 2.6, 2.2, 0x1a1a24, 0, y0 + 1.5, -44);
  b.addGlow(new THREE.OctahedronGeometry(1), 0xb070ff, 3, 0, y0 + 5.5, -44, { sy: 1.8 });
  b.light(0, y0 + 5, -44, 0xb070ff, 50, 40);
  // pillars inside nave (some fallen)
  for (let i = 0; i < 7; i++) for (const sx of [-1, 1]) {
    const z = -36 + i * 12;
    if (rng() < 0.25) { b.cyl(0.9, 0.9, 9, ST3, sx * 9 + 3, y0 + 0.9, z, 8, { rz: Math.PI / 2 }); continue; }
    b.cyl(0.9, 1.1, randRange(rng, 6, 16), ST3, sx * 9, y0, z, 8);
    b.colCircle(sx * 9, z, 1.1);
  }
  // red lanterns and graves around (image 3)
  for (let i = 0; i < 42; i++) {
    const a = rng() * Math.PI * 2, r = randRange(rng, 30, 140);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(x) < 24 && z > -60 && z < 62) continue;
    const g = b.ground(x, z);
    if (rng() < 0.75) { b.box(1, 1.6, 0.3, ST3, x, g - 0.2, z, { ry: rng() * 0.6 - 0.3, rz: rng() * 0.2 - 0.1 }); b.colCircle(x, z, 0.6); }
    else { b.box(0.3, 1.6, 0.3, ST3, x, g, z); b.box(1.2, 0.3, 0.3, ST3, x, g + 1.1, z); }
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2, r = 46 + (i % 2) * 20;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const g = b.ground(x, z);
    b.box(1.6, 3.6, 1.6, ST2, x, g, z);
    b.addGlow(new THREE.BoxGeometry(0.9, 1.1, 0.9), 0xff3040, 2.6, x, g + 3.6 + 0.55, z);
    b.box(1.8, 0.3, 1.8, ST, x, g + 4.7, z);
    b.light(x, g + 4.2, z, 0xff3048, 22, 20);
    b.colBox(x, z, 0.8, 0.8);
  }
  // walkway walls (low stone ledges)
  for (let i = 0; i < 6; i++) { const z = 62 + i * 9; for (const sx of [-1, 1]) { b.box(1.2, 1.2, 8, ST, sx * 5, b.ground(sx * 5, z) - 0.2, z); } }
  b.interact('abbey_altar', 'boss', 0, y0 + 1, -30, '', 0);
  b.finish(scene, 'abbey');
  shrine(scene, 'shrine_abbey', L.name, L.x + 40, L.z - 110, 0);
}

// --------------------------- Gnashpit --------------------------------------
function gnashpit(scene, L, rng) {
  const y = getHeight(L.x, L.z);
  L.baseH = y;
  const b = new Builder(L.x, y, L.z, 0);
  // central throne platform
  b.box(14, 3, 14, DWOOD, 0, b.ground(0, 0) - 0.5, 0);
  b.box(4, 5, 1.5, 0x3a2a22, 0, 2.5, -5);
  for (const x of [-2, 2]) b.cone(0.5, 3, 0xd8d0b8, x, 7.5, -5, 5);
  b.colBox(0, 0, 7, 7);
  // huge bonfire
  b.cyl(3, 3.6, 0.8, DSTONE, 14, b.ground(14, 10), 10, 8);
  b.flame(14, b.ground(14, 10) + 0.7, 10, 3.2, 'fire', scene);
  b.light(14, 6, 10, 0xff6020, 80, 60);
  b.colCircle(14, 10, 3.5);
  // tents
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rng() * 0.2, r = randRange(rng, 40, 85);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const g = b.ground(x, z);
    b.cone(randRange(rng, 3, 4.5), randRange(rng, 4, 6), pick(rng, [0x4a3424, 0x3a2a20, 0x5a3a2a]), x, g - 0.2, z, 6);
    b.colCircle(x, z, 3);
  }
  // watchtowers with fires
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3, r = 100;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, g = b.ground(x, z);
    for (const dx of [-1.5, 1.5]) for (const dz of [-1.5, 1.5]) b.box(0.4, 12, 0.4, DWOOD, x + dx, g, z + dz);
    b.box(4.5, 0.5, 4.5, WOOD, x, g + 11, z);
    b.flame(x, g + 11.5, z, 1, 'fire', scene);
    b.light(x, g + 13, z, 0xff7030, 30, 40);
    b.colBox(x, z, 2, 2);
  }
  // spike palisades and skull totems
  for (let i = 0; i < 70; i++) {
    const a = rng() * Math.PI * 2, r = randRange(rng, 20, 95);
    const x = Math.cos(a) * r, z = Math.sin(a) * r, g = b.ground(x, z);
    if (rng() < 0.5) { b.cone(0.25, 3, DWOOD, x, g, z, 4, { rx: rng() * 0.4 - 0.2 }); }
    else { b.box(0.3, 3.5, 0.3, DWOOD, x, g, z); b.add(new THREE.SphereGeometry(0.35, 6, 5), 0xd8d0b8, x, g + 3.8, z); }
  }
  b.finish(scene, 'gnashpit');
}

// --------------------------- Morwen's hut ----------------------------------
function witchHut(scene, L, rng) {
  const y = Math.max(getHeight(L.x, L.z), 0);
  L.baseH = y;
  const b = new Builder(L.x, y, L.z, 0.4);
  const fl = 3.2;
  for (const [x, z] of [[-4, -4], [4, -4], [-4, 4], [4, 4], [0, 0]]) b.box(0.5, fl + 2 - b.ground(x, z), 0.5, DWOOD, x, b.ground(x, z) - 1, z, { rz: rng() * 0.1 - 0.05 });
  b.box(10, 0.4, 10, WOOD, 0, fl, 0);
  b.box(7, 5, 6, 0x2a2a22, 0, fl + 0.4, 0, { rz: 0.04 });
  b.prism(8.4, 5, 7.6, 0x1a1e14, 0, fl + 5.3, 0, { rz: -0.08, ry: 0.05 });
  b.box(0.9, 4, 0.9, 0x2a2420, 2.5, fl + 7, -1, { rz: 0.2 });
  b.window(1, 1, 0x70ff60, 3.55, fl + 2.6, 0, Math.PI / 2, 2.8);
  b.window(1, 1, 0x70ff60, -1.5, fl + 2.6, 3.05, 0, 2.8);
  b.box(1.3, 2.4, 0.2, DWOOD, 1.5, fl + 0.4, 3.05);
  // stairs down
  for (let i = 0; i < 6; i++) b.box(2, 0.25, 1, WOOD, 1.5, fl - i * 0.6, 6 + i);
  b.colBox(0, 0, 4.8, 4.8, 0, fl + 6);
  // cauldron in front
  const cg = Math.max(b.ground(0, 14), 0);
  b.cyl(1.3, 0.9, 1.4, 0x141414, 0, cg, 14, 10);
  b.addGlow(new THREE.CylinderGeometry(1.15, 1.15, 0.1, 10), 0x50ff40, 2, 0, cg + 1.3, 14);
  b.flame(0, cg - 0.2, 14, 0.6, 'green', scene);
  b.light(0, cg + 2, 14, 0x50ff50, 35, 30);
  b.colCircle(0, 14, 1.4);
  // hanging lanterns on dead trees
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, r = 16;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, g = b.ground(x, z);
    b.cyl(0.25, 0.45, 7, 0x2a2622, x, g - 0.5, z, 5);
    b.box(2.2, 0.2, 0.2, 0x2a2622, x + 1, g + 5.5, z, { rz: 0.3 });
    b.addGlow(new THREE.SphereGeometry(0.3, 6, 5), 0x80ff60, 3, x + 1.9, g + 5.0, z);
    b.colCircle(x, z, 0.5);
  }
  b.interact('witch_hut', 'boss', 0, cg + 1, 16, '', 0);
  b.finish(scene, 'witch');
  shrine(scene, 'shrine_mirefen', L.name, L.x + 28, L.z + 22, 0);
}

// --------------------------- Smaller sites ---------------------------------
function camp(scene, key, L, rng) {
  const y = L.baseH;
  const b = new Builder(L.x, y, L.z, rng() * 6);
  b.cyl(1.2, 1.4, 0.3, DSTONE, 0, b.ground(0, 0), 0, 7);
  b.flame(0, b.ground(0, 0) + 0.25, 0, 1.2, 'fire', scene);
  b.light(0, b.ground(0, 0) + 2.5, 0, 0xff7030, 40, 35);
  b.colCircle(0, 0, 1.4);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rng() * 0.5, r = randRange(rng, 9, 16);
    const x = Math.cos(a) * r, z = Math.sin(a) * r, g = b.ground(x, z);
    b.cone(randRange(rng, 2.2, 3), randRange(rng, 3, 4), pick(rng, [0x4a3424, 0x3a2a20, 0x5a3a2a]), x, g - 0.2, z, 6);
    b.colCircle(x, z, 2.2);
  }
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    if (Math.abs(Math.sin(a * 0.5)) < 0.15) continue;
    const x = Math.cos(a) * 24, z = Math.sin(a) * 24, g = b.ground(x, z);
    b.cone(0.3, 3.5, DWOOD, x, g - 0.3, z, 4, { rx: Math.cos(a) * 0.3, rz: -Math.sin(a) * 0.3 });
  }
  for (let i = 0; i < 3; i++) {
    const a = rng() * 6.28, x = Math.cos(a) * 6, z = Math.sin(a) * 6, g = b.ground(x, z);
    b.box(0.3, 3.2, 0.3, DWOOD, x, g, z);
    b.add(new THREE.SphereGeometry(0.32, 6, 5), 0xd8d0b8, x, g + 3.5, z);
    b.addGlow(new THREE.SphereGeometry(0.06, 4, 3), 0xff5020, 3, x + 0.1, g + 3.55, z + 0.27);
  }
  b.finish(scene, key);
}

function hermitTower(scene, L) {
  const b = new Builder(L.x, L.baseH, L.z, 0.3);
  const y0 = b.ground(0, 0) - 0.5;
  const R = 7, N = 14;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    if (i === 3) continue; // doorway
    const h = 10 + Math.sin(i * 1.7) * 6 + (i % 4 === 0 ? -6 : 4);
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    b.box(3.4, h, 1.6, STONE, x, y0, z, { ry: -a + Math.PI / 2 });
    b.colBox(x, z, 1.7, 0.8, -a + Math.PI / 2);
    if (h > 12 && i % 3 === 0) b.window(0.6, 1.3, 0x70a0ff, x * 1.12, y0 + h - 4, z * 1.12, -a + Math.PI / 2, 2.2);
  }
  b.box(1.2, 1.1, 0.9, STONE2, 0, y0, 0);
  b.addGlow(new THREE.BoxGeometry(0.7, 0.15, 0.5), 0x8fc0ff, 2.5, 0, y0 + 1.2, 0);
  b.light(0, y0 + 2, 0, 0x8fb0ff, 18, 16);
  b.interact('hermit_tome', 'item', 0, y0 + 1.2, 0, 'Take the Hermit\'s Tome', 2.6, { item: 'tome' });
  // rubble
  for (let i = 0; i < 20; i++) { const a = Math.random() * 6.28, r = 8 + Math.random() * 6; b.add(new THREE.DodecahedronGeometry(0.5 + Math.random() * 0.8, 0), STONE2, Math.cos(a) * r, b.ground(Math.cos(a) * r, Math.sin(a) * r), Math.sin(a) * r); }
  b.finish(scene, 'tower');
}

function graveyard(scene, L, rng) {
  const b = new Builder(L.x, L.baseH, L.z, 0);
  for (let i = 0; i < 40; i++) {
    const x = randRange(rng, -40, 40), z = randRange(rng, -40, 40);
    if (Math.hypot(x, z) < 8) continue;
    const g = b.ground(x, z);
    if (rng() < 0.7) b.box(0.9, randRange(rng, 1, 1.8), 0.3, 0x45505e, x, g - 0.3, z, { ry: rng() * 0.4 - 0.2, rz: rng() * 0.3 - 0.15 });
    else { b.box(0.25, 1.8, 0.25, 0x45505e, x, g, z); b.box(1, 0.25, 0.25, 0x45505e, x, g + 1.2, z); }
  }
  // mausoleum
  const g = b.ground(0, 0);
  b.box(8, 5, 10, 0x3a4250, 0, g - 0.3, 0);
  b.prism(9, 3, 11, 0x1e2230, 0, g + 4.7, 0, { ry: Math.PI / 2 });
  b.box(2.4, 3.2, 0.3, 0x08080c, 0, g, 5.05);
  b.addGlow(new THREE.BoxGeometry(0.6, 0.6, 0.1), 0x8fe8ff, 3, 0, g + 3.8, 5.1);
  b.light(0, g + 3, 7, 0x8fe8ff, 20, 22);
  b.colBox(0, 0, 4, 5);
  b.interact('mausoleum', 'item', 0, g + 1, 6.5, 'Search the Mausoleum', 2.6, { item: 'relic' });
  b.finish(scene, 'graves');
}

function standingStones(scene, L) {
  const b = new Builder(L.x, L.baseH, L.z, 0);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2, x = Math.cos(a) * 14, z = Math.sin(a) * 14, g = b.ground(x, z);
    b.box(1.8, 6 + (i % 3) * 1.5, 1.1, 0x3a4058, x, g - 0.5, z, { ry: -a, rz: (i % 2 ? 0.06 : -0.05) });
    b.addGlow(new THREE.BoxGeometry(0.25, 1.6, 0.05), 0x60d0ff, 2.2, x * 0.955, g + 3, z * 0.955, { ry: -a + Math.PI / 2 });
    b.colCircle(x, z, 1.1);
  }
  b.box(4, 1, 2.4, 0x2c3248, 0, b.ground(0, 0) - 0.3, 0);
  b.light(0, 3, 0, 0x60d0ff, 25, 30);
  b.finish(scene, 'stones');
  shrine(scene, 'shrine_standing', L.name, L.x + 22, L.z + 6, 0);
}

function wakeShrine(scene, L) {
  shrine(scene, 'shrine_wakeshrine', L.name, L.x, L.z, Math.PI * 0.9);
  const b = new Builder(L.x, L.baseH, L.z, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3, x = Math.cos(a) * 9, z = Math.sin(a) * 9, g = b.ground(x, z);
    b.cyl(0.6, 0.7, i % 2 ? 3 : 6, 0x404860, x, g - 0.3, z, 7);
    b.colCircle(x, z, 0.7);
  }
  b.finish(scene, 'wake');
}

function buildBridges(scene) {
  for (const road of ROADS) {
    for (let i = 0; i < road.length - 1; i++) {
      const [ax, az] = road[i], [bx, bz] = road[i + 1];
      const L = Math.hypot(bx - ax, bz - az);
      let best = null;
      for (let t = 0; t <= L; t += 2) {
        const x = ax + (bx - ax) * t / L, z = az + (bz - az) * t / L;
        const d = distToPolyline(x, z, RIVER);
        if (d < 6 && (!best || d < best.d)) best = { x, z, d };
      }
      if (best && !bridges.some((q) => Math.hypot(q.x - best.x, q.z - best.z) < 30)) {
        const yaw = Math.atan2(bx - ax, bz - az);
        const y = getHeight(best.x, best.z);
        const b = new Builder(best.x, y, best.z, yaw);
        b.box(7, 1.2, 34, 0x3c4254, 0, -1.0, 0);
        for (const sx of [-1, 1]) {
          b.box(0.8, 1.2, 34, 0x30364a, sx * 3.4, -0.4, 0);
          for (let k = -2; k <= 2; k++) b.box(1.1, 1.6, 1.1, 0x30364a, sx * 3.4, -0.4, k * 8);
          b.addGlow(new THREE.BoxGeometry(0.4, 0.5, 0.4), 0xffa050, 2.6, sx * 3.4, 1.4, 0);
        }
        b.light(0, 2.5, 0, 0xffa050, 16, 20);
        for (const sx of [-1, 1]) for (const z of [-12, 0, 12]) b.box(2.4, 8, 2.4, 0x2a3040, sx * 1.5, -8.5, z);
        b.finish(scene, 'bridge');
        bridges.push(best);
      }
    }
  }
}

export function buildStructures(scene) {
  const rng = mulberry32(777);
  for (const key of ['hollowmere', 'greyhallow', 'brackwater', 'emberfall']) village(scene, key, LOCATIONS[key], rng);
  spireCastle(scene, LOCATIONS.spire);
  bloodKeep(scene, LOCATIONS.bloodmoon);
  abbey(scene, LOCATIONS.abbey, rng);
  gnashpit(scene, LOCATIONS.gnashpit, rng);
  witchHut(scene, LOCATIONS.mirefen, rng);
  for (const k of ['camp_n', 'camp_w', 'camp_e', 'camp_s', 'camp_c']) camp(scene, k, LOCATIONS[k], rng);
  hermitTower(scene, LOCATIONS.tower);
  graveyard(scene, LOCATIONS.graveyard, rng);
  standingStones(scene, LOCATIONS.standing);
  wakeShrine(scene, LOCATIONS.wakeshrine);
  buildBridges(scene);
}
