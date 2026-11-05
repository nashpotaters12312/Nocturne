// Instanced forests, dead trees, rocks and glowing mushrooms, bucketed per chunk.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getHeight, getNormalSlope, swampWeight, gorgeWeight, abbeyWeight, pitWeight, northWeight, roadDistAt, riverDistAt } from './terrain.js';
import { LOCATIONS, WORLD_HALF, PLAY_HALF } from './data.js';
import { mulberry32, noise2, smoothstep } from './util.js';
import { addCircle } from './physics.js';

function vc(geo, color) {
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  const c = new THREE.Color(color), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}

function pineGeo() {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.25, 0.4, 4, 6); trunk.translate(0, 2, 0); parts.push(vc(trunk, 0x2a1e18));
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const r = 3.2 - i * 0.55, h = 4.2 - i * 0.4;
    const c = new THREE.ConeGeometry(r, h, 7); c.translate(0, 2.6 + i * 2.2 + h / 2, 0);
    parts.push(vc(c, i % 2 ? 0x15302c : 0x112825));
  }
  return mergeGeometries(parts);
}
function deadTreeGeo() {
  const parts = [];
  const t = new THREE.CylinderGeometry(0.18, 0.45, 8, 5); t.translate(0, 4, 0); parts.push(vc(t, 0x2c2824));
  const br = [[0.6, 5, 0.3, 0.9], [-0.5, 6, -0.2, -1.0], [0.2, 7, -0.5, 0.7], [-0.3, 4, 0.4, -0.8]];
  for (const [x, y, z, rz] of br) {
    const b = new THREE.CylinderGeometry(0.06, 0.14, 3, 4); b.translate(0, 1.5, 0); b.rotateZ(rz); b.rotateY(x * 3); b.translate(0, y, 0);
    parts.push(vc(b, 0x2c2824));
  }
  return mergeGeometries(parts);
}
function bushGeo() {
  const g = new THREE.IcosahedronGeometry(1.1, 0); g.scale(1.3, 0.8, 1.3); g.translate(0, 0.5, 0);
  return vc(g, 0x163028);
}
function rockGeo() {
  const g = new THREE.DodecahedronGeometry(1, 0); g.scale(1.4, 0.9, 1.1); g.translate(0, 0.3, 0);
  return vc(g, 0x3a4258);
}
function shroomGeo() {
  const parts = [];
  const s = new THREE.CylinderGeometry(0.06, 0.08, 0.4, 5); s.translate(0, 0.2, 0); parts.push(vc(s, 0x88c0a0));
  const c = new THREE.SphereGeometry(0.2, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2); c.translate(0, 0.38, 0); parts.push(vc(c, 0x60ffb0));
  return mergeGeometries(parts);
}

const MATS = {};
function getMat(kind) {
  if (MATS[kind]) return MATS[kind];
  if (kind === 'shroom') return (MATS[kind] = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: new THREE.Color(2.4, 2.4, 2.4) }));
  return (MATS[kind] = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
}

export function buildVegetation(scene, chunksPerSide = 10) {
  const geos = { pine: pineGeo(), dead: deadTreeGeo(), bush: bushGeo(), rock: rockGeo(), shroom: shroomGeo() };
  const size = (WORLD_HALF * 2) / chunksPerSide;
  const buckets = new Map(); // chunkIndex -> {kind: [matrices]}
  const rng = mulberry32(4242);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const locs = Object.values(LOCATIONS);
  function push(kind, x, y, z, scale, rotY, tilt = 0) {
    const ci = Math.floor((x + WORLD_HALF) / size), cj = Math.floor((z + WORLD_HALF) / size);
    const k = cj * chunksPerSide + ci;
    let b = buckets.get(k); if (!b) buckets.set(k, (b = {}));
    (b[kind] ||= []).push(m.compose(p.set(x, y, z), q.setFromEuler(new THREE.Euler(tilt, rotY, tilt * 0.5)), s.set(scale, scale * (0.85 + rng() * 0.35), scale)).clone());
  }
  const blocked = (x, z, pad) => {
    for (const L of locs) if (Math.hypot(x - L.x, z - L.z) < L.r * 1.15 + pad) return true;
    return false;
  };
  const N = 52000;
  let trees = 0;
  for (let i = 0; i < N; i++) {
    const x = (rng() * 2 - 1) * (WORLD_HALF - 20), z = (rng() * 2 - 1) * (WORLD_HALF - 20);
    const h = getHeight(x, z);
    if (h < 0.4) {
      // swamp shrooms / reeds near water
      if (swampWeight(x, z) > 0.5 && h > -0.6 && rng() < 0.08) push('shroom', x, h, z, 0.8 + rng() * 1.6, rng() * 6);
      continue;
    }
    const slope = getNormalSlope(x, z);
    const dRoad = roadDistAt(x, z);
    if (dRoad < 9) continue;
    if (riverDistAt(x, z) < 28) continue;
    if (blocked(x, z, 6)) continue;
    const sw = swampWeight(x, z), gw = gorgeWeight(x, z), aw = abbeyWeight(x, z), pw = pitWeight(x, z), nw = northWeight(x, z);
    const forestN = noise2(x * 0.004, z * 0.004) * 0.5 + 0.5;
    let pine = 0.12 + forestN * 0.5 + nw * 0.45;
    pine *= (1 - sw) * (1 - aw * 0.9) * (1 - pw * 0.9);
    pine *= 1 - smoothstep(0.9, 1.4, slope);
    if (h > 210) pine *= 0.15;
    const r = rng();
    if (r < pine * 0.55) {
      const sc = 0.8 + rng() * 0.9 + nw * 0.4;
      push('pine', x, h - 0.3, z, sc, rng() * 6);
      if (Math.abs(x) < PLAY_HALF && Math.abs(z) < PLAY_HALF) addCircle(x, z, 0.5 * sc);
      trees++;
      continue;
    }
    const dead = sw * 0.35 + aw * 0.12 + pw * 0.1 + gw * 0.04;
    if (r < pine * 0.55 + dead) {
      const sc = 0.7 + rng() * 0.8;
      push('dead', x, h - 0.3, z, sc, rng() * 6, (rng() - 0.5) * 0.25);
      addCircle(x, z, 0.4 * sc);
      continue;
    }
    if (rng() < 0.05 + slope * 0.06 + gw * 0.05) {
      const sc = 0.6 + rng() * 2.4;
      push('rock', x, h - 0.2 * sc, z, sc, rng() * 6, (rng() - 0.5) * 0.4);
      if (sc > 1.4) addCircle(x, z, sc * 1.1);
      continue;
    }
    if (rng() < 0.08 * (1 - aw)) push('bush', x, h - 0.1, z, 0.6 + rng() * 0.9, rng() * 6);
    else if (sw > 0.3 && rng() < 0.08) push('shroom', x, h, z, 0.8 + rng() * 1.4, rng() * 6);
  }
  const chunks = [];
  for (const [k, b] of buckets) {
    const ci = k % chunksPerSide, cj = Math.floor(k / chunksPerSide);
    const group = new THREE.Group();
    group.userData.cx = -WORLD_HALF + (ci + 0.5) * size; group.userData.cz = -WORLD_HALF + (cj + 0.5) * size;
    for (const kind in b) {
      const arr = b[kind];
      const im = new THREE.InstancedMesh(geos[kind], getMat(kind), arr.length);
      arr.forEach((mx, i) => im.setMatrixAt(i, mx));
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = kind !== 'shroom';
      im.receiveShadow = kind !== 'shroom';
      im.computeBoundingSphere();
      group.add(im);
    }
    scene.add(group);
    chunks.push(group);
  }
  return { chunks, trees };
}
