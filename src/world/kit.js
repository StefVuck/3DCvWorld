import {
  BufferGeometry, BufferAttribute, Matrix4, Vector3, Quaternion, Euler, Color, BoxGeometry,
  CylinderGeometry, ConeGeometry, SphereGeometry, IcosahedronGeometry, ShaderMaterial, Mesh, TorusGeometry, Group,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { shared } from '../atmosphere.js';
import { atmosphereUniforms, noise, sky, terrainShadow, localShadow } from '../shaders/common.js';

export const SURF = {
  plaster: 0, stone: 1, thatch: 2, plank: 3, shingle: 4, timber: 5, glass: 6, flat: 7, straw: 8, wattle: 9,
  cloth: 10, tile: 11, strake: 12, needles: 13,
};

const tmpColor = new Color();

export function at(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, s = 1) {
  const q = new Quaternion().setFromEuler(new Euler(rx, ry, rz, 'YXZ'));
  const sc = typeof s === 'number' ? new Vector3(s, s, s) : new Vector3(...s);
  return new Matrix4().compose(new Vector3(x, y, z), q, sc);
}

export class Builder {
  constructor() {
    this.parts = [];
    this.stack = [new Matrix4()];
    this.groundY = 0;
  }

  get base() { return this.stack[this.stack.length - 1]; }

  group(matrix, fn) {
    this.stack.push(this.base.clone().multiply(matrix));
    fn(this);
    this.stack.pop();
  }

  // colorFn, if given, is called with each triangle's centroid in the geometry's own frame
  add(geo, matrix, surf, color = '#ffffff', colorFn = null) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    let faceColors = null;
    if (colorFn) {
      const lp = g.attributes.position.array;
      faceColors = [];
      for (let i = 0; i < lp.length; i += 9) {
        faceColors.push(new Color(colorFn((lp[i] + lp[i + 3] + lp[i + 6]) / 3, (lp[i + 1] + lp[i + 4] + lp[i + 7]) / 3, (lp[i + 2] + lp[i + 5] + lp[i + 8]) / 3)));
      }
    }
    g.applyMatrix4(this.base.clone().multiply(matrix));
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (g.attributes.uv1) g.deleteAttribute('uv1');
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count;
    const p = g.attributes.position.array, nr = g.attributes.normal.array;
    const uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
    tmpColor.set(color);
    for (let i = 0; i < n; i++) {
      const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
      const nx = nr[i * 3], ny = nr[i * 3 + 1], nz = nr[i * 3 + 2];
      if (Math.abs(ny) > 0.97) {
        uv[i * 2] = x; uv[i * 2 + 1] = z;
      } else {
        const l = Math.hypot(nx, nz) || 1;
        uv[i * 2] = x * (nz / l) - z * (nx / l);
        uv[i * 2 + 1] = y;
      }
      const c = faceColors ? faceColors[Math.floor(i / 3)] : tmpColor;
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('aSurf', new BufferAttribute(new Float32Array(n).fill(surf), 1));
    g.setAttribute('aUV', new BufferAttribute(uv, 2));
    g.setAttribute('aColor', new BufferAttribute(col, 3));
    g.setAttribute('aGround', new BufferAttribute(new Float32Array(n).fill(this.groundY), 1));
    this.parts.push(g);
    return this;
  }

  // Box with its base centred on (x, y, z)
  box(w, h, d, x, y, z, surf, color, ry = 0, rx = 0, rz = 0) {
    const g = new BoxGeometry(w, h, d);
    g.translate(0, h / 2, 0);
    return this.add(g, at(x, y, z, ry, rx, rz), surf, color);
  }

  // Beam between two points with a square cross-section
  beam(a, b, size, surf = SURF.timber, color) {
    const A = new Vector3(...a), B = new Vector3(...b);
    const len = A.distanceTo(B);
    const g = new BoxGeometry(size, len, size);
    const dir = B.clone().sub(A).normalize();
    const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir);
    const m = new Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), q, new Vector3(1, 1, 1));
    return this.add(g, m, surf, color);
  }

  cylinder(r, h, x, y, z, surf, color, segs = 10, ry = 0, rx = 0, rz = 0, rTop = r) {
    const g = new CylinderGeometry(rTop, r, h, segs);
    g.translate(0, h / 2, 0);
    return this.add(g, at(x, y, z, ry, rx, rz), surf, color);
  }

  cone(r, h, x, y, z, surf, color, segs = 10) {
    const g = new ConeGeometry(r, h, segs);
    g.translate(0, h / 2, 0);
    return this.add(g, at(x, y, z), surf, color);
  }

  // Cone and cylinder with alternating radial stripes, for tents
  stripedCone(r, h, x, y, z, a, b, segs = 12, open = false) {
    const g = new ConeGeometry(r, h, segs, 1, open);
    g.translate(0, h / 2, 0);
    const fn = (cx, cy, cz) => (Math.floor(((Math.atan2(cz, cx) / (Math.PI * 2)) + 1) * segs) % 2 ? a : b);
    return this.add(g, at(x, y, z), SURF.cloth, '#ffffff', fn);
  }

  stripedCylinder(r, h, x, y, z, a, b, segs = 12) {
    const g = new CylinderGeometry(r, r, h, segs, 1, true);
    g.translate(0, h / 2, 0);
    const fn = (cx, cy, cz) => (Math.floor(((Math.atan2(cz, cx) / (Math.PI * 2)) + 1) * segs) % 2 ? a : b);
    return this.add(g, at(x, y, z), SURF.cloth, '#ffffff', fn);
  }

  // Box whose top faces are striped along x, for awnings
  stripedBox(w, h, d, x, y, z, a, b, stripe, ry = 0, rx = 0, rz = 0) {
    const g = new BoxGeometry(w, h, d, Math.max(1, Math.round(w / stripe)), 1, 1);
    g.translate(0, h / 2, 0);
    const fn = cx => (Math.floor((cx + w / 2) / stripe) % 2 ? a : b);
    return this.add(g, at(x, y, z, ry, rx, rz), SURF.cloth, '#ffffff', fn);
  }

  blob(r, x, y, z, surf, color, scale = [1, 1, 1], detail = 1, ry = 0, rx = 0, rz = 0) {
    const g = new IcosahedronGeometry(r, detail);
    return this.add(g, at(x, y, z, ry, rx, rz, scale), surf, color);
  }

  dome(r, h, x, y, z, surf, color, segs = 12) {
    const g = new SphereGeometry(1, segs, Math.max(4, segs / 2), 0, Math.PI * 2, 0, Math.PI / 2);
    return this.add(g, at(x, y, z, 0, 0, 0, [r, h, r]), surf, color);
  }

  torus(R, r, x, y, z, surf, color, rx = 0, ry = 0, arc = Math.PI * 2) {
    return this.add(new TorusGeometry(R, r, 8, 48, arc), at(x, y, z, ry, rx), surf, color);
  }

  triangle(a, b, c, surf, color) {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array([...a, ...b, ...c, ...a, ...c, ...b]), 3));
    return this.add(g, new Matrix4(), surf, color);
  }

  // Gable roof over a rectangle of `len` (x) by `span` (z) with eaves at height `top`
  gableRoof(len, span, top, pitchDeg, overhang, thick, surf, color, gableSurf = SURF.plaster, gableColor) {
    const p = (pitchDeg * Math.PI) / 180;
    const rise = (span / 2) * Math.tan(p);
    const slopeLen = (span / 2 + overhang) / Math.cos(p) + thick * 0.4;
    const ridgeY = top + rise;
    for (const side of [1, -1]) {
      const dir = new Vector3(0, -Math.sin(p), side * Math.cos(p));
      const nrm = new Vector3(0, Math.cos(p), side * Math.sin(p));
      const c = new Vector3(0, ridgeY, 0).addScaledVector(dir, slopeLen / 2).addScaledVector(nrm, thick / 2);
      const g = new BoxGeometry(len + overhang * 2, thick, slopeLen);
      this.add(g, at(c.x, c.y, c.z, 0, side * p), surf, color);
    }
    for (const sx of [-1, 1]) {
      const x = (sx * len) / 2;
      this.triangle([x, top, -span / 2], [x, top, span / 2], [x, ridgeY, 0], gableSurf, gableColor);
    }
    return ridgeY + thick / Math.cos(p);
  }

  // Exposed timber framing on a wall running along x at z = face, from x0 to x1
  timberWall(x0, x1, y0, y1, face, opts = {}) {
    const { spacing = 1.45, size = 0.17, rail = true, braces = true, out = 0.05 } = opts;
    const z = face + Math.sign(face || 1) * out;
    const n = Math.max(1, Math.round((x1 - x0) / spacing));
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      this.beam([x, y0, z], [x, y1, z], size);
    }
    this.beam([x0 - size / 2, y0 + size / 2, z], [x1 + size / 2, y0 + size / 2, z], size);
    this.beam([x0 - size / 2, y1 - size / 2, z], [x1 + size / 2, y1 - size / 2, z], size);
    if (rail) {
      const ym = y0 + (y1 - y0) * 0.48;
      this.beam([x0, ym, z], [x1, ym, z], size * 0.85);
    }
    if (braces && n >= 2) {
      const bw = (x1 - x0) / n;
      this.beam([x0, y0 + 0.1, z], [x0 + bw, y0 + (y1 - y0) * 0.48, z], size * 0.8);
      this.beam([x1, y0 + 0.1, z], [x1 - bw, y0 + (y1 - y0) * 0.48, z], size * 0.8);
    }
  }

  build() {
    return mergeGeometries(this.parts);
  }
}

// Rotates a builder callback written for walls along x into one for walls along z
export const alongZ = m => at(0, 0, 0, Math.PI / 2).multiply(m || new Matrix4());

export function buildingMaterial() {
  return new ShaderMaterial({
    uniforms: { ...shared, uGlow: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aSurf;
      attribute vec2 aUV;
      attribute vec3 aColor;
      attribute float aGround;
      varying float vGround;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec2 vUV;
      varying vec3 vColor;
      varying float vSurf;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vUV = aUV;
        vColor = aColor;
        vSurf = aSurf;
        vGround = aGround;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      ${atmosphereUniforms}
      ${noise}
      ${sky}
      ${terrainShadow}
      ${localShadow}
      uniform float uGlow;
      varying float vGround;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec2 vUV;
      varying vec3 vColor;
      varying float vSurf;

      vec2 cellular(vec2 p) {
        vec2 n = floor(p), f = fract(p);
        float d1 = 8.0, d2 = 8.0;
        for (int j = -1; j <= 1; j++)
        for (int i = -1; i <= 1; i++) {
          vec2 g = vec2(i, j);
          vec2 o = vec2(hash12(n + g), hash12(n + g + 19.1));
          float d = length(g + o - f);
          if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
        }
        return vec2(d1, d2);
      }

      void main() {
        vec3 N = normalize(vNormal);
        if (!gl_FrontFacing) N = -N;
        vec2 uv = vUV;
        int s = int(vSurf + 0.5);
        float n1 = vnoise(uv * 3.1 + vWorld.y);
        float n2 = vnoise(uv * 0.7);
        vec3 albedo;
        float rough = 1.0;

        if (s == 0) {
          albedo = srgb(vec3(0.9, 0.85, 0.74)) * (0.9 + 0.12 * n1);
          float dirt = 1.0 - smoothstep(0.0, 1.6, vWorld.y - vGround);
          albedo = mix(albedo, albedo * srgb(vec3(0.78, 0.72, 0.6)), dirt * 0.6 + 0.2 * n2);
        } else if (s == 1) {
          vec2 c = cellular(vec2(uv.x * 2.2, uv.y * 3.4));
          float mortar = smoothstep(0.02, 0.12, c.y - c.x);
          vec3 st = mix(srgb(vec3(0.6, 0.57, 0.5)), srgb(vec3(0.72, 0.68, 0.6)), hash12(floor(uv * vec2(2.2, 3.4)) + c.x));
          albedo = mix(srgb(vec3(0.42, 0.4, 0.36)), st * (0.9 + 0.15 * n1), mortar);
          albedo = mix(albedo, albedo * srgb(vec3(0.62, 0.7, 0.45)), smoothstep(0.55, 0.8, n2) * 0.5);
        } else if (s == 2) {
          float straw = vnoise(vec2(uv.x * 38.0, uv.y * 2.2)) * 0.6 + vnoise(vec2(uv.x * 85.0, uv.y * 4.5)) * 0.4;
          float lumps = fbm(uv * vec2(1.1, 1.8));
          float course = smoothstep(0.72, 1.0, fract(uv.y * 1.7 + lumps * 0.5));
          albedo = mix(srgb(vec3(0.42, 0.34, 0.21)), srgb(vec3(0.66, 0.55, 0.36)), straw);
          albedo *= (0.78 + 0.4 * lumps) * (1.0 - course * 0.28);
          albedo = mix(albedo, srgb(vec3(0.42, 0.42, 0.32)), smoothstep(0.62, 0.85, lumps) * 0.5);
        } else if (s == 3) {
          float board = fract(uv.x * 4.0);
          float gap = smoothstep(0.0, 0.06, board) * smoothstep(1.0, 0.94, board);
          float tone = hash12(vec2(floor(uv.x * 4.0), 3.0));
          albedo = mix(srgb(vec3(0.38, 0.29, 0.2)), srgb(vec3(0.5, 0.4, 0.29)), tone) * (0.85 + 0.2 * vnoise(vec2(uv.x * 4.0, uv.y * 0.6)));
          albedo *= 0.55 + 0.45 * gap;
        } else if (s == 4) {
          float row = uv.y * 4.2;
          float off = mod(floor(row), 2.0) * 0.5;
          float col = fract(uv.x * 3.0 + off);
          float edge = smoothstep(0.0, 0.08, fract(row)) * smoothstep(0.0, 0.05, col) * smoothstep(1.0, 0.95, col);
          float tone = hash12(vec2(floor(uv.x * 3.0 + off), floor(row)));
          albedo = mix(srgb(vec3(0.34, 0.31, 0.29)), srgb(vec3(0.5, 0.44, 0.38)), tone);
          albedo = mix(albedo, srgb(vec3(0.42, 0.48, 0.3)), smoothstep(0.6, 0.9, n2) * 0.4);
          albedo *= 0.65 + 0.35 * edge;
        } else if (s == 5) {
          albedo = srgb(vec3(0.27, 0.2, 0.14)) * (0.85 + 0.25 * vnoise(uv * vec2(1.0, 6.0) + vWorld.xz));
        } else if (s == 6) {
          vec2 lat = abs(fract(uv * 3.2) - 0.5);
          float lead = smoothstep(0.42, 0.47, max(lat.x, lat.y));
          albedo = mix(srgb(vec3(0.12, 0.13, 0.14)), srgb(vec3(0.2, 0.18, 0.15)), lead);
          rough = 0.3;
        } else if (s == 7 || s == 13) {
          albedo = vColor * (0.9 + 0.15 * n1);
        } else if (s == 10) {
          albedo = vColor * (0.88 + 0.16 * vnoise(uv * vec2(2.0, 6.0)));
        } else if (s == 11) {
          float row = uv.y * 5.0;
          float off = mod(floor(row), 2.0) * 0.5;
          float col = fract(uv.x * 4.0 + off);
          float edge = smoothstep(0.0, 0.1, fract(row)) * smoothstep(0.0, 0.06, col) * smoothstep(1.0, 0.94, col);
          float tone = hash12(vec2(floor(uv.x * 4.0 + off), floor(row)));
          albedo = mix(srgb(vec3(0.46, 0.29, 0.22)), srgb(vec3(0.58, 0.38, 0.28)), tone) * (0.7 + 0.3 * edge);
          albedo = mix(albedo, srgb(vec3(0.42, 0.44, 0.3)), smoothstep(0.65, 0.9, n2) * 0.35);
        } else if (s == 12) {
          float row = uv.y * 3.4;
          float lap = smoothstep(0.0, 0.1, fract(row)) ;
          float tone = hash12(vec2(floor(row), floor(uv.x * 0.25)));
          albedo = mix(srgb(vec3(0.3, 0.22, 0.15)), srgb(vec3(0.42, 0.31, 0.21)), tone) * (0.85 + 0.2 * vnoise(vec2(uv.x * 0.8, row)));
          albedo *= 0.6 + 0.4 * lap;
        } else if (s == 8) {
          float streak = vnoise(vec2(uv.x * 14.0, uv.y * 2.0));
          albedo = mix(srgb(vec3(0.6, 0.49, 0.29)), srgb(vec3(0.72, 0.61, 0.38)), streak);
        } else {
          float weave = sin(uv.x * 18.0) * sin(uv.y * 9.0 + floor(uv.x * 18.0 / 3.14159) * 1.57);
          albedo = mix(srgb(vec3(0.3, 0.24, 0.17)), srgb(vec3(0.44, 0.37, 0.27)), 0.5 + 0.5 * weave);
        }
        if (s != 7 && s != 10 && s != 13) albedo *= vColor;
        if (uWinter > 0.0 && s != 6) {
          float settled = smoothstep(0.3, 0.7, N.y) * (0.75 + 0.25 * vnoise(vWorld.xz * 0.8));
          albedo = mix(albedo, srgb(vec3(0.86, 0.86, 0.86)), uWinter * settled * (s == 13 ? 0.3 : 1.0));
        }

        vec3 L = uSunDir;
        float sh = terrainShadow(vWorld, L) * localShadowAt(vWorld, N);
        float ndl = max(dot(N, L), 0.0);
        float ao = mix(0.55, 1.0, smoothstep(0.0, 1.2, vWorld.y - vGround));
        vec3 col = albedo * (uSunColor * ndl * sh + uAmbient * (0.6 + 0.4 * N.y) * ao);
        // Rooms indoors (marked by a ground height far below the world) are lit by lamps and a
        // hearth rather than the sky
        if (vGround < -5000.0) {
          float lift = 0.8 + 0.2 * smoothstep(0.0, 2.5, fract(vWorld.y) + N.y);
          col = albedo * (uAmbient * 0.35 + srgb(vec3(1.0, 0.8, 0.56)) * 0.85 * lift);
        }
        if (s == 6) {
          vec3 V = normalize(cameraPosition - vWorld);
          vec3 R = reflect(-V, N);
          col += skyColor(R) * 0.18;
          col += srgb(vec3(1.0, 0.72, 0.38)) * uWindowGlow * 2.5 * (0.7 + 0.3 * n1);
        }
        col = mix(col, col * 1.7 + vec3(0.55, 0.38, 0.14) * (0.75 + 0.25 * sin(uTime * 3.0)), uGlow);
        col = applyAtmosphere(col, vWorld);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

// One mesh per settlement, so the camera can skip the ones out of view
export function buildingMeshes(builder, ranges) {
  const group = new Group();
  const material = buildingMaterial();
  const cuts = ranges.flat().concat([0, builder.parts.length]).sort((a, b) => a - b);
  for (let i = 0; i < cuts.length - 1; i++) {
    if (cuts[i + 1] <= cuts[i]) continue;
    const place = ranges.findIndex(([a, b]) => a === cuts[i] && b === cuts[i + 1]);
    // Rooms indoors (marked by their ground height) are a mesh of their own, drawn only when the
    // camera is near enough to see in through a door
    const parts = builder.parts.slice(cuts[i], cuts[i + 1]);
    const inside = parts.filter(g => g.attributes.aGround.array[0] < -5000);
    for (const [list, interior] of [[parts.filter(g => g.attributes.aGround.array[0] >= -5000), false], [inside, true]]) {
      if (!list.length) continue;
      const mesh = new Mesh(mergeGeometries(list), material);
      mesh.userData.place = place;
      mesh.userData.interior = interior;
      if (interior) mesh.geometry.computeBoundingSphere();
      group.add(mesh);
    }
  }
  return group;
}
