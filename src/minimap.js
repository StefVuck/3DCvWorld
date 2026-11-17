import { riverX, riverWidth } from './world/valley.js';

// The valley runs left (mountains) to right (sea), so the map reads in the order of the journey
const Z0 = -8200, Z1 = 10800, X0 = -1700, X1 = 1500;

export class Minimap {
  constructor(root, stops, views, onSelect) {
    this.root = root;
    this.canvas = root.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.markers = [];
    this.w = 300;
    this.h = 96;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.ctx.scale(dpr, dpr);
    this.base = document.createElement('canvas');
    this.base.width = this.canvas.width;
    this.base.height = this.canvas.height;
    this.drawBase(dpr);
    stops.forEach((s, i) => {
      const [x, y] = this.project(views[i].look.x, views[i].look.z);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'marker';
      b.style.left = `${x}px`;
      b.style.top = `${y}px`;
      b.textContent = String(i + 1);
      b.setAttribute('aria-label', `${s.placeName}: ${s.title}`);
      b.title = `${s.placeName} · ${s.title}`;
      b.addEventListener('click', () => onSelect(i));
      root.querySelector('.markers').append(b);
      this.markers.push(b);
    });
  }

  setMarker(i, x, z) {
    const [px, py] = this.project(x, z);
    this.markers[i].style.left = `${px}px`;
    this.markers[i].style.top = `${py}px`;
  }

  project(x, z) {
    return [((z - Z0) / (Z1 - Z0)) * this.w, ((x - X0) / (X1 - X0)) * this.h];
  }

  drawBase(dpr) {
    const c = this.base.getContext('2d');
    c.scale(dpr, dpr);
    const { w, h } = this;
    c.fillStyle = '#efe4cb';
    c.fillRect(0, 0, w, h);
    const sea = this.project(0, 8700)[0];
    const g = c.createLinearGradient(sea - 30, 0, sea + 20, 0);
    g.addColorStop(0, 'rgba(120,150,160,0)');
    g.addColorStop(1, 'rgba(120,150,160,0.35)');
    c.fillStyle = g;
    c.fillRect(sea - 30, 0, w - sea + 30, h);
    c.strokeStyle = 'rgba(80,70,55,0.18)';
    c.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      c.beginPath();
      for (let z = Z0; z < 8600; z += 100) {
        const off = 700 + k * 180 + 120 * Math.sin(z * 0.0009 + k);
        const [x, y] = this.project(riverX(z) - off, z);
        z === Z0 ? c.moveTo(x, y) : c.lineTo(x, y);
      }
      c.stroke();
      c.beginPath();
      for (let z = Z0; z < 8600; z += 100) {
        const off = 700 + k * 180 + 120 * Math.cos(z * 0.0008 + k);
        const [x, y] = this.project(riverX(z) + off, z);
        z === Z0 ? c.moveTo(x, y) : c.lineTo(x, y);
      }
      c.stroke();
    }
    c.strokeStyle = '#5f7f8c';
    c.lineCap = 'round';
    for (let z = Z0; z < 9000; z += 60) {
      const [x0, y0] = this.project(riverX(z), z);
      const [x1, y1] = this.project(riverX(z + 60), z + 60);
      c.lineWidth = 0.8 + riverWidth(z) / 30;
      c.beginPath();
      c.moveTo(x0, y0);
      c.lineTo(x1, y1);
      c.stroke();
    }
    c.setLineDash([2, 3]);
    c.strokeStyle = 'rgba(60,50,40,0.5)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(...this.project(riverX(7650) + 60, 7650));
    c.quadraticCurveTo(...this.project(riverX(9200), 9200), ...this.project(riverX(10200) + 200, 10300));
    c.stroke();
    c.setLineDash([]);
    c.strokeStyle = 'rgba(60,50,40,0.6)';
    c.strokeRect(0.5, 0.5, w - 1, h - 1);
  }

  update(camera, activeIndex) {
    const c = this.ctx;
    c.clearRect(0, 0, this.w, this.h);
    c.drawImage(this.base, 0, 0, this.w, this.h);
    const [x, y] = this.project(camera.position.x, camera.position.z);
    const dir = camera.getWorldDirection(this._d || (this._d = camera.position.clone()));
    const a = Math.atan2(dir.x / (X1 - X0) * this.h, dir.z / (Z1 - Z0) * this.w);
    c.save();
    c.translate(x, y);
    c.rotate(a);
    c.fillStyle = 'rgba(156,79,53,0.25)';
    c.beginPath();
    c.moveTo(0, 0);
    c.arc(0, 0, 22, -0.4, 0.4);
    c.closePath();
    c.fill();
    c.fillStyle = '#9c4f35';
    c.beginPath();
    c.arc(0, 0, 3.2, 0, Math.PI * 2);
    c.fill();
    c.restore();
    this.markers.forEach((m, i) => m.classList.toggle('on', i === activeIndex));
  }
}
