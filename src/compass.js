import { Mesh, Raycaster, Vector2 } from 'three';
import { Builder, SURF, buildingMaterial } from './world/kit.js';
import { SEASON, setMonth } from './season.js';

const SEASONS = ['winter', 'spring', 'summer', 'autumn'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// A ship's compass on the quarterdeck. Clicking it hands the reader a compass of their own
// whose points are times of day rather than directions; turning its needle turns the day.

const KEY = 'valley-compass';

// Dial angle (degrees clockwise from the top) to time of day and back: noon at the top, dusk
// to the right, night at the bottom, dawn to the left
const STOPS = [[0, 0.4], [90, 0.78], [180, 1.0], [270, 1.25], [360, 1.65]];
export function angleToTime(a) {
  a = ((a % 360) + 360) % 360;
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [a0, t0] = STOPS[i], [a1, t1] = STOPS[i + 1];
    if (a <= a1) {
      const t = t0 + ((a - a0) / (a1 - a0)) * (t1 - t0);
      return t > 1.25 ? t - 1.25 : t;
    }
  }
  return 0.4;
}
export function timeToAngle(t) {
  if (t < 0.4) t += 1.25;
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [a0, t0] = STOPS[i], [a1, t1] = STOPS[i + 1];
    if (t <= t1) return a0 + ((t - t0) / (t1 - t0)) * (a1 - a0);
  }
  return 0;
}

export function buildBinnacle() {
  const b = new Builder();
  b.groundY = 0;
  b.cylinder(0.24, 0.95, 0, 0, 0, SURF.plank, '#5a4430', 8, 0, 0, 0, 0.18);
  b.cylinder(0.3, 0.14, 0, 0.95, 0, SURF.flat, '#b8913a', 16, 0, 0, 0, 0.26);
  b.cylinder(0.25, 0.02, 0, 1.09, 0, SURF.plaster, '#f2ead8', 20);
  b.box(0.04, 0.012, 0.36, 0, 1.11, 0, SURF.flat, '#8a2f2a');
  b.dome(0.25, 0.12, 0, 1.09, 0, SURF.glass, '#ffffff', 16);
  for (const s of [-1, 1]) b.blob(0.07, s * 0.36, 1.0, 0, SURF.flat, '#b8913a', [1, 1, 1], 1);
  const material = buildingMaterial();
  const mesh = new Mesh(b.build(), material);
  mesh.position.set(-9.0, 4.34, 1.6);
  return mesh;
}

export class Compass {
  constructor({ camera, canvas, mesh, onTime, isAboard }) {
    Object.assign(this, { camera, canvas, mesh, onTime, isAboard });
    this.el = document.querySelector('.day-compass');
    this.needle = this.el.querySelector('.needle');
    this.angle = 0;
    this.held = false;
    let found = false;
    try { found = localStorage.getItem(KEY) === 'found'; } catch { /* private mode */ }
    if (found) this.reveal(false);
    this.listen();
  }

  reveal(fresh = true) {
    this.el.hidden = false;
    requestAnimationFrame(() => this.el.classList.add('shown', ...(fresh ? ['fresh'] : [])));
    try { localStorage.setItem(KEY, 'found'); } catch { /* private mode */ }
  }

  listen() {
    const ray = new Raycaster(), ndc = new Vector2();
    const hit = e => {
      if (!this.isAboard() || !this.mesh.visible) return false;
      ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      ray.setFromCamera(ndc, this.camera);
      this.mesh.updateMatrixWorld();
      return ray.intersectObject(this.mesh, false).length > 0;
    };
    let downAt = null;
    window.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
    window.addEventListener('pointerup', e => {
      if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
      if (e.target.closest('.panel, .day-compass, button, a, nav') || !hit(e)) return;
      this.reveal();
    });
    window.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || this.held) return;
      document.body.classList.toggle('over-binnacle', !e.target.closest('.panel, button, a, nav') && hit(e));
    });

    const coin = this.el.querySelector('.coin');
    const [front, back] = coin.querySelectorAll('.dial');
    const angleAt = e => {
      const r = coin.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      return { angle: (Math.atan2(dx, -dy) * 180) / Math.PI, centre: Math.hypot(dx, dy) < this.el.offsetWidth * 0.16 };
    };
    const turn = a => (this.flipped ? this.pickSeason(a) : this.set(a));
    let tap = null;
    coin.addEventListener('pointerdown', e => {
      e.preventDefault();
      e.stopPropagation();
      coin.setPointerCapture(e.pointerId);
      const at = angleAt(e);
      if (at.centre) { tap = { x: e.clientX, y: e.clientY }; return; }
      this.held = true;
      turn(at.angle);
    });
    coin.addEventListener('pointermove', e => {
      if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 6) { tap = null; this.held = true; }
      if (this.held) turn(angleAt(e).angle);
    });
    coin.addEventListener('pointerup', () => {
      if (tap) this.centreTap();
      tap = null;
      this.held = false;
    });
    coin.addEventListener('pointercancel', () => { tap = null; this.held = false; });
    for (const face of [front, back]) {
      face.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); return this.centreTap(); }
        const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
        if (!step) return;
        e.preventDefault();
        e.stopPropagation();
        if (this.flipped) this.pickSeason(this.seasonAngle + step * 30);
        else this.set(this.angle + step * 7.5);
      });
    }
    this.el.querySelector('.crown').addEventListener('click', e => { e.stopPropagation(); this.flip(); });
    this.faces = [front, back];
    this.seasonNeedle = back.querySelector('.needle');
    this.seasonAngle = SEASON.month * 30;
    this.drawSeason();
  }

  // A tap on the cap puts things back as they were: the journey's time, or the calendar's month
  centreTap() {
    if (this.flipped) this.pickSeason(null);
    else { this.onTime(null); this.el.classList.remove('turned'); }
  }

  flip() {
    this.flipped = !this.flipped;
    this.el.classList.toggle('flipped', this.flipped);
    const [front, back] = this.faces;
    const [shown, hidden] = this.flipped ? [back, front] : [front, back];
    hidden.setAttribute('tabindex', '-1');
    hidden.setAttribute('aria-hidden', 'true');
    shown.setAttribute('tabindex', '0');
    shown.removeAttribute('aria-hidden');
    if (document.activeElement === hidden) shown.focus();
  }

  pickSeason(angle) {
    const m = angle === null ? SEASON.calendar : Math.round((((angle % 360) + 360) % 360) / 30) % 12;
    this.seasonAngle += ((((m * 30 - this.seasonAngle) % 360) + 540) % 360) - 180;
    setMonth(m);
    this.drawSeason();
  }

  drawSeason() {
    this.seasonNeedle.style.transform = `rotate(${this.seasonAngle}deg)`;
    const back = this.faces[1], m = SEASON.month;
    back.setAttribute('aria-valuenow', String(m + 1));
    back.setAttribute('aria-valuetext', MONTHS[m]);
    back.querySelectorAll('.month').forEach((t, i) => t.classList.toggle('picked', i === m));
    const season = SEASONS[Math.round(m / 3) % 4];
    for (const n of SEASONS) back.querySelector(`.season-${n}`).classList.toggle('picked', n === season);
  }

  set(angle) {
    this.angle = ((angle % 360) + 360) % 360;
    this.el.classList.add('turned');
    this.onTime(angleToTime(this.angle));
    this.draw();
  }

  // Follows the journey's own time while the reader is not holding the needle
  follow(t) {
    if (this.el.hidden || this.el.classList.contains('turned')) return;
    this.angle = timeToAngle(t);
    this.draw();
  }

  draw() {
    this.needle.style.transform = `rotate(${this.angle}deg)`;
    this.faces[0].setAttribute('aria-valuenow', String(Math.round(this.angle)));
  }
}
