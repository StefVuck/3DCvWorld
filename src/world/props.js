import { BoxGeometry, ConeGeometry, Color, Vector3 } from 'three';
import { SURF, at } from './kit.js';
import { mulberry32 } from './valley.js';

const PLASTERS = ['#ffffff', '#f3e7cf', '#efe0c4', '#e8dcc8', '#f2e2c0', '#e6d7bd'];

export function postRail(b, pts, r, color = '#c8b8a0') {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / 2.6));
    for (let k = 0; k <= n; k++) {
      if (k === n && i < pts.length - 2) continue;
      const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      b.beam([x, -0.2, z], [x, 1.15 + (r() - 0.5) * 0.12, z], 0.13, SURF.timber, color);
    }
    for (const y of [0.55, 0.98]) b.beam([ax, y, az], [bx, y + (r() - 0.5) * 0.06, bz], 0.08, SURF.timber, color);
  }
}

export function wattle(b, pts) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const ang = Math.atan2(-(bz - az), bx - ax);
    b.box(len, 0.85, 0.08, (ax + bx) / 2, 0, (az + bz) / 2, SURF.wattle, '#ffffff', ang);
    const n = Math.max(1, Math.round(len / 1.8));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      b.beam([ax + (bx - ax) * t, -0.1, az + (bz - az) * t], [ax + (bx - ax) * t, 1.0, az + (bz - az) * t], 0.07);
    }
  }
}

// A timber-framed house along x, front facing +z, upper floors jettied out front and back
// Window positions that light up at dusk, gathered as houses are built
export const WINDOWS = [];

// A ground storey you can walk into: walls with a doorway, a plank floor and a ceiling, with
// `fill` furnishing the room. Sizes passed to it are the inside of the room.
const WALL = 0.3, DOOR = 1.6, INDOOR = -10000;
export function hollow(b, { L, D, y, h, doorX, surf, colour, fill }) {
  b.box(L, h, WALL, 0, y, -D / 2 + WALL / 2, surf, colour);
  for (const sx of [1, -1]) b.box(WALL, h, D - WALL * 2, sx * (L / 2 - WALL / 2), y, 0, surf, colour);
  const left = doorX - DOOR / 2 + L / 2, right = L / 2 - doorX - DOOR / 2;
  b.box(left, h, WALL, -L / 2 + left / 2, y, D / 2 - WALL / 2, surf, colour);
  b.box(right, h, WALL, L / 2 - right / 2, y, D / 2 - WALL / 2, surf, colour);
  b.box(DOOR, h - 2.35, WALL, doorX, y + 2.35, D / 2 - WALL / 2, surf, colour);
  b.box(DOOR + 0.3, 0.2, WALL + 0.1, doorX, y + 2.25, D / 2 - WALL / 2, SURF.timber);
  const iL = L - WALL * 2, iD = D - WALL * 2;
  const outside = b.groundY;
  b.groundY = INDOOR;
  // Whitewashed on the inside, with the doorway left open
  const lime = '#e2d8c2', fz = iD / 2 - 0.01, dl = doorX - DOOR / 2 + iL / 2, dr = iL / 2 - doorX - DOOR / 2;
  b.box(iL, h, 0.02, 0, y, -fz, SURF.plaster, lime);
  for (const sx of [1, -1]) b.box(0.02, h, iD, sx * (iL / 2 - 0.01), y, 0, SURF.plaster, lime);
  b.box(dl, h, 0.02, -iL / 2 + dl / 2, y, fz, SURF.plaster, lime);
  b.box(dr, h, 0.02, iL / 2 - dr / 2, y, fz, SURF.plaster, lime);
  b.box(DOOR, h - 2.35, 0.02, doorX, y + 2.35, fz, SURF.plaster, lime);
  b.box(iL, 0.05, iD, 0, y - 0.03, 0, SURF.plank, '#8a6a4c');
  b.box(iL, 0.18, iD, 0, y + h - 0.18, 0, SURF.plank, '#6b4f36');
  for (let x = -iL / 2 + 1.2; x < iL / 2; x += 2.2) b.box(0.22, 0.24, iD, x, y + h - 0.42, 0, SURF.timber);
  const lamps = [];
  fill(b, { L: iL, D: iD, y, h, doorX, lamp: (x, z) => {
    b.beam([x, y + h - 0.2, z], [x, y + h - 0.75, z], 0.03, SURF.timber, '#2a2420');
    b.box(0.26, 0.32, 0.26, x, y + h - 1.05, z, SURF.glass);
    lamps.push(new Vector3(x, y + h - 0.9, z).applyMatrix4(b.base));
  } });
  WINDOWS.push(...lamps);
  b.groundY = outside;
}

export function house(b, o = {}) {
  const r = mulberry32(o.seed ?? 1);
  const L = o.L ?? 7, D = o.D ?? 5, floors = o.floors ?? 2, storey = o.storey ?? 2.7, jetty = o.jetty ?? 0.35;
  const roof = o.roof ?? (r() < 0.4 ? 'thatch' : r() < 0.6 ? 'shingle' : 'tile');
  const plaster = o.plaster ?? PLASTERS[Math.floor(r() * PLASTERS.length)];
  const pitch = o.pitch ?? (roof === 'thatch' ? 50 : 45);
  const plinth = 0.4;
  const nw0 = Math.max(1, Math.floor(L / 2.3));
  const doorX = o.doorX ?? -L / 2 + (L / nw0) * (Math.floor(nw0 / 2) + 0.5);
  b.box(L + 0.15, plinth, D + 0.15, 0, 0, 0, SURF.stone);
  let y = plinth, Dz = D;
  for (let f = 0; f < floors; f++) {
    Dz = D + f * jetty * 2;
    const h = f === 0 ? storey - plinth + 0.2 : storey;
    const wallSurf = o.stoneGround && f === 0 ? SURF.stone : SURF.plaster, wallColour = o.stoneGround && f === 0 ? '#ffffff' : plaster;
    const inside = o.interior && f === 0;
    if (inside) hollow(b, { L, D: Dz, y, h, doorX, surf: wallSurf, colour: wallColour, fill: o.interior });
    else b.box(L, h, Dz, 0, y, 0, wallSurf, wallColour);
    if (!(o.stoneGround && f === 0)) {
      for (const face of inside ? [-Dz / 2] : [Dz / 2, -Dz / 2]) b.timberWall(-L / 2, L / 2, y, y + h, face, { spacing: 1.4 + r() * 0.3, braces: r() < 0.7 });
      for (const sx of [1, -1]) b.group(at((sx * L) / 2, 0, 0, (sx * Math.PI) / 2), g => g.timberWall(-Dz / 2, Dz / 2, y, y + h, 0, { spacing: 1.4, braces: false }));
    }
    if (f > 0) b.box(L + 0.1, 0.22, Dz + 0.1, 0, y - 0.1, 0, SURF.timber);
    const nw = Math.max(1, Math.floor(L / 2.3));
    for (let i = 0; i < nw; i++) {
      const x = -L / 2 + (L / nw) * (i + 0.5);
      if (f === 0 && i === Math.floor(nw / 2)) continue;
      for (const side of [1, -1]) {
        if (r() < 0.25) continue;
        b.box(0.75, 0.85, 0.08, x, y + (f === 0 ? 0.9 : 0.8), side * (Dz / 2 + 0.05), SURF.glass);
        if (inside) {
          const outside = b.groundY;
          b.groundY = INDOOR;
          b.box(0.75, 0.85, 0.04, x, y + 0.9, side * (Dz / 2 - WALL - 0.04), SURF.glass);
          b.groundY = outside;
        }
        if (r() < 0.45) WINDOWS.push(new Vector3(x, y + (f === 0 ? 1.32 : 1.22), side * (Dz / 2 + 0.3)).applyMatrix4(b.base));
      }
    }
    y += h;
  }
  // An interior's door stands open, swung back against the wall inside
  if (o.door !== false && o.interior) {
    const outside = b.groundY;
    b.groundY = INDOOR;
    b.box(0.08, 2.1, 1.1, doorX - DOOR / 2 + 0.1, plinth, D / 2 - WALL - 0.6, SURF.plank, '#7a5a40');
    b.groundY = outside;
  }
  else if (o.door !== false) b.box(1.0, 2.0, 0.12, doorX, plinth - 0.05, D / 2 + 0.06, SURF.plank, '#7a5a40');
  const surf = roof === 'thatch' ? SURF.thatch : roof === 'tile' ? SURF.tile : SURF.shingle;
  const ridge = b.gableRoof(L, Dz, y, pitch, 0.45, roof === 'thatch' ? 0.45 : 0.18, surf, '#ffffff', SURF.plaster, plaster);
  if (o.chimney ?? r() < 0.75) {
    const cx = (r() < 0.5 ? -1 : 1) * (L / 2 - 1.1);
    b.box(0.8, ridge + 1.0, 0.8, cx, 0, -Dz * 0.12, SURF.stone);
    o.chimneys?.push(new Vector3(cx, ridge + 1.1, -Dz * 0.12).applyMatrix4(b.base));
  }
  return { ridge, top: y, depth: Dz };
}

// A tower you can climb: hollow stone walls with a doorway, a spiral stair round a central
// pillar, and a walled roof with the stairwell open on one side
export function climbTower(b, { w = 6.5, h = 15 } = {}) {
  const T = 0.6, inner = w / 2 - T, rise = 0.3, steps = Math.round((h + 0.3) / rise), turn = Math.PI / 8;
  b.box(w, h, T, 0, 0, -w / 2 + T / 2, SURF.stone);
  for (const sx of [1, -1]) b.box(T, h, w - T * 2, sx * (w / 2 - T / 2), 0, 0, SURF.stone);
  const side = (w - 1.8) / 2;
  for (const sx of [1, -1]) b.box(side, h, T, sx * (w / 2 - side / 2), 0, w / 2 - T / 2, SURF.stone);
  b.box(1.8, h - 2.5, T, 0, 2.5, w / 2 - T / 2, SURF.stone);
  b.box(2.1, 0.25, T + 0.2, 0, 2.45, w / 2 - T / 2, SURF.stone, '#d8d2c4');
  for (const [dx, dz, rot] of [[0, 1, 0], [0, -1, 0], [1, 0, Math.PI / 2], [-1, 0, Math.PI / 2]]) {
    b.box(w + 0.5, 0.35, 0.25, dx * (w / 2 + 0.12), h * 0.62, dz * (w / 2 + 0.12), SURF.stone, '#d8d2c4', rot);
  }
  for (let i = 0; i < 4; i++) {
    const y = h * (0.3 + i * 0.17);
    b.box(0.25, 1.1, 0.1, (i % 2 ? -1 : 1) * w * 0.15, y, w / 2 + 0.03, SURF.glass);
  }
  const outside = b.groundY;
  b.groundY = INDOOR;
  b.box(inner * 2, 0.06, inner * 2, 0, 0, 0, SURF.stone, '#b8b0a0');
  b.cylinder(0.4, h, 0, 0, 0, SURF.stone, '#c9c2b2', 12);
  // The last treads come up through the open half of the roof (x > 0)
  for (let i = 0; i < steps; i++) {
    const a = Math.PI / 2 - turn / 2 - (steps - 1 - i) * turn;
    b.box(inner - 0.42, rise, 0.78, Math.cos(a) * (0.42 + (inner - 0.42) / 2), i * rise, -Math.sin(a) * (0.42 + (inner - 0.42) / 2), SURF.stone, '#d0c9b9', a);
  }
  WINDOWS.push(new Vector3(-inner + 0.3, h * 0.45, 0).applyMatrix4(b.base), new Vector3(inner - 0.3, h * 0.2, 0).applyMatrix4(b.base));
  b.groundY = outside;
  // The roof: solid over the wall tops and the closed half, open over the stair
  const out = w / 2 + 0.3, hx = -1.5;
  b.box(out + hx, 0.4, out * 2, (-out + hx) / 2, h, 0, SURF.stone, '#d8d2c4');
  b.box(out - inner, 0.4, out * 2, inner + (out - inner) / 2, h, 0, SURF.stone, '#d8d2c4');
  for (const sz of [1, -1]) b.box(inner - hx, 0.4, out - inner, (hx + inner) / 2, h, sz * (inner + (out - inner) / 2), SURF.stone, '#d8d2c4');
  // A landing where the stair comes out, joining it to the roof
  b.box(0.6 - hx, 0.4, inner - 0.6, (hx + 0.6) / 2, h, -(inner + 0.6) / 2, SURF.stone, '#d8d2c4');
  // A parapet too high to step over, with merlons above it
  for (const [dx, dz, rot] of [[0, 1, 0], [0, -1, 0], [1, 0, Math.PI / 2], [-1, 0, Math.PI / 2]]) {
    b.box(out * 2, 1.05, 0.45, dx * (out - 0.22), h + 0.4, dz * (out - 0.22), SURF.stone, '#ffffff', rot);
    const n = Math.max(3, Math.round((out * 2) / 1.3));
    for (let i = 0; i < n; i += 2) {
      const t = -out + ((out * 2) / n) * (i + 0.5);
      b.box((out * 2) / n, 0.6, 0.5, dx ? dx * (out - 0.22) : t, h + 1.45, dz ? dz * (out - 0.22) : t, SURF.stone, '#ffffff', rot);
    }
  }
}

export function stoneTower(b, o = {}) {
  const w = o.w ?? 6, h = o.h ?? 14, roof = o.roof ?? 'crenel';
  if (o.round) b.cylinder(w / 2, h, 0, 0, 0, SURF.stone, '#ffffff', 16);
  else b.box(w, h, w, 0, 0, 0, SURF.stone);
  b.box(w + 0.5, 0.35, w + 0.5, 0, h * 0.62, 0, SURF.stone, '#d8d2c4');
  if (roof === 'crenel') {
    b.box(w + 0.6, 0.4, w + 0.6, 0, h, 0, SURF.stone, '#d8d2c4');
    const n = Math.max(3, Math.round((w + 0.6) / 1.3));
    for (const [dx, dz, rot] of [[0, 1, 0], [0, -1, 0], [1, 0, Math.PI / 2], [-1, 0, Math.PI / 2]]) {
      for (let i = 0; i < n; i += 2) {
        const t = -((w + 0.6) / 2) + ((w + 0.6) / n) * (i + 0.5);
        const x = dx ? dx * (w / 2 + 0.05) : t, z = dz ? dz * (w / 2 + 0.05) : t;
        b.box((w + 0.6) / n, 0.9, 0.55, x, h + 0.4, z, SURF.stone, '#ffffff', rot);
      }
    }
  } else {
    const g = new ConeGeometry(w * (o.round ? 0.62 : 0.78), roof === 'spire' ? w * 2.6 : w * 1.1, o.round ? 16 : 4);
    g.translate(0, (roof === 'spire' ? w * 2.6 : w * 1.1) / 2, 0);
    b.add(g, at(0, h, 0, o.round ? 0 : Math.PI / 4), roof === 'spire' ? SURF.shingle : SURF.tile);
  }
  for (let i = 0; i < 4; i++) {
    const y = h * (0.3 + i * 0.17);
    b.box(0.25, 1.1, 0.1, (i % 2 ? -1 : 1) * w * 0.15, y, w / 2 + 0.03, SURF.glass);
  }
}

export function curtainWall(b, a, c, h = 6, t = 2) {
  const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const ang = Math.atan2(-(c[1] - a[1]), c[0] - a[0]);
  const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
  b.box(len, h, t, mx, -1, mz, SURF.stone, '#ffffff', ang);
  const n = Math.round(len / 1.4);
  const ux = (c[0] - a[0]) / len, uz = (c[1] - a[1]) / len;
  for (let i = 0; i < n; i += 2) {
    const s = -len / 2 + (len / n) * (i + 0.5);
    for (const side of [1, -1]) {
      const ox = -uz * side * (t / 2 - 0.25), oz = ux * side * (t / 2 - 0.25);
      b.box(len / n, 0.85, 0.45, mx + ux * s + ox, h - 1, mz + uz * s + oz, SURF.stone, '#ffffff', ang);
    }
  }
}

export function tent(b, x, z, r, h, a, c) {
  b.stripedCylinder(r, h * 0.42, x, 0, z, a, c, 14);
  b.stripedCone(r * 1.12, h * 0.6, x, h * 0.4, z, a, c, 14);
  b.beam([x, h * 0.95, z], [x, h + 1.4, z], 0.08);
  return [x, h + 1.4, z];
}

export function stall(b, x, z, ry, a, c, r, n = 6) {
  b.group(at(x, 0, z, ry), s => {
    const w = 4, d = 2.4;
    for (const [px, pz, ph] of [[-w / 2, d / 2, 2.4], [w / 2, d / 2, 2.4], [-w / 2, -d / 2, 2.9], [w / 2, -d / 2, 2.9]]) s.beam([px, 0, pz], [px, ph, pz], 0.12);
    s.box(w, 0.9, 0.6, 0, 0, d / 2 - 0.2, SURF.plank);
    s.stripedBox(w + 0.5, 0.06, d + 0.8, 0, 2.6, 0.1, a, c, 0.5, 0, 0.22);
    s.box(w, 1.6, 0.05, 0, 0.9, -d / 2, SURF.cloth, a);
    const wares = ['#c4473a', '#e2b54a', '#6d8f3e', '#8a5a3a', '#d9cbb0', '#5a6f9a'];
    const rows = Math.ceil(n / 6);
    if (rows > 1) s.box(w, 0.35, 0.5, 0, 0.9, d / 2 - 0.75, SURF.plank);
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / 6), inRow = Math.min(6, n - row * 6);
      const wx = -w / 2 + (w / inRow) * ((i % 6) + 0.5);
      const y = 0.9 + row * 0.35, wz = d / 2 - 0.2 - row * 0.55;
      if (r() < 0.5) s.blob(0.22, wx, y + 0.15, wz, SURF.flat, wares[Math.floor(r() * wares.length)], [1, 0.7, 1], 1);
      else s.box(0.45, 0.3, 0.4, wx, y, wz, SURF.cloth, wares[Math.floor(r() * wares.length)]);
    }
    for (let i = 0; i < 3; i++) barrel(s, -w / 2 + 0.5 + i * 0.9 + r() * 0.3, 0, -d / 2 - 0.6 - r() * 0.4);
    crate(s, w / 2 + 0.6, 0, d / 2 - 0.3, r() * 0.5);
  });
}

export function barrel(b, x, y, z) {
  b.cylinder(0.32, 0.85, x, y, z, SURF.plank, '#8a6648', 10);
  b.cylinder(0.335, 0.06, x, y + 0.15, z, SURF.flat, '#3a3530', 10);
  b.cylinder(0.335, 0.06, x, y + 0.65, z, SURF.flat, '#3a3530', 10);
}

export function crate(b, x, y, z, ry = 0) {
  b.box(0.7, 0.6, 0.7, x, y, z, SURF.plank, '#9a7a56', ry);
}

export function boat(b, x, y, z, ry, len, color = '#6b4f36', mast = false, sail = '#e9dfc8') {
  const g = new BoxGeometry(len, 0.9, len * 0.3, 10, 2, 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getX(i) / (len / 2);
    let zz = p.getZ(i) * Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(t), 2.4)));
    let yy = p.getY(i);
    if (yy < 0) zz *= 0.45;
    if (yy > 0) yy += 0.35 * t * t;
    p.setXYZ(i, p.getX(i), yy, zz);
  }
  g.translate(0, 0.25, 0);
  b.group(at(x, y + 0.45, z, ry), s => {
    s.add(g, at(0, 0, 0), SURF.plank, color);
    s.box(len * 0.75, 0.05, len * 0.22, 0, 0.62, 0, SURF.plank, '#5a4430');
    if (mast) {
      const mh = len * 0.8;
      s.beam([len * 0.05, 0.6, 0], [len * 0.05, 0.6 + mh, 0], 0.14);
      s.beam([len * 0.05 + 0.12, 0.6 + mh * 0.92, -len * 0.18], [len * 0.05 + 0.12, 0.6 + mh * 0.92, len * 0.18], 0.09);
      s.box(0.04, mh * 0.55, len * 0.34, len * 0.05 + 0.16, 0.6 + mh * 0.36, 0, SURF.cloth, sail, 0, 0, 0.04);
    }
  });
}

export function scaffold(b, L, D, H) {
  const xs = [], zs = [];
  for (let x = -L / 2; x <= L / 2 + 0.01; x += L / Math.round(L / 2)) xs.push(x);
  for (let z = -D / 2; z <= D / 2 + 0.01; z += D / Math.round(D / 2)) zs.push(z);
  const ring = [...xs.map(x => [x, -D / 2 - 1]), ...xs.map(x => [x, D / 2 + 1]), ...zs.map(z => [-L / 2 - 1, z]), ...zs.map(z => [L / 2 + 1, z])];
  for (const [x, z] of ring) b.beam([x, 0, z], [x, H, z], 0.1, SURF.flat, '#a08868');
  for (let y = 1.8; y < H; y += 1.8) {
    b.beam([-L / 2 - 1, y, -D / 2 - 1], [L / 2 + 1, y, -D / 2 - 1], 0.08, SURF.flat, '#a08868');
    b.beam([-L / 2 - 1, y, D / 2 + 1], [L / 2 + 1, y, D / 2 + 1], 0.08, SURF.flat, '#a08868');
    b.beam([-L / 2 - 1, y, -D / 2 - 1], [-L / 2 - 1, y, D / 2 + 1], 0.08, SURF.flat, '#a08868');
    b.beam([L / 2 + 1, y, -D / 2 - 1], [L / 2 + 1, y, D / 2 + 1], 0.08, SURF.flat, '#a08868');
    b.box(L + 2, 0.06, 0.7, 0, y, D / 2 + 1, SURF.plank);
  }
  b.beam([-L / 2 - 1, 0, D / 2 + 1], [L / 2 + 1, H * 0.9, D / 2 + 1], 0.07, SURF.flat, '#a08868');
}

export function dovecote(b) {
  b.cylinder(2.2, 5.5, 0, 0, 0, SURF.stone, '#ffffff', 16);
  const g = new ConeGeometry(2.7, 3.2, 16);
  g.translate(0, 1.6, 0);
  b.add(g, at(0, 5.5, 0), SURF.tile);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2, y = 3.2 + (i % 2) * 0.9;
    b.box(0.3, 0.3, 0.1, Math.cos(a) * 2.21, y, Math.sin(a) * 2.21, SURF.flat, '#1c1915', -a + Math.PI / 2);
  }
  b.box(0.9, 1.9, 0.1, 0, 0, 2.2, SURF.plank, '#6b5038');
}

export function marketCross(b) {
  for (let i = 0; i < 3; i++) b.cylinder(2.6 - i * 0.7, 0.35, 0, i * 0.35, 0, SURF.stone, '#ffffff', 8);
  b.cylinder(0.22, 4.2, 0, 1.05, 0, SURF.stone, '#e0d9c8', 8);
  b.box(1.0, 0.25, 0.25, 0, 4.6, 0, SURF.stone, '#e0d9c8');
  b.box(0.25, 0.9, 0.25, 0, 4.3, 0, SURF.stone, '#e0d9c8');
}

export function sheep(b, x, z, ry, r) {
  const wool = new Color('#eee6d4').lerp(new Color('#d9cdb4'), r());
  b.group(at(x, 0, z, ry), s => {
    for (const [dx, dy, dz, sc] of [[0, 0.62, 0, 0.42], [0.25, 0.68, 0.05, 0.3], [-0.26, 0.64, -0.04, 0.32], [0.05, 0.78, -0.12, 0.28], [-0.1, 0.74, 0.14, 0.27]]) {
      s.blob(sc, dx, dy, dz, SURF.flat, wool, [1.25, 0.9, 1], 1);
    }
    const grazing = r() < 0.5;
    s.blob(1, 0.6, grazing ? 0.3 : 0.72, 0, SURF.flat, '#2e2622', [0.17, 0.14, 0.12], 1, 0, 0, grazing ? -0.9 : -0.2);
    s.blob(1, 0.52, grazing ? 0.42 : 0.82, 0, SURF.flat, wool, [0.12, 0.1, 0.13], 1);
    for (const [lx, lz] of [[0.3, 0.16], [0.3, -0.16], [-0.3, 0.16], [-0.3, -0.16]]) s.cylinder(0.045, 0.42, lx, 0, lz, SURF.flat, '#2e2622', 5);
  });
}

export function chicken(b, x, z, ry, r) {
  const body = r() < 0.5 ? '#8a5a32' : r() < 0.5 ? '#e8dfcc' : '#3a302a';
  b.group(at(x, 0, z, ry), s => {
    s.blob(1, 0, 0.28, 0, SURF.flat, body, [0.17, 0.14, 0.12], 1);
    s.blob(1, 0.13, 0.42, 0, SURF.flat, body, [0.07, 0.08, 0.07], 1);
    s.blob(1, 0.15, 0.5, 0, SURF.flat, '#b8322a', [0.035, 0.04, 0.02], 0);
    s.blob(1, 0.21, 0.42, 0, SURF.flat, '#d9a23a', [0.04, 0.02, 0.02], 0);
    s.blob(1, -0.16, 0.36, 0, SURF.flat, body, [0.07, 0.1, 0.05], 1, 0, 0, 0.6);
    for (const lz of [0.04, -0.04]) s.cylinder(0.012, 0.18, 0, 0, lz, SURF.flat, '#d9a23a', 4);
  });
}

export function cow(b, x, z, ry, r) {
  const hide = r() < 0.5 ? '#7a4a2e' : '#d8cdb8';
  b.group(at(x, 0, z, ry), s => {
    s.blob(1, 0, 1.0, 0, SURF.flat, hide, [0.95, 0.45, 0.42], 1);
    s.blob(1, 0.95, 1.05, 0, SURF.flat, hide, [0.26, 0.22, 0.2], 1, 0, 0, -0.3);
    s.blob(1, 1.2, 0.92, 0, SURF.flat, '#3a2a22', [0.13, 0.12, 0.14], 1);
    for (const [lx, lz] of [[0.6, 0.22], [0.6, -0.22], [-0.6, 0.22], [-0.6, -0.22]]) s.cylinder(0.08, 0.75, lx, 0, lz, SURF.flat, hide, 6);
    s.beam([-0.9, 1.1, 0], [-1.05, 0.5, 0], 0.05, SURF.flat, hide);
  });
}
