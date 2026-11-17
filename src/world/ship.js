import { BoxGeometry, PlaneGeometry, Group, Mesh, Vector3, Quaternion, Euler, DoubleSide } from 'three';
import { Builder, SURF, at, buildingMaterial } from './kit.js';
import { Banners } from './banners.js';
import { barrel, crate } from './props.js';
import { swellHeight } from './waves.js';

const BRASS = '#b48c3a';
const ROPE = '#3a3026';
export const GLOBE_AT = new Vector3(-7.8, 5.45, 0);

function hull(b) {
  const L = 22, H = 4.4, B = 7.4;
  const g = new BoxGeometry(L, H, B, 28, 5, 8);
  g.translate(0, H / 2 - 1.7, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = x / (L / 2);
    const h = Math.min(1, Math.max(0, (y + 1.7) / H));
    const wf = Math.max(0.04, Math.pow(Math.max(0, 1 - Math.pow(Math.abs(t), 2.4)), 0.55));
    z *= wf * (0.38 + 0.62 * Math.pow(h, 0.6));
    if (h > 0.5) y += 1.5 * t * t * h;
    x += Math.sign(t) * 1.1 * Math.pow(Math.abs(t), 3) * h;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  b.add(g, at(0, 0, 0), SURF.strake);
}

function sail(b) {
  const W = 10.5, H = 9.2;
  const g = new PlaneGeometry(W, H, 14, 12);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / W + 0.5, v = p.getY(i) / H + 0.5;
    const bulge = 1.5 * Math.sin(Math.PI * u) * Math.sin(Math.PI * (v * 0.8 + 0.12));
    p.setXYZ(i, bulge, p.getY(i), p.getX(i));
  }
  g.computeVertexNormals();
  const stripes = (x, y, z) => (Math.floor((z + W / 2) / (W / 7)) % 2 ? '#a8322d' : '#efe4cf');
  b.add(g, at(1.25, 11.9, 0), SURF.cloth, '#ffffff', stripes);
}

function railing(b, x0, x1, z0, z1, y, h = 0.9) {
  const pts = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  for (let k = 0; k < 3; k++) {
    const [ax, az] = pts[k], [cx, cz] = pts[k + 1];
    const len = Math.hypot(cx - ax, cz - az), n = Math.max(1, Math.round(len / 0.7));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      b.beam([ax + (cx - ax) * t, y, az + (cz - az) * t], [ax + (cx - ax) * t, y + h, az + (cz - az) * t], 0.08);
    }
    b.beam([ax, y + h, az], [cx, y + h, cz], 0.12);
  }
}

function build(b) {
  hull(b);
  b.box(19, 0.16, 6.2, 0.4, 1.95, 0, SURF.plank, '#c0a07a');
  b.box(6.4, 2.3, 6.6, -8.2, 2.0, 0, SURF.plank, '#8a6648');
  b.box(6.8, 0.18, 7.0, -8.2, 4.25, 0, SURF.plank, '#c0a07a');
  railing(b, -11.4, -5.0, -3.4, 3.4, 4.4);
  b.box(1.0, 1.8, 0.1, -5.0, 2.1, 1.6, SURF.plank, '#5a4430', Math.PI / 2);
  for (const z of [-1.8, -0.2]) b.box(0.6, 0.5, 0.06, -4.98, 3.0, z, SURF.glass, '#ffffff', Math.PI / 2);
  b.box(4.0, 1.4, 5.0, 8.6, 2.0, 0, SURF.plank, '#8a6648');
  b.box(4.4, 0.16, 5.4, 8.6, 3.4, 0, SURF.plank, '#c0a07a');
  railing(b, 10.6, 6.6, 2.5, -2.5, 3.55, 0.8);

  b.cylinder(0.32, 19, 1.0, 1.9, 0, SURF.timber, '#8a6648', 10);
  b.cylinder(0.85, 1.0, 1.0, 17.2, 0, SURF.plank, '#7a5a40', 12);
  b.beam([1.25, 16.6, -5.6], [1.25, 16.6, 5.6], 0.22);
  b.beam([1.25, 7.2, -5.2], [1.25, 7.2, 5.2], 0.14);
  sail(b);
  b.beam([8.8, 3.4, 0], [15.5, 6.2, 0], 0.22);
  for (const [x, y, z] of [[15.3, 6.1, 0], [-11.2, 5.4, 0]]) b.beam([1.0, 20.6, 0], [x, y, z], 0.05, SURF.flat, ROPE);
  for (const side of [-1, 1]) {
    for (const x of [-1.2, 0.2, 1.6, 3.0]) b.beam([1.0, 18.4, 0], [x, 2.6, side * 3.25], 0.045, SURF.flat, ROPE);
    for (let y = 4; y < 17; y += 1.6) b.beam([-1.0 + (y - 4) * 0.12, y, side * (3.2 - (y - 2.6) * 0.2)], [3.0 - (y - 4) * 0.1, y, side * (3.2 - (y - 2.6) * 0.2)], 0.03, SURF.flat, ROPE);
  }
  b.beam([-11.0, 4.4, 0], [-8.6, 4.75, 0], 0.16);
  b.beam([-11.6, 4.3, 0], [-11.6, 5.6, 0], 0.14);
  b.box(0.42, 0.55, 0.42, -11.6, 5.6, 0, SURF.glass);
  b.box(0.52, 0.06, 0.52, -11.6, 6.15, 0, SURF.flat, '#2a2420');
  for (let i = 0; i < 4; i++) barrel(b, -2.5 + i * 0.75, 2.03, 2.4);
  for (let i = 0; i < 4; i++) crate(b, 4 + (i % 2) * 0.8, 2.03 + Math.floor(i / 2) * 0.6, -2.2, i * 0.3);
  for (const [x, z] of [[-3.5, -2.3], [5.6, 2.3]]) b.cylinder(0.45, 0.22, x, 2.03, z, SURF.flat, '#8a7656', 12);

  const g = GLOBE_AT;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    b.beam([g.x + Math.cos(a) * 0.55, 4.34, g.z + Math.sin(a) * 0.55], [g.x, g.y - 0.75, g.z], 0.08, SURF.plank, '#6b4f36');
  }
  b.cylinder(0.08, 0.5, g.x, g.y - 1.1, g.z, SURF.plank, '#6b4f36', 8);
  b.torus(0.96, 0.05, g.x, g.y, g.z, SURF.flat, BRASS, Math.PI / 2);
  b.box(0.08, 0.1, 2.0, g.x, g.y - 0.05, g.z, SURF.flat, BRASS);
  b.torus(0.84, 0.035, g.x, g.y, g.z, SURF.flat, BRASS, 0, 0, Math.PI * 1.1);
}

export function buildShip(heraldry, cv, position, heading) {
  const group = new Group();
  const b = new Builder();
  b.groundY = 2;
  build(b);
  const material = buildingMaterial();
  material.side = DoubleSide;
  const mesh = new Mesh(b.build(), material);
  group.add(mesh);

  const banners = new Banners(heraldry);
  banners.add({ pos: new Vector3(1.0, 21.4, 0), along: new Vector3(-1, 0, 0.15), width: 3.6, height: 1.8, uv: heraldry.banner(cv.name, 'swallowtail'), mode: 'flag' });
  const flag = banners.build();
  group.add(flag);

  const yaw = Math.atan2(-heading.z, heading.x);
  const base = position.clone();
  const qYaw = new Quaternion().setFromEuler(new Euler(0, yaw, 0));
  const fwd = new Vector3(heading.x, 0, heading.z).normalize();
  const side = new Vector3(-fwd.z, 0, fwd.x);
  const qTilt = new Quaternion();
  const e = new Euler(0, 0, 0, 'XZY');
  const lantern = new Vector3();

  return {
    group,
    mesh,
    lantern,
    heading: fwd,
    update(t) {
      const h = (dx, dz) => swellHeight(base.x + dx, base.z + dz, t);
      const bow = h(fwd.x * 9, fwd.z * 9), stern = h(-fwd.x * 9, -fwd.z * 9);
      const port = h(side.x * 3.5, side.z * 3.5), star = h(-side.x * 3.5, -side.z * 3.5);
      group.position.set(base.x, (bow + stern + port + star) / 4 - 0.15, base.z);
      e.set(Math.atan((port - star) / 7) * 0.9 + Math.sin(t * 0.7) * 0.012, 0, Math.atan((bow - stern) / 18) * 0.9);
      qTilt.setFromEuler(e);
      group.quaternion.copy(qYaw).multiply(qTilt);
      group.updateMatrixWorld(true);
      group.localToWorld(lantern.set(-11.6, 5.88, 0));
    },
  };
}
