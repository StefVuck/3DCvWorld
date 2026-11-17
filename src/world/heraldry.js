import { CanvasTexture, LinearFilter } from 'three';

const METALS = ['#d9b44a', '#ece5d3'];
const COLOURS = ['#a8322d', '#2f5a8f', '#3f7a42', '#2a2622', '#6d3f78', '#b4652c'];

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function mullet(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.42 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

// Arms are drawn by the rule of tincture: a metal field takes a coloured charge and vice versa.
export function drawArms(ctx, x, y, w, h, seed) {
  const r = hashString(seed);
  const pick = a => a[Math.floor(r() * a.length)];
  const metalField = r() < 0.5;
  const field = metalField ? pick(METALS) : pick(COLOURS);
  const other = metalField ? pick(COLOURS) : pick(METALS);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = field;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = other;
  const division = Math.floor(r() * 7);
  if (division === 1) ctx.fillRect(x + w / 2, y, w / 2, h);
  else if (division === 2) ctx.fillRect(x, y + h / 2, w, h / 2);
  else if (division === 3) { ctx.fillRect(x, y, w / 2, h / 2); ctx.fillRect(x + w / 2, y + h / 2, w / 2, h / 2); }
  else if (division === 4) { ctx.beginPath(); ctx.moveTo(x, y + h * 0.95); ctx.lineTo(x + w / 2, y + h * 0.45); ctx.lineTo(x + w, y + h * 0.95); ctx.lineTo(x + w, y + h * 0.7); ctx.lineTo(x + w / 2, y + h * 0.2); ctx.lineTo(x, y + h * 0.7); ctx.fill(); }
  else if (division === 5) ctx.fillRect(x, y, w, h * 0.28);
  else if (division === 6) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * 0.25, y); ctx.lineTo(x + w, y + h * 0.75); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w * 0.75, y + h); ctx.lineTo(x, y + h * 0.25); ctx.fill(); }
  const charge = Math.floor(r() * 5);
  const cx = x + w / 2, cy = y + h * (division === 5 ? 0.6 : 0.5), cr = Math.min(w, h) * 0.2;
  ctx.fillStyle = division === 0 ? other : (r() < 0.5 ? METALS[0] : COLOURS[3]);
  if (charge === 1) mullet(ctx, cx, cy, cr * 1.2);
  else if (charge === 2) { ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.fill(); }
  else if (charge === 3) { ctx.fillRect(cx - cr * 0.25, cy - cr * 1.2, cr * 0.5, cr * 2.4); ctx.fillRect(cx - cr * 1.2, cy - cr * 0.25, cr * 2.4, cr * 0.5); }
  else if (charge === 4) {
    ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(cx, cy - cr * 0.35, cr * 0.85, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = field;
  }
  ctx.restore();
}

// Flags described in world.config.js: stripes, a Nordic cross, a saltire or a plain field
export function drawFlag(spec) {
  return (ctx, x, y, s) => {
    if (spec.stripes) {
      const n = spec.stripes.length;
      spec.stripes.forEach((c, k) => {
        ctx.fillStyle = c;
        if (spec.direction === 'vertical') ctx.fillRect(x + (k * s) / n, y, s / n + 1, s);
        else ctx.fillRect(x, y + (k * s) / n, s, s / n + 1);
      });
      return;
    }
    ctx.fillStyle = spec.field ?? spec.plain ?? '#7a2a24';
    ctx.fillRect(x, y, s, s);
    if (spec.cross) {
      ctx.fillStyle = spec.cross;
      ctx.fillRect(x + s * 0.3, y, s * 0.16, s);
      ctx.fillRect(x, y + s * 0.42, s, s * 0.16);
    } else if (spec.saltire) {
      ctx.strokeStyle = spec.saltire;
      ctx.lineWidth = s * 0.17;
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + s, y + s);
      ctx.moveTo(x + s, y); ctx.lineTo(x, y + s);
      ctx.stroke();
    }
  };
}

const images = new Map();
export function loadImage(src) {
  if (!images.has(src)) {
    images.set(src, new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    }));
  }
  return images.get(src);
}

// An organisation's logo on a plain field in place of generated arms. stretch is how much the
// surface it is shown on stretches the picture vertically, so the logo can be drawn squashed
// to come out true.
export function drawLogo(ctx, img, x, y, w, h, logo, stretch = 1) {
  const bx = x + w * (logo.fill ? 0.06 : 0.16), by = y + h * (logo.fill ? 0.05 : 0.12);
  const bw = w * (logo.fill ? 0.88 : 0.68), bh = h * (logo.fill ? 0.78 : 0.62);
  const ar = (img.naturalWidth || img.width) / (img.naturalHeight || img.height);
  let dw = bw, dh = (bw / ar) / stretch;
  if (dh > bh) { dh = bh; dw = bh * stretch * ar; }
  ctx.drawImage(img, bx + (bw - dw) / 2, by + (bh - dh) / 2, dw, dh);
}

export class Heraldry {
  constructor(cells = 6, size = 256) {
    this.cells = cells;
    this.size = size;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = cells * size;
    this.ctx = this.canvas.getContext('2d');
    this.count = 0;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.flipY = false;
    this.texture.minFilter = this.texture.magFilter = LinearFilter;
  }

  // Returns the atlas rectangle [u0, v0, u1, v1] of a new banner bearing arms from `seed`
  // A banner painted by draw(ctx, x, y, size) instead of generated arms
  flag(key, shape, draw) {
    return this.banner(key, shape, null, 1, draw);
  }

  banner(seed, shape = 'swallowtail', logo = null, stretch = 1, draw = null) {
    const key = `${seed}|${shape}|${logo?.src ?? ''}`;
    if (this.drawn?.has(key)) return this.drawn.get(key);
    (this.drawn ??= new Map());
    if (this.count >= this.cells * this.cells) console.warn('Heraldry atlas is full; banners will repeat');
    const i = this.count++ % (this.cells * this.cells);
    const s = this.size, ox = (i % this.cells) * s, oy = Math.floor(i / this.cells) * s;
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(ox, oy, s, s);
    ctx.beginPath();
    if (shape === 'swallowtail') {
      ctx.moveTo(ox, oy); ctx.lineTo(ox + s, oy); ctx.lineTo(ox + s, oy + s); ctx.lineTo(ox + s / 2, oy + s * 0.8); ctx.lineTo(ox, oy + s);
    } else if (shape === 'pennant') {
      ctx.moveTo(ox, oy); ctx.lineTo(ox + s, oy + s * 0.5); ctx.lineTo(ox, oy + s);
    } else {
      ctx.rect(ox, oy, s, s);
    }
    ctx.closePath();
    ctx.clip();
    if (logo) {
      ctx.fillStyle = logo.field ?? '#f6f0e2';
      ctx.fillRect(ox, oy, s, s);
      const clip = new Path2D();
      if (shape === 'swallowtail') { clip.moveTo(ox, oy); clip.lineTo(ox + s, oy); clip.lineTo(ox + s, oy + s); clip.lineTo(ox + s / 2, oy + s * 0.8); clip.lineTo(ox, oy + s); } else clip.rect(ox, oy, s, s);
      loadImage(logo.src).then(img => {
        ctx.save();
        ctx.clip(clip);
        drawLogo(ctx, img, ox, oy, s, s * 0.8, logo, stretch);
        ctx.restore();
        this.texture.needsUpdate = true;
      }).catch(() => {});
    } else if (draw) draw(ctx, ox, oy, s);
    else drawArms(ctx, ox, oy, s, s, seed);
    ctx.restore();
    this.texture.needsUpdate = true;
    const uv = [ox / this.canvas.width, oy / this.canvas.height, (ox + s) / this.canvas.width, (oy + s) / this.canvas.height];
    this.drawn.set(key, uv);
    return uv;
  }
}
