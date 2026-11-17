import { WebGLRenderTarget, HalfFloatType, PerspectiveCamera, Vector3, Vector4, Matrix4, Plane, Vector2, Frustum } from 'three';
import { riverX, waterLevel } from './valley.js';

const frustum = new Frustum(), m = new Matrix4(), probe = new Vector3();

// True when some stretch of river or sea is inside the camera's view
export function waterInView(camera) {
  m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(m);
  const cz = camera.position.z;
  for (let z = Math.max(-9800, cz - 5000); z < Math.min(9000, cz + 5000); z += 120) {
    if (frustum.containsPoint(probe.set(riverX(z), waterLevel(z), z))) return true;
  }
  for (let x = -6000; x <= 6000; x += 400) {
    for (let z = 8600; z < 14000; z += 600) if (frustum.containsPoint(probe.set(x, 0, z))) return true;
  }
  return false;
}
import { shared } from '../atmosphere.js';

// Planar reflection about a horizontal plane at the water level nearest the camera, using an
// oblique near plane so nothing below the water leaks into the reflection.
const UP = new Vector3(0, 1, 0), FORWARD = new Vector3(0, 0, -1);
const _point = new Vector3(), _look = new Vector3(), _target = new Vector3(), _up = new Vector3();
const _plane = new Plane(), _clip = new Vector4(), _q = new Vector4();

export class Reflection {
  constructor(renderer, scale = 0.3) {
    this.renderer = renderer;
    this.scale = scale;
    const s = renderer.getDrawingBufferSize(new Vector2());
    this.target = new WebGLRenderTarget(Math.round(s.x * scale), Math.round(s.y * scale), { type: HalfFloatType });
    this.camera = new PerspectiveCamera();
    this.hide = [];
    shared.uReflectTex.value = this.target.texture;
  }

  setSize(w, h) {
    this.target.setSize(Math.round(w * this.scale), Math.round(h * this.scale));
  }

  update(scene, camera, planeY) {
    if (!waterInView(camera)) {
      shared.uReflectOn.value = 0;
      return;
    }
    const point = _point.set(camera.position.x, planeY, camera.position.z);
    if (camera.position.y < planeY + 0.2) {
      shared.uReflectOn.value = 0;
      return;
    }
    const cam = this.camera;
    const mirror = (v, out) => out.copy(v).setY(2 * planeY - v.y);

    camera.updateMatrixWorld();
    mirror(camera.position, cam.position);
    const look = _look.copy(FORWARD).transformDirection(camera.matrixWorld).add(camera.position);
    const target = mirror(look, _target);
    const up = _up.copy(UP).transformDirection(camera.matrixWorld);
    cam.up.set(up.x, -up.y, up.z);
    cam.lookAt(target);
    cam.near = camera.near;
    cam.far = camera.far;
    cam.updateMatrixWorld();
    cam.projectionMatrix.copy(camera.projectionMatrix);

    const plane = _plane.setFromNormalAndCoplanarPoint(UP, point).applyMatrix4(cam.matrixWorldInverse);
    const clip = _clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const pm = cam.projectionMatrix.elements;
    const q = _q.set(
      (Math.sign(clip.x) + pm[8]) / pm[0],
      (Math.sign(clip.y) + pm[9]) / pm[5],
      -1,
      (1 + pm[10]) / pm[14],
    );
    clip.multiplyScalar(2 / clip.dot(q));
    pm[2] = clip.x;
    pm[6] = clip.y;
    pm[10] = clip.z + 1 - 0.003;
    pm[14] = clip.w;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();

    shared.uReflectMatrix.value.set(
      0.5, 0, 0, 0.5,
      0, 0.5, 0, 0.5,
      0, 0, 0.5, 0.5,
      0, 0, 0, 1,
    ).multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);

    const vis = this.vis ??= [];
    this.hide.forEach((o, i) => { vis[i] = o.visible; o.visible = false; });
    const r = this.renderer;
    const prev = r.getRenderTarget();
    r.setRenderTarget(this.target);
    r.render(scene, cam);
    r.setRenderTarget(prev);
    this.hide.forEach((o, i) => { o.visible = vis[i]; });
    shared.uReflectOn.value = 1;
  }
}
