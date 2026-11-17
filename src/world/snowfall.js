import { BufferGeometry, Float32BufferAttribute, Points, ShaderMaterial } from 'three';
import { shared } from '../atmosphere.js';
import { atmosphereUniforms } from '../shaders/common.js';
import { LOW } from '../quality.js';

// Snow falling in a box that travels with the camera, so there are always flakes close by
// wherever the reader is. It fades in and out with uWinter.
export function buildSnowfall(size = 140) {
  const n = LOW ? 2500 : 6000;
  const pos = new Float32Array(n * 3), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = Math.random() * size;
    pos[i * 3 + 1] = Math.random() * size;
    pos[i * 3 + 2] = Math.random() * size;
    seed[i] = Math.random();
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new Float32BufferAttribute(seed, 1));
  const material = new ShaderMaterial({
    uniforms: { ...shared, uSize: { value: size } },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      ${atmosphereUniforms}
      uniform float uSize;
      attribute float aSeed;
      varying float vFade;
      void main() {
        vec3 p = position;
        p.y -= uTime * (1.1 + aSeed * 0.9);
        p.x += sin(uTime * 0.7 + aSeed * 30.0) * 1.2 + uTime * 0.6;
        p.z += cos(uTime * 0.5 + aSeed * 21.0) * 1.2;
        vec3 rel = mod(p - cameraPosition + uSize * 0.5, uSize) - uSize * 0.5;
        vec4 mv = viewMatrix * vec4(cameraPosition + rel, 1.0);
        float d = -mv.z;
        vFade = uWinter * smoothstep(0.5, 3.0, d) * (1.0 - smoothstep(uSize * 0.3, uSize * 0.5, length(rel)));
        gl_PointSize = clamp((0.09 + aSeed * 0.07) * projectionMatrix[1][1] * 600.0 / max(d, 0.1), 1.0, 14.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      ${atmosphereUniforms}
      varying float vFade;
      void main() {
        float r = length(gl_PointCoord - 0.5);
        float a = (1.0 - smoothstep(0.25, 0.5, r)) * vFade * 0.85;
        if (a < 0.01) discard;
        vec3 light = min(uSunColor * 0.6 + uAmbient * 1.3 + 0.08, vec3(1.0));
        gl_FragColor = vec4(light, a);
      }
    `,
  });
  const points = new Points(g, material);
  points.frustumCulled = false;
  points.renderOrder = 5;
  return points;
}
