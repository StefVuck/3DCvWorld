import { SURF, at } from '../kit.js';
import { mulberry32, waterLevel, heightAt } from '../valley.js';
import { Place } from './place.js';
import { house, scaffold, crate, barrel, stoneTower } from '../props.js';
import { anchor } from '../links.js';
import { stopIndex } from '../../journey.js';

// East bank, facing west across the river; local +x runs downstream
export const place = new Place('mills', -Math.PI / 2);

function wheel(g, radius, width, paddles) {
  for (const x of [-width / 2, width / 2]) {
    for (let i = 0; i < paddles; i++) {
      const a = (i / paddles) * Math.PI * 2, a2 = ((i + 1) / paddles) * Math.PI * 2;
      g.beam([x, Math.cos(a) * radius, Math.sin(a) * radius], [x, Math.cos(a2) * radius, Math.sin(a2) * radius], 0.22, SURF.plank, '#7a5c40');
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI;
      g.beam([x, Math.cos(a) * radius, Math.sin(a) * radius], [x, -Math.cos(a) * radius, -Math.sin(a) * radius], 0.18);
    }
  }
  for (let i = 0; i < paddles; i++) {
    const a = (i / paddles) * Math.PI * 2;
    g.box(width + 0.3, 0.08, 0.9, 0, Math.cos(a) * (radius - 0.3), Math.sin(a) * (radius - 0.3), SURF.plank, '#6b4f36', 0, -a);
  }
  g.cylinder(0.3, width + 1.2, -(width + 1.2) / 2, 0, 0, SURF.timber, '#ffffff', 8, 0, 0, -Math.PI / 2);
}

function sails(g) {
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    g.group(at(0, 0, 0, 0, 0, a), s => {
      s.beam([0, 0, 0.3], [0, 9.5, 0.3], 0.22);
      s.box(1.9, 7.6, 0.06, 0.95, 1.8, 0.42, SURF.cloth, '#e6dcc4');
      for (let y = 2; y < 9.5; y += 1.2) s.beam([0, y, 0.38], [1.9, y, 0.38], 0.05);
    });
  }
}

const LANGUAGE_COLOURS = {
  'C++': '#f34b7d', C: '#555555', Python: '#3572a5', TypeScript: '#3178c6', JavaScript: '#f1e05a', Go: '#00add8',
  Nix: '#7e7eff', CUDA: '#3a4e3a', Rust: '#dea584', Java: '#b07219', 'C#': '#178600', Zig: '#ec915c', Elixir: '#6e4a7e',
};

// Each workshop shows what its project is about, built in the workshop's own frame (door at +z)
const EMBLEMS = {
  clock(b, L) {
    const x = -(L / 2 + 1.7);
    b.group(at(x, 0, 0), t => stoneTower(t, { w: 2.6, h: 10, roof: 'tile' }));
    b.cylinder(0.95, 0.1, x, 7.6, 1.32, SURF.plaster, '#f2ead8', 16, 0, Math.PI / 2);
    b.box(0.9, 1.4, 0.3, x, 0.6, 1.4, SURF.plank, '#5a4430');
  },
  tavern(b, L, D) {
    b.beam([L / 2 - 1.2, 3.4, D / 2], [L / 2 - 1.2, 3.4, D / 2 + 1.5], 0.1);
    b.beam([L / 2 - 1.2, 3.1, D / 2], [L / 2 - 1.2, 3.4, D / 2 + 0.6], 0.07);
    b.box(1.2, 0.9, 0.08, L / 2 - 1.2, 2.35, D / 2 + 1.3, SURF.plank, '#3a2a1e');
    b.cylinder(0.26, 0.5, L / 2 - 1.2, 2.55, D / 2 + 1.42, SURF.flat, '#d4a23a', 10);
    b.cylinder(0.27, 0.1, L / 2 - 1.2, 3.03, D / 2 + 1.42, SURF.flat, '#f4efe4', 10);
    for (const x of [-2.4, 0.4]) {
      b.box(2.2, 0.08, 0.8, x, 0.75, D / 2 + 1.8, SURF.plank, '#7a5a40');
      b.box(2.2, 0.06, 0.35, x, 0.45, D / 2 + 2.6, SURF.plank, '#6b4f36');
      b.box(2.2, 0.06, 0.35, x, 0.45, D / 2 + 1.0, SURF.plank, '#6b4f36');
    }
    for (let k = 0; k < 3; k++) barrel(b, L / 2 + 0.8, 0, D / 2 - 0.5 - k * 0.8);
  },
  dyer(b, L, D, project) {
    const langs = Object.entries(project.languages || { 'C++': 1 }).sort((a, c) => c[1] - a[1]).slice(0, 8);
    const max = langs[0][1];
    const w = 0.62, gap = 0.18, span = langs.length * (w + gap);
    const z = D / 2 + 2.2;
    for (const x of [-span / 2 - 0.3, span / 2 + 0.3]) b.beam([x, 0, z], [x, 4.6, z], 0.14);
    b.beam([-span / 2 - 0.5, 4.5, z], [span / 2 + 0.5, 4.5, z], 0.11);
    langs.forEach(([name, v], k) => {
      const len = 0.5 + 3.4 * (v / max);
      b.box(w, len, 0.04, -span / 2 + (w + gap) * (k + 0.5), 4.42 - len, z + 0.08, SURF.cloth, LANGUAGE_COLOURS[name] ?? '#a89870');
    });
    for (const x of [-1.6, 1.6]) b.cylinder(0.7, 0.8, x + span / 2 + 2, 0, z - 1, SURF.plank, '#6b4f36', 12);
  },
  press(b, L, D) {
    const x = L / 2 - 2.2, z = D / 2 + 1.6;
    for (const dx of [-0.8, 0.8]) b.beam([x + dx, 0, z], [x + dx, 2.7, z], 0.16);
    b.beam([x - 1, 2.6, z], [x + 1, 2.6, z], 0.2);
    b.beam([x - 1, 1.1, z], [x + 1, 1.1, z], 0.14);
    b.cylinder(0.08, 1.0, x, 1.5, z, SURF.timber, '#ffffff', 6);
    b.beam([x - 0.6, 2.2, z], [x + 0.6, 2.2, z], 0.05);
    b.box(1.0, 0.18, 0.7, x, 1.3, z, SURF.plank, '#6b4f36');
    b.box(1.4, 0.8, 1.0, x, 0, z, SURF.plank, '#7a5a40');
    const lx0 = -L / 2 + 0.6, lx1 = x - 1.6;
    for (const lx of [lx0, lx1]) b.beam([lx, 0, z + 0.6], [lx, 2.1, z + 0.6], 0.06);
    b.beam([lx0, 2.0, z + 0.6], [lx1, 2.0, z + 0.6], 0.025, SURF.flat, '#3a3026');
    for (let lx = lx0 + 0.5; lx < lx1 - 0.3; lx += 0.7) b.box(0.5, 0.7, 0.02, lx, 1.28, z + 0.6, SURF.cloth, '#f2ede0');
  },
  orrery(b, L) {
    const x = -(L / 2 + 4.6);
    b.cylinder(0.8, 1.8, x, 0, 0, SURF.stone, '#ffffff', 10);
    b.cylinder(0.1, 1.6, x, 1.8, 0, SURF.timber, '#d4a23a', 6);
  },
};

function workshop(b, project, i, r) {
  const building = project.status === 'building';
  const L = 8 + (i % 2) * 2, D = 6;
  if (building) {
    b.box(L + 0.15, 0.4, D + 0.15, 0, 0, 0, SURF.stone);
    b.box(L, 2.4, D, 0, 0.4, 0, SURF.stone, '#e8e2d4');
    b.timberWall(-L / 2, L / 2, 2.8, 5.4, D / 2, { braces: true });
    b.timberWall(-L / 2, L / 2, 2.8, 5.4, -D / 2, { braces: false });
    for (let x = -L / 2; x <= L / 2; x += L / 4) b.beam([x, 5.4, -D / 2], [x, 5.4 + D * 0.55, 0], 0.16);
    b.beam([-L / 2, 5.4 + D * 0.55, 0], [L / 2, 5.4 + D * 0.55, 0], 0.18);
    scaffold(b, L, D, 6.2);
    for (let k = 0; k < 6; k++) b.box(0.9, 0.5, 0.6, -L / 2 - 3 + (k % 3) * 1, Math.floor(k / 3) * 0.5, D / 2 + 3, SURF.stone, '#e0d8c6');
    for (let k = 0; k < 5; k++) b.beam([L / 2 + 2, 0.15 + k * 0.2, -2], [L / 2 + 2.2, 0.15 + k * 0.2, 3], 0.18);
  } else {
    house(b, { L, D, floors: 1 + (i % 2), roof: ['tile', 'shingle', 'thatch'][i % 3], seed: 900 + i, stoneGround: i % 3 === 1 });
    for (let k = 0; k < 3; k++) crate(b, L / 2 + 1, 0, -1 + k * 0.9, r());
  }
}

export function build({ builder, spinners, cv }) {
  const r = mulberry32(55);
  const wy = waterLevel(place.site.z) - place.site.y;
  const chimneys = [];
  const projects = (cv.projects || []).slice(0, 6);

  const shopAt = i => [-34 + i * 14, 16 - (i % 2) * 5];
  // Workshop-local (door side +z) to the place's frame; workshops are turned to face the road
  const local = (i, x, z) => { const [wx, wz] = shopAt(i); return [wx - x, wz - z]; };
  place.build(builder, b => {
    b.box(14, -wy + 3, 10, 0, wy - 3, 46, SURF.stone);
    b.group(at(0, 0, 46), g => house(g, { L: 14, D: 10, floors: 2, storey: 3, roof: 'shingle', seed: 61, chimneys, chimney: true, jetty: 0.2 }));
    b.box(3.2, 0.5, 16, 8.6, wy + 2.2, 48, SURF.plank, '#6b5038');

    projects.forEach((p, i) => {
      const [x, z] = shopAt(i);
      b.group(at(x, 0, z, Math.PI), g => {
        workshop(g, p, i, r);
        EMBLEMS[p.emblem]?.(g, 8 + (i % 2) * 2, 6, p);
      });
    });
  });

  projects.forEach((p, i) => {
    const L = 8 + (i % 2) * 2;
    const [ax, az] = local(i, p.emblem === 'clock' ? -(L / 2 + 1.7) : p.emblem === 'orrery' ? -(L / 2 + 2) : 0, 2);
    anchor(`project:${i}`, stopIndex('projects'), place.point(ax, p.emblem === 'clock' ? 6 : 3, az), 7, place.point(ax - 10, 9, az - 22));
    if (p.emblem === 'clock') {
      const [cx, cz] = local(i, -(L / 2 + 1.7), 1.42);
      const c = place.point(cx, 7.6, cz);
      for (const [len, speed, wd, dz] of [[0.85, 0.35, 0.09, 0], [0.55, 0.03, 0.13, 0.05]]) {
        spinners.add(at(c.x, c.y, c.z, place.rot + Math.PI), 'z', -speed, place.site.y, g => g.box(wd, len, 0.04, 0, 0, dz, SURF.flat, '#2a241d'));
      }
    }
    if (p.emblem === 'orrery') {
      const [ox, oz] = local(i, -(L / 2 + 4.6), 0);
      const c = place.point(ox, 3.6, oz);
      spinners.add(at(c.x, c.y, c.z, place.rot), 'y', 0.05, place.site.y, g => g.blob(0.8, 0, 0, 0, SURF.flat, '#e8b43a', [1, 1, 1], 1));
      [[1.5, 0.9, '#9a8a7a', 0.22], [2.2, 0.55, '#d9b98a', 0.3], [2.9, 0.38, '#4f7aa8', 0.32], [3.6, 0.24, '#b4532c', 0.26]].forEach(([rad, speed, col, size], k) => {
        spinners.add(at(c.x, c.y, c.z, place.rot + k), 'y', speed, place.site.y, g => {
          g.beam([0, -0.5 - k * 0.15, 0], [rad, -0.5 - k * 0.15, 0], 0.05, SURF.flat, '#b08a3a');
          g.beam([rad, -0.5 - k * 0.15, 0], [rad, 0, 0], 0.05, SURF.flat, '#b08a3a');
          g.blob(size, rad, 0, 0, SURF.flat, col, [1, 1, 1], 1);
        });
      });
    }
  });

  const wheelPos = place.point(10.4, wy + 2.4, 48);
  spinners.add(at(wheelPos.x, wheelPos.y, wheelPos.z, place.rot), 'x', -0.55, place.site.y, g => wheel(g, 4.2, 2.4, 16));

  const building = projects.findIndex(p => p.status === 'building');
  if (building >= 0) {
    const [x, z] = shopAt(building);
    place.build(builder, b => b.group(at(x - 8, 0, z + 1), g => {
      for (const zz of [-1.5, 1.5]) g.beam([0, 0, zz], [0, 6, zz], 0.25);
      g.beam([0, 5.8, 0], [4.5, 9, 0], 0.3);
      g.beam([4.5, 9, 0], [4.5, 5.5, 0], 0.04, SURF.flat, '#3a3026');
      g.box(0.8, 0.6, 0.6, 4.5, 5.0, 0, SURF.stone, '#e0d8c6');
    }));
    const c = place.point(x - 8, 2.6, z + 1);
    spinners.add(at(c.x, c.y, c.z, place.rot), 'z', 0.4, place.site.y, g => {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        g.box(0.2, 0.25, 2.6, Math.cos(a) * 2.4, Math.sin(a) * 2.4, 0, SURF.plank, '#8a6648', 0, 0, a);
      }
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI;
        g.beam([Math.cos(a) * 2.4, Math.sin(a) * 2.4, 0], [-Math.cos(a) * 2.4, -Math.sin(a) * 2.4, 0], 0.14);
      }
    });
  }

  // A post mill on the hill above the works
  const [mx, mz] = place.toWorld(10, -170);
  const my = heightAt(mx, mz) - place.site.y;
  place.build(builder, b => b.group(at(10, my, -170, Math.PI / 2), g => {
    for (const [x, z] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]]) g.beam([x, -0.5, z], [0, 4.5, 0], 0.3);
    g.beam([0, -0.5, 0], [0, 5.5, 0], 0.5);
    g.box(4.2, 5.5, 5.2, 0, 4.8, 0, SURF.plank, '#b09070');
    g.gableRoof(4.2, 5.2, 10.3, 38, 0.3, 0.18, SURF.shingle, '#ffffff', SURF.plank, '#b09070');
    g.beam([0, 5.5, -2.6], [0, 2, -6], 0.2);
  }));
  const hub = place.point(12.9, my + 9.0, -170);
  spinners.add(at(hub.x, hub.y, hub.z, place.rot + Math.PI / 2), 'z', 0.35, place.site.y + my, sails);

  const extras = [];
  for (const [lx, lz] of [[-52, 30], [-50, -20], [48, -26], [30, -30], [-20, -32]]) {
    const [x, z] = place.toWorld(lx, lz);
    extras.push({ x, z, scale: 4.2 + r() * 1.8, kind: lz > 15 ? 'river' : 'broad', stretch: 1 });
  }
  return {
    place,
    chimneys: chimneys.concat(projects.length ? [place.point(-34, 8, 16)] : []),
    extras,
    groundSize: 180,
    paint: g => {
      g.disc(0, 0, 52, 'rgb(0,0,255)', 10);
      g.path([[-48, 4], [52, 4]], 4);
      g.path([[0, 4], [0, 40]], 3);
      g.path([[10, -8], [12, -60], [8, -120], [10, -165]], 2);
      projects.forEach((p, i) => g.disc(-34 + i * 14, 16 - (i % 2) * 5, p.status === 'building' ? 9 : 6, 'rgb(150,0,0)', 6));
    },
    detail: { radius: 150, count: 28000 },
    view: { pos: place.point(-30, 30, -80), look: place.point(50, 0, 15), subject: place.point(2, 3, 12) },
  };
}
