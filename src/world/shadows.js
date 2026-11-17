import { WebGLRenderTarget, DepthTexture, OrthographicCamera, Vector3, Matrix4, NearestFilter, UnsignedIntType } from 'three';
import { shared } from '../atmosphere.js';

export const SHADOW_LAYER = 3;

// A sun-aligned shadow map over the settlement nearest the camera. Distant shading still
// comes from the terrain march and the canopy texture; this adds crisp contact shadows.
export class LocalShadow {
  constructor(renderer, size = 2048, radius = 110) {
    this.renderer = renderer;
    this.radius = radius;
    this.target = new WebGLRenderTarget(size, size, { depthBuffer: true });
    this.target.depthTexture = new DepthTexture(size, size, UnsignedIntType);
    this.target.depthTexture.minFilter = this.target.depthTexture.magFilter = NearestFilter;
    this.camera = new OrthographicCamera(-radius, radius, radius, -radius, 1, 900);
    this.camera.layers.set(SHADOW_LAYER);
    this.centre = new Vector3();
    this.casters = [];
    shared.uLocalShadowMap.value = this.target.depthTexture;
    shared.uLocalShadowTexel.value.set(1 / size, 1 / size);
  }

  addCaster(mesh, depthMaterial) {
    mesh.layers.enable(SHADOW_LAYER);
    this.casters.push({ mesh, depthMaterial });
  }

  setCasters(list) {
    for (const c of this.casters) c.mesh.layers.disable(SHADOW_LAYER);
    this.casters = [];
    for (const c of list) this.addCaster(c.mesh, c.depthMaterial);
  }

  update(scene, sunDir, centre) {
    if (centre) this.centre.copy(centre);
    if (sunDir.y < 0.02) {
      shared.uLocalShadowOn.value = 0;
      return;
    }
    const cam = this.camera;
    cam.position.copy(this.centre).addScaledVector(sunDir, 450);
    cam.up.set(0, 1, 0);
    if (Math.abs(sunDir.y) > 0.98) cam.up.set(0, 0, 1);
    cam.lookAt(this.centre);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();

    const saved = this.casters.map(c => [c.mesh.material, c.mesh.visible]);
    for (const c of this.casters) {
      c.mesh.material = c.depthMaterial;
      c.mesh.visible = true;
    }
    const r = this.renderer;
    const prev = r.getRenderTarget();
    const bg = scene.background;
    r.setRenderTarget(this.target);
    r.clear();
    r.render(scene, cam);
    r.setRenderTarget(prev);
    scene.background = bg;
    this.casters.forEach((c, i) => { c.mesh.material = saved[i][0]; c.mesh.visible = saved[i][1]; });

    shared.uLocalShadowMatrix.value.set(
      0.5, 0, 0, 0.5,
      0, 0.5, 0, 0.5,
      0, 0, 0.5, 0.5,
      0, 0, 0, 1,
    ).multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
    shared.uLocalShadowOn.value = 1;
  }
}
