// Static 2D colliders (circles and oriented boxes) in a spatial hash.
const CELL = 40;
const grid = new Map();
export const colliders = [];

function key(i, j) { return i * 100003 + j; }

function insert(c, minX, minZ, maxX, maxZ) {
  for (let i = Math.floor(minX / CELL); i <= Math.floor(maxX / CELL); i++)
    for (let j = Math.floor(minZ / CELL); j <= Math.floor(maxZ / CELL); j++) {
      const k = key(i, j);
      let a = grid.get(k); if (!a) grid.set(k, (a = []));
      a.push(c);
    }
  colliders.push(c);
}

export function addCircle(x, z, r, top = Infinity) {
  insert({ t: 0, x, z, r, top }, x - r, z - r, x + r, z + r);
}
// hw/hd half extents in local frame, rot = yaw
export function addBox(x, z, hw, hd, rot = 0, top = Infinity) {
  const R = Math.hypot(hw, hd);
  insert({ t: 1, x, z, hw, hd, c: Math.cos(rot), s: Math.sin(rot), top }, x - R, z - R, x + R, z + R);
}

export function clearColliders() { grid.clear(); colliders.length = 0; }

// Push a circle (pos.x, pos.z, radius) out of colliders. y = feet height (colliders with top below feet are ignored)
export function resolve(pos, radius, y = -Infinity) {
  const i = Math.floor(pos.x / CELL), j = Math.floor(pos.z / CELL);
  let hit = false;
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
    const a = grid.get(key(i + di, j + dj));
    if (!a) continue;
    for (const c of a) {
      if (y > c.top) continue;
      if (c.t === 0) {
        const dx = pos.x - c.x, dz = pos.z - c.z;
        const d = Math.hypot(dx, dz), m = c.r + radius;
        if (d < m && d > 1e-6) { pos.x = c.x + (dx / d) * m; pos.z = c.z + (dz / d) * m; hit = true; }
      } else {
        // to local
        const dx = pos.x - c.x, dz = pos.z - c.z;
        const lx = dx * c.c - dz * c.s, lz = dx * c.s + dz * c.c;
        const qx = Math.max(-c.hw, Math.min(c.hw, lx)), qz = Math.max(-c.hd, Math.min(c.hd, lz));
        let ox = lx - qx, oz = lz - qz;
        const d = Math.hypot(ox, oz);
        let nlx, nlz;
        if (d > 1e-6) {
          if (d >= radius) continue;
          nlx = qx + (ox / d) * radius; nlz = qz + (oz / d) * radius;
        } else {
          // inside: push out on the shallowest axis
          const px = c.hw - Math.abs(lx), pz = c.hd - Math.abs(lz);
          if (px < pz) { nlx = Math.sign(lx || 1) * (c.hw + radius); nlz = lz; }
          else { nlx = lx; nlz = Math.sign(lz || 1) * (c.hd + radius); }
        }
        // back to world (inverse rotation)
        pos.x = c.x + nlx * c.c + nlz * c.s;
        pos.z = c.z - nlx * c.s + nlz * c.c;
        hit = true;
      }
    }
  }
  return hit;
}

// Segment blocked test (for line of sight / projectiles), coarse
export function pointBlocked(x, z, y = -Infinity) {
  const a = grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
  if (!a) return false;
  for (const c of a) {
    if (y > c.top) continue;
    if (c.t === 0) { if (Math.hypot(x - c.x, z - c.z) < c.r) return true; }
    else {
      const dx = x - c.x, dz = z - c.z;
      const lx = dx * c.c - dz * c.s, lz = dx * c.s + dz * c.c;
      if (Math.abs(lx) < c.hw && Math.abs(lz) < c.hd) return true;
    }
  }
  return false;
}
