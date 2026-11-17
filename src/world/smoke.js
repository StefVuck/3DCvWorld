import { InstancedBufferGeometry, InstancedBufferAttribute, BufferAttribute, Mesh, ShaderMaterial, Sphere, Vector3, Box3 } from 'three';
import { mulberry32 } from './valley.js';
import { shared } from '../atmosphere.js';
import { atmosphereUniforms, noise, sky } from '../shaders/common.js';

// One plume mesh per settlement, so the smoke of places out of view is not drawn
export function buildSmoke(chimneys, perChimney = 70, shared_material = null) {
  const r = mulberry32(17);
  const n = chimneys.length * perChimney;
  const geo = new InstancedBufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const origin = new Float32Array(n * 3), seed = new Float32Array(n);
  chimneys.forEach((c, k) => {
    for (let i = 0; i < perChimney; i++) {
      const j = k * perChimney + i;
      origin.set([c.x, c.y, c.z], j * 3);
      seed[j] = i / perChimney + r() * 0.01;
    }
  });
  geo.setAttribute('aOrigin', new InstancedBufferAttribute(origin, 3));
  geo.setAttribute('aSeed', new InstancedBufferAttribute(seed, 1));
  geo.instanceCount = n;
  // Room for the plumes to rise, drift downwind and spread
  const box = new Box3();
  for (const c of chimneys) box.expandByPoint(c.clone().add(new Vector3(-10, -2, -10))).expandByPoint(c.clone().add(new Vector3(32, 30, 24)));
  geo.boundingSphere = box.getBoundingSphere(new Sphere());

  const material = shared_material ?? new ShaderMaterial({
    uniforms: { ...shared },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      ${atmosphereUniforms}
      attribute vec3 aOrigin;
      attribute float aSeed;
      varying vec2 vUv;
      varying float vAlpha;
      varying float vLife;
      varying vec3 vWorld;
      void main() {
        float life = fract(uTime * 0.035 + aSeed);
        vec3 wind = vec3(0.55, 0.0, 0.35);
        vec3 p = aOrigin;
        p.y += life * 16.0 + life * life * 4.0;
        p += wind * life * life * 34.0 + wind * life * 6.0;
        p.x += sin(aSeed * 40.0 + uTime * 0.4) * life * 2.5;
        p.z += cos(aSeed * 31.0 + uTime * 0.3) * life * 2.0;
        float size = mix(0.6, 8.0, pow(life, 0.7));
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        float a = aSeed * 50.0 + life * 2.0;
        vec2 c = mat2(cos(a), -sin(a), sin(a), cos(a)) * position.xy;
        p += (right * c.x + up * c.y) * size;
        vUv = position.xy;
        vAlpha = smoothstep(0.0, 0.06, life) * (1.0 - smoothstep(0.35, 1.0, life));
        vLife = life;
        vWorld = p;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${atmosphereUniforms}
      ${noise}
      ${sky}
      varying vec2 vUv;
      varying float vAlpha;
      varying float vLife;
      varying vec3 vWorld;
      void main() {
        float d = length(vUv);
        float n = fbm(vUv * 1.6 + vLife * 3.0);
        float a = smoothstep(1.0, 0.15, d + (n - 0.5) * 0.9) * vAlpha * 0.13;
        if (a < 0.003) discard;
        vec3 base = srgb(vec3(0.82, 0.8, 0.78));
        vec3 col = base * (uAmbient * 1.1 + uSunColor * 0.45 * (0.6 + 0.4 * vUv.y));
        col = applyAtmosphere(col, vWorld);
        gl_FragColor = vec4(col, a);
      }
    `,
  });
  const mesh = new Mesh(geo, material);
  mesh.renderOrder = 5;
  return mesh;
}
