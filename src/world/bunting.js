import { BufferGeometry, BufferAttribute, Mesh, ShaderMaterial, Color, Vector3, DoubleSide } from 'three';
import { shared } from '../atmosphere.js';
import { atmosphereUniforms, noise, sky, terrainShadow, localShadow } from '../shaders/common.js';

const COLOURS = ['#a8322d', '#efe6d3', '#2f5a8f', '#c9a13a', '#3f7a42', '#6d3f78'];
const UP = new Vector3(0, 1, 0);

// Strings of small pennants slung between two points, swaying a little in the wind
export class Bunting {
  constructor() {
    this.pos = []; this.col = []; this.sway = []; this.side = [];
  }

  string(a, b, { sag = 0.9, spacing = 0.85, size = 0.62, seed = 0 } = {}) {
    const len = a.distanceTo(b), n = Math.max(2, Math.floor(len / spacing));
    const at = t => a.clone().lerp(b, t).addScaledVector(UP, -sag * 4 * t * (1 - t));
    const along = b.clone().sub(a).setY(0).normalize();
    const across = new Vector3(-along.z, 0, along.x);
    const c = new Color();
    const push = (p, colour, sway) => {
      this.pos.push(p.x, p.y, p.z);
      c.set(colour).convertSRGBToLinear();
      this.col.push(c.r, c.g, c.b);
      this.sway.push(sway, seed + this.pos.length * 0.01);
      this.side.push(across.x, across.z);
    };
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 0.7) / n;
      const p0 = at(t0), p1 = at(t1), tip = p0.clone().lerp(p1, 0.5).addScaledVector(UP, -size);
      const colour = COLOURS[(i + seed) % COLOURS.length];
      push(p0, colour, 0); push(p1, colour, 0); push(tip, colour, 1);
    }
    for (let i = 0; i < n; i++) {
      const p0 = at(i / n), p1 = at((i + 1) / n);
      const q0 = p0.clone().addScaledVector(UP, 0.03), q1 = p1.clone().addScaledVector(UP, 0.03);
      for (const p of [p0, p1, q1, p0, q1, q0]) push(p, '#3a3026', 0);
    }
  }

  build() {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('aColour', new BufferAttribute(new Float32Array(this.col), 3));
    g.setAttribute('aSway', new BufferAttribute(new Float32Array(this.sway), 2));
    g.setAttribute('aSide', new BufferAttribute(new Float32Array(this.side), 2));
    g.computeBoundingSphere();
    return new Mesh(g, new ShaderMaterial({
      uniforms: { ...shared },
      side: DoubleSide,
      vertexShader: /* glsl */ `
        attribute vec3 aColour;
        attribute vec2 aSway;
        attribute vec2 aSide;
        uniform float uTime;
        varying vec3 vWorld;
        varying vec3 vColor;
        void main() {
          vec3 p = position;
          float s = sin(uTime * 2.3 + aSway.y * 7.0) * 0.6 + sin(uTime * 3.7 + aSway.y * 3.0) * 0.4;
          p.xz += aSide * s * 0.16 * aSway.x;
          vWorld = (modelMatrix * vec4(p, 1.0)).xyz;
          vColor = aColour;
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
        varying vec3 vColor;
        void main() {
          float sh = terrainShadow(vWorld, uSunDir) * localShadowAt(vWorld, vec3(0.0, 1.0, 0.0));
          vec3 col = vColor * (uSunColor * 0.7 * sh + uAmbient);
          gl_FragColor = vec4(applyAtmosphere(col, vWorld), 1.0);
        }
      `,
    }));
  }
}
