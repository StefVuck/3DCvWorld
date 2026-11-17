import { Vector3 } from 'three';
import { at } from '../kit.js';
import { SITES } from '../valley.js';

// A settlement's local frame: origin on its shelf, +z the way it faces.
export class Place {
  constructor(id, rot) {
    this.id = id;
    this.site = SITES.find(s => s.id === id);
    this.rot = rot;
    this.cr = Math.cos(rot);
    this.sr = Math.sin(rot);
    this.matrix = at(this.site.x, this.site.y, this.site.z, rot);
    this.centre = new Vector3(this.site.x, this.site.y, this.site.z);
  }

  toWorld(lx, lz) {
    return [this.site.x + lx * this.cr + lz * this.sr, this.site.z - lx * this.sr + lz * this.cr];
  }

  point(lx, ly, lz) {
    const [x, z] = this.toWorld(lx, lz);
    return new Vector3(x, this.site.y + ly, z);
  }

  dir(lx, lz) {
    return new Vector3(lx * this.cr + lz * this.sr, 0, -lx * this.sr + lz * this.cr).normalize();
  }

  build(builder, fn) {
    builder.groundY = this.site.y;
    builder.group(this.matrix, fn);
  }
}
