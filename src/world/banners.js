import { BufferGeometry, BufferAttribute, Mesh, ShaderMaterial, Vector3, DoubleSide, Group } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { shared } from '../atmosphere.js';
import { atmosphereUniforms, noise, sky, localShadow } from '../shaders/common.js';

// Flags fly from a pole along `along`; hangings drop from their top edge. A hanging against a
// wall is given `out`, the direction away from it, and only ever sways that way.
export class Banners {
  constructor(heraldry) {
    this.heraldry = heraldry;
    this.parts = [];
  }

  add({ pos, along, width, height, uv, mode = 'flag', phase = Math.random() * 6, out = null }) {
    const nx = 10, ny = 6;
    const up = new Vector3(0, 1, 0);
    const a = along.clone().normalize();
    const n = out ? out.clone().normalize() : new Vector3().crossVectors(a, up).normalize();
    const hang = out ? 1 : 0;
    const p = [], uvs = [], flap = [], nor = [], ph = [], idx = [], hangs = [];
    for (let j = 0; j <= ny; j++) {
      for (let i = 0; i <= nx; i++) {
        const u = i / nx, v = j / ny;
        const off = mode === 'flag' ? a.clone().multiplyScalar(u * width) : a.clone().multiplyScalar((u - 0.5) * width);
        const q = pos.clone().add(off).addScaledVector(up, -v * height);
        p.push(q.x, q.y, q.z);
        uvs.push(uv[0] + (uv[2] - uv[0]) * u, uv[1] + (uv[3] - uv[1]) * v);
        flap.push(mode === 'flag' ? u : v * (out ? 0.3 : 0.6));
        hangs.push(hang);
        nor.push(n.x, n.y, n.z);
        ph.push(phase);
      }
    }
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * (nx + 1) + i;
        idx.push(k, k + nx + 1, k + 1, k + 1, k + nx + 1, k + nx + 2);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(p), 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(nor), 3));
    g.setAttribute('aFlap', new BufferAttribute(new Float32Array(flap), 1));
    g.setAttribute('aPhase', new BufferAttribute(new Float32Array(ph), 1));
    g.setAttribute('aHang', new BufferAttribute(new Float32Array(hangs), 1));
    g.setIndex(idx);
    this.parts.push(g.toNonIndexed());
  }

  build() {
    if (!this.parts.length) return null;
    const material = new ShaderMaterial({
      uniforms: { ...shared, uMap: { value: this.heraldry.texture } },
      side: DoubleSide,
      vertexShader: /* glsl */ `
        ${atmosphereUniforms}
        attribute float aFlap;
        attribute float aPhase;
        attribute float aHang;
        varying vec2 vUv;
        varying vec3 vWorld;
        varying vec3 vNormal;
        void main() {
          vec3 p = position;
          float w = sin(aFlap * 5.0 - uTime * 3.2 + aPhase) * 0.5 + sin(aFlap * 9.0 - uTime * 5.1 + aPhase * 2.0) * 0.18;
          p += normal * mix(w, 0.5 + 0.5 * w, aHang) * aFlap * 0.55;
          p.y -= aFlap * aFlap * 0.25;
          vec4 wp = modelMatrix * vec4(p, 1.0);
          vUv = uv;
          vWorld = wp.xyz;
          vNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        ${atmosphereUniforms}
        ${noise}
        ${sky}
        ${localShadow}
        uniform sampler2D uMap;
        varying vec2 vUv;
        varying vec3 vWorld;
        varying vec3 vNormal;
        void main() {
          vec4 t = texture(uMap, vUv);
          if (t.a < 0.5) discard;
          vec3 N = normalize(vNormal);
          if (!gl_FrontFacing) N = -N;
          vec3 albedo = pow(t.rgb, vec3(2.2)) * (0.9 + 0.15 * vnoise(vUv * 80.0));
          float sun = (0.35 + 0.65 * abs(dot(N, uSunDir))) * localShadowAt(vWorld, N);
          vec3 col = albedo * (uSunColor * sun * 0.8 + uAmbient);
          col = applyAtmosphere(col, vWorld);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    // One mesh per neighbourhood rather than one for the whole valley, each with room in its
    // bounds for the cloth to flap, so banners out of view are not drawn
    const cells = new Map();
    for (const g of this.parts) {
      g.computeBoundingBox();
      const c = g.boundingBox.getCenter(new Vector3());
      const k = `${Math.floor(c.x / 400)},${Math.floor(c.z / 400)}`;
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k).push(g);
    }
    const group = new Group();
    for (const parts of cells.values()) {
      const mesh = new Mesh(mergeGeometries(parts), material);
      mesh.geometry.computeBoundingSphere();
      mesh.geometry.boundingSphere.radius += 3;
      group.add(mesh);
    }
    return group;
  }
}
