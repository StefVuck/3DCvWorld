import { Mesh, SphereGeometry, ShaderMaterial, BackSide } from 'three';
import { shared } from '../atmosphere.js';
import { atmosphereUniforms, noise, sky } from '../shaders/common.js';

export function buildSky() {
  const mat = new ShaderMaterial({
    uniforms: { ...shared },
    side: BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
        gl_Position.z = gl_Position.w * 0.99999;
      }
    `,
    fragmentShader: /* glsl */ `
      ${atmosphereUniforms}
      ${noise}
      ${sky}
      varying vec3 vWorld;
      void main() {
        vec3 d = normalize(vWorld - cameraPosition);
        vec3 col = skyColor(d);
        float s = max(dot(d, uSunDir), 0.0);
        col += uSunColor * (smoothstep(0.99984, 0.99992, s) * 2.5 + pow(s, 600.0) * 0.35 + pow(s, 60.0) * 0.08) * uSunVisible;

        // The moon in its real phase, rising as the sun goes down
        vec3 mz = uMoonDir, mx = normalize(cross(vec3(0.0, 1.0, 0.0), mz)), my = cross(mz, mx);
        vec2 mq = vec2(dot(d, mx), dot(d, my)) / 0.0105;
        float md = length(mq);
        float night = 1.0 - smoothstep(0.08, 0.4, uSunDir.y);
        if (dot(d, mz) > 0.0 && md < 1.6 && night > 0.0) {
          float k = cos(6.2831853 * uMoonPhase), edge = sqrt(max(1.0 - mq.y * mq.y, 0.0)) * k;
          float lit = uMoonPhase < 0.5 ? step(edge, -mq.x) : step(edge, mq.x);
          float disc = 1.0 - smoothstep(0.92, 1.0, md);
          float maria = 0.86 + 0.14 * vnoise(mq * 2.3 + 4.0);
          col = mix(col, col * 0.92 + vec3(0.02, 0.02, 0.03), disc * night * 0.5);
          col += vec3(1.0, 0.96, 0.86) * disc * lit * maria * 1.15 * night;
          col += vec3(0.9, 0.88, 0.8) * exp(-md * 1.6) * 0.05 * night * (0.3 + 0.7 * (0.5 - 0.5 * k));
        }

        if (d.y > 0.0) {
          vec2 p = d.xz / (d.y + 0.08) * 1.6 + vec2(uTime * 0.004, 0.0);
          float c = fbm(p * 0.9) * 0.7 + fbm(p * 3.1 + 5.0) * 0.3;
          float band = smoothstep(0.01, 0.06, d.y) * (1.0 - smoothstep(0.12, 0.4, d.y));
          float cm = smoothstep(0.56, 0.74, c) * band;
          vec2 sd = normalize(uSunDir.xz + 1e-4);
          float toward = 0.5 + 0.5 * dot(normalize(d.xz + 1e-4), sd);
          vec3 base = skyColor(d);
          vec3 lit = base * 1.12 + uSunColor * 0.03 * uSunVisible;
          vec3 shade = mix(base, uZenith, 0.25) * 0.94;
          float thick = smoothstep(0.55, 0.85, c);
          vec3 cc = mix(lit, shade, thick * (1.0 - toward * 0.6));
          cc += uSunColor * pow(s, 12.0) * 0.25 * (1.0 - thick) * uSunVisible;
          col = mix(col, cc, cm * 0.7);
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new Mesh(new SphereGeometry(30000, 48, 24), mat);
  mesh.frustumCulled = false;
  // Drawn after the ground so its clouds are only worked out where the sky actually shows
  mesh.renderOrder = 100;
  mesh.onBeforeRender = (r, s, camera) => mesh.position.copy(camera.position);
  return mesh;
}
