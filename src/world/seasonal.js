import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Mesh, Points, ShaderMaterial, Vector3 } from 'three';
import { Builder, SURF, at, buildingMaterial } from './kit.js';
import { MODE, CLOTH } from './people.js';
import { buildWindowGlows } from './glow.js';
import { shared } from '../atmosphere.js';
import { mulberry32 } from './valley.js';

// Scenes that come and go with the months: sowing in spring, haymaking in summer, harvest and
// Bonfire Night in autumn, snowmen through the winter and a Yule tree with carollers in December.
// Everything is built once and shown or hidden by tag as the month changes.

// Ground already taken in a settlement (walls, stalls, figures, carts), in one-metre cells
function occupancy(p, builder, people, carts) {
  const cells = new Set();
  const key = (x, z) => Math.floor(x) * 65536 + Math.floor(z);
  const y0 = p.place.site.y;
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), q = new Vector3();
  for (let i = p.parts[0]; i < p.parts[1]; i++) {
    const pos = builder.parts[i].attributes.position;
    for (let t = 0; t < pos.count; t += 3) {
      a.fromBufferAttribute(pos, t); b.fromBufferAttribute(pos, t + 1); c.fromBufferAttribute(pos, t + 2);
      if (Math.max(a.y, b.y, c.y) < y0 + 0.15 || Math.min(a.y, b.y, c.y) > y0 + 3) continue;
      const n = Math.min(60, Math.ceil(Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) / 0.7));
      for (let s = 0; s <= n; s++) for (let u = 0; s + u <= n; u++) {
        q.copy(a).addScaledVector(b.clone().sub(a), s / n).addScaledVector(c.clone().sub(a), u / n);
        cells.add(key(q.x, q.z));
      }
    }
  }
  const line = (from, to) => {
    const n = Math.ceil(from.distanceTo(to) / 0.8) || 1;
    for (let s = 0; s <= n; s++) cells.add(key(from.x + (to.x - from.x) * s / n, from.z + (to.z - from.z) * s / n));
  };
  for (const f of people.list) {
    if (f.mode === MODE.circle) for (let k = 0; k < 16; k++) cells.add(key(f.a.x + Math.cos(k / 2.5) * f.radius, f.a.z + Math.sin(k / 2.5) * f.radius));
    else line(f.a, f.b);
  }
  for (const t of carts.list) line(t.a, t.b);
  return {
    // The nearest clear disc to a spot in the settlement's own frame
    find(lx, lz, r) {
      for (let d = 0; d < 40; d += 0.75) {
        for (let k = 0; k < Math.max(1, Math.round(d * 2)); k++) {
          const ang = (k / Math.max(1, Math.round(d * 2))) * Math.PI * 2;
          const w = p.place.point(lx + Math.cos(ang) * d, 0, lz + Math.sin(ang) * d);
          let ok = true;
          for (let x = -r; x <= r && ok; x += 0.7) for (let z = -r; z <= r && ok; z += 0.7) {
            if (x * x + z * z <= r * r && cells.has(key(w.x + x, w.z + z))) ok = false;
          }
          if (ok) {
            for (let x = -r; x <= r; x += 0.7) for (let z = -r; z <= r; z += 0.7) cells.add(key(w.x + x, w.z + z));
            return w;
          }
        }
      }
      return p.place.point(lx, 0, lz);
    },
  };
}

function snowman(b, x, z, ry, s = 1) {
  b.blob(0.62 * s, x, 0.5 * s, z, SURF.plaster, '#f4f4f2', [1, 0.85, 1], 2);
  b.blob(0.45 * s, x, 1.25 * s, z, SURF.plaster, '#f4f4f2', [1, 0.9, 1], 2);
  b.blob(0.3 * s, x, 1.82 * s, z, SURF.plaster, '#f4f4f2', [1, 1, 1], 2);
  const f = new Vector3(Math.sin(ry), 0, Math.cos(ry)), side = new Vector3(f.z, 0, -f.x);
  for (const k of [-1, 1]) b.blob(0.035 * s, x + f.x * 0.27 * s + side.x * k * 0.1 * s, 1.9 * s, z + f.z * 0.27 * s + side.z * k * 0.1 * s, SURF.flat, '#1c1a17', [1, 1, 1], 1);
  for (let k = 0; k < 3; k++) b.blob(0.04 * s, x + f.x * 0.44 * s, (1.1 + k * 0.17) * s, z + f.z * 0.44 * s, SURF.flat, '#1c1a17', [1, 1, 1], 1);
  b.cone(0.045 * s, 0.22 * s, 0, 0, 0, SURF.flat, '#d8742a', 8);
  const nose = b.parts.pop();
  nose.rotateX(Math.PI / 2).rotateY(ry).translate(x + f.x * 0.3 * s, 1.82 * s + b.groundY, z + f.z * 0.3 * s);
  b.parts.push(nose);
  for (const k of [-1, 1]) {
    const from = [x + side.x * k * 0.4 * s, 1.35 * s, z + side.z * k * 0.4 * s];
    b.beam(from, [from[0] + side.x * k * 0.55 * s, 1.75 * s, from[2] + side.z * k * 0.55 * s], 0.035 * s, SURF.timber, '#4a3626');
  }
  b.cylinder(0.33 * s, 0.05 * s, x, 2.05 * s, z, SURF.flat, '#2a2420', 12);
  b.cylinder(0.21 * s, 0.32 * s, x, 2.08 * s, z, SURF.flat, '#2a2420', 12);
  b.torus(0.35 * s, 0.06 * s, x, 1.55 * s, z, SURF.cloth, '#a8322d', Math.PI / 2);
}

function yuleTree(b, x, z) {
  b.cylinder(0.25, 1.2, x, 0, z, SURF.timber, '#4a3626', 8);
  [[2.6, 2.8, 0.9], [2.1, 2.6, 2.6], [1.6, 2.3, 4.1], [1.0, 2.0, 5.5]].forEach(([r, h, y]) => b.cone(r, h, x, y, z, SURF.needles, '#2a4630', 10));
  b.blob(0.32, x, 7.6, z, SURF.glass, '#ffd27a', [1, 1, 1], 1);
  const rnd = mulberry32(12);
  const lights = [];
  for (let k = 0; k < 34; k++) {
    const y = 1.2 + rnd() * 5.8, r = 2.6 * (1 - (y - 1) / 7) + 0.1, a = rnd() * Math.PI * 2;
    const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    if (k % 3) b.blob(0.13, px, y, pz, SURF.flat, ['#a8322d', '#d4a23a', '#e9e2d0'][k % 3], [1, 1, 1], 1);
    else { b.blob(0.09, px, y, pz, SURF.glass, '#ffd27a', [1, 1, 1], 1); lights.push([px, y, pz]); }
  }
  return lights;
}

function bonfire(b, x, z) {
  const rnd = mulberry32(5);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2 + rnd() * 0.3, r = 2.0 + rnd() * 0.5;
    b.beam([x + Math.cos(a) * r, 0, z + Math.sin(a) * r], [x + Math.cos(a) * 0.2, 3.6 + rnd() * 0.6, z + Math.sin(a) * 0.2], 0.12 + rnd() * 0.06, SURF.timber, '#5a4430');
  }
  for (let k = 0; k < 9; k++) {
    const a = rnd() * Math.PI * 2, r = rnd() * 1.4;
    b.blob(0.5 + rnd() * 0.5, x + Math.cos(a) * r, 0.6 + rnd() * 1.8, z + Math.sin(a) * r, SURF.glass, '#ff9a3a', [1, 1.7, 1], 1);
  }
}

function haystack(b, x, z, s = 1) {
  b.cylinder(1.7 * s, 0.9 * s, x, 0, z, SURF.flat, '#c4a050', 14, 0, 0, 0, 1.8 * s);
  b.blob(1.8 * s, x, 0.9 * s, z, SURF.flat, '#cfaa58', [1, 1.15, 1], 2);
}

function stook(b, x, z) {
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    b.beam([x + Math.cos(a) * 0.45, 0, z + Math.sin(a) * 0.45], [x + Math.cos(a) * 0.08, 1.3, z + Math.sin(a) * 0.08], 0.16, SURF.flat, '#d2ad5a');
  }
}

function harvestPile(b, x, z) {
  b.box(2.6, 0.08, 1.2, x, 0.8, z, SURF.plank, '#7a5a40');
  for (const dx of [-1.1, 1.1]) for (const dz of [-0.45, 0.45]) b.beam([x + dx, 0, z + dz], [x + dx, 0.8, z + dz], 0.06);
  for (let k = 0; k < 7; k++) b.blob(0.2, x - 1.0 + k * 0.33, 1.02, z - 0.2 + (k % 2) * 0.35, SURF.flat, '#d8742a', [1, 0.8, 1], 1);
  for (let k = 0; k < 3; k++) b.blob(0.42, x - 1.2 + k * 1.0, 0.36, z + 1.1, SURF.flat, '#d06a24', [1, 0.75, 1], 2);
  for (const dx of [-1.6, 1.7]) {
    b.cylinder(0.36, 0.7, x + dx, 0, z - 1.1, SURF.plank, '#8a6a4c', 10);
    for (let k = 0; k < 5; k++) b.blob(0.1, x + dx - 0.18 + (k % 3) * 0.18, 0.74, z - 1.1 - 0.1 + (k >> 1) * 0.15, SURF.flat, dx < 0 ? '#a8322d' : '#7a9a3a', [1, 1, 1], 1);
  }
}

// Fireworks over the town on November nights, bursting high enough to be seen from the stops
function buildFireworks(centre) {
  const bursts = 7, sparks = 70;
  const pos = [], dir = [], info = [];
  const rnd = mulberry32(1105);
  for (let k = 0; k < bursts; k++) {
    const c = [centre.x + (rnd() - 0.5) * 110, centre.y + 18 + rnd() * 18, centre.z + (rnd() - 0.5) * 50];
    const hue = Math.floor(rnd() * 5), phase = rnd(), period = 3.2 + rnd() * 2.4;
    for (let i = 0; i < sparks; i++) {
      const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      pos.push(...c);
      dir.push(Math.cos(a) * s, u, Math.sin(a) * s);
      info.push(hue, phase, period, 0.85 + rnd() * 0.3);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('aDir', new Float32BufferAttribute(dir, 3));
  g.setAttribute('aInfo', new Float32BufferAttribute(info, 4));
  const material = new ShaderMaterial({
    uniforms: { uTime: shared.uTime, uWindowGlow: shared.uWindowGlow },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uWindowGlow;
      attribute vec3 aDir;
      attribute vec4 aInfo;
      varying vec3 vColor;
      varying float vA;
      void main() {
        float t = fract(uTime / aInfo.z + aInfo.y);
        float life = t * aInfo.z;
        vec3 p = position + aDir * 22.0 * aInfo.w * (1.0 - exp(-life * 1.6)) - vec3(0.0, 2.2 * life * life, 0.0);
        int h = int(aInfo.x + 0.5);
        vColor = h == 0 ? vec3(1.0, 0.45, 0.3) : h == 1 ? vec3(1.0, 0.85, 0.4) : h == 2 ? vec3(0.5, 0.75, 1.0) : h == 3 ? vec3(0.6, 1.0, 0.55) : vec3(1.0, 0.6, 0.9);
        float night = smoothstep(0.3, 0.75, uWindowGlow);
        vA = night * (1.0 - smoothstep(0.15, 0.55, t)) * step(t, 0.6) * (0.8 + 0.2 * sin(uTime * 30.0 + aInfo.w * 40.0));
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp(1400.0 / -mv.z, 1.5, 7.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vA;
      void main() {
        float r = length(gl_PointCoord - 0.5);
        float a = (1.0 - smoothstep(0.1, 0.5, r)) * vA;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor * a * 1.6, 1.0);
      }
    `,
  });
  const points = new Points(g, material);
  points.frustumCulled = false;
  points.renderOrder = 7;
  return points;
}

// The tree and the bonfire are drawn at a small size and then scaled up about their base
const YULE = 1.9, FIRE = 2.2;
function grow(b, w, s) {
  for (const g of b.parts) g.translate(-w.x, 0, -w.z).scale(s, s, s).translate(w.x, w.y, w.z);
}

export function buildSeasonal({ places, builder, people, carts, meshHeight }) {
  const byId = id => places.find(p => p.place.id === id);
  const material = buildingMaterial();
  const meshes = [], glows = [];
  const rnd = mulberry32(1225);
  const cloth = () => CLOTH[Math.floor(rnd() * CLOTH.length)];
  const free = new Map();
  const spot = (p, lx, lz, r) => {
    if (!free.has(p)) free.set(p, occupancy(p, builder, people, carts));
    return free.get(p).find(lx, lz, r);
  };
  const ground = w => meshHeight(w.x, w.z);
  const make = (tag, fn, where) => {
    const b = new Builder();
    b.groundY = 0;
    fn(b);
    const mesh = new Mesh(b.build(), material);
    mesh.userData.tag = tag;
    mesh.geometry.computeBoundingSphere();
    meshes.push({ mesh, points: where.map(w => w.clone().setY(w.y + 2)) });
  };
  const figure = (tag, w, o = {}) => {
    people.tag = tag;
    people.add({ a: w.clone().setY(ground(w)), heading: o.heading ?? 0, mode: o.mode ?? MODE.idle, color: o.color ?? cloth(), accent: o.accent ?? '#d8cdb4', phase: rnd(), scale: o.scale ?? 0.9 + rnd() * 0.15 });
  };
  const facing = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

  const town = byId('town'), home = byId('homestead'), abbey = byId('abbey'), fair = byId('fair');

  // December: a Yule tree in the square with carollers in front of it
  if (town) {
    const w = spot(town, 0, -13, 5.6);
    w.y = ground(w);
    let lights;
    make('season:yule', b => { lights = yuleTree(b, w.x, w.z); grow(b, w, YULE); }, [w]);
    const glow = buildWindowGlows(lights.map(([x, y, z]) => new Vector3(w.x + (x - w.x) * YULE, w.y + y * YULE, w.z + (z - w.z) * YULE)));
    glow.userData.tag = 'season:yule';
    glows.push({ mesh: glow, place: places.indexOf(town) });
    const towards = town.place.point(0, 0, 0).sub(w).setY(0).normalize();
    for (let i = 0; i < 7; i++) {
      const a = (i - 3) * 0.32, d = towards.clone().applyAxisAngle(new Vector3(0, 1, 0), a);
      const c = w.clone().addScaledVector(d, 10 + (i % 2) * 0.8);
      people.tag = 'season:yule';
      people.add({ mode: MODE.sing, a: c.setY(ground(c)), heading: facing(c, w), color: ['#2f5a3a', '#8a2f2a', '#3f4f62'][i % 3], accent: '#efe6d3', phase: i * 0.17, scale: 0.92 });
    }
    const lead = w.clone().addScaledVector(towards, 7.6);
    figure('season:yule', lead, { mode: MODE.conduct, heading: facing(lead, w.clone().addScaledVector(towards, 12)), color: '#2e2824', accent: '#a8322d' });
  }

  // Winter: snowmen about the valley, children playing round the one in town
  {
    const where = [[town, 18, 30], [home, -9, 16], [abbey, 30, 22], [fair, -12, 12]].filter(([p]) => p).map(([p, x, z]) => ({ p, w: spot(p, x, z, 1.6) }));
    for (const { w } of where) w.y = ground(w);
    if (where.length) make('season:snow', b => {
      where.forEach(({ p, w }, i) => {
        const at0 = b.parts.length;
        snowman(b, w.x, w.z, facing(w, p.place.centre) + (i - 1.5) * 0.3, i === 0 ? 1.1 : 0.95);
        for (let k = at0; k < b.parts.length; k++) b.parts[k].translate(0, w.y, 0);
      });
    }, where.map(e => e.w));
    const t = where[0]?.w;
    people.tag = 'season:snow';
    if (t && town) for (let i = 0; i < 4; i++) people.add({ mode: MODE.circle, a: t.clone(), radius: 2.4, speed: 1.6, arms: 1, phase: i / 4, color: ['#a8322d', '#2f5a8f', '#c9a13a', '#3f7a42'][i], accent: '#efe6d3', scale: 0.62 });
  }

  // November: a bonfire on the green inside the town walls, and fireworks over the roofs
  if (town) {
    const w = spot(town, -66, 14, 11);
    w.y = ground(w);
    make('season:bonfire', b => { bonfire(b, w.x, w.z); grow(b, w, FIRE); }, [w]);
    const flames = [];
    for (let k = 0; k < 7; k++) flames.push(new Vector3(w.x + Math.cos(k) * 0.9 * FIRE, w.y + (1.0 + (k % 3) * 0.9) * FIRE, w.z + Math.sin(k) * 0.9 * FIRE));
    const glow = buildWindowGlows(flames);
    glow.userData.tag = 'season:bonfire';
    glows.push({ mesh: glow, place: places.indexOf(town) });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + rnd() * 0.2, d = 11 + rnd() * 3;
      const c = new Vector3(w.x + Math.cos(a) * d, 0, w.z + Math.sin(a) * d);
      figure('season:bonfire', c, { heading: facing(c, w) });
    }
    const fw = buildFireworks(town.place.point(-15, 0, -60));
    fw.userData.tag = 'season:bonfire';
    meshes.push({ mesh: fw, always: true });
  }

  // September and October: the harvest, sheaves stooked in the homestead's field and a stall of
  // apples and squashes in the town square
  if (home && town) {
    const field = home.place.point(-20, 0, 7);
    const stooks = [];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const s = home.place.point(-14 - i * 3.5 - (j % 2) * 1.5, 0, 2 + j * 3);
      s.y = ground(s);
      stooks.push(s);
    }
    const pile = spot(town, -8, -9, 2.4);
    pile.y = ground(pile);
    make('season:harvest', b => {
      for (const s of stooks) { const k = b.parts.length; stook(b, s.x, s.z); for (let q = k; q < b.parts.length; q++) b.parts[q].translate(0, s.y, 0); }
      const k = b.parts.length;
      harvestPile(b, pile.x, pile.z);
      for (let q = k; q < b.parts.length; q++) b.parts[q].translate(0, pile.y, 0);
    }, [field, pile]);
    for (let i = 0; i < 3; i++) figure('season:harvest', home.place.point(-16 - i * 4, 0, 4 + i * 2.5), { mode: MODE.work, heading: rnd() * 6 });
    figure('season:harvest', pile.clone().add(new Vector3(0, 0, -1.6).applyAxisAngle(new Vector3(0, 1, 0), town.place.rot)), { mode: MODE.conduct, color: '#7a4a32' });
    for (let i = 0; i < 3; i++) figure('season:harvest', pile.clone().add(new Vector3(-1.5 + i * 1.5, 0, 3).applyAxisAngle(new Vector3(0, 1, 0), town.place.rot)), { heading: town.place.rot + Math.PI });
  }

  // Summer: haymaking by the homestead
  if (home) {
    const stacks = [[-19, 6], [-25, 2], [-15, 11]].map(([x, z]) => { const s = home.place.point(x, 0, z); s.y = ground(s); return s; });
    make('season:hay', b => {
      stacks.forEach((s, i) => { const k = b.parts.length; haystack(b, s.x, s.z, 0.9 + i * 0.1); for (let q = k; q < b.parts.length; q++) b.parts[q].translate(0, s.y, 0); });
    }, stacks);
    for (let i = 0; i < 4; i++) figure('season:hay', home.place.point(-14 - i * 3.5, 0, 3 + (i % 2) * 5), { mode: MODE.work, heading: rnd() * 6, color: i % 2 ? '#d8cdb4' : cloth() });
  }

  // March and April: sowers walking the furrows of the homestead's field
  if (home) {
    people.tag = 'season:sowing';
    for (let i = 0; i < 3; i++) {
      const a = home.place.point(-13 - i * 4, 0, 1), b = home.place.point(-19 - i * 4, 0, 13);
      a.y = ground(a); b.y = ground(b);
      people.add({ mode: MODE.walk, a, b, speed: 0.5, color: '#8a7a58', accent: '#d8cdb4', phase: i * 0.3, scale: 0.95, arms: 1 });
    }
  }

  return { meshes, glows };
}
