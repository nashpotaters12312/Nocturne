// Procedural WebAudio: ambient drone, wind, and combat sounds. No assets needed.
export class Audio {
  constructor() { this.ctx = null; this.enabled = true; this.vol = 0.7; }
  init() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.enabled = false; return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.vol; this.master.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.8; this.sfx.connect(this.master);
    this.amb = c.createGain(); this.amb.gain.value = 0.0; this.amb.connect(this.master);
    // noise buffer
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // wind
    const wn = c.createBufferSource(); wn.buffer = this.noise; wn.loop = true;
    const wf = c.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 400; wf.Q.value = 0.6;
    const wg = c.createGain(); wg.gain.value = 0.16;
    wn.connect(wf); wf.connect(wg); wg.connect(this.amb); wn.start();
    this.windFilter = wf;
    // drone chord
    this.droneGain = c.createGain(); this.droneGain.gain.value = 0.06; this.droneGain.connect(this.amb);
    this.drones = [];
    for (const f of [55, 82.4, 110, 130.8]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
      const g = c.createGain(); g.gain.value = 0.25;
      const lfo = c.createOscillator(); lfo.frequency.value = 0.05 + Math.random() * 0.1;
      const lg = c.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
      o.connect(lp); lp.connect(g); g.connect(this.droneGain); o.start();
      this.drones.push(o);
    }
    this.amb.gain.setTargetAtTime(1, c.currentTime, 2);
    this.combat = 0;
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setRegion(id) {
    if (!this.ctx) return;
    const sets = {
      vale: [55, 82.4, 110, 130.8], thornwood: [49, 73.4, 98, 116.5], mirefen: [46.2, 69.3, 92.5, 110],
      gorge: [41.2, 61.7, 82.4, 98], ashen: [51.9, 77.8, 103.8, 123.5], gnash: [43.6, 65.4, 87.3, 103.8],
    };
    const f = sets[id] || sets.vale;
    this.drones.forEach((o, i) => o.frequency.setTargetAtTime(f[i], this.ctx.currentTime, 3));
  }
  setCombat(v) {
    if (!this.ctx) return;
    this.droneGain.gain.setTargetAtTime(0.06 + v * 0.05, this.ctx.currentTime, 1);
    this.windFilter.frequency.setTargetAtTime(400 + v * 300, this.ctx.currentTime, 1);
  }
  _env(node, t, a, peak, dec) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(peak, t + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  noiseHit(freq, q, dur, peak = 0.5, type = 'bandpass', sweep = 0) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    const g = c.createGain(); this._env(g, t, 0.005, peak, dur);
    s.connect(f); f.connect(g); g.connect(this.sfx);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  tone(freq, dur, type = 'sine', peak = 0.3, slide = 1) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    const g = c.createGain(); this._env(g, t, 0.01, peak, dur);
    o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + dur + 0.05);
  }
  play(name) {
    switch (name) {
      case 'swing': this.noiseHit(1800, 1.2, 0.18, 0.25, 'bandpass', 0.4); break;
      case 'hit': this.noiseHit(600, 2, 0.12, 0.6, 'lowpass'); this.tone(120, 0.15, 'square', 0.12, 0.5); break;
      case 'clang': this.tone(1400, 0.4, 'triangle', 0.2, 0.97); this.tone(2100, 0.25, 'sine', 0.12); this.noiseHit(3000, 3, 0.08, 0.3); break;
      case 'parry': this.tone(1800, 0.6, 'triangle', 0.25, 1.02); this.tone(900, 0.5, 'sine', 0.2); break;
      case 'hurt': this.noiseHit(400, 1, 0.2, 0.5, 'lowpass'); this.tone(90, 0.2, 'sawtooth', 0.15, 0.6); break;
      case 'fire': this.noiseHit(500, 0.8, 0.5, 0.35, 'lowpass', 3); this.tone(200, 0.3, 'sawtooth', 0.08, 2); break;
      case 'boom': this.noiseHit(200, 0.7, 0.7, 0.7, 'lowpass', 0.3); this.tone(60, 0.5, 'sine', 0.4, 0.5); break;
      case 'frost': this.noiseHit(4000, 2, 0.6, 0.3, 'highpass'); this.tone(1200, 0.5, 'sine', 0.12, 0.5); break;
      case 'zap': this.noiseHit(2500, 4, 0.25, 0.4); this.tone(880, 0.2, 'square', 0.1, 0.3); break;
      case 'heal': [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.6, 'sine', 0.12), i * 70)); break;
      case 'step': this.noiseHit(300, 1, 0.06, 0.05, 'lowpass'); break;
      case 'death': this.tone(220, 1.2, 'sawtooth', 0.12, 0.3); this.noiseHit(300, 0.5, 1, 0.2, 'lowpass', 0.3); break;
      case 'nemesis': [110, 104, 98].forEach((f, i) => setTimeout(() => { this.tone(f, 1.0, 'sawtooth', 0.15, 0.98); this.tone(f * 1.5, 1.0, 'sawtooth', 0.08); }, i * 300)); this.noiseHit(150, 0.5, 1.5, 0.4, 'lowpass'); break;
      case 'discover': [392, 494, 587, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.9, 'triangle', 0.1), i * 120)); break;
      case 'quest': [330, 440, 554, 660].forEach((f, i) => setTimeout(() => this.tone(f, 0.8, 'sine', 0.12), i * 100)); break;
      case 'level': [262, 330, 392, 523, 659].forEach((f, i) => setTimeout(() => this.tone(f, 0.8, 'triangle', 0.13), i * 90)); break;
      case 'coin': this.tone(1600, 0.12, 'square', 0.06); setTimeout(() => this.tone(2100, 0.2, 'square', 0.06), 60); break;
      case 'roar': this.noiseHit(180, 0.6, 0.9, 0.5, 'lowpass', 0.6); this.tone(70, 0.9, 'sawtooth', 0.2, 0.7); break;
      case 'arrow': this.noiseHit(2600, 2, 0.15, 0.15, 'bandpass', 0.5); break;
      case 'ui': this.tone(660, 0.08, 'sine', 0.08); break;
    }
  }
}
export const audio = new Audio();
