import { Color, Vector3, Vector2, Vector4, Matrix4, MathUtils } from 'three';
import { SEASON } from './season.js';

// Azimuth is measured from +z (downstream, south) towards +x (east).
const KEYS = [
  { t: 0.00, el: 1.5, az: 95, sun: '#ffae7a', sunI: 2.2, zenith: '#8295ad', horizon: '#ecc6a6', fog: '#d8cbc2', fogSun: '#f7c497', haze: '#aebccb', amb: '#8792a6', ambI: 0.75, fogD: 0.0022, fogF: 0.011, hazeD: 0.00013, exposure: 1.05 },
  { t: 0.18, el: 16, az: 70, sun: '#ffdcb0', sunI: 2.4, zenith: '#86a9c6', horizon: '#e9e2d0', fog: '#e2e0d4', fogSun: '#f6e2bc', haze: '#b4c6cf', amb: '#93a5b4', ambI: 0.85, fogD: 0.0005, fogF: 0.0075, hazeD: 0.00011, exposure: 0.68 },
  { t: 0.40, el: 52, az: 5, sun: '#fff1da', sunI: 2.6, zenith: '#7ba6c8', horizon: '#dde4dc', fog: '#dde3dc', fogSun: '#efe6cf', haze: '#b7c9d2', amb: '#98abb8', ambI: 0.95, fogD: 0.00035, fogF: 0.004, hazeD: 0.00009, exposure: 0.62 },
  { t: 0.62, el: 11, az: -48, sun: '#ffc98a', sunI: 3.7, zenith: '#93b2c6', horizon: '#f1dcb4', fog: '#ecdcbf', fogSun: '#fbd9a0', haze: '#c2ccce', amb: '#9aa5ad', ambI: 1.1, fogD: 0.00012, fogF: 0.0032, hazeD: 0.00006, exposure: 0.95 },
  { t: 0.80, el: -1.5, az: -80, sun: '#ff9466', sunI: 1.2, zenith: '#4a5576', horizon: '#e0a184', fog: '#8f8091', fogSun: '#e2946c', haze: '#6a7290', amb: '#5f6684', ambI: 0.7, fogD: 0.00022, fogF: 0.0035, hazeD: 0.00009, exposure: 1.3 },
  { t: 1.00, el: 30, az: -150, sun: '#9fb3e0', sunI: 0.35, zenith: '#151c30', horizon: '#3a4058', fog: '#2c3347', fogSun: '#3c4560', haze: '#252c40', amb: '#3b4562', ambI: 0.45, fogD: 0.0007, fogF: 0.005, hazeD: 0.00016, exposure: 1.48 },
];

const COLOR_KEYS = ['sun', 'zenith', 'horizon', 'fog', 'fogSun', 'haze', 'amb'];
const parsed = KEYS.map(k => {
  const o = { ...k };
  for (const c of COLOR_KEYS) o[c] = new Color(k[c]);
  return o;
});
// Past 1 the night runs on round to the next dawn (the compass can turn the day full circle)
parsed.push({ ...parsed[0], t: 1.25 });

export const shared = {
  uTime: { value: 0 },
  uSunDir: { value: new Vector3(0, 1, 0) },
  uSunColor: { value: new Color() },
  uZenith: { value: new Color() },
  uHorizon: { value: new Color() },
  uFogColor: { value: new Color() },
  uFogSunColor: { value: new Color() },
  uHazeColor: { value: new Color() },
  uAmbient: { value: new Color() },
  uFogDensity: { value: 0 },
  uFogFalloff: { value: 0 },
  uHazeDensity: { value: 0 },
  uSunVisible: { value: 1 },
  uWindowGlow: { value: 0 },
  uSnowLine: { value: SEASON.snowLine },
  uWinter: { value: SEASON.winterAmount },
  uMoonPhase: { value: SEASON.moonPhase },
  uMoonDir: { value: new Vector3(0, 0.3, 1).normalize() },
  uLocalShadowMap: { value: null },
  uLocalShadowMatrix: { value: new Matrix4() },
  uLocalShadowOn: { value: 0 },
  uLocalShadowTexel: { value: new Vector2(1 / 2048, 1 / 2048) },
  uHeightTex: { value: null },
  uHeightBounds: { value: new Vector4(0, 0, 1, 1) },
  uTerrainShadowTex: { value: null },
  uTerrainShadowOn: { value: 0 },
  uReflectTex: { value: null },
  uReflectMatrix: { value: new Matrix4() },
  uReflectOn: { value: 0 },
};

export const state = { exposure: 1.2, elevation: 10, time: 0.62 };

const tmp = new Color();

export function setTimeOfDay(t) {
  t = MathUtils.clamp(t, 0, 1.25);
  state.time = t;
  let i = 0;
  while (i < parsed.length - 2 && t > parsed[i + 1].t) i++;
  const a = parsed[i], b = parsed[i + 1];
  const k = MathUtils.smoothstep(t, a.t, b.t);
  const lerp = (x, y) => x + (y - x) * k;

  const el = MathUtils.degToRad(lerp(a.el, b.el));
  const az = MathUtils.degToRad(lerp(a.az, b.az));
  shared.uSunDir.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
  state.elevation = lerp(a.el, b.el);

  const sunI = lerp(a.sunI, b.sunI) * MathUtils.smoothstep(lerp(a.el, b.el), -4, 2);
  shared.uSunColor.value.copy(a.sun).lerp(b.sun, k).multiplyScalar(sunI);
  shared.uZenith.value.copy(a.zenith).lerp(b.zenith, k);
  shared.uHorizon.value.copy(a.horizon).lerp(b.horizon, k);
  shared.uFogColor.value.copy(a.fog).lerp(b.fog, k);
  shared.uFogSunColor.value.copy(a.fogSun).lerp(b.fogSun, k);
  shared.uHazeColor.value.copy(a.haze).lerp(b.haze, k);
  tmp.copy(a.amb).lerp(b.amb, k);
  shared.uAmbient.value.copy(tmp).multiplyScalar(lerp(a.ambI, b.ambI));
  shared.uFogDensity.value = lerp(a.fogD, b.fogD);
  shared.uFogFalloff.value = lerp(a.fogF, b.fogF);
  shared.uHazeDensity.value = lerp(a.hazeD, b.hazeD);
  shared.uSunVisible.value = MathUtils.smoothstep(lerp(a.el, b.el), -3, 1);
  state.exposure = lerp(a.exposure, b.exposure);
  shared.uWindowGlow.value = t > 1 ? 1 - MathUtils.smoothstep(t, 1.12, 1.25) * 0.75 : MathUtils.smoothstep(t, 0.62, 0.78) + 0.25 * (1 - MathUtils.smoothstep(t, 0.0, 0.08));
}
