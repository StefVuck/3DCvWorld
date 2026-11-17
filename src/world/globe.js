import { CanvasTexture, Mesh, SphereGeometry, ShaderMaterial, Group, Vector3, LinearFilter, SRGBColorSpace } from 'three';
import { feature } from 'topojson-client';
import countries from 'i18n-iso-countries';
import topo from 'world-atlas/countries-50m.json';
import { shared } from '../atmosphere.js';
import { atmosphereUniforms, noise, sky } from '../shaders/common.js';

const W = 2048, H = 1024;

function ringPath(ctx, ring, offset) {
  let prev = null, shift = 0;
  ring.forEach(([lon, lat], i) => {
    if (prev !== null) {
      const d = lon - prev;
      if (d > 180) shift -= 360;
      else if (d < -180) shift += 360;
    }
    prev = lon;
    const x = ((lon + shift + 180) / 360) * W + offset, y = ((90 - lat) / 180) * H;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  });
  ctx.closePath();
}

function polygons(geom) {
  if (!geom) return [];
  return geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
}

function tracePath(ctx, geom, offset) {
  ctx.beginPath();
  for (const poly of polygons(geom)) for (const ring of poly) ringPath(ctx, ring, offset);
}

function centroid(geom) {
  let best = null, bestN = 0;
  for (const poly of polygons(geom)) if (poly[0].length > bestN) { best = poly[0]; bestN = poly[0].length; }
  if (!best) return [0, 0];
  let sx = 0, sy = 0, sz = 0;
  for (const [lon, lat] of best) {
    const a = (lon * Math.PI) / 180, b = (lat * Math.PI) / 180;
    sx += Math.cos(b) * Math.cos(a); sy += Math.cos(b) * Math.sin(a); sz += Math.sin(b);
  }
  return [(Math.atan2(sy, sx) * 180) / Math.PI, (Math.atan2(sz, Math.hypot(sx, sy)) * 180) / Math.PI];
}

function paint(travel) {
  const map = document.createElement('canvas');
  map.width = W; map.height = H;
  const mask = document.createElement('canvas');
  mask.width = W; mask.height = H;
  const c = map.getContext('2d'), m = mask.getContext('2d');

  c.fillStyle = '#cdbb8f';
  c.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) {
    c.fillStyle = `rgba(${90 + Math.random() * 40},${70 + Math.random() * 30},40,${Math.random() * 0.06})`;
    c.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 14, 1 + Math.random() * 4);
  }
  c.strokeStyle = 'rgba(80,60,35,0.28)';
  c.lineWidth = 1.2;
  for (let lon = -180; lon <= 180; lon += 15) { c.beginPath(); c.moveTo(((lon + 180) / 360) * W, 0); c.lineTo(((lon + 180) / 360) * W, H); c.stroke(); }
  for (let lat = -75; lat <= 75; lat += 15) { c.beginPath(); c.moveTo(0, ((90 - lat) / 180) * H); c.lineTo(W, ((90 - lat) / 180) * H); c.stroke(); }
  c.strokeStyle = 'rgba(140,50,30,0.35)';
  c.lineWidth = 2;
  c.beginPath(); c.moveTo(0, H / 2); c.lineTo(W, H / 2); c.stroke();
  c.strokeStyle = 'rgba(80,60,35,0.18)';
  const rose = [W * 0.37, H * 0.62];
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    c.beginPath(); c.moveTo(...rose); c.lineTo(rose[0] + Math.cos(a) * 700, rose[1] + Math.sin(a) * 700); c.stroke();
  }

  const num = new Map();
  for (const code of travel.visited) num.set(countries.alpha2ToNumeric(code), 'visited');
  for (const code of travel.wishlist) if (!num.has(countries.alpha2ToNumeric(code))) num.set(countries.alpha2ToNumeric(code), 'wish');
  const shaded = new Set(travel.alsoShaded || []);
  const features = feature(topo, topo.objects.countries).features.filter(f => f.id !== '010');
  const centres = new Map();

  for (const f of features) {
    const kind = num.get(f.id) ?? (shaded.has(f.properties?.name) ? 'visited' : undefined);
    for (const off of [-W, 0, W]) {
      tracePath(c, f.geometry, off);
      c.fillStyle = kind === 'visited' ? '#c9a043' : '#eee3c6';
      c.fill('evenodd');
      c.strokeStyle = kind === 'visited' ? '#6b4b18' : 'rgba(70,52,32,0.85)';
      c.lineWidth = kind === 'visited' ? 2 : 1.2;
      c.stroke();
      if (kind === 'visited') {
        tracePath(m, f.geometry, off);
        m.fillStyle = 'rgb(255,0,0)';
        m.fill('evenodd');
      }
    }
    if (kind && f.id) {
      const code = countries.numericToAlpha2(f.id);
      centres.set(code, centroid(f.geometry));
    }
  }
  for (const f of features) {
    if (num.get(f.id) !== 'wish') continue;
    for (const off of [-W, 0, W]) {
      tracePath(c, f.geometry, off);
      c.setLineDash([7, 6]);
      c.strokeStyle = '#8a2f22';
      c.lineWidth = 3;
      c.stroke();
      c.setLineDash([]);
    }
  }
  // Microstates and islands too small to see on the globe get a pin: gold for visited, a dashed
  // ring for still to come
  for (const f of features) {
    const kind = num.get(f.id) ?? (shaded.has(f.properties?.name) ? 'visited' : undefined);
    if (!kind) continue;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const poly of polygons(f.geometry)) {
      for (const [lon, lat] of poly[0]) {
        const x = ((lon + 180) / 360) * W, y = ((90 - lat) / 180) * H;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    }
    if (Math.max(x1 - x0, y1 - y0) > 14) continue;
    const [lon, lat] = centroid(f.geometry);
    const x = ((lon + 180) / 360) * W, y = ((90 - lat) / 180) * H;
    c.beginPath();
    c.arc(x, y, 6, 0, Math.PI * 2);
    if (kind === 'visited') {
      c.fillStyle = '#c9a043';
      c.fill();
      c.strokeStyle = '#6b4b18';
      c.lineWidth = 2;
      c.stroke();
      m.beginPath();
      m.arc(x, y, 6, 0, Math.PI * 2);
      m.fillStyle = 'rgb(255,0,0)';
      m.fill();
    } else {
      c.setLineDash([4, 3]);
      c.strokeStyle = '#8a2f22';
      c.lineWidth = 2.5;
      c.stroke();
      c.setLineDash([]);
    }
  }

  const tex = new CanvasTexture(map);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  const maskTex = new CanvasTexture(mask);
  maskTex.minFilter = maskTex.magFilter = LinearFilter;
  return { tex, maskTex, centres };
}

export function buildGlobe(travel, radius = 0.78) {
  const { tex, maskTex, centres } = paint(travel);
  const material = new ShaderMaterial({
    uniforms: { ...shared, uMap: { value: tex }, uMask: { value: maskTex }, uLamp: { value: new Vector3() } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      ${atmosphereUniforms}
      ${noise}
      ${sky}
      uniform sampler2D uMap;
      uniform sampler2D uMask;
      uniform vec3 uLamp;
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(cameraPosition - vWorld);
        vec3 albedo = texture(uMap, vUv).rgb;
        float gold = texture(uMask, vUv).r;
        float ndl = max(dot(N, uSunDir), 0.0);
        vec3 toLamp = uLamp - vWorld;
        float ld = length(toLamp);
        vec3 Ll = toLamp / ld;
        vec3 lamp = srgb(vec3(1.0, 0.72, 0.4)) * (1.6 / (1.0 + ld * ld * 0.15)) * uWindowGlow * max(dot(N, Ll), 0.0);
        vec3 col = albedo * (uSunColor * ndl * 0.85 + uAmbient * (0.7 + 0.3 * N.y) + lamp);
        vec3 Hs = normalize(uSunDir + V), Hl = normalize(Ll + V);
        float spec = pow(max(dot(N, Hs), 0.0), 36.0) * ndl;
        float specL = pow(max(dot(N, Hl), 0.0), 30.0);
        col += gold * srgb(vec3(1.0, 0.82, 0.45)) * (uSunColor * spec * 1.4 + lamp * specL * 3.0 + uAmbient * 0.12 * pow(1.0 - max(dot(N, V), 0.0), 2.0));
        col += (1.0 - gold) * uSunColor * spec * 0.08;
        col = applyAtmosphere(col, vWorld);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sphere = new Mesh(new SphereGeometry(radius, 96, 64), material);
  const tilt = new Group();
  tilt.rotation.z = (23.5 * Math.PI) / 180;
  tilt.add(sphere);

  const order = travel.visited.filter(c => centres.has(c));
  let focus = null, focusUntil = 0, idleIndex = 0, nextIdle = 0, now = 0;
  const camLocal = new Vector3();

  return {
    group: tilt,
    material,
    focus(code) {
      if (centres.has(code)) { focus = code; focusUntil = Infinity; }
    },
    release() { focusUntil = now + 2.5; },
    update(dt, t, camera) {
      now = t;
      if (focus && t > focusUntil) focus = null;
      if (!focus && t > nextIdle && order.length) {
        idleIndex = (idleIndex + 1) % order.length;
        nextIdle = t + 3.2;
      }
      const code = focus ?? order[idleIndex];
      if (!code) { sphere.rotation.y += dt * 0.1; return; }
      const lon = (centres.get(code)[0] * Math.PI) / 180;
      tilt.worldToLocal(camLocal.copy(camera.position));
      const target = Math.atan2(-camLocal.z, camLocal.x) - lon;
      let d = target - sphere.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      sphere.rotation.y += d * Math.min(1, dt * 1.8);
    },
  };
}
