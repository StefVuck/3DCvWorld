import { createNoise2D } from 'simplex-noise';
import { STOP_SPECS } from '../journey/config.js';
import { SITE_DEFAULTS, SEA } from '../journey/sites.js';

export function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261110);
const nWarp = createNoise2D(rand);
const nHills = createNoise2D(rand);
const nTerrace = createNoise2D(rand);
const nRidge = createNoise2D(rand);
const nForest = createNoise2D(rand);

export const WORLD = { minX: -10000, maxX: 10000, minZ: -10000, maxZ: 10000 };

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function fbm(n, x, z, oct, freq) {
  let s = 0, a = 1, f = freq, norm = 0;
  for (let i = 0; i < oct; i++) {
    s += a * n(x * f, z * f);
    norm += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / norm;
}

function ridged(x, z) {
  let s = 0, a = 1, f = 0.00042, w = 1;
  for (let i = 0; i < 5; i++) {
    let v = 1 - Math.abs(nRidge(x * f, z * f));
    v *= v;
    v *= w;
    w = clamp(v * 1.6, 0, 1);
    s += v * a;
    a *= 0.5;
    f *= 2.1;
  }
  return s;
}

export const riverX = z =>
  520 * Math.sin(z * 0.00042 + 0.3) + 230 * Math.sin(z * 0.0011 + 2.0) + 90 * Math.sin(z * 0.0029 + 0.7);

export const riverDX = z =>
  520 * 0.00042 * Math.cos(z * 0.00042 + 0.3) + 230 * 0.0011 * Math.cos(z * 0.0011 + 2.0) + 90 * 0.0029 * Math.cos(z * 0.0029 + 0.7);

export const riverWidth = z => 16 + 52 * smooth(-9000, 7000, z);
export const floorHeight = z => 2 + 300 * Math.pow(smooth(7600, -9600, z), 1.8) - 14 * smooth(7400, 9000, z);
export const waterLevel = z => Math.max(floorHeight(z) - 1.2, 0);
export const valleyHalfWidth = z => 650 + 1300 * smooth(-8000, 5000, z);

export function riverDistance(x, z) {
  const dx = riverDX(z);
  return Math.abs(x - riverX(z)) / Math.sqrt(1 + dx * dx);
}

function valleyT(x, z, d) {
  const W = valleyHalfWidth(z);
  const dw = d + 220 * fbm(nWarp, x, z, 3, 0.0005);
  return { W, dw, t: smooth(W * 0.12, W * 1.5, dw) };
}

function terraceMask(x, z, t) {
  return smooth(0.15, 0.5, nTerrace(x * 0.0006, z * 0.0006)) * smooth(0.1, 0.24, t) * (1 - smooth(0.55, 0.75, t));
}

export function forestAt(x, z, h, d, t, tm) {
  const f = fbm(nForest, x + 5000, z - 3000, 4, 0.0011);
  const rw = riverWidth(z);
  return smooth(-0.08, 0.2, f + 0.55 * (t - 0.34)) *
    (1 - tm) *
    (1 - smooth(820, 1050, h)) *
    smooth(rw * 0.5 + 30, rw * 0.5 + 90, d) *
    (1 - smooth(8000, 9200, z));
}

// Settlements sit on levelled shelves. Each site's level is taken from the raw terrain at
// its centre, then blended out over `blend` metres beyond the flat radius `r`.
// The settlements the journey uses, each on its flattened shelf (see src/journey/sites.js)
export const SITES = STOP_SPECS.filter(s => s.place && !SEA.has(s.place)).map(s => ({ blend: 70, lift: 1, r: 50, ...SITE_DEFAULTS[s.place], ...(s.site ?? {}), id: s.place }));
for (const site of SITES) {
  site.x = riverX(site.z) + site.offset;
  site.y = 0;
}

function siteInfluence(x, z) {
  let flat = 0, y = 0, clear = 0;
  for (const s of SITES) {
    const d = Math.hypot(x - s.x, z - s.z);
    const f = 1 - smooth(s.r, s.r + s.blend, d);
    if (f > flat) { flat = f; y = s.y; }
    clear = Math.max(clear, 1 - smooth(s.r + 25, s.r + s.blend + 60, d));
  }
  return { flat, y, clear };
}

export const out = { h: 0, t: 0, terrace: 0, forest: 0, d: 0 };

export function sample(x, z, withForest = true) {
  const d = riverDistance(x, z);
  const { W, dw, t } = valleyT(x, z, d);
  const floor = floorHeight(z);
  const coast = 1 - smooth(7200, 9800, z);

  const ridgeH = 420 - 200 * smooth(-9000, 8000, z);
  let h = floor + ridgeH * Math.pow(t, 1.6) * coast;

  const hills = fbm(nHills, x, z, 5, 0.0011);
  h += 1.0 + 3 * (1 - t) * (hills * 0.5 + 0.5) + (85 * t + 22 * smooth(0.02, 0.25, t)) * hills;

  const m = smooth(W * 1.3, W * 3.0, dw);
  if (m > 0) h += m * (450 + 650 * smooth(4000, -9000, z)) * ridged(x, z) * (0.35 + 0.65 * coast);

  h += 900 * smooth(-7800, -9800, z) * smooth(40, 600, d);

  const tm = terraceMask(x, z, t);
  if (tm > 0) {
    const step = 7;
    const q = h / step;
    const fl = Math.floor(q);
    const th = (fl + smooth(0.78, 1.0, q - fl)) * step;
    h += (th - h) * tm;
  }

  const site = siteInfluence(x, z);
  if (site.flat > 0) h += (site.y - h) * site.flat;

  const water = waterLevel(z);
  const rw = riverWidth(z);
  const bank = smooth(rw * 0.5 + 2, rw * 0.5 + 24, d);
  h = (water - 3) + (h - (water - 3)) * bank;

  out.h = h;
  out.t = t;
  out.terrace = tm;
  out.d = d;
  out.forest = withForest ? forestAt(x, z, h, d, t, tm) * (1 - site.clear) : 0;
  return out;
}

for (const site of SITES) {
  const saved = site.r;
  site.r = -1e9;
  site.y = sample(site.x, site.z, false).h + site.lift;
  site.r = saved;
}

export const siteClear = (x, z) => siteInfluence(x, z).clear;

export const heightAt = (x, z) => sample(x, z, false).h;

export function forestOnly(x, z, hApprox) {
  const d = riverDistance(x, z);
  const { t } = valleyT(x, z, d);
  const tm = terraceMask(x, z, t);
  return forestAt(x, z, hApprox, d, t, tm) * (1 - siteInfluence(x, z).clear);
}

// Field layout. Mirrored exactly in GLSL (see shaders/common.js) so hedgerow and orchard
// trees placed here line up with the field patterns painted by the terrain shader.
export const FIELD = { sx: 95, sz: 150 };

export function hash3(x, y, s) {
  let h = (Math.imul(x, 1664525) + Math.imul(y, 1013904223) + Math.imul(s, 0x9e3779b1)) | 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 8) / 16777216;
}

export const field = { edge: 0, r: 0, r2: 0 };

export function fieldAt(x, z) {
  const wx = x + 28 * Math.sin(z * 0.0047) + 14 * Math.sin(z * 0.013 + 1.3);
  const wz = z + 34 * Math.sin(x * 0.0039 + 0.4) + 12 * Math.sin(x * 0.017 + 2.1);
  const px = wx / FIELD.sx, pz = wz / FIELD.sz;
  const nx = Math.floor(px), nz = Math.floor(pz);
  const fx = px - nx, fz = pz - nz;

  let md = 8, mrx = 0, mrz = 0, mgx = 0, mgz = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const rx = i + 0.1 + 0.8 * hash3(nx + i, nz + j, 0) - fx;
      const rz = j + 0.1 + 0.8 * hash3(nx + i, nz + j, 1) - fz;
      const dd = rx * rx + rz * rz;
      if (dd < md) { md = dd; mrx = rx; mrz = rz; mgx = i; mgz = j; }
    }
  }

  md = 1e9;
  for (let j = -2; j <= 2; j++) {
    for (let i = -2; i <= 2; i++) {
      const gx = mgx + i, gz = mgz + j;
      const rx = gx + 0.1 + 0.8 * hash3(nx + gx, nz + gz, 0) - fx;
      const rz = gz + 0.1 + 0.8 * hash3(nx + gx, nz + gz, 1) - fz;
      const ex = rx - mrx, ez = rz - mrz;
      const l2 = ex * ex + ez * ez;
      if (l2 > 1e-5) {
        const l = Math.sqrt(l2);
        const ux = ex / l, uz = ez / l;
        const dist = (0.5 * (mrx + rx) * ux + 0.5 * (mrz + rz) * uz) /
          Math.hypot(ux / FIELD.sx, uz / FIELD.sz);
        if (dist < md) md = dist;
      }
    }
  }

  field.edge = md;
  field.r = hash3(nx + mgx, nz + mgz, 2);
  field.r2 = hash3(nx + mgx, nz + mgz, 3);
  return field;
}

export const CROPS = [
  ['wheat', 0.16],
  ['barley', 0.26],
  ['plough', 0.40],
  ['young', 0.52],
  ['pasture', 0.76],
  ['meadow', 0.88],
  ['fallow', 0.93],
  ['orchard', 1.0],
];

export function cropOf(r) {
  for (const [name, upTo] of CROPS) if (r < upTo) return name;
  return 'pasture';
}
