import { SURF, at } from '../kit.js';
import { mulberry32, waterLevel } from '../valley.js';
import { Place } from './place.js';
import { anchor } from '../links.js';
import { WORLD } from '../../world-config.js';
import { stopIndex } from '../../journey.js';
import { Bunting } from '../bunting.js';
import { Carts } from '../carts.js';
import { heightAt } from '../valley.js';
import { house, stoneTower, curtainWall, marketCross, boat, barrel, crate } from '../props.js';

// Faces west, towards the river; local +x runs downstream
export const place = new Place('town', -Math.PI / 2);

const HALL_SLOTS = [
  [-24, -2, Math.PI / 2], [24, -2, -Math.PI / 2], [-12, -20, 0], [12, -20, 0], [-12, 17, Math.PI], [12, 17, Math.PI],
];
// Fill the halls whose fronts face the town view first
const SLOT_ORDER = [2, 3, 0, 4, 5, 1];

export const HALLS = [];
export const RING = [];

const townPennant = (ctx, x, y, s) => {
  ctx.fillStyle = '#8a2f2a'; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = '#d4a23a'; ctx.fillRect(x, y + s * 0.42, s, s * 0.16);
};

// What each hall's trade puts out in front of it, in the hall's frame (door at +z)
const TRADES = {
  // exchange: an open market house, trading under the raised upper floor
  exchange(b) {
    const goods = ['#c4473a', '#e2b54a', '#6d8f3e', '#8a5a3a', '#d9cbb0', '#5a6f9a'];
    for (const z of [1.7, -1.5]) {
      for (const x of [-2.6, 2.6]) {
        b.box(4.2, 0.08, 1.0, x, 0.85, z, SURF.plank, '#7a5a40');
        for (const dx of [-1.8, 1.8]) for (const dz of [-0.4, 0.4]) b.beam([x + dx, 0, z + dz], [x + dx, 0.85, z + dz], 0.06);
        for (let k = 0; k < 5; k++) {
          const gx = x - 1.6 + k * 0.8, c = goods[(k + (z > 0 ? 0 : 3) + (x > 0 ? 1 : 0)) % goods.length];
          if (k % 3 === 0) b.blob(0.24, gx, 1.1, z, SURF.cloth, '#c9b48a', [1, 0.8, 1], 1);
          else if (k % 3 === 1) b.cylinder(0.12, 0.7, gx + 0.35, 1.05, z, SURF.cloth, c, 10, 0, 0, Math.PI / 2);
          else { b.cylinder(0.24, 0.16, gx, 0.93, z, SURF.straw, '#c9a46a', 12); for (let f = 0; f < 4; f++) b.blob(0.07, gx - 0.1 + (f % 2) * 0.2, 1.1, z - 0.08 + (f >> 1) * 0.16, SURF.flat, c, [1, 1, 1], 1); }
        }
      }
    }
    for (let k = 0; k < 4; k++) b.cylinder(0.06, 0.03 + k * 0.025, 0.2 + k * 0.16, 0.93, 1.6, SURF.flat, '#d4a23a', 10);
    b.beam([-0.4, 0.93, 1.6], [-0.4, 1.4, 1.6], 0.03);
    b.beam([-0.75, 1.4, 1.6], [-0.05, 1.4, 1.6], 0.025);
    for (const x of [-0.72, -0.08]) b.cylinder(0.11, 0.02, x, 1.2, 1.6, SURF.flat, '#b08a3a', 10);
    for (const [x, z] of [[-6.2, 5.4], [-5.4, 6.0], [6.0, 5.6]]) b.box(0.8, 0.6, 0.7, x, 0, z, SURF.plank, '#8a6a4c', 0.3);
    for (const [x, z] of [[5.2, 6.3], [6.3, 6.6]]) b.blob(0.32, x, 0.3, z, SURF.cloth, '#c9b48a', [1, 0.8, 1], 1);
  },
  school(b) {
    b.beam([2.6, 0, 7.6], [3.0, 2.1, 7.2], 0.06);
    b.beam([3.4, 0, 7.6], [3.0, 2.1, 7.2], 0.06);
    b.beam([3.0, 0, 6.7], [3.0, 2.1, 7.2], 0.06);
    b.box(1.6, 1.1, 0.06, 3.0, 1.0, 7.5, SURF.flat, '#2b2f2c', 0, -0.2);
    for (let row = 0; row < 2; row++) b.box(5, 0.4, 0.35, -0.8, 0, 9.6 + row * 1.5, SURF.plank, '#7a5a40');
  },
  // lodge: a master builder's lodge, with a sun study over a model and a treadwheel crane
  lodge(b) {
    b.box(2.7, 0.08, 2.7, -1.5, 0.86, 8.0, SURF.plank, '#7a5a40');
    for (const dx of [-1.2, 1.2]) for (const dz of [-1.2, 1.2]) b.beam([-1.5 + dx, 0, 8 + dz], [-1.5 + dx, 0.86, 8 + dz], 0.07);
    b.box(0.9, 0.05, 0.9, -1.5, 0.94, 8.0, SURF.plank, '#c9b48a');
    b.box(0.5, 0.34, 0.38, -1.55, 0.99, 7.95, SURF.plaster, '#efe6d3');
    b.cone(0.36, 0.26, -1.55, 1.33, 7.95, SURF.tile, '#b4532c', 4);
    b.box(0.15, 0.62, 0.15, -1.25, 0.99, 7.75, SURF.stone, '#e2dccd');
    b.box(1.7, 0.06, 1.1, 2.1, 0.86, 7.2, SURF.plank, '#6b4f36', 0.1);
    for (const dx of [-0.7, 0.7]) b.beam([2.1 + dx, 0, 7.2], [2.1 + dx, 0.86, 7.2], 0.06);
    for (const [x, z, a] of [[1.8, 7.1, 0.15], [2.45, 7.3, -0.1]]) {
      b.box(0.62, 0.01, 0.46, x, 0.9, z, SURF.flat, '#f2ede0', a);
      for (let l = 0; l < 3; l++) b.box(0.44, 0.012, 0.012, x, 0.905, z - 0.12 + l * 0.12, SURF.flat, '#5a4a3a', a);
    }
    for (let k = 0; k < 6; k++) b.box(0.7, 0.42, 0.45, 4.2 + (k % 3) * 0.75, Math.floor(k / 3) * 0.42, 10.0, SURF.stone, '#ddd6c6');
    for (const z of [5.6, 7.4]) {
      b.beam([5.6, 0, z], [7.0, 5.2, z], 0.24);
      b.beam([8.4, 0, z], [7.0, 5.2, z], 0.24);
    }
    b.beam([7.0, 5.0, 6.5], [7.0, 7.0, 9.8], 0.26);
    b.beam([7.0, 7.0, 9.8], [7.0, 3.0, 9.8], 0.04, SURF.flat, '#3a3026');
    b.box(0.8, 0.5, 0.6, 7.0, 2.5, 9.8, SURF.stone, '#ddd6c6');
  },
  ledger(b) {
    for (const x of [-3.2, 3.2]) b.beam([x, 0, 7.4], [x, 4.4, 7.4], 0.16);
    b.box(6.6, 3.0, 0.14, 0, 1.2, 7.4, SURF.plank, '#e8e0cc');
    const cells = [];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 6; col++) {
        const x = -2.75 + col * 1.1, y = 1.45 + row * 0.55;
        b.box(1.0, 0.45, 0.04, x, y, 7.49, SURF.flat, (row * 6 + col) % 7 === 3 ? '#e0c46a' : '#f6f0e2');
        cells.push([x, y + 0.22]);
      }
    }
    for (const [a, c] of [[2, 14], [14, 27], [7, 20], [20, 27], [9, 22]]) b.beam([cells[a][0], cells[a][1], 7.53], [cells[c][0], cells[c][1], 7.53], 0.04, SURF.flat, '#a8322d');
  },
  racing(b) {
    b.group(at(-1, 0, 8.4, 0.5), c => {
      c.box(3.2, 0.5, 1.2, 0, 0.45, 0, SURF.plank, '#a8322d');
      c.box(1.2, 0.5, 0.9, -0.4, 0.95, 0, SURF.plank, '#8a2a24');
      c.box(0.8, 0.3, 1.1, 1.5, 0.55, 0, SURF.plank, '#2a2420');
      for (const [x, z, rr] of [[-1.1, 0.8, 0.5], [-1.1, -0.8, 0.5], [1.2, 0.75, 0.42], [1.2, -0.75, 0.42]]) {
        c.cylinder(rr, 0.22, x, rr, z - Math.sign(z) * 0.11, SURF.flat, '#3a3026', 12, 0, Math.PI / 2);
        c.cylinder(rr * 0.35, 0.24, x, rr, z - Math.sign(z) * 0.12, SURF.flat, '#d4a23a', 8, 0, Math.PI / 2);
      }
    });
    b.beam([4.6, 0, 6.4], [4.6, 5.5, 6.4], 0.08);
    b.stripedBox(1.6, 1.0, 0.04, 5.4, 4.4, 6.4, '#1c1a17', '#f2ede0', 0.4);
    for (let k = 0; k < 4; k++) b.cylinder(0.42, 0.22, -4.5, k * 0.23, 7.6, SURF.flat, '#2a2420', 12);
  },
};

function marketHouse(b, seed) {
  for (const x of [-5.2, -2.6, 0, 2.6, 5.2]) {
    for (const z of [-4.0, 0, 4.0]) {
      if (z === 0 && Math.abs(x) < 4) continue;
      b.box(0.55, 0.3, 0.55, x, 0, z, SURF.stone, '#d8d2c4');
      b.box(0.36, 2.9, 0.36, x, 0.3, z, SURF.timber, '#ffffff');
      b.box(0.9, 0.18, 0.5, x, 3.0, z, SURF.timber, '#ffffff');
    }
  }
  b.group(at(0, 3.15, 0), g => house(g, { L: 11.4, D: 9, floors: 1, storey: 3.2, jetty: 0, roof: 'tile', seed, pitch: 50, chimney: false, door: false }));
  b.box(11.2, 0.12, 8.8, 0, 0, 0, SURF.stone, '#cfc8b8');
}

// Inside each guild hall: the guild's colours on the back wall and its work in the middle
const ROOMS = {
  school(b, { D, y }) {
    b.box(2.4, 1.2, 0.05, 0, y + 0.9, -D / 2 + 0.04, SURF.flat, '#2b2f2c');
    b.box(1.2, 0.8, 0.6, 2.4, y, -D / 2 + 1.0, SURF.plank, '#6b4f36');
    for (let row = 0; row < 2; row++) for (let i = 0; i < 3; i++) {
      const x = -2.4 + i * 2.4, z = -0.4 + row * 1.6;
      b.box(1.3, 0.72, 0.5, x, y, z, SURF.plank, '#7a5a40');
      b.box(1.3, 0.42, 0.3, x, y, z + 0.6, SURF.plank, '#6b4f36');
      b.box(0.3, 0.02, 0.22, x - 0.2, y + 0.73, z, SURF.flat, '#efe6d3');
    }
  },
  lodge(b, { y }) {
    b.box(2.6, 0.9, 1.4, 0, y, -0.6, SURF.plank, '#7a5a40');
    b.box(0.9, 0.7, 0.9, -0.4, y + 0.9, -0.6, SURF.plaster, '#e8dcc0');
    b.cone(0.75, 0.55, -0.4, y + 1.6, -0.6, SURF.tile, '#ffffff', 4);
    b.box(0.5, 1.1, 0.5, 0.6, y + 0.9, -0.7, SURF.stone, '#d8d2c4');
    for (let k = 0; k < 3; k++) b.cylinder(0.05, 0.9, 0.9 + k * 0.12, y + 0.95, -0.1, SURF.flat, '#efe6d3', 8, 0, 0, Math.PI / 2);
    b.beam([-1.0, y + 0.9, -0.2], [-0.2, y + 1.7, -0.6], 0.03, SURF.timber, '#2a2420');
  },
  ledger(b, { L, D, y }) {
    for (const x of [-1.8, 1.8]) {
      b.box(1.6, 0.78, 0.8, x, y, -0.4, SURF.plank, '#6b4f36');
      for (let k = 0; k < 4; k++) b.box(0.32, 0.07, 0.24, x - 0.4 + (k % 2) * 0.5, y + 0.78 + Math.floor(k / 2) * 0.07, -0.4, SURF.flat, ['#7a2a24', '#2e3a4a', '#3e5a3a', '#8a7a4a'][k]);
    }
    b.box(0.4, 2.4, 3.2, -L / 2 + 0.22, y, -0.6, SURF.plank, '#5a4030');
    for (let s = 0; s < 4; s++) for (let i = 0; i < 12; i++) b.box(0.22, 0.42, 0.18, -L / 2 + 0.3, y + 0.15 + s * 0.58, -2.0 + i * 0.25, SURF.flat, ['#7a2a24', '#2e3a4a', '#3e5a3a', '#8a7a4a', '#5a3a2e'][(i + s) % 5]);
    void D;
  },
  racing(b, { L, y }) {
    const z = -0.6;
    for (const x of [-1.1, 1.1]) b.box(0.3, 0.35, 1.2, x, y, z, SURF.stone, '#8a8a88');
    b.box(3.0, 0.32, 0.95, 0, y + 0.45, z, SURF.flat, WORLD.racing.body);
    b.box(0.9, 0.35, 0.7, -0.2, y + 0.77, z, SURF.flat, WORLD.racing.body);
    b.group(at(1.5, y + 0.6, z, 0, 0, -Math.PI / 2), g => g.cone(0.45, 0.9, 0, 0, 0, SURF.flat, WORLD.racing.body, 4));
    b.box(0.3, 0.06, 1.5, -1.6, y + 0.85, z, SURF.flat, '#1c1a17');
    for (const x of [-1.0, 1.0]) for (const s of [1, -1]) b.cylinder(0.3, 0.26, x, y + 0.6, z + s * 0.65, SURF.flat, '#1c1a17', 12, 0, Math.PI / 2);
    b.box(0.06, 1.2, 2.4, L / 2 - 0.05, y + 0.8, z, SURF.plank, '#7a5a40');
    for (let k = 0; k < 6; k++) b.beam([L / 2 - 0.12, y + 1.0 + (k % 2) * 0.4, z - 1.0 + k * 0.4], [L / 2 - 0.12, y + 1.3 + (k % 2) * 0.4, z - 1.0 + k * 0.4], 0.04, SURF.flat, '#8a8a88');
    for (let k = 0; k < 3; k++) b.cylinder(0.3, 0.24, -L / 2 + 0.8, y + k * 0.25, -2.6, SURF.flat, '#1c1a17', 12);
  },
};

function guildHall(b, seed, trade, colour = '#8a2f2a') {
  if (trade === 'exchange') return marketHouse(b, seed);
  const room = (rb, r) => {
    rb.box(1.6, 2.0, 0.05, 0, r.y + 0.35, -r.D / 2 + 0.03, SURF.cloth, colour);
    rb.box(1.8, 0.08, 0.08, 0, r.y + 2.4, -r.D / 2 + 0.06, SURF.timber);
    ROOMS[trade]?.(rb, r);
    r.lamp(-2.6, 0.6);
    r.lamp(2.6, 0.6);
  };
  house(b, { L: 11, D: 8.5, floors: 3, storey: 2.9, jetty: 0.45, roof: 'tile', stoneGround: true, seed, pitch: 52, chimney: true, interior: room, doorX: 0 });
  for (let i = 0; i < 4; i++) b.cylinder(0.22, 2.6, -4.2 + i * 2.8, 0, 4.85, SURF.stone, '#e2dccd', 8);
  b.box(11.2, 0.4, 1.6, 0, 2.6, 4.55, SURF.stone, '#d8d2c4');
}

export function build({ builder, banners, heraldry, spinners, cv }) {
  const r = mulberry32(21);
  const chimneys = [];
  const halls = (cv.experience || []).slice(0, HALL_SLOTS.length);
  const wy = waterLevel(place.site.z) - place.site.y;

  place.build(builder, b => {
    b.group(at(0, 0, 0), marketCross);
    b.cylinder(1.1, 0.9, 7, 0, 6, SURF.stone, '#ffffff', 12);
    b.cylinder(0.9, 0.92, 7, 0, 6, SURF.flat, '#1c1a17', 12);

    halls.forEach((job, i) => {
      const [x, z, ry] = HALL_SLOTS[SLOT_ORDER[i]];
      HALLS.push({ x, z, ry, trade: job.trade });
      b.group(at(x, 0, z, ry), g => {
        guildHall(g, 100 + i, job.trade, job.logo?.field);
        TRADES[job.trade]?.(g);
      });
      // Look at the trade from out in the square, a little to whichever side is nearer the middle
      const [vx, vz] = [ry + 0.3, ry - 0.3].map(a => [x + Math.sin(a) * 20, z + Math.cos(a) * 20])
        .sort((p, q) => Math.hypot(...p) - Math.hypot(...q))[0];
      // Writing about a job is chalked on the blackboard out in front of its hall
      const note = (cv.writings || []).find(w => w.at === `job:${job.role}`);
      if (note && job.trade === 'school') {
        b.group(at(x, 0, z, ry), g => g.group(at(3.0, 1.0, 7.53, 0, -0.2), c => {
          c.box(0.9, 0.07, 0.006, -0.1, 0.92, 0, SURF.flat, '#ecebe4');
          for (let k = 0; k < 5; k++) c.box(1.15 - (k % 3) * 0.22, 0.026, 0.006, -0.04 - (k % 3) * 0.11, 0.76 - k * 0.13, 0, SURF.flat, '#d8d8d0');
          c.box(0.05, 0.05, 0.006, -0.62, 0.76, 0, SURF.flat, '#ecebe4');
          c.box(0.05, 0.05, 0.006, -0.62, 0.5, 0, SURF.flat, '#ecebe4');
        }));
        const hp = (lx, ly, lz) => place.point(x + lx * Math.cos(ry) + lz * Math.sin(ry), ly, z - lx * Math.sin(ry) + lz * Math.cos(ry));
        anchor(`writing:${note.id}`, stopIndex('experience'), hp(3.0, 1.55, 7.5), 2.5, hp(4.2, 2.3, 11.4));
      }
      anchor(`job:${i}`, stopIndex('experience'), place.point(x + Math.sin(ry) * (job.trade === 'exchange' ? 3 : 7.5), job.trade === 'exchange' ? 1.6 : 2.6, z + Math.cos(ry) * (job.trade === 'exchange' ? 3 : 7.5)), 9, place.point(vx, job.trade === 'exchange' ? 3.6 : 9, vz));
      const along = place.dir(Math.cos(ry), -Math.sin(ry));
      const front = place.dir(Math.sin(ry), Math.cos(ry));
      for (const off of [-3, 3]) {
        const p = place.point(x + Math.sin(ry) * 4.9 + Math.cos(ry) * off, job.trade === 'exchange' ? 6.6 : 8.2, z + Math.cos(ry) * 4.9 - Math.sin(ry) * off);
        p.addScaledVector(front, 0.6);
        banners.add({ pos: p, along, out: front, width: 1.5, height: 3.4, uv: heraldry.banner(`${job.org}`, 'swallowtail', job.logo, 3.4 / 1.5), mode: 'hang' });
      }
    });

    // Houses line the main street (local z) and the cross street (local x), gable ends to the road
    const lots = [];
    for (let z = -92; z <= 86; z += 7.2) {
      if (Math.abs(z) < 26) continue;
      lots.push([-9.5, z, Math.PI / 2], [9.5, z, -Math.PI / 2]);
    }
    for (let x = -90; x <= 90; x += 7.2) {
      if (Math.abs(x) < 34) continue;
      lots.push([x, -9.5, 0], [x, 9.5, Math.PI]);
    }
    for (const [x, z] of [[-45, -45], [-45, 45], [45, 45], [-60, -25], [-28, 60], [60, -60], [30, 70]]) {
      for (let k = 0; k < 4; k++) lots.push([x + (k % 2) * 9, z + Math.floor(k / 2) * 10, r() * Math.PI * 2]);
    }
    lots.forEach(([x, z, ry], i) => {
      if (Math.hypot(x - 45, z + 45) < 16) return;
      if (Math.hypot(x, z) > 92) return;
      b.group(at(x, 0, z, ry), g => house(g, {
        L: 5 + r() * 2.2, D: 7.5 + r() * 2, floors: r() < 0.25 ? 3 : 2, seed: 300 + i,
        chimneys: i % 6 === 0 ? chimneys : undefined, chimney: i % 6 === 0 ? true : undefined,
      }));
    });

    b.group(at(45, 0, -45, Math.PI / 2), g => {
      g.box(22, 11, 9, 0, 0, 0, SURF.stone);
      g.gableRoof(22, 9, 11, 52, 0.4, 0.2, SURF.shingle, '#ffffff', SURF.stone);
      g.group(at(-13, 0, 0), t => stoneTower(t, { w: 6.5, h: 22, roof: 'spire' }));
      for (let x = -8; x <= 8; x += 4) for (const s of [1, -1]) g.box(0.9, 3.4, 0.1, x, 4.5, s * 4.53, SURF.glass);
    });

    const ring = RING;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.2;
      ring.push([Math.cos(a) * 100, Math.sin(a) * 100 - 4]);
    }
    const pennant = heraldry.flag('town-pennant', 'pennant', townPennant), standard = heraldry.banner('The Guild Town', 'swallowtail');
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], c = ring[(i + 1) % ring.length];
      const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
      const gate = Math.abs(mx) < 30 && Math.abs(mz) > 60;
      if (gate) {
        const ux = (c[0] - a[0]), uz = (c[1] - a[1]), l = Math.hypot(ux, uz);
        curtainWall(b, a, [mx - (ux / l) * 6, mz - (uz / l) * 6], 7, 2.4);
        curtainWall(b, [mx + (ux / l) * 6, mz + (uz / l) * 6], c, 7, 2.4);
        for (const s of [-1, 1]) {
          const tx = mx + (ux / l) * 5 * s, tz = mz + (uz / l) * 5 * s;
          b.group(at(tx, -1, tz), t => stoneTower(t, { w: 4.5, h: 11, round: true, roof: 'cone' }));
          b.beam([tx, 14.4, tz], [tx, 18.2, tz], 0.08, SURF.timber, '#3a3026');
          banners.add({ pos: place.point(tx, 18.0, tz), along: place.dir(1, 0.3), width: 2.6, height: 1.7, uv: standard, mode: 'flag' });
        }
      } else curtainWall(b, a, c, 7, 2.4);
      b.group(at(a[0], -1, a[1]), t => stoneTower(t, { w: 5.5, h: 10.5, round: true, roof: i % 2 ? 'cone' : 'crenel' }));
      const top = i % 2 ? 15.4 : 9.9;
      b.beam([a[0], top - 0.4, a[1]], [a[0], top + 3, a[1]], 0.07, SURF.timber, '#3a3026');
      banners.add({ pos: place.point(a[0], top + 2.9, a[1]), along: place.dir(1, 0.3), width: 2.2, height: 1.0, uv: pennant, mode: 'flag' });
    }

    b.box(130, 3.0, 12, 0, wy - 2, 122, SURF.stone, '#d8d2c4');
    b.box(130, 0.4, 13, 0, wy + 1.0, 122, SURF.stone, '#e8e2d4');
    for (let x = -60; x <= 60; x += 8) b.cylinder(0.25, 0.8, x, wy + 1.4, 127.6, SURF.timber, '#ffffff', 8);
    for (let i = 0; i < 6; i++) barrel(b, -20 + i * 1.3 + r(), wy + 1.4, 124 + r());
    for (let i = 0; i < 5; i++) crate(b, 10 + i * 1.2, wy + 1.4, 124.5 + r(), r());
    boat(b, -34, wy - 0.5, 134, 0.05, 14, '#5a4030', true, '#d9cdb2');
    boat(b, 8, wy - 0.45, 133.5, -0.04, 9, '#6b4f36', false);
    boat(b, 40, wy - 0.5, 135, 3.1, 16, '#4f3a2a', true, '#c9a682');
    b.box(130, 7, 3, 0, wy + 1.4, 112, SURF.stone, '#ffffff');
  });

  for (const h of HALLS) {
    if (h.trade !== 'lodge') continue;
    const hp = (x, y, z) => place.point(h.x + x * Math.cos(h.ry) + z * Math.sin(h.ry), y, h.z - x * Math.sin(h.ry) + z * Math.cos(h.ry));
    // A lantern sun circles the model while its shadow sweeps round the other side
    const c = hp(-1.55, 0.97, 7.95);
    spinners.add(at(c.x, c.y, c.z, place.rot + h.ry), 'y', 0.3, place.site.y, g => {
      g.beam([0, 0.85, 0], [1.15, 0.85, 0], 0.035, SURF.flat, '#3a3026');
      g.beam([1.15, 0.85, 0], [1.15, 0.6, 0], 0.025, SURF.flat, '#3a3026');
      g.box(0.16, 0.2, 0.16, 1.15, 0.4, 0, SURF.glass, '#ffe0a0');
      g.cone(0.13, 0.08, 1.15, 0.6, 0, SURF.flat, '#3a3026', 4);
      g.box(0.95, 0.006, 0.42, -0.7, 0.0, 0, SURF.flat, '#3e3328');
    });
    const w = hp(7.0, 2.6, 6.5);
    spinners.add(at(w.x, w.y, w.z, place.rot + h.ry), 'z', 0.35, place.site.y, g => {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        for (const z of [-0.8, 0.8]) g.box(0.9, 0.18, 0.25, Math.cos(a) * 2.3, Math.sin(a) * 2.3, z, SURF.plank, '#8a6648', 0, 0, a + Math.PI / 2);
      }
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI;
        g.beam([Math.cos(a) * 2.3, Math.sin(a) * 2.3, 0], [-Math.cos(a) * 2.3, -Math.sin(a) * 2.3, 0], 0.12);
      }
      g.cylinder(0.12, 2.0, 0, 0, -1, SURF.timber, '#ffffff', 8, 0, Math.PI / 2);
    });
  }

  const cranePos = place.point(24, wy + 1.4, 122);
  place.build(builder, b => b.group(at(24, wy + 1.4, 122), g => {
    for (const z of [-1.8, 1.8]) {
      g.beam([-2.6, 0, z], [0, 7, z], 0.3);
      g.beam([2.6, 0, z], [0, 7, z], 0.3);
    }
    g.beam([0, 6.8, 0], [0, 9.5, 6.5], 0.35);
    g.beam([0, 9.5, 6.5], [0, 5, 6.5], 0.05, SURF.flat, '#3a3026');
    g.box(1.2, 1.1, 1.2, 0, 3.9, 6.5, SURF.plank, '#8a6a4c');
  }));
  spinners.add(at(cranePos.x, cranePos.y + 2.8, cranePos.z, place.rot), 'x', 0.25, place.site.y, g => {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      for (const z of [-1.2, 1.2]) g.box(0.3, 0.2, 1.1, z, Math.cos(a) * 2.6 - 0.1, Math.sin(a) * 2.6, SURF.plank, '#8a6648', 0, -a);
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI;
      g.beam([0, Math.cos(a) * 2.6, Math.sin(a) * 2.6], [0, -Math.cos(a) * 2.6, -Math.sin(a) * 2.6], 0.14);
    }
  });

  const extras = [];
  for (const [lx, lz] of [[-30, -30], [30, 30], [-60, 10], [55, 15], [-18, 60], [0, -70]]) {
    const [x, z] = place.toWorld(lx, lz);
    extras.push({ x, z, scale: 4 + r() * 1.5, kind: 'broad', stretch: 1 });
  }
  // Bunting zigzags across both streets and fans out from a pole on the market cross
  const bunting = new Bunting();
  const P = (x, y, z) => place.point(x, y, z);
  [[34, 1], [-34, -1]].forEach(([z0, dir]) => {
    for (let k = 0; k < 5; k++) {
      const z = z0 + dir * k * 11, s = k % 2 ? 1 : -1;
      bunting.string(P(5.0 * s, 5.8, z), P(-5.0 * s, 5.6, z + dir * 5.5), { seed: k });
    }
  });
  for (let k = 0; k < 5; k++) {
    const x = 38 + k * 11, s = k % 2 ? 1 : -1;
    bunting.string(P(x, 5.8, 5.0 * s), P(x + 5.5, 5.6, -5.0 * s), { seed: k + 2 });
  }
  place.build(builder, b => b.beam([0, 4.2, 0], [0, 6.6, 0], 0.07, SURF.timber, '#3a3026'));
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.3;
    const end = [Math.cos(a) * 14, Math.sin(a) * 14];
    place.build(builder, b => b.beam([end[0], 0, end[1]], [end[0], 6.2, end[1]], 0.07, SURF.timber, '#6b4f36'));
    bunting.string(P(0, 6.5, 0), P(end[0], 6.1, end[1]), { sag: 0.7, seed: k });
  }

  // Carts on the streets; walkers keep to the sides
  const carts = new Carts();
  const ground = (x, z) => { const p = place.point(x, 0, z); return heightAt(p.x, p.z) - place.site.y; };
  carts.add(P(1.2, 0, 30), P(1.2, 0, 84), { speed: 1.5, horse: '#6b4a32', phase: 0.1 });
  carts.add(P(-1.2, 0, -30), P(-1.2, Math.max(0, ground(-1.2, -112)), -112), { speed: 1.3, horse: '#d9d2c4', phase: 0.6 });
  carts.add(P(38, 0, 1.2), P(86, 0, 1.2), { speed: 1.6, horse: '#3a2e26', phase: 0.35 });

  return {
    meshes: [bunting.build(), carts.build()],
    place,
    chimneys: chimneys.slice(0, 10),
    extras,
    groundSize: 300,
    paint: g => {
      g.disc(0, -4, 106, 'rgb(0,0,255)', 8);
      g.rect(-30, -24, 30, 20, 'rgb(190,0,0)', 3);
      g.path([[0, -140], [0, -24]], 7);
      g.path([[0, 20], [0, 112]], 7);
      g.path([[-96, 0], [-30, 0]], 7);
      g.path([[30, 0], [96, 0]], 7);
      g.path([[-70, 116], [70, 116]], 9);
      g.path([[0, -140], [-20, -200], [-10, -260]], 5);
    },
    detail: { radius: 150, count: 24500 },
    view: { pos: place.point(20, 66, 96), look: place.point(-28, 0, -6), subject: place.point(0, 4, 0) },
  };
}
