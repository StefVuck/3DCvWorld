import { Group, Mesh, PlaneGeometry, ShaderMaterial, AdditiveBlending, InstancedMesh, InstancedBufferAttribute, Box3, Sphere } from 'three';
import { shared } from '../atmosphere.js';

// Soft halos for lamps that should read from far away: the lighthouse and the ship's lantern
export function buildGlow(points) {
  const group = new Group();
  const mats = [];
  points.forEach((p, i) => {
    const size = i === 0 && points.length > 1 ? 46 : 3.2;
    const material = new ShaderMaterial({
      uniforms: { uTime: shared.uTime, uWindowGlow: shared.uWindowGlow, uSize: { value: size }, uPulse: { value: size > 10 ? 1 : 0 }, uBoost: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uSize;
        varying vec2 vUv;
        void main() {
          vUv = position.xy;
          vec3 centre = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          vec3 p = centre + (right * position.x + up * position.y) * uSize;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uWindowGlow;
        uniform float uPulse;
        uniform float uBoost;
        varying vec2 vUv;
        void main() {
          float d = length(vUv);
          float core = exp(-d * d * 60.0);
          float halo = exp(-d * d * 7.0) * 0.35;
          float pulse = mix(1.0, 0.75 + 0.25 * sin(uTime * 0.9), uPulse);
          float flash = pow(0.5 + 0.5 * sin(uTime * 4.0), 3.0);
          pulse *= 1.0 + uBoost * (1.2 + 2.8 * flash);
          halo *= 1.0 + uBoost * 1.5;
          vec3 c = vec3(1.0, 0.78, 0.45) * (core * 3.0 + halo) * uWindowGlow * pulse;
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    });
    const m = new Mesh(new PlaneGeometry(2, 2), material);
    m.frustumCulled = false;
    m.renderOrder = 6;
    m.onBeforeRender = () => { m.position.copy(p); m.updateMatrixWorld(); };
    group.add(m);
    mats.push(material);
  });
  return { mesh: group, materials: mats };
}


// Warm halos round lit windows, fading in at dusk; each window lights at its own moment
export function buildWindowGlows(points) {
  const n = points.length;
  const material = new ShaderMaterial({
    uniforms: { uTime: shared.uTime, uWindowGlow: shared.uWindowGlow },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec4 aWin;
      uniform float uWindowGlow;
      varying vec2 vUv;
      varying float vOn;
      void main() {
        vUv = position.xy;
        vOn = smoothstep(aWin.w, aWin.w + 0.25, uWindowGlow);
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 p = aWin.xyz + (right * position.x + up * position.y) * 1.1 * step(0.001, vOn);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      varying float vOn;
      void main() {
        float d = length(vUv);
        float g = exp(-d * d * 9.0) * 0.55 + exp(-d * d * 60.0) * 0.6;
        float flicker = 0.9 + 0.1 * sin(uTime * 7.0 + gl_FragCoord.x * 0.01);
        gl_FragColor = vec4(vec3(1.0, 0.7, 0.36) * g * vOn * flicker, 1.0);
      }
    `,
  });
  const mesh = new InstancedMesh(new PlaneGeometry(2, 2), material, n);
  const data = new Float32Array(n * 4), box = new Box3();
  points.forEach((p, i) => {
    data.set([p.x, p.y, p.z, 0.05 + ((i * 0.618) % 1) * 0.55], i * 4);
    box.expandByPoint(p);
  });
  mesh.geometry.setAttribute('aWin', new InstancedBufferAttribute(data, 4));
  mesh.boundingSphere = box.expandByScalar(2).getBoundingSphere(new Sphere());
  mesh.renderOrder = 6;
  return mesh;
}
