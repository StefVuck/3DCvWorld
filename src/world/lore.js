import {
  Vector3, Group, Mesh, BufferGeometry, BufferAttribute, ShaderMaterial, DataTexture, RGBAFormat, FloatType, LinearFilter,
  ClampToEdgeWrapping, CanvasTexture, InstancedMesh, InstancedBufferAttribute, DoubleSide,
} from 'three';
import { Builder, SURF, at, buildingMaterial } from './kit.js';
import { boat, crate, WINDOWS } from './props.js';
import { anchor } from './links.js';
import { riverX, riverWidth, waterLevel, heightAt, SITES } from './valley.js';
import { shared } from '../atmosphere.js';
import { atmosphereUniforms, noise, sky, terrainShadow, localShadow } from '../shaders/common.js';
import { MODE } from './people.js';
import { buildWindowGlows } from './glow.js';
import { drawFlag } from './heraldry.js';
import { WORLD } from '../world-config.js';
import { HALLS } from './places/town.js';
import { STOPS } from '../journey.js';
import { WINTER_SNOW_LINE } from '../season.js';
import { LOW } from '../quality.js';
import { buildSeasonal } from './seasonal.js';
import { mulberry32 } from './valley.js';

const UP = new Vector3(0, 1, 0);
const site = id => SITES.find(s => s.id === id);

// Static pieces are grouped by area, each its own mesh, so a stop that cannot see an area skips it
class Areas {
  constructor() {
    this.material = buildingMaterial();
    this.list = new Map();
  }

  build(key, fn, groundY = 0) {
    if (!this.list.has(key)) this.list.set(key, { b: new Builder(), points: [] });
    const a = this.list.get(key);
    a.b.groundY = groundY;
    fn(a.b);
  }

  meshes() {
    return [...this.list.entries()].map(([key, a]) => {
      const mesh = new Mesh(a.b.build(), this.material);
      mesh.geometry.computeBoundingSphere();
      mesh.userData.tag = key;
      return mesh;
    });
  }
}

// ---------------------------------------------------------------------------------------------
// Roads between the settlements on the east bank, draped over the ground
function roadPath(from, to, meshHeight) {
  const a = new Vector3(from.x, 0, from.z), b = new Vector3(to.x, 0, to.z);
  const dir = b.clone().sub(a).normalize();
  const start = a.clone().addScaledVector(dir, from.r + 12), end = b.clone().addScaledVector(dir, -(to.r + 12));
  const len = start.distanceTo(end), n = Math.ceil(len / 8);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = start.clone().lerp(end, t);
    p.x += Math.sin(t * Math.PI * 3) * 8 * Math.sin(t * Math.PI);
    p.x = Math.max(p.x, riverX(p.z) + riverWidth(p.z) / 2 + 30);
    p.y = meshHeight(p.x, p.z);
    pts.push(p);
  }
  return pts;
}

function roadMesh(pts) {
  const pos = [], side = [], idx = [];
  pts.forEach((p, i) => {
    const q = pts[Math.min(i + 1, pts.length - 1)], o = pts[Math.max(i - 1, 0)];
    const d = q.clone().sub(o).setY(0).normalize();
    const s = new Vector3(-d.z, 0, d.x);
    for (const k of [-1, 1]) {
      const v = p.clone().addScaledVector(s, k * 1.7).setY(p.y + 0.22);
      pos.push(v.x, v.y, v.z);
      side.push(k, i * 8);
    }
    if (i) idx.push((i - 1) * 2, i * 2, (i - 1) * 2 + 1, (i - 1) * 2 + 1, i * 2, i * 2 + 1);
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('aSide', new BufferAttribute(new Float32Array(side), 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return new Mesh(g, ROAD_MATERIAL());
}

let roadMaterial = null;
const ROAD_MATERIAL = () => roadMaterial ??= new ShaderMaterial({
  uniforms: { ...shared },
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -4,
  vertexShader: /* glsl */ `
    attribute vec2 aSide;
    varying vec3 vWorld;
    varying vec2 vSide;
    void main() {
      vSide = aSide;
      vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    ${atmosphereUniforms}
    ${noise}
    ${sky}
    ${terrainShadow}
    ${localShadow}
    varying vec3 vWorld;
    varying vec2 vSide;
    void main() {
      float edge = abs(vSide.x) + (vnoise(vWorld.xz * 0.9) - 0.5) * 0.5;
      if (edge > 0.95) discard;
      float ruts = smoothstep(0.08, 0.0, abs(abs(vSide.x) - 0.45)) * 0.18;
      vec3 dirt = mix(srgb(vec3(0.6, 0.52, 0.38)), srgb(vec3(0.5, 0.43, 0.31)), vnoise(vWorld.xz * 0.35) * 0.6 + ruts);
      dirt = mix(dirt, srgb(vec3(0.42, 0.5, 0.3)), smoothstep(0.55, 0.95, edge) * 0.6);
      float sh = terrainShadow(vWorld, uSunDir) * localShadowAt(vWorld, vec3(0.0, 1.0, 0.0));
      vec3 col = dirt * (uSunColor * max(uSunDir.y, 0.0) * 0.9 * sh + uAmbient);
      gl_FragColor = vec4(applyAtmosphere(col, vWorld), 1.0);
    }
  `,
});

// Painted signboards: one atlas of arms, each with a stop's name
class Signs {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024;
    this.canvas.height = 2048;
    this.texture = new CanvasTexture(this.canvas);
    this.labels = [];
    this.quads = [];
  }

  // A board pointing along dir from pos, reading text on both faces
  add(pos, dir, text, plain = false, w = 1.9) {
    const i = this.labels.length;
    this.labels.push({ text, plain });
    const d = dir.clone().setY(0).normalize(), s = new Vector3(-d.z, 0, d.x);
    const h = 0.36;
    for (const face of [1, -1]) {
      const off = s.clone().multiplyScalar(0.03 * face);
      const p0 = pos.clone().add(off), p1 = pos.clone().add(off).addScaledVector(d, w);
      this.quads.push({ p0, p1, h, i, flip: face < 0 });
    }
  }

  draw() {
    // Each name twice: pointing right for the front of an arm, pointing left for its back
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, 1024, 2048);
    this.labels.forEach(({ text, plain }, i) => {
      for (const back of [0, 1]) {
        const y = (i * 2 + back) * 64;
        ctx.fillStyle = '#7a5a3c';
        ctx.beginPath();
        if (plain) ctx.rect(0, y + 4, 1024, 56);
        else if (back) { ctx.moveTo(1024, y + 4); ctx.lineTo(64, y + 4); ctx.lineTo(4, y + 32); ctx.lineTo(64, y + 60); ctx.lineTo(1024, y + 60); }
        else { ctx.moveTo(0, y + 4); ctx.lineTo(960, y + 4); ctx.lineTo(1020, y + 32); ctx.lineTo(960, y + 60); ctx.lineTo(0, y + 60); }
        ctx.fill();
        ctx.fillStyle = '#f2e6cc';
        ctx.font = 'italic 40px "IM Fell English", Georgia, serif';
        ctx.textBaseline = 'middle';
        ctx.textAlign = plain ? 'center' : back ? 'right' : 'left';
        ctx.fillText(text, plain ? 512 : back ? 998 : 26, y + 33);
      }
    });
    this.texture.needsUpdate = true;
  }

  mesh() {
    const pos = [], uv = [];
    for (const q of this.quads) {
      const row = q.i * 2 + (q.flip ? 1 : 0);
      const v0 = 1 - (row * 64) / 2048, v1 = 1 - (row * 64 + 64) / 2048;
      const a = q.p0, b = q.p1, top = q.h / 2;
      const corners = [[a, -top, 0], [b, -top, 1], [b, top, 1], [a, top, 0]];
      const tri = [0, 1, 2, 0, 2, 3];
      for (const t of tri) {
        const [p, dy, u] = corners[t];
        pos.push(p.x, p.y + dy, p.z);
        uv.push(q.flip ? 1 - u : u, dy < 0 ? v1 : v0);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
    g.computeBoundingSphere();
    this.draw();
    return new Mesh(g, new ShaderMaterial({
      uniforms: { ...shared, uMap: { value: this.texture } },
      side: DoubleSide,
      vertexShader: 'varying vec2 vUv; varying vec3 vWorld; void main() { vUv = uv; vWorld = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0); }',
      fragmentShader: /* glsl */ `
        ${atmosphereUniforms}
        ${noise}
        ${sky}
        uniform sampler2D uMap;
        varying vec2 vUv;
        varying vec3 vWorld;
        void main() {
          vec4 t = texture(uMap, vUv);
          if (t.a < 0.5) discard;
          vec3 col = pow(t.rgb, vec3(2.2)) * (uSunColor * 0.6 + uAmbient);
          gl_FragColor = vec4(applyAtmosphere(col, vWorld), 1.0);
        }
      `,
    }));
  }
}

// ---------------------------------------------------------------------------------------------
// Boats drifting down the river, steered by a texture of the river's course
function riverCraft(count) {
  const Z0 = -3600, Z1 = 8700, N = 512;
  const data = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const z = Z0 + ((Z1 - Z0) * i) / (N - 1);
    data.set([riverX(z), waterLevel(z), riverWidth(z), 0], i * 4);
  }
  const tex = new DataTexture(data, N, 1, RGBAFormat, FloatType);
  tex.minFilter = tex.magFilter = LinearFilter;
  tex.wrapS = tex.wrapT = ClampToEdgeWrapping;
  tex.needsUpdate = true;
  const group = new Group();
  const kinds = [
    { n: count[0], make: b => boat(b, 0, 0, 0, 0, 7, '#6b4f36', true, '#e2d4b8'), speed: [2.0, 3.0] },
    { n: count[1], make: b => { boat(b, 0, 0, 0, 0, 13, '#4f3a2a', false); for (let k = 0; k < 4; k++) crate(b, -3 + k * 1.6, 0.65, (k % 2) * 0.6 - 0.3, k * 0.4); }, speed: [1.1, 1.6] },
  ];
  const material = new ShaderMaterial({
    uniforms: { ...shared, uRiver: { value: tex }, uRange: { value: new Vector3(Z0, Z1, 0) } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute vec4 aBoat;
      uniform float uTime;
      uniform sampler2D uRiver;
      uniform vec3 uRange;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec3 vColor;
      vec4 river(float z) { return texture(uRiver, vec2((z - uRange.x) / (uRange.y - uRange.x), 0.5)); }
      void main() {
        float len = uRange.y - uRange.x;
        float z = uRange.x + mod(uTime * aBoat.y + aBoat.z * len, len);
        vec4 r = river(z), r2 = river(z + 6.0);
        float fade = smoothstep(0.0, 160.0, z - uRange.x) * smoothstep(0.0, 160.0, uRange.y - z);
        vec2 dir = normalize(vec2(r2.x - r.x, 6.0));
        float h = atan(dir.y, dir.x);
        float c = cos(h), s = sin(h);
        vec3 p = position * fade;
        vec3 base = vec3(r.x + aBoat.x * r.z * 0.5, r.y + sin(uTime * 1.3 + aBoat.z * 40.0) * 0.05, z);
        vec3 w = vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
        vWorld = base + w;
        vNormal = vec3(c * normal.x - s * normal.z, normal.y, s * normal.x + c * normal.z);
        vColor = aColor;
        gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${atmosphereUniforms}
      ${noise}
      ${sky}
      ${terrainShadow}
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec3 vColor;
      void main() {
        vec3 N = normalize(vNormal);
        float sh = terrainShadow(vWorld, uSunDir);
        vec3 col = vColor * (uSunColor * (max(dot(N, uSunDir), 0.0) * 0.8 + 0.2) * sh + uAmbient * (0.65 + 0.35 * N.y));
        gl_FragColor = vec4(applyAtmosphere(col, vWorld), 1.0);
      }
    `,
  });
  const r = mulberry32(31);
  for (const k of kinds) {
    if (!k.n) continue;
    const b = new Builder();
    k.make(b);
    const geo = b.build();
    const mesh = new InstancedMesh(geo, material, k.n);
    const data = new Float32Array(k.n * 4);
    for (let i = 0; i < k.n; i++) data.set([(r() - 0.5) * 0.7, k.speed[0] + r() * (k.speed[1] - k.speed[0]), i / k.n + r() * 0.1, 0], i * 4);
    geo.setAttribute('aBoat', new InstancedBufferAttribute(data, 4));
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  return group;
}


// ---------------------------------------------------------------------------------------------
export function buildLore({ places, builder, people, birds, carts, banners, heraldry, meshHeight, terrain, cv }) {
  const r = mulberry32(2024);
  const areas = new Areas();
  const meshes = [];
  const items = [];
  // A settlement by its kit name, or undefined if the journey does not visit it
  const place = id => places.find(p => p.place.id === id)?.place;
  const ground = (x, z) => meshHeight(x, z);
  const share = LOW ? 0.5 : 1;

  // Lit windows, one halo mesh per settlement
  const byPlace = places.map(() => []);
  WINDOWS.forEach((w, i) => {
    if (LOW && i % 3) return;
    let best = 0, bd = Infinity;
    places.forEach((p, k) => { const d = Math.hypot(p.place.centre.x - w.x, p.place.centre.z - w.z); if (d < bd) { bd = d; best = k; } });
    byPlace[best].push(w);
  });
  const windows = byPlace.map((list, k) => {
    if (!list.length) return null;
    const m = buildWindowGlows(list);
    m.userData.placeIndex = k;
    return m;
  }).filter(Boolean);

  // Roads, their signposts, and the travellers on them
  // A road joins the settlements on the east bank, in the order they come down the valley
  const ROUTE = SITES.filter(s => s.offset > 0).sort((a, b) => a.z - b.z).map(s => s.id);
  const names = Object.fromEntries(places.map((p, k) => [p.place.id, STOPS.find(s => s.place === k)?.placeName ?? p.name]));
  const signs = new Signs();
  const roads = [];
  for (let i = 0; i < ROUTE.length - 1; i++) {
    const a = site(ROUTE[i]), b = site(ROUTE[i + 1]);
    const pts = roadPath(a, b, ground);
    const mesh = roadMesh(pts);
    meshes.push({ mesh, points: pts.filter((_, k) => k % 25 === 0).map(p => p.clone().setY(p.y + 2)) });
    roads.push(pts);
    for (const [end, toward, label] of [[pts[0], pts[6], names[ROUTE[i + 1]]], [pts[pts.length - 1], pts[pts.length - 7], names[ROUTE[i]]]]) {
      const d = toward.clone().sub(end).setY(0).normalize(), s = new Vector3(-d.z, 0, d.x);
      const post = end.clone().addScaledVector(s, 2.6);
      areas.build(`signs-${i}`, b2 => b2.beam([post.x, post.y - 0.3, post.z], [post.x, post.y + 2.6, post.z], 0.09, SURF.timber, '#6b4f36'), post.y);
      signs.add(post.clone().setY(post.y + 2.15), d, label);
      const back = ROUTE.indexOf(label === names[ROUTE[i + 1]] ? ROUTE[i] : ROUTE[i + 1]);
      signs.add(post.clone().setY(post.y + 1.7), d.clone().negate(), names[ROUTE[back]]);
    }
  }
  const chunk = (pts, t0, t1, lateral = 0) => {
    const a = pts[Math.floor(t0 * (pts.length - 1))].clone(), b = pts[Math.floor(t1 * (pts.length - 1))].clone();
    const d = b.clone().sub(a).setY(0).normalize(), s = new Vector3(-d.z, 0, d.x);
    return [a.addScaledVector(s, lateral), b.addScaledVector(s, lateral)];
  };
  const wh = roads[0], ht = roads[1] ?? roads[0], tm = roads[2] ?? roads.at(-1), mh = roads.at(-1);
  if (roads.length) {
  carts.tag = 'road-homestead';
  carts.add(...chunk(wh, 0.82, 0.97, 0.9), { speed: 1.3, horse: '#8a6a4c' });
  carts.tag = 'road-town-north';
  carts.add(...chunk(ht, 0.05, 0.1, 0.8), { kind: 'rider', speed: 3.2, horse: '#3a2e26' });
  carts.add(...chunk(ht, 0.88, 0.97, -0.6), { kind: 'pennyfarthing', speed: 3.6, horse: '#ffffff' });
  carts.tag = 'road-mills';
  const flock = chunk(tm, 0.8, 0.9, 0);
  for (let i = 0; i < Math.round(7 * share); i++) {
    const off = new Vector3((r() - 0.5) * 2.4, 0, (r() - 0.5) * 3);
    carts.add(flock[0].clone().add(off), flock[1].clone().add(off), { kind: 'sheep', speed: 0.9, phase: 0.3 + (r() - 0.5) * 0.004, horse: '#ffffff' });
  }
  const fd = flock[1].clone().sub(flock[0]).setY(0).normalize();
  const fs = new Vector3(-fd.z, 0, fd.x).multiplyScalar(2.6);
  carts.add(flock[0].clone().add(fs), flock[1].clone().add(fs), { kind: 'shepherd', speed: 0.9, phase: 0.3, horse: '#ffffff' });
  carts.tag = 'road-harbour';
  const race = chunk(mh, 0.15, 0.85, 0);
  carts.add(...chunk(mh, 0.4, 0.6, -0.8), { speed: 1.2, horse: '#d9d2c4' });
  people.tag = 'road-pilgrims';
  const pil = chunk(ht, 0.9, 0.96, 0.6);
  for (let i = 0; i < 3; i++) people.add({ mode: MODE.walk, a: pil[0].clone(), b: pil[1].clone(), speed: 0.8, phase: 0.5 + i * 0.012, color: ['#6b5a48', '#d6cebd', '#5e4c3a'][i], accent: '#d6cebd', scale: 0.95 });
  }

  // Life on the river: boats and barges drifting down, a ferry, anglers and a heron
  const boats = riverCraft([Math.round(4 * share), Math.round(2 * share)]);
  meshes.push({ mesh: boats, always: true });
  const fz = 5900, fw = riverWidth(fz) / 2 - 7, fy = waterLevel(fz);
  carts.tag = 'ferry';
  carts.add(new Vector3(riverX(fz) - fw, fy, fz), new Vector3(riverX(fz) + fw, fy, fz), { kind: 'ferry', speed: 0.8, horse: '#ffffff', bob: 0 });
  for (const s of [-1, 1]) {
    const x = riverX(fz) + s * (fw + 6);
    areas.build('ferry', b => b.box(5, 0.4, 7, x, fy + 0.05, fz, SURF.plank, '#6b4f36'), fy);
  }
  people.tag = 'anglers';
  for (const [z, s] of [[-2300, 1], [1900, -1], [5200, 1]]) {
    const rx = riverX(z), x = rx + s * (riverWidth(z) / 2 + 2.5), y = Math.max(ground(x, z), waterLevel(z) + 0.4);
    const face = Math.atan2(rx - x, 0);
    people.add({ mode: MODE.pipe, a: new Vector3(x, y, z), heading: face, color: ['#4f5a3a', '#7a4a32', '#3f4f62'][(z / 100 | 0) % 3], accent: '#c9b48a', scale: 0.95 });
    const hand = new Vector3(x - s * 0.5, y + 1.4, z), tip = new Vector3(x - s * 4.2, y + 3.0, z);
    areas.build('anglers', b => {
      b.beam([hand.x, hand.y, hand.z], [tip.x, tip.y, tip.z], 0.03, SURF.flat, '#5a4430');
      b.beam([tip.x, tip.y, tip.z], [tip.x, waterLevel(z), tip.z], 0.008, SURF.flat, '#d9d2c4');
    }, y);
  }
  if (!LOW) {
    const hz = 4700, hx = riverX(hz) - riverWidth(hz) / 2 + 3, hy = waterLevel(hz);
    areas.build('heron', b => b.group(at(hx, hy - 0.2, hz, 0.8), g => {
      for (const x of [-0.08, 0.08]) g.beam([x, 0, 0], [x, 0.75, 0], 0.025, SURF.flat, '#8a7a5a');
      g.blob(0.22, 0, 0.95, 0, SURF.flat, '#9aa0a6', [0.8, 0.8, 1.6], 1);
      g.beam([0, 1.0, 0.25], [0, 1.55, 0.35], 0.05, SURF.flat, '#c9ccd0');
      g.blob(0.08, 0, 1.6, 0.38, SURF.flat, '#d9dce0', [1, 1, 1.2], 1);
      g.beam([0, 1.6, 0.44], [0, 1.57, 0.68], 0.025, SURF.flat, '#d4a23a');
      g.box(0.03, 0.12, 0.2, 0, 1.62, 0.3, SURF.flat, '#1c1a17');
    }), hy);
  }

  // Distant landmarks, read as shapes through the haze
  const peak = (z, side, from, to) => {
    let best = null;
    for (let off = from; off <= to; off += 40) {
      const x = riverX(z) + side * off, h = heightAt(x, z);
      const slope = Math.abs(heightAt(x + 20, z) - h) + Math.abs(heightAt(x, z + 20) - h);
      if ((!best || h > best.y) && slope < 16) best = new Vector3(x, h, z);
    }
    return best;
  };
  const circle = peak(-3900, -1, 500, 1400);
  if (circle) areas.build('stone-circle', b => {
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2, x = circle.x + Math.cos(a) * 9, z = circle.z + Math.sin(a) * 9;
      b.box(1.1, i === 4 ? 0.8 : 2.4 + (i % 3) * 0.4, 0.7, x, heightAt(x, z) - 0.3, z, SURF.stone, '#bcb6a8', -a, i === 4 ? 1.4 : 0);
    }
  }, circle.y);
  const crag = peak(1700, 1, 700, 1600);
  if (crag) areas.build('castle', b => b.group(at(crag.x, crag.y - 1.5, crag.z, 0.4), g => {
    for (const [x, z, l, ry] of [[0, -9, 20, 0], [0, 9, 14, 0], [-10, 0, 18, Math.PI / 2], [10, 2, 10, Math.PI / 2]]) {
      for (let s = 0; s < l; s += 2) g.box(2.1, 5 + Math.abs(Math.sin(s * 1.7 + x)) * 4, 1.6, x + (ry ? 0 : s - l / 2), 0, z + (ry ? s - l / 2 : 0), SURF.stone, '#a8a294', ry);
    }
    g.box(8, 13, 8, -4, 0, -3, SURF.stone, '#b4ae9f');
    for (let s = 0; s < 4; s++) g.box(2, 2.5 + (s % 2) * 2, 2, -7 + s * 2, 13, -6.8, SURF.stone, '#b4ae9f');
  }), crag.y);
  const bz = -1150, bw = riverWidth(bz) + 18, by = waterLevel(bz), bx = riverX(bz);
  areas.build('bridge', b => b.group(at(bx, by, bz, Math.PI / 2), g => {
    g.box(4.2, 0.9, bw, 0, 4.2, 0, SURF.stone, '#c9c2b2');
    for (const s of [-1, 1]) g.box(0.4, 0.8, bw, s * 1.9, 5.1, 0, SURF.stone, '#d0c9ba');
    for (let k = -1; k <= 1; k++) g.box(3.6, 4.4, 2.2, 0, -0.6, k * bw * 0.3, SURF.stone, '#b9b2a2');
    for (let k = 0; k < 2; k++) g.torus(bw * 0.15 - 0.6, 0.55, 0, 4.2, (k - 0.5) * bw * 0.3, SURF.stone, '#c2bbab', Math.PI, Math.PI / 2, Math.PI);
  }), by);
  const head = peak(8350, -1, 250, 900);
  if (head) areas.build('broch', b => {
    b.cylinder(7, 12, head.x, head.y - 0.5, head.z, SURF.stone, '#b6b0a2', 18, 0, 0, 0, 5.4);
    b.box(1.2, 2, 0.6, head.x, head.y - 0.5, head.z + 6.6, SURF.flat, '#2a2420');
  }, head.y);

  // --- Easter eggs -----------------------------------------------------------------------------
  // A choir in the abbey cloister that starts singing when you linger
  const abbey = place('abbey');
  if (WORLD.eggs.choir && abbey) for (const [rad, n] of [[4.2, 6], [5.6, 7]]) {
    for (let i = 0; i < n; i++) {
      const a = -0.8 + (i / (n - 1)) * 1.6, x = 2 + Math.sin(a) * rad, z = 17 - Math.cos(a) * rad;
      people.add({ mode: MODE.sing, a: abbey.point(x, 0, z), heading: Math.atan2(2 - x, 17 - z) + abbey.rot, color: i % 2 ? '#2f3f6a' : '#5a2a4a', accent: '#efe9dc', phase: i * 0.11 + rad, scale: 0.94, gate: 'choir' });
    }
  }
  if (WORLD.eggs.choir && abbey) people.add({ mode: MODE.conduct, a: abbey.point(2, 0, 16.2), heading: Math.PI + abbey.rot, color: '#1c1a17', accent: '#efe9dc', gate: 'choir' });

  const tower = place('watchtower');

  // Skiing on the winter snowfields at the head of the valley, in view of the watchtower; the
  // skier is only shown in winter
  if (tower) {
    const eye = tower.point(-70, 16, 10), look = tower.point(420, -40, 150).sub(eye).setY(0).normalize();
    let spot = null;
    for (let d = 500; d < 3500 && !spot; d += 100) {
      for (let a = -0.5; a <= 0.5 && !spot; a += 0.1) {
        const dir = look.clone().applyAxisAngle(UP, a), p = eye.clone().addScaledVector(dir, d);
        const h = heightAt(p.x, p.z);
        if (h > WINTER_SNOW_LINE + 80) spot = new Vector3(p.x, h, p.z);
      }
    }
    if (spot) {
      const gx = heightAt(spot.x + 10, spot.z) - heightAt(spot.x - 10, spot.z), gz = heightAt(spot.x, spot.z + 10) - heightAt(spot.x, spot.z - 10);
      const down = new Vector3(-gx, 0, -gz).normalize(), end = spot.clone().addScaledVector(down, 160);
      end.y = heightAt(end.x, end.z);
      carts.tag = 'skier';
      carts.add(spot, end, { kind: 'skier', speed: 6, horse: '#ffffff', ski: true, bob: 0 });
    }
  }

  // A trophy on a shelf by the inn door for each honour listed at the harbour
  const inn = place('harbour');
  if (inn) {
  const wins = (cv.interests || []).find(i => i.items)?.items ?? [];
  areas.build('trophies', b => b.group(at(inn.point(0, 0, 26).x, inn.site.y, inn.point(0, 0, 26).z, inn.rot), g => {
    g.box(2.4, 0.06, 0.32, 5.4, 1.05, 4.75, SURF.plank, '#6b4f36');
    for (const x of [4.25, 6.55]) g.box(0.06, 1.1, 0.32, x, 0, 4.75, SURF.plank, '#5a4430');
    wins.slice(0, 5).forEach((win, k) => {
      const x = 4.55 + k * 0.45, y = 1.11, metal = ['#d4a23a', '#c0c4c8', '#d4a23a', '#b0723a', '#d4a23a'][k % 5];
      g.box(0.16, 0.05, 0.16, x, y, 4.75, SURF.plank, '#3a3026');
      g.cylinder(0.025, 0.12, x, y + 0.05, 4.75, SURF.flat, metal, 8);
      g.cylinder(0.05, 0.14, x, y + 0.17, 4.75, SURF.flat, metal, 12, 0, 0, 0, 0.1);
      for (const s of [-1, 1]) g.torus(0.045, 0.012, x + s * 0.1, y + 0.25, 4.75, SURF.flat, metal, 0, Math.PI / 2);
    });
  }), inn.site.y);
  }

  const update = () => {};


  for (const m of areas.meshes()) meshes.push({ mesh: m });
  meshes.push({ mesh: signs.mesh(), points: [] });
  if (WORLD.eggs.seasonalScenes) {
    const seasonal = buildSeasonal({ places, builder, people, carts, meshHeight });
    meshes.push(...seasonal.meshes);
    for (const { mesh, place } of seasonal.glows) { mesh.userData.placeIndex = place; windows.push(mesh); }
  }
  return { meshes, windows, signs, update, get choir() { return people.gates; } };
}
