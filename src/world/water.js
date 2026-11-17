import { BufferGeometry, BufferAttribute, Mesh, ShaderMaterial, PlaneGeometry, Group, DoubleSide, Vector4 } from 'three';
import { gerstner, swell } from './waves.js';
import { riverX, riverDX, riverWidth, waterLevel, smooth } from './valley.js';
import { shared } from '../atmosphere.js';
import { atmosphereUniforms, noise, sky } from '../shaders/common.js';

function ribbon() {
  const zs = [];
  for (let z = -9800; z <= 9000; z += 12) zs.push(z);
  const pos = new Float32Array(zs.length * 2 * 3);
  const uv = new Float32Array(zs.length * 2 * 2);
  zs.forEach((z, k) => {
    const cx = riverX(z), dx = riverDX(z);
    const len = Math.hypot(1, dx);
    const px = 1 / len, pz = -dx / len;
    const half = riverWidth(z) * 0.5 + 16 + 110 * smooth(7100, 7500, z) * (1 - smooth(8300, 8700, z));
    const y = waterLevel(z);
    for (let s = 0; s < 2; s++) {
      const side = s === 0 ? -1 : 1;
      const i = k * 2 + s;
      pos[i * 3] = cx + side * px * half;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z + side * pz * half;
      uv[i * 2] = s;
      uv[i * 2 + 1] = z;
    }
  });
  const index = [];
  for (let k = 0; k < zs.length - 1; k++) {
    const a = k * 2, b = a + 1, c = a + 2, d = a + 3;
    index.push(a, b, c, b, d, c);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeBoundingSphere();
  return g;
}

export const swellUniforms = {
  uSwell: { value: new Vector4(0, 0, 260, 0) },
  uShip: { value: new Vector4(0, 0, 0, 1) },
};

function material(kind) {
  const isSea = kind !== 'river';
  const defines = {};
  if (isSea) defines.SEA = 1;
  if (kind === 'swell') defines.SWELL = 1;
  return new ShaderMaterial({
    uniforms: { ...shared, ...swellUniforms },
    defines,
    side: DoubleSide,
    transparent: !isSea,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform vec4 uShip;
      ${gerstner}
      varying vec3 vWorld;
      varying vec2 vUv;
      varying vec3 vWaveN;
      varying float vCrest;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWaveN = vec3(0.0, 1.0, 0.0);
        vCrest = 0.0;
        #ifdef SWELL
          wp.xz += uSwell.xy;
          float r = length(wp.xz - uSwell.xy);
          float fade = 1.0 - smoothstep(uSwell.z * 0.55, uSwell.z * 0.95, r);
          vec3 n;
          vec3 d = gerstner(wp.xz, uTime, fade, n);
          wp.xyz += d;
          vWaveN = n;
          vCrest = d.y;
        #endif
        vWorld = wp.xyz;
        vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      ${atmosphereUniforms}
      ${noise}
      ${sky}
      uniform sampler2D uReflectTex;
      uniform mat4 uReflectMatrix;
      uniform float uReflectOn;
      uniform vec4 uSwell;
      uniform vec4 uShip;
      varying vec3 vWorld;
      varying vec2 vUv;
      varying vec3 vWaveN;
      varying float vCrest;
      void main() {
        float swellR = length(vWorld.xz - uSwell.xy);
        #ifdef SWELL
          if (swellR > uSwell.z) discard;
        #elif defined(SEA)
          if (uSwell.w > 0.5 && swellR < uSwell.z) discard;
        #endif
        vec3 V = normalize(cameraPosition - vWorld);
        float dist = length(cameraPosition - vWorld);
        vec2 p = vWorld.xz;
        float fade = 1.0 - smoothstep(300.0, 2500.0, dist);
        #ifdef SEA
          vec2 flow = vec2(0.0, -uTime * 0.6);
          float amp = 0.18;
        #else
          vec2 flow = vec2(0.0, uTime * 1.2);
          float amp = 0.12;
        #endif
        vec3 N = vec3(0.0, 1.0, 0.0);
        if (fade > 0.0) {
          float e = 0.6;
          float n0 = fbm((p + flow) * 0.08);
          float nx = fbm((p + flow + vec2(e, 0.0)) * 0.08);
          float nz = fbm((p + flow + vec2(0.0, e)) * 0.08);
          N = normalize(vec3((n0 - nx) * amp * 8.0 * fade, 1.0, (n0 - nz) * amp * 8.0 * fade));
        }
        #ifdef SWELL
          float edgeFade = 1.0 - smoothstep(uSwell.z * 0.5, uSwell.z * 0.95, swellR);
          N = normalize(N + (vWaveN - vec3(0.0, 1.0, 0.0)) * edgeFade);
        #endif

        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 4.0);
        vec3 R = reflect(-V, N);
        R.y = abs(R.y);
        vec3 refl = skyColor(R);
        if (uReflectOn > 0.5) {
          vec4 rc = uReflectMatrix * vec4(vWorld, 1.0);
          vec2 ruv = rc.xy / rc.w + N.xz * 0.06 * fade;
          float valid = step(0.0, ruv.x) * step(ruv.x, 1.0) * step(0.0, ruv.y) * step(ruv.y, 1.0);
          float reach = 1.0 - smoothstep(1800.0, 4500.0, dist);
          refl = mix(refl, texture(uReflectTex, clamp(ruv, 0.001, 0.999)).rgb, valid * reach);
        }
        vec3 deep = srgb(vec3(0.16, 0.24, 0.24)) * (uAmbient + uSunColor * 0.15);
        float streak = fade > 0.0 ? fbm(vec2(p.x * 0.35, p.y * 0.025 - flow.y * 0.02)) : 0.5;
        refl *= 0.9 + 0.2 * mix(0.5, streak, fade);
        vec3 col = mix(deep, refl, clamp(fres * 0.9 + 0.12, 0.0, 1.0));

        float glint = pow(max(dot(R, uSunDir), 0.0), 220.0);
        col += uSunColor * glint * 2.5 * uSunVisible;

        #ifdef SWELL
          vec2 rel = vWorld.xz - uShip.xy;
          vec2 H = uShip.zw;
          float along = dot(rel, H), across = dot(rel, vec2(-H.y, H.x));
          float hull = length(vec2(along / 11.5, across / 3.9));
          float fn = fbm(vec2(along, across) * 0.35 + vec2(uTime * 0.9, 0.0));
          float foam = smoothstep(1.35, 1.0, hull + (fn - 0.5) * 0.5) * step(0.85, hull);
          float behind = -along - 10.0;
          float width = 3.0 + max(behind, 0.0) * 0.22;
          float wake = step(0.0, behind) * smoothstep(width, width * 0.4, abs(across)) * (1.0 - smoothstep(10.0, 140.0, behind));
          wake *= smoothstep(0.45, 0.7, fbm(vec2(along * 0.18 + uTime * 0.5, across * 0.5)));
          float crest = smoothstep(0.38, 0.6, vCrest + (fn - 0.5) * 0.3) * 0.5;
          float f = clamp(max(max(foam, wake), crest), 0.0, 1.0);
          col = mix(col, srgb(vec3(0.92, 0.92, 0.88)) * (uAmbient + uSunColor * 0.6), f * 0.8);
        #endif

        #ifndef SEA
          float edge = min(vUv.x, 1.0 - vUv.x);
          float bankShade = smoothstep(0.0, 0.42, edge);
          col = mix(srgb(vec3(0.2, 0.26, 0.17)) * (uAmbient + uSunColor * 0.2), col, 0.6 + 0.4 * bankShade);
          float alpha = smoothstep(0.0, 0.04, edge);
        #else
          float alpha = 1.0;
        #endif

        col = applyAtmosphere(col, vWorld);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

export function buildWater() {
  const group = new Group();
  group.userData.water = true;
  const river = new Mesh(ribbon(), material('river'));
  river.renderOrder = 1;
  group.add(river);

  const seaGeo = new PlaneGeometry(60000, 40000, 1, 1);
  seaGeo.rotateX(-Math.PI / 2);
  // The river reaches sea level near its mouth, so the sea sits a little lower: two surfaces at
  // exactly the same height fight over which is in front and shimmer, worst on phone GPUs
  seaGeo.translate(0, -0.25, 22000);
  const sea = new Mesh(seaGeo, material('sea'));
  group.add(sea);

  const swellGeo = new PlaneGeometry(swell.radius * 2, swell.radius * 2, 240, 240);
  swellGeo.rotateX(-Math.PI / 2);
  const swellMesh = new Mesh(swellGeo, material('swell'));
  swellMesh.frustumCulled = false;
  swellMesh.visible = false;
  group.add(swellMesh);
  group.userData.swell = swellMesh;
  return group;
}
