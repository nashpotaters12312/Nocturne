// Projectiles and delayed area hazards shared by player and enemies.
import * as THREE from 'three';
import { getHeight } from './terrain.js';
import { pointBlocked } from './physics.js';

const projGeo = new THREE.SphereGeometry(0.28, 8, 6);
const arrowGeo = (() => { const g = new THREE.CylinderGeometry(0.03, 0.03, 1, 4); g.rotateX(Math.PI / 2); return g; })();
const COLORS = { fire: 0xff7020, frost: 0x80d0ff, storm: 0xb0c0ff, arcane: 0x8070ff, poison: 0x60ff40, blood: 0xff2040, holy: 0xffe0a0, shadow: 0xb050ff, arrow: 0xaaaaaa };
const mats = {};
function pmat(type) {
  if (!mats[type]) mats[type] = new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS[type] ?? 0xffffff).multiplyScalar(type === 'arrow' ? 0.6 : 3), toneMapped: false });
  return mats[type];
}
export const typeColor = (t) => COLORS[t] ?? 0xffffff;

export class Combat {
  constructor(game) {
    this.game = game;
    this.projectiles = [];
    this.hazards = [];
    this.ringGeo = new THREE.RingGeometry(0.92, 1, 40); this.ringGeo.rotateX(-Math.PI / 2);
    this.discGeo = new THREE.CircleGeometry(1, 40); this.discGeo.rotateX(-Math.PI / 2);
  }
  // owner: 'player' | enemy actor
  shoot(o) {
    const isArrow = o.type === 'arrow' || o.type === 'spear';
    const m = new THREE.Mesh(isArrow ? arrowGeo : projGeo, pmat(isArrow ? 'arrow' : o.type));
    m.scale.setScalar(o.size ?? 1);
    if (o.type === 'spear') m.scale.set(1.5, 1.5, 1.6);
    m.position.copy(o.pos);
    this.game.scene.add(m);
    const p = { ...o, mesh: m, life: o.life ?? 3, pos: o.pos.clone(), vel: o.vel.clone(), hit: new Set() };
    this.projectiles.push(p);
    return p;
  }
  hazard(o) {
    // o: {x,z,r,delay,dmg,type,owner,onFire}
    const col = new THREE.Color(typeColor(o.type)).multiplyScalar(2.2);
    const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    const dmat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.12, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(this.ringGeo, mat), disc = new THREE.Mesh(this.discGeo, dmat);
    const y = Math.max(getHeight(o.x, o.z), 0) + 0.15;
    for (const m of [ring, disc]) { m.position.set(o.x, y, o.z); m.scale.setScalar(o.r); this.game.scene.add(m); }
    this.hazards.push({ ...o, t: 0, ring, disc, y });
  }
  update(dt) {
    const g = this.game, P = g.particles;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      if (p.homing && p.target && !p.target.dead) {
        const tp = p.target.pos ?? p.target;
        _v.set(tp.x - p.pos.x, (tp.y ?? p.pos.y) + 1.2 - p.pos.y, tp.z - p.pos.z).normalize().multiplyScalar(p.vel.length());
        p.vel.lerp(_v, Math.min(1, dt * p.homing));
      }
      if (p.gravity) p.vel.y -= p.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);
      if (p.type === 'arrow' || p.type === 'spear') p.mesh.lookAt(_v.copy(p.pos).add(p.vel));
      // trail
      if (p.type !== 'arrow' && p.type !== 'spear' && Math.random() < 0.9) P.emit(p.pos.x, p.pos.y, p.pos.z, (Math.random() - 0.5), (Math.random() - 0.5) + 0.5, (Math.random() - 0.5), typeColor(p.type), 1.4 * (p.size ?? 1), 0.35);
      let done = p.life <= 0;
      const gh = getHeight(p.pos.x, p.pos.z);
      if (p.pos.y < gh || pointBlocked(p.pos.x, p.pos.z, p.pos.y)) done = true;
      if (!done) {
        if (p.owner === 'player') {
          for (const e of g.enemies) {
            if (e.dead || p.hit.has(e)) continue;
            const dy = p.pos.y - (e.pos.y + e.height * 0.5);
            if (Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < e.radius + 0.4 * (p.size ?? 1) && Math.abs(dy) < e.height * 0.7) {
              p.hit.add(e);
              e.takeDamage(p.dmg, p.type, { from: g.player.pos, knock: p.knock ?? 2, stagger: p.stagger ?? 0.15 });
              if (p.onHit) p.onHit(p, e);
              if (!p.pierce) { done = true; break; }
            }
          }
        } else {
          const pl = g.player;
          if (pl.alive && Math.hypot(pl.pos.x - p.pos.x, pl.pos.z - p.pos.z) < 0.7 + 0.3 * (p.size ?? 1) && Math.abs(p.pos.y - (pl.pos.y + 1)) < 1.3) {
            pl.receiveHit({ dmg: p.dmg, from: p.owner, type: p.type, ranged: true, pos: p.pos });
            done = true;
          }
        }
      }
      if (done) {
        if (p.explode) p.explode(p);
        else P.burst(p.pos.x, p.pos.y, p.pos.z, 10, typeColor(p.type), 4, 1, 0.4);
        g.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.t += dt;
      const k = Math.min(1, h.t / h.delay);
      h.disc.scale.setScalar(h.r * k);
      h.ring.material.opacity = 0.5 + 0.5 * Math.sin(h.t * 20);
      if (h.t >= h.delay) {
        P.burst(h.x, h.y + 0.5, h.z, 40, typeColor(h.type), 9, 2, 0.7, 2);
        P.ring(h.x, h.y + 0.3, h.z, 30, typeColor(h.type), h.r * 2.2, 1.6, 0.5);
        g.audio.play(h.type === 'frost' ? 'frost' : 'boom');
        g.shake(0.4);
        if (h.owner === 'player') {
          for (const e of g.enemies) if (!e.dead && Math.hypot(e.pos.x - h.x, e.pos.z - h.z) < h.r + e.radius) e.takeDamage(h.dmg, h.type, { from: { x: h.x, z: h.z }, knock: 4, stagger: 0.5 });
        } else {
          const pl = g.player;
          if (Math.hypot(pl.pos.x - h.x, pl.pos.z - h.z) < h.r) pl.receiveHit({ dmg: h.dmg, from: h.owner, type: h.type, aoe: true, pos: { x: h.x, z: h.z } });
        }
        if (h.onFire) h.onFire(h);
        g.scene.remove(h.ring); g.scene.remove(h.disc);
        h.ring.material.dispose(); h.disc.material.dispose();
        this.hazards.splice(i, 1);
      }
    }
  }
  clear() {
    for (const p of this.projectiles) this.game.scene.remove(p.mesh);
    for (const h of this.hazards) { this.game.scene.remove(h.ring); this.game.scene.remove(h.disc); }
    this.projectiles = []; this.hazards = [];
  }
}
const _v = new THREE.Vector3();
