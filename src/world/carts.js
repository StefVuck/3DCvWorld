import {
  BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry, BufferAttribute, InstancedMesh, InstancedBufferAttribute,
  ShaderMaterial, Color, Matrix4, Group, Box3, Sphere, Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { shared } from '../atmosphere.js';
import { atmosphereUniforms, noise, sky, terrainShadow, localShadow } from '../shaders/common.js';

// Things that travel the valley's roads and river: carts, riders, sheep and their
// shepherd, a penny-farthing, a skier and a ferry. Forward is +z.
// Parts: 0 static, 1 wheel (turns about its axle; pivot.w is its radius), 2 leg (swings from
// the hip; pivot.w is the swing direction), 3 tinted per instance.
const T = (x, y, z, rx = 0, rz = 0) => new Matrix4().makeRotationX(rx).premultiply(new Matrix4().makeRotationZ(rz)).setPosition(x, y, z);

function kit() {
  const c = new Color();
  const parts = [];
  const add = (g, m, colour, part = 0, pivot = [0, 0, 0], w = 0) => {
    g.applyMatrix4(m);
    const geo = g.index ? g.toNonIndexed() : g;
    const n = geo.attributes.position.count;
    c.set(colour).convertSRGBToLinear();
    geo.setAttribute('aColour', new BufferAttribute(new Float32Array(n * 3).map((_, i) => [c.r, c.g, c.b][i % 3]), 3));
    geo.setAttribute('aPart', new BufferAttribute(new Float32Array(n).fill(part), 1));
    geo.setAttribute('aPivot', new BufferAttribute(new Float32Array(n * 4).map((_, i) => [...pivot, w][i % 4]), 4));
    if (geo.attributes.uv) geo.deleteAttribute('uv');
    parts.push(geo);
  };
  const wheel = (x, y, z, r, colour = '#4a3a2a') => {
    add(new CylinderGeometry(r, r, 0.07, 16), T(x, y, z, 0, Math.PI / 2), colour, 1, [x, y, z], r);
    add(new BoxGeometry(0.05, r * 1.9, 0.05), T(x, y, z), '#2a2420', 1, [x, y, z], r);
  };
  const horse = (z0 = 2.15) => {
    add(new BoxGeometry(0.46, 0.55, 1.45), T(0, 1.3, z0), '#ffffff', 3);
    add(new BoxGeometry(0.24, 0.62, 0.3), T(0, 1.65, z0 + 0.7, -0.6), '#ffffff', 3);
    add(new BoxGeometry(0.2, 0.26, 0.55), T(0, 1.95, z0 + 0.95, 0.3), '#ffffff', 3);
    [[-0.15, -0.55, 1], [0.15, -0.55, -1], [-0.15, 0.55, -1], [0.15, 0.55, 1]].forEach(([x, dz, s]) => {
      add(new BoxGeometry(0.12, 1.05, 0.14), T(x, 0.53, z0 + dz), '#ffffff', 3, [x, 1.05, z0 + dz], s);
    });
  };
  const person = (x, y, z, robe, head = '#c9a080', scale = 1) => {
    add(new ConeGeometry(0.26 * scale, 0.75 * scale, 8), T(x, y + 0.37 * scale, z), robe);
    add(new SphereGeometry(0.12 * scale, 8, 6), T(x, y + 0.86 * scale, z), head);
  };
  return { add, wheel, horse, person, done: () => mergeGeometries(parts) };
}

const KINDS = {
  cart() {
    const k = kit();
    k.add(new BoxGeometry(1.5, 0.12, 2.2), T(0, 0.75, -0.4), '#7a5a40');
    for (const x of [-0.72, 0.72]) k.add(new BoxGeometry(0.06, 0.35, 2.2), T(x, 0.95, -0.4), '#6b4f36');
    k.add(new BoxGeometry(1.5, 0.35, 0.06), T(0, 0.95, -1.48), '#6b4f36');
    for (const x of [-0.42, 0.42]) k.add(new BoxGeometry(0.07, 0.07, 1.7), T(x, 0.9, 1.4, -0.12), '#5a4430');
    k.add(new CylinderGeometry(0.28, 0.3, 0.75, 10), T(-0.32, 1.18, -0.9), '#8a6648');
    k.add(new SphereGeometry(0.32, 8, 6), T(0.3, 1.0, -0.6), '#c9b48a');
    k.add(new SphereGeometry(0.26, 8, 6), T(0.28, 1.0, -1.15), '#d9cbb0');
    k.person(0, 0.8, 0.45, '#4f5a3a');
    for (const x of [-0.82, 0.82]) k.wheel(x, 0.55, -0.4, 0.55);
    k.horse();
    return k.done();
  },
  rider() {
    const k = kit();
    k.horse(0);
    k.add(new BoxGeometry(0.5, 0.08, 0.6), T(0, 1.6, -0.05), '#8a2f2a');
    k.person(0, 1.5, -0.05, '#3f4f62');
    return k.done();
  },
  sheep() {
    const k = kit();
    k.add(new SphereGeometry(0.42, 10, 8), T(0, 0.7, 0).scale(new Vector3(1, 0.85, 1.35)), '#ece6d6');
    k.add(new BoxGeometry(0.2, 0.22, 0.3), T(0, 0.82, 0.62), '#2a2420');
    [[-0.17, -0.3, 1], [0.17, -0.3, -1], [-0.17, 0.3, -1], [0.17, 0.3, 1]].forEach(([x, z, s]) => {
      k.add(new BoxGeometry(0.08, 0.45, 0.08), T(x, 0.22, z), '#2a2420', 2, [x, 0.45, z], s);
    });
    return k.done();
  },
  shepherd() {
    const k = kit();
    k.person(0, 0, 0, '#5a6a3e', '#c9a080', 2.2);
    k.add(new CylinderGeometry(0.03, 0.03, 1.9, 6), T(0.4, 0.95, 0.2), '#6b4f36');
    k.add(new SphereGeometry(0.1, 6, 4), T(0.4, 1.95, 0.32), '#6b4f36');
    return k.done();
  },
  pennyfarthing() {
    const k = kit();
    k.wheel(0, 0.75, 0.3, 0.75, '#2a2420');
    k.wheel(0, 0.22, -0.75, 0.22, '#2a2420');
    k.add(new BoxGeometry(0.05, 0.05, 1.3), T(0, 1.15, -0.25, 0.75), '#2a2420');
    k.person(0, 1.3, 0.05, '#7a2a24', '#c9a080', 1.1);
    k.add(new CylinderGeometry(0.1, 0.1, 0.25, 8), T(0, 2.4, 0.05), '#1c1a17');
    return k.done();
  },
  skier() {
    const k = kit();
    k.person(0, 0, 0, '#a8322d', '#c9a080', 2.4);
    for (const x of [-0.18, 0.18]) k.add(new BoxGeometry(0.1, 0.04, 1.9), T(x, 0.02, 0.1), '#2f5a8f');
    return k.done();
  },
  ferry() {
    const k = kit();
    k.add(new BoxGeometry(3.6, 0.35, 6.5), T(0, 0.15, 0), '#6b4f36');
    for (const x of [-1.75, 1.75]) k.add(new BoxGeometry(0.1, 0.5, 6.5), T(x, 0.55, 0), '#5a4430');
    k.add(new BoxGeometry(1.4, 0.8, 1.2), T(0.6, 0.75, -1.4), '#8a6648');
    k.person(-0.8, 0.33, 1.5, '#3a2e26', '#c9a080', 2.2);
    k.add(new CylinderGeometry(0.04, 0.04, 3.2, 6), T(-1.0, 1.4, 1.9, 0.5), '#6b4f36');
    return k.done();
  },
};

const vertex = /* glsl */ `
  attribute vec3 aColour;
  attribute float aPart;
  attribute vec4 aPivot;
  attribute vec4 aA;
  attribute vec4 aB;
  attribute vec2 aInfo;
  uniform float uTime;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec3 vColor;
  mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
  mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
  void main() {
    float len = max(distance(aA.xz, aB.xz), 0.1);
    float travelled = (uTime + aInfo.x * 197.0) * aB.w;
    float u; vec2 d = aB.xz - aA.xz;
    if (aA.w > 0.5) {
      // One way and round again (a skier): no turning back in view
      u = fract(travelled / len);
    } else {
      float f = fract(travelled / len * 0.5);
      u = f < 0.5 ? f * 2.0 : 2.0 - f * 2.0;
      if (f >= 0.5) d = -d;
    }
    vec3 base = mix(aA.xyz, aB.xyz, u);
    float heading = atan(d.x, d.y);
    if (aA.w > 1.5) {
      // Skiing: wide turns across the slope
      float s = sin(travelled * 0.09);
      base += vec3(d.y, 0.0, -d.x) / len * s * 9.0;
      heading += cos(travelled * 0.09) * 0.7;
    }
    vec3 p = position, n = normal;
    if (aPart > 0.5 && aPart < 1.5) {
      mat3 r = rotX(travelled / max(aPivot.w, 0.05));
      p = aPivot.xyz + r * (p - aPivot.xyz);
      n = r * n;
    } else if (aPart > 2.5 && abs(aPivot.w) > 0.5) {
      mat3 r = rotX(sin(travelled * 2.6) * 0.45 * aPivot.w);
      p = aPivot.xyz + r * (p - aPivot.xyz);
      n = r * n;
    } else if (aPart > 1.5 && aPart < 2.5) {
      mat3 r = rotX(sin(travelled * 4.0) * 0.4 * aPivot.w);
      p = aPivot.xyz + r * (p - aPivot.xyz);
      n = r * n;
    }
    float bob = abs(sin(travelled * 2.6)) * 0.04 * aInfo.y;
    mat3 h = rotY(heading);
    vWorld = base + h * p + vec3(0.0, bob, 0.0);
    vNormal = normalize(h * n);
    vColor = aPart > 2.5 ? aColour * instanceColor : aColour;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
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
    float sh = terrainShadow(vWorld, uSunDir) * localShadowAt(vWorld, N);
    vec3 col = vColor * (uSunColor * (max(dot(N, uSunDir), 0.0) * 0.8 + 0.2) * sh + uAmbient * (0.65 + 0.35 * N.y));
    gl_FragColor = vec4(applyAtmosphere(col, vWorld), 1.0);
  }
`;

export class Carts {
  constructor() {
    this.list = [];
    this.tag = '';
  }

  // a and b are world positions; oneWay loops a to b, ski zigzags down from a to b
  add(a, b, { kind = 'cart', speed = 1.4, horse = '#6b4a32', phase = Math.random(), oneWay = false, ski = false, bob = 1, tag = this.tag } = {}) {
    this.list.push({ a, b, kind, speed, horse, phase, mode: ski ? 2 : oneWay ? 1 : 0, bob, tag });
  }

  build() {
    const group = new Group();
    const material = new ShaderMaterial({ uniforms: { ...shared }, vertexShader: vertex, fragmentShader: fragment });
    const keys = new Map();
    for (const t of this.list) {
      const key = `${t.kind}|${t.tag}`;
      if (!keys.has(key)) keys.set(key, []);
      keys.get(key).push(t);
    }
    const geos = {};
    for (const [key, list] of keys) {
      const kind = key.split('|')[0];
      const n = list.length;
      const mesh = new InstancedMesh(geos[kind] ??= KINDS[kind](), material, n);
      const A = new Float32Array(n * 4), B = new Float32Array(n * 4), I = new Float32Array(n * 2);
      const c = new Color(), box = new Box3();
      list.forEach((t, i) => {
        A.set([t.a.x, t.a.y, t.a.z, t.mode], i * 4);
        B.set([t.b.x, t.b.y, t.b.z, t.speed], i * 4);
        I.set([t.phase, t.bob], i * 2);
        mesh.setColorAt(i, c.set(t.horse).convertSRGBToLinear());
        box.expandByPoint(t.a).expandByPoint(t.b);
      });
      box.expandByScalar(12);
      mesh.geometry = mesh.geometry.clone();
      mesh.geometry.setAttribute('aA', new InstancedBufferAttribute(A, 4));
      mesh.geometry.setAttribute('aB', new InstancedBufferAttribute(B, 4));
      mesh.geometry.setAttribute('aInfo', new InstancedBufferAttribute(I, 2));
      mesh.boundingSphere = box.getBoundingSphere(new Sphere());
      mesh.userData.tag = list[0].tag;
      group.add(mesh);
    }
    return group;
  }
}
