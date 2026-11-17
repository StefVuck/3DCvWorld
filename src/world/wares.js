import { Group, Mesh, Matrix4 } from 'three';
import { Builder, SURF, at, buildingMaterial } from './kit.js';
import { barrel } from './props.js';

// The fair's stalls are trades that stand for the skill groups, and every skill is its own
// object, so a skill on the panel can light up its counterpart at the fair.

const PALETTE = ['#3178c6', '#c4473a', '#e2b54a', '#6d8f3e', '#7e7eff', '#b4652c', '#2a5f5a', '#8a2f4a', '#d9cbb0'];
const JARS = { python: '#3572a5', go: '#00add8', rust: '#dea584', java: '#b07219', ruby: '#a91401' };
const PANES = { typescript: '#3178c6', react: '#61dafb', next: '#1c1a17', astro: '#ff5d01', vue: '#41b883', svelte: '#ff3e00' };

const W = {
  gear(b, { r = 0.26, color = '#b08a3a' } = {}) {
    b.box(0.5, 0.08, 0.3, 0, 0, 0, SURF.plank, '#6b4f36');
    b.beam([0, 0.08, -0.05], [0, r + 0.1, -0.05], 0.04);
    const y = r + 0.12;
    b.cylinder(r, 0.06, 0, y, -0.03, SURF.flat, color, 18, 0, Math.PI / 2);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      b.box(0.07, 0.09, 0.06, Math.cos(a) * (r + 0.03), y - 0.045 + Math.sin(a) * (r + 0.03), 0, SURF.flat, color, 0, 0, a + Math.PI / 2);
    }
    b.cylinder(r * 0.25, 0.08, 0, y, -0.04, SURF.flat, '#3a3026', 10, 0, Math.PI / 2);
  },
  watch(b) {
    b.box(0.34, 0.08, 0.26, 0, 0, 0, SURF.cloth, '#8a2f2a');
    b.cylinder(0.15, 0.05, 0, 0.26, -0.02, SURF.flat, '#d4a23a', 16, 0, Math.PI / 2);
    b.cylinder(0.125, 0.02, 0, 0.26, 0.03, SURF.flat, '#f4efe4', 16, 0, Math.PI / 2);
    b.box(0.015, 0.09, 0.01, 0, 0.29, 0.05, SURF.flat, '#1c1a17');
    b.torus(0.04, 0.012, 0, 0.44, 0, SURF.flat, '#d4a23a');
  },
  gearRack(b) {
    b.box(0.7, 0.62, 0.05, 0, 0, -0.1, SURF.plank, '#5a4430');
    for (let i = 0; i < 9; i++) {
      const x = -0.22 + (i % 3) * 0.22, y = 0.13 + Math.floor(i / 3) * 0.19;
      b.cylinder(0.075, 0.03, x, y, -0.07, SURF.flat, i % 2 ? '#b08a3a' : '#9a8a7a', 10, 0, Math.PI / 2);
    }
  },
  jar(b, { color = '#6d8f3e', h = 0.28 } = {}) {
    b.cylinder(0.11, h, 0, 0, 0, SURF.flat, color, 12);
    b.cylinder(0.08, 0.05, 0, h, 0, SURF.plank, '#8a6a4c', 10);
    b.box(0.12, 0.08, 0.01, 0, h * 0.4, 0.11, SURF.flat, '#f2ede0');
  },
  crystal(b) {
    b.box(0.42, 0.02, 0.42, 0, 0, 0, SURF.cloth, '#5a3a6a');
    b.cylinder(0.11, 0.1, 0, 0.02, 0, SURF.flat, '#2a2420', 10, 0, 0, 0, 0.07);
    b.blob(0.17, 0, 0.29, 0, SURF.glass, '#cfe0f0', [1, 1, 1], 2);
  },
  shelf(b) {
    for (const x of [-0.75, 0.75]) b.beam([x, 0, 0], [x, 2.0, 0], 0.08);
    for (let s = 0; s < 3; s++) {
      const y = 0.5 + s * 0.6;
      b.box(1.6, 0.05, 0.36, 0, y, 0, SURF.plank, '#7a5a40');
      for (let k = 0; k < 5; k++) {
        const h = 0.2 + ((k * 7 + s * 3) % 4) * 0.04;
        b.cylinder(0.08, h, -0.6 + k * 0.3, y + 0.05, 0, SURF.flat, PALETTE[(k + s * 2) % PALETTE.length], 10);
        b.cylinder(0.06, 0.03, -0.6 + k * 0.3, y + 0.05 + h, 0, SURF.plank, '#8a6a4c', 8);
      }
    }
  },
  pane(b, { color = '#3178c6' } = {}) {
    b.box(0.34, 0.06, 0.18, 0, 0, 0, SURF.plank, '#6b4f36');
    b.box(0.5, 0.62, 0.025, 0, 0.06, 0, SURF.flat, color);
    b.box(0.56, 0.04, 0.045, 0, 0.06, 0, SURF.timber, '#ffffff');
    b.box(0.56, 0.04, 0.045, 0, 0.66, 0, SURF.timber, '#ffffff');
    for (const x of [-0.27, 0.27]) b.box(0.04, 0.64, 0.045, x, 0.06, 0, SURF.timber, '#ffffff');
    b.box(0.02, 0.6, 0.03, 0, 0.07, 0.005, SURF.flat, '#3a3026');
    b.box(0.5, 0.02, 0.03, 0, 0.36, 0.005, SURF.flat, '#3a3026');
  },
  peep(b) {
    b.box(0.5, 0.36, 0.36, 0, 0, 0, SURF.plank, '#6d3f78');
    b.cylinder(0.06, 0.08, 0, 0.2, 0.18, SURF.flat, '#d4a23a', 10, 0, Math.PI / 2);
    b.box(0.46, 0.2, 0.02, 0, 0.36, -0.06, SURF.flat, '#7aa05a', 0, -0.3);
    b.box(0.46, 0.08, 0.021, 0, 0.5, -0.1, SURF.flat, '#9cc0d8', 0, -0.3);
  },
  casts(b) {
    b.box(0.8, 0.05, 0.28, 0, 0, 0, SURF.plank, '#6b4f36');
    for (let k = 0; k < 4; k++) {
      const x = -0.3 + k * 0.2;
      b.cylinder(0.07, 0.12, x, 0.05, 0, SURF.flat, '#7e7eff', 6);
      b.cone(0.07, 0.08, x, 0.17, 0, SURF.flat, '#9a9aff', 6);
    }
  },
  chest(b) {
    b.box(0.6, 0.34, 0.36, 0, 0, 0, SURF.plank, '#5a4430');
    b.box(0.62, 0.08, 0.38, 0, 0.34, 0, SURF.plank, '#6b4f36');
    for (const x of [-0.2, 0.2]) b.box(0.05, 0.43, 0.385, x, 0, 0, SURF.flat, '#3a3530');
    b.box(0.08, 0.1, 0.02, 0, 0.24, 0.19, SURF.flat, '#d4a23a');
  },
  signal(b) {
    b.beam([0, 0, 0], [0, 4.2, 0], 0.14);
    b.beam([-0.6, 3.7, 0], [0.6, 3.7, 0], 0.08);
    b.box(0.3, 0.38, 0.3, 0, 4.2, 0, SURF.glass, '#ffe0a0');
    b.cone(0.24, 0.2, 0, 4.58, 0, SURF.flat, '#3a3026', 4);
    b.box(0.9, 0.55, 0.03, 0.95, 3.15, 0, SURF.cloth, '#e6522c');
    b.beam([0.5, 3.7, 0], [0.5, 2.95, 0], 0.03);
  },
  barrels(b) {
    barrel(b, -0.36, 0, 0);
    barrel(b, 0.36, 0, 0);
    barrel(b, 0, 0.85, 0);
    for (const [x, h] of [[0.9, 1.0], [1.9, 0.8], [2.9, 0.6]]) {
      for (const z of [-0.2, 0.2]) b.beam([x, 0, z], [x, h, z], 0.05);
      b.beam([x, h, -0.25], [x, h, 0.25], 0.05);
    }
    b.beam([0.6, 1.05, 0], [3.1, 0.62, 0], 0.22, SURF.plank, '#7a5a40');
    b.beam([0.6, 1.11, 0], [3.1, 0.68, 0], 0.12, SURF.flat, '#6f8fa8');
  },
};

const PEDLAR = [
  (b, c) => b.blob(0.2, 0, 0.18, 0, SURF.cloth, c, [1, 0.85, 1], 1),
  (b, c) => { b.cylinder(0.07, 0.24, 0, 0, 0, SURF.flat, c, 10); b.cylinder(0.03, 0.08, 0, 0.24, 0, SURF.flat, c, 8); },
  (b, c) => b.cylinder(0.06, 0.4, 0, 0.06, 0, SURF.cloth, '#efe6d3', 10, 0, 0, Math.PI / 2),
  (b, c) => b.box(0.3, 0.2, 0.24, 0, 0, 0, SURF.plank, c),
  (b, c) => { b.cylinder(0.16, 0.18, 0, 0, 0, SURF.straw, '#c9a46a', 12); b.blob(0.08, 0, 0.2, 0, SURF.flat, c, [1, 1, 1], 1); },
  (b, c) => { b.box(0.14, 0.24, 0.14, 0, 0, 0, SURF.glass, '#ffe0a0'); b.cone(0.11, 0.1, 0, 0.24, 0, SURF.flat, '#3a3026', 4); },
  (b, c) => b.box(0.28, 0.07, 0.2, 0, 0, 0, SURF.plank, c),
  (b, c) => { b.cylinder(0.09, 0.2, 0, 0, 0, SURF.flat, c, 10); b.cylinder(0.07, 0.04, 0, 0.2, 0, SURF.plank, '#8a6a4c', 8); },
  (b, c) => b.blob(0.16, 0, 0.12, 0, SURF.cloth, c, [1.4, 0.6, 0.9], 1),
];

function wareFor(trade, item, k) {
  const t = item.toLowerCase();
  if (trade === 'clockmaker') return /cuda|gpu/.test(t) ? ['gearRack'] : /embedded|^c\b/.test(t) ? ['watch'] : ['gear', { r: 0.22 + (k % 2) * 0.06 }];
  if (trade === 'apothecary') return /torch|tensor|learning/.test(t) ? ['crystal'] : /sql|postgres|data/.test(t) ? ['shelf', null, true] : ['jar', { color: JARS[Object.keys(JARS).find(n => new RegExp(`^${n}\\b`).test(t))] ?? PALETTE[k + 3], h: 0.24 + k * 0.04 }];
  if (trade === 'glazier') {
    if (/three|webgl/.test(t)) return ['peep'];
    const hit = Object.keys(PANES).find(n => t.includes(n));
    return ['pane', { color: hit ? PANES[hit] : PALETTE[k] }];
  }
  if (trade === 'cooper') return /nix/.test(t) ? ['casts'] : /prometheus|grafana|loki/.test(t) ? ['signal', null, true] : /docker|ci\//.test(t) ? ['barrels', null, true] : ['chest'];
  return ['pedlar'];
}

const SIGNS = {
  clockmaker: b => b.cylinder(0.16, 0.05, 0, 0, 0.04, SURF.flat, '#d4a23a', 12, 0, Math.PI / 2),
  apothecary: b => { b.blob(0.13, 0, -0.02, 0.06, SURF.glass, '#6d8f3e', [1, 1, 1], 1); b.cylinder(0.04, 0.1, 0, 0.08, 0.06, SURF.glass, '#6d8f3e', 8); },
  glazier: b => b.box(0.26, 0.3, 0.03, 0, -0.15, 0.05, SURF.flat, '#3178c6'),
  cooper: b => b.cylinder(0.11, 0.26, 0, -0.13, 0.08, SURF.plank, '#8a6648', 10),
  pedlar: b => b.box(0.26, 0.2, 0.1, 0, -0.1, 0.07, SURF.cloth, '#8a7a58'),
};

export class Wares {
  constructor() {
    this.group = new Group();
    this.material = buildingMaterial();
    this.lit = buildingMaterial();
    this.items = new Map();
  }

  piece(key, matrix, groundY, fn) {
    const b = new Builder();
    b.groundY = groundY;
    fn(b);
    const mesh = new Mesh(b.build(), this.material);
    matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
    this.group.add(mesh);
    if (key) this.items.set(key, { mesh, y: mesh.position.y, amount: 0 });
  }

  // Dresses one stall for its trade. frame places the stall in the world: counter along x,
  // customers at +z
  stall(b, frame, groundY, trade, items, gi) {
    b.groundY = groundY;
    const local = (x, y, z, ry = 0) => frame.clone().multiply(at(x, y, z, ry));
    const counter = items.map((item, k) => [item, k, wareFor(trade, item, k)]).filter(([, , w]) => !w[2] && w[0] !== 'pedlar');
    const beside = items.map((item, k) => [item, k, wareFor(trade, item, k)]).filter(([, , w]) => w[2]);
    counter.forEach(([, k, [kind, opts]], n) => {
      const x = -1.5 + (3 / counter.length) * (n + 0.5);
      this.piece(`ware:${gi}:${k}`, local(x, 0.9, 1.0), groundY, g => W[kind](g, opts || {}));
    });
    beside.forEach(([, k, [kind]], n) => {
      const side = n % 2 ? -1 : 1;
      this.piece(`ware:${gi}:${k}`, local(side * (kind === 'barrels' ? 2.9 : 3.0), 0, kind === 'barrels' ? 0.2 : 0.3, kind === 'barrels' && side < 0 ? Math.PI : 0), groundY, g => W[kind](g));
    });
    if (trade === 'pedlar') {
      items.forEach((item, k) => {
        const x = -0.9 + (k % 3) * 0.9, z = -0.4 + Math.floor(k / 3) * 0.4;
        this.piece(`ware:${gi}:${k}`, local(x, 0.78 + Math.floor(k / 3) * 0.04, z), groundY, g => PEDLAR[k % PEDLAR.length](g, PALETTE[k % PALETTE.length]));
      });
    }
    b.group(frame, s => {
      if (trade === 'pedlar') {
        s.box(3.0, 0.12, 1.5, 0, 0.66, 0, SURF.plank, '#7a5a40');
        for (const z of [-0.75, 0.75]) s.box(3.0, 0.3, 0.06, 0, 0.72, z, SURF.plank, '#6b4f36');
        for (const z of [-0.85, 0.85]) {
          s.cylinder(0.45, 0.08, 0.3, 0.45, z, SURF.plank, '#5a4430', 12, 0, Math.PI / 2);
          s.cylinder(0.1, 0.12, 0.3, 0.45, z, SURF.flat, '#3a3026', 8, 0, Math.PI / 2);
        }
        for (const z of [-0.6, 0.6]) s.beam([-1.5, 0.75, z], [-2.6, 0.45, z], 0.07);
        s.beam([-1.4, 0, 0], [-1.4, 0.66, 0], 0.08);
        s.beam([0.9, 0.78, -0.75], [0.9, 2.3, -0.75], 0.05);
        s.beam([-0.9, 0.78, -0.75], [-0.9, 2.3, -0.75], 0.05);
        s.stripedBox(2.0, 0.04, 1.2, 0, 2.3, -0.3, '#c9a13a', '#7a2a24', 0.4, 0, 0.25);
        return;
      }
      if (trade === 'clockmaker') {
        s.cylinder(0.32, 0.06, 0, 1.55, -1.13, SURF.flat, '#f2ead8', 16, 0, Math.PI / 2);
        s.box(0.03, 0.22, 0.02, 0, 1.55, -1.06, SURF.flat, '#1c1a17', 0, 0, 0.6);
        s.cylinder(0.07, 0.07, 1.75, 0.9, 1.0, SURF.plank, '#6b4f36', 8);
        s.cylinder(0.05, 0.12, 1.75, 0.97, 1.0, SURF.glass, '#e8d8a8', 8, 0, 0, 0, 0.01);
        s.cylinder(0.05, 0.12, 1.75, 1.09, 1.0, SURF.glass, '#e8d8a8', 8, 0, 0, 0, 0.05);
        s.cylinder(0.07, 0.04, 1.75, 1.21, 1.0, SURF.plank, '#6b4f36', 8);
      }
      if (trade === 'apothecary') {
        s.beam([1.75, 0.9, 1.0], [1.75, 1.3, 1.0], 0.03);
        s.beam([1.5, 1.3, 1.0], [2.0, 1.3, 1.0], 0.025);
        for (const x of [1.53, 1.97]) s.cylinder(0.09, 0.02, x, 1.12, 1.0, SURF.flat, '#b08a3a', 10);
      }
      if (trade === 'glazier') {
        s.group(at(-3.2, 0, 0.6, 0.35), p => {
          p.stripedBox(1.5, 2.3, 0.6, 0, 0, 0, '#2f5a8f', '#efe6d3', 0.3);
          p.box(1.0, 0.6, 0.05, 0, 1.25, 0.31, SURF.flat, '#1c1a17');
          p.box(1.2, 0.08, 0.1, 0, 1.2, 0.33, SURF.plank, '#7a5a40');
          for (const [x, c] of [[-0.2, '#c4473a'], [0.22, '#e2b54a']]) {
            p.blob(0.09, x, 1.5, 0.3, SURF.flat, '#e8c9a8', [1, 1, 1], 1);
            p.cone(0.1, 0.22, x, 1.28, 0.3, SURF.cloth, c, 8);
          }
          p.stripedCone(0.95, 0.45, 0, 2.3, 0, '#2f5a8f', '#efe6d3', 4);
        });
      }
      s.beam([1.55, 2.6, 1.55], [1.55, 2.3, 1.55], 0.02, SURF.flat, '#3a3026');
      s.box(0.62, 0.42, 0.05, 1.55, 1.88, 1.55, SURF.plank, '#6b4f36');
      s.group(at(1.55, 2.09, 1.58), SIGNS[trade] ?? SIGNS.pedlar);
    });
  }

  update(t, key, dt) {
    let glow = 0;
    for (const [k, it] of this.items) {
      it.amount += ((k === key ? 1 : 0) - it.amount) * Math.min(1, dt * 5);
      it.mesh.position.y = it.y + it.amount * (0.3 + 0.05 * Math.sin(t * 3));
      it.mesh.material = it.amount > 0.02 ? this.lit : this.material;
      glow = Math.max(glow, it.amount);
    }
    this.lit.uniforms.uGlow.value = glow;
  }
}
