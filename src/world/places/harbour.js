import { Vector3 } from 'three';
import { SURF, at } from '../kit.js';
import { mulberry32, waterLevel, heightAt, riverX } from '../valley.js';
import { Place } from './place.js';
import { house, dovecote, boat, barrel, crate, stoneTower } from '../props.js';

// East bank at the river mouth, facing west over the water; local +x runs out towards the sea
export const place = new Place('harbour', -Math.PI / 2);

// The taproom: a bar along the back with barrels and bottles behind it, a hearth with the
// competition trophies on its mantel, and tables with stools
export const INN = { x: 0, z: 26 };
function innRoom(b, { L, D, y, lamp }) {
  const back = -D / 2, bx = -L * 0.15;
  b.box(L * 0.5, 1.05, 0.55, bx, y, back + 1.5, SURF.plank, '#5a4030');
  b.box(L * 0.5 + 0.2, 0.08, 0.72, bx, y + 1.05, back + 1.5, SURF.plank, '#7a5a40');
  for (let k = 0; k < 2; k++) {
    b.box(L * 0.45, 0.06, 0.3, bx, y + 1.35 + k * 0.55, back + 0.17, SURF.plank, '#6b4f36');
    for (let i = 0; i < 14; i++) b.cylinder(0.05, 0.28, bx - L * 0.21 + i * L * 0.032, y + 1.41 + k * 0.55, back + 0.17, SURF.flat, ['#3e5a3a', '#6b3a2a', '#8a7a4a', '#2e3a4a'][(i + k) % 4], 6);
  }
  for (let i = 0; i < 3; i++) barrel(b, bx + L * 0.27 + i * 0.85, y, back + 0.55);
  const hx = L / 2 - 0.35;
  b.box(0.7, 1.8, 2.2, hx, y, 0, SURF.stone, '#bdb5a3');
  b.box(0.06, 0.95, 1.2, hx - 0.36, y + 0.08, 0, SURF.flat, '#1c1a17');
  b.box(0.95, 0.12, 2.5, hx - 0.1, y + 1.8, 0, SURF.timber);
  for (let k = 0; k < 2; k++) b.beam([hx - 0.5, y + 0.15, -0.35 + k * 0.7], [hx - 0.75, y + 0.2, 0.35 - k * 0.7], 0.1, SURF.timber, '#4a3626');
  for (let k = 0; k < 5; k++) b.blob(0.13 + (k % 2) * 0.06, hx - 0.6, y + 0.35 + (k % 3) * 0.12, -0.3 + k * 0.15, SURF.flat, '#ffb347', [1, 1.8, 1], 1);
  for (let k = 0; k < 5; k++) {
    b.cylinder(0.05, 0.18, hx - 0.12, y + 1.92, -1.0 + k * 0.5, SURF.flat, '#d4a23a', 8);
    b.blob(0.09, hx - 0.12, y + 2.14, -1.0 + k * 0.5, SURF.flat, '#d4a23a', [1, 0.8, 1], 1);
  }
  for (const [x, z] of [[-L * 0.33, 0.3], [-L * 0.16, 2.3], [L * 0.28, 2.2], [L * 0.27, -0.7]]) {
    b.cylinder(0.75, 0.06, x, y + 0.74, z, SURF.plank, '#7a5a40', 14);
    b.cylinder(0.1, 0.74, x, y, z, SURF.timber, '#4a3626', 8);
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + x;
      b.cylinder(0.2, 0.45, x + Math.cos(a) * 1.1, y, z + Math.sin(a) * 1.1, SURF.plank, '#6b4f36', 8);
    }
  }
  lamp(-L * 0.25, 1.2);
  lamp(L * 0.2, 0.8);
  lamp(bx, back + 1.5);
}

export function build({ builder, banners, heraldry, cv }) {
  const r = mulberry32(77);
  const wy = waterLevel(place.site.z) - place.site.y;
  const chimneys = [];
  place.build(builder, b => {
    b.group(at(0, 0, 26), g => {
      house(g, { L: 15, D: 9, floors: 3, storey: 2.8, jetty: 0.45, roof: 'thatch', seed: 81, chimneys, chimney: true, plaster: '#f2e6cc', interior: innRoom });
      g.box(6, 0.2, 2.8, -3, 2.8, 5.7, SURF.shingle);
      for (const x of [-5.8, -0.2]) g.beam([x, 0, 6.9], [x, 2.8, 6.9], 0.18);
      g.beam([3.5, 4.0, 4.7], [3.5, 4.0, 6.6], 0.12);
    });
    b.group(at(-17, 0, 20, Math.PI / 2), g => house(g, { L: 10, D: 6, floors: 1, roof: 'shingle', seed: 82, stoneGround: true }));
    b.group(at(17, 0, 16), dovecote);
    for (let i = 0; i < 5; i++) barrel(b, 8 + i * 0.75, 0, 34 + r());
    b.box(2.6, 0.8, 0.8, -4, 0, 36, SURF.plank, '#6b5038');

    b.box(120, 3, 14, 10, wy - 2, 72, SURF.stone, '#d8d2c4');
    b.box(120, 0.4, 15, 10, wy + 1.0, 72, SURF.stone, '#e8e2d4');
    b.box(10, 3, 40, 52, wy - 2, 98, SURF.stone, '#d8d2c4');
    b.box(11, 0.4, 41, 52, wy + 1.0, 98, SURF.stone, '#e8e2d4');
    for (let x = -40; x <= 60; x += 10) b.cylinder(0.25, 0.8, x, wy + 1.4, 79, SURF.timber, '#ffffff', 8);
    for (let i = 0; i < 8; i++) crate(b, -10 + (i % 4) * 1.2, wy + 1.4 + Math.floor(i / 4) * 0.6, 68 + r(), r());
    for (let i = 0; i < 4; i++) {
      const x = 20 + i * 3;
      b.beam([x, wy + 1.4, 66], [x, wy + 3.6, 66], 0.08);
      b.box(3, 1.8, 0.04, x + 1.5, wy + 1.9, 66, SURF.cloth, '#8a7f66');
    }
    b.box(72, 12, 13, -6, -12, 57.5, SURF.stone, '#d4cdbd');
    b.box(73, 0.35, 13.6, -6, -0.2, 57.5, SURF.stone, '#e6dfd0');
    for (let i = 0; i < 6; i++) b.box(4, (i + 1) * 0.75, 0.9, 6, wy + 1.2, 64.45 + (5 - i) * 0.9, SURF.stone, '#ddd6c6');
    for (const [x, ry] of [[-34, 0.05], [-16, -0.05], [22, 0.08]]) {
      b.group(at(x, 0, 58, ry), g => house(g, { L: 5.5, D: 4.2, floors: 1, roof: 'shingle', seed: 400 + x, chimney: false, plaster: '#e2d6c0' }));
    }
    for (let i = 0; i < 10; i++) crate(b, 50 + (i % 2) * 1.1, wy + 1.4 + Math.floor(i / 6) * 0.6, 84 + (i % 6) * 2.2, r());
    for (let i = 0; i < 6; i++) barrel(b, 54.5, wy + 1.4, 92 + i * 1.6);
    for (const z of [88, 104]) {
      b.beam([51, wy + 1.4, z], [51, wy + 6.5, z], 0.2);
      b.beam([51, wy + 6.3, z], [55, wy + 6.3, z + 2], 0.12);
    }
    boat(b, -20, wy - 0.5, 86, 0.1, 15, '#4f3a2a', true, '#d9cdb2');
    boat(b, 44, wy - 0.45, 96, Math.PI / 2, 9, '#6b4f36', false);
    boat(b, 60, wy - 0.45, 90, Math.PI / 2 - 0.05, 8, '#7a5a40', false);
    boat(b, 44, wy - 0.5, 112, Math.PI / 2 + 0.04, 12, '#5a4030', true, '#e2d4b8');
    boat(b, 8, wy - 0.45, 85, -0.05, 8, '#6b4f36', false);
    boat(b, 64, wy - 0.55, 104, Math.PI / 2 + 0.1, 16, '#5a4030', true, '#d0b48e');
    boat(b, 30, wy - 0.4, 88, 0.3, 7, '#7a5a40', false);
    for (let x = -8; x <= 14; x += 11) {
      b.beam([x, 0, 34], [x, 3.4, 34], 0.12);
      b.box(0.5, 0.6, 0.5, x, 3.4, 34, SURF.glass);
    }
  });
  banners.add({ pos: place.point(3.5, 4.0, 28.0), along: place.dir(0, 1), width: 1.4, height: 1.6, uv: heraldry.banner(`${cv.name} inn`, 'square'), mode: 'hang' });

  // A lighthouse on the highest ground near the mouth
  let best = null;
  for (let z = 8300; z < 9300; z += 60) {
    for (let off = 180; off < 900; off += 60) {
      for (const side of [-1, 1]) {
        const x = riverX(z) + side * off, h = heightAt(x, z);
        if (h > 4 && (!best || h > best.h)) best = { x, z, h };
      }
    }
  }
  let lighthouse = null;
  if (best) {
    const lb = { groundY: best.h };
    builder.groundY = best.h;
    builder.group(at(best.x, best.h - 0.5, best.z), g => {
      stoneTower(g, { w: 6, h: 16, round: true, roof: 'cone' });
      g.cylinder(2.2, 2.6, 0, 16, 0, SURF.glass, '#ffffff', 10);
      g.box(5, 1, 5, 7, 0, 0, SURF.stone);
    });
    lighthouse = new Vector3(best.x, best.h + 17, best.z);
    void lb;
  }

  const extras = [];
  for (const [lx, lz] of [[-40, -20], [30, -30], [-30, -45], [45, -10]]) {
    const [x, z] = place.toWorld(lx, lz);
    extras.push({ x, z, scale: 4 + r() * 1.5, kind: 'broad', stretch: 0.9 });
  }
  return {
    place,
    chimneys: chimneys.concat([place.point(-17, 6, 20)]),
    extras,
    lighthouse,
    groundSize: 200,
    paint: g => {
      g.disc(0, 0, 54, 'rgb(0,0,255)', 10);
      g.disc(-2, 40, 14, 'rgb(170,0,0)', 8);
      g.path([[-2, 40], [-2, 66]], 5);
      g.path([[-2, 30], [-40, 0], [-80, -30], [-110, -50]], 4);
    },
    detail: { radius: 150, count: 21000 },
    view: { pos: place.point(105, 16, 135), look: place.point(-48, 0, 45), subject: place.point(4, 2, 52) },
  };
}
