import { SURF, at } from '../kit.js';
import { mulberry32 } from '../valley.js';
import { Place } from './place.js';
import { drawFlag } from '../heraldry.js';
import { WORLD } from '../../world-config.js';
import { climbTower, house, barrel } from '../props.js';

export const place = new Place('watchtower', -Math.PI / 2);

export function build({ builder, banners, heraldry, cv }) {
  const r = mulberry32(5);
  const chimneys = [];
  place.build(builder, b => {
    climbTower(b, { w: 6.5, h: 15 });
    b.box(7.5, 0.3, 1.6, 0, 9, 3.9, SURF.plank);
    for (const x of [-3.4, 3.4]) b.beam([x, 6.2, 4.6], [x, 9, 3.4], 0.16);
    b.beam([0, 15.4, 0], [0, 22, 0], 0.16);
    b.group(at(-9, 0, -2, 0.1), g => house(g, { L: 6, D: 4.5, floors: 1, roof: 'shingle', stoneGround: true, seed: 3, chimney: false }));
    b.cylinder(0.5, 0.9, 4.5, 0, 6, SURF.stone, '#ffffff', 8);
    b.cylinder(0.42, 0.2, 4.5, 0.9, 6, SURF.flat, '#4a2a1a', 8);
    for (let i = 0; i < 3; i++) barrel(b, -5 + i * 0.8, 0, 3 + r() * 0.5);
    b.box(3, 0.9, 1.2, -12.5, 0, 2, SURF.plank, '#7a5a40');
  });
  const flag = WORLD.flags.watchtower;
  if (flag) banners.add({ pos: place.point(0.1, 21.8, 0), along: place.dir(1, 0.3), width: 6, height: 3.4, uv: heraldry.flag('watchtower-flag', flag.shape ?? 'pennant', drawFlag(flag)), mode: 'flag' });
  banners.add({ pos: place.point(0, 13.5, 3.6), along: place.dir(1, 0), out: place.dir(0, 1), width: 3.2, height: 5.2, uv: heraldry.banner(cv.name, 'square'), mode: 'hang' });

  const extras = [];
  for (let i = 0; i < 16; i++) {
    const a = Math.PI * (0.15 + r() * 0.7), d = 24 + r() * 30;
    const [x, z] = place.toWorld(Math.cos(a) * d, -Math.sin(a) * d - 6);
    extras.push({ x, z, scale: 3.4 + r() * 1.6, kind: 'conifer', stretch: 1.3 });
  }
  return {
    place,
    chimneys,
    extras,
    groundSize: 90,
    climb: 19,
    paint: g => {
      g.disc(0, 0, 20, 'rgb(0,0,255)', 6);
      g.disc(-2, 2, 11, 'rgb(170,0,0)', 5);
      g.path([[2, 6], [10, 16], [6, 30], [16, 44]], 1.8);
    },
    detail: { radius: 90, count: 14000 },
    view: { pos: place.point(-22, 24, -18), look: place.point(70, 2, 30) },
  };
}
