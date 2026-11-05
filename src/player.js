// The Spellknight: third-person controller, sword combat and spellcasting.
import * as THREE from 'three';
import { makeKnight, animateRig } from './models.js';
import { getHeight } from './terrain.js';
import { resolve } from './physics.js';
import { PLAY_HALF, WATER_LEVEL } from './data.js';
import { angleDiff, clamp, lerp } from './util.js';

export const SPELLS = {
  firebolt: { key: 1, name: 'Firebolt', mana: 14, cd: 0.6, icon: '🔥', color: '#ff7a30', desc: 'Hurl a bolt of flame that sets foes ablaze.' },
  frostnova: { key: 2, name: 'Frost Nova', mana: 28, cd: 6, icon: '❄', color: '#8fd8ff', desc: 'Freeze and slow everything around you.' },
  lightning: { key: 3, name: 'Chain Lightning', mana: 32, cd: 3, icon: 'ϟ', color: '#b0c0ff', desc: 'Lightning leaps between enemies.' },
  ward: { key: 4, name: 'Ward of Selun', mana: 35, cd: 12, icon: '✚', color: '#ffe8a0', desc: 'Heal and shield yourself in pale moonlight.' },
};

export const SKILLS = {
  blade: { tree: 'Knight', name: 'Blade Mastery', max: 5, desc: '+12% sword damage per rank.' },
  bulwark: { tree: 'Knight', name: 'Bulwark', max: 5, desc: '+20 maximum health per rank.' },
  ironwill: { tree: 'Knight', name: 'Iron Will', max: 3, desc: '+25 stamina and cheaper blocks per rank.' },
  riposte: { tree: 'Knight', name: 'Riposte', max: 3, desc: 'Longer parry window; parries deal damage.' },
  arcane: { tree: 'Mage', name: 'Arcane Depth', max: 5, desc: '+20 mana and faster mana regen per rank.' },
  pyro: { tree: 'Mage', name: 'Pyromancy', max: 5, desc: '+15% fire damage; Firebolt explodes at rank 3.' },
  storm: { tree: 'Mage', name: 'Stormcaller', max: 4, desc: 'Unlocks Chain Lightning; +1 chain per rank after.' },
  rime: { tree: 'Mage', name: 'Rimeheart', max: 3, desc: 'Larger, stronger Frost Nova.' },
};

export class Player {
  constructor(game) {
    this.game = game;
    this.rig = makeKnight();
    this.root = this.rig.root;
    game.scene.add(this.root);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.camYaw = Math.PI; this.camPitch = 0.25; this.camDist = 6.5;
    this.name = 'Ser Aldwyn';
    this.reset();
    this.anim = { speed: 0, attack: -1, attackKind: 0, block: false, cast: 0, dead: 0, stagger: 0, t: 0, roll: 0, air: false };
  }
  reset() {
    this.level = 1; this.xp = 0; this.skillPoints = 0; this.gold = 25;
    this.skills = { blade: 0, bulwark: 0, ironwill: 0, riposte: 0, arcane: 0, pyro: 0, storm: 0, rime: 0 };
    this.potions = 3; this.manaPotions = 2;
    this.bloodPact = false;
    this.recalc();
    this.hp = this.maxHp; this.mana = this.maxMana; this.stamina = this.maxStamina;
    this.alive = true;
    this.spellCd = { firebolt: 0, frostnova: 0, lightning: 0, ward: 0 };
  }
  serialize() {
    return { level: this.level, xp: this.xp, skillPoints: this.skillPoints, gold: this.gold, skills: this.skills, potions: this.potions, manaPotions: this.manaPotions,
      bloodPact: this.bloodPact, hp: this.hp, mana: this.mana, x: this.pos.x, z: this.pos.z, name: this.name };
  }
  load(d) {
    Object.assign(this, { level: d.level, xp: d.xp, skillPoints: d.skillPoints, gold: d.gold, potions: d.potions, manaPotions: d.manaPotions, bloodPact: d.bloodPact, name: d.name || this.name });
    this.skills = { ...this.skills, ...d.skills };
    this.recalc();
    this.hp = Math.min(this.maxHp, d.hp ?? this.maxHp); this.mana = d.mana ?? this.maxMana; this.stamina = this.maxStamina;
    this.teleport(d.x, d.z);
  }
  recalc() {
    const s = this.skills;
    this.maxHp = 100 + (this.level - 1) * 8 + s.bulwark * 20 - (this.bloodPact ? 20 : 0);
    this.maxMana = 80 + (this.level - 1) * 5 + s.arcane * 20;
    this.maxStamina = 100 + s.ironwill * 25;
    this.bladeMul = (1 + s.blade * 0.12) * (this.bloodPact ? 1.25 : 1);
    this.fireBonus = s.pyro;
    this.spellMul = 1 + (this.level - 1) * 0.04;
    this.parryWindowLen = 0.2 + s.riposte * 0.06;
    this.unlocked = { firebolt: true, frostnova: true, lightning: s.storm > 0, ward: true };
  }
  xpToNext() { return Math.round(100 * Math.pow(this.level, 1.45)); }
  addXp(n) {
    this.xp += n;
    let leveled = false;
    while (this.xp >= this.xpToNext()) { this.xp -= this.xpToNext(); this.level++; this.skillPoints++; leveled = true; }
    if (leveled) { this.recalc(); this.hp = this.maxHp; this.mana = this.maxMana; this.game.onLevelUp(); }
  }
  teleport(x, z) {
    this.pos.set(x, Math.max(getHeight(x, z), WATER_LEVEL - 1.2), z);
    this.vel.set(0, 0, 0);
    this.root.position.copy(this.pos);
  }
  respawn(x, z) {
    this.alive = true; this.hp = this.maxHp; this.mana = this.maxMana; this.stamina = this.maxStamina;
    this.anim.dead = 0; this.deadT = 0; this.teleport(x, z);
    this.state = 'idle';
  }
  init() {
    this.state = 'idle'; this.stateT = 0;
    this.combo = 0; this.attackT = -1; this.attackQueued = false; this.hitSet = new Set();
    this.blocking = false; this.blockT = 0; this.rollT = 0; this.rollDir = new THREE.Vector3();
    this.iframes = 0; this.hurtT = 0; this.ward = 0; this.castT = 0;
    this.onGround = true; this.swimming = false; this.stepT = 0; this.lastHitBy = null;
    this.sprint = false; this.sneak = false;
  }

  // -------- damage taken --------
  receiveHit(h) {
    const g = this.game;
    if (!this.alive || g.cinematic) return 'none';
    if (this.iframes > 0) { if (!h.aoe && !h.ranged) g.ui.floatText({ x: this.pos.x, y: this.pos.y + 2, z: this.pos.z }, 'DODGE', '#aac'); return 'dodged'; }
    this.wasBlocking = this.blocking;
    let dmg = h.dmg;
    if (this.blocking && !h.unblockable && !h.aoe) {
      const src = h.from && h.from.pos ? h.from.pos : h.pos;
      const facing = src ? Math.abs(angleDiff(this.yaw, Math.atan2(src.x - this.pos.x, src.z - this.pos.z))) < 1.4 : true;
      if (facing) {
        if (this.blockT < this.parryWindowLen && !h.ranged) {
          g.audio.play('parry'); g.hitstop(0.12);
          g.particles.burst(this.pos.x + Math.sin(this.yaw), this.pos.y + 1.4, this.pos.z + Math.cos(this.yaw), 26, 0xbfe0ff, 7, 1.4, 0.4, 0);
          g.ui.floatText({ x: this.pos.x, y: this.pos.y + 2.2, z: this.pos.z }, 'PARRY', '#bfe0ff');
          if (this.skills.riposte && h.from && h.from.takeDamage) h.from.takeDamage(10 + this.skills.riposte * 10, 'blade', {});
          this.stamina = Math.min(this.maxStamina, this.stamina + 10);
          return 'parried';
        }
        const cost = dmg * (1.6 - this.skills.ironwill * 0.25);
        if (this.stamina >= cost * 0.3) {
          this.stamina = Math.max(0, this.stamina - cost);
          g.audio.play('clang');
          g.particles.burst(this.pos.x + Math.sin(this.yaw) * 0.8, this.pos.y + 1.3, this.pos.z + Math.cos(this.yaw) * 0.8, 10, 0xffd080, 5, 0.8, 0.3, -6);
          if (this.stamina <= 0) { this.blocking = false; this.hurtT = 0.7; g.ui.floatText({ x: this.pos.x, y: this.pos.y + 2, z: this.pos.z }, 'GUARD BREAK', '#f88'); }
          return 'blocked';
        }
      }
    }
    if (this.ward > 0) dmg *= 0.5;
    dmg = Math.round(dmg);
    this.hp -= dmg;
    this.lastHitBy = h.from && h.from.captain ? h.from : h.from && h.from.def ? h.from : this.lastHitBy;
    g.audio.play('hurt'); g.shake(0.25); g.ui.hurtFlash();
    g.particles.burst(this.pos.x, this.pos.y + 1.2, this.pos.z, 8, 0x801010, 3, 0.9, 0.5, -8);
    if (h.type === 'frost') this.chill = 2;
    if (!h.aoe) this.hurtT = Math.max(this.hurtT, 0.25);
    if (this.attackT >= 0 && this.attackT < 0.3) { this.attackT = -1; }
    if (this.hp <= 0) { this.hp = 0; this.die(h.from); }
    return 'hit';
  }
  die(killer) {
    this.alive = false; this.deadT = 0;
    this.game.audio.play('death');
    this.game.onPlayerDeath(killer && killer.captain ? killer : this.lastHitBy);
  }

  // -------- per-frame --------
  update(dt, input, camForward) {
    const g = this.game;
    const A = this.anim; A.t += dt; A.cast = Math.max(0, A.cast - dt * 2.2);
    for (const k in this.spellCd) this.spellCd[k] = Math.max(0, this.spellCd[k] - dt);
    this.iframes = Math.max(0, this.iframes - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.ward = Math.max(0, this.ward - dt);
    this.chill = Math.max(0, (this.chill ?? 0) - dt);
    if (!this.alive) {
      this.deadT += dt; A.dead = this.deadT; A.attack = -1; A.speed = 0; A.block = false;
      animateRig(this.rig, A, dt);
      return;
    }
    // regen
    const inCombat = g.inCombat;
    this.mana = Math.min(this.maxMana, this.mana + dt * (3 + this.skills.arcane * 0.8 + (inCombat ? 0 : 3)));
    if (!inCombat) this.hp = Math.min(this.maxHp, this.hp + dt * 1.5);
    if (this.ward > 0 && Math.random() < 0.3) g.particles.emit(this.pos.x + (Math.random() - 0.5), this.pos.y + Math.random() * 2, this.pos.z + (Math.random() - 0.5), 0, 1, 0, 0xffe8a0, 0.8, 0.6);

    // ---- input -> desired movement
    const fwd = _f.set(camForward.x, 0, camForward.z).normalize();
    const right = _r.set(-fwd.z, 0, fwd.x);
    const mv = _m.set(0, 0, 0);
    if (!g.uiBlocking) {
      if (input.down('KeyW')) mv.add(fwd);
      if (input.down('KeyS')) mv.sub(fwd);
      if (input.down('KeyD')) mv.add(right);
      if (input.down('KeyA')) mv.sub(right);
    }
    const moving = mv.lengthSq() > 0.01;
    if (moving) mv.normalize();
    this.blocking = !g.uiBlocking && input.mouse[2] && this.rollT <= 0 && this.attackT < 0 && this.stamina > 0 && this.hurtT <= 0;
    this.blockT = this.blocking ? this.blockT + dt : 0;
    this.sprint = !g.uiBlocking && input.down('ShiftLeft') && moving && !this.blocking && this.stamina > 1 && this.attackT < 0;
    this.sneak = !g.uiBlocking && input.down('ControlLeft');

    // ---- roll / dodge
    if (!g.uiBlocking && input.pressed('KeyQ') && this.rollT <= 0 && this.stamina >= 22 && this.onGround && this.hurtT <= 0) {
      this.rollT = 0.55; this.iframes = 0.38; this.stamina -= 22; this.attackT = -1;
      this.rollDir.copy(moving ? mv : _v.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)));
      this.yaw = Math.atan2(this.rollDir.x, this.rollDir.z);
      g.audio.play('swing');
    }
    // ---- jump
    if (!g.uiBlocking && input.pressed('Space') && this.onGround && !this.swimming && this.rollT <= 0) { this.vel.y = 7.5; this.onGround = false; }

    // ---- attack
    if (!g.uiBlocking && input.mousePressed(0) && this.rollT <= 0 && !this.blocking && this.hurtT <= 0) {
      if (this.attackT < 0) this.startSwing(camForward);
      else if (this.attackT > 0.35) this.attackQueued = true;
    }
    // ---- spells
    if (!g.uiBlocking && this.rollT <= 0) {
      for (const [id, sp] of Object.entries(SPELLS)) if (input.pressed('Digit' + sp.key)) this.cast(id, camForward);
    }
    // ---- potions
    if (!g.uiBlocking && input.pressed('KeyR')) this.drink('hp');
    if (!g.uiBlocking && input.pressed('KeyT')) this.drink('mana');

    // ---- movement
    let speed = this.sneak ? 2.6 : this.sprint ? 11.5 : 6.4;
    if (this.chill > 0) speed *= 0.7;
    if (this.blocking) speed = 2.4;
    if (this.attackT >= 0) speed = 1.4;
    if (this.hurtT > 0) speed *= 0.4;
    if (this.swimming) speed *= 0.5;
    if (this.sprint) this.stamina = Math.max(0, this.stamina - dt * 16);
    else if (this.attackT < 0 && !this.blocking && this.rollT <= 0) this.stamina = Math.min(this.maxStamina, this.stamina + dt * 28);
    else if (this.blocking) this.stamina = Math.min(this.maxStamina, this.stamina + dt * 6);

    let hv = _h.set(0, 0, 0);
    if (this.rollT > 0) {
      this.rollT -= dt;
      hv.copy(this.rollDir).multiplyScalar(13 * Math.min(1, this.rollT / 0.3 + 0.2));
    } else if (moving) {
      hv.copy(mv).multiplyScalar(speed);
      const targetYaw = this.blocking || this.attackT >= 0 ? Math.atan2(fwd.x, fwd.z) : Math.atan2(mv.x, mv.z);
      this.yaw += angleDiff(this.yaw, targetYaw) * Math.min(1, dt * (this.attackT >= 0 ? 4 : 12));
    } else if (this.blocking) {
      this.yaw += angleDiff(this.yaw, Math.atan2(fwd.x, fwd.z)) * Math.min(1, dt * 10);
    }
    // smooth horizontal velocity
    const accel = this.onGround ? 14 : 3;
    this.vel.x = lerp(this.vel.x, hv.x, Math.min(1, dt * accel));
    this.vel.z = lerp(this.vel.z, hv.z, Math.min(1, dt * accel));
    if (this.rollT > 0) { this.vel.x = hv.x; this.vel.z = hv.z; }
    this.vel.y -= 22 * dt;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt; this.pos.y += this.vel.y * dt;
    this.pos.x = clamp(this.pos.x, -PLAY_HALF, PLAY_HALF); this.pos.z = clamp(this.pos.z, -PLAY_HALF, PLAY_HALF);
    resolve(this.pos, 0.45, this.pos.y);
    const gh = getHeight(this.pos.x, this.pos.z);
    this.swimming = gh < WATER_LEVEL - 1.25;
    const floor = this.swimming ? WATER_LEVEL - 1.25 : gh;
    // steep slopes slide the player back (mountain walls)
    if (this.pos.y <= floor + 0.05) {
      if (!this.onGround && this.vel.y < -14) { this.hp -= Math.round((-this.vel.y - 14) * 3); g.shake(0.3); if (this.hp <= 0) { this.hp = 0; this.die(null); } }
      this.pos.y = floor; this.vel.y = 0; this.onGround = true;
    } else if (this.pos.y > floor + 0.4) this.onGround = false;
    else if (this.vel.y <= 0) { this.pos.y = floor; this.vel.y = 0; this.onGround = true; }
    if (this.swimming && Math.random() < 0.2) g.particles.emit(this.pos.x, WATER_LEVEL + 0.05, this.pos.z, (Math.random() - 0.5), 0.3, (Math.random() - 0.5), 0x80b0d0, 0.8, 0.5);

    // footsteps
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && hs > 1) { this.stepT -= dt * hs; if (this.stepT <= 0) { this.stepT = 2.6; g.audio.play('step'); } }

    // ---- swing update
    if (this.attackT >= 0) this.updateSwing(dt, camForward);
    // ---- anim
    A.speed = this.rollT > 0 ? 0 : hs;
    A.attack = this.attackT; A.attackKind = this.combo % 3;
    A.block = this.blocking; A.air = !this.onGround && !this.swimming; A.roll = this.rollT > 0 ? 1 - this.rollT / 0.55 : 0;
    A.stagger = this.hurtT > 0 ? this.hurtT * 2 : 0;
    A.dead = 0;
    animateRig(this.rig, A, dt);
    this.root.position.copy(this.pos);
    if (this.swimming) this.root.position.y += 0.2;
    this.root.rotation.y = this.yaw;
    // orb glow pulse in the off hand
    const orb = this.rig.handL.children[0];
    if (orb) orb.scale.setScalar(0.8 + A.cast * 1.6 + Math.sin(A.t * 4) * 0.1);
  }

  softTarget(dir, maxD = 6, cone = 1.0) {
    let best = null, bs = Infinity;
    for (const e of this.game.enemies) {
      if (e.dead) continue;
      const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d > maxD) continue;
      const a = Math.abs(angleDiff(Math.atan2(dir.x, dir.z), Math.atan2(dx, dz)));
      if (a > cone) continue;
      const s = d + a * 6;
      if (s < bs) { bs = s; best = e; }
    }
    return best;
  }

  startSwing(camForward) {
    const cost = 12;
    if (this.stamina < 4) return;
    this.stamina = Math.max(0, this.stamina - cost);
    this.attackT = 0; this.hitSet.clear(); this.attackQueued = false;
    const t = this.softTarget(camForward, 7, 1.2);
    if (t) this.yaw = Math.atan2(t.pos.x - this.pos.x, t.pos.z - this.pos.z);
    else this.yaw = Math.atan2(camForward.x, camForward.z);
    this.game.audio.play('swing');
    // lunge
    this.vel.x += Math.sin(this.yaw) * 4; this.vel.z += Math.cos(this.yaw) * 4;
  }
  updateSwing(dt) {
    const g = this.game;
    const dur = this.combo % 3 === 2 ? 0.62 : 0.48;
    this.attackT += dt / dur;
    if (this.attackT > 0.35 && this.attackT < 0.62) {
      const heavy = this.combo % 3 === 2;
      const reach = heavy ? 3.2 : 2.8;
      for (const e of g.enemies) {
        if (e.dead || this.hitSet.has(e)) continue;
        const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z, d = Math.hypot(dx, dz);
        if (d > reach + e.radius) continue;
        if (Math.abs(angleDiff(this.yaw, Math.atan2(dx, dz))) > 1.15) continue;
        this.hitSet.add(e);
        const base = (heavy ? 30 : 20) * this.bladeMul * (1 + (this.level - 1) * 0.05);
        const dealt = e.takeDamage(base * (0.9 + Math.random() * 0.2), 'blade', { from: this.pos, knock: heavy ? 5 : 2, stagger: heavy ? 0.6 : 0.3 });
        if (dealt > 0) { g.audio.play('hit'); g.hitstop(heavy ? 0.08 : 0.045); g.shake(heavy ? 0.18 : 0.08); }
        if (this.bloodPact && dealt > 0) this.hp = Math.min(this.maxHp, this.hp + dealt * 0.12);
      }
    }
    if (this.attackT >= 1) {
      if (this.attackQueued && this.stamina > 4) { this.combo++; this.startSwing(this.game.camForward); }
      else { this.attackT = -1; this.combo = 0; }
    }
  }

  cast(id, camForward) {
    const g = this.game, sp = SPELLS[id];
    if (!this.unlocked[id]) { g.ui.toast(`${sp.name} is not yet learned (Stormcaller skill).`); return; }
    if (this.spellCd[id] > 0) return;
    if (this.mana < sp.mana) { g.ui.toast('Not enough mana.'); return; }
    this.mana -= sp.mana; this.spellCd[id] = sp.cd;
    this.anim.cast = 1;
    const hand = new THREE.Vector3(); this.rig.handL.getWorldPosition(hand);
    const aimDir = this.game.aimDirection();
    if (id === 'firebolt') {
      const tgt = this.softTarget(aimDir, 40, 0.25);
      const dir = tgt ? new THREE.Vector3(tgt.pos.x - hand.x, tgt.pos.y + tgt.height * 0.55 - hand.y, tgt.pos.z - hand.z).normalize() : aimDir.clone();
      this.yaw = Math.atan2(dir.x, dir.z);
      const dmg = 32 * this.spellMul * (1 + this.skills.pyro * 0.15);
      const explode = this.skills.pyro >= 3;
      g.combat.shoot({ pos: hand, vel: dir.multiplyScalar(34), owner: 'player', dmg, type: 'fire', size: 1.2, knock: 2, stagger: 0.3,
        explode: explode ? (p) => { g.particles.burst(p.pos.x, p.pos.y, p.pos.z, 30, 0xff7020, 8, 1.6, 0.5, 0); g.audio.play('boom');
          for (const e of g.enemies) if (!e.dead && e.pos.distanceTo(p.pos) < 4.5) e.takeDamage(dmg * 0.45, 'fire', { from: p.pos, knock: 3 }); } : null });
      g.audio.play('fire');
    } else if (id === 'frostnova') {
      const r = 7.5 + this.skills.rime * 1.5;
      g.particles.ring(this.pos.x, this.pos.y + 0.5, this.pos.z, 60, 0x90e0ff, r * 2.4, 1.8, 0.45);
      g.particles.burst(this.pos.x, this.pos.y + 1, this.pos.z, 40, 0xd0f0ff, 8, 1.2, 0.6, -2);
      g.audio.play('frost'); g.shake(0.15);
      for (const e of g.enemies) {
        if (e.dead) continue;
        if (e.pos.distanceTo(this.pos) < r + e.radius) { e.takeDamage((22 + this.skills.rime * 8) * this.spellMul, 'frost', { from: this.pos, knock: 5, stagger: 0.5 }); e.slow = 4 + this.skills.rime; }
      }
    } else if (id === 'lightning') {
      let cur = this.softTarget(aimDir, 26, 0.45) || this.softTarget(aimDir, 14, 1.4);
      const hits = [];
      let from = hand.clone();
      const chains = 3 + Math.max(0, this.skills.storm - 1);
      for (let i = 0; i < chains && cur; i++) {
        hits.push(cur);
        const to = new THREE.Vector3(cur.pos.x, cur.pos.y + cur.height * 0.6, cur.pos.z);
        g.bolt(from, to);
        cur.takeDamage(38 * this.spellMul * Math.pow(0.85, i), 'storm', { from: this.pos, knock: 1, stagger: 0.4 });
        from = to;
        let nxt = null, nd = 12;
        for (const e of g.enemies) { if (e.dead || hits.includes(e)) continue; const d = e.pos.distanceTo(cur.pos); if (d < nd) { nd = d; nxt = e; } }
        cur = nxt;
      }
      if (!hits.length) { const to = hand.clone().addScaledVector(aimDir, 18); g.bolt(hand, to); }
      else this.yaw = Math.atan2(hits[0].pos.x - this.pos.x, hits[0].pos.z - this.pos.z);
      g.audio.play('zap');
    } else if (id === 'ward') {
      this.hp = Math.min(this.maxHp, this.hp + 35 + this.level * 3);
      this.ward = 6;
      g.particles.burst(this.pos.x, this.pos.y + 1, this.pos.z, 40, 0xffe8a0, 4, 1.2, 1, 2);
      g.audio.play('heal');
    }
  }
  drink(kind) {
    const g = this.game;
    if (kind === 'hp') {
      if (this.potions <= 0) return g.ui.toast('No health draughts left.');
      if (this.hp >= this.maxHp) return;
      this.potions--; this.hp = Math.min(this.maxHp, this.hp + 60 + this.level * 4);
      g.particles.burst(this.pos.x, this.pos.y + 1, this.pos.z, 20, 0xff4060, 3, 1, 0.8, 2); g.audio.play('heal');
    } else {
      if (this.manaPotions <= 0) return g.ui.toast('No mana draughts left.');
      this.manaPotions--; this.mana = Math.min(this.maxMana, this.mana + 70);
      g.particles.burst(this.pos.x, this.pos.y + 1, this.pos.z, 20, 0x4080ff, 3, 1, 0.8, 2); g.audio.play('heal');
    }
  }
}
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _m = new THREE.Vector3(), _h = new THREE.Vector3(), _v = new THREE.Vector3();
