// Main story, side quests and dialogue trees.
import { LOCATIONS } from './data.js';

const L = LOCATIONS;
export const WARDENS = {
  morwen: { name: 'Morwen', title: 'the Bog Witch', loc: 'mirefen', at: { x: L.mirefen.x + 4, z: L.mirefen.z + 22 } },
  malrec: { name: 'Count Malrec', title: 'of Bloodmoon Keep', loc: 'bloodmoon' },
  ilvane: { name: 'Archmage Ilvane', title: 'of the Spire', loc: 'spire', at: { x: L.spire.x, z: L.spire.z + 18 } },
};

export class Story {
  constructor(game) {
    this.game = game;
    this.flags = { intro: false, metBrannoc: false, shards: 0, wardens: { morwen: 'unmet', malrec: 'unmet', ilvane: 'unmet' }, kingState: 'sealed', ending: null, wolves: 0, raidKills: 0, bounties: [] };
    this.quests = {};
    this.tracked = null;
  }
  serialize() { return { flags: this.flags, quests: this.quests, tracked: this.tracked }; }
  load(d) { this.flags = { ...this.flags, ...d.flags }; this.quests = d.quests || {}; this.tracked = d.tracked; }

  // ---------------- quests ----------------
  start(id, q) {
    if (this.quests[id]) return;
    this.quests[id] = { id, state: 'active', ...q };
    this.tracked = id;
    this.game.ui.questBanner('New Quest', q.title);
    this.game.audio.play('quest');
    this.game.save();
  }
  objective(qid, oid, done = true) {
    const q = this.quests[qid];
    if (!q || q.state !== 'active') return;
    const o = q.objectives.find((x) => x.id === oid);
    if (!o || o.done === done) return;
    o.done = done;
    if (done) this.game.ui.toast(`✓ ${o.text}`, 'quest');
    if (q.objectives.every((x) => x.done || x.optional)) this.complete(qid);
  }
  addObjective(qid, o) { const q = this.quests[qid]; if (q && !q.objectives.find((x) => x.id === o.id)) q.objectives.push({ done: false, ...o }); }
  complete(qid) {
    const q = this.quests[qid];
    if (!q || q.state === 'done') return;
    q.state = 'done';
    const r = q.reward || {};
    const p = this.game.player;
    if (r.gold) p.gold += r.gold;
    if (r.xp) p.addXp(r.xp);
    if (r.sp) p.skillPoints += r.sp;
    if (r.potions) p.potions += r.potions;
    this.game.ui.questBanner('Quest Complete', q.title + (r.gold ? `  (+${r.gold} gold)` : '') + (r.sp ? '  (+1 skill point)' : ''));
    this.game.audio.play('level');
    if (this.tracked === qid) this.tracked = Object.values(this.quests).find((x) => x.state === 'active')?.id ?? null;
    if (q.onComplete) this[q.onComplete]?.();
    this.game.save();
  }
  active() { return Object.values(this.quests).filter((q) => q.state === 'active'); }

  markers() {
    const out = [];
    for (const q of this.active()) for (const o of q.objectives) if (!o.done && o.at) out.push({ x: o.at.x, z: o.at.z, label: o.text, main: !!q.main, tracked: q.id === this.tracked });
    return out;
  }

  // ---------------- events ----------------
  onKill(e) {
    const f = this.flags;
    if (e.kind === 'wolf' && this.quests.wolves?.state === 'active') {
      f.wolves++;
      const o = this.quests.wolves.objectives[0];
      o.text = `Slay shadow wolves (${Math.min(6, f.wolves)}/6)`;
      if (f.wolves >= 6) this.objective('wolves', 'kill');
    }
    if (this.quests.raid?.state === 'active' && e.def.faction === 'warband' && Math.hypot(e.pos.x - L.camp_s.x, e.pos.z - L.camp_s.z) < 90) {
      f.raidKills++;
      const o = this.quests.raid.objectives[0];
      o.text = `Kill raiders at the Ashroad Camp (${Math.min(8, f.raidKills)}/8)`;
      if (f.raidKills >= 8) this.objective('raid', 'kill');
    }
    if (e.captain) {
      for (const b of f.bounties) if (b.cid === e.captain.id && !b.done && e.captain.dead) { b.done = true; this.objective(b.qid, 'kill'); }
      if (e.captain.rank === 2 && this.quests.warlord?.state === 'active') this.objective('warlord', 'kill');
    }
    if (e.kind === 'morwen') this.wardenDefeated('morwen');
    if (e.kind === 'malrec') this.wardenDefeated('malrec');
    if (e.kind === 'ilvane') this.wardenDefeated('ilvane');
    if (e.kind === 'king') this.kingDefeated();
  }
  onItem(item) {
    if (item === 'tome' && this.quests.tome?.state === 'active') { this.objective('tome', 'get'); return true; }
    if (item === 'relic' && this.quests.relic?.state === 'active') { this.objective('relic', 'get'); return true; }
    return false;
  }
  onDiscover(key) {
    if (key === 'hollowmere') this.objective('awaken', 'village');
  }

  giveShard(w, spared) {
    const f = this.flags;
    f.wardens[w] = spared ? 'spared' : 'slain';
    f.shards++;
    this.objective('shards', w);
    this.game.ui.questBanner('Moonshard Claimed', `${f.shards} of 3 — ${WARDENS[w].name} ${spared ? 'spared' : 'slain'}`);
    this.game.player.addXp(250);
    this.game.onShard();
    if (f.shards >= 3) this.startFinale();
    this.game.save();
  }
  wardenDefeated(w) {
    if (this.flags.wardens[w] === 'fighting' || this.flags.wardens[w] === 'trial') this.giveShard(w, false);
  }
  startFinale() {
    this.start('finale', { title: 'The Moonless King', main: true, desc: 'All three Moonshards are yours. The seal beneath Ashen Abbey trembles. End this.',
      objectives: [{ id: 'abbey', text: 'Confront the Moonless King at Ashen Abbey', at: { x: L.abbey.x, z: L.abbey.z } }] });
  }
  kingDefeated() {
    this.flags.kingState = 'defeated';
    this.game.ui.dialog(this.endingDialog());
  }
  sparedCount() { return Object.values(this.flags.wardens).filter((s) => s === 'spared').length; }

  // ---------------- dialogues ----------------
  // Dialog node: {speaker, text, choices:[{text, next|action, cond}]} ; tree = {start, nodes}
  aldric() {
    const g = this.game, s = this;
    return { start: 'a', nodes: {
      a: { speaker: 'Ghost of Ser Aldric', text: `Rise, ${g.player.name}. Rise, last of the Order of the Pale Moon. You have slept upon this altar for seven nights while the chapterhouse burned.`,
        choices: [{ text: 'Master Aldric? You... you are dead.', next: 'b' }] },
      b: { speaker: 'Ghost of Ser Aldric', text: 'Dead, yes — but the dead do not rest while two moons hang in the sky. Look up. Beside pale Selun burns Vorr, the Blood Moon. When it rises, the Moonless King stirs beneath Ashen Abbey.',
        choices: [{ text: 'Who is the Moonless King?', next: 'c' }, { text: 'What must I do?', next: 'd' }] },
      c: { speaker: 'Ghost of Ser Aldric', text: 'A tyrant who devoured the third moon an age ago and was sealed in its hollow tomb. His whispers already rot the land: goblins swarm from the Gnashpit, the dead walk the Mirefen, and the lords of this realm bargain with the dark.',
        choices: [{ text: 'What must I do?', next: 'd' }] },
      d: { speaker: 'Ghost of Ser Aldric', text: 'Three Wardens each hold a Moonshard — the keys to the seal. Morwen in the Mirefen to the west. Count Malrec in Bloodmoon Keep to the east. Archmage Ilvane atop the Spire of Vael to the north. All three have fallen from grace, each in their own way.',
        choices: [{ text: 'Then I take the shards by force.', next: 'e' }, { text: 'Perhaps some can still be saved.', next: 'f' }] },
      e: { speaker: 'Ghost of Ser Aldric', text: 'Steel and spell — the Order taught you both. But remember: a shard given freely binds stronger than one torn from a corpse. Choose your path, Spellknight. Go first to Hollowmere, south of here. Elder Brannoc will aid you.',
        choices: [{ text: 'I will not fail you. [Begin]', action: () => s.beginMain() }] },
      f: { speaker: 'Ghost of Ser Aldric', text: 'That is the heart of a true knight. Mercy is a blade too, if wielded wisely. Go first to Hollowmere, south of here. Elder Brannoc will aid you.',
        choices: [{ text: 'I will not fail you. [Begin]', action: () => s.beginMain() }] },
    } };
  }
  beginMain() {
    this.flags.intro = true;
    this.start('awaken', { title: 'The Last Spellknight', main: true, desc: 'Ser Aldric\'s ghost has woken you. Find Elder Brannoc in Hollowmere.',
      objectives: [{ id: 'village', text: 'Travel to Hollowmere', at: { x: L.hollowmere.x, z: L.hollowmere.z } }, { id: 'brannoc', text: 'Speak with Elder Brannoc', at: { x: L.hollowmere.x - 2, z: L.hollowmere.z - 2 } }] });
    this.game.ui.closeDialog();
    this.game.ui.hint('WASD move · Mouse look · LMB attack · RMB block/parry · Q dodge · Space jump · Shift sprint · 1-4 spells · E interact · Tab warband · M map · J journal · K skills');
  }

  npcDialog(npc) {
    const g = this.game, s = this, f = this.flags, p = g.player;
    const loc = npc.loc;
    const rumor = () => {
      const caps = g.warband.alive.filter((c) => c.rank < 2);
      if (!caps.length) return 'The warband is quiet... too quiet.';
      const c = caps[Math.floor(Math.random() * caps.length)];
      c.known = c.known || Math.random() < 0.3;
      const where = LOCATIONS[c.home]?.name ?? 'the wilds';
      return `They say ${c.name} ${c.title} prowls near ${where}. ${c.killsOnPlayer ? 'Folk whisper he has slain a Spellknight before.' : c.memory === 'returned' ? 'Came back from the dead, they say. Twice as mean.' : 'Mind yourself.'}`;
    };
    if (npc.role === 'merchant') {
      return { start: 'a', nodes: { a: { speaker: npc.name, text: `Coin for comfort, ser. Draughts brewed from Mirefen moss — they'll keep the life in you. (You have ${p.gold} gold.)`,
        choices: [
          { text: 'Buy Health Draught (20 gold)', action: () => { if (p.gold >= 20) { p.gold -= 20; p.potions++; g.audio.play('coin'); g.ui.toast('Bought a Health Draught.'); } else g.ui.toast('Not enough gold.'); g.ui.dialog(s.npcDialog(npc)); } },
          { text: 'Buy Mana Draught (20 gold)', action: () => { if (p.gold >= 20) { p.gold -= 20; p.manaPotions++; g.audio.play('coin'); g.ui.toast('Bought a Mana Draught.'); } else g.ui.toast('Not enough gold.'); g.ui.dialog(s.npcDialog(npc)); } },
          { text: 'Heard any rumors?', next: 'r' }, { text: 'Farewell.', action: () => g.ui.closeDialog() }] },
        r: { speaker: npc.name, text: rumor(), choices: [{ text: 'Back', next: 'a' }] } } };
    }
    if (npc.role === 'villager') {
      const lines = [
        'Two moons in the sky and not a wink of sleep in the village.', 'My cousin went into the Mirefen for moss. Came back... wrong.',
        'The lights in the Spire burn all night. The Archmage never sleeps.', 'Goblins took our sheep. Then our dog. Then old Tam.',
        'A Spellknight! I thought your Order was ash and rumor.', 'Don\'t walk the Ashen Vale at night. The red lanterns light themselves.',
      ];
      return { start: 'a', nodes: { a: { speaker: npc.name, text: lines[Math.floor(Math.random() * lines.length)], choices: [{ text: 'Heard anything of the warband?', next: 'r' }, { text: 'Stay safe.', action: () => g.ui.closeDialog() }] },
        r: { speaker: npc.name, text: rumor(), choices: [{ text: 'Thank you.', action: () => g.ui.closeDialog() }] } } };
    }
    // elders / quest givers
    if (loc === 'hollowmere') {
      const n = { start: 'a', nodes: {} };
      if (!f.metBrannoc) {
        n.nodes.a = { speaker: 'Elder Brannoc', text: 'By the old moon... a Spellknight, alive! Aldric sent you, didn\'t he? Then the end is near indeed. The Blood Moon has woken every foul thing in the realm.',
          choices: [{ text: 'Tell me of the Wardens.', next: 'w' }] };
        n.nodes.w = { speaker: 'Elder Brannoc', text: 'Morwen was a healer once — the goblins burned her coven and she went into the bog with her grief. Malrec has ruled Bloodmoon for three hundred years; he wants only to feed. And Ilvane... he climbed the Spire to study the moons and never came down. Each holds a shard. Go in any order you like.',
          choices: [{ text: 'And these goblins?', next: 'g' }] };
        n.nodes.g = { speaker: 'Elder Brannoc', text: 'The Warband of the Gnashpit. Its captains are cunning brutes — and they REMEMBER. Kill one badly and he may crawl back with a grudge. The bounty boards in each village post their names. Interrogate a marked goblin informant and you\'ll learn their weaknesses.',
          choices: [{ text: 'I\'ll deal with them. [Accept: Three Moonshards]', action: () => { f.metBrannoc = true; s.objective('awaken', 'village'); s.objective('awaken', 'brannoc'); s.startShards(); g.ui.dialog(s.npcDialog(npc)); } }] };
      } else {
        n.nodes.a = { speaker: 'Elder Brannoc', text: f.shards >= 3 ? 'You carry all three shards — I can feel the cold of them from here. Ashen Abbey lies south down the old road. May Selun guide you.' : `You have ${f.shards} of 3 shards. The Mirefen lies west, Bloodmoon Keep east through the Crimson Gorge, and the Spire of Vael far north past Greyhallow.`,
          choices: [] };
        if (!this.quests.wolves) n.nodes.a.choices.push({ text: 'Is there anything else I can do here?', next: 'q' });
        else if (this.quests.wolves.state === 'active') n.nodes.a.choices.push({ text: 'About the wolves...', next: 'q2' });
        n.nodes.a.choices.push({ text: 'Any word of the warband?', next: 'r' }, { text: 'Farewell.', action: () => g.ui.closeDialog() });
        n.nodes.q = { speaker: 'Elder Brannoc', text: 'Shadow wolves hunt the vale at night — eyes like lanterns, fur like smoke. They have taken three shepherds this moon. Slay six of them and I\'ll see you paid.',
          choices: [{ text: 'Consider it done. [Accept]', action: () => { s.start('wolves', { title: 'Wolves of the Vale', desc: 'Shadow wolves prowl the forests around Hollowmere.', objectives: [{ id: 'kill', text: 'Slay shadow wolves (0/6)' }], reward: { gold: 80, xp: 150 } }); g.ui.closeDialog(); } }, { text: 'Not now.', next: 'a' }] };
        n.nodes.q2 = { speaker: 'Elder Brannoc', text: 'They gather in the woods to the north and east of the village. Listen for the howling.', choices: [{ text: 'Back', next: 'a' }] };
        n.nodes.r = { speaker: 'Elder Brannoc', text: rumor(), choices: [{ text: 'Back', next: 'a' }] };
      }
      return n;
    }
    const giver = {
      greyhallow: { name: 'Scholar Venn', q: 'tome', title: 'The Hermit\'s Tome', ask: 'The hermit Orsolo kept a tome on the binding of moons in his tower, north-west of here in the Thornwood. Orsolo is dead — wolves, or worse. Bring me that tome and I\'ll teach you something of the arcane.', desc: 'Retrieve Orsolo\'s tome from the Hermit\'s Tower.', obj: 'Take the tome from the Hermit\'s Tower', at: L.tower, reward: { gold: 60, sp: 1, xp: 120 }, hello: 'The Spire\'s light grows brighter every night. Ilvane is doing something terrible up there, I am sure of it.' },
      brackwater: { name: 'Old Marga', q: 'relic', title: 'Relic of the Drowned', ask: 'My grandmother was buried in the Sunken Graveyard, far south-west, with the Lantern of Saint Mira. The wraiths walk there now. Bring the relic home and I\'ll give you every draught I own.', desc: 'Search the mausoleum in the Sunken Graveyard.', obj: 'Search the mausoleum in the Sunken Graveyard', at: L.graveyard, reward: { gold: 40, potions: 3, xp: 120 }, hello: 'Morwen? She healed my boy\'s fever once. Now she sends the drowned to scratch at our doors. Grief rots, ser. Grief rots.' },
      emberfall: { name: 'Smith Hadric', q: 'raid', title: 'Burn the Ashroad Camp', ask: 'The Ashroad Camp sits on the road south-west of us. Raiders strike from it every night. Kill eight of them and the rest will scatter. I\'ll pay well.', desc: 'Kill raiders at the Ashroad Camp.', obj: 'Kill raiders at the Ashroad Camp (0/8)', at: L.camp_s, reward: { gold: 120, xp: 200 }, hello: 'Malrec\'s thralls took my apprentice into the gorge. The Keep is east and north of here, past the Weeping Stones.' },
    }[loc];
    if (!giver) return { start: 'a', nodes: { a: { speaker: npc.name, text: '...', choices: [{ text: 'Farewell', action: () => g.ui.closeDialog() }] } } };
    const q = this.quests[giver.q];
    const nodes = { a: { speaker: giver.name, text: giver.hello, choices: [] } };
    if (!q) nodes.a.choices.push({ text: 'You look troubled.', next: 'q' });
    else if (q.state === 'active') nodes.a.choices.push({ text: 'About your request...', next: 'q2' });
    nodes.a.choices.push({ text: 'Any word of the warband?', next: 'r' }, { text: 'Farewell.', action: () => g.ui.closeDialog() });
    nodes.q = { speaker: giver.name, text: giver.ask, choices: [{ text: 'I\'ll do it. [Accept]', action: () => { s.start(giver.q, { title: giver.title, desc: giver.desc, objectives: [{ id: giver.q === 'raid' ? 'kill' : 'get', text: giver.obj, at: { x: giver.at.x, z: giver.at.z } }], reward: giver.reward }); g.ui.closeDialog(); } }, { text: 'Not now.', next: 'a' }] };
    nodes.q2 = { speaker: giver.name, text: 'Please hurry, ser.', choices: [{ text: 'Back', next: 'a' }] };
    nodes.r = { speaker: giver.name, text: rumor(), choices: [{ text: 'Back', next: 'a' }] };
    return { start: 'a', nodes };
  }
  startShards() {
    this.start('shards', { title: 'Three Moonshards', main: true, desc: 'Claim the Moonshards from the three fallen Wardens — by steel, by spell, or by word.',
      objectives: [
        { id: 'morwen', text: 'Claim Morwen\'s shard in the Mirefen (west)', at: { x: L.mirefen.x, z: L.mirefen.z + 20 } },
        { id: 'malrec', text: 'Claim Malrec\'s shard at Bloodmoon Keep (east)', at: { x: L.bloodmoon.x, z: L.bloodmoon.z } },
        { id: 'ilvane', text: 'Claim Ilvane\'s shard atop the Spire of Vael (north)', at: { x: L.spire.x, z: L.spire.z + 20 } },
      ] });
  }

  wardenDialog(w) {
    const g = this.game, s = this, f = this.flags;
    const fight = (line) => () => { f.wardens[w] = 'fighting'; g.ui.closeDialog(); g.startBoss(w, line); };
    if (w === 'morwen') {
      if (f.wardens.morwen === 'bargain') {
        const done = this.quests.warlord?.state === 'done';
        return { start: 'a', nodes: { a: { speaker: 'Morwen, the Bog Witch', text: done ? 'I smell it on you — the Warlord\'s blood. My sisters can rest. Take the shard, Spellknight, and take my blessing with it. When you face the King, call my name.' : 'The Warlord still sits his throne of teeth in the Gnashpit. Bring me his heart.',
          choices: done ? [{ text: 'Rest well, Morwen. [Receive the shard]', action: () => { g.ui.closeDialog(); g.wardenLeaves('morwen'); s.giveShard('morwen', true); } }] : [{ text: 'It will be done.', action: () => g.ui.closeDialog() }, { text: 'I\'ve changed my mind. Fight me.', action: fight('So be it! The bog will have you!') }] } } };
      }
      return { start: 'a', nodes: {
        a: { speaker: 'Morwen, the Bog Witch', text: 'Another knight come to cut the witch from her swamp? Your Order watched while the Gnashpit goblins burned my sisters alive. Where were your shining spells then?',
          choices: [{ text: 'I am not here to judge you. I need the Moonshard.', next: 'b' }, { text: 'Your dead walk the land. It ends now.', action: fight('Then drown with them!') }] },
        b: { speaker: 'Morwen, the Bog Witch', text: 'The shard... yes, I feel the King pulling at it. Very well. The Warlord who ordered the burning still lives. Bring me the heart of the Warlord of the Gnashpit and the shard is yours.',
          choices: [
            { text: 'Agreed. The Warlord dies. [Bargain]', action: () => { f.wardens.morwen = 'bargain'; s.start('warlord', { title: 'Heart of the Warlord', desc: 'Morwen will give her shard for the heart of the Warlord of the Gnashpit (south-east).', objectives: [{ id: 'kill', text: 'Slay the Warlord in the Gnashpit', at: { x: L.gnashpit.x, z: L.gnashpit.z } }, { id: 'return', text: 'Return to Morwen', at: { x: L.mirefen.x, z: L.mirefen.z + 20 }, optional: true }] }); g.ui.closeDialog(); } },
            { text: 'I have no time for errands. Give it to me.', action: fight('Then take it from my cold hands!') },
          ] },
      } };
    }
    if (w === 'malrec') {
      return { start: 'a', nodes: {
        a: { speaker: 'Count Malrec', text: 'A Spellknight at my door. How deliciously nostalgic. I drank the last of your Order\'s grandmasters in this very courtyard. You want my shard? Everyone wants something from Malrec.',
          choices: [{ text: 'What do you want for it?', next: 'b' }, { text: 'I want you dead, leech.', action: fight('Ahh. Then let us dance!') }] },
        b: { speaker: 'Count Malrec', text: 'Want? I want company in the long night. Drink from my chalice, knight. Take a little of Vorr into your veins. You will strike harder... and thirst a little. The shard is yours, freely given.',
          choices: [
            { text: 'Drink from the chalice. [Blood Pact: +25% sword damage, lifesteal, -20 max HP]', action: () => { g.player.bloodPact = true; g.player.recalc(); f.wardens.malrec = 'spared'; g.ui.closeDialog(); g.ui.toast('The blood of Vorr burns in your veins.', 'nemesis'); g.wardenLeaves('malrec'); s.giveShard('malrec', true); } },
            { text: 'Never. I will take it from your ashes.', action: fight('Delightful. I do so love when they refuse.') },
            { text: 'I need to think on it.', action: () => g.ui.closeDialog() },
          ] },
      } };
    }
    if (w === 'ilvane') {
      return { start: 'a', nodes: {
        a: { speaker: 'Archmage Ilvane', text: 'Do you hear it? The moons are singing. I have spent forty years learning their song. The King is not a tyrant, knight — he is a door. And I mean to open it.',
          choices: [{ text: 'You will damn the whole realm.', next: 'b' }, { text: 'Then I will close that door — with you behind it.', action: fight('Crude. Let the Spire teach you humility!') }] },
        b: { speaker: 'Archmage Ilvane', text: 'Perhaps. Or perhaps your Order merely feared what it could not master. Prove that a Spellknight\'s magic is worth anything, and I will listen. Survive the Trial of the Spire.',
          choices: [
            { text: 'I accept your trial. [Survive three waves]', action: () => { f.wardens.ilvane = 'trialRun'; g.ui.closeDialog(); g.startTrial(); } },
            { text: 'No more games. Fight me yourself.', action: fight('As you wish!') },
          ] },
      } };
    }
  }
  trialDone() {
    const g = this.game;
    g.ui.dialog({ start: 'a', nodes: { a: { speaker: 'Archmage Ilvane', text: 'Remarkable. Steel and starlight in one body... the Order was not wrong about everything. Take the shard. And if the King\'s door must close — I will hold it shut with you.',
      choices: [{ text: 'Thank you, Archmage. [Receive the shard]', action: () => { g.ui.closeDialog(); g.wardenLeaves('ilvane'); this.giveShard('ilvane', true); } }] } } });
  }

  kingDialog() {
    const g = this.game, f = this.flags;
    const choices = [{ text: 'Your reign ended an age ago. Draw your blade.', action: () => { f.kingState = 'fighting'; g.ui.closeDialog(); g.startBoss('king', 'Then I shall wear your bones as my new crown!'); } }];
    if (g.player.bloodPact) choices.push({ text: '[Blood Pact] ...The crown. Give me the crown.', action: () => { g.ui.closeDialog(); this.ending('crown'); } });
    return { start: 'a', nodes: { a: { speaker: 'The Moonless King', text: `Three shards, carried to my very tomb by a knight of the Pale Moon. How fitting. Kneel, ${g.player.name}. Wear the Hollow Crown and rule the endless night beside me. Or refuse... and become my first meal in a thousand years.`, choices } } };
  }
  endingDialog() {
    const g = this.game, spared = this.sparedCount();
    const choices = [];
    if (spared >= 2) choices.push({ text: `Call upon the Wardens you spared (${spared}) to reseal the moon together.`, action: () => { g.ui.closeDialog(); this.ending('dawn'); } });
    choices.push({ text: 'Shatter the three shards — and yourself with them — to end him forever.', action: () => { g.ui.closeDialog(); this.ending('shatter'); } });
    if (g.player.bloodPact) choices.push({ text: '[Blood Pact] Lift the fallen crown from the dust.', action: () => { g.ui.closeDialog(); this.ending('crown'); } });
    return { start: 'a', nodes: { a: { speaker: 'The Moonless King', text: 'No... NO! The shards... you would not dare... the moon will fall without me...', choices } } };
  }
  ending(kind) {
    this.flags.ending = kind;
    const g = this.game;
    const texts = {
      dawn: ['Dawn Restored', 'You raise the three shards and speak the Wardens\' names. Morwen\'s green fire, Ilvane\'s starlight and Malrec\'s red hunger answer from across the realm. The seal closes with a sound like a bell. Vorr, the Blood Moon, dims and drifts away. For the first time in a hundred nights, the sun rises over the Hollow Vale — and a Spellknight watches it, alive.'],
      shatter: ['The Shattered Moon', 'You crush the shards in your gauntlets. Light pours out of you, through you, until there is nothing left but light. The Moonless King screams and is unmade. When the villagers of Hollowmere wake, the Blood Moon is gone... and so is the last Spellknight. They build you a shrine. They light it every night.'],
      crown: ['The Hollow Crown', 'The crown is cold, then warm, then a part of you. The King\'s bones crumble as his power floods into your veins. Vorr blazes overhead, red and full and eternal. The Warband kneels. The dead kneel. Somewhere, the ghost of Ser Aldric weeps. Long live the Moonless King.'],
    };
    const [title, text] = texts[kind];
    g.showEnding(title, text, kind);
    g.save();
  }
}
