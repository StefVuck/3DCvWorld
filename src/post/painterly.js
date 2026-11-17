import {
  WebGLRenderTarget, HalfFloatType, UnsignedByteType, LinearFilter, ShaderMaterial, Vector2, Color,
} from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const tonemap = /* glsl */ `
  uniform sampler2D tInput;
  uniform float uExposure;
  varying vec2 vUv;
  vec3 toSRGB(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }
  void main() {
    vec3 c = texture(tInput, vUv).rgb * uExposure;
    c = clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0.0, 1.0);
    gl_FragColor = vec4(toSRGB(clamp(c, 0.0, 1.0)), 1.0);
  }
`;

const tensor = /* glsl */ `
  uniform sampler2D tInput;
  uniform vec2 uTexel;
  varying vec2 vUv;
  vec3 s(float x, float y) { return texture(tInput, vUv + vec2(x, y) * uTexel).rgb; }
  void main() {
    vec3 sx = (-1.0 * s(-1.0, -1.0) - 2.0 * s(-1.0, 0.0) - 1.0 * s(-1.0, 1.0)
               + 1.0 * s(1.0, -1.0) + 2.0 * s(1.0, 0.0) + 1.0 * s(1.0, 1.0)) / 4.0;
    vec3 sy = (-1.0 * s(-1.0, -1.0) - 2.0 * s(0.0, -1.0) - 1.0 * s(1.0, -1.0)
               + 1.0 * s(-1.0, 1.0) + 2.0 * s(0.0, 1.0) + 1.0 * s(1.0, 1.0)) / 4.0;
    gl_FragColor = vec4(dot(sx, sx), dot(sy, sy), dot(sx, sy), 1.0);
  }
`;

const blur = /* glsl */ `
  uniform sampler2D tInput;
  uniform vec2 uDir;
  varying vec2 vUv;
  void main() {
    float w[5] = float[](0.2270, 0.1945, 0.1216, 0.0540, 0.0162);
    vec4 acc = texture(tInput, vUv) * w[0];
    for (int i = 1; i < 5; i++) {
      acc += texture(tInput, vUv + uDir * float(i)) * w[i];
      acc += texture(tInput, vUv - uDir * float(i)) * w[i];
    }
    gl_FragColor = acc;
  }
`;

// Anisotropic Kuwahara filter with polynomial sector weights (Kyprianidis et al.)
const kuwahara = /* glsl */ `
  uniform sampler2D tInput;
  uniform sampler2D tTensor;
  uniform vec2 uTexel;
  uniform float uRadius;
  uniform float uHardness;
  uniform float uSharpness;
  uniform float uMix;
  varying vec2 vUv;
  #define N 8
  void main() {
    vec3 g = texture(tTensor, vUv).xyz;
    float disc = sqrt(max((g.x - g.y) * (g.x - g.y) + 4.0 * g.z * g.z, 0.0));
    float l1 = 0.5 * (g.x + g.y + disc);
    float l2 = 0.5 * (g.x + g.y - disc);
    vec2 v = vec2(l1 - g.x, -g.z);
    vec2 t = length(v) > 1e-6 ? normalize(v) : vec2(0.0, 1.0);
    float phi = -atan(t.y, t.x);
    float A = (l1 + l2 > 1e-6) ? (l1 - l2) / (l1 + l2) : 0.0;

    float alpha = 1.0;
    float radius = uRadius;
    float a = radius * clamp((alpha + A) / alpha, 0.1, 2.0);
    float b = radius * clamp(alpha / (alpha + A), 0.1, 2.0);
    float cp = cos(phi), sp = sin(phi);
    mat2 R = mat2(cp, -sp, sp, cp);
    mat2 S = mat2(0.5 / a, 0.0, 0.0, 0.5 / b);
    mat2 SR = S * R;
    int maxX = int(sqrt(a * a * cp * cp + b * b * sp * sp));
    int maxY = int(sqrt(a * a * sp * sp + b * b * cp * cp));

    float zeta = 2.0 / radius;
    float zc = 0.58;
    float eta = (zeta + cos(zc)) / (sin(zc) * sin(zc));

    vec4 m[N];
    vec3 s[N];
    for (int k = 0; k < N; k++) { m[k] = vec4(0.0); s[k] = vec3(0.0); }

    for (int y = -maxY; y <= maxY; y++) {
      for (int x = -maxX; x <= maxX; x++) {
        vec2 vv = SR * vec2(float(x), float(y));
        if (dot(vv, vv) > 0.25) continue;
        vec3 c = clamp(texture(tInput, vUv + vec2(float(x), float(y)) * uTexel).rgb, 0.0, 1.0);
        float w[N];
        float sum = 0.0;
        float z, vxx, vyy;
        vxx = zeta - eta * vv.x * vv.x;
        vyy = zeta - eta * vv.y * vv.y;
        z = max(0.0, vv.y + vxx);  w[0] = z * z; sum += w[0];
        z = max(0.0, -vv.x + vyy); w[2] = z * z; sum += w[2];
        z = max(0.0, -vv.y + vxx); w[4] = z * z; sum += w[4];
        z = max(0.0, vv.x + vyy);  w[6] = z * z; sum += w[6];
        vec2 r = 0.70710678 * vec2(vv.x - vv.y, vv.x + vv.y);
        vxx = zeta - eta * r.x * r.x;
        vyy = zeta - eta * r.y * r.y;
        z = max(0.0, r.y + vxx);  w[1] = z * z; sum += w[1];
        z = max(0.0, -r.x + vyy); w[3] = z * z; sum += w[3];
        z = max(0.0, -r.y + vxx); w[5] = z * z; sum += w[5];
        z = max(0.0, r.x + vyy);  w[7] = z * z; sum += w[7];
        float gw = exp(-3.125 * dot(vv, vv)) / max(sum, 1e-6);
        for (int k = 0; k < N; k++) {
          float wk = w[k] * gw;
          m[k] += vec4(c * wk, wk);
          s[k] += c * c * wk;
        }
      }
    }

    vec4 outc = vec4(0.0);
    for (int k = 0; k < N; k++) {
      if (m[k].w <= 0.0) continue;
      vec3 mean = m[k].rgb / m[k].w;
      vec3 var = abs(s[k] / m[k].w - mean * mean);
      float sigma2 = var.r + var.g + var.b;
      float wk = 1.0 / (1.0 + pow(uHardness * 1000.0 * sigma2, 0.5 * uSharpness));
      outc += vec4(mean * wk, wk);
    }
    vec3 src = texture(tInput, vUv).rgb;
    gl_FragColor = vec4(mix(src, outc.w > 1e-30 ? outc.rgb / outc.w : src, uMix), 1.0);
  }
`;

const grade = /* glsl */ `
  uniform sampler2D tInput;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uSaturation;
  uniform float uOlive;
  uniform float uContrast;
  uniform vec3 uShadowTint;
  uniform vec3 uHighlightTint;
  uniform vec3 uPaper;
  uniform float uLift;
  uniform float uGrain;
  uniform float uDitherPx;
  uniform float uLevels;
  uniform float uVignette;
  uniform vec2 uTexel;
  uniform float uSharpen;
  varying vec2 vUv;

  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float vn(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float bayer4(vec2 p) {
    ivec2 q = ivec2(mod(p, 4.0));
    int i = q.x + q.y * 4;
    float m[16] = float[](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
    return m[i] / 16.0 - 0.5;
  }

  // With the brush filter off the grade reads the scene directly and tone-maps as it samples,
  // saving a full-screen pass
  #ifdef RAW_INPUT
  uniform float uExposure;
  vec3 src(vec2 uv) {
    vec3 c = texture(tInput, uv).rgb * uExposure;
    c = clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0.0, 1.0);
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }
  #else
  vec3 src(vec2 uv) { return texture(tInput, uv).rgb; }
  #endif
  void main() {
    vec3 c = src(vUv);
    vec3 nb = src(vUv + vec2(uTexel.x, 0.0)) + src(vUv - vec2(uTexel.x, 0.0))
            + src(vUv + vec2(0.0, uTexel.y)) + src(vUv - vec2(0.0, uTexel.y));
    c = max(c + (c - nb * 0.25) * uSharpen, 0.0);
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(vec3(l), c, uSaturation);
    float green = clamp((c.g - c.b) * 2.5 - max(c.r - c.g, 0.0) * 8.0, 0.0, 1.0) * smoothstep(0.15, 0.6, c.g);
    c = mix(c, vec3(l) * vec3(1.06, 1.0, 0.78) * 1.02, green * uOlive);
    c = (c - 0.5) * uContrast + 0.5;
    c += uShadowTint * (1.0 - smoothstep(0.0, 0.55, l));
    c += uHighlightTint * smoothstep(0.45, 1.0, l);

    vec2 px = vUv * uResolution;
    float paper = vn(px * 0.06) * 0.5 + vn(px * 0.21) * 0.3 + vn(px * 0.9) * 0.2;
    c *= 1.0 + (paper - 0.5) * uGrain;
    c += (hash(px + fract(uTime) * 0.0) - 0.5) * uGrain * 0.35;

    c = uPaper * uLift + c * (1.0 - uLift);

    vec2 q = vUv - 0.5;
    c *= 1.0 - uVignette * dot(q, q) * 1.6;

    if (uLevels > 0.0) {
      float b = bayer4(floor(px / uDitherPx));
      c = floor(c * uLevels + b + 0.5) / uLevels;
    }
    gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
  }
`;

function rt(w, h, type = HalfFloatType) {
  return new WebGLRenderTarget(w, h, { type, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false });
}

export class Painterly {
  constructor(renderer, quality = {}) {
    this.renderer = renderer;
    // The brush filter is now opt-in (?paint=1): the scene reads better and runs faster without it
    this.enabled = false;
    this.scale = quality.paintScale ?? 1;
    this.brush = quality.kuwaharaRadius ?? 3;
    const size = renderer.getDrawingBufferSize(new Vector2());
    this.scene = new WebGLRenderTarget(size.x, size.y, { type: HalfFloatType, samples: 4 });
    this.a = rt(size.x, size.y, UnsignedByteType);
    this.b = rt(size.x, size.y);
    this.c = rt(size.x, size.y);

    const mk = (frag, uniforms) => new FullScreenQuad(new ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false }));
    this.qTone = mk(tonemap, { tInput: { value: null }, uExposure: { value: 1.2 } });
    this.qTensor = mk(tensor, { tInput: { value: null }, uTexel: { value: new Vector2() } });
    this.qBlur = mk(blur, { tInput: { value: null }, uDir: { value: new Vector2() } });
    this.qKuwa = mk(kuwahara, {
      tInput: { value: null }, tTensor: { value: null }, uTexel: { value: new Vector2() },
      uRadius: { value: 3 }, uHardness: { value: 8 }, uSharpness: { value: 8 }, uMix: { value: 0.8 },
    });
    this.qGrade = mk(grade, {
      tInput: { value: null },
      uResolution: { value: new Vector2() },
      uTime: { value: 0 },
      uSaturation: { value: 1.02 },
      uOlive: { value: 0.38 },
      uContrast: { value: 1.06 },
      uShadowTint: { value: new Color(-0.012, 0.004, 0.018) },
      uHighlightTint: { value: new Color(0.03, 0.018, -0.012) },
      uPaper: { value: new Color(0.95, 0.92, 0.84) },
      uLift: { value: 0.035 },
      uGrain: { value: 0.035 },
      uDitherPx: { value: 2 },
      uLevels: { value: 64 },
      uVignette: { value: 0.16 },
      uTexel: { value: new Vector2() },
      uSharpen: { value: 0.12 },
    });
    this.qGradeRaw = new FullScreenQuad(new ShaderMaterial({
      vertexShader: vert, fragmentShader: grade, defines: { RAW_INPUT: 1 }, depthTest: false, depthWrite: false,
      uniforms: { ...this.qGrade.material.uniforms, uExposure: this.qTone.material.uniforms.uExposure },
    }));
    this.params = {
      radius: this.qKuwa.material.uniforms.uRadius,
      levels: this.qGrade.material.uniforms.uLevels,
      exposure: this.qTone.material.uniforms.uExposure,
    };
    this.setSize(size.x, size.y);
  }

  // The scene and the paint passes run at `scale` of the canvas and are upscaled by the
  // final grade pass; the brushwork hides the softer resolution.
  setSize(w, h) {
    this.full = [w, h];
    // On high-density screens the painting is done at no more than about one pixel per CSS
    // pixel: the brush hides the difference and the Kuwahara cost grows fast with size
    const s = this.enabled ? Math.min(this.scale, (1.1 * window.innerHeight) / h) : this.scale;
    const iw = Math.max(2, Math.round(w * s)), ih = Math.max(2, Math.round(h * s));
    for (const t of [this.scene, this.a, this.b, this.c]) t.setSize(iw, ih);
    const texel = new Vector2(1 / iw, 1 / ih);
    this.qTensor.material.uniforms.uTexel.value.copy(texel);
    this.qKuwa.material.uniforms.uTexel.value.copy(texel);
    this.qGrade.material.uniforms.uResolution.value.set(w, h);
    this.qGrade.material.uniforms.uTexel.value.copy(texel);
    this.texel = texel;
    this.qKuwa.material.uniforms.uRadius.value = Math.max(1.5, this.brush * (ih / 1000));
    this.qGrade.material.uniforms.uDitherPx.value = 1;
  }

  setScale(s) {
    if (Math.abs(s - this.scale) < 0.01) return;
    this.scale = s;
    this.setSize(...this.full);
  }

  render(scene, camera, exposure) {
    const r = this.renderer;
    this.qTone.material.uniforms.uExposure.value = exposure;

    r.setRenderTarget(this.scene);
    r.render(scene, camera);

    if (!this.enabled) {
      this.qGradeRaw.material.uniforms.tInput.value = this.scene.texture;
      r.setRenderTarget(null);
      this.qGradeRaw.render(r);
      return;
    }

    this.qTone.material.uniforms.tInput.value = this.scene.texture;
    r.setRenderTarget(this.a);
    this.qTone.render(r);

    let paint = this.a;
    {
      this.qTensor.material.uniforms.tInput.value = this.a.texture;
      r.setRenderTarget(this.b);
      this.qTensor.render(r);

      this.qBlur.material.uniforms.tInput.value = this.b.texture;
      this.qBlur.material.uniforms.uDir.value.set(this.texel.x * 1.5, 0);
      r.setRenderTarget(this.c);
      this.qBlur.render(r);
      this.qBlur.material.uniforms.tInput.value = this.c.texture;
      this.qBlur.material.uniforms.uDir.value.set(0, this.texel.y * 1.5);
      r.setRenderTarget(this.b);
      this.qBlur.render(r);

      this.qKuwa.material.uniforms.tInput.value = this.a.texture;
      this.qKuwa.material.uniforms.tTensor.value = this.b.texture;
      r.setRenderTarget(this.c);
      this.qKuwa.render(r);
      paint = this.c;
    }

    this.qGrade.material.uniforms.tInput.value = paint.texture;
    r.setRenderTarget(null);
    this.qGrade.render(r);
  }
}
