export const atmosphereUniforms = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uFogColor;
uniform vec3 uFogSunColor;
uniform vec3 uHazeColor;
uniform vec3 uAmbient;
uniform float uFogDensity;
uniform float uFogFalloff;
uniform float uHazeDensity;
uniform float uSunVisible;
uniform float uWindowGlow;
uniform float uSnowLine;
uniform float uWinter;
uniform float uMoonPhase;
uniform vec3 uMoonDir;
`;

export const noise = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    s += a * vnoise(p);
    p = r * p * 2.03 + 17.1;
    a *= 0.5;
  }
  return s;
}

vec3 srgb(vec3 c) { return pow(c, vec3(2.2)); }
`;

export const fields = /* glsl */ `
uint uhash(ivec2 c, uint s) {
  uint h = uint(c.x) * 1664525u + uint(c.y) * 1013904223u + s * 0x9e3779b1u;
  h ^= h >> 16u;
  h *= 0x7feb352du;
  h ^= h >> 15u;
  h *= 0x846ca68bu;
  h ^= h >> 16u;
  return h;
}

float h01(ivec2 c, uint s) { return float(uhash(c, s) >> 8u) / 16777216.0; }

// x: distance to field edge in metres, y/z: per-field randoms
vec3 fieldAt(vec2 xz) {
  vec2 w = xz;
  w.x += 28.0 * sin(xz.y * 0.0047) + 14.0 * sin(xz.y * 0.013 + 1.3);
  w.y += 34.0 * sin(xz.x * 0.0039 + 0.4) + 12.0 * sin(xz.x * 0.017 + 2.1);
  vec2 S = vec2(95.0, 150.0);
  vec2 p = w / S;
  ivec2 n = ivec2(floor(p));
  vec2 f = p - floor(p);

  float md = 8.0;
  vec2 mr = vec2(0.0);
  ivec2 mg = ivec2(0);
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    ivec2 g = ivec2(i, j);
    vec2 r = vec2(g) + 0.1 + 0.8 * vec2(h01(n + g, 0u), h01(n + g, 1u)) - f;
    float d = dot(r, r);
    if (d < md) { md = d; mr = r; mg = g; }
  }

  md = 1e9;
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    ivec2 g = mg + ivec2(i, j);
    vec2 r = vec2(g) + 0.1 + 0.8 * vec2(h01(n + g, 0u), h01(n + g, 1u)) - f;
    vec2 e = r - mr;
    if (dot(e, e) > 1e-5) {
      vec2 u = normalize(e);
      md = min(md, dot(0.5 * (mr + r), u) / length(u / S));
    }
  }
  ivec2 c = n + mg;
  return vec3(md, h01(c, 2u), h01(c, 3u));
}
`;

export const sky = /* glsl */ `
vec3 skyColor(vec3 d) {
  float y = max(d.y, 0.0);
  float s = max(dot(d, uSunDir), 0.0);
  vec3 col = mix(uHorizon, uZenith, smoothstep(0.02, 0.75, y));
  vec3 hz = mix(uFogColor, uFogSunColor, pow(s, 4.0));
  col = mix(col, hz, exp(-y * 6.0));
  col *= 1.18;
  col += uSunColor * (pow(s, 5.0) * 0.06 + pow(s, 40.0) * 0.18) * uSunVisible;
  return col;
}

vec3 applyAtmosphere(vec3 col, vec3 wp) {
  vec3 rd = wp - cameraPosition;
  float t = length(rd);
  rd /= t;
  float s = max(dot(rd, uSunDir), 0.0);
  vec3 inscatter = mix(uFogColor, uFogSunColor, pow(s, 5.0) * uSunVisible);

  float haze = 1.0 - exp(-t * uHazeDensity);
  col = mix(col, uHazeColor, haze * 0.45);

  float c = uFogFalloff;
  float fy = abs(rd.y) < 1e-4 ? 1e-4 : rd.y;
  float fog = uFogDensity * exp(-cameraPosition.y * c) * (1.0 - exp(-t * fy * c)) / (fy * c);
  fog = 1.0 - exp(-max(fog, 0.0));
  float a = 1.0 - (1.0 - haze * 0.75) * (1.0 - fog);
  return mix(col, inscatter, clamp(a, 0.0, 1.0));
}
`;

export const terrainShadow = /* glsl */ `
uniform sampler2D uHeightTex;
uniform vec4 uHeightBounds;
uniform sampler2D uTerrainShadowTex;
uniform float uTerrainShadowOn;

float heightAt(vec2 xz) {
  return texture(uHeightTex, (xz - uHeightBounds.xy) / uHeightBounds.zw).r;
}

float terrainShadowMarch(vec3 p, vec3 L) {
  if (L.y < -0.05) return 0.0;
  float res = 1.0;
  float t = 18.0;
  p.y += 3.0;
  for (int i = 0; i < 36; i++) {
    vec3 q = p + L * t;
    float diff = q.y - heightAt(q.xz);
    res = min(res, 10.0 * diff / t);
    if (res < -0.05 || q.y > 1700.0) break;
    t = t * 1.14 + 6.0;
  }
  return smoothstep(0.0, 1.0, res);
}

// Baked whenever the sun moves; the march above only runs inside the bake pass
float terrainShadow(vec3 p, vec3 L) {
  if (uTerrainShadowOn > 0.5) return texture(uTerrainShadowTex, (p.xz - uHeightBounds.xy) / uHeightBounds.zw).r;
  return terrainShadowMarch(p, L);
}
`;

export const localShadow = /* glsl */ `
uniform sampler2D uLocalShadowMap;
uniform mat4 uLocalShadowMatrix;
uniform float uLocalShadowOn;
uniform vec2 uLocalShadowTexel;

float localShadowCoverage(vec3 wp) {
  if (uLocalShadowOn < 0.5) return 0.0;
  vec4 sc = uLocalShadowMatrix * vec4(wp, 1.0);
  vec2 p = sc.xy / sc.w;
  return smoothstep(0.0, 0.06, p.x) * smoothstep(1.0, 0.94, p.x) * smoothstep(0.0, 0.06, p.y) * smoothstep(1.0, 0.94, p.y);
}

float localShadowAt(vec3 wp, vec3 n) {
  if (uLocalShadowOn < 0.5) return 1.0;
  vec4 sc = uLocalShadowMatrix * vec4(wp + n * 0.2, 1.0);
  vec3 p = sc.xyz / sc.w;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  float lit = 0.0;
  float j = hash12(gl_FragCoord.xy) * 6.2831;
  mat2 r = mat2(cos(j), -sin(j), sin(j), cos(j));
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec2 o = r * vec2(float(x), float(y)) * uLocalShadowTexel * 1.4;
    lit += step(p.z - 0.0004, texture(uLocalShadowMap, p.xy + o).r);
  }
  float cover = smoothstep(0.0, 0.06, p.x) * smoothstep(1.0, 0.94, p.x) * smoothstep(0.0, 0.06, p.y) * smoothstep(1.0, 0.94, p.y);
  return mix(1.0, lit / 9.0, cover);
}
`;
