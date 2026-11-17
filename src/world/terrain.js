import {
  BufferGeometry, BufferAttribute, Mesh, ShaderMaterial, DataTexture, RedFormat, HalfFloatType,
  LinearFilter, ClampToEdgeWrapping, Vector4, DataUtils, WebGLRenderTarget, Group, Box3, Sphere, Vector3,
} from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { WORLD, sample, heightAt } from './valley.js';
import { shared } from '../atmosphere.js';
import { atmosphereUniforms, noise, fields, sky, terrainShadow, localShadow } from '../shaders/common.js';

// Grid lines are packed towards the valley centre: s in [-1, 1] maps to world space with a
// gentle slope near 0 and a steep one at the edges.
const warp = (s, half, a, p) => half * (a * s + (1 - a) * Math.sign(s) * Math.pow(Math.abs(s), p));

export function buildHeightTexture(res = 512) {
  const data = new Float32Array(res * res);
  const half = new Uint16Array(res * res);
  const sx = (WORLD.maxX - WORLD.minX) / (res - 1);
  const sz = (WORLD.maxZ - WORLD.minZ) / (res - 1);
  for (let j = 0; j < res; j++) {
    const z = WORLD.minZ + j * sz;
    for (let i = 0; i < res; i++) {
      const h = heightAt(WORLD.minX + i * sx, z);
      data[j * res + i] = h;
      half[j * res + i] = DataUtils.toHalfFloat(h);
    }
  }
  const tex = new DataTexture(half, res, res, RedFormat, HalfFloatType);
  tex.magFilter = tex.minFilter = LinearFilter;
  tex.wrapS = tex.wrapT = ClampToEdgeWrapping;
  tex.needsUpdate = true;
  const bounds = new Vector4(WORLD.minX, WORLD.minZ, WORLD.maxX - WORLD.minX, WORLD.maxZ - WORLD.minZ);
  // texel centres sit on the grid points, so nudge the bounds by half a texel
  bounds.x -= sx * 0.5; bounds.y -= sz * 0.5; bounds.z += sx; bounds.w += sz;

  const sampleCPU = (x, z) => {
    const u = (x - WORLD.minX) / sx, v = (z - WORLD.minZ) / sz;
    const i = Math.max(0, Math.min(res - 2, Math.floor(u)));
    const k = Math.max(0, Math.min(res - 2, Math.floor(v)));
    const fu = Math.min(1, Math.max(0, u - i)), fv = Math.min(1, Math.max(0, v - k));
    const a = data[k * res + i], b = data[k * res + i + 1];
    const c = data[(k + 1) * res + i], d = data[(k + 1) * res + i + 1];
    return (a + (b - a) * fu) * (1 - fv) + (c + (d - c) * fu) * fv;
  };

  return { tex, bounds, sampleCPU };
}

export function buildTerrain({ nx = 640, nz = 1100, heightTex, heightBounds, canopy }) {
  shared.uHeightTex.value = heightTex;
  shared.uHeightBounds.value.copy(heightBounds);
  const count = (nx + 1) * (nz + 1);
  const pos = new Float32Array(count * 3);
  const dat = new Float32Array(count * 4);

  let p = 0;
  for (let j = 0; j <= nz; j++) {
    const z = warp((j / nz) * 2 - 1, WORLD.maxZ, 0.6, 5);
    for (let i = 0; i <= nx; i++) {
      const x = warp((i / nx) * 2 - 1, WORLD.maxX, 0.25, 3);
      const s = sample(x, z);
      pos[p * 3] = x;
      pos[p * 3 + 1] = s.h;
      pos[p * 3 + 2] = z;
      dat[p * 4] = s.d;
      dat[p * 4 + 1] = s.t;
      dat[p * 4 + 2] = s.terrace;
      dat[p * 4 + 3] = s.forest;
      p++;
    }
  }

  const quads = (i0, i1, j0, j1) => {
    const index = new Uint32Array((i1 - i0) * (j1 - j0) * 6);
    let q = 0;
    for (let j = j0; j < j1; j++) {
      for (let i = i0; i < i1; i++) {
        const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
        index[q++] = a; index[q++] = c; index[q++] = b;
        index[q++] = b; index[q++] = c; index[q++] = d;
      }
    }
    return new BufferAttribute(index, 1);
  };

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('aData', new BufferAttribute(dat, 4));
  geo.setIndex(quads(0, nx, 0, nz));
  geo.computeVertexNormals();

  const material = new ShaderMaterial({
    uniforms: {
      ...shared,
      uHeightTex: shared.uHeightTex,
      uHeightBounds: shared.uHeightBounds,
      uCanopyTex: canopy.uniform,
      uCanopyBounds: { value: canopy.bounds },
      uSiteAtlas: { value: null },
      uSiteBounds: { value: Array.from({ length: 16 }, () => new Vector4(0, 0, 1, 1)) },
      uSiteCount: { value: 0 },
      uCropTex: { value: null },
      uCropRect: { value: new Vector4(0, 0, 1, 0) },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aData;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec4 vData;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vNormal = normal;
        vData = aData;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uCropTex;
      uniform vec4 uCropRect;
      ${atmosphereUniforms}
      ${noise}
      ${fields}
      ${sky}
      ${terrainShadow}
      ${localShadow}
      uniform sampler2D uCanopyTex;
      uniform vec4 uCanopyBounds;
      uniform sampler2D uSiteAtlas;
      uniform vec4 uSiteBounds[16];
      uniform int uSiteCount;

      vec3 siteSample(vec2 xz) {
        vec3 s = vec3(0.0);
        for (int i = 0; i < 16; i++) {
          if (i >= uSiteCount) break;
          vec2 uv = (xz - uSiteBounds[i].xy) / uSiteBounds[i].zw;
          if (uv.x > 0.002 && uv.y > 0.002 && uv.x < 0.998 && uv.y < 0.998) {
            vec2 a = (vec2(float(i % 4), float(i / 4)) + uv) * vec2(0.25, 0.5);
            s = max(s, textureLod(uSiteAtlas, a, 0.0).rgb);
          }
        }
        return s;
      }
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec4 vData;

      vec3 stripes(vec3 a, vec3 b, vec2 xz, float angle, float spacing, float amount) {
        vec2 dir = vec2(cos(angle), sin(angle));
        float c = dot(xz, dir) / spacing;
        float aa = 1.0 - smoothstep(0.25, 0.9, fwidth(c));
        float s = 0.5 + 0.5 * sin(c * 6.2831);
        return mix(a, b, s * amount * aa + (1.0 - aa) * amount * 0.5);
      }

      void main() {
        vec3 n = normalize(vNormal);
        vec2 xz = vWorld.xz;
        float slope = 1.0 - n.y;
        float d = vData.x;
        float vt = vData.y;
        float terrace = vData.z;
        float forest = vData.w;
        float h = vWorld.y;
        float rw = 16.0 + 52.0 * smoothstep(-9000.0, 7000.0, xz.y);

        float big = fbm(xz * 0.0011);
        float mid = fbm(xz * 0.013 + 3.0);
        float fine = vnoise(xz * 0.21);

        vec3 grassA = srgb(vec3(0.46, 0.55, 0.29));
        vec3 grassB = srgb(vec3(0.63, 0.66, 0.34));
        vec3 grassC = srgb(vec3(0.36, 0.47, 0.22));
        vec3 grass = mix(grassA, grassB, smoothstep(0.35, 0.7, big));
        grass = mix(grass, grassC, smoothstep(0.55, 0.8, mid) * 0.6);
        grass *= 0.92 + 0.16 * fine;

        vec3 ground = grass;

        float dCam = length(cameraPosition - vWorld);
        float detail = 1.0 - smoothstep(60.0, 700.0, dCam);
        float strokes = vnoise(vec2(xz.x * 0.7 + xz.y * 0.2, xz.y * 0.25 - xz.x * 0.1));
        float tuft = vnoise(xz * 1.9);
        grass *= mix(1.0, 0.8 + 0.4 * strokes, detail);
        grass = mix(grass, grass * vec3(0.86, 1.06, 0.8), (tuft - 0.5) * 1.4 * detail);
        ground = grass;

        float fieldMask = (1.0 - smoothstep(0.07, 0.16, slope)) *
          (1.0 - smoothstep(0.12, 0.35, forest)) *
          (1.0 - smoothstep(520.0, 640.0, h)) *
          smoothstep(rw * 0.5 + 18.0, rw * 0.5 + 40.0, d);
        fieldMask = max(fieldMask, terrace * (1.0 - smoothstep(0.2, 0.45, slope)) * (1.0 - forest));

        vec3 site = siteSample(xz);
        fieldMask *= 1.0 - site.b;

        vec3 fi = vec3(99.0, 0.6, 0.0);
        vec3 crop = grass;
        if (fieldMask > 0.002) {
          fi = fieldAt(xz);
          float r = fi.y;
          float ang = fi.z * 3.14159 + 0.3;
          if (r < 0.16) {
            crop = mix(srgb(vec3(0.86, 0.71, 0.38)), srgb(vec3(0.79, 0.6, 0.29)), mid);
            crop = stripes(crop, crop * 0.86, xz, ang, 2.2, 0.6);
          } else if (r < 0.26) {
            crop = mix(srgb(vec3(0.87, 0.79, 0.55)), srgb(vec3(0.8, 0.74, 0.47)), mid);
            crop = stripes(crop, crop * 0.9, xz, ang, 2.0, 0.5);
          } else if (r < 0.40) {
            crop = mix(srgb(vec3(0.46, 0.37, 0.27)), srgb(vec3(0.53, 0.44, 0.33)), mid);
            crop = stripes(crop, srgb(vec3(0.34, 0.27, 0.2)), xz, ang, 2.6, 0.6);
          } else if (r < 0.52) {
            crop = mix(srgb(vec3(0.56, 0.66, 0.3)), srgb(vec3(0.48, 0.6, 0.26)), mid);
            crop = stripes(crop, srgb(vec3(0.45, 0.36, 0.24)), xz, ang, 2.4, 0.45);
          } else if (r < 0.76) {
            crop = mix(grass, srgb(vec3(0.52, 0.62, 0.29)), 0.4) * (0.9 + 0.2 * vnoise(xz * 0.08));
          } else if (r < 0.88) {
            crop = mix(grass, srgb(vec3(0.66, 0.68, 0.38)), 0.5);
            float fl = step(0.78, vnoise(xz * 1.3));
            crop = mix(crop, srgb(vec3(0.93, 0.85, 0.55)), fl * 0.45);
          } else if (r < 0.93) {
            crop = mix(grass, srgb(vec3(0.68, 0.64, 0.42)), 0.6);
          } else {
            crop = grass * 0.9;
          }
        }

        float hedge = 1.0 - smoothstep(1.4, 3.6, fi.x);
        float hedgeShade = smoothstep(3.0, 11.0, fi.x);
        crop *= 0.86 + 0.28 * vnoise(xz * 0.045 + fi.y * 50.0);
        crop *= mix(1.0, 0.85 + 0.3 * tuft, detail);
        ground = mix(ground, crop, fieldMask);
        ground *= mix(1.0, mix(0.82, 1.0, hedgeShade), fieldMask);
        ground = mix(ground, srgb(vec3(0.24, 0.33, 0.16)) * (0.85 + 0.3 * fine), hedge * fieldMask);

        ground = mix(ground, ground * vec3(0.98, 0.97, 0.88) * (0.9 + 0.2 * tuft), site.b * 0.55);
        float earthAmt = smoothstep(0.25, 0.7, site.r + (fine - 0.5) * 0.35 + (strokes - 0.5) * 0.2);
        vec3 earth = mix(srgb(vec3(0.5, 0.41, 0.3)), srgb(vec3(0.62, 0.54, 0.42)), vnoise(xz * 1.7)) * (0.85 + 0.25 * vnoise(xz * 6.0));
        ground = mix(ground, earth, earthAmt);
        float rows = 0.5 + 0.5 * sin(xz.y * 6.2831 / 0.55);
        vec3 tilled = mix(srgb(vec3(0.3, 0.22, 0.15)), srgb(vec3(0.44, 0.33, 0.23)), rows * 0.7 + 0.3 * fine);
        ground = mix(ground, tilled, smoothstep(0.3, 0.7, site.g));

        vec3 forestFloor = srgb(vec3(0.24, 0.31, 0.16)) * (0.85 + 0.3 * fine);
        ground = mix(ground, forestFloor, smoothstep(0.15, 0.55, forest));

        vec3 wall = srgb(vec3(0.62, 0.58, 0.48)) * (0.8 + 0.3 * fine);
        ground = mix(ground, wall, terrace * smoothstep(0.35, 0.6, slope));

        float bank = 1.0 - smoothstep(rw * 0.5 + 2.0, rw * 0.5 + 9.0, d);
        float wet = 1.0 - smoothstep(rw * 0.5 + 6.0, rw * 0.5 + 26.0, d);
        ground = mix(ground, ground * srgb(vec3(0.78, 0.86, 0.72)), wet);
        ground = mix(ground, srgb(vec3(0.66, 0.6, 0.47)) * (0.85 + 0.3 * fine), bank);

        float alpine = smoothstep(650.0, 900.0, h + 80.0 * big);
        ground = mix(ground, srgb(vec3(0.56, 0.55, 0.38)) * (0.9 + 0.2 * mid), alpine);
        vec3 rock = mix(srgb(vec3(0.52, 0.5, 0.46)), srgb(vec3(0.66, 0.63, 0.57)), mid);
        float rocky = smoothstep(0.32, 0.55, slope + 0.12 * (mid - 0.5)) * (1.0 - terrace);
        ground = mix(ground, rock, rocky);
        float snow = smoothstep(uSnowLine, uSnowLine + 150.0, h + 150.0 * big) * (1.0 - smoothstep(0.45, 0.7, slope));
        // In winter a lying snow covers the whole valley, thinner on slopes, under trees and by the water
        if (uWinter > 0.0) {
          float drift = vnoise(xz * 0.018) * 0.55 + vnoise(xz * 0.21) * 0.3 + fine * 0.15;
          float blanket = smoothstep(0.92 - uWinter * 0.84, 1.0 - uWinter * 0.7, drift) * min(1.0, uWinter * 4.0) * (1.0 - smoothstep(0.38, 0.62, slope)) * (1.0 - 0.45 * smoothstep(0.15, 0.55, forest)) * (1.0 - 0.85 * wet);
          snow = max(snow, blanket * 0.94);
        }
        ground = mix(ground, srgb(vec3(0.84, 0.85, 0.86)) * (0.94 + 0.08 * fine), snow);

        // One field is ploughed into a pattern that only reads from high up
        if (uCropRect.z > 1.0) {
          vec2 cq = xz - uCropRect.xy;
          float ca = cos(uCropRect.w), sa = sin(uCropRect.w);
          cq = vec2(ca * cq.x - sa * cq.y, sa * cq.x + ca * cq.y) / uCropRect.z + 0.5;
          if (cq.x > 0.0 && cq.x < 1.0 && cq.y > 0.0 && cq.y < 1.0) {
            float furrow = texture(uCropTex, cq).r;
            ground = mix(ground, ground * srgb(vec3(0.62, 0.56, 0.48)), furrow * 0.85);
          }
        }

        float beach = 1.0 - smoothstep(0.6, 2.2, h);
        ground = mix(ground, srgb(vec3(0.78, 0.71, 0.55)), beach * step(6500.0, xz.y));

        vec4 canopy = texture(uCanopyTex, (xz - uCanopyBounds.xy) / uCanopyBounds.zw);

        vec3 L = uSunDir;
        float ndl = max(dot(n, L), 0.0);
        float cover = localShadowCoverage(vWorld);
        float sh = terrainShadow(vWorld, L) * (1.0 - canopy.r * 0.85 * (1.0 - cover)) * localShadowAt(vWorld, n);
        float ao = 1.0 - canopy.g * 0.55;
        vec3 light = uSunColor * ndl * sh + uAmbient * (0.55 + 0.45 * n.y) * ao;
        vec3 col = ground * light;

        col = applyAtmosphere(col, vWorld);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  // The ground is drawn as tiles that share one set of vertices, so tiles behind the camera or
  // off to the side are skipped instead of running every vertex of the valley each frame
  const group = new Group();
  const TI = 4, TJ = 22;
  const box = new Box3(), v = new Vector3();
  for (let tj = 0; tj < TJ; tj++) {
    for (let ti = 0; ti < TI; ti++) {
      const i0 = Math.floor((ti * nx) / TI), i1 = Math.floor(((ti + 1) * nx) / TI);
      const j0 = Math.floor((tj * nz) / TJ), j1 = Math.floor(((tj + 1) * nz) / TJ);
      const tile = new BufferGeometry();
      for (const name of ['position', 'aData', 'normal']) tile.setAttribute(name, geo.attributes[name]);
      tile.setIndex(quads(i0, i1, j0, j1));
      box.makeEmpty();
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) box.expandByPoint(v.fromArray(pos, (j * (nx + 1) + i) * 3));
      tile.boundingSphere = box.getBoundingSphere(new Sphere());
      tile.boundingBox = box.clone();
      group.add(new Mesh(tile, material));
    }
  }
  group.geometry = geo;
  group.material = material;
  return group;
}

function invertWarp(v, half, a, p) {
  let lo = -1, hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (warp(mid, half, a, p) < v) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export function meshHeightSampler(mesh, nx, nz) {
  const pos = mesh.geometry.attributes.position.array;
  return (x, z) => {
    const u = ((invertWarp(x, WORLD.maxX, 0.25, 3) + 1) / 2) * nx;
    const v = ((invertWarp(z, WORLD.maxZ, 0.6, 5) + 1) / 2) * nz;
    const i = Math.min(nx - 1, Math.max(0, Math.floor(u)));
    const j = Math.min(nz - 1, Math.max(0, Math.floor(v)));
    const fu = u - i, fv = v - j;
    const at = (ii, jj) => pos[(jj * (nx + 1) + ii) * 3 + 1];
    if (fu + fv < 1) {
      const h00 = at(i, j);
      return h00 + (at(i + 1, j) - h00) * fu + (at(i, j + 1) - h00) * fv;
    }
    const h11 = at(i + 1, j + 1);
    return h11 + (at(i, j + 1) - h11) * (1 - fu) + (at(i + 1, j) - h11) * (1 - fv);
  };
}

// Renders the terrain's own shadowing into a texture covering the whole world, once per
// change of sun. Everything else samples it instead of ray-marching the heightfield.
export class TerrainShadowBake {
  constructor(renderer, size = 2048) {
    this.renderer = renderer;
    this.target = new WebGLRenderTarget(size, size, { depthBuffer: false });
    this.target.texture.minFilter = this.target.texture.magFilter = LinearFilter;
    this.quad = new FullScreenQuad(new ShaderMaterial({
      uniforms: { uHeightTex: shared.uHeightTex, uHeightBounds: shared.uHeightBounds, uSunDir: shared.uSunDir, uTerrainShadowOn: { value: 0 }, uTerrainShadowTex: { value: null } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */ `
        uniform vec3 uSunDir;
        ${terrainShadow}
        varying vec2 vUv;
        void main() {
          vec2 xz = uHeightBounds.xy + vUv * uHeightBounds.zw;
          vec3 p = vec3(xz.x, heightAt(xz), xz.y);
          float s = terrainShadowMarch(p, uSunDir);
          gl_FragColor = vec4(s, s, s, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    }));
    shared.uTerrainShadowTex.value = this.target.texture;
  }

  bake() {
    const r = this.renderer, prev = r.getRenderTarget();
    r.setRenderTarget(this.target);
    this.quad.render(r);
    r.setRenderTarget(prev);
    shared.uTerrainShadowOn.value = 1;
  }
}
