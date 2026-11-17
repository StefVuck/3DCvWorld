import { CanvasTexture, LinearFilter, Vector4 } from 'three';

// Each settlement paints its yards, streets and paths into one tile of a shared atlas.
// R = trodden earth or road, G = tilled soil, B = settlement ground (no fields or hedges).
export class GroundAtlas {
  constructor(cols = 4, rows = 2, tile = 512) {
    this.cols = cols;
    this.rows = rows;
    this.tile = tile;
    this.canvas = document.createElement('canvas');
    this.canvas.width = cols * tile;
    this.canvas.height = rows * tile;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.bounds = Array.from({ length: cols * rows }, () => new Vector4(0, 0, 1, 1));
    this.count = 0;
  }

  paint(place, size, painter) {
    const i = this.count++;
    const ox = (i % this.cols) * this.tile, oy = Math.floor(i / this.cols) * this.tile;
    const b = this.bounds[i].set(place.site.x - size / 2, place.site.z - size / 2, size, size);
    const res = this.tile, ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, res, res);
    ctx.clip();
    ctx.translate(ox, oy);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const px = (lx, lz) => {
      const [x, z] = place.toWorld(lx, lz);
      return [((x - b.x) / size) * res, ((z - b.y) / size) * res];
    };
    const k = res / size;
    const path = (pts, width, color = 'rgb(220,0,0)', blur = 2) => {
      ctx.filter = `blur(${blur}px)`;
      ctx.strokeStyle = color;
      ctx.lineWidth = width * k;
      ctx.beginPath();
      pts.forEach((p, j) => (j ? ctx.lineTo(...px(...p)) : ctx.moveTo(...px(...p))));
      ctx.stroke();
    };
    const poly = (pts, color, blur = 2) => {
      ctx.filter = `blur(${blur}px)`;
      ctx.fillStyle = color;
      ctx.beginPath();
      pts.forEach((p, j) => (j ? ctx.lineTo(...px(...p)) : ctx.moveTo(...px(...p))));
      ctx.closePath();
      ctx.fill();
    };
    const disc = (lx, lz, r, color, blur = 8) => {
      ctx.filter = `blur(${blur}px)`;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(...px(lx, lz), r * k, 0, Math.PI * 2);
      ctx.fill();
    };
    const rect = (x0, z0, x1, z1, color, blur = 1) => poly([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], color, blur);
    painter({ ctx, px, k, path, poly, disc, rect });
    ctx.restore();
  }

  finish() {
    const texture = new CanvasTexture(this.canvas);
    texture.flipY = false;
    texture.minFilter = texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;
    const data = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
    const W = this.canvas.width;
    const sampleCPU = (x, z) => {
      for (let i = 0; i < this.count; i++) {
        const b = this.bounds[i];
        const u = (x - b.x) / b.z, v = (z - b.y) / b.w;
        if (u < 0 || v < 0 || u >= 1 || v >= 1) continue;
        const px = (i % this.cols) * this.tile + Math.floor(u * this.tile);
        const py = Math.floor(i / this.cols) * this.tile + Math.floor(v * this.tile);
        const k = (py * W + px) * 4;
        return [data[k] / 255, data[k + 1] / 255, data[k + 2] / 255];
      }
      return [0, 0, 0];
    };
    this.texture = texture;
    this.sampleCPU = sampleCPU;
    return this;
  }
}
