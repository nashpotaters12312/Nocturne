// Night sky: gradient dome with drifting clouds, stars, a pale crescent moon and the blood moon.
import * as THREE from 'three';

const MOON_DIST = 900;
const skyVert = /* glsl */`
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const skyFrag = /* glsl */`
uniform float uTime;
uniform vec3 uZenith, uHorizon, uBand, uMoonDir, uBloodDir, uTint;
uniform float uBlood, uMoonGlow;
varying vec3 vDir;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*noise(p); p*=2.03; a*=0.5; } return s; }
void main(){
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.2, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(max(h, 0.0), 0.55));
  col += uBand * exp(-abs(h - 0.08) * 9.0) * 0.6;
  // moon halos
  float m1 = max(dot(d, uMoonDir), 0.0);
  float m2 = max(dot(d, uBloodDir), 0.0);
  col += vec3(0.62, 0.74, 1.0) * pow(m1, 120.0) * 0.55 * uMoonGlow + vec3(0.30, 0.42, 0.85) * pow(m1, 14.0) * 0.20 * uMoonGlow;
  col += vec3(0.95, 0.15, 0.18) * pow(m2, 100.0) * 0.5 * uBlood + vec3(0.55, 0.06, 0.14) * pow(m2, 10.0) * 0.18 * uBlood;
  // clouds
  vec2 uv = d.xz / (d.y + 0.25) * 1.2;
  float c = fbm(uv * 1.3 + vec2(uTime * 0.004, uTime * 0.002));
  float c2 = fbm(uv * 3.1 - vec2(uTime * 0.006, 0.0));
  float cloud = smoothstep(0.45, 0.85, c * 0.75 + c2 * 0.35);
  vec3 cloudCol = mix(vec3(0.03, 0.04, 0.10), vec3(0.18, 0.22, 0.48), smoothstep(0.4, 1.0, c2));
  cloudCol += vec3(0.35, 0.42, 0.70) * pow(m1, 10.0) * 0.6 * uMoonGlow + vec3(0.5,0.1,0.2) * pow(m2, 5.0) * 0.5 * uBlood;
  col = mix(col, cloudCol, cloud * smoothstep(-0.02, 0.15, d.y) * 0.85);
  col *= uTint;
  gl_FragColor = vec4(col, 1.0);
}`;

function moonTexture(kind) {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, S, S);
  const R = S * 0.42;
  if (kind === 'crescent') {
    const cg = g.createRadialGradient(S / 2 - R * 0.3, S / 2 - R * 0.3, R * 0.1, S / 2, S / 2, R);
    cg.addColorStop(0, '#f4f7ff'); cg.addColorStop(0.6, '#c3d2f5'); cg.addColorStop(1, '#8aa0d8');
    g.fillStyle = cg;
    g.beginPath(); g.arc(S / 2, S / 2, R, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.arc(S / 2 + R * 0.45, S / 2 - R * 0.2, R * 0.95, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'source-over';
  } else {
    const grd = g.createRadialGradient(S / 2 - 20, S / 2 - 20, 10, S / 2, S / 2, R);
    grd.addColorStop(0, '#ff8a8a'); grd.addColorStop(0.55, '#c8283c'); grd.addColorStop(1, '#6e0f26');
    g.fillStyle = grd; g.beginPath(); g.arc(S / 2, S / 2, R, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 0.25; g.fillStyle = '#601030';
    for (let i = 0; i < 26; i++) { const a = Math.random() * 6.28, r = Math.random() * R * 0.8; g.beginPath(); g.arc(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r, 4 + Math.random() * 16, 0, 6.28); g.fill(); }
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function glowTexture() {
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(cv);
}
export const GLOW_TEX = glowTexture();

export class Sky {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.moonDir = new THREE.Vector3(-0.35, 0.55, -0.75).normalize();
    this.bloodDir = new THREE.Vector3(0.7, 0.35, -0.2).normalize();
    this.uniforms = {
      uTime: { value: 0 }, uZenith: { value: new THREE.Color(0x02040f) }, uHorizon: { value: new THREE.Color(0x1a2a6a) },
      uBand: { value: new THREE.Color(0x3048a8) }, uMoonDir: { value: this.moonDir }, uBloodDir: { value: this.bloodDir },
      uBlood: { value: 1 }, uMoonGlow: { value: 1 }, uTint: { value: new THREE.Color(1, 1, 1) },
    };
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false, fog: false,
    }));
    dome.scale.setScalar(2000);
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    this.group.add(dome);
    // stars
    const N = 3500, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const u = Math.random(), v = Math.random() * 0.95;
      const th = u * Math.PI * 2, ph = Math.acos(1 - v);
      const d = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
      pos.set([d.x * 1800, d.y * 1800, d.z * 1800], i * 3);
      const b = 0.5 + Math.random() * 1.5 * (Math.random() < 0.05 ? 2 : 1);
      col.set([b * 0.85, b * 0.9, b * 1.1], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, depthWrite: false, toneMapped: false }));
    this.stars.renderOrder = -9;
    this.group.add(this.stars);
    // bright twinkling stars with glow
    this.bigStars = [];
    for (let i = 0; i < 12; i++) {
      const d = new THREE.Vector3(Math.random() - 0.5, 0.3 + Math.random() * 0.7, Math.random() - 0.5).normalize();
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: new THREE.Color(0.8, 0.9, 1.6), fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, toneMapped: false }));
      s.position.copy(d.multiplyScalar(1700)); s.scale.setScalar(18 + Math.random() * 20); s.userData.ph = Math.random() * 10;
      this.group.add(s); this.bigStars.push(s);
    }
    // moons
    const mk = (tex, dir, size, glowCol, glowSize) => {
      const g = new THREE.Group();
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: glowCol, fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, toneMapped: false }));
      halo.scale.setScalar(glowSize);
      const disc = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, fog: false, depthWrite: false, transparent: true, toneMapped: false, color: new THREE.Color(1.1, 1.1, 1.1) }));
      disc.scale.setScalar(size);
      g.add(halo); g.add(disc);
      g.position.copy(dir).multiplyScalar(MOON_DIST);
      g.userData = { halo, disc, size, glowSize, base: halo.material.color.clone(), phase: Math.random() * 10 };
      this.group.add(g);
      return g;
    };
    // Closer (900 vs 1600) and smaller (~45% of the old apparent size).
    this.moon = mk(moonTexture('crescent'), this.moonDir, 50, new THREE.Color(0.45, 0.6, 1.15), 190);
    this.bloodMoon = mk(moonTexture('blood'), this.bloodDir, 42, new THREE.Color(1.0, 0.15, 0.22), 160);
    this.flash = 0; // decaying 0..1 energy added by pulse()
    this.look = 0;  // smoothed 0..1 "player is looking at the moon"
  }
  /** Trigger a reactive flare (spell cast, boss hit, shard pickup...). amount ~0..1. */
  pulse(amount = 0.5) { this.flash = Math.min(1.5, this.flash + amount); }
  update(t, camPos, regionTint, camDir) {
    const dt = this._t === undefined ? 0 : Math.min(0.1, Math.max(0, t - this._t)); this._t = t;
    this.group.position.copy(camPos);
    this.uniforms.uTime.value = t;
    // reactivity: glow swells when looking toward a moon, flares decay, halos breathe
    const aim = camDir ? Math.max(this.moonDir.dot(camDir), this.bloodDir.dot(camDir) * this.uniforms.uBlood.value) : 0;
    const target = Math.pow(Math.max(0, aim), 4);
    this.look += (target - this.look) * Math.min(1, dt * 4);
    this.flash *= Math.exp(-dt * 2.2);
    const energy = this.look * 0.6 + this.flash;
    this.uniforms.uMoonGlow.value = 1 + energy * 0.9;
    for (const m of [this.moon, this.bloodMoon]) {
      const u = m.userData, breath = 1 + Math.sin(t * 1.3 + u.phase) * 0.06 + Math.sin(t * 3.1 + u.phase * 2) * 0.02;
      u.halo.scale.setScalar(u.glowSize * breath * (1 + energy * 0.5));
      u.disc.scale.setScalar(u.size * (1 + this.flash * 0.12));
      u.halo.material.color.copy(u.base).multiplyScalar(1 + energy * 0.7);
      m.position.y = (m === this.moon ? this.moonDir : this.bloodDir).y * MOON_DIST + Math.sin(t * 0.4 + u.phase) * 3;
    }
    for (const s of this.bigStars) s.material.opacity = 0.6 + Math.sin(t * 2 + s.userData.ph) * 0.4;
    if (regionTint) this.uniforms.uTint.value.copy(regionTint);
  }
  setBlood(v) {
    this.uniforms.uBlood.value = v;
    this.bloodMoon.visible = v > 0.02;
    this.bloodMoon.children.forEach((c) => (c.material.opacity = v));
  }
}
