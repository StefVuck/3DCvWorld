import { ConeGeometry, CylinderGeometry } from 'three';
import { SURF, at } from '../kit.js';
import { mulberry32 } from '../valley.js';
import { Place } from './place.js';
import { drawFlag } from '../heraldry.js';
import { WORLD } from '../../world-config.js';
import { stoneTower, house, curtainWall, wattle } from '../props.js';

// Faces east, across the valley towards the river
export const place = new Place('abbey', Math.PI / 2);

function church(b) {
  const L = 26, D = 10, H = 10;
  b.box(L, H, D, 0, 0, 0, SURF.stone);
  for (let x = -L / 2 + 2; x < L / 2 - 1; x += 3.2) {
    b.box(0.9, 0.7, D + 0.6, x, 0, 0, SURF.stone, '#e2dccd');
    b.beam([x, 0.7, D / 2 + 0.25], [x, H - 1, D / 2 + 0.05], 0.6, SURF.stone, '#e2dccd');
    b.beam([x, 0.7, -D / 2 - 0.25], [x, H - 1, -D / 2 - 0.05], 0.6, SURF.stone, '#e2dccd');
    for (const side of [1, -1]) {
      b.box(0.9, 3.4, 0.1, x + 1.6, 4.2, side * (D / 2 + 0.03), SURF.glass);
      b.cone(0.45, 0.7, x + 1.6, 7.6, side * (D / 2 + 0.03), SURF.glass, '#ffffff', 4);
    }
  }
  b.gableRoof(L, D, H, 55, 0.4, 0.22, SURF.shingle, '#ffffff', SURF.stone);
  const ap = new CylinderGeometry(4.6, 4.6, 8.5, 14, 1, false, Math.PI, Math.PI);
  ap.translate(0, 4.25, 0);
  b.add(ap, at(L / 2, 0, 0, -Math.PI / 2), SURF.stone);
  const apr = new ConeGeometry(5, 4.5, 14, 1, false, Math.PI, Math.PI);
  apr.translate(0, 2.25, 0);
  b.add(apr, at(L / 2, 8.5, 0, -Math.PI / 2), SURF.shingle);
  b.box(2.6, 3.8, 0.4, -L / 2 - 4.2, 0, 0, SURF.plank, '#5a4430', Math.PI / 2);
  b.group(at(-L / 2 - 3.5, 0, 0), g => stoneTower(g, { w: 7, h: 20, roof: 'spire' }));
  b.box(1.4, 0.8, 0.08, 6, 3.2, D / 2 + 0.05, SURF.glass);
}

function cloister(b, r) {
  const S = 22;
  for (const [x, z, ry] of [[0, S / 2, 0], [0, -S / 2, Math.PI], [S / 2, 0, -Math.PI / 2], [-S / 2, 0, Math.PI / 2]]) {
    b.group(at(x, 0, z, ry), g => {
      g.box(S, 0.9, 0.5, 0, 0, -1.6, SURF.stone);
      for (let i = -S / 2 + 1.5; i <= S / 2 - 1.5; i += 2.2) g.cylinder(0.18, 2.4, i, 0.9, -1.6, SURF.stone, '#e2dccd', 8);
      g.box(S + 3, 0.18, 3.6, 0, 3.4, 0.1, SURF.shingle, '#ffffff', 0, 0.32);
    });
  }
  b.group(at(S / 2 + 6, 0, 0, Math.PI / 2), g => house(g, { L: S + 6, D: 8, floors: 2, storey: 3.2, roof: 'tile', stoneGround: true, seed: 11, chimney: false, jetty: 0 }));
  b.group(at(0, 0, S / 2 + 5.5, 0), g => house(g, { L: S, D: 7.5, floors: 2, storey: 3.2, roof: 'tile', stoneGround: true, seed: 12, chimney: false, jetty: 0 }));
  b.cylinder(0.8, 0.8, 0, 0, 0, SURF.stone, '#ffffff', 12);
  b.cylinder(0.62, 0.82, 0, 0, 0, SURF.flat, '#1c1a17', 12);
  for (let i = 0; i < 4; i++) {
    const [x, z] = [[-6, -6], [6, -6], [-6, 6], [6, 6]][i];
    b.blob(1.2, x, 0.6, z, SURF.flat, '#3f5a2c', [1, 1.3, 1], 1);
  }
  void r;
}

export function build({ builder, banners, heraldry }) {
  const r = mulberry32(8);
  place.build(builder, b => {
    b.group(at(0, 0, -16), church);
    b.group(at(2, 0, 9), g => cloister(g, r));
    b.group(at(-28, 0, 14, Math.PI / 2), g => house(g, { L: 9, D: 6, floors: 2, roof: 'tile', stoneGround: true, seed: 14 }));
    wattle(b, [[-40, 24], [-26, 24], [-26, 38], [-40, 38], [-40, 24]]);
    const ring = [[-50, -40], [32, -40], [44, -20], [44, 40], [-50, 42]];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], c = ring[(i + 1) % ring.length];
      if (i === 2) {
        const mid = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
        curtainWall(b, a, [mid[0], mid[1] - 3], 3.4, 1.2);
        curtainWall(b, [mid[0], mid[1] + 3], c, 3.4, 1.2);
        b.group(at(mid[0] + 1, 0, mid[1], Math.PI / 2), g => house(g, { L: 8, D: 5, floors: 2, roof: 'tile', stoneGround: true, seed: 15, door: false, chimney: false }));
      } else curtainWall(b, a, c, 3.4, 1.2);
    }
  });

  // A flag flies from a pole at the tip of the bell tower's spire
  const flag = WORLD.flags.abbey;
  if (flag) {
    place.build(builder, b => b.beam([-16.5, 37.6, -16], [-16.5, 42.5, -16], 0.09, SURF.timber, '#3a3026'));
    banners.add({ pos: place.point(-16.45, 42.3, -16), along: place.dir(-0.3, 1), width: 3.4, height: 2.2, uv: heraldry.flag('abbey-flag', flag.shape ?? 'square', drawFlag(flag)), mode: 'flag' });
  }

  const extras = [];
  for (let i = 0; i < 14; i++) {
    const [x, z] = place.toWorld(-46 + (i % 5) * 6.5, 27 + Math.floor(i / 5) * 6.5);
    if (i % 5 > 2) continue;
    extras.push({ x, z, scale: 2.5 + r() * 0.6, kind: 'orchard', stretch: 0.85 });
  }
  for (const [lx, lz] of [[-55, -10], [-58, 20], [50, 50], [-30, -48], [20, -48]]) {
    const [x, z] = place.toWorld(lx, lz);
    extras.push({ x, z, scale: 5 + r() * 1.5, kind: lx < -50 ? 'conifer' : 'broad', stretch: lx < -50 ? 1.5 : 1 });
  }
  return {
    place,
    chimneys: [place.point(12, 12, 14)],
    extras,
    groundSize: 200,
    paint: g => {
      g.poly([[-52, -42], [34, -42], [46, -21], [46, 42], [-52, 44]], 'rgb(0,0,255)', 6);
      g.rect(-8.5, 0.5, 12.5, 17.5, 'rgb(0,0,0)');
      g.path([[46, 0], [30, 0], [10, -2], [-16, -2]], 3);
      g.path([[46, 0], [60, 4], [80, 0], [100, 12]], 3.2);
      g.rect(-39, 25, -27, 37, 'rgb(0,200,0)');
    },
    detail: { radius: 150, count: 31499 },
    view: { pos: place.point(74, 27, 38), look: place.point(-6, 13, -6), subject: place.point(0, 6, -6) },
  };
}
