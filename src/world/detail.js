import {
  InstancedBufferGeometry, InstancedBufferAttribute, BufferAttribute, Mesh, ShaderMaterial, Color, Sphere, Vector3, DoubleSide,
} from 'three';
import { mulberry32, fieldAt, cropOf, forestOnly, riverDistance, riverWidth } from './valley.js';
import { marchShadow } from './trees.js';
import { shared } from '../atmosphere.js';
import { atmosphereUniforms, noise, sky, localShadow } from '../shaders/common.js';

const KIND = { grass: 0, wheat: 1, flower: 2, fern: 3 };
const FLOWERS = ['#f2e7c9', '#f0cf4a', '#c8483c', '#9a7bc2', '#f4f0e8', '#e8a23a'].map(c => new Color(c));
const GRASS = ['#6f8f3c', '#7f9a45', '#8ca14f', '#627f36'].map(c => new Color(c));

export function scatterDetail({ centre, radius = 210, count = 240000, meshHeight, heightCPU, decal }) {
  const r = mulberry32(404);
  const items = [];
  let tries = 0;
  while (items.length < count && tries < count * 3) {
    tries++;
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * radius;
    const x = centre.x + Math.cos(a) * d, z = centre.z + Math.sin(a) * d;
    const [earth, soil, yard] = decal.sampleCPU(x, z);
    if (soil > 0.35) continue;
    if (earth > 0.45 || (earth > 0.2 && r() < 0.7)) continue;
    const h = heightCPU(x, z);
    const slope = Math.hypot(heightCPU(x + 6, z) - heightCPU(x - 6, z), heightCPU(x, z + 6) - heightCPU(x, z - 6)) / 12;
    if (slope > 0.6) continue;
    const rd = riverDistance(x, z), rw = riverWidth(z);
    if (rd < rw * 0.5 + 3) continue;

    let kind = KIND.grass, w = 0.9, ht = 0.6, tint = GRASS[Math.floor(r() * GRASS.length)];
    if (rd < rw * 0.5 + 14) {
      kind = KIND.fern; w = 0.7; ht = 1.2; tint = new Color('#7c8c4c');
    } else if (forestOnly(x, z, h) > 0.35) {
      if (r() < 0.5) continue;
      kind = KIND.fern; w = 0.9; ht = 0.7; tint = new Color('#55702f');
    } else if (yard > 0.5) {
      ht = 0.3 + r() * 0.15; w = 0.8;
      if (r() < 0.08) { kind = KIND.flower; tint = FLOWERS[r() < 0.6 ? 0 : 1]; }
    } else {
      const crop = cropOf(fieldAt(x, z).r);
      if (crop === 'plough') continue;
      if (crop === 'wheat' || crop === 'barley') {
        kind = KIND.wheat; w = 0.55; ht = 0.95 + r() * 0.2;
        tint = new Color(crop === 'wheat' ? '#d4ae5c' : '#ddc98e');
      } else if (crop === 'young') {
        ht = 0.3; tint = new Color('#86a64a');
      } else if (crop === 'meadow' || (crop === 'pasture' && r() < 0.12)) {
        if (r() < 0.45) { kind = KIND.flower; tint = FLOWERS[Math.floor(r() * FLOWERS.length)]; }
        ht = 0.5 + r() * 0.25;
      } else if (crop === 'fallow') {
        ht = 0.7; tint = new Color('#a59c5c');
      }
    }
    items.push({ x, y: meshHeight(x, z) - 0.05, z, w: w * (0.8 + r() * 0.4), h: ht * (0.8 + r() * 0.4), kind, seed: r(), tint });
  }

  const n = items.length;
  const geo = new InstancedBufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0]), 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const off = new Float32Array(n * 3), par = new Float32Array(n * 4), tint = new Float32Array(n * 3);
  items.forEach((t, i) => {
    off.set([t.x, t.y, t.z], i * 3);
    par.set([t.w, t.h, t.kind, t.seed], i * 4);
    tint.set([t.tint.r, t.tint.g, t.tint.b], i * 3);
  });
  const shade = new InstancedBufferAttribute(new Float32Array(n).fill(1), 1);
  geo.setAttribute('aOffset', new InstancedBufferAttribute(off, 3));
  geo.setAttribute('aParams', new InstancedBufferAttribute(par, 4));
  geo.setAttribute('aTint', new InstancedBufferAttribute(tint, 3));
  geo.setAttribute('aShade', shade);
  geo.instanceCount = n;
  geo.boundingSphere = new Sphere(new Vector3(centre.x, centre.y, centre.z), radius + 20);

  const material = new ShaderMaterial({
    uniforms: { ...shared, uFade: { value: new Vector3(55, 120, 0) } },
    side: DoubleSide,
    vertexShader: /* glsl */ `
      ${atmosphereUniforms}
      uniform vec3 uFade;
      attribute vec3 aOffset;
      attribute vec4 aParams;
      attribute vec3 aTint;
      attribute float aShade;
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vTint;
      varying float vKind;
      varying float vSeed;
      varying float vShade;
      void main() {
        vec3 toCam = cameraPosition - aOffset;
        float dist = length(toCam);
        float fade = 1.0 - smoothstep(uFade.x, uFade.y, dist);
        float keep = 1.0 - smoothstep(18.0, uFade.y, dist) * 0.85;
        if (fract(aParams.w * 7.31) > keep) fade = 0.0;
        vec3 right = normalize(vec3(-toCam.z, 0.0, toCam.x) + 1e-4);
        float w = aParams.x * (0.6 + 0.4 * fade);
        float h = aParams.y * fade;
        vec3 p = aOffset + right * position.x * w + vec3(0.0, position.y * h, 0.0);
        float gust = 0.5 + 0.5 * sin(uTime * 0.6 + aOffset.x * 0.03 + aOffset.z * 0.02);
        float bend = (sin(uTime * 1.9 + aParams.w * 30.0 + aOffset.x * 0.2) * 0.1 + 0.08) * (0.4 + gust);
        p.xz += vec2(0.8, 0.5) * bend * position.y * position.y * h;
        vUv = position.xy + vec2(0.5, 0.0);
        vWorld = p;
        vTint = aTint;
        vKind = aParams.z;
        vSeed = aParams.w;
        vShade = aShade;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${atmosphereUniforms}
      ${noise}
      ${sky}
      ${localShadow}
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vTint;
      varying float vKind;
      varying float vSeed;
      varying float vShade;

      float blades(vec2 uv, float seed, int count, float width) {
        float a = 0.0;
        for (int i = 0; i < 7; i++) {
          if (i >= count) break;
          float fi = float(i);
          float x0 = 0.5 + (hash12(vec2(seed * 91.0, fi)) - 0.5) * 0.75;
          float lean = (hash12(vec2(fi, seed * 37.0)) - 0.5) * 0.5;
          float top = 0.6 + 0.4 * hash12(vec2(seed * 13.0 + fi, 3.0));
          float y = uv.y / top;
          float cx = x0 + lean * y * y;
          float hw = width * pow(max(1.0 - y, 0.0), 0.8);
          a = max(a, step(abs(uv.x - cx), hw) * step(y, 1.0));
        }
        return a;
      }

      void main() {
        int k = int(vKind + 0.5);
        vec3 albedo = vTint;
        float a;
        if (k == 1) {
          a = blades(vUv, vSeed, 5, 0.025);
          vec2 e = vec2((vUv.x - 0.5) * 5.0, (vUv.y - 0.86) * 7.0);
          float ear = step(length(e), 1.0);
          a = max(a, ear);
          albedo = mix(vTint * 0.75, vTint * 1.1, vUv.y);
        } else if (k == 2) {
          a = blades(vUv, vSeed, 3, 0.05);
          vec3 green = srgb(vec3(0.42, 0.56, 0.24));
          albedo = green * (0.6 + 0.5 * vUv.y);
          vec2 c = vec2((vUv.x - 0.5 - (vSeed - 0.5) * 0.3) * 4.0, (vUv.y - 0.88) * 7.0);
          float head = step(length(c), 1.0);
          if (head > 0.5) { a = 1.0; albedo = vTint; }
        } else if (k == 3) {
          a = blades(vUv, vSeed, 6, 0.09);
          albedo = vTint * (0.55 + 0.6 * vUv.y);
        } else {
          a = blades(vUv, vSeed, 7, 0.06);
          albedo = vTint * (0.55 + 0.6 * vUv.y);
        }
        if (a < 0.5) discard;
        albedo = mix(albedo, srgb(vec3(0.9, 0.91, 0.92)), uWinter * (0.45 + 0.5 * vUv.y));
        vec3 N = normalize(vec3(0.0, 1.0, 0.0) + normalize(cameraPosition - vWorld) * 0.4);
        float sun = (0.55 + 0.45 * max(dot(N, uSunDir), 0.0)) * vShade * localShadowAt(vWorld, vec3(0.0, 1.0, 0.0));
        float ao = mix(0.5, 1.0, vUv.y);
        vec3 col = albedo * (uSunColor * sun * 0.75 * ao + uAmbient * ao);
        col = applyAtmosphere(col, vWorld);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new Mesh(geo, material);
  return {
    mesh,
    *sunJob(L) {
      const arr = shade.array;
      for (let i = 0; i < n; i++) {
        arr[i] = marchShadow(heightCPU, items[i].x, items[i].y + 0.5, items[i].z, L);
        if (i % 8000 === 7999) yield;
      }
      shade.needsUpdate = true;
    },
  };
}
