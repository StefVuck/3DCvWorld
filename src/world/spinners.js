import { Group, Mesh } from 'three';
import { Builder, buildingMaterial } from './kit.js';

// Turning parts (waterwheels, sails, crane wheels) built with the kit around their own pivot
export class Spinners {
  constructor() {
    this.group = new Group();
    this.items = [];
    this.material = buildingMaterial();
  }

  add(matrix, axis, speed, groundY, fn) {
    const b = new Builder();
    b.groundY = groundY;
    fn(b);
    const pivot = new Group();
    matrix.decompose(pivot.position, pivot.quaternion, pivot.scale);
    const mesh = new Mesh(b.build(), this.material);
    pivot.add(mesh);
    this.group.add(pivot);
    this.items.push({ mesh, axis, speed });
    return mesh;
  }

  update(t) {
    for (const it of this.items) it.mesh.rotation[it.axis] = t * it.speed;
  }
}
