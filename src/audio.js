// Background sound for the journey. Every stop has a few quiet layers; a layer plays a
// royalty-free recording from public/audio when one is listed in AUDIO_FILES, and otherwise
// is synthesised here. There are deliberately no continuous noise beds such as wind or water. Layers are shared between stops and mixed by how close the camera is
// to each stop, so the soundscape crossfades as the valley scrolls past. A soft rush of air
// rises with the camera's speed during flights.

import { STOPS } from './journey.js';
import { KITS } from './world/places/index.js';

// Credits for these are in public/audio/CREDITS.md
export const AUDIO_FILES = {
  birds: 'audio/birds.m4a',
  hens: 'audio/hens.m4a',
};

// The quiet layers heard at each place kit. A kit of your own can export `sound`, an object of
// layer names and levels in the same form; without one it gets birdsong.
const KIT_LAYERS = {
  watchtower: { birds: 0.08 },
  homestead: { birds: 0.8, hens: 0.45 },
  abbey: { rooks: 0.5, bell: 0.7, chant: 0.4 },
  town: { cart: 0.35, handbell: 0.35, smith: 0.3 },
  fair: { pipe: 0.5, birds: 0.2 },
  mills: { mallets: 0.4, tick: 0.12 },
  harbour: { gulls: 0.4 },
  ship: { creak: 0.45 },
  coast: { buoy: 0.35, crickets: 0.35 },
};
// Visiting a hall, workshop or stall brings up the sound of its work
const VISIT_BOOST = { town: 'smith', mills: 'mallets', fair: 'pipe' };
const DAY_ONLY = new Set(['birds', 'hens', 'rooks', 'gulls']);
const NIGHT_ONLY = new Set(['crickets']);
const MASTER = 0.18;
// Brings each synthesised layer to the loudness of the recordings (measured offline: steady
// layers by average level, occasional calls and strikes by peak)
const TRIM = {
  chant: 4, choir: 1.9, birds: 2.2, gulls: 9, rooks: 6, hens: 9, crickets: 5, bell: 0.55, handbell: 1.5,
  buoy: 0.8, smith: 1.8, mallets: 1.1, tick: 3, cart: 1.8, creak: 15, pipe: 1.5,
};

const rand = (a, b) => a + Math.random() * (b - a);

function noiseBuffer(ctx, kind, seconds = 4) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'pink') {
      b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    } else if (kind === 'brown') {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else d[i] = w * 0.5;
  }
  return buf;
}

// Small building blocks for the synthesised layers
export function kit(ctx, out) {
  const buffers = {};
  const noise = kind => {
    const s = ctx.createBufferSource();
    s.buffer = buffers[kind] ??= noiseBuffer(ctx, kind);
    s.loop = true;
    s.start(0, Math.random() * 3);
    return s;
  };
  const filter = (type, f, q = 0.7) => {
    const n = ctx.createBiquadFilter();
    n.type = type; n.frequency.value = f; n.Q.value = q;
    return n;
  };
  const gain = v => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const lfo = (rate, depth, param) => {
    const o = ctx.createOscillator(), g = gain(depth);
    o.frequency.value = rate;
    o.connect(g).connect(param);
    o.start();
    return o;
  };
  const chain = (...nodes) => { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; };
  const pan = () => { const p = ctx.createStereoPanner(); p.pan.value = rand(-0.7, 0.7); return p; };
  // A short tone with an envelope, routed through an optional filter and a random pan
  const blip = (t, { type = 'sine', f, f2 = f, dur, peak = 0.3, attack = 0.005, through }) => {
    const o = ctx.createOscillator(), g = gain(0);
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = pan();
    chain(o, ...(through ? [through] : []), g, p, out);
    o.start(t); o.stop(t + dur + 0.05);
  };
  const burst = (t, { kind = 'white', type = 'bandpass', f, q = 1, dur, peak = 0.3 }) => {
    const s = ctx.createBufferSource(), fl = filter(type, f, q), g = gain(0);
    s.buffer = buffers[kind] ??= noiseBuffer(ctx, kind);
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    chain(s, fl, g, pan(), out);
    s.start(t, Math.random() * 2); s.stop(t + dur + 0.05);
  };
  const bell = (t, base, decay, peak = 0.2) => {
    [[0.5, 0.5], [1, 1], [1.19, 0.6], [1.5, 0.45], [2, 0.5], [2.6, 0.25], [3.0, 0.2]].forEach(([r, a]) => {
      blip(t, { f: base * r, dur: decay * (r < 1 ? 1.4 : 1 / Math.sqrt(r)), peak: peak * a, attack: 0.003 });
    });
  };
  return { noise, filter, gain, lfo, chain, blip, burst, bell };
}

// Continuous layers build a graph once; event layers return a function called when due
export const LAYERS = {
  chant: (k, ctx) => {
    const m = k.gain(0.12), f1 = k.filter('bandpass', 700, 4), f2 = k.filter('bandpass', 1100, 5);
    const lp = k.filter('lowpass', 1400);
    f1.connect(lp); f2.connect(lp); lp.connect(m);
    const drone = ctx.createOscillator(); drone.type = 'sawtooth'; drone.frequency.value = 110; drone.connect(f1); drone.connect(f2); drone.start();
    const voice = ctx.createOscillator(); voice.type = 'sawtooth'; voice.frequency.value = 220; voice.connect(f1); voice.connect(f2); voice.start();
    const line = [220, 247, 220, 196, 220, 262, 247, 220, 196, 165, 196, 220];
    let n = 0;
    setInterval(() => voice.frequency.setTargetAtTime(line[n++ % line.length], ctx.currentTime, 0.12), 1400);
    return m;
  },
  choir: (k, ctx) => {
    const m = k.gain(0.08), lp = k.filter('lowpass', 1600), fa = k.filter('bandpass', 650, 3), fb = k.filter('bandpass', 1050, 4);
    fa.connect(lp); fb.connect(lp); lp.connect(m);
    k.lfo(4.8, 0.012, m.gain);
    const chords = [[147, 220, 294, 349], [131, 196, 262, 330], [117, 175, 233, 294], [131, 196, 247, 330]];
    const voices = chords[0].flatMap(f => [0.997, 1.003].map(d => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f * d; o.connect(fa); o.connect(fb); o.start();
      return { o, d };
    }));
    let c = 0;
    setInterval(() => {
      c = (c + 1) % chords.length;
      voices.forEach((v, i) => v.o.frequency.setTargetAtTime(chords[c][i >> 1] * v.d, ctx.currentTime, 0.35));
    }, 4200);
    return m;
  },
};

export const EVENTS = {
  birds: (k, t) => { const f = rand(2600, 4200), n = Math.floor(rand(2, 6)); for (let i = 0; i < n; i++) k.blip(t + i * rand(0.07, 0.13), { f, f2: f * rand(1.15, 1.5), dur: 0.07, peak: 0.12 }); return rand(0.4, 2.6); },
  gulls: (k, t) => { k.blip(t, { type: 'sawtooth', f: 1100, f2: 1500, dur: 0.18, peak: 0.07, through: k.filter('bandpass', 1300, 3) }); k.blip(t + 0.18, { type: 'sawtooth', f: 1500, f2: 800, dur: 0.35, peak: 0.07, through: k.filter('bandpass', 1200, 3) }); return rand(3, 8); },
  rooks: (k, t) => { for (const d of [0, 0.4]) k.blip(t + d, { type: 'sawtooth', f: 380, f2: 300, dur: 0.24, peak: 0.12, through: k.filter('bandpass', 950, 3) }); return rand(3, 7); },
  hens: (k, t) => { for (let i = 0; i < 3; i++) k.blip(t + i * 0.11, { type: 'square', f: 320, f2: 260, dur: 0.06, peak: 0.05, through: k.filter('bandpass', 700, 2) }); return rand(2, 6); },
  crickets: (k, t) => { const f = rand(4300, 4800); for (let i = 0; i < 6; i++) k.blip(t + i * 0.035, { f, dur: 0.025, peak: 0.05 }); return rand(0.5, 1.3); },
  bell: (k, t) => { k.bell(t, 196, 5, 0.18); return rand(22, 32); },
  handbell: (k, t) => { k.bell(t, 880, 1.1, 0.08); return rand(9, 18); },
  buoy: (k, t) => { k.bell(t, 330, 3, 0.12); return rand(5, 9); },
  smith: (k, t) => { for (let i = 0; i < 3; i++) { k.burst(t + i * 0.45, { type: 'highpass', f: 2500, dur: 0.03, peak: 0.25 }); k.blip(t + i * 0.45, { f: 1850, dur: 0.35, peak: 0.06 }); } return rand(2.5, 5); },
  mallets: (k, t) => { for (let i = 0; i < 4; i++) { k.blip(t + i * 0.55, { f: 140, f2: 70, dur: 0.12, peak: 0.25 }); k.burst(t + i * 0.55, { f: 650, q: 2, dur: 0.06, peak: 0.2 }); } return rand(2, 4.5); },
  tick: (k, t) => { k.burst(t, { f: 3200, q: 4, dur: 0.012, peak: 0.25 }); return 1; },
  cart: (k, t) => { for (let i = 0; i < 6; i++) k.burst(t + i * 0.4 + rand(0, 0.1), { f: 900, q: 3, dur: 0.04, peak: 0.12 }); return rand(8, 15); },
  creak: (k, t) => { k.blip(t, { type: 'sawtooth', f: rand(70, 95), f2: rand(55, 70), dur: rand(0.6, 1.1), peak: 0.1, attack: 0.2, through: k.filter('bandpass', 700, 8) }); return rand(3, 7); },
};

// A modal tune on pipe and tabor for the fair, scheduled a little ahead of time
export function pipeAndTabor(k, ctx, out) {
  const tune = [62, 64, 66, 67, 69, 67, 66, 64, 62, 62, 69, 71, 72, 71, 69, 67, 66, 67, 69, 67, 66, 64, 62, 0];
  const beat = 60 / 132 / 2;
  let step = 0, next = ctx.currentTime + 0.2;
  const tone = k.filter('lowpass', 2400);
  tone.connect(out);
  return () => {
    while (next < ctx.currentTime + 0.4) {
      const m = tune[step % tune.length];
      if (m) {
        const o = ctx.createOscillator(), g = k.gain(0), vib = k.lfo(5.5, 4, o.frequency);
        o.type = 'triangle';
        o.frequency.value = 440 * 2 ** ((m + 12 - 69) / 12);
        g.gain.setValueAtTime(0, next);
        g.gain.linearRampToValueAtTime(0.09, next + 0.02);
        g.gain.setTargetAtTime(0, next + beat * 0.8, 0.03);
        o.connect(g).connect(tone);
        o.start(next); o.stop(next + beat + 0.1); vib.stop(next + beat + 0.1);
      }
      if (step % 4 === 0) k.burst(next, { kind: 'brown', type: 'lowpass', f: 160, dur: 0.18, peak: 0.6 });
      if (step % 4 === 2) k.burst(next, { type: 'bandpass', f: 1800, q: 1, dur: 0.05, peak: 0.08 });
      next += beat;
      step++;
    }
    return 0.1;
  };
}

export class Soundscape {
  constructor() {
    this.ctx = null;
    this.layers = new Map();
    this.on = false;
  }

  async start() {
    if (!this.ctx) {
      const ctx = this.ctx = new AudioContext();
      this.master = ctx.createGain();
      this.master.gain.value = 0;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -24;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(ctx.destination);
      const k = kit(ctx, this.master);
      this.whoosh = k.gain(0);
      this.whooshFilter = k.filter('bandpass', 400, 0.8);
      k.chain(k.noise('pink'), this.whooshFilter, this.whoosh, this.master);
      this.timer = setInterval(() => this.tick(), 100);
    }
    await this.ctx.resume();
    this.on = true;
    this.master.gain.setTargetAtTime(MASTER, this.ctx.currentTime, 0.8);
  }

  stop() {
    if (!this.ctx) return;
    this.on = false;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    setTimeout(() => { if (!this.on) this.ctx.suspend(); }, 1500);
  }

  async layer(name) {
    if (this.layers.has(name)) return this.layers.get(name);
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.master);
    const entry = { out, level: 0, next: 0, event: null };
    this.layers.set(name, entry);
    const trim = ctx.createGain();
    trim.connect(out);
    const k = kit(ctx, trim);
    const file = AUDIO_FILES[name];
    if (file) {
      try {
        const data = await (await fetch(file)).arrayBuffer();
        const src = ctx.createBufferSource();
        src.buffer = await ctx.decodeAudioData(data);
        src.loop = true;
        src.connect(out);
        src.start(0, Math.random() * src.buffer.duration);
        return entry;
      } catch { /* fall back to the synthesised version */ }
    }
    trim.gain.value = TRIM[name] ?? 1;
    if (LAYERS[name]) LAYERS[name](k, ctx).connect(trim);
    else if (name === 'pipe') entry.event = pipeAndTabor(k, ctx, trim);
    else if (EVENTS[name]) entry.event = t => EVENTS[name](k, t);
    return entry;
  }

  tick() {
    if (!this.on) return;
    const now = this.ctx.currentTime;
    for (const e of this.layers.values()) {
      if (!e.event || e.level < 0.02 || now < e.next) continue;
      e.next = now + e.event(now + 0.05);
    }
  }

  // weights: how much each stop is heard (summing to about 1); day: 0 at night to 1 in daylight
  update({ weights, day, speed, visit, extra = {} }) {
    if (!this.on || !this.ctx) return;
    const want = new Map();
    weights.forEach((w, s) => {
      if (w < 0.001) return;
      const kit = STOPS[s]?.kit;
      for (const [name, level] of Object.entries(KITS[kit]?.sound ?? KIT_LAYERS[kit] ?? { birds: 0.4 })) want.set(name, (want.get(name) ?? 0) + w * level);
    });
    for (const [name, level] of Object.entries(extra)) if (level > 0.001) want.set(name, (want.get(name) ?? 0) + level);
    if (visit) {
      const boosted = VISIT_BOOST[STOPS.find(st => st.id === visit.split(':')[0])?.kit];
      if (boosted && want.has(boosted)) want.set(boosted, Math.min(1, want.get(boosted) * 2));
    }
    const now = this.ctx.currentTime;
    for (const [name, level] of want) {
      let v = level;
      if (DAY_ONLY.has(name)) v *= day;
      if (NIGHT_ONLY.has(name)) v *= 1 - day;
      if (!this.layers.has(name) && v > 0.01) this.layer(name);
      const e = this.layers.get(name);
      if (e) { e.level = v; e.out.gain.setTargetAtTime(v, now, 0.6); }
    }
    for (const [name, e] of this.layers) {
      if (want.has(name)) continue;
      e.level = 0;
      e.out.gain.setTargetAtTime(0, now, 0.6);
    }
    const rush = Math.min(1, speed / 350);
    this.whoosh.gain.setTargetAtTime(rush * rush * 0.1, now, 0.4);
    this.whooshFilter.frequency.setTargetAtTime(300 + rush * 900, now, 0.3);
  }
}
