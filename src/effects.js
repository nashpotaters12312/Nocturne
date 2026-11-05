// GPU-light particle system (additive glow points) + ambient wisps.
import * as THREE from 'three';
import { GLOW_TEX } from './sky.js';

const vert = /* glsl */`
attribute float aSize; attribute vec4 aColor;
varying vec4 vColor;
void main(){
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (300.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const frag = /* glsl */`
uniform sampler2D uTex; varying vec4 vColor;
void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vColor.rgb * t.a * vColor.a, 1.0) * t.a; }`;

export class Particles {
  constructor(scene, max = 3000) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.base = new Float32Array(max * 4); // r,g,b,size
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.n = 0; this.cursor = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    const m = new THREE.ShaderMaterial({ uniforms: { uTex: { value: GLOW_TEX } }, vertexShader: vert, fragmentShader: frag,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }
  emit(x, y, z, vx, vy, vz, color, size, life, grav = 0, drag = 0) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    const c = typeof color === 'number' ? _c.setHex(color) : color;
    this.base[i * 4] = c.r * 2; this.base[i * 4 + 1] = c.g * 2; this.base[i * 4 + 2] = c.b * 2; this.base[i * 4 + 3] = size;
    this.life[i] = life; this.maxLife[i] = life; this.grav[i] = grav; this.drag[i] = drag;
  }
  burst(x, y, z, n, color, speed = 4, size = 1, life = 0.6, grav = -4) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.emit(x, y, z, Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s + speed * 0.3, Math.sin(a) * Math.cos(b) * s, color, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.8), grav, 1.5);
    }
  }
  ring(x, y, z, n, color, speed, size = 1.2, life = 0.6) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      this.emit(x, y, z, Math.cos(a) * speed, 0.3, Math.sin(a) * speed, color, size, life, 0, 1);
    }
  }
  update(dt) {
    const P = this.pos, V = this.vel;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.size[i] = 0; continue; }
      this.life[i] -= dt;
      const t = Math.max(0, this.life[i] / this.maxLife[i]);
      const dr = Math.max(0, 1 - this.drag[i] * dt);
      V[i * 3] *= dr; V[i * 3 + 2] *= dr; V[i * 3 + 1] = V[i * 3 + 1] * dr + this.grav[i] * dt;
      P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
      this.col[i * 4] = this.base[i * 4]; this.col[i * 4 + 1] = this.base[i * 4 + 1]; this.col[i * 4 + 2] = this.base[i * 4 + 2];
      this.col[i * 4 + 3] = Math.min(1, t * 2.5);
      this.size[i] = this.base[i * 4 + 3] * (0.4 + 0.6 * t);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
  }
}
const _c = new THREE.Color();

// Floating wisps / fireflies around the player, colour by region.
export class Wisps {
  constructor(scene, n = 160) {
    this.n = n;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 4), size = new Float32Array(n);
    this.seed = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { this.seed.set([Math.random() * 100, Math.random() * 100, Math.random() * 6, 0.5 + Math.random()], i * 4); size[i] = 0.5 + Math.random() * 0.7; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 4));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    this.geo = g;
    const m = new THREE.ShaderMaterial({ uniforms: { uTex: { value: GLOW_TEX } }, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false;
    scene.add(this.points);
    this.color = new THREE.Color(0.5, 1.0, 0.7);
    this.density = 1;
  }
  update(t, center, heightFn) {
    const P = this.geo.attributes.position.array, C = this.geo.attributes.aColor.array;
    const R = 60;
    for (let i = 0; i < this.n; i++) {
      const sx = this.seed[i * 4], sz = this.seed[i * 4 + 1], ph = this.seed[i * 4 + 2], sp = this.seed[i * 4 + 3];
      // wrap positions in a box around the player
      let x = ((sx * 37.1 + t * 0.6 * sp) % (2 * R)) - R + center.x;
      let z = ((sz * 41.7 + Math.sin(t * 0.3 + ph) * 3) % (2 * R)) - R + center.z;
      x = center.x + ((((x - center.x) + R) % (2 * R) + 2 * R) % (2 * R)) - R;
      z = center.z + ((((z - center.z) + R) % (2 * R) + 2 * R) % (2 * R)) - R;
      const y = Math.max(heightFn(x, z), 0) + 1 + ((ph * 1.3) % 4) + Math.sin(t * sp + ph) * 0.6;
      P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
      const a = (0.5 + 0.5 * Math.sin(t * 2.2 * sp + ph * 3)) * (i / this.n < this.density ? 1 : 0);
      C[i * 4] = this.color.r; C[i * 4 + 1] = this.color.g; C[i * 4 + 2] = this.color.b; C[i * 4 + 3] = a;
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.aColor.needsUpdate = true;
  }
}
