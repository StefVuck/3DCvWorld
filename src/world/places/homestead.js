import { Vector3 } from 'three';
import { SURF, at } from '../kit.js';
import { mulberry32 } from '../valley.js';
import { Place } from './place.js';
import { postRail, wattle, sheep, chicken, hollow } from '../props.js';

// Local frame: +z is the way the cottage faces (south-west, towards the river and the sun)
export const place = new Place('homestead', -Math.PI / 6);

// Inside the cottage: a study for someone who solders, plays, reads and travels
export const STUDY = { x: -2.4, z: 1.4 };
function study(b, { L, D, y, h, lamp }) {
  const back = -D / 2, wall = -L / 2;
  b.box(0.7, 1.5, 1.7, wall + 0.35, y, 0.6, SURF.stone, '#bdb5a3');
  b.box(0.06, 0.8, 1.0, wall + 0.71, y + 0.08, 0.6, SURF.flat, '#1c1a17');
  b.box(0.9, 0.1, 2.0, wall + 0.45, y + 1.5, 0.6, SURF.timber);
  for (let k = 0; k < 4; k++) b.blob(0.11 + (k % 2) * 0.05, wall + 0.6, y + 0.25 + (k % 2) * 0.12, 0.35 + k * 0.17, SURF.flat, '#ffb347', [1, 1.8, 1], 1);
  // The piano against the back wall, with a stool and music on the stand
  const px = -3.1;
  b.box(1.5, 1.25, 0.6, px, y, back + 0.32, SURF.plank, '#3a2a20');
  b.box(1.42, 0.05, 0.22, px, y + 0.74, back + 0.72, SURF.flat, '#efe9dc');
  b.box(1.42, 0.03, 0.08, px, y + 0.78, back + 0.66, SURF.flat, '#1c1a17');
  b.box(0.5, 0.36, 0.02, px, y + 1.0, back + 0.63, SURF.flat, '#f2ede0', 0, -0.25);
  b.box(0.7, 0.48, 0.38, px, y, back + 1.15, SURF.plank, '#5a4030');
  for (const [x, wy, side] of [[-2.4, 1.6, 1], [3.4, 1.6, 1], [-2.0, 1.45, -1], [2.4, 1.45, -1]]) b.box(0.9, 0.75, 0.03, x, wy, side * (D / 2 - 0.03), SURF.glass);
  // The workbench under the front window: an oscilloscope, a board and a soldering iron
  const wz = D / 2 - 0.45;
  b.box(1.9, 0.8, 0.75, STUDY.x, y, wz, SURF.plank, '#7a5a40');
  b.box(0.55, 0.36, 0.42, STUDY.x - 0.55, y + 0.8, wz + 0.05, SURF.flat, '#4a4844');
  b.box(0.36, 0.24, 0.02, STUDY.x - 0.6, y + 0.88, wz - 0.17, SURF.flat, '#5fae6a');
  b.box(0.42, 0.02, 0.3, STUDY.x + 0.2, y + 0.81, wz - 0.05, SURF.flat, '#2f6a3a');
  for (let k = 0; k < 6; k++) b.box(0.05, 0.03, 0.04, STUDY.x + 0.06 + (k % 3) * 0.1, y + 0.83, wz - 0.12 + Math.floor(k / 3) * 0.12, SURF.flat, '#1c1a17');
  b.beam([STUDY.x + 0.65, y + 0.8, wz], [STUDY.x + 0.5, y + 1.0, wz - 0.15], 0.025, SURF.flat, '#a8322d');
  b.box(0.48, 0.48, 0.42, STUDY.x - 0.1, y, wz - 0.75, SURF.plank, '#5a4030');
  // Books: politics, literature and the arts
  b.box(1.6, 2.1, 0.36, 0.7, y, back + 0.2, SURF.plank, '#5a4030');
  for (let s = 0; s < 4; s++) for (let i = 0; i < 9; i++) b.box(0.14, 0.34 + (i % 3) * 0.04, 0.24, 0.08 + i * 0.155, y + 0.12 + s * 0.5, back + 0.24, SURF.flat, ['#7a2a24', '#2e3a4a', '#3e5a3a', '#8a7a4a', '#5a3a2e', '#c9b48a'][(i + s * 2) % 6]);
  // A map of the world on the end wall, pinned where he has been
  b.box(0.04, 1.1, 1.8, L / 2 - 0.03, y + 1.0, -0.4, SURF.flat, '#d9cba6');
  for (const [z, yy, s] of [[-0.9, 1.6, 0.5], [-0.15, 1.45, 0.55], [0.15, 1.75, 0.35], [-0.6, 1.25, 0.3], [0.3, 1.25, 0.25]]) b.box(0.03, s * 0.5, s, L / 2 - 0.06, y + yy - s * 0.25, z, SURF.flat, '#a3b08a');
  for (let k = 0; k < 12; k++) b.blob(0.03, L / 2 - 0.08, y + 1.25 + ((k * 0.37) % 0.6), -1.1 + ((k * 0.61) % 1.4), SURF.flat, '#a8322d', [1, 1, 1], 0);
  b.box(2.6, 0.02, 1.7, 0.2, y, 0.3, SURF.cloth, '#8a2f2a');
  lamp(-0.6, 0.4);
  lamp(2.4, 0.6);
}

function cottage(b) {
  const L = 9, D = 5.6, H = 3.7, plinth = 0.55;
  b.box(L + 0.2, plinth, D + 0.2, 0, 0, 0, SURF.stone);
  hollow(b, { L, D, y: plinth, h: H - plinth, doorX: 1.2, surf: SURF.plaster, colour: '#ffffff', fill: study });
  b.timberWall(-L / 2, L / 2, plinth, H, -D / 2, { spacing: 1.5 });
  for (const [x0, x1] of [[-L / 2, 0.3], [2.1, L / 2]]) b.timberWall(x0, x1, plinth, H, D / 2, { spacing: 1.5 });
  for (const sx of [1, -1]) {
    b.group(at((sx * L) / 2, 0, 0, (sx * Math.PI) / 2), g => g.timberWall(-D / 2, D / 2, plinth, H, 0, { spacing: 1.4, braces: false }));
  }
  const ridge = b.gableRoof(L, D, H, 49, 0.7, 0.5, SURF.thatch);
  b.cylinder(0.34, L + 1.2, -(L + 1.2) / 2, ridge - 0.42, 0, SURF.thatch, '#d9cdb0', 8, 0, 0, -Math.PI / 2);
  for (const sx of [1, -1]) b.beam([(sx * L) / 2 + sx * 0.06, H, 0], [(sx * L) / 2 + sx * 0.06, ridge - 0.5, 0], 0.17);

  b.box(1.25, ridge + 1.3, 1.1, -L / 2 - 0.5, 0, 0.6, SURF.stone);
  b.box(1.45, 0.18, 1.3, -L / 2 - 0.5, ridge + 1.3, 0.6, SURF.stone, '#b0a99a');
  b.cylinder(0.16, 0.45, -L / 2 - 0.5, ridge + 1.48, 0.6, SURF.flat, '#7a5a44', 8);

  const front = D / 2 + 0.06;
  b.box(0.08, 2.05, 1.05, 0.6, plinth, D / 2 - 0.85, SURF.plank, '#8a6a4c');
  b.box(1.35, 0.16, 0.18, 1.2, plinth + 2.02, front + 0.02, SURF.timber);
  for (const [x, y] of [[-2.4, 1.6], [3.4, 1.6]]) {
    b.box(0.9, 0.75, 0.08, x, y, front, SURF.glass);
    b.box(0.45, 0.8, 0.06, x - 0.7, y - 0.02, front + 0.03, SURF.plank, '#5f7a5c');
    b.box(0.45, 0.8, 0.06, x + 0.7, y - 0.02, front + 0.03, SURF.plank, '#5f7a5c');
    b.box(1.0, 0.18, 0.28, x, y - 0.22, front + 0.12, SURF.plank, '#6b4f36');
    for (let i = 0; i < 5; i++) b.blob(0.13, x - 0.36 + i * 0.18, y - 0.02, front + 0.14, SURF.flat, i % 2 ? '#b8473a' : '#e3c35a', [1, 0.8, 1], 0);
  }
  for (const x of [-2.0, 2.4]) b.box(0.9, 0.75, 0.08, x, 1.45, -front, SURF.glass);
  b.box(0.6, 0.55, 0.08, L / 2 + 0.04, H + 0.45, 0, SURF.glass, '#ffffff', Math.PI / 2);
  b.box(1.6, 0.45, 0.4, -0.6, 0, D / 2 + 0.55, SURF.plank, '#6b5038');
  b.box(0.5, 0.42, 0.5, 2.3, 0, D / 2 + 0.45, SURF.flat, '#8c5a3c');
  b.blob(0.32, 2.3, 0.62, D / 2 + 0.45, SURF.flat, '#4f7a3a', [1, 0.8, 1], 1);
}

function barn(b) {
  const L = 8.5, D = 6, H = 3.6;
  b.box(L, 1.8, D, 0, 0, 0, SURF.stone);
  b.box(L - 0.1, H - 1.8, D - 0.1, 0, 1.8, 0, SURF.plank);
  b.gableRoof(L, D, H, 40, 0.5, 0.22, SURF.shingle, '#ffffff', SURF.plank);
  b.box(2.8, 2.7, 0.14, 0.4, 0, D / 2 + 0.05, SURF.plank, '#6e5236');
  b.beam([0.4 - 1.4, 0.2, D / 2 + 0.14], [0.4 + 1.4, 2.5, D / 2 + 0.14], 0.12);
  b.box(0.7, 0.55, 0.08, -2.8, 2.3, D / 2 + 0.02, SURF.glass);
  b.box(1.2, 1.4, 0.1, 0, 4.4, D / 2 - 0.4, SURF.plank, '#5a4430');
}

function woodshed(b) {
  for (const [x, z] of [[0, 0], [3, 0], [0, 2], [3, 2]]) b.beam([x, 0, z], [x, z === 0 ? 2.3 : 1.9, z], 0.14);
  b.box(3.6, 0.12, 2.8, 1.5, 2.05, 1.0, SURF.shingle, '#ffffff', 0, -0.2);
  const r = mulberry32(9);
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < 10 - (row % 2); i++) {
      const x = 0.2 + i * 0.28 + (row % 2) * 0.14;
      b.cylinder(0.13, 1.3, x, 0.13 + row * 0.25, 0.35, SURF.flat, r() > 0.5 ? '#a07a52' : '#8a6644', 7, 0, Math.PI / 2);
    }
  }
  b.cylinder(0.32, 0.5, 4.0, 0, 0.6, SURF.flat, '#8a6644', 9);
  b.beam([4.0, 0.62, 0.6], [4.25, 0.95, 0.85], 0.07, SURF.flat, '#5a4430');
}

function well(b) {
  b.cylinder(0.9, 0.85, 0, 0, 0, SURF.stone, '#ffffff', 14);
  b.cylinder(0.68, 0.87, 0, 0, 0, SURF.flat, '#1c1a17', 14);
  for (const x of [-0.85, 0.85]) b.beam([x, 0, 0], [x, 2.2, 0], 0.13);
  b.beam([-1.0, 1.9, 0], [1.0, 1.9, 0], 0.11);
  b.gableRoof(2.1, 1.4, 2.2, 38, 0.15, 0.08, SURF.shingle);
  b.cylinder(0.16, 0.26, 0.2, 1.25, 0, SURF.plank, '#7a5c40', 8);
}

function cart(b) {
  b.box(2.3, 0.14, 1.3, 0, 0.72, 0, SURF.plank);
  for (const z of [-0.62, 0.62]) b.box(2.3, 0.32, 0.06, 0, 0.84, z, SURF.plank);
  for (const z of [-0.78, 0.78]) {
    b.cylinder(0.56, 0.09, 0, 0.56, z - 0.045, SURF.plank, '#6b4f36', 14, 0, Math.PI / 2);
    b.cylinder(0.1, 0.12, 0, 0.56, z - 0.06, SURF.timber, '#ffffff', 8, 0, Math.PI / 2);
  }
  for (const z of [-0.45, 0.45]) b.beam([1.1, 0.75, z], [2.9, 0.05, z * 0.7], 0.08);
  b.dome(0.55, 0.45, -0.3, 0.86, 0, SURF.straw, '#ffffff', 10);
}

function dog(b) {
  const brown = '#7a4e2c', dark = '#3b2416', white = '#efe6d6';
  b.blob(1, 0, 0.24, -0.12, SURF.flat, brown, [0.21, 0.21, 0.26], 1);
  b.blob(1, 0, 0.42, 0.04, SURF.flat, brown, [0.17, 0.27, 0.17], 1, 0, -0.35);
  b.blob(1, 0, 0.4, 0.14, SURF.flat, white, [0.11, 0.18, 0.08], 1, 0, -0.35);
  b.blob(1, 0, 0.7, 0.14, SURF.flat, brown, [0.12, 0.12, 0.13], 1);
  b.blob(1, 0, 0.66, 0.27, SURF.flat, '#9a6b44', [0.065, 0.06, 0.1], 1);
  b.blob(0.025, 0, 0.68, 0.365, SURF.flat, dark, [1, 1, 1], 1);
  for (const sx of [-1, 1]) {
    b.blob(1, sx * 0.085, 0.76, 0.1, SURF.flat, dark, [0.045, 0.08, 0.035], 1, 0, 0, sx * 0.5);
    b.cylinder(0.035, 0.36, sx * 0.07, 0.0, 0.13, SURF.flat, brown, 6);
    b.blob(1, sx * 0.07, 0.03, 0.17, SURF.flat, white, [0.045, 0.035, 0.06], 0);
    b.blob(1, sx * 0.13, 0.05, 0.0, SURF.flat, brown, [0.06, 0.05, 0.11], 0);
  }
  b.beam([0, 0.12, -0.33], [0.2, 0.06, -0.5], 0.06, SURF.flat, brown);
}

function skeps(b) {
  b.box(2.2, 0.08, 0.5, 0, 0.5, 0, SURF.plank);
  for (const x of [-0.9, 0.9]) b.beam([x, 0, 0], [x, 0.5, 0], 0.08);
  for (const x of [-0.7, 0, 0.7]) {
    b.dome(0.32, 0.5, x, 0.54, 0, SURF.straw, '#e0c890', 12);
    b.box(0.12, 0.06, 0.04, x, 0.56, 0.3, SURF.flat, '#2a2018');
  }
}

function garden(b, r) {
  const beds = [];
  for (let i = 0; i < 4; i++) {
    const z = 5.4 + i * 2.2;
    beds.push([8.5, 17.5, z]);
    b.box(9.2, 0.18, 0.08, 13, 0, z - 0.75, SURF.plank);
    b.box(9.2, 0.18, 0.08, 13, 0, z + 0.75, SURF.plank);
    for (let x = 9; x < 17.4; x += 0.62) {
      const kind = i % 4;
      const jx = (r() - 0.5) * 0.12;
      if (kind === 0) {
        for (const dz of [-0.35, 0.35]) b.blob(0.22, x + jx, 0.14, z + dz, SURF.flat, r() > 0.5 ? '#6f8f4a' : '#86a35a', [1, 0.7, 1], 1);
      } else if (kind === 1) {
        for (const dz of [-0.4, 0, 0.4]) b.cone(0.07, 0.55 + r() * 0.15, x + jx, 0.05, z + dz, SURF.flat, '#5f8a45', 5);
      } else if (kind === 2) {
        if (Math.round(x * 10) % 3 === 0) b.beam([x, 0, z], [x, 1.9, z], 0.04, SURF.flat, '#8a6a4c');
        b.blob(0.3, x + jx, 0.75 + r() * 0.7, z, SURF.flat, '#4f7a3a', [0.8, 1.4, 0.8], 1);
      } else {
        for (const dz of [-0.3, 0.3]) b.blob(0.18, x + jx, 0.12, z + dz, SURF.flat, r() > 0.3 ? '#7a9a50' : '#a8483a', [1, 0.6, 1], 0);
      }
    }
  }
  wattle(b, [[7.6, 3.6], [18.6, 3.6], [18.6, 13.4], [7.6, 13.4], [7.6, 9.5]]);
  return beds;
}

export function build({ builder }) {
  const r = mulberry32(31);
  place.build(builder, w => {
    w.group(at(0, 0, 0), cottage);
    w.group(at(-15.5, 0, -1.5, Math.PI / 2), barn);
    w.group(at(5.6, 0, -3.4), woodshed);
    w.group(at(-6.5, 0, 9), well);
    w.group(at(-9.5, 0, 6.5, 0.4), cart);
    w.group(at(1.95, 0, 3.75, 0.25), dog);
    w.group(at(-10, 0, -14, 0.2), skeps);
    w.group(at(24, 0, -6), g => {
      g.dome(2.3, 3.4, 0, 0, 0, SURF.straw);
      g.cone(0.5, 0.9, 0, 3.1, 0, SURF.straw, '#c8b080', 8);
    });
    garden(w, r);
    postRail(w, [[19.5, 16], [42, 18], [46, -2], [40, -22], [19.5, -20], [19.5, -8]], r);
    postRail(w, [[-21, 12], [-21, -18], [-6, -24]], r);
    for (let i = 0; i < 11; i++) sheep(w, 23 + r() * 18, -16 + r() * 30, r() * Math.PI * 2, r);
    for (let i = 0; i < 9; i++) chicken(w, -12 + r() * 9, 1 + r() * 9, r() * Math.PI * 2, r);
  });

  const extras = [];
  for (let gz = -11; gz >= -34; gz -= 7.5) {
    for (let gx = -14; gx <= 16; gx += 7) {
      const [x, z] = place.toWorld(gx + (r() - 0.5) * 1.5, gz + (r() - 0.5) * 1.5);
      extras.push({ x, z, scale: 2.4 + r() * 0.8, kind: 'orchard', stretch: 0.85 });
    }
  }
  for (const [lx, lz, s] of [[-24, -4, 6.5], [-26, 14, 5.8], [12, -40, 6.2], [30, 24, 5.5], [-14, 28, 6]]) {
    const [x, z] = place.toWorld(lx, lz);
    extras.push({ x, z, scale: s, kind: 'broad', stretch: 0.95 });
  }
  const bushLines = [
    [[-21, 14], [-21, -18]], [[19, 18], [42, 20]], [[7, 15], [19, 15]], [[-30, -30], [30, -46]], [[48, 0], [42, -24]],
  ];
  for (const [[ax, az], [bx, bz]] of bushLines) {
    const len = Math.hypot(bx - ax, bz - az);
    for (let d = 0; d < len; d += 2.2 + r() * 2) {
      if (r() < 0.25) continue;
      const t = d / len;
      const [x, z] = place.toWorld(ax + (bx - ax) * t + (r() - 0.5) * 1.5, az + (bz - az) * t + (r() - 0.5) * 1.5);
      extras.push({ x, z, scale: 0.9 + r() * 0.9, kind: 'broad', stretch: 0.7 });
    }
  }
  return {
    place,
    chimneys: [place.point(-5, 9.6, 0.6)],
    extras,
    groundSize: 220,
    paint: g => {
      g.disc(0, 0, 58, 'rgb(0,0,255)', 10);
      g.disc(-7, 5, 10, 'rgb(200,0,0)', 4);
      g.path([[1.2, 3], [1, 12], [-4, 24], [-4, 40], [-1, 60], [8, 85], [6, 110]], 2.4);
      g.path([[-6.5, 8], [-1, 14]], 1.6);
      g.path([[-13, 2], [-15, -4]], 1.6);
      g.rect(8.2, 4.3, 17.8, 12.6, 'rgb(0,255,0)');
    },
    detail: { radius: 150, count: 70000 },
    view: { pos: place.point(9, 6.5, 31), look: place.point(-3, 2.6, -2), subject: place.point(-3, 3, -2) },
  };
}
