import { SURF, at } from '../kit.js';
import { mulberry32, waterLevel } from '../valley.js';
import { Place } from './place.js';
import { anchor } from '../links.js';
import { stopIndex } from '../../journey.js';
import { tent, stall, barrel, cow, ledger, punchedCards } from '../props.js';
import { Vector3 } from 'three';

// On the west bank by the crossing, facing east towards the river
export const place = new Place('fair', Math.PI / 2);

export const STALLS = [];

const AWNINGS = [['#a8322d', '#efe6d3'], ['#2f5a8f', '#efe6d3'], ['#3f7a42', '#e9dcb8'], ['#b4652c', '#efe6d3'], ['#6d3f78', '#e9dcb8'], ['#c9a13a', '#7a2a24'], ['#2a5f5a', '#efe6d3'], ['#8a2f4a', '#e9dcb8']];

export function build({ builder, banners, heraldry, cv, wares }) {
  const r = mulberry32(44);
  const groups = (cv.skills || []).slice(0, 8);
  const wy = waterLevel(place.site.z) - place.site.y;
  const stalls = [];
  place.build(builder, b => {
    groups.forEach((g, i) => {
      const a = -Math.PI * 0.85 + (i / Math.max(1, groups.length - 1)) * Math.PI * 1.7;
      const x = Math.cos(a) * 14, z = Math.sin(a) * 14 - 6;
      const [c1, c2] = AWNINGS[i % AWNINGS.length];
      const ry = -a - Math.PI / 2;
      if (g.trade !== 'pedlar') stall(b, x, z, ry, c1, c2, r, g.trade ? 0 : Math.min(12, g.items.length * 2));
      STALLS.push([x, z, ry, g.items.length, g.trade]);
      if (g.trade) stalls.push([x, z, ry, g, i]);
      const fx = -Math.cos(a), fz = -Math.sin(a);
      anchor(`skill:${i}`, stopIndex('skills'), place.point(x, 1.2, z), 5.5, place.point(x + fx * 6.5 + fz * 2, 2.6, z + fz * 6.5 - fx * 2));
      b.beam([x * 1.2, 0, z * 1.2 + 1.2], [x * 1.2, 5.5, z * 1.2 + 1.2], 0.08);
      banners.add({ pos: place.point(x * 1.2, 5.4, z * 1.2 + 1.2), along: place.dir(1, 0.4), width: 2.2, height: 0.9, uv: heraldry.banner(g.group, 'pennant'), mode: 'flag' });
    });
    const tents = [[-26, -20, 5, 6.5, '#efe6d3', '#a8322d'], [-27, 6, 4.2, 5.5, '#efe6d3', '#2f5a8f'], [22, -27, 4.6, 6, '#e9dcb8', '#3f7a42'], [-8, -32, 3.8, 5, '#efe6d3', '#b4652c'], [26, 4, 3.6, 5, '#e9dcb8', '#6d3f78'], [-16, 20, 3.4, 4.6, '#efe6d3', '#2a5f5a'], [10, -34, 3.2, 4.4, '#e9dcb8', '#8a2f4a']];
    for (const [x, z, rr, h, c1, c2] of tents) {
      const top = tent(b, x, z, rr, h, c1, c2);
      banners.add({ pos: place.point(top[0], top[1] - 0.1, top[2]), along: place.dir(1, 0.3), width: 2.4, height: 1.0, uv: heraldry.banner(`${x}${z}`, 'pennant'), mode: 'flag' });
    }
    b.beam([0, 0, -6], [0, 9, -6], 0.22, SURF.timber, '#e6dccb');
    b.stripedCone(0.9, 1.2, 0, 7.8, -6, '#a8322d', '#efe6d3', 8);
    b.blob(0.5, 0, 9.2, -6, SURF.flat, '#4f7a3a', [1, 0.6, 1], 1);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.beam([0, 8.6, -6], [Math.cos(a) * 3.2, 0.9, Math.sin(a) * 3.2 - 6], 0.04, SURF.cloth, AWNINGS[i][0]);
    }
    for (let i = 0; i < 6; i++) barrel(b, 12 + r() * 6, 0, 6 + r() * 4);
    for (let i = 0; i < 4; i++) cow(b, 38 + r() * 10, 10 + r() * 14, r() * Math.PI * 2, r);
    b.box(9, 1.0, 4, 42, 0, 4, SURF.plank, '#7a5a40');

    // Timber bridge over the ford
    const z0 = 52, z1 = 158, deck = wy + 2.6;
    b.box(3.4, 0.25, z1 - z0, 0, deck, (z0 + z1) / 2, SURF.plank, '#8a6a4c', Math.PI / 2 * 0);
    for (let z = z0; z <= z1; z += 7) {
      for (const x of [-1.5, 1.5]) b.beam([x, wy - 3, z], [x, deck + 1.1, z], 0.28);
      b.beam([-1.6, deck - 0.4, z], [1.6, deck - 0.4, z], 0.22);
    }
    for (const x of [-1.6, 1.6]) b.beam([x, deck + 1.0, z0], [x, deck + 1.0, z1], 0.14);
    for (let i = 0; i < 9; i++) b.blob(0.7, -6 + r() * 2, wy - 0.15, 78 + i * 6.5, SURF.stone, '#ffffff', [1, 0.45, 1], 1);
  });
  for (const [x, z, ry, g, i] of stalls) wares.stall(builder, place.matrix.clone().multiply(at(x, 0, z, ry)), place.site.y, g.trade, g.items, i);

  // Writing about a stall's skills lies on its counter: a ledger of instructions, or a deck of
  // punched cards on the pedlar's cart
  for (const [x, z, ry, g] of stalls) {
    const w = (cv.writings || []).find(v => v.at === `skill:${g.group}`);
    if (!w) continue;
    const frame = place.matrix.clone().multiply(at(x, 0, z, ry));
    const spot = g.trade === 'pedlar' ? [1.22, 0.78, 0.18] : [-1.76, 0.9, 0.95];
    builder.groundY = place.site.y;
    builder.group(frame, s => (g.trade === 'pedlar' ? punchedCards : ledger)(s, ...spot, 0.25));
    const local = (lx, ly, lz) => new Vector3(lx, ly, lz).applyMatrix4(frame);
    anchor(`writing:${w.id}`, stopIndex('skills'), local(spot[0], spot[1] + 0.1, spot[2]), 2, local(spot[0] + 0.5, spot[1] + 1.5, spot[2] + 3.2));
  }

  const extras = [];
  for (const [lx, lz] of [[-55, 20], [-52, -40], [44, -40], [-48, 36], [56, -8]]) {
    const [x, z] = place.toWorld(lx, lz);
    extras.push({ x, z, scale: 4.5 + r() * 1.5, kind: 'broad', stretch: 1 });
  }
  return {
    place,
    chimneys: [],
    extras,
    groundSize: 200,
    paint: g => {
      g.disc(0, -6, 52, 'rgb(0,0,255)', 10);
      g.disc(0, -6, 19, 'rgb(110,0,0)', 12);
      g.path([[0, 50], [0, 30], [-4, 0], [-30, -30], [-70, -60], [-100, -64]], 4);
      g.path([[0, 160], [0, 210]], 4);
    },
    detail: { radius: 150, count: 28000 },
    view: { pos: place.point(30, 10, 34), look: place.point(-4, 2, -9), subject: place.point(0, 3, -6) },
  };
}
