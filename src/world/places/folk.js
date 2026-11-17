import { mulberry32, waterLevel } from '../valley.js';
import { MODE, crowdKit } from '../people.js';
import { place as watchtower } from './watchtower.js';
import { place as homestead } from './homestead.js';
import { place as abbey } from './abbey.js';
import { place as town } from './town.js';
import { place as fair } from './fair.js';
import { place as mills } from './mills.js';
import { place as harbour, INN } from './harbour.js';
import { HALLS, RING } from './town.js';
import { STALLS } from './fair.js';
import { WORLD } from '../../world-config.js';

const HABITS = ['#2e2824', '#3a302a', '#5e4c3a', '#d6cebd'];

// Folk for each built-in settlement, for those the journey uses
export function populate(people, birds, active) {
  const r = mulberry32(909);

  if (active.has('watchtower')) {
    const k = crowdKit(people, watchtower, r, birds);
    k.idle(-2.4, -1.7, Math.PI / 2, { y: 15.4, color: '#5a3a2e', accent: '#8a8a88' });
    k.walk([-14, 3], [-6, 8]);
  }

  if (active.has('homestead')) {
    const k = crowdKit(people, homestead, r, birds);
    k.idle(11, 7, 0.4, { mode: MODE.work, color: '#7a4a32', accent: '#d8cdb4' });
    k.idle(15, 10, -2.2, { mode: MODE.work, color: '#4f5a3a', accent: '#c9b48a' });
    k.walk([1, 12], [-4, 32], { speed: 0.9 });
    k.idle(-5, 9, 2.4, { color: '#8a2f2a' });
    k.idle(-2.5, 1.25, 0, { y: 0.55, mode: MODE.work, color: '#3f4f62', accent: '#2a2420' });
  }

  if (active.has('abbey')) {
    const k = crowdKit(people, abbey, r, birds);
    for (let i = 0; i < 7; i++) {
      k.walk([38, -1], [-6, -2], { speed: 0.8, phase: i * 0.06, color: HABITS[0], accent: HABITS[0] });
    }
    for (const [x, z, f] of [[-36, 28, 0.3], [-31, 33, 2.4], [-29, 27, -1.2]]) k.idle(x, z, f, { mode: MODE.work, color: HABITS[2], accent: HABITS[2] });
    k.gather(46, 10, 1.5, 4, 4, { from: Math.PI * 0.2, span: Math.PI * 0.6 });
    k.idle(42, 10, Math.PI / 2, { color: HABITS[1], accent: HABITS[1] });
    k.walk([60, 4], [100, 12], { speed: 1.0 });
    birds.flock({ centre: abbey.point(-16.5, 0, -16), count: 12, radius: 16, height: 26, speed: 6, seed: 3 });
  }

  if (active.has('town')) {
    const k = crowdKit(people, town, r, birds);
    const wy = waterLevel(town.site.z) - town.site.y;
    // The town crier rings his bell on the steps of the market cross, the crowd gathered to listen
    k.idle(0, 1.7, 0, { y: 0.7, mode: MODE.conduct, color: '#8a2f2a', accent: '#d4a23a' });
    k.gather(0, 0, 4.2, 8, 11, { from: -1.0, span: 2.0 });
    // Guards pace the wall walk between the towers on the side facing the town view
    RING.forEach(([ax, az], i) => {
      const [cx, cz] = RING[(i + 1) % RING.length];
      if ((az + cz) / 2 < 20) return;
      const l = Math.hypot(cx - ax, cz - az), ux = (cx - ax) / l, uz = (cz - az) / l;
      k.walk([ax + ux * 4, az + uz * 4], [cx - ux * 4, cz - uz * 4], { y: 7.0, speed: 0.7, color: '#6a2a24', accent: '#8a8a88' });
    });
    for (let i = 0; i < 10; i++) {
      const side = r() < 0.5 ? -3.4 : 3.4;
      if (i < 5) k.walk([side, 26 + r() * 10], [side, 60 + r() * 26]);
      else k.walk([30 + r() * 10, side], [60 + r() * 28, side]);
    }
    for (let i = 0; i < 8; i++) {
      const off = (r() < 0.5 ? -1 : 1) * (3.2 + r());
      if (i % 2) k.walk([-28, off], [28, off], { speed: 0.9, phase: r() });
      else k.walk([off, -24], [off, 26], { speed: 0.9, phase: r() });
    }
    for (const x of [-4, 4]) {
      k.idle(x, 88, 0, { color: '#6a2a24', accent: '#8a8a88' });
      k.idle(x, -96, Math.PI, { color: '#6a2a24', accent: '#8a8a88' });
    }
    for (let i = 0; i < 4; i++) k.idle(8 + i * 2.4, 124 + r() * 2, r() * 6, { y: wy + 1.4, mode: MODE.work });
    for (let i = 0; i < 4; i++) k.walk([-40 + r() * 20, 120 + r() * 5], [r() * 40, 120 + r() * 5], { y: wy + 1.4 });
    k.gather(-30, 122, 0.5, 2.5, 4, { y: wy + 1.4 });
    for (const h of HALLS) {
      const c = Math.cos(h.ry), sn = Math.sin(h.ry);
      const hp = (x, z) => [h.x + x * c + z * sn, h.z - x * sn + z * c];
      const face = f => f + h.ry;
      // Inside the hall, on its ground floor
      const inside = { y: 0.4 };
      if (h.trade === 'school') k.idle(...hp(-0.8, -2.9), face(0), { ...inside, mode: MODE.conduct, color: '#2e2824', accent: '#1c1a17' });
      if (h.trade === 'lodge') { k.idle(...hp(-0.4, 0.4), face(Math.PI), { ...inside, mode: MODE.work, color: '#3f4f62' }); k.idle(...hp(1.6, 0.2), face(Math.PI * 0.8), inside); }
      if (h.trade === 'ledger') { k.idle(...hp(-1.8, 0.4), face(Math.PI), { ...inside, mode: MODE.work, color: '#3a2e3e' }); k.idle(...hp(1.8, 0.4), face(Math.PI), { ...inside, mode: MODE.work }); }
      if (h.trade === 'racing') for (const [x, z] of [[-0.6, 0.5], [0.9, -1.9]]) k.idle(...hp(x, z), face(z > 0 ? Math.PI : 0), { ...inside, mode: MODE.work, color: WORLD.racing.body, accent: WORLD.racing.trim });
      if (h.trade === 'exchange') {
        // Pairs haggling across the tables under the market house, sellers behind, buyers in front
        for (const [x, z] of [[-3.4, 1.7], [1.8, 1.7], [-1.8, -1.5], [3.4, -1.5]]) {
          k.idle(...hp(x, z - 0.85), face(0), { mode: MODE.conduct, color: '#5a2a2a', accent: '#d8cdb4' });
          k.idle(...hp(x + 0.2, z + 0.9), face(Math.PI), { mode: MODE.conduct, color: k.cloth() });
        }
        for (const [x, z] of [[-5.6, 6.6], [5.6, 7.2]]) {
          k.idle(...hp(x, z), face(Math.PI * 0.5), { mode: MODE.conduct, color: '#2e3a4a' });
          k.idle(...hp(x + 1.0, z + 0.2), face(-Math.PI * 0.5), { mode: MODE.conduct, color: '#8a7a58' });
        }
        k.gather(...hp(0, 4.5), 4.5, 6.5, 4, { from: face(-0.5), span: 1.0 });
      } else if (h.trade === 'school') {
        k.idle(...hp(1.6, 7.3), face(0), { mode: MODE.conduct, color: '#2e2824', accent: '#1c1a17' });
        for (let row = 0; row < 2; row++) {
          for (let i = 0; i < 5; i++) {
            const [x, z] = hp(-2.8 + i * 1.0, 9.9 + row * 1.5);
            people.add({ mode: MODE.sing, a: k.pt(x, z, -0.45), heading: face(Math.PI) + town.rot, color: k.cloth(), accent: '#d8cdb4', phase: r(), scale: 0.72 });
          }
        }
      } else if (h.trade === 'lodge') {
        k.idle(...hp(-1.5, 9.7), face(Math.PI), { mode: MODE.conduct, color: '#3f4f62', accent: '#1c1a17' });
        k.idle(...hp(-2.8, 9.4), face(Math.PI * 0.85), { color: '#7a4a32' });
        k.idle(...hp(-0.2, 9.5), face(-Math.PI * 0.85), { color: '#58603e' });
        k.idle(...hp(2.1, 6.2), face(0), { color: '#5a4a6a', accent: '#d8cdb4' });
        k.idle(...hp(4.6, 10.9), face(Math.PI), { mode: MODE.work, color: '#8a7a58' });
        k.idle(...hp(5.6, 10.9), face(Math.PI), { mode: MODE.work, color: '#6b5a48' });
      } else if (h.trade === 'ledger') {
        k.idle(...hp(-1.5, 8.8), face(Math.PI), { mode: MODE.conduct, color: '#3a2e3e', accent: '#1c1a17' });
        k.gather(...hp(0, 7.4), 2.6, 4, 4, { from: face(-0.6), span: 1.2 });
      } else if (h.trade === 'racing') {
        for (const [x, z] of [[-2.4, 7.6], [0.6, 9.6], [-1.2, 10.2]]) k.idle(...hp(x, z), face(Math.PI * 0.8), { mode: MODE.work, color: WORLD.racing.body, accent: WORLD.racing.trim });
        k.idle(...hp(4.0, 7.2), face(Math.PI), { color: WORLD.racing.body, accent: WORLD.racing.trim });
      }
    }
    birds.flock({ centre: town.point(45, 0, -45), count: 10, radius: 22, height: 40, speed: 7, seed: 5 });
  }

  if (active.has('fair')) {
    const k = crowdKit(people, fair, r, birds);
    k.circle(0, -6, 4.6, 8, { speed: 1.3, arms: 1, colors: ['#a8322d', '#efe6d3', '#2f5a8f', '#c9a13a'], accent: '#efe6d3' });
    for (const [x, z, ry, n] of STALLS) {
      k.idle(x + Math.sin(ry) * -0.1, z + Math.cos(ry) * -0.1, ry);
      const crowd = 1 + Math.ceil(n * 0.7);
      k.gather(x, z, 3.4, 4.6, Math.ceil(crowd / 2), { from: ry + 0.5, span: 0.55 });
      k.gather(x, z, 3.4, 4.6, Math.floor(crowd / 2), { from: ry - 1.05, span: 0.55 });
    }
    for (let i = 0; i < 10; i++) {
      const a0 = r() * Math.PI * 2, a1 = a0 + 0.8 + r() * 1.5, d = 9 + r() * 1.5;
      k.walk([Math.cos(a0) * d, Math.sin(a0) * d - 6], [Math.cos(a1) * d, Math.sin(a1) * d - 6]);
    }
    k.idle(10, 14, 0, { mode: MODE.conduct, color: '#c9a13a', accent: '#a8322d' });
    k.gather(10, 14, 2.5, 4.5, 7, { from: -0.9, span: 1.8 });
    for (let i = 0; i < 4; i++) k.walk([0, 22 + r() * 6], [-30 - r() * 20, -30 - r() * 20]);
    k.idle(38, 7, 0.6, { color: '#58603e' });
    birds.flock({ centre: fair.point(0, 0, -6), count: 8, radius: 26, height: 34, speed: 8, seed: 9 });
  }

  if (active.has('mills')) {
    const k = crowdKit(people, mills, r, birds);
    for (let i = 0; i < 6; i++) k.idle(-34 + i * 14 + (r() - 0.5) * 3, 6.5 - (i % 2) * 0.5, 0, { mode: MODE.work });
    for (let i = 0; i < 5; i++) k.walk([-46 + r() * 20, 3 + r() * 2], [10 + r() * 40, 3 + r() * 2]);
    k.walk([0, 6], [0, 38], { speed: 0.9 });
    k.idle(-17.6, 5.0, Math.PI, { color: '#7a4a32' });
    k.idle(-20.6, 5.2, Math.PI, { color: '#3f4f62' });
    k.idle(-19.1, 4.4, 0, { color: '#8a7a58' });
    k.gather(-2, 30, 1, 3, 3);
  }

  if (active.has('harbour')) {
    const k = crowdKit(people, harbour, r, birds);
    const wy = waterLevel(harbour.site.z) - harbour.site.y;
    // In the taproom: the innkeeper behind the bar, drinkers at it and round the tables
    const tap = (x, z) => [INN.x + x, INN.z + z];
    k.idle(...tap(-2.2, -3.35), 0, { y: 0.4, mode: MODE.conduct, color: '#5a3a2e', accent: '#d8cdb4' });
    for (const x of [-3.4, -1.0]) k.idle(...tap(x, -2.0), Math.PI, { y: 0.4 });
    for (const [x, z, f] of [[-3.9, 0.9, 2.4], [-5.6, -0.3, 0.9], [-1.5, 2.9, 2.6], [4.9, 2.6, -2.2], [3.1, 2.8, 2.0], [4.7, -0.2, -0.8]]) k.idle(...tap(x, z), f, { y: 0.4, mode: x > 0 && z < 0 ? MODE.conduct : MODE.idle });
    // The choir on the green in front of the inn, a conductor before them and a few listening
    const choir = '#34508f';
    for (const [rad, n, from] of [[6, 7, -0.75], [7.4, 8, -0.8]]) {
      for (let i = 0; i < n; i++) {
        const a = from + (i / (n - 1)) * -from * 2;
        const x = 2 + Math.sin(a) * rad, z = 63 - Math.cos(a) * rad;
        people.add({ mode: MODE.sing, a: k.pt(x, z), heading: Math.atan2(2 - x, 63 - z) + harbour.rot, color: choir, accent: '#e8e0cc', phase: i * 0.13 + rad, scale: 0.92 + r() * 0.12 });
      }
    }
    k.idle(2, 61.5, Math.PI, { mode: MODE.conduct, color: '#7a2a24', accent: '#2e2824' });
    k.gather(0, 63, 5.5, 8, 10, { from: -0.8, span: 1.4, y: wy + 1.4 });
    for (let i = 0; i < 6; i++) k.idle(-12 + i * 3 + r(), 70 + r() * 6, r() * 6, { y: wy + 1.4, mode: i % 2 ? MODE.work : MODE.idle });
    for (let i = 0; i < 4; i++) k.walk([-40 + r() * 30, 68 + r() * 8], [10 + r() * 40, 68 + r() * 8], { y: wy + 1.4 });
    k.walk([52, 80], [52, 116], { y: wy + 1.4 });
    k.idle(51, 117, 0.1, { y: wy + 1.4, color: '#3f4f62' });
    k.idle(53.5, 112, 1.6, { y: wy + 1.4, mode: MODE.work });
    birds.flock({ centre: harbour.point(30, 0, 100), count: 14, radius: 30, height: 22, speed: 8, color: '#eeeae0', size: 1.1, seed: 13 });
  }
}
