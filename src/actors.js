// Enemies, bosses and villagers.
import * as THREE from 'three';
import { makeGoblin, makeOrc, makeWraith, makeWolf, makeHumanoid, makeConstruct, makeVillager, animateRig, glow } from './models.js';
import { getHeight } from './terrain.js';
import { resolve } from './physics.js';
import { WATER_LEVEL } from './data.js';
import { angleDiff, clamp } from './util.js';
import { captainStats, TRAITS } from './nemesis.js';
import { typeColor } from './combat.js';

export const DEFS = {
  goblin: { name: 'Goblin', hp: 42, dmg: 8, speed: 6.4, range: 1.9, cd: 1.5, windup: 0.42, aggro: 26, xp: 12, radius: 0.45, faction: 'warband' },
  goblin_archer: { name: 'Goblin Archer', hp: 30, dmg: 7, speed: 6, range: 2, cd: 2.4, windup: 0.6, aggro: 34, xp: 14, radius: 0.45, ranged: { type: 'arrow', speed: 34, keep: 15 }, faction: 'warband' },
  orc: { name: 'Gnashpit Orc', hp: 95, dmg: 15, speed: 5, range: 2.4, cd: 2, windup: 0.6, aggro: 26, xp: 26, radius: 0.7, faction: 'warband' },
  wolf: { name: 'Shadow Wolf', hp: 34, dmg: 7, speed: 9.5, range: 1.8, cd: 1.3, windup: 0.32, aggro: 30, xp: 10, radius: 0.55, faction: 'beast' },
  wight: { name: 'Bog Wight', hp: 64, dmg: 12, speed: 3.6, range: 2, cd: 1.9, windup: 0.6, aggro: 22, xp: 18, radius: 0.5, faction: 'undead', resist: { frost: 0.5, fire: 1.6 } },
  wraith: { name: 'Abbey Wraith', hp: 55, dmg: 12, speed: 5.2, range: 2.4, cd: 2, windup: 0.55, aggro: 30, xp: 22, radius: 0.55, faction: 'undead', resist: { blade: 0.6, holy: 2, storm: 1.4 }, ranged: { type: 'frost', speed: 18, keep: 0, chance: 0.35 } },
  thrall: { name: 'Blood Thrall', hp: 70, dmg: 13, speed: 6.2, range: 2, cd: 1.6, windup: 0.45, aggro: 26, xp: 22, radius: 0.5, faction: 'undead', resist: { fire: 1.4 }, lifesteal: 0.5 },
  construct: { name: 'Arcane Construct', hp: 130, dmg: 18, speed: 3.6, range: 3, cd: 2.4, windup: 0.8, aggro: 30, xp: 35, radius: 1.0, faction: 'arcane', resist: { storm: 0.5, blade: 0.8, frost: 1.4 } },
  // bosses
  morwen: { name: 'Morwen, the Bog Witch', hp: 720, dmg: 16, speed: 5, range: 2.4, cd: 2, windup: 0.5, aggro: 60, xp: 400, radius: 0.6, boss: true, faction: 'boss', resist: { fire: 1.3, frost: 0.7 } },
  malrec: { name: 'Count Malrec of Bloodmoon', hp: 880, dmg: 19, speed: 7, range: 2.6, cd: 1.3, windup: 0.4, aggro: 60, xp: 450, radius: 0.6, boss: true, faction: 'boss', resist: { fire: 1.4, holy: 1.5, blade: 0.9 }, lifesteal: 0.6 },
  ilvane: { name: 'Archmage Ilvane', hp: 760, dmg: 18, speed: 4.6, range: 2.4, cd: 2.2, windup: 0.5, aggro: 70, xp: 450, radius: 0.6, boss: true, faction: 'boss', resist: { storm: 0.5, frost: 0.8, blade: 1.2 } },
  king: { name: 'The Moonless King', hp: 1700, dmg: 26, speed: 4.6, range: 4.2, cd: 2.2, windup: 0.75, aggro: 90, xp: 1000, radius: 1.2, boss: true, faction: 'boss', resist: { shadow: 0.2, holy: 1.6, blade: 0.9 } },
  captain: { name: 'Captain', hp: 200, dmg: 15, speed: 5.6, range: 2.6, cd: 1.9, windup: 0.55, aggro: 34, xp: 100, radius: 0.75, faction: 'warband' },
};

function buildModel(kind, o = {}) {
  switch (kind) {
    case 'goblin': return makeGoblin({ weapon: Math.random() < 0.5 ? 'cleaver' : 'club', helmet: Math.random() < 0.4 ? 0x4a4440 : undefined, shield: Math.random() < 0.2 ? 0x4a3020 : undefined, eyes: o.informant ? 0xffff40 : undefined });
    case 'goblin_archer': return makeGoblin({ weapon: 'bow', skin: 0x5a6a38, cloth: 0x2a2a1c });
    case 'orc': return makeOrc({ weapon: Math.random() < 0.5 ? 'axe' : 'cleaver', scale: 1.15 });
    case 'wolf': return makeWolf();
    case 'wight': return makeHumanoid({ skin: 0x5a6a50, cloth: 0x2a3020, headType: 'skull', eyes: 0x70ff50, weapon: 'club', bareArms: true, scale: 1.05 });
    case 'wraith': return makeWraith();
    case 'thrall': return makeHumanoid({ skin: 0xc8b8b8, cloth: 0x3a0a14, headType: 'vampire', weapon: 'sword', scale: 1.0 });
    case 'construct': return makeConstruct();
    case 'morwen': return makeHumanoid({ skin: 0x8a9a80, cloth: 0x1e2a1a, headType: 'witch', robe: true, weapon: 'greenstaff', scale: 1.15 });
    case 'malrec': return makeHumanoid({ skin: 0xd8c8c8, cloth: 0x1a0a10, armor: 0x2a1018, headType: 'vampire', weapon: 'runesword', runes: 0xff2040, cape: 0x6a0a18, scale: 1.2 });
    case 'ilvane': return makeHumanoid({ skin: 0xc8b8a8, cloth: 0x2a1e50, headType: 'mage', robe: true, weapon: 'bluestaff', cape: 0x1a1240, scale: 1.15 });
    case 'king': { const r = makeHumanoid({ skin: 0xd0c8b8, cloth: 0x1a1028, armor: 0x2a2438, headType: 'skull', crown: true, eyes: 0xc070ff, weapon: 'greatsword', cape: 0x2a0a40, scale: 2.3, bulk: 1.15 }); return r; }
    case 'captain': {
      const c = o.captain;
      if (c.race === 'goblin') {
        const r = makeGoblin({ scale: c.look.scale, weapon: c.look.weapon === 'greatsword' ? 'cleaver' : c.look.weapon, helmet: c.look.helmet, skin: c.look.skin, eyes: 0xff4020 });
        return r;
      }
      return makeOrc({ skin: c.look.skin, armor: c.look.armor, helmet: c.look.helmet, horns: c.look.horns || c.rank > 0, weapon: c.look.weapon, cape: c.look.cape ?? (c.rank > 0 ? 0x4a0a0a : undefined),
        scale: c.look.scale, scarred: c.scars.scarred, bandaged: c.scars.bandaged, burnt: c.scars.burnt, eyes: c.rank === 2 ? 0xffd020 : 0xff4020 });
    }
  }
  return makeGoblin();
}

let ACTOR_ID = 1;
export class Enemy {
  constructor(game, kind, x, z, o = {}) {
    this.game = game; this.kind = kind; this.id = ACTOR_ID++;
    const d = DEFS[kind];
    this.def = d;
    this.name = d.name;
    this.captain = o.captain || null;
    this.informant = !!o.informant;
    let hp = d.hp, dmg = d.dmg, speed = d.speed, xp = d.xp;
    const lvl = o.level ?? 1;
    if (!d.boss && kind !== 'captain') { hp *= 1 + (lvl - 1) * 0.12; dmg *= 1 + (lvl - 1) * 0.08; xp *= 1 + (lvl - 1) * 0.1; }
    if (this.captain) {
      const s = captainStats(this.captain);
      hp = s.hp; dmg = s.dmg; speed = s.speed; xp = s.xp;
      this.name = `${this.captain.name} ${this.captain.title}`;
    }
    this.level = this.captain ? this.captain.level : lvl;
    this.maxHp = hp; this.hp = hp; this.dmg = dmg; this.speed = speed; this.xp = Math.round(xp);
    this.radius = d.radius * (this.captain ? this.captain.look.scale / 1.25 : 1);
    this.rig = buildModel(kind, o);
    this.root = this.rig.root;
    this.height = this.rig.height ?? 1.8;
    this.pos = new THREE.Vector3(x, getHeight(x, z), z);
    this.home = { x, z };
    this.yaw = Math.random() * Math.PI * 2;
    this.state = 'idle'; this.stateT = 0; this.cd = 1 + Math.random();
    this.attackT = -1; this.attackKind = 0; this.struck = false;
    this.stagger = 0; this.dead = false; this.deadT = 0;
    this.aggro = false; this.alertT = 0;
    this.burn = 0; this.slow = 0; this.fear = 0; this.enrage = 0;
    this.wanderT = 0; this.wanderTarget = { x, z };
    this.boss = !!d.boss;
    this.timers = { a: 4, b: 8, c: 12, d: 6 };
    this.phase = 1;
    this.lastDamageType = 'blade';
    this.broken = false; this.brokenT = 0; this.usedBreak = false;
    this.strafe = Math.random() < 0.5 ? 1 : -1;
    this.animSt = { speed: 0, attack: -1, block: false, cast: 0, dead: 0, stagger: 0, t: 0 };
    this.onDeath = o.onDeath;
    this.noLeash = !!o.noLeash || this.boss;
    this.leash = o.leash ?? 90;
    if (this.informant) {
      const tag = new THREE.Mesh(new THREE.OctahedronGeometry(0.15), glow(0xffe040, 3));
      tag.position.y = (this.rig.height ?? 1.3) + 0.5; this.root.add(tag); this.tag = tag;
    }
    if (this.captain) {
      const c = this.captain;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 6, 16), glow(c.rank === 2 ? 0xffd040 : c.rank === 1 ? 0xff6030 : 0xff3030, 3));
      ring.rotation.x = Math.PI / 2; ring.position.y = this.height + 0.6; this.root.add(ring); this.tag = ring;
    }
    this.root.position.copy(this.pos);
    game.scene.add(this.root);
  }

  get traits() { return this.captain ? this.captain.traits : []; }
  has(t) { return this.captain ? this.captain.traits.includes(t) : false; }

  dist() { const p = this.game.player.pos; return Math.hypot(p.x - this.pos.x, p.z - this.pos.z); }

  takeDamage(amount, type = 'blade', o = {}) {
    if (this.dead) return 0;
    const g = this.game;
    let mul = this.def.resist?.[type] ?? 1;
    if (this.captain) {
      const T = this.captain.traits;
      if (type === 'fire' && T.includes('fireproof')) mul = 0;
      if (type === 'frost' && T.includes('frostborn')) mul = 0;
      if (type === 'storm' && T.includes('stormward')) mul = 0;
      if (type === 'blade' && T.includes('ironhide')) mul *= 0.5;
      if (type === 'blade' && T.includes('weak_blade')) mul *= 1.6;
      if (type === 'frost' && T.includes('weak_frost')) mul *= 2;
      if (type === 'storm' && T.includes('weak_storm')) mul *= 2;
      if (type === 'fire' && T.includes('fears_fire')) { this.fear = 3.5; g.ui.revealTrait(this.captain, 'fears_fire'); }
      if (type !== 'blade' && T.includes('magic_rage')) { this.enrage = 6; g.ui.revealTrait(this.captain, 'magic_rage'); }
      if (mul === 0) {
        g.ui.floatText(this.pos, 'IMMUNE', '#9ab');
        g.ui.revealTrait(this.captain, type === 'fire' ? 'fireproof' : type === 'frost' ? 'frostborn' : 'stormward');
        return 0;
      }
      if (type === 'blade' && T.includes('ironhide')) g.ui.revealTrait(this.captain, 'ironhide');
      if (mul > 1.4) g.ui.revealTrait(this.captain, type === 'frost' ? 'weak_frost' : type === 'storm' ? 'weak_storm' : 'weak_blade');
    }
    if (this.broken) mul *= 1.5;
    const dmg = Math.max(1, Math.round(amount * mul));
    this.hp -= dmg;
    this.lastDamageType = type;
    g.ui.floatText({ x: this.pos.x, y: this.pos.y + this.height, z: this.pos.z }, dmg, mul > 1.2 ? '#ffd060' : mul < 0.8 ? '#9ab' : type === 'blade' ? '#fff' : '#' + typeColor(type).toString(16).padStart(6, '0'));
    g.particles.burst(this.pos.x, this.pos.y + this.height * 0.6, this.pos.z, type === 'blade' ? 8 : 5,
      this.def.faction === 'undead' || this.def.faction === 'arcane' ? 0x80d0ff : this.kind === 'thrall' || this.kind === 'malrec' ? 0xff1030 : 0x801010, 3, 0.9, 0.5, -8);
    if (type === 'fire') this.burn = Math.max(this.burn, 3);
    if (type === 'frost') this.slow = Math.max(this.slow, 3.5);
    if (!this.aggro) this.setAggro();
    // knockback & stagger (bosses resist)
    const resistStagger = this.boss ? 0.15 : this.captain ? 0.4 : 1;
    if (o.from && o.knock) {
      const dx = this.pos.x - o.from.x, dz = this.pos.z - o.from.z, l = Math.hypot(dx, dz) || 1;
      const k = o.knock * resistStagger;
      this.pos.x += (dx / l) * k * 0.35; this.pos.z += (dz / l) * k * 0.35;
    }
    if (o.stagger) {
      const s = o.stagger * resistStagger;
      if (s > 0.08 && (this.attackT < 0.3 || s > 0.3)) { this.stagger = Math.max(this.stagger, s); if (this.attackT >= 0 && s > 0.2) this.attackT = -1; }
    }
    // captain broken (kneels — executable)
    if (this.captain && !this.usedBreak && this.hp > 0 && this.hp < this.maxHp * 0.22) {
      this.usedBreak = true; this.broken = true; this.brokenT = 4; this.attackT = -1;
      g.ui.toast(`${this.captain.name} is broken! Press E to execute.`, 'nemesis');
    }
    if (this.has('cowardly') && this.hp < this.maxHp * 0.35 && !this.fled) { this.fear = 5; this.fled = true; g.ui.revealTrait(this.captain, 'cowardly'); g.ui.subtitle(this.name, 'No! Not like this!'); }
    if (this.has('berserker') && this.hp < this.maxHp * 0.4) { this.enrage = 99; g.ui.revealTrait(this.captain, 'berserker'); }
    if (this.hp <= 0) this.die(false);
    return dmg;
  }

  die(executed) {
    if (this.dead) return;
    this.dead = true; this.deadT = 0; this.hp = 0; this.broken = false;
    if (this.tag) this.tag.visible = false;
    this.game.onEnemyDeath(this, executed);
    if (this.onDeath) this.onDeath(this, executed);
  }

  setAggro() {
    if (this.aggro) return;
    this.aggro = true; this.alertT = 0.3;
    // alert friends
    for (const e of this.game.enemies) if (!e.dead && !e.aggro && e !== this && e.def.faction === this.def.faction && Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) < 18) { e.aggro = true; e.alertT = 0.3 + Math.random() * 0.5; }
  }

  faceTo(x, z, dt, rate = 8) {
    const target = Math.atan2(x - this.pos.x, z - this.pos.z);
    this.yaw += clamp(angleDiff(this.yaw, target), -rate * dt, rate * dt);
  }

  moveToward(x, z, speed, dt, strafeAmt = 0) {
    let dx = x - this.pos.x, dz = z - this.pos.z;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    if (strafeAmt) { const sx = -dz * this.strafe, sz = dx * this.strafe; dx = dx * (1 - strafeAmt) + sx * strafeAmt; dz = dz * (1 - strafeAmt) + sz * strafeAmt; }
    this.pos.x += dx * speed * dt; this.pos.z += dz * speed * dt;
    this.curSpeed = speed;
  }

  startAttack(kind = 0) {
    this.attackT = 0; this.attackKind = kind; this.struck = false;
    this.cd = this.def.cd * (this.enrage > 0 ? 0.6 : 1) * (this.has('sluggish') ? 1.4 : 1) * (0.8 + Math.random() * 0.4);
  }

  update(dt, t) {
    const g = this.game, pl = g.player;
    const st = this.animSt; st.t = t; st.speed = 0; st.cast = Math.max(0, st.cast - dt * 2); st.stagger = Math.max(0, this.stagger);
    this.curSpeed = 0;
    if (this.dead) {
      this.deadT += dt; st.dead = this.deadT; st.attack = -1;
      animateRig(this.rig, st, dt);
      this.root.position.copy(this.pos);
      if (this.deadT > 3) this.root.position.y -= (this.deadT - 3) * 0.6;
      return this.deadT > 5;
    }
    // status
    if (this.burn > 0) {
      this.burn -= dt;
      if (Math.random() < 0.5) g.particles.emit(this.pos.x + (Math.random() - 0.5) * 0.6, this.pos.y + Math.random() * this.height, this.pos.z + (Math.random() - 0.5) * 0.6, 0, 2, 0, 0xff7020, 1.2, 0.5);
      if ((this._burnTick = (this._burnTick ?? 0) + dt) > 0.5) { this._burnTick = 0; this.takeDamage(4 + g.player.fireBonus * 0.5, 'fire', {}); if (this.dead) return false; }
    }
    if (this.slow > 0) { this.slow -= dt; if (Math.random() < 0.2) g.particles.emit(this.pos.x, this.pos.y + 1, this.pos.z, 0, 0.5, 0, 0x90e0ff, 0.8, 0.6); }
    if (this.has('regenerate') && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.006 * dt);
    this.fear = Math.max(0, this.fear - dt); this.enrage = Math.max(0, this.enrage - dt);
    const slowMul = this.slow > 0 ? 0.55 : 1;
    const spd = this.speed * slowMul * (this.enrage > 0 ? 1.2 : 1);
    const d = this.dist();
    // stagger
    if (this.stagger > 0) { this.stagger -= dt; this.attackT = -1; this.finish(dt, st); return false; }
    if (this.broken) {
      this.brokenT -= dt; st.kneel = true;
      if (this.brokenT <= 0) { this.broken = false; st.kneel = false; this.enrage = 8; g.ui.subtitle(this.name, 'You missed your chance!'); }
      this.finish(dt, st); return false;
    }
    st.kneel = false;
    if (this.alertT > 0) { this.alertT -= dt; this.faceTo(pl.pos.x, pl.pos.z, dt); this.finish(dt, st); return false; }
    // informant cower
    if (this.informant && this.hp < this.maxHp * 0.4) {
      this.cower = true; st.kneel = true;
      this.faceTo(pl.pos.x, pl.pos.z, dt);
      this.finish(dt, st); return false;
    }
    if (!this.aggro) {
      if (pl.alive && d < this.def.aggro * (pl.sneak ? 0.55 : 1)) this.setAggro();
      else {
        // wander
        this.wanderT -= dt;
        if (this.wanderT <= 0) { this.wanderT = 3 + Math.random() * 6; const a = Math.random() * 6.28, r = Math.random() * 12; this.wanderTarget = { x: this.home.x + Math.cos(a) * r, z: this.home.z + Math.sin(a) * r }; }
        const wd = Math.hypot(this.wanderTarget.x - this.pos.x, this.wanderTarget.z - this.pos.z);
        if (wd > 1.5 && this.wanderT < 4) { this.faceTo(this.wanderTarget.x, this.wanderTarget.z, dt, 3); this.moveToward(this.wanderTarget.x, this.wanderTarget.z, spd * 0.3, dt); }
      }
      this.finish(dt, st); return false;
    }
    // leash
    const hd = Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z);
    if (!this.noLeash && (hd > this.leash || !pl.alive)) {
      this.aggro = false; this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.5);
      this.wanderTarget = { ...this.home }; this.wanderT = 6; this.attackT = -1;
      if (this.captain && pl.alive && !this.reportedFlee) { this.reportedFlee = true; g.onCaptainEscaped(this); }
      this.finish(dt, st); return false;
    }
    if (this.fear > 0) {
      // flee from player
      const ax = this.pos.x * 2 - pl.pos.x, az = this.pos.z * 2 - pl.pos.z;
      this.faceTo(ax, az, dt); this.moveToward(ax, az, spd * 0.9, dt);
      if (Math.random() < 0.02) g.ui.subtitle(this.name, this.has('fears_fire') ? 'FIRE! Keep it away!' : 'Get away from me!');
      this.finish(dt, st); return false;
    }
    if (this.boss) this.bossBrain(dt, d, spd);
    else this.brain(dt, d, spd);
    this.finish(dt, st);
    return false;
  }

  brain(dt, d, spd) {
    const g = this.game, pl = g.player, def = this.def;
    this.cd -= dt;
    if (this.attackT >= 0) { this.runAttack(dt); return; }
    const ranged = def.ranged || (this.has('spearthrower') ? { type: 'spear', speed: 30, keep: 0, chance: 0.5 } : null);
    this.faceTo(pl.pos.x, pl.pos.z, dt, 6);
    if (ranged && ranged.keep > 0) {
      if (d < ranged.keep * 0.6) this.moveToward(this.pos.x * 2 - pl.pos.x, this.pos.z * 2 - pl.pos.z, spd * 0.8, dt);
      else if (d > ranged.keep * 1.3) this.moveToward(pl.pos.x, pl.pos.z, spd, dt);
      else this.moveToward(pl.pos.x, pl.pos.z, spd * 0.4, dt, 1);
      if (this.cd <= 0 && d < ranged.keep * 2.2) { this.startAttack(0); this.rangedShot = ranged; }
      return;
    }
    if (ranged && this.cd <= 0 && d > 7 && d < 26 && Math.random() < (ranged.chance ?? 0.3) * dt * 3) { this.startAttack(0); this.rangedShot = ranged; return; }
    // melee tokens: only a few attack at once
    const attackers = g.enemies.filter((e) => !e.dead && e.aggro && e !== this && e.attackT >= 0 && !e.def.ranged).length;
    const want = def.range * 0.85;
    if (d > want) {
      const crowd = attackers >= 2 && d < 6 && !this.captain;
      this.moveToward(pl.pos.x, pl.pos.z, crowd ? spd * 0.35 : spd, dt, crowd ? 0.9 : d < 8 ? 0.25 : 0);
    } else if (this.cd > 0 || (attackers >= 2 && !this.captain)) {
      this.moveToward(pl.pos.x, pl.pos.z, spd * 0.3, dt, 1);
      if (d < want * 0.6) this.moveToward(this.pos.x * 2 - pl.pos.x, this.pos.z * 2 - pl.pos.z, spd * 0.4, dt);
    }
    if (d <= def.range + 0.4 && this.cd <= 0 && (attackers < 2 || this.captain)) { this.startAttack(Math.floor(Math.random() * 3)); this.rangedShot = null; }
    // captains with a warhorn summon help once
    if (this.has('warhorn') && !this.hornUsed && this.hp < this.maxHp * 0.7) {
      this.hornUsed = true; g.audio.play('roar'); g.ui.revealTrait(this.captain, 'warhorn');
      g.ui.subtitle(this.name, 'To me, lads! TO ME!');
      for (let i = 0; i < 3; i++) g.spawnEnemy(i === 0 ? 'goblin_archer' : 'goblin', this.pos.x + (Math.random() - 0.5) * 14, this.pos.z + (Math.random() - 0.5) * 14, { aggro: true, level: this.level });
    }
  }

  runAttack(dt) {
    const g = this.game, pl = g.player;
    const slowMul = (this.slow > 0 ? 0.7 : 1) * (this.has('sluggish') ? 0.8 : 1) * (this.enrage > 0 ? 1.3 : 1);
    const dur = this.def.windup / 0.35; // full attack duration so windup maps to 0.35 of it
    this.attackT += (dt / dur) * slowMul;
    if (this.attackT < 0.35) this.faceTo(pl.pos.x, pl.pos.z, dt, 5);
    if (this.attackT >= 0.32 && this.attackT < 0.35 && !this.glinted && !this.rangedShot) {
      this.glinted = true;
      const unbl = this.has('unblockable') || (this.boss && this.attackKind === 2);
      g.particles.emit(this.pos.x + Math.sin(this.yaw) * 0.6, this.pos.y + this.height * 0.95, this.pos.z + Math.cos(this.yaw) * 0.6, 0, 0, 0, unbl ? 0xff2020 : 0xffffff, unbl ? 4 : 2.5, 0.25);
    }
    if (this.attackT >= 0.4 && !this.struck) {
      this.struck = true; this.glinted = false;
      if (this.rangedShot) {
        const r = this.rangedShot;
        const from = new THREE.Vector3(this.pos.x, this.pos.y + this.height * 0.75, this.pos.z);
        const tgt = new THREE.Vector3(pl.pos.x + pl.vel.x * 0.3, pl.pos.y + 1.1, pl.pos.z + pl.vel.z * 0.3);
        const dist = from.distanceTo(tgt);
        const vel = tgt.sub(from).normalize().multiplyScalar(r.speed);
        const grav = r.type === 'arrow' || r.type === 'spear' ? 9 : 0;
        if (grav) vel.y += (grav * dist / r.speed) * 0.5;
        g.combat.shoot({ pos: from, vel, owner: this, dmg: this.dmg * (r.type === 'spear' ? 1.4 : 1), type: r.type, gravity: grav, life: 3 });
        g.audio.play(r.type === 'arrow' || r.type === 'spear' ? 'arrow' : 'frost');
        this.animSt.cast = 1;
      } else {
        g.audio.play('swing');
        const d = this.dist();
        const ang = Math.abs(angleDiff(this.yaw, Math.atan2(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z)));
        const reach = this.def.range + 0.6 + (this.boss && this.attackKind === 2 ? 0.8 : 0);
        if (d < reach + 0.4 && ang < 1.3) {
          const res = pl.receiveHit({ dmg: this.dmg * (this.enrage > 0 ? 1.3 : 1) * (this.attackKind === 2 ? 1.25 : 1), from: this, type: 'melee', unblockable: this.has('unblockable') || (this.boss && this.attackKind === 2) });
          if (res === 'parried') { this.stagger = this.has('parry_weak') ? 2.2 : this.boss ? 0.7 : 1.3; this.attackT = -1; if (this.has('parry_weak')) g.ui.revealTrait(this.captain, 'parry_weak'); return; }
          if (res === 'hit' && this.def.lifesteal) { this.hp = Math.min(this.maxHp, this.hp + this.dmg * this.def.lifesteal); }
          if (res === 'hit' && this.has('unblockable') && pl.wasBlocking) g.ui.revealTrait(this.captain, 'unblockable');
        }
        if (this.kind === 'king' && this.attackKind === 2) {
          g.combat.hazard({ x: this.pos.x + Math.sin(this.yaw) * 3, z: this.pos.z + Math.cos(this.yaw) * 3, r: 6, delay: 0.25, dmg: this.dmg * 0.7, type: 'shadow', owner: this });
        }
      }
    }
    if (this.attackT >= 1) { this.attackT = -1; this.rangedShot = null; }
  }

  // ---------------- Bosses ----------------
  bossBrain(dt, d, spd) {
    const g = this.game, pl = g.player;
    const T = this.timers;
    for (const k in T) T[k] -= dt;
    this.cd -= dt;
    if (this.hp < this.maxHp * 0.5 && this.phase === 1) {
      this.phase = 2; g.audio.play('roar');
      const lines = { morwen: 'The bog remembers every drowned soul... and they all hunger!', malrec: 'Enough games. Taste the true thirst of Vorr!', ilvane: 'Impressive. Let me show you what the Spire truly teaches!', king: 'The moon itself bends to me! KNEEL!' };
      g.ui.subtitle(this.def.name, lines[this.kind]);
    }
    if (this.attackT >= 0) { this.runAttack(dt); return; }
    const fast = this.phase === 2 ? 0.7 : 1;
    this.faceTo(pl.pos.x, pl.pos.z, dt, 5);
    const P = (x, y, z) => new THREE.Vector3(x, y, z);
    const aimAt = (from, speed) => { const tgt = P(pl.pos.x, pl.pos.y + 1, pl.pos.z); return tgt.sub(from).normalize().multiplyScalar(speed); };
    if (this.kind === 'morwen') {
      if (d < 5) this.moveToward(this.pos.x * 2 - pl.pos.x, this.pos.z * 2 - pl.pos.z, spd * 0.7, dt);
      else if (d > 16) this.moveToward(pl.pos.x, pl.pos.z, spd, dt);
      else this.moveToward(pl.pos.x, pl.pos.z, spd * 0.5, dt, 1);
      if (T.a <= 0) {
        T.a = 2.4 * fast; this.animSt.cast = 1; g.audio.play('fire');
        const from = P(this.pos.x, this.pos.y + 2, this.pos.z);
        const base = aimAt(from, 16);
        for (let i = -1; i <= 1; i++) g.combat.shoot({ pos: from, vel: base.clone().applyAxisAngle(_up, i * 0.22), owner: this, dmg: this.dmg * 0.8, type: 'poison', life: 3 });
      }
      if (T.b <= 0) { T.b = 14 * fast; g.ui.subtitle(this.def.name, 'Rise, my drowned children!'); for (let i = 0; i < (this.phase === 2 ? 4 : 2); i++) g.spawnEnemy('wight', this.pos.x + (Math.random() - 0.5) * 16, this.pos.z + (Math.random() - 0.5) * 16, { aggro: true, level: 3, noLeash: true }); }
      if (T.c <= 0) { T.c = 9 * fast; this.blink(pl, 11); }
      if (this.phase === 2 && T.d <= 0) { T.d = 5; g.combat.hazard({ x: pl.pos.x, z: pl.pos.z, r: 4.5, delay: 1.3, dmg: this.dmg * 1.1, type: 'poison', owner: this }); }
      if (d < 3 && this.cd <= 0) this.startAttack(0);
    } else if (this.kind === 'malrec') {
      if (d > this.def.range * 0.9) this.moveToward(pl.pos.x, pl.pos.z, spd, dt, d < 7 ? 0.3 : 0);
      if (d < this.def.range + 0.4 && this.cd <= 0) { this.startAttack(Math.floor(Math.random() * 3)); if (Math.random() < 0.5) this.cd = 0.25; }
      if (T.a <= 0) {
        T.a = 7 * fast; this.animSt.cast = 1; g.audio.play('zap');
        const from = P(this.pos.x, this.pos.y + 2, this.pos.z);
        const n = this.phase === 2 ? 7 : 5;
        for (let i = 0; i < n; i++) g.combat.shoot({ pos: from, vel: aimAt(from, 20).applyAxisAngle(_up, (i - (n - 1) / 2) * 0.18), owner: this, dmg: this.dmg * 0.6, type: 'blood', life: 3 });
      }
      if (T.c <= 0) {
        T.c = 10 * fast;
        const bx = pl.pos.x - Math.sin(pl.yaw) * 3, bz = pl.pos.z - Math.cos(pl.yaw) * 3;
        g.particles.burst(this.pos.x, this.pos.y + 1.5, this.pos.z, 30, 0xff1030, 6, 1.5, 0.6, 0);
        this.pos.x = bx; this.pos.z = bz; this.cd = 0; this.startAttack(1);
        g.particles.burst(bx, this.pos.y + 1.5, bz, 30, 0xff1030, 6, 1.5, 0.6, 0);
        g.ui.subtitle(this.def.name, pick2(['Behind you.', 'Too slow, little knight.', 'I am the night.']));
      }
      if (this.phase === 2 && T.b <= 0) { T.b = 16; for (let i = 0; i < 2; i++) g.spawnEnemy('thrall', this.pos.x + (Math.random() - 0.5) * 10, this.pos.z + (Math.random() - 0.5) * 10, { aggro: true, level: 4, noLeash: true }); }
    } else if (this.kind === 'ilvane') {
      this.pos.y += 0; // floats via model offset
      if (d < 7) this.moveToward(this.pos.x * 2 - pl.pos.x, this.pos.z * 2 - pl.pos.z, spd, dt);
      else if (d > 18) this.moveToward(pl.pos.x, pl.pos.z, spd, dt);
      else this.moveToward(pl.pos.x, pl.pos.z, spd * 0.6, dt, 1);
      if (T.a <= 0) {
        T.a = 2.2 * fast; this.animSt.cast = 1; g.audio.play('zap');
        const n = this.phase === 2 ? 3 : 2;
        for (let i = 0; i < n; i++) {
          const from = P(this.pos.x + (i - (n - 1) / 2) * 1.5, this.pos.y + 3, this.pos.z);
          g.combat.shoot({ pos: from, vel: aimAt(from, 11).add(P(0, 3, 0)), owner: this, dmg: this.dmg * 0.75, type: 'arcane', life: 4, homing: 1.6, target: pl, size: 1.3 });
        }
      }
      if (T.b <= 0) { T.b = 18 * fast; g.ui.subtitle(this.def.name, 'Guardians of the Spire — awaken!'); for (let i = 0; i < (this.phase === 2 ? 2 : 1); i++) g.spawnEnemy('construct', this.pos.x + (Math.random() - 0.5) * 14, this.pos.z + (Math.random() - 0.5) * 14, { aggro: true, level: 3, noLeash: true }); }
      if (T.c <= 0) { T.c = 8 * fast; g.combat.hazard({ x: this.pos.x, z: this.pos.z, r: 9, delay: 1.6, dmg: this.dmg * 1.2, type: 'storm', owner: this }); }
      if (this.phase === 2 && T.d <= 0) { T.d = 4; this.blink(pl, 14); }
      if (d < 3 && this.cd <= 0) this.startAttack(1);
    } else if (this.kind === 'king') {
      if (d > this.def.range * 0.85) this.moveToward(pl.pos.x, pl.pos.z, spd, dt);
      if (d < this.def.range + 0.6 && this.cd <= 0) this.startAttack(Math.floor(Math.random() * 3));
      if (T.b <= 0) { T.b = 16 * fast; g.ui.subtitle(this.def.name, 'Servants of the dark moon, rise!'); for (let i = 0; i < 3; i++) g.spawnEnemy('wraith', this.pos.x + (Math.random() - 0.5) * 20, this.pos.z + (Math.random() - 0.5) * 20, { aggro: true, level: 5, noLeash: true }); }
      if (this.phase === 2 && T.a <= 0) {
        T.a = 4.5;
        for (let i = 0; i < 3; i++) g.combat.hazard({ x: pl.pos.x + (Math.random() - 0.5) * (i ? 10 : 0), z: pl.pos.z + (Math.random() - 0.5) * (i ? 10 : 0), r: 4, delay: 1.4 + i * 0.25, dmg: this.dmg * 0.9, type: 'shadow', owner: this });
      }
      if (T.c <= 0 && d > 10) {
        T.c = 9; this.animSt.cast = 1;
        const from = P(this.pos.x, this.pos.y + 4, this.pos.z);
        for (let i = -2; i <= 2; i++) g.combat.shoot({ pos: from, vel: aimAt(from, 18).applyAxisAngle(_up, i * 0.15), owner: this, dmg: this.dmg * 0.6, type: 'shadow', life: 3, size: 1.5 });
      }
    }
  }
  blink(pl, r) {
    const g = this.game;
    g.particles.burst(this.pos.x, this.pos.y + 1.5, this.pos.z, 30, this.kind === 'morwen' ? 0x60ff40 : 0x8070ff, 6, 1.5, 0.6, 0);
    const a = Math.random() * Math.PI * 2;
    const nx = pl.pos.x + Math.cos(a) * r, nz = pl.pos.z + Math.sin(a) * r;
    if (getHeight(nx, nz) > WATER_LEVEL - 1 || this.kind === 'morwen') { this.pos.x = nx; this.pos.z = nz; }
    g.particles.burst(this.pos.x, this.pos.y + 1.5, this.pos.z, 30, this.kind === 'morwen' ? 0x60ff40 : 0x8070ff, 6, 1.5, 0.6, 0);
  }

  finish(dt, st) {
    // separation from other enemies & player
    const g = this.game;
    for (const e of g.enemies) {
      if (e === this || e.dead) continue;
      const dx = this.pos.x - e.pos.x, dz = this.pos.z - e.pos.z, dd = Math.hypot(dx, dz), m = this.radius + e.radius;
      if (dd < m && dd > 1e-4) { const push = (m - dd) * 0.5; this.pos.x += (dx / dd) * push; this.pos.z += (dz / dd) * push; }
    }
    const pl = g.player;
    { const dx = this.pos.x - pl.pos.x, dz = this.pos.z - pl.pos.z, dd = Math.hypot(dx, dz), m = this.radius + 0.45; if (dd < m && dd > 1e-4) { this.pos.x = pl.pos.x + (dx / dd) * m; this.pos.z = pl.pos.z + (dz / dd) * m; } }
    resolve(this.pos, this.radius);
    let gy = getHeight(this.pos.x, this.pos.z);
    if (this.rig.floating) gy = Math.max(gy, WATER_LEVEL) + (this.kind === 'ilvane' ? 0.8 : 0);
    else if (gy < WATER_LEVEL - 1.1 && this.kind !== 'wight' && this.kind !== 'morwen') gy = WATER_LEVEL - 1.1;
    this.pos.y += (gy - this.pos.y) * Math.min(1, dt * 12);
    st.speed = this.curSpeed;
    st.attack = this.attackT;
    st.attackKind = this.attackKind;
    animateRig(this.rig, st, dt);
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
    if (this.tag) { this.tag.rotation.z += dt * 2; }
  }
  remove() { this.game.scene.remove(this.root); }
}
const _up = new THREE.Vector3(0, 1, 0);
const pick2 = (a) => a[Math.floor(Math.random() * a.length)];

// ----------------------------- NPCs -----------------------------------------
export class NPC {
  constructor(game, o) {
    this.game = game; this.id = o.id; this.name = o.name; this.role = o.role;
    this.dialog = o.dialog;
    this.rig = o.rig || makeVillager(o.look || {});
    this.root = this.rig.root;
    this.pos = new THREE.Vector3(o.x, getHeight(o.x, o.z), o.z);
    this.home = { x: o.x, z: o.z };
    this.yaw = o.face ?? 0;
    this.wander = o.wander ?? (o.role === 'villager' ? 6 : 0);
    this.target = null; this.waitT = Math.random() * 5;
    this.st = { speed: 0, attack: -1, t: 0, dead: 0, cast: 0 };
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
    this.floating = !!o.floating;
    game.scene.add(this.root);
    this.marker = null;
  }
  setMarker(on, color = 0xffd040) {
    if (on && !this.marker) {
      this.marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), glow(color, 3));
      this.marker.scale.y = 1.8; this.marker.position.y = (this.rig.height ?? 1.9) + 0.7; this.root.add(this.marker);
    } else if (!on && this.marker) { this.root.remove(this.marker); this.marker = null; }
  }
  update(dt, t) {
    this.st.t = t; this.st.speed = 0;
    const pl = this.game.player;
    const d = Math.hypot(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z);
    if (d < 6) {
      const target = Math.atan2(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z);
      this.yaw += angleDiff(this.yaw, target) * Math.min(1, dt * 4);
    } else if (this.wander) {
      this.waitT -= dt;
      if (!this.target && this.waitT <= 0) { const a = Math.random() * 6.28, r = Math.random() * this.wander; this.target = { x: this.home.x + Math.cos(a) * r, z: this.home.z + Math.sin(a) * r }; }
      if (this.target) {
        const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z, l = Math.hypot(dx, dz);
        if (l < 0.5) { this.target = null; this.waitT = 3 + Math.random() * 6; }
        else { this.pos.x += (dx / l) * 1.4 * dt; this.pos.z += (dz / l) * 1.4 * dt; this.st.speed = 1.4; this.yaw += angleDiff(this.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 5); }
      }
      resolve(this.pos, 0.4);
    }
    this.pos.y = Math.max(getHeight(this.pos.x, this.pos.z), this.floating ? 0 : -10);
    animateRig(this.rig, this.st, dt);
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
    if (this.marker) { this.marker.rotation.y += dt * 2; this.marker.position.y = (this.rig.height ?? 1.9) + 0.7 + Math.sin(t * 3) * 0.1; }
  }
}
