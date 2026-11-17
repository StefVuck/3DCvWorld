import {
  IcosahedronGeometry, OctahedronGeometry, ConeGeometry, CylinderGeometry, BufferGeometry, BufferAttribute,
  InstancedBufferAttribute, InstancedMesh, ShaderMaterial, Object3D, Color, Group, DataTexture,
  RGFormat, UnsignedByteType, LinearFilter, ClampToEdgeWrapping, Vector4, Vector3, Box3, Sphere,
} from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  mulberry32, riverX, riverDistance, riverWidth, valleyHalfWidth, forestOnly, fieldAt, cropOf, smooth, siteClear, waterLevel,
} from './valley.js';
import { shared } from '../atmosphere.js';
import { Q } from '../quality.js';
import { SEASON } from '../season.js';
import { atmosphereUniforms, noise, sky, localShadow } from '../shaders/common.js';

const CHUNK = 600;
const { hiDistance: HI_DISTANCE, midDistance: MID_DISTANCE, farDistance: FAR_DISTANCE } = Q;

function tagged(geo, part, centre) {
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  const n = geo.attributes.position.count;
  const parts = new Float32Array(n).fill(part);
  const centres = new Float32Array(n * 3);
  const p = geo.attributes.position;
  for (let i = 0; i < n; i++) {
    const c = typeof centre === 'function' ? centre(p.getX(i), p.getY(i), p.getZ(i)) : centre;
    centres[i * 3] = c[0]; centres[i * 3 + 1] = c[1]; centres[i * 3 + 2] = c[2];
  }
  geo.setAttribute('aPart', new BufferAttribute(parts, 1));
  geo.setAttribute('aCentre', new BufferAttribute(centres, 3));
  if (!geo.attributes.aCorner) geo.setAttribute('aCorner', new BufferAttribute(new Float32Array(n * 2), 2));
  return geo;
}

function leafCards(blobs, crown, count, seed) {
  const r = mulberry32(seed);
  const pos = [], nor = [], corner = [];
  const total = blobs.reduce((a, b) => a + b[3], 0);
  const quad = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
  for (let k = 0; k < count; k++) {
    let pick = r() * total, blob = blobs[0];
    for (const b of blobs) { pick -= b[3]; if (pick <= 0) { blob = b; break; } }
    let dx, dy, dz, l;
    do { dx = r() * 2 - 1; dy = r() * 2 - 0.25; dz = r() * 2 - 1; l = Math.hypot(dx, dy, dz); } while (l > 1 || l < 0.2);
    dx /= l; dy /= l; dz /= l;
    const rr = blob[3] * (0.85 + r() * 0.2);
    const cx = blob[0] + dx * rr, cy = blob[1] + dy * rr, cz = blob[2] + dz * rr;
    const ang = r() * Math.PI * 2;
    for (const [qx, qy] of quad) {
      pos.push(cx, cy, cz);
      nor.push(dx, dy, dz);
      corner.push(qx * Math.cos(ang) - qy * Math.sin(ang), qx * Math.sin(ang) + qy * Math.cos(ang));
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(nor), 3));
  g.setAttribute('aCorner', new BufferAttribute(new Float32Array(corner), 2));
  return tagged(g, 2, crown);
}

function lumpy(geo, seed, amount) {
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo);
  const r = mulberry32(seed);
  const p = geo.attributes.position;
  const offsets = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!offsets.has(key)) offsets.set(key, 1 + (r() - 0.5) * amount);
    const k = offsets.get(key);
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  return geo;
}

function broadleafHi() {
  const crown = [0, 1.55, 0];
  const blobs = [
    [0, 1.55, 0, 0.9], [0.55, 1.35, 0.25, 0.62], [-0.52, 1.42, -0.2, 0.64],
    [0.15, 2.08, -0.1, 0.58], [-0.22, 1.25, 0.52, 0.52], [0.3, 1.75, -0.5, 0.5],
    [-0.45, 1.9, 0.3, 0.48],
  ];
  const parts = blobs.map(([x, y, z, r], i) => {
    const g = lumpy(new IcosahedronGeometry(r, 1), 11 + i, 0.2);
    g.translate(x, y, z);
    return tagged(g, 0, crown);
  });
  const trunk = new CylinderGeometry(0.08, 0.15, 1.45, 6, 1, true);
  trunk.translate(0, 0.725, 0);
  parts.push(tagged(trunk, 1, [0, 0.7, 0]));
  // Two limbs leaving the trunk into the crown
  for (const [ax, az] of [[0.8, 0.3], [-0.6, -0.5]]) {
    const limb = new CylinderGeometry(0.035, 0.06, 0.7, 4, 1, true);
    limb.translate(0, 0.35, 0);
    limb.rotateZ(-ax * 0.9);
    limb.rotateX(az * 0.9);
    limb.translate(0, 0.95, 0);
    parts.push(tagged(limb, 1, [0, 1.1, 0]));
  }
  parts.push(leafCards(blobs, crown, 32, 5));
  return mergeGeometries(parts.map(g => (g.index ? g : mergeVertices(g))));
}

// The simpler stand-ins drawn further away keep a plain trunk, so trees never hover above the
// ground once they are out of close range
function withTrunk(crown, height, radius, sides) {
  const trunk = new CylinderGeometry(radius * 0.7, radius, height, sides, 1, true);
  trunk.translate(0, height / 2, 0);
  return mergeGeometries([crown.index ? crown.toNonIndexed() : crown, tagged(trunk, 1, [0, height / 2, 0]).toNonIndexed()]);
}

function broadleafLo() {
  const g = new IcosahedronGeometry(1.05, 0);
  g.scale(1, 0.95, 1);
  g.translate(0, 1.55, 0);
  return withTrunk(tagged(g, 0, [0, 1.55, 0]), 1.2, 0.15, 3);
}

function broadleafFar() {
  // Too small for a trunk to show, so the crown's lowest point reaches down to the ground instead
  const g = new OctahedronGeometry(1.1, 0);
  g.scale(1, 0.9, 1);
  g.translate(0, 1.55, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < 0.6) p.setY(i, 0.2);
  g.computeVertexNormals();
  return tagged(g, 0, [0, 1.55, 0]);
}

function coniferFar() {
  const g = new ConeGeometry(0.55, 2.5, 4, 1);
  g.translate(0, 1.25, 0);
  return tagged(g, 0, (x, y) => [0, y + 0.25, 0]);
}

function coniferHi() {
  const parts = [[0.55, 1.1, 0.95], [0.44, 0.95, 1.55], [0.3, 0.8, 2.05]].map(([r, h, y], i) => {
    const g = lumpy(new ConeGeometry(r, h, 8, 1), 31 + i, 0.15);
    g.translate(0, y, 0);
    return tagged(g, 0, (x, yy) => [0, yy + 0.25, 0]);
  });
  const trunk = new CylinderGeometry(0.05, 0.08, 0.7, 5, 1, true);
  trunk.translate(0, 0.35, 0);
  parts.push(tagged(trunk, 1, [0, 0.35, 0]));
  return mergeGeometries(parts.map(g => (g.index ? g : mergeVertices(g))));
}

function coniferLo() {
  const g = new ConeGeometry(0.55, 2.2, 6, 1);
  g.translate(0, 1.4, 0);
  return withTrunk(tagged(g, 0, (x, y) => [0, y + 0.25, 0]).toNonIndexed(), 0.7, 0.08, 3);
}

const PALETTE = {
  broad: ['#4c6a2c', '#5a7a30', '#62803a', '#3f5a26', '#5f7d36', '#6b7f3c', '#55703a', '#48622c'],
  orchard: ['#6e8c3e', '#7f9646', '#73903f'],
  blossom: ['#f2d6dc', '#f7eef0', '#e8bccb', '#f4e6e0'],
  autumn: ['#a8642a', '#c08a34', '#8e4a26', '#b5762e', '#9a7a34'],
  hawthorn: ['#f3efe4', '#ece6d6'],
  river: ['#5d7650', '#6b8058', '#566e46'],
  conifer: ['#2f4a33', '#36533a', '#2a4230', '#3b553a'],
};
const COLORS = Object.fromEntries(Object.entries(PALETTE).map(([k, v]) => [k, v.map(c => new Color(c))]));

// Hawthorns flower in spring and are ordinary hedgerow trees the rest of the year; in autumn
// about half the broadleaves turn. Each tree has its own threshold, so they change one by one
// as the months go by rather than all at once.
const frac = x => x - Math.floor(x);
function treeColour(t, season) {
  const early = frac(t.seed * 13.7 + t.shade * 3.1);
  let kind = t.kind === 'hawthorn' && early >= season.blossomAmount ? 'broad' : t.kind;
  if (kind === 'orchard' && early < season.blossomAmount) kind = 'blossom';
  if ((kind === 'broad' || kind === 'orchard') && t.seed < season.autumnAmount * 0.48) kind = 'autumn';
  const pal = COLORS[kind];
  return pal[Math.floor(t.shade * pal.length)];
}

export function placeTrees(meshHeight, heightCPU, extras = []) {
  const rnd = mulberry32(77);
  const trees = [];
  const add = (x, z, scale, kind, conifer, stretch = 1) => {
    if (Q.trees < 1 && kind !== 'orchard' && rnd() > Q.trees) return;
    const y = meshHeight(x, z) - 0.4;
    if (y < waterLevel(z) + 1.2) return;
    const t = { x, y, z, scale, conifer, stretch, kind, shade: rnd(), rot: rnd() * Math.PI * 2, seed: rnd() };
    t.color = treeColour(t, SEASON);
    trees.push(t);
  };

  const z0 = -9400, z1 = 8700;

  const fs = 11;
  for (let z = z0; z < z1; z += fs) {
    const rx = riverX(z), W = valleyHalfWidth(z) * 1.7;
    for (let x = rx - W; x < rx + W; x += fs) {
      const px = x + (rnd() - 0.5) * fs * 0.9;
      const pz = z + (rnd() - 0.5) * fs * 0.9;
      const hApprox = heightCPU(px, pz);
      const f = forestOnly(px, pz, hApprox);
      if (f < 0.05 || rnd() > f * 0.97) continue;
      const altitude = hApprox - (2 + 300 * Math.pow(smooth(7600, -9600, pz), 1.8));
      const coniferChance = smooth(-2000, -7000, pz) * 0.7 + smooth(150, 450, altitude) * 0.8;
      const conifer = rnd() < coniferChance;
      add(px, pz, conifer ? 3.6 + rnd() * 1.8 : 4.4 + rnd() * 2.4, conifer ? 'conifer' : 'broad', conifer, conifer ? 1.2 + rnd() * 0.4 : 0.85 + rnd() * 0.3);
    }
  }

  const ls = 9;
  for (let z = z0; z < z1; z += ls) {
    const rx = riverX(z), W = valleyHalfWidth(z) * 1.5, rw = riverWidth(z);
    for (let x = rx - W; x < rx + W; x += ls) {
      const h = heightCPU(x, z);
      if (h > 620) continue;
      const gx = heightCPU(x + 20, z) - heightCPU(x - 20, z);
      const gz = heightCPU(x, z + 20) - heightCPU(x, z - 20);
      if (Math.hypot(gx, gz) / 40 > 0.32) continue;
      if (riverDistance(x, z) < rw * 0.5 + 30) continue;
      if (forestOnly(x, z, h) > 0.2) continue;
      if (siteClear(x, z) > 0.3) continue;
      const f = fieldAt(x, z);
      const crop = cropOf(f.r);
      if (crop === 'orchard' && f.edge > 6) {
        add(x, z, 2.6 + rnd() * 0.7, 'orchard', false, 0.9);
      } else if (f.edge < 2.4 && rnd() < 0.62) {
        const kind = ((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1 + 1) % 1 < 0.18 ? 'hawthorn' : 'broad';
        add(x + (rnd() - 0.5) * 3, z + (rnd() - 0.5) * 3, 3.4 + rnd() * 2.6, kind, false, 0.85 + rnd() * 0.3);
      }
    }
  }

  for (let z = z0; z < z1; z += 13) {
    const rw = riverWidth(z), rx = riverX(z);
    for (const side of [-1, 1]) {
      if (rnd() > 0.5 + 0.35 * Math.sin(z * 0.004 + side * 2)) continue;
      const off = rw * 0.5 + 9 + rnd() * 22;
      if (siteClear(rx + side * off, z) > 0.3) continue;
      add(rx + side * off, z + (rnd() - 0.5) * 8, 3.8 + rnd() * 2.2, 'river', false, 0.9 + rnd() * 0.3);
    }
  }

  for (const e of extras) add(e.x, e.z, e.scale, e.kind, e.kind === 'conifer', e.stretch ?? 1);

  return trees;
}

// The mid and far models have no leaf cards, so they get a variant without the cards' discard
// and keep early depth testing
function makeMaterial(depth = false, cards = true) {
  return new ShaderMaterial({
    uniforms: { ...shared },
    defines: { ...(depth ? { DEPTH_ONLY: 1 } : {}), ...(cards ? {} : { NO_CARDS: 1 }) },
    vertexShader: /* glsl */ `
      ${atmosphereUniforms}
      attribute float aPart;
      attribute vec3 aCentre;
      attribute float aShadow;
      attribute float aSeed;
      attribute vec2 aCorner;
      varying vec2 vCorner;
      varying float vSeed;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec3 vColor;
      varying float vPart;
      varying float vShadow;
      varying float vAO;
      void main() {
        vec3 p = position;
        float sway = sin(uTime * 1.1 + aSeed * 40.0 + p.y * 0.8) * 0.035 * smoothstep(0.4, 2.0, p.y);
        p.x += sway;
        p.z += sway * 0.6;
        vec3 soft = normalize(position - aCentre);
        vec3 n = (aPart < 0.5 || aPart > 1.5) ? normalize(mix(normal, soft, 0.72)) : normal;
        mat4 m = modelMatrix * instanceMatrix;
        vec4 wp = m * vec4(p, 1.0);
        if (aPart > 1.5) {
          float sc = length(m[0].xyz);
          vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          float camDist = length(cameraPosition - wp.xyz);
          float size = 0.34 * sc * (0.75 + 0.5 * fract(position.x * 13.7 + position.z * 7.3)) * (1.0 - smoothstep(280.0, 600.0, camDist));
          wp.xyz += (right * aCorner.x + up * aCorner.y) * size;
        }
        vCorner = aCorner;
        vSeed = aSeed + position.x * 3.7 + position.y * 1.3;
        vWorld = wp.xyz;
        vNormal = normalize(mat3(m) * n);
        vAO = clamp((position.y - 0.45) / 1.5, 0.0, 1.0);
        vColor = instanceColor;
        vShadow = aShadow;
        vPart = aPart;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      ${atmosphereUniforms}
      ${noise}
      ${sky}
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec3 vColor;
      varying float vPart;
      varying float vShadow;
      varying float vAO;
      varying vec2 vCorner;
      varying float vSeed;
      ${localShadow}
      void main() {
        #ifndef NO_CARDS
        if (vPart > 1.5) {
          float r = length(vCorner);
          float a = atan(vCorner.y, vCorner.x);
          float edge = 0.62 + 0.3 * vnoise(vec2(a * 1.6 + vSeed * 10.0, vSeed * 5.0));
          if (r > edge) discard;
        }
        #endif
        #ifdef DEPTH_ONLY
          gl_FragColor = vec4(1.0);
          return;
        #endif
        vec3 N = normalize(vNormal);
        vec3 L = uSunDir;
        vec3 V = normalize(cameraPosition - vWorld);
        float near = 1.0 - smoothstep(150.0, 700.0, length(cameraPosition - vWorld));
        if (vPart < 0.5 && near > 0.0) {
          vec3 q = vWorld * 0.9;
          vec3 j = vec3(vnoise(q.xy), vnoise(q.yz + 7.0), vnoise(q.zx + 13.0)) - 0.5;
          N = normalize(N + j * 1.1 * near);
        }
        vec3 albedo = (vPart > 0.5 && vPart < 1.5) ? srgb(vec3(0.3, 0.24, 0.18)) : vColor;
        albedo *= 0.9 + 0.2 * vnoise(vWorld.xz * 0.9 + vWorld.y);
        if (uWinter > 0.0 && !(vPart > 0.5 && vPart < 1.5)) {
          albedo = mix(albedo, vec3(dot(albedo, vec3(0.33))) * 0.8, uWinter * 0.35);
          float cap = smoothstep(0.35, 0.85, N.y + 0.5 * (vnoise(vWorld.xz * 1.7 + vWorld.y * 2.0) - 0.5));
          albedo = mix(albedo, srgb(vec3(0.86, 0.88, 0.9)), uWinter * cap * 0.7);
        }
        float wrap = max((dot(N, L) + 0.3) / 1.3, 0.0);
        float ao = mix(0.58, 1.0, vAO);
        float leafLight = vPart > 0.5 && vPart < 1.5 ? 1.0 : 0.45;
        float sun = wrap * vShadow * mix(1.0 - leafLight, 1.0, localShadowAt(vWorld, N));
        vec3 amb = uAmbient * (0.75 + 0.35 * N.y) * ao;
        float back = pow(max(dot(-V, L), 0.0), 5.0) * vShadow * (0.4 + 0.6 * vAO);
        if (vPart > 1.5) albedo *= 0.92 + 0.16 * vnoise(vCorner * 2.0 + vSeed);
        vec3 col = albedo * (uSunColor * sun * ao + amb) + albedo * uSunColor * back * 0.28;
        col = applyAtmosphere(col, vWorld);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

function withInstanceAttrs(base, shadow, seed) {
  const g = new BufferGeometry();
  for (const [name, attr] of Object.entries(base.attributes)) g.setAttribute(name, attr);
  if (base.index) g.setIndex(base.index);
  g.setAttribute('aShadow', shadow);
  g.setAttribute('aSeed', seed);
  return g;
}

const _v = new Vector3();

export class Forest {
  constructor(trees, heightCPU) {
    this.trees = trees;
    this.heightCPU = heightCPU;
    this.group = new Group();
    this.material = makeMaterial();
    this.plainMaterial = makeMaterial(false, false);
    this.depthMaterial = makeMaterial(true);
    this.chunks = [];

    const geos = this.geos = {
      broad: [broadleafHi(), broadleafLo(), broadleafFar()],
      conifer: [coniferHi(), coniferLo(), coniferFar()],
    };

    const buckets = new Map();
    for (const t of trees) {
      const key = `${Math.floor(t.x / CHUNK)},${Math.floor(t.z / CHUNK)},${t.conifer ? 1 : 0}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(t);
    }

    const dummy = new Object3D();
    for (const [key, list] of buckets) {
      const [cx, cz, isConifer] = key.split(',').map(Number);
      const [hiBase, loBase, farBase] = geos[isConifer ? 'conifer' : 'broad'];
      const shadow = new InstancedBufferAttribute(new Float32Array(list.length).fill(1), 1);
      const seed = new InstancedBufferAttribute(new Float32Array(list.map(t => t.seed)), 1);
      const meshes = [hiBase, loBase, farBase].map((base, lod) => {
        const m = new InstancedMesh(withInstanceAttrs(base, shadow, seed), lod ? this.plainMaterial : this.material, list.length);
        list.forEach((t, i) => {
          dummy.position.set(t.x, t.y, t.z);
          dummy.rotation.set(0, t.rot, 0);
          dummy.scale.set(t.scale, t.scale * t.stretch, t.scale);
          dummy.updateMatrix();
          m.setMatrixAt(i, dummy.matrix);
          m.setColorAt(i, t.color);
        });
        m.computeBoundingSphere();
        this.group.add(m);
        return m;
      });
      this.chunks.push({
        centre: new Vector3((cx + 0.5) * CHUNK, list[0].y, (cz + 0.5) * CHUNK),
        hi: meshes[0], lo: meshes[1], far: meshes[2], list, shadow,
      });
    }

    // Near the camera, close and mid detail are chosen tree by tree rather than chunk by chunk,
    // so a whole 600 m chunk is not drawn in full detail just because one corner of it is close
    this.near = {};
    for (const kind of ['broad', 'conifer']) this.near[kind] = this.nearMeshes(kind, 2048);
    this.nearKey = '';
    this.nearAt = new Vector3(Infinity, 0, 0);
    this.dirty = true;

    this.canopy = makeCanopy();
  }

  nearMeshes(kind, cap) {
    const old = this.near[kind];
    if (old) for (const m of [old.hi, old.lo]) { this.group.remove(m); m.geometry.dispose(); m.dispose(); }
    const make = (base, material) => {
      const shadow = new InstancedBufferAttribute(new Float32Array(cap).fill(1), 1);
      const seed = new InstancedBufferAttribute(new Float32Array(cap), 1);
      const m = new InstancedMesh(withInstanceAttrs(base, shadow, seed), material, cap);
      m.setColorAt(0, new Color(1, 1, 1));
      m.count = 0;
      m.boundingSphere = new Sphere();
      this.group.add(m);
      return m;
    };
    return { cap, hi: make(this.geos[kind][0], this.material), lo: make(this.geos[kind][1], this.plainMaterial) };
  }

  rebuildNear(chunks, camera) {
    const cut = Math.min(HI_DISTANCE, 400), cx = camera.position.x, cz = camera.position.z;
    for (const kind of ['broad', 'conifer']) {
      const mine = chunks.filter(c => (c.list[0].conifer ? 'conifer' : 'broad') === kind);
      const total = mine.reduce((a, c) => a + c.list.length, 0);
      if (total > this.near[kind].cap) this.near[kind] = this.nearMeshes(kind, Math.ceil(total * 1.4));
      const { hi, lo } = this.near[kind];
      let nh = 0, nl = 0;
      const box = new Box3();
      for (const c of mine) {
        const M = c.hi.instanceMatrix.array, C = c.hi.instanceColor.array, Sh = c.shadow.array, Se = c.hi.geometry.attributes.aSeed.array;
        const bs = c.hi.boundingSphere;
        box.expandByPoint(_v.copy(bs.center).addScalar(bs.radius)).expandByPoint(_v.copy(bs.center).subScalar(bs.radius));
        c.list.forEach((t, i) => {
          const into = Math.hypot(t.x - cx, t.z - cz) < cut ? hi : lo;
          const k = into === hi ? nh++ : nl++;
          into.instanceMatrix.array.set(M.subarray(i * 16, i * 16 + 16), k * 16);
          into.instanceColor.array.set(C.subarray(i * 3, i * 3 + 3), k * 3);
          into.geometry.attributes.aShadow.array[k] = Sh[i];
          into.geometry.attributes.aSeed.array[k] = Se[i];
        });
      }
      for (const [m, n] of [[hi, nh], [lo, nl]]) {
        m.count = n;
        m.instanceMatrix.needsUpdate = true;
        m.instanceColor.needsUpdate = true;
        m.geometry.attributes.aShadow.needsUpdate = true;
        m.geometry.attributes.aSeed.needsUpdate = true;
        if (n) box.getBoundingSphere(m.boundingSphere);
        m.visible = n > 0;
      }
    }
  }

  setSeason(season) {
    for (const c of this.chunks) {
      c.list.forEach((t, i) => {
        t.color = treeColour(t, season);
        for (const m of [c.hi, c.lo, c.far]) m.setColorAt(i, t.color);
      });
      for (const m of [c.hi, c.lo, c.far]) m.instanceColor.needsUpdate = true;
    }
    this.dirty = true;
  }

  // The local shadow map covers one settlement, so it is given its own small instanced meshes
  // holding only the trees that can fall inside it, not whole forest chunks
  shadowCasters(centre, radius) {
    for (const m of this.casters ?? []) m.geometry.dispose();
    const near = { broad: [], conifer: [] };
    for (const c of this.chunks) {
      if (Math.hypot(c.centre.x - centre.x, c.centre.z - centre.z) > radius + 700) continue;
      for (const t of c.list) if (Math.hypot(t.x - centre.x, t.z - centre.z) < radius + 80) near[t.conifer ? 'conifer' : 'broad'].push(t);
    }
    const dummy = new Object3D();
    this.casters = Object.entries(near).filter(([, list]) => list.length).map(([kind, list]) => {
      const one = n => new InstancedBufferAttribute(new Float32Array(list.length).fill(n), 1);
      const m = new InstancedMesh(withInstanceAttrs(this.geos[kind][0], one(1), new InstancedBufferAttribute(new Float32Array(list.map(t => t.seed)), 1)), this.depthMaterial, list.length);
      list.forEach((t, i) => {
        dummy.position.set(t.x, t.y, t.z);
        dummy.rotation.set(0, t.rot, 0);
        dummy.scale.set(t.scale, t.scale * t.stretch, t.scale);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      });
      m.computeBoundingSphere();
      return m;
    });
    return this.casters;
  }

  updateLOD(camera, allowed = null) {
    const near = [];
    let key = '';
    this.chunks.forEach((c, i) => {
      const dx = camera.position.x - c.centre.x, dz = camera.position.z - c.centre.z;
      const d = Math.hypot(dx, dz);
      const ok = !allowed || allowed.has(i);
      const close = ok && d < HI_DISTANCE;
      if (close) { near.push(c); key += i + ','; }
      c.hi.visible = false;
      c.lo.visible = ok && !close && d < MID_DISTANCE;
      c.far.visible = ok && d >= MID_DISTANCE && d < FAR_DISTANCE;
    });
    // Re-sorted only when the camera has moved a fair way, the chunks change, or shading changes
    if (this.dirty || key !== this.nearKey || _v.copy(camera.position).setY(0).distanceTo(this.nearAt) > 15) {
      this.rebuildNear(near, camera);
      this.nearKey = key;
      this.nearAt.copy(camera.position).setY(0);
      this.dirty = false;
    }
    for (const kind in this.near) for (const m of [this.near[kind].hi, this.near[kind].lo]) m.visible = m.count > 0;
  }

  // The water's reflection is small and blurred, so it only needs the simple trees near the camera
  reflectionLOD(camera, allowed = null) {
    this.chunks.forEach((c, i) => {
      const d = Math.hypot(camera.position.x - c.centre.x, camera.position.z - c.centre.z);
      const ok = !allowed || allowed.has(i);
      c.hi.visible = false;
      c.lo.visible = ok && d < 1000;
      c.far.visible = false;
    });
    for (const kind in this.near) { this.near[kind].hi.visible = false; this.near[kind].lo.visible = false; }
  }

  *sunJob(L) {
    for (const c of this.chunks) {
      const arr = c.shadow.array;
      c.list.forEach((t, i) => {
        arr[i] = marchShadow(this.heightCPU, t.x, t.y + t.scale * 1.6 * t.stretch, t.z, L);
      });
      c.shadow.needsUpdate = true;
      yield;
    }
    this.dirty = true;
    yield* this.canopy.splatJob(this.trees, L);
  }

  updateSun(L) {
    for (const _ of this.sunJob(L));
  }
}

export function marchShadow(heightCPU, x, y, z, L) {
  if (L.y < -0.05) return 0;
  let res = 1, t = 20;
  for (let i = 0; i < 30; i++) {
    const qx = x + L.x * t, qy = y + L.y * t, qz = z + L.z * t;
    const diff = qy - heightCPU(qx, qz);
    res = Math.min(res, (10 * diff) / t);
    if (res < -0.05 || qy > 1700) break;
    t = t * 1.14 + 6;
  }
  const s = Math.min(1, Math.max(0, res));
  return s * s * (3 - 2 * s);
}

function makeCanopy() {
  const bounds = new Vector4(-4400, -10000, 8800, 20000);
  const w = 1700, h = 3860;
  // Written straight into the texture's bytes. Channel 1, the canopy's footprint, does not depend
  // on the sun, so it is drawn once; only channel 0, the cast shade, is redrawn as the sun moves.
  const bytes = new Uint8Array(w * h * 2);
  let footprint = false;
  const tex = new DataTexture(bytes, w, h, RGFormat, UnsignedByteType);
  tex.magFilter = tex.minFilter = LinearFilter;
  tex.wrapS = tex.wrapT = ClampToEdgeWrapping;
  tex.needsUpdate = true;
  const sx = bounds.z / w, sz = bounds.w / h;

  function disc(cx, cz, r, value, channel) {
    const u = (cx - bounds.x) / sx, v = (cz - bounds.y) / sz, ru = r / sx;
    const i0 = Math.max(0, Math.floor(u - ru)), i1 = Math.min(w - 1, Math.ceil(u + ru));
    const j0 = Math.max(0, Math.floor(v - ru)), j1 = Math.min(h - 1, Math.ceil(v + ru));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const d = Math.hypot(i + 0.5 - u, j + 0.5 - v) / ru;
        if (d >= 1) continue;
        const k = (j * w + i) * 2 + channel;
        const val = Math.min(255, value * (1 - smooth(0.55, 1, d)) * 255);
        if (val > bytes[k]) bytes[k] = val;
      }
    }
  }

  return {
    bounds,
    uniform: { value: tex },
    *splatJob(trees, L) {
      for (let i = 0; i < bytes.length; i += 2) bytes[i] = 0;
      const first = !footprint;
      const flat = Math.hypot(L.x, L.z) || 1;
      const dx = -L.x / flat, dz = -L.z / flat;
      const tanEl = Math.max(L.y, 0.02) / flat;
      let n = 0;
      for (const t of trees) {
        const r = t.scale * (t.conifer ? 0.6 : 1.0);
        if (first) disc(t.x, t.z, r * 1.25, 0.75, 1);
        if (L.y > -0.02) {
          const crownH = t.scale * 1.55 * t.stretch;
          const len = Math.min(crownH / tanEl, 140);
          const steps = Math.max(1, Math.min(8, Math.ceil(len / r)));
          for (let s = 0; s <= steps; s++) {
            const f = (s / steps) * len;
            disc(t.x + dx * f, t.z + dz * f, r * (0.75 + 0.25 * (s / steps)), 1, 0);
          }
        }
        if (++n % 800 === 0) yield;
      }
      footprint = true;
      tex.needsUpdate = true;
    },
  };
}
