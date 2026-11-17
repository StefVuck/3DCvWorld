import {
  BufferGeometry, BufferAttribute, CylinderGeometry, SphereGeometry, BoxGeometry, ConeGeometry,
  InstancedMesh, InstancedBufferAttribute, ShaderMaterial, Color, DoubleSide, Vector3, Group, Box3, Sphere,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { shared } from '../atmosphere.js';
import { atmosphereUniforms, noise, sky, terrainShadow, localShadow } from '../shaders/common.js';

export const MODE = { idle: 0, walk: 1, circle: 2, sing: 3, conduct: 4, work: 5, pipe: 6 };

function figure() {
  const part = (g, id) => {
    const n = g.attributes.position.count;
    g.setAttribute('aPart', new BufferAttribute(new Float32Array(n).fill(id), 1));
    return g.index ? g.toNonIndexed() : g;
  };
  const robe = new CylinderGeometry(0.17, 0.32, 1.2, 8, 1);
  robe.translate(0, 0.6, 0);
  const chest = new CylinderGeometry(0.19, 0.17, 0.3, 8, 1);
  chest.translate(0, 1.33, 0);
  const head = new SphereGeometry(0.13, 8, 6);
  head.translate(0, 1.62, 0);
  const hood = new ConeGeometry(0.16, 0.22, 8, 1);
  hood.translate(0, 1.76, 0);
  const arm = side => {
    const a = new BoxGeometry(0.1, 0.56, 0.1);
    a.translate(side * 0.25, 1.42 - 0.28, 0);
    return a;
  };
  return mergeGeometries([part(robe, 0), part(chest, 0), part(head, 1), part(arm(-1), 2), part(arm(1), 3), part(hood, 4)]);
}

const vertex = /* glsl */ `
  attribute float aPart;
  attribute vec4 aA;
  attribute vec4 aB;
  attribute vec3 aAccent;
  attribute vec3 aInfo;
  uniform float uTime;
  uniform float uGate;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec3 vColor;

  mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
  mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
  mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }

  void main() {
    int mode = int(aInfo.x + 0.5);
    float phase = aInfo.y;
    float t = uTime + phase * 37.0;
    vec3 base = aA.xyz;
    float heading = aA.w;
    float bob = 0.0, lean = 0.0, pitch = 0.0, nod = 0.0, armL = 0.0, armR = 0.0;

    if (mode == 1) {
      float len = max(distance(aA.xz, aB.xz), 0.1);
      float f = fract(t * aB.w / len * 0.5);
      float u = f < 0.5 ? f * 2.0 : 2.0 - f * 2.0;
      u = smoothstep(0.0, 1.0, u) * 0.12 + u * 0.88;
      base = mix(aA.xyz, aB.xyz, u);
      vec2 d = (aB.xz - aA.xz) * (f < 0.5 ? 1.0 : -1.0);
      heading = atan(d.x, d.y);
      float stride = t * aB.w * 3.2;
      bob = abs(sin(stride)) * 0.05;
      armL = sin(stride) * 0.45;
      armR = -armL;
    } else if (mode == 2) {
      float ang = uTime * aB.w / aB.x + phase * 6.2831853;
      base = aA.xyz + vec3(cos(ang), 0.0, sin(ang)) * aB.x;
      heading = atan(-sin(ang), cos(ang));
      float stride = uTime * aB.w * 3.6 + phase * 3.0;
      bob = abs(sin(stride)) * 0.09;
      armL = mix(sin(stride) * 0.45, -2.6, aB.y);
      armR = mix(-sin(stride) * 0.45, -0.4, aB.y);
    } else if (mode == 3) {
      float s = sin(uTime * 1.7 + phase * 0.7);
      lean = s * 0.06 * uGate;
      nod = (sin(uTime * 3.4 + phase) * 0.07 - 0.08) * uGate;
      armL = -1.0 * uGate;
      armR = -1.0 * uGate;
    } else if (mode == 4) {
      armL = (-1.7 + sin(uTime * 3.4) * 0.5) * uGate;
      armR = (-1.5 + cos(uTime * 3.4) * 0.7) * uGate;
      lean = sin(uTime * 1.7) * 0.05 * uGate;
      bob = abs(sin(uTime * 1.7)) * 0.03 * uGate;
    } else if (mode == 6) {
      armL = -1.25;
      armR = -1.1 + sin(uTime * 6.0) * 0.06;
      lean = sin(uTime * 0.9) * 0.02;
      nod = 0.05;
    } else if (mode == 5) {
      float w = sin(t * 3.6);
      armR = -1.4 + w * 1.0;
      armL = -0.9 + w * 0.5;
      pitch = 0.28 + w * 0.08;
    } else {
      heading += sin(t * 0.21) * 0.5;
      lean = sin(t * 0.7) * 0.025;
      armL = sin(t * 0.5) * 0.08;
      armR = -armL - 0.9 * smoothstep(0.75, 1.0, sin(t * 0.37));
      nod = sin(t * 0.9) * 0.05;
    }

    vec3 p = position;
    vec3 n = normal;
    if (aPart > 1.5 && aPart < 3.5) {
      vec3 piv = vec3(aPart < 2.5 ? -0.25 : 0.25, 1.42, 0.0);
      mat3 r = rotX(aPart < 2.5 ? armL : armR);
      p = piv + r * (p - piv);
      n = r * n;
    } else if ((aPart > 0.5 && aPart < 1.5) || aPart > 3.5) {
      vec3 piv = vec3(0.0, 1.48, 0.0);
      mat3 r = rotX(-nod);
      p = piv + r * (p - piv);
      n = r * n;
    }
    mat3 body = rotY(heading) * rotZ(lean) * rotX(pitch);
    p = body * (p * aInfo.z);
    n = body * n;
    vec3 w = base + p + vec3(0.0, bob, 0.0);
    vWorld = w;
    vNormal = normalize(n);
    vColor = aPart < 0.5 ? instanceColor
           : aPart < 1.5 ? mix(vec3(0.62, 0.43, 0.32), vec3(0.32, 0.2, 0.13), fract(phase * 7.3) * fract(phase * 7.3))
           : aPart < 3.5 ? instanceColor * 0.82
           : aAccent;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }
`;

const fragment = /* glsl */ `
  ${atmosphereUniforms}
  ${noise}
  ${sky}
  ${terrainShadow}
  ${localShadow}
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec3 vColor;
  void main() {
    vec3 N = normalize(vNormal);
    vec3 L = uSunDir;
    float sh = terrainShadow(vWorld, L) * localShadowAt(vWorld, N);
    float ndl = max(dot(N, L), 0.0) * 0.8 + 0.2;
    vec3 albedo = mix(vColor, vec3(0.88, 0.89, 0.9), uWinter * smoothstep(0.55, 0.9, N.y) * 0.65);
    vec3 col = albedo * (uSunColor * ndl * sh + uAmbient * (0.65 + 0.35 * N.y));
    gl_FragColor = vec4(applyAtmosphere(col, vWorld), 1.0);
  }
`;

const tmp = new Color();

// Small animated figures. Positions are in world space; places add them through helpers that
// convert from their local frame.
// Instances are grouped by settlement, each with a bounding sphere around where its folk can
// wander, so the people of places out of view are not drawn at all
function groups(list, bounds, build) {
  const byTag = new Map();
  for (const p of list) {
    if (!byTag.has(p.tag)) byTag.set(p.tag, []);
    byTag.get(p.tag).push(p);
  }
  const group = new Group();
  for (const [tag, items] of byTag) {
    const mesh = build(items);
    mesh.userData.tag = tag;
    const box = new Box3();
    for (const p of items) bounds(p, box);
    mesh.boundingSphere = box.getBoundingSphere(new Sphere());
    group.add(mesh);
  }
  return group;
}

function share(base) {
  const g = new BufferGeometry();
  for (const [name, attr] of Object.entries(base.attributes)) g.setAttribute(name, attr);
  return g;
}

export class People {
  constructor() {
    this.list = [];
    this.tag = '';
  }

  // gate puts a figure in a group whose movement can be switched on and off (uGate, see gates)
  add({ mode = MODE.idle, a, b = a, heading = 0, speed = 1, radius = 4, arms = 0, color = '#6b5a48', accent, scale = 1, phase = Math.random(), gate = null }) {
    this.list.push({ mode, a, b, heading, speed, radius, arms, color, accent: accent ?? color, scale, phase, tag: gate ? `gate:${gate}` : this.tag, gate });
  }

  build() {
    const base = figure();
    const material = new ShaderMaterial({ uniforms: { ...shared, uGate: { value: 1 } }, vertexShader: vertex, fragmentShader: fragment });
    this.gates = new Map();
    const gated = gate => {
      if (!this.gates.has(gate)) this.gates.set(gate, new ShaderMaterial({ uniforms: { ...shared, uGate: { value: 0 } }, vertexShader: vertex, fragmentShader: fragment }));
      return this.gates.get(gate);
    };
    const pad = new Vector3(3, 3, 3);
    return groups(this.list, (p, box) => {
      box.expandByPoint(p.a).expandByPoint(p.b);
      if (p.mode === MODE.circle) box.expandByScalar(p.radius);
      box.min.sub(pad);
      box.max.add(pad);
    }, items => this.buildMesh(items, base, items[0].gate ? gated(items[0].gate) : material));
  }

  buildMesh(list, base, material) {
    const n = list.length;
    const mesh = new InstancedMesh(share(base), material, n);
    const A = new Float32Array(n * 4), B = new Float32Array(n * 4), acc = new Float32Array(n * 3), info = new Float32Array(n * 3);
    list.forEach((p, i) => {
      A.set([p.a.x, p.a.y, p.a.z, p.heading], i * 4);
      if (p.mode === MODE.circle) B.set([p.radius, p.arms, 0, p.speed], i * 4);
      else B.set([p.b.x, p.b.y, p.b.z, p.speed], i * 4);
      tmp.set(p.accent).convertSRGBToLinear();
      acc.set([tmp.r, tmp.g, tmp.b], i * 3);
      info.set([p.mode, p.phase, p.scale * 1.15], i * 3);
      mesh.setColorAt(i, tmp.set(p.color).convertSRGBToLinear());
    });
    const g = mesh.geometry;
    g.setAttribute('aA', new InstancedBufferAttribute(A, 4));
    g.setAttribute('aB', new InstancedBufferAttribute(B, 4));
    g.setAttribute('aAccent', new InstancedBufferAttribute(acc, 3));
    g.setAttribute('aInfo', new InstancedBufferAttribute(info, 3));
    return mesh;
  }
}

// Flocks circling over a place: rooks round the abbey tower, gulls over the harbour
export class Birds {
  constructor() {
    this.list = [];
  }

  flock({ centre, count = 10, radius = 20, height = 30, speed = 7, color = '#2a2622', size = 0.9, seed = 1 }) {
    const tag = this.tag;
    let s = seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < count; i++) {
      this.list.push({
        c: new Vector3(centre.x, centre.y + height + (rnd() - 0.5) * 8, centre.z),
        r: radius * (0.6 + rnd() * 0.6), speed: speed * (0.85 + rnd() * 0.3) * (rnd() < 0.15 ? -1 : 1),
        phase: rnd(), color, size, tag,
      });
    }
  }

  // Birds that fly a route from one place to another now and then (carrier pigeons)
  courier({ from, to, count = 3, speed = 30, color = '#8a8e96', size = 0.7 }) {
    const period = from.distanceTo(to) / speed / 0.55;
    for (let i = 0; i < count; i++) {
      this.list.push({ c: from.clone(), e: to.clone(), period, r: 0, speed: 0, phase: i / count + (i % 2) * 0.07, color, size, tag: this.tag, mode: 1 });
    }
  }

  build() {
    return groups(this.list, (b, box) => {
      box.expandByPoint(b.c.clone().addScalar(-b.r - 6));
      box.expandByPoint(b.c.clone().addScalar(b.r + 6));
      if (b.e) { box.expandByPoint(b.e); box.max.y += 80; }
    }, items => this.buildMesh(items));
  }

  buildMesh(list) {
    const n = list.length;
    const pos = new Float32Array([
      0, 0, 0.18, 0, 0, -0.12, -1, 0, -0.1,
      0, 0, 0.18, 1, 0, -0.1, 0, 0, -0.12,
    ]);
    const tip = new Float32Array([0, 0, 1, 0, 1, 0]);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aTip', new BufferAttribute(tip, 1));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(18).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    const mesh = new InstancedMesh(g, new ShaderMaterial({
      uniforms: { ...shared },
      side: DoubleSide,
      vertexShader: /* glsl */ `
        attribute float aTip;
        attribute vec4 aC;
        attribute vec4 aD;
        attribute vec4 aE;
        uniform float uTime;
        varying vec3 vWorld;
        varying vec3 vColor;
        void main() {
          vec3 c;
          vec2 d;
          float glide;
          if (aD.w > 0.5) {
            float cyc = fract(uTime / aE.w + aD.y);
            if (cyc > 0.55) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vWorld = vec3(0.0); vColor = vec3(0.0); return; }
            float s = cyc / 0.55;
            c = mix(aC.xyz, aE.xyz, s);
            c.y += sin(3.14159 * s) * 70.0 + sin(uTime * 2.0 + aD.y * 9.0) * 1.5;
            d = normalize(aE.xz - aC.xz);
            glide = 1.0;
          } else {
            float ang = uTime * aD.x / aC.w + aD.y * 6.2831853;
            c = aC.xyz + vec3(cos(ang), 0.0, sin(ang)) * aC.w;
            c.y += sin(uTime * 0.4 + aD.y * 20.0) * 3.0;
            d = vec2(-sin(ang), cos(ang)) * sign(aD.x);
            glide = smoothstep(-0.2, 0.4, sin(uTime * 0.5 + aD.y * 9.0));
          }
          float h = atan(d.x, d.y);
          vec3 p = position * aD.z;
          p.y += aTip * aD.z * (sin(uTime * 11.0 + aD.y * 30.0) * 0.55 * glide + 0.12);
          float cs = cos(h), sn = sin(h);
          p = vec3(cs * p.x + sn * p.z, p.y, -sn * p.x + cs * p.z);
          float bank = aD.w > 0.5 ? 0.0 : -0.25 * sign(aD.x);
          vWorld = c + p + vec3(0.0, p.x * bank, 0.0);
          vColor = instanceColor;
          gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        ${atmosphereUniforms}
        ${noise}
        ${sky}
        varying vec3 vWorld;
        varying vec3 vColor;
        void main() {
          vec3 col = vColor * (uAmbient * 0.9 + uSunColor * 0.35);
          gl_FragColor = vec4(applyAtmosphere(col, vWorld), 1.0);
        }
      `,
    }), n);
    const C = new Float32Array(n * 4), D = new Float32Array(n * 4), E = new Float32Array(n * 4);
    list.forEach((b, i) => {
      C.set([b.c.x, b.c.y, b.c.z, Math.max(b.r, 1)], i * 4);
      D.set([b.speed, b.phase, b.size, b.mode ?? 0], i * 4);
      if (b.e) E.set([b.e.x, b.e.y, b.e.z, b.period], i * 4);
      mesh.setColorAt(i, tmp.set(b.color).convertSRGBToLinear());
    });
    g.setAttribute('aC', new InstancedBufferAttribute(C, 4));
    g.setAttribute('aD', new InstancedBufferAttribute(D, 4));
    g.setAttribute('aE', new InstancedBufferAttribute(E, 4));
    return mesh;
  }
}

export const CLOTH = ['#6b5a48', '#7a4a32', '#4f5a3a', '#8a7a58', '#3f4f62', '#9a8a6a', '#6a3a2e', '#58603e', '#a89870', '#4a3e34', '#7d6a4a', '#5a4a6a'];

// Helpers that work in a place's local frame
export function crowdKit(people, place, rnd, birds) {
  people.tag = place.id;
  if (birds) birds.tag = place.id;
  const pt = (lx, lz, ly = 0) => place.point(lx, ly, lz);
  const cloth = () => CLOTH[Math.floor(rnd() * CLOTH.length)];
  const hood = () => (rnd() < 0.5 ? cloth() : ['#d8cdb4', '#3a2e26', '#8a2f2a', '#c9b48a'][Math.floor(rnd() * 4)]);
  return {
    pt,
    cloth,
    idle(lx, lz, face, o = {}) {
      people.add({ a: pt(lx, lz, o.y), heading: face + place.rot, color: o.color ?? cloth(), accent: o.accent ?? hood(), phase: rnd(), scale: 0.9 + rnd() * 0.15, mode: o.mode ?? MODE.idle });
    },
    walk(from, to, o = {}) {
      people.add({ mode: MODE.walk, a: pt(from[0], from[1], o.y), b: pt(to[0], to[1], o.y2 ?? o.y), speed: o.speed ?? 1.1 + rnd() * 0.4, color: o.color ?? cloth(), accent: o.accent ?? hood(), phase: o.phase ?? rnd(), scale: 0.9 + rnd() * 0.15 });
    },
    circle(lx, lz, radius, n, o = {}) {
      for (let i = 0; i < n; i++) {
        people.add({ mode: MODE.circle, a: pt(lx, lz, o.y), radius, speed: o.speed ?? 1.2, arms: o.arms ?? 0, phase: i / n, color: o.colors ? o.colors[i % o.colors.length] : cloth(), accent: o.accent ?? hood(), scale: 0.92 });
      }
    },
    // A loose group facing a point, as round a stall or a performer
    gather(cx, cz, r0, r1, n, o = {}) {
      for (let i = 0; i < n; i++) {
        const a = (o.from ?? 0) + rnd() * (o.span ?? Math.PI * 2);
        const d = r0 + rnd() * (r1 - r0);
        const x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d;
        this.idle(x, z, Math.atan2(cx - x, cz - z), o);
      }
    },
  };
}
