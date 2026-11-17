// One set of Gerstner waves, used by the sea shader around the ship and by the ship itself,
// so the hull rides the same swell that is drawn.
const raw = [
  [1.0, 0.35, 34, 0.42],
  [0.55, 1.0, 19, 0.24],
  [-0.45, 1.0, 10.5, 0.12],
  [1.0, -0.7, 6.2, 0.05],
];
export const WAVES = raw.map(([x, z, len, amp]) => {
  const l = Math.hypot(x, z);
  const k = (2 * Math.PI) / len;
  return { dx: x / l, dz: z / l, k, c: Math.sqrt(9.8 / k), amp };
});

export const swell = { x: 0, z: 0, radius: 260 };

export function swellHeight(x, z, t) {
  const px = x - swell.x, pz = z - swell.z;
  let y = 0;
  for (const w of WAVES) y += w.amp * Math.sin(w.k * (w.dx * px + w.dz * pz - w.c * t));
  return y;
}

const f = v => v.toFixed(5);
export const gerstner = /* glsl */ `
uniform vec4 uSwell;
vec3 gerstner(vec2 world, float t, float fade, out vec3 n) {
  vec2 p = world - uSwell.xy;
  vec3 d = vec3(0.0);
  vec3 s = vec3(0.0, 1.0, 0.0);
  ${WAVES.map(w => `{
    vec2 D = vec2(${f(w.dx)}, ${f(w.dz)});
    float k = ${f(w.k)}, A = ${f(w.amp)} * fade;
    float ph = k * (dot(D, p) - ${f(w.c)} * t);
    float q = 0.55 / (k * ${f(w.amp)} * ${WAVES.length}.0);
    float C = cos(ph), S = sin(ph);
    d.xz += q * A * D * C;
    d.y += A * S;
    s.xz -= D * k * A * C;
    s.y -= q * k * A * S;
  }`).join('\n  ')}
  n = normalize(s);
  return d;
}
`;
