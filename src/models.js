// Procedural low-poly character models and their rigs.
import * as THREE from 'three';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: opts.r ?? 0.8, metalness: opts.m ?? 0.0, flatShading: true,
    emissive: opts.e ?? 0x000000, emissiveIntensity: opts.ei ?? 1, side: opts.side ?? THREE.FrontSide,
    transparent: !!opts.t, opacity: opts.o ?? 1, depthWrite: opts.dw ?? true });
  matCache.set(key, m);
  return m;
}
export function glow(color, intensity = 2.5) {
  const key = 'glow' + color + intensity;
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), toneMapped: false });
  matCache.set(key, m);
  return m;
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);
const sph = (r, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h);
const cone = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);

function mesh(geo, material, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  if (parent) parent.add(m);
  return m;
}
function pivot(parent, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g;
}

// Generic humanoid. Units ≈ meters; height ≈ 1.8 * scale.
// o: {skin, cloth, armor, scale, bulk, headType, weapon, cape, eyes, shield}
export function makeHumanoid(o = {}) {
  const root = new THREE.Group();
  const body = pivot(root, 0, 0, 0);       // whole-body bob / lean
  const s = o.scale ?? 1, b = o.bulk ?? 1;
  body.scale.setScalar(s);
  const skin = mat(o.skin ?? 0xb08a70);
  const cloth = mat(o.cloth ?? 0x2a2a3a);
  const armor = o.armor ? mat(o.armor, { m: 0.7, r: 0.35 }) : cloth;
  const legLen = o.legLen ?? 0.85;
  const hips = pivot(body, 0, legLen, 0);
  const torso = pivot(hips, 0, 0, 0);
  // torso
  mesh(box(0.55 * b, 0.62, 0.32 * b), armor, 0, 0.36, 0, torso);
  mesh(box(0.5 * b, 0.18, 0.3 * b), cloth, 0, 0.02, 0, torso);
  if (o.belly) mesh(sph(0.3 * b, 8, 6), skin, 0, 0.25, 0.08, torso).scale.set(1, 0.9, 0.8);
  // head
  const neck = pivot(torso, 0, 0.7, 0);
  const head = pivot(neck, 0, 0.0, 0);
  buildHead(head, o, skin);
  // arms
  const armL = pivot(torso, 0.34 * b, 0.6, 0);
  const armR = pivot(torso, -0.34 * b, 0.6, 0);
  for (const [arm, side] of [[armL, 1], [armR, -1]]) {
    if (o.armor && o.pauldrons !== false) mesh(sph(0.16 * b, 7, 5), armor, 0.02 * side, 0.02, 0, arm).scale.set(1.2, 0.8, 1.1);
    mesh(box(0.15 * b, 0.36, 0.15 * b), o.armor ? armor : (o.bareArms ? skin : cloth), 0, -0.18, 0, arm);
    const fore = pivot(arm, 0, -0.36, 0);
    mesh(box(0.13 * b, 0.34, 0.13 * b), o.bareArms ? skin : (o.armor ? armor : cloth), 0, -0.16, 0, fore);
    mesh(box(0.12 * b, 0.12, 0.12 * b), skin, 0, -0.36, 0, fore);
    arm.userData.fore = fore;
  }
  // legs
  const legL = pivot(hips, 0.14 * b, 0, 0);
  const legR = pivot(hips, -0.14 * b, 0, 0);
  for (const leg of [legL, legR]) {
    mesh(box(0.18 * b, legLen * 0.52, 0.2 * b), o.armor ? armor : cloth, 0, -legLen * 0.26, 0, leg);
    const shin = pivot(leg, 0, -legLen * 0.52, 0);
    mesh(box(0.16 * b, legLen * 0.48, 0.18 * b), o.boots ? mat(o.boots) : (o.armor ? armor : cloth), 0, -legLen * 0.24, 0, shin);
    mesh(box(0.17 * b, 0.08, 0.28 * b), mat(o.boots ?? 0x1a1512), 0, -legLen * 0.46, 0.05, shin);
    leg.userData.shin = shin;
  }
  if (o.robe) {
    const rb = mesh(cyl(0.3 * b, 0.48 * b, legLen * 0.95, 9), cloth, 0, -legLen * 0.48, 0, hips);
    rb.userData.robe = true;
  }
  // cape
  let cape = null;
  if (o.cape) {
    cape = pivot(torso, 0, 0.66, -0.17 * b);
    const cm = mat(o.cape, { side: THREE.DoubleSide });
    const g = new THREE.PlaneGeometry(0.62 * b, 1.25, 1, 4);
    g.translate(0, -0.62, 0);
    mesh(g, cm, 0, 0, 0, cape).rotation.y = Math.PI;
  }
  // weapon in right hand
  const handR = pivot(armR.userData.fore, 0, -0.38, 0.02);
  const handL = pivot(armL.userData.fore, 0, -0.38, 0.02);
  let weapon = null;
  if (o.weapon) weapon = buildWeapon(o.weapon, handR, o);
  if (o.shield) {
    const sh = mesh(box(0.06, 0.55, 0.42), mat(o.shield, { m: 0.4, r: 0.5 }), 0.1, 0.05, 0.05, handL);
    sh.rotation.y = 0.1;
  }
  if (o.offhand) buildWeapon(o.offhand, handL, o);
  root.traverse((c) => { if (c.isMesh) c.castShadow = true; });
  return { root, body, hips, torso, neck, head, armL, armR, legL, legR, cape, handR, handL, weapon,
    legLen: legLen * s, phase: Math.random() * 6, height: (legLen + 1.05) * s };
}

function buildHead(head, o, skin) {
  const t = o.headType ?? 'human';
  if (t === 'helm') {
    const hm = mat(o.armor ?? 0x777788, { m: 0.75, r: 0.3 });
    mesh(cyl(0.17, 0.19, 0.3, 8), hm, 0, 0.18, 0, head);
    mesh(cone(0.18, 0.16, 8), hm, 0, 0.4, 0, head);
    mesh(box(0.25, 0.035, 0.03), glow(o.eyes ?? 0x6fb6ff, 3), 0, 0.2, 0.18, head);
    if (o.plume) { const p = mesh(box(0.04, 0.18, 0.32), mat(o.plume), 0, 0.5, -0.06, head); p.rotation.x = -0.3; }
  } else if (t === 'goblin') {
    mesh(sph(0.2, 8, 6), skin, 0, 0.16, 0.02, head).scale.set(1.15, 0.95, 1.1);
    const earG = cone(0.06, 0.32, 4);
    const e1 = mesh(earG, skin, 0.22, 0.2, -0.02, head); e1.rotation.z = -1.25;
    const e2 = mesh(earG, skin, -0.22, 0.2, -0.02, head); e2.rotation.z = 1.25;
    mesh(cone(0.05, 0.14, 4), skin, 0, 0.13, 0.22, head).rotation.x = 1.4;
    for (const x of [0.07, -0.07]) mesh(sph(0.035, 5, 4), glow(o.eyes ?? 0xffb030, 3), x, 0.2, 0.18, head);
    mesh(box(0.16, 0.03, 0.05), mat(0xd8d0a8), 0, 0.06, 0.18, head);
    if (o.helmet) mesh(sph(0.21, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(o.helmet, { m: 0.6, r: 0.5 }), 0, 0.2, 0.01, head);
  } else if (t === 'orc') {
    mesh(box(0.34, 0.34, 0.34), skin, 0, 0.17, 0.02, head);
    mesh(box(0.36, 0.14, 0.2), skin, 0, 0.06, 0.12, head);
    for (const x of [0.11, -0.11]) {
      mesh(cone(0.03, 0.12, 4), mat(0xe8e0c0), x, 0.16, 0.22, head);
      mesh(sph(0.03, 5, 4), glow(o.eyes ?? 0xff4020, 3), x * 0.8, 0.24, 0.18, head);
    }
    if (o.helmet) {
      const hm = mat(o.helmet, { m: 0.6, r: 0.45 });
      mesh(box(0.38, 0.12, 0.38), hm, 0, 0.34, 0, head);
      if (o.horns) for (const x of [0.2, -0.2]) { const h = mesh(cone(0.05, 0.3, 5), mat(0xd8cfb0), x, 0.42, 0, head); h.rotation.z = -Math.sign(x) * 0.6; }
    }
    if (o.scarred) mesh(box(0.02, 0.22, 0.02), mat(0xff7070), 0.08, 0.2, 0.19, head).rotation.z = 0.5;
    if (o.bandaged) mesh(cyl(0.2, 0.2, 0.08, 8), mat(0xd8d0b8), 0, 0.28, 0, head).rotation.z = 0.25;
    if (o.burnt) mesh(box(0.2, 0.16, 0.02), mat(0x1a0d08), -0.06, 0.18, 0.19, head);
  } else if (t === 'skull') {
    mesh(sph(0.18, 7, 6), mat(0xd8d2c0), 0, 0.18, 0, head);
    mesh(box(0.18, 0.08, 0.16), mat(0xc8c2b0), 0, 0.04, 0.05, head);
    for (const x of [0.065, -0.065]) mesh(sph(0.035, 5, 4), glow(o.eyes ?? 0xb070ff, 4), x, 0.19, 0.15, head);
    if (o.crown) {
      const cm = mat(0x9a8040, { m: 0.9, r: 0.3, e: 0x3a2000 });
      mesh(cyl(0.2, 0.19, 0.08, 10), cm, 0, 0.34, 0, head);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; mesh(cone(0.035, 0.16, 4), cm, Math.cos(a) * 0.19, 0.44, Math.sin(a) * 0.19, head); }
    }
  } else if (t === 'hood') {
    mesh(cone(0.24, 0.5, 8), mat(o.cloth ?? 0x222233), 0, 0.26, -0.02, head);
    mesh(sph(0.16, 7, 5), mat(0x050508), 0, 0.15, 0.04, head);
    for (const x of [0.06, -0.06]) mesh(sph(0.03, 5, 4), glow(o.eyes ?? 0x70e0ff, 4), x, 0.17, 0.16, head);
  } else if (t === 'witch') {
    mesh(sph(0.17, 8, 6), skin, 0, 0.16, 0, head);
    mesh(cyl(0.38, 0.38, 0.03, 12), mat(0x1a1a14), 0, 0.3, 0, head);
    const hat = mesh(cone(0.18, 0.6, 8), mat(0x1a1a14), 0, 0.6, -0.05, head); hat.rotation.x = -0.25;
    for (const x of [0.06, -0.06]) mesh(sph(0.025, 5, 4), glow(0x80ff60, 3), x, 0.18, 0.15, head);
    mesh(box(0.34, 0.4, 0.1), mat(0x5a5a58), 0, 0.02, -0.12, head);
  } else if (t === 'vampire') {
    mesh(sph(0.17, 8, 6), skin, 0, 0.17, 0, head).scale.set(0.95, 1.1, 1);
    mesh(box(0.36, 0.2, 0.06), mat(0x120808), 0, 0.27, -0.12, head);
    for (const x of [0.06, -0.06]) mesh(sph(0.03, 5, 4), glow(0xff2030, 4), x, 0.19, 0.15, head);
    const col = mesh(box(0.5, 0.35, 0.05), mat(0x4a0810), 0, 0.02, -0.14, head); col.rotation.x = -0.25;
  } else if (t === 'mage') {
    mesh(sph(0.17, 8, 6), skin, 0, 0.16, 0, head);
    mesh(cone(0.15, 0.32, 8), mat(0xc8c8d0), 0, -0.02, 0.1, head).rotation.x = Math.PI * 0.92;
    const hood = mesh(sph(0.21, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6), mat(o.cloth ?? 0x302050), 0, 0.17, -0.03, head);
    hood.scale.set(1, 1.1, 1.1);
    for (const x of [0.06, -0.06]) mesh(sph(0.025, 5, 4), glow(0x80a0ff, 3), x, 0.19, 0.15, head);
  } else {
    mesh(sph(0.17, 8, 6), skin, 0, 0.17, 0, head);
    mesh(box(0.3, 0.12, 0.3), mat(o.hair ?? 0x2a1e16), 0, 0.3, -0.02, head);
    if (o.beard) mesh(box(0.22, 0.16, 0.08), mat(o.hair ?? 0x2a1e16), 0, 0.05, 0.14, head);
    for (const x of [0.06, -0.06]) mesh(sph(0.02, 4, 3), mat(0x111111), x, 0.19, 0.155, head);
  }
}

function buildWeapon(type, hand, o) {
  const g = new THREE.Group();
  hand.add(g);
  const steel = mat(0x9aa6b8, { m: 0.85, r: 0.25 });
  const dark = mat(0x2a2220);
  if (type === 'sword' || type === 'runesword') {
    mesh(box(0.05, 0.16, 0.05), dark, 0, 0, 0, g);
    mesh(box(0.28, 0.04, 0.06), mat(0x9a8040, { m: 0.8, r: 0.3 }), 0, 0.09, 0, g);
    mesh(box(0.06, 1.0, 0.02), steel, 0, 0.6, 0, g);
    if (type === 'runesword') mesh(box(0.015, 0.8, 0.025), glow(o.runes ?? 0x6fb6ff, 3), 0, 0.58, 0, g);
    g.rotation.x = Math.PI / 2;
  } else if (type === 'greatsword') {
    mesh(box(0.06, 0.3, 0.06), dark, 0, 0, 0, g);
    mesh(box(0.42, 0.06, 0.08), mat(0x5a4030, { m: 0.6 }), 0, 0.16, 0, g);
    mesh(box(0.12, 1.7, 0.03), mat(0x3a3448, { m: 0.8, r: 0.3 }), 0, 1.0, 0, g);
    mesh(box(0.025, 1.5, 0.035), glow(0xa060ff, 3), 0, 1.0, 0, g);
    g.rotation.x = Math.PI / 2;
  } else if (type === 'cleaver') {
    mesh(box(0.05, 0.4, 0.05), dark, 0, 0.1, 0, g);
    mesh(box(0.04, 0.4, 0.22), mat(0x6a6058, { m: 0.6, r: 0.5 }), 0, 0.45, 0.08, g);
    g.rotation.x = Math.PI / 2;
  } else if (type === 'axe') {
    mesh(box(0.05, 0.9, 0.05), mat(0x4a3020), 0, 0.3, 0, g);
    mesh(box(0.04, 0.3, 0.3), mat(0x6a6870, { m: 0.7, r: 0.4 }), 0, 0.68, 0.12, g);
    g.rotation.x = Math.PI / 2;
  } else if (type === 'spear') {
    mesh(cyl(0.025, 0.025, 1.6, 5), mat(0x4a3020), 0, 0.3, 0, g);
    mesh(cone(0.05, 0.25, 4), mat(0x8a8a8a, { m: 0.7 }), 0, 1.2, 0, g);
    g.rotation.x = Math.PI / 2;
  } else if (type === 'club') {
    mesh(cyl(0.09, 0.04, 0.8, 6), mat(0x4a3424), 0, 0.35, 0, g);
    for (let i = 0; i < 3; i++) mesh(cone(0.03, 0.1, 4), mat(0xaaaaaa), 0.08, 0.5 + i * 0.12, 0, g).rotation.z = -Math.PI / 2;
    g.rotation.x = Math.PI / 2;
  } else if (type === 'staff' || type === 'greenstaff' || type === 'bluestaff') {
    mesh(cyl(0.03, 0.035, 1.8, 6), mat(0x2a1e18), 0, 0.3, 0, g);
    const c = type === 'greenstaff' ? 0x70ff60 : type === 'bluestaff' ? 0x70a0ff : 0xff70ff;
    mesh(sph(0.09, 8, 6), glow(c, 4), 0, 1.25, 0, g);
    g.userData.orbColor = c;
  } else if (type === 'bow') {
    const bow = mesh(new THREE.TorusGeometry(0.45, 0.025, 4, 10, Math.PI), mat(0x3a2818), 0, 0, 0, g);
    bow.rotation.z = Math.PI / 2;
  } else if (type === 'orb') {
    const orb = mesh(sph(0.08, 8, 6), glow(o.runes ?? 0x6fb6ff, 4), 0, -0.05, 0.05, g);
    g.userData.orb = orb;
  }
  return g;
}

// ---- Specific characters -------------------------------------------------
export function makeKnight() {
  const rig = makeHumanoid({
    armor: 0x5b6680, cloth: 0x1a1e30, skin: 0xc09a80, headType: 'helm', eyes: 0x7fc4ff,
    weapon: 'runesword', offhand: 'orb', runes: 0x7fc4ff, cape: 0x1b2560, boots: 0x22242c, plume: 0x1b2560,
  });
  // Tabard
  mesh(box(0.36, 0.5, 0.02), mat(0x1b2560), 0, 0.2, 0.17, rig.torso);
  mesh(box(0.1, 0.14, 0.025), glow(0x9fd0ff, 1.6), 0, 0.33, 0.18, rig.torso);
  return rig;
}

export function makeGoblin(o = {}) {
  const rig = makeHumanoid({
    skin: o.skin ?? 0x4f6a2c, cloth: o.cloth ?? 0x3a2a1c, scale: o.scale ?? 0.72, bulk: 0.95, headType: 'goblin', legLen: 0.7,
    weapon: o.weapon ?? 'cleaver', bareArms: true, helmet: o.helmet, eyes: o.eyes, shield: o.shield,
  });
  rig.neck.position.y = 0.66;
  return rig;
}

export function makeOrc(o = {}) {
  const rig = makeHumanoid({
    skin: o.skin ?? 0x56603a, cloth: 0x2a1e18, armor: o.armor ?? 0x3a3438, scale: o.scale ?? 1.25, bulk: 1.3, headType: 'orc',
    weapon: o.weapon ?? 'axe', helmet: o.helmet ?? 0x3a3438, horns: o.horns, cape: o.cape, belly: true, eyes: o.eyes,
    scarred: o.scarred, bandaged: o.bandaged, burnt: o.burnt, shield: o.shield, pauldrons: true, boots: 0x1a1412,
  });
  return rig;
}

export function makeVillager(o = {}) {
  return makeHumanoid({ skin: o.skin ?? 0xb89478, cloth: o.cloth ?? 0x4a3a2c, hair: o.hair ?? 0x3a2a1c, beard: o.beard,
    robe: o.robe, headType: o.headType ?? 'human', weapon: o.weapon, scale: o.scale ?? 1, legLen: 0.82 });
}

export function makeWraith(o = {}) {
  const root = new THREE.Group();
  const body = pivot(root, 0, 0, 0);
  const cloth = mat(o.cloth ?? 0x9aa8c8, { t: true, o: 0.75, e: 0x203048, side: THREE.DoubleSide });
  const robe = mesh(cone(0.55, 1.9, 9, 1, true), cloth, 0, 1.25, 0, body);
  robe.rotation.x = Math.PI;
  mesh(sph(0.3, 8, 6), cloth, 0, 2.2, 0, body);
  mesh(sph(0.22, 7, 5), mat(0x020206), 0, 2.15, 0.12, body);
  for (const x of [0.08, -0.08]) mesh(sph(0.04, 5, 4), glow(o.eyes ?? 0x8fe8ff, 4), x, 2.18, 0.28, body);
  const armL = pivot(body, 0.35, 1.9, 0), armR = pivot(body, -0.35, 1.9, 0);
  for (const a of [armL, armR]) {
    mesh(cone(0.12, 0.8, 6), cloth, 0, -0.4, 0, a).rotation.x = Math.PI;
    mesh(box(0.06, 0.3, 0.02), mat(0xd0d0d8), 0, -0.85, 0.05, a);
  }
  root.traverse((c) => { if (c.isMesh) c.castShadow = true; });
  return { root, body, armL, armR, head: body, floating: true, phase: Math.random() * 6, height: 2.4 };
}

export function makeWolf(o = {}) {
  const root = new THREE.Group();
  const body = pivot(root, 0, 0.62, 0);
  const fur = mat(o.fur ?? 0x2a2c34);
  mesh(box(0.42, 0.42, 1.1), fur, 0, 0, 0, body);
  mesh(box(0.46, 0.46, 0.4), fur, 0, 0.05, 0.35, body);
  const head = pivot(body, 0, 0.15, 0.6);
  mesh(box(0.3, 0.3, 0.34), fur, 0, 0, 0.1, head);
  mesh(box(0.18, 0.16, 0.26), fur, 0, -0.05, 0.36, head);
  for (const x of [0.09, -0.09]) {
    mesh(cone(0.06, 0.16, 4), fur, x, 0.2, 0.0, head);
    mesh(sph(0.03, 5, 4), glow(0xffd040, 3), x, 0.06, 0.27, head);
  }
  const tail = pivot(body, 0, 0.12, -0.55);
  mesh(box(0.1, 0.1, 0.5), fur, 0, 0, -0.25, tail).rotation.x = 0.5;
  const legs = [];
  for (const [x, z] of [[0.15, 0.4], [-0.15, 0.4], [0.15, -0.4], [-0.15, -0.4]]) {
    const l = pivot(body, x, -0.15, z);
    mesh(box(0.11, 0.5, 0.12), fur, 0, -0.25, 0, l);
    legs.push(l);
  }
  root.traverse((c) => { if (c.isMesh) c.castShadow = true; });
  return { root, body, head, tail, legs, quadruped: true, phase: Math.random() * 6, height: 1.1 };
}

export function makeConstruct(o = {}) {
  const root = new THREE.Group();
  const body = pivot(root, 0, 0, 0);
  const stone = mat(0x404870, { r: 0.6, m: 0.2 });
  const rune = glow(o.rune ?? 0x70a0ff, 3);
  const hips = pivot(body, 0, 1.1, 0);
  const torso = pivot(hips, 0, 0, 0);
  mesh(new THREE.DodecahedronGeometry(0.6, 0), stone, 0, 0.7, 0, torso).scale.set(1.2, 1, 0.9);
  mesh(new THREE.OctahedronGeometry(0.22, 0), rune, 0, 0.75, 0.48, torso);
  const head = pivot(torso, 0, 1.35, 0);
  mesh(box(0.4, 0.35, 0.4), stone, 0, 0.1, 0, head);
  mesh(box(0.3, 0.06, 0.05), rune, 0, 0.12, 0.21, head);
  const armL = pivot(torso, 0.85, 1.0, 0), armR = pivot(torso, -0.85, 1.0, 0);
  for (const a of [armL, armR]) {
    mesh(new THREE.DodecahedronGeometry(0.32, 0), stone, 0, -0.3, 0, a);
    const fore = pivot(a, 0, -0.6, 0); a.userData.fore = fore;
    mesh(box(0.38, 0.7, 0.38), stone, 0, -0.3, 0, fore);
  }
  const legL = pivot(hips, 0.35, 0, 0), legR = pivot(hips, -0.35, 0, 0);
  for (const l of [legL, legR]) { mesh(box(0.38, 1.1, 0.4), stone, 0, -0.55, 0, l); l.userData.shin = pivot(l, 0, -1, 0); }
  root.traverse((c) => { if (c.isMesh) c.castShadow = true; });
  return { root, body, hips, torso, head, neck: head, armL, armR, legL, legR, phase: 0, height: 3, legLen: 1.1 };
}

// ---- Procedural animation -------------------------------------------------
// st: { speed (m/s), attack (0..1 or -1), block, cast, dead (0..1), stagger, t, air, roll }
export function animateRig(rig, st, dt) {
  const t = st.t;
  if (rig.quadruped) {
    rig.phase += dt * (2 + st.speed * 1.6);
    const sw = Math.min(1, st.speed / 4) * 0.7;
    rig.legs.forEach((l, i) => { l.rotation.x = Math.sin(rig.phase + (i === 0 || i === 3 ? 0 : Math.PI)) * sw; });
    rig.body.position.y = 0.62 + Math.abs(Math.sin(rig.phase)) * 0.05 * sw;
    rig.tail.rotation.y = Math.sin(t * 3) * 0.3;
    rig.head.rotation.x = st.attack >= 0 ? -Math.sin(st.attack * Math.PI) * 0.6 : Math.sin(t * 1.3) * 0.05;
    rig.body.position.z = st.attack >= 0 ? Math.sin(st.attack * Math.PI) * 0.5 : 0;
    if (st.dead > 0) { rig.root.rotation.z = Math.min(1, st.dead * 2) * 1.5; rig.body.position.y = 0.62 - Math.min(1, st.dead * 2) * 0.3; }
    return;
  }
  if (rig.floating) {
    rig.body.position.y = 0.3 + Math.sin(t * 2 + rig.phase) * 0.15;
    rig.body.rotation.x = Math.min(0.3, st.speed * 0.05);
    const a = st.attack >= 0 ? Math.sin(st.attack * Math.PI) : 0;
    rig.armL.rotation.x = -0.4 - a * 1.6 + Math.sin(t * 2.3) * 0.1;
    rig.armR.rotation.x = -0.4 - a * 1.6 + Math.cos(t * 2.1) * 0.1;
    if (st.dead > 0) { rig.body.scale.setScalar(Math.max(0.01, 1 - st.dead)); rig.body.position.y += st.dead * 1.5; }
    return;
  }
  const spd = st.speed;
  rig.phase += dt * (spd > 0.1 ? 2.2 + spd * 1.25 : 0);
  const p = rig.phase;
  const amp = Math.min(1, spd / 5.5);
  const run = Math.min(1, Math.max(0, (spd - 5) / 5));
  rig.legL.rotation.x = Math.sin(p) * 0.9 * amp;
  rig.legR.rotation.x = -Math.sin(p) * 0.9 * amp;
  if (rig.legL.userData.shin) {
    rig.legL.userData.shin.rotation.x = Math.max(0, -Math.cos(p)) * 1.1 * amp;
    rig.legR.userData.shin.rotation.x = Math.max(0, Math.cos(p)) * 1.1 * amp;
  }
  const bob = Math.abs(Math.sin(p)) * 0.07 * amp;
  rig.body.position.y = bob;
  const breathe = Math.sin(t * 1.8) * 0.02;
  rig.torso.rotation.x = 0.08 * amp + run * 0.15;
  rig.torso.rotation.y = 0; rig.torso.rotation.z = 0;
  // arms default swing
  let aLx = -Math.sin(p) * 0.6 * amp + breathe, aRx = Math.sin(p) * 0.6 * amp - breathe;
  let aLz = 0.1, aRz = -0.1, fLx = -0.3, fRx = -0.3;
  let aRy = 0, aLy = 0;
  if (rig.weapon) { aRx = -0.35 + Math.sin(p) * 0.3 * amp; fRx = -0.9; }
  if (st.block) { aLx = -1.3; aLz = 0.6; fLx = -1.2; aRx = -1.1; aRz = 0.5; fRx = -1.2; aRy = 0.4; }
  if (st.cast > 0) { const c = Math.sin(Math.min(1, st.cast) * Math.PI); aLx = -0.5 - c * 1.1; fLx = -0.3 - c * 0.3; aLz = 0.2; }
  if (st.channel) { aLx = -1.4; fLx = -0.2; aLz = 0.15; }
  if (st.attack >= 0) {
    const a = st.attack, kind = st.attackKind ?? 0;
    // windup 0..0.35, strike 0.35..0.6, recover
    const wu = Math.min(1, a / 0.35), sk = Math.min(1, Math.max(0, (a - 0.35) / 0.25)), rc = Math.max(0, (a - 0.6) / 0.4);
    if (kind === 1) { // horizontal sweep from left
      aRx = -1.4; aRz = -0.2 + wu * 1.2 - sk * 2.4 + rc * 1.2; fRx = -0.4; aRy = 0;
      rig.torso.rotation.y = wu * 0.6 - sk * 1.2 + rc * 0.6;
    } else if (kind === 2) { // overhead slam
      aRx = -0.3 - wu * 2.6 + sk * 2.8 - rc * 0.5; fRx = -0.3; aRz = -0.1;
      rig.torso.rotation.x = 0.1 - wu * 0.2 + sk * 0.5 - rc * 0.3;
    } else { // diagonal slash right->left
      aRx = -0.4 - wu * 1.9 + sk * 1.8; aRz = -0.2 - wu * 0.6 + sk * 1.4 - rc * 0.8; fRx = -0.6 + wu * 0.4;
      rig.torso.rotation.y = -wu * 0.5 + sk * 0.9 - rc * 0.4;
    }
  }
  rig.armL.rotation.set(aLx, aLy, aLz);
  rig.armR.rotation.set(aRx, aRy, aRz);
  if (rig.armL.userData.fore) rig.armL.userData.fore.rotation.x = fLx;
  if (rig.armR.userData.fore) rig.armR.userData.fore.rotation.x = fRx;
  if (rig.cape) rig.cape.rotation.x = 0.1 + amp * 0.5 + run * 0.3 + Math.sin(t * 2.5) * 0.05;
  rig.head.rotation.y = 0;
  if (st.stagger > 0) { rig.torso.rotation.x = -0.4 * st.stagger; rig.head.rotation.x = -0.3 * st.stagger; }
  else rig.head.rotation.x = 0;
  if (st.kneel) { rig.hips.position.y = (rig.hips.userData.y0 ??= rig.hips.position.y) * 0.55; rig.torso.rotation.x = 0.5; rig.legL.rotation.x = -1.4; rig.legL.userData.shin && (rig.legL.userData.shin.rotation.x = 1.5); rig.legR.rotation.x = 0.3; rig.legR.userData.shin && (rig.legR.userData.shin.rotation.x = 1.8); }
  else if (rig.hips.userData.y0 !== undefined) rig.hips.position.y = rig.hips.userData.y0;
  if (st.air) { rig.legL.rotation.x = -0.6; rig.legR.rotation.x = 0.3; if (rig.legL.userData.shin) { rig.legL.userData.shin.rotation.x = 0.9; rig.legR.userData.shin.rotation.x = 0.5; } }
  if (st.roll > 0) { const r = Math.sin(st.roll * Math.PI); rig.body.rotation.x = r * 1.0; rig.legL.rotation.x = -1.2 * r; rig.legR.rotation.x = -0.6 * r; rig.armL.rotation.x = -1.2 * r; }
  else rig.body.rotation.x = 0;
  if (st.dead > 0) {
    const d = Math.min(1, st.dead * 1.6);
    rig.body.rotation.x = -d * 1.45;
    rig.body.position.y = d * 0.25;
    rig.armL.rotation.x = -d * 2.4; rig.armR.rotation.x = -d * 2.2;
  }
}
