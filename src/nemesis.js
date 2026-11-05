// The Warband of the Gnashpit — a living hierarchy of named captains that remember you.
import { mulberry32, pick } from './util.js';
import { LOCATIONS } from './data.js';

export const TRAITS = {
  // strengths
  fireproof: { name: 'Fireproof', desc: 'Immune to fire', good: true },
  frostborn: { name: 'Frostborn', desc: 'Immune to frost', good: true },
  stormward: { name: 'Storm-Warded', desc: 'Immune to lightning', good: true },
  ironhide: { name: 'Iron Hide', desc: 'Your blade deals half damage', good: true },
  regenerate: { name: 'Regenerating', desc: 'Slowly heals wounds', good: true },
  magic_rage: { name: 'Spell-Hater', desc: 'Enraged when struck by magic', good: true },
  berserker: { name: 'Berserker', desc: 'Frenzies when badly wounded', good: true },
  spearthrower: { name: 'Spear-Thrower', desc: 'Hurls spears from range', good: true },
  warhorn: { name: 'Warhorn', desc: 'Calls goblin reinforcements', good: true },
  unblockable: { name: 'Crusher', desc: 'Blows cannot be blocked', good: true },
  unkillable: { name: 'Unkillable', desc: 'Very likely to cheat death', good: true },
  // weaknesses
  fears_fire: { name: 'Fear of Fire', desc: 'Flees in terror from flame', good: false },
  weak_frost: { name: 'Frost-Weak', desc: 'Takes double frost damage', good: false },
  weak_storm: { name: 'Storm-Weak', desc: 'Takes double lightning damage', good: false },
  weak_blade: { name: 'Thin-Skinned', desc: 'Takes extra blade damage', good: false },
  cowardly: { name: 'Coward', desc: 'Flees when hurt', good: false },
  sluggish: { name: 'Sluggish', desc: 'Moves and swings slowly', good: false },
  parry_weak: { name: 'Off-Balance', desc: 'Staggers badly when parried', good: false },
};
const STRENGTHS = ['fireproof', 'frostborn', 'stormward', 'ironhide', 'regenerate', 'magic_rage', 'berserker', 'spearthrower', 'warhorn', 'unblockable'];
const WEAKNESSES = ['fears_fire', 'weak_frost', 'weak_storm', 'weak_blade', 'cowardly', 'sluggish', 'parry_weak'];
const CONFLICT = { fireproof: 'fears_fire', fears_fire: 'fireproof', frostborn: 'weak_frost', weak_frost: 'frostborn', stormward: 'weak_storm', weak_storm: 'stormward', ironhide: 'weak_blade', weak_blade: 'ironhide' };

const N1 = ['Gash', 'Skarn', 'Vorl', 'Ruk', 'Ghaz', 'Thrak', 'Uzg', 'Krug', 'Zog', 'Snik', 'Drel', 'Muz', 'Yarg', 'Hruk', 'Brak', 'Ogg', 'Narz', 'Grim', 'Skulk', 'Vex', 'Mord', 'Ratch', 'Gub', 'Lurk', 'Kreel', 'Dozz'];
const N2 = ['nak', 'gul', 'rik', 'dush', 'mog', 'gar', 'zag', 'lok', 'ub', 'ish', 'grot', 'nash', 'karr', 'ok', 'ruz', 'ith'];
const EPITHETS = ['the Gutter-King', 'Bone-Licker', 'Rot-Tooth', 'the Bleeder', 'Moon-Eater', 'Iron-Jaw', 'the Skinner', 'Mud-Born',
  'the Hollow', 'Blackfang', 'the Grinning', 'Crow-Feeder', 'the Whisperer', 'Ash-Hand', 'Gristle', 'the Drowner', 'Stone-Gut',
  'the Lantern-Thief', 'Eye-Gouger', 'the Vile', 'Marrow-Sucker', 'Bog-Belly', 'the Howler', 'Nail-Spitter'];
const RANKS = ['Captain', 'Warchief', 'Warlord'];
export const RANK_NAMES = RANKS;

const HOMES = ['camp_n', 'camp_w', 'camp_e', 'camp_s', 'camp_c', 'graveyard', 'standing', 'tower', 'gnashpit'];

export class Warband {
  constructor(seed = Date.now() & 0xffff) {
    this.rng = mulberry32(seed);
    this.captains = [];
    this.nextId = 1;
    this.log = [];
    this.warlordSlain = false;
  }
  serialize() { return { captains: this.captains, nextId: this.nextId, log: this.log.slice(-30), warlordSlain: this.warlordSlain }; }
  static from(data) {
    const w = new Warband(1);
    Object.assign(w, data);
    w.rng = mulberry32((Date.now() & 0xffff) + 7);
    return w;
  }
  addLog(text) { this.log.push({ text, t: Date.now() }); if (this.log.length > 40) this.log.shift(); }

  usedNames() { return new Set(this.captains.map((c) => c.name)); }
  makeCaptain(rank, home, levelBase = 1) {
    const r = this.rng;
    let name; const used = this.usedNames();
    for (let i = 0; i < 30; i++) { name = pick(r, N1) + pick(r, N2); if (!used.has(name)) break; }
    const race = rank === 2 ? 'orc' : r() < 0.7 ? 'orc' : 'goblin';
    const traits = [];
    const nS = 1 + (rank > 0 ? 1 : 0) + (r() < 0.3 ? 1 : 0) + (rank === 2 ? 1 : 0);
    const nW = rank === 2 ? 1 : 1 + (r() < 0.4 ? 1 : 0);
    for (let i = 0; i < nS; i++) this.addTrait({ traits }, pick(r, STRENGTHS));
    for (let i = 0; i < nW; i++) this.addTrait({ traits }, pick(r, WEAKNESSES));
    const c = {
      id: this.nextId++, name, title: pick(r, EPITHETS), rank, race,
      level: Math.max(1, Math.round(levelBase + rank * 4 + r() * 3)),
      traits, home, alive: true, returning: 0, dead: false,
      killsOnPlayer: 0, defeats: 0, encounters: 0, memory: 'new', known: false, seen: false,
      scars: { burnt: false, scarred: false, bandaged: false, frost: false },
      look: {
        skin: pick(r, race === 'orc' ? [0x56603a, 0x4a5a48, 0x6a5a40, 0x3e4a3a, 0x5a4a4a] : [0x4f6a2c, 0x5a7030, 0x6a6a30]),
        armor: pick(r, [0x3a3438, 0x4a3a30, 0x2e3440, 0x503030]), helmet: pick(r, [0x3a3438, 0x5a5048, 0x2a2a30]),
        horns: r() < 0.5, weapon: pick(r, ['axe', 'cleaver', 'club', 'spear', 'greatsword']), cape: r() < 0.4 ? pick(r, [0x5a1010, 0x2a2a2a, 0x3a2a10]) : null,
        scale: race === 'orc' ? 1.25 + rank * 0.15 + r() * 0.1 : 0.95 + rank * 0.1,
      },
    };
    if (c.traits.includes('spearthrower')) c.look.weapon = 'spear';
    this.captains.push(c);
    return c;
  }
  addTrait(c, t) {
    if (c.traits.includes(t)) return false;
    const opp = CONFLICT[t];
    if (opp) { const i = c.traits.indexOf(opp); if (i >= 0) c.traits.splice(i, 1); }
    c.traits.push(t);
    return true;
  }
  generate() {
    this.captains = [];
    const warlord = this.makeCaptain(2, 'gnashpit', 10);
    warlord.title = pick(this.rng, ['the Gnash-King', 'Crown of Teeth', 'the Moon-Hungry']);
    this.makeCaptain(1, 'camp_s', 6);
    this.makeCaptain(1, 'camp_e', 5);
    const homes = ['camp_n', 'camp_w', 'camp_c', 'graveyard', 'standing', 'tower', 'camp_e', 'camp_s'];
    homes.forEach((h, i) => this.makeCaptain(0, h, 1 + (i % 4)));
    this.addLog('The Warband of the Gnashpit musters under the Blood Moon.');
  }
  get alive() { return this.captains.filter((c) => c.alive && !c.dead); }
  warlord() { return this.captains.find((c) => c.rank === 2 && !c.dead); }
  homePos(c) { const L = LOCATIONS[c.home] || LOCATIONS.gnashpit; return { x: L.x, z: L.z }; }

  fullName(c) { return `${c.name} ${c.title}`; }

  // ---------- events -----------
  onKilledPlayer(c) {
    c.killsOnPlayer++;
    c.level += 2 + Math.floor(this.rng() * 2);
    c.memory = 'killed_player';
    const gained = [];
    if (this.rng() < 0.7) { const t = pick(this.rng, STRENGTHS); if (this.addTrait(c, t)) gained.push(t); }
    // shed a weakness sometimes
    if (this.rng() < 0.35) { const w = c.traits.find((t) => !TRAITS[t].good); if (w) c.traits.splice(c.traits.indexOf(w), 1); }
    if (c.killsOnPlayer === 1 && this.rng() < 0.6) c.title = pick(this.rng, ['Knight-Slayer', 'the Spellknight\'s Bane', 'Tin-Cracker', 'Moon-Knight\'s Doom']);
    let promoted = false;
    if (c.rank === 0 && this.captains.filter((x) => x.rank === 1 && !x.dead).length < 3) { c.rank = 1; promoted = true; }
    this.addLog(`${this.fullName(c)} slew the Spellknight${promoted ? ' and was promoted to Warchief' : ''}.`);
    return { promoted, gained };
  }
  onDefeated(c, how, executed) {
    c.defeats++;
    c.encounters++;
    if (executed) {
      c.alive = false; c.dead = true;
      this.addLog(`${this.fullName(c)} was executed by the Spellknight.`);
      if (c.rank === 2) this.warlordSlain = true;
      this.fillVacancies();
      return { died: true };
    }
    const cheat = c.traits.includes('unkillable') ? 0.85 : c.traits.includes('regenerate') ? 0.6 : 0.42;
    if (this.rng() < cheat) {
      c.alive = false; c.returning = 1; c.memory = how === 'fire' ? 'burned' : 'returned';
      c.pendingScar = how;
      this.addLog(`${c.name} fell... but no body was found.`);
      return { died: false, returning: true };
    }
    c.alive = false; c.dead = true;
    this.addLog(`${this.fullName(c)} was slain by the Spellknight.`);
    if (c.rank === 2) this.warlordSlain = true;
    this.fillVacancies();
    return { died: true };
  }
  onFled(c) {
    c.encounters++;
    c.memory = 'fled_from';
    c.level += 1;
    this.addLog(`${c.name} boasts that the Spellknight ran from him.`);
  }
  // called when time passes (player death, resting, periodic)
  advance(playerLevel = 1) {
    const events = [];
    // returnees come back scarred
    for (const c of this.captains) {
      if (c.returning) {
        c.returning = 0; c.alive = true; c.level += 1;
        const how = c.pendingScar;
        if (how === 'fire') { c.scars.burnt = true; if (this.rng() < 0.6) this.addTrait(c, 'fireproof'); else this.addTrait(c, 'fears_fire'); }
        else if (how === 'frost') { c.scars.frost = true; this.addTrait(c, this.rng() < 0.6 ? 'frostborn' : 'weak_frost'); }
        else if (how === 'storm') { c.scars.scarred = true; this.addTrait(c, this.rng() < 0.6 ? 'stormward' : 'weak_storm'); }
        else { c.scars.bandaged = true; if (this.rng() < 0.5) this.addTrait(c, 'ironhide'); }
        if (c.defeats >= 2 && !c.traits.includes('unkillable')) { this.addTrait(c, 'unkillable'); c.title = 'the Unkillable'; }
        events.push(`${c.name} ${c.title} has returned from the dead, scarred and furious.`);
        this.addLog(events[events.length - 1]);
      }
    }
    // power struggle
    const living = this.alive.filter((c) => c.rank < 2);
    if (living.length >= 2 && this.rng() < 0.6) {
      const a = pick(this.rng, living); let b = pick(this.rng, living);
      if (a !== b) {
        const pa = a.level + this.rng() * 6, pb = b.level + this.rng() * 6;
        const [w, l] = pa > pb ? [a, b] : [b, a];
        w.level += 2;
        if (this.rng() < 0.55) { l.alive = false; l.dead = true; events.push(`Power struggle: ${w.name} killed ${l.name} in a duel and took his followers.`); }
        else { events.push(`Power struggle: ${w.name} humiliated ${l.name} in a duel.`); l.level = Math.max(1, l.level - 1); }
        if (w.rank === 0 && this.captains.filter((x) => x.rank === 1 && !x.dead).length < 2) { w.rank = 1; events.push(`${w.name} rises to Warchief.`); }
        this.addLog(events[events.length - 1]);
      }
    }
    // everyone trains a little
    for (const c of this.alive) if (this.rng() < 0.3) c.level += 1;
    this.fillVacancies(playerLevel, events);
    return events;
  }
  fillVacancies(playerLevel = 1, events = []) {
    // ensure there is a warlord
    if (!this.warlord()) {
      const chiefs = this.alive.filter((c) => c.rank === 1).sort((a, b) => b.level - a.level);
      if (chiefs.length) { const c = chiefs[0]; c.rank = 2; c.home = 'gnashpit'; c.level += 2; events.push(`${c.name} ${c.title} seizes the Gnashpit throne as the new Warlord!`); this.addLog(events[events.length - 1]); }
    }
    while (this.alive.filter((c) => c.rank === 1).length < 2) {
      const caps = this.alive.filter((c) => c.rank === 0).sort((a, b) => b.level - a.level);
      if (!caps.length) break;
      caps[0].rank = 1; caps[0].home = pick(this.rng, ['camp_s', 'camp_e']);
      events.push(`${caps[0].name} has been promoted to Warchief.`); this.addLog(events[events.length - 1]);
    }
    const free = HOMES.filter((h) => h !== 'gnashpit' && !this.captains.some((c) => c.home === h && c.alive && !c.dead && c.rank === 0));
    while (this.captains.filter((c) => !c.dead && c.rank === 0).length < 7 && free.length) {
      const h = free.shift();
      const c = this.makeCaptain(0, h, Math.max(1, playerLevel - 1));
      events.push(`A new captain rises: ${c.name} ${c.title}.`); this.addLog(events[events.length - 1]);
    }
    // keep the dead list tidy
    if (this.captains.length > 40) this.captains = this.captains.filter((c) => !c.dead || c.killsOnPlayer > 0).slice(-40);
    return events;
  }

  taunt(c, playerName = 'knight') {
    const r = this.rng;
    const lines = {
      new: [
        `Fresh meat in shiny tin! I'm ${c.name}, and you're dinner.`,
        `A Spellknight? Thought we'd eaten the last of you.`,
        `The Warlord pays in gold for knight-skulls. Yours'll buy me a feast.`,
        `Look at the pretty lights in its hands! Let's snuff 'em.`,
      ],
      killed_player: [
        `Back from the dirt? I'll put you there again, ${playerName}!`,
        `I wear your blood as warpaint now. Come get it back.`,
        `They call me ${c.title} because of YOU. Thanks for that.`,
        `Again? You crawl back like a whipped dog. I love it.`,
      ],
      returned: [
        `You left me for dead, tin-man. Look what you did to my FACE!`,
        `I clawed my way out of the mud for this moment.`,
        `Death spat me back out. Said I had unfinished business. YOU.`,
      ],
      burned: [
        `FIRE! You burned me! Every night I smell my own skin! Now you burn!`,
        `See these scars, mage? Every one of them screams your name.`,
      ],
      fled_from: [
        `Running again? I told the whole warband how you fled from me!`,
        `Ha! The coward knight returns. No running this time.`,
      ],
      defeated: [`Not this time, knight.`],
    };
    let pool = lines[c.memory] || lines.new;
    if (c.rank === 2 && c.memory === 'new') pool = [`You stand in MY pit, Spellknight. Kneel and I'll make it quick.`, `The Moonless King promised me the world. You're just the first course.`];
    return pick(r, pool);
  }
}

export function captainStats(c) {
  const lvl = c.level;
  const base = c.race === 'orc' ? 1 : 0.8;
  return {
    hp: Math.round((140 + lvl * 22 + c.rank * 120) * base),
    dmg: Math.round((12 + lvl * 1.6 + c.rank * 5) * base),
    speed: (c.traits.includes('sluggish') ? 4.2 : 5.6) + c.rank * 0.2,
    xp: 80 + lvl * 15 + c.rank * 120,
  };
}
