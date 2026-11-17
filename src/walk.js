import { Euler, MathUtils, Vector3 } from 'three';
import { waterLevel } from './world/valley.js';

// A first-person stroll through the valley, for poking about at ground level. Keys or the
// left thumb walk, the mouse or right thumb looks; walls, trees and deep water stop you.

const CELL = 0.5, EYE = 1.65, RADIUS = 0.22, STEP = 0.82, BAND = 0.1;
const RING = [[0, 0], [RADIUS, 0], [-RADIUS, 0], [0, RADIUS], [0, -RADIUS], [0.7 * RADIUS, 0.7 * RADIUS], [-0.7 * RADIUS, 0.7 * RADIUS], [0.7 * RADIUS, -0.7 * RADIUS], [-0.7 * RADIUS, -0.7 * RADIUS]];
// A set split across shards, so that growing it never rehashes a million entries at once
class Cells {
  constructor(n = 16) { this.s = Array.from({ length: n }, () => new Set()); this.n = n; }
  add(k) { this.s[((k % this.n) + this.n) % this.n].add(k); }
  has(k) { return this.s[((k % this.n) + this.n) % this.n].has(k); }
  clear() { for (const x of this.s) x.clear(); }
  get size() { return this.s.reduce((a, x) => a + x.size, 0); }
}
const key = (x, z) => Math.floor(x / CELL) * 65536 + Math.floor(z / CELL);
// A cell and a tenth-of-a-metre height band together, so surfaces can be stacked: a quay deck
// above the water, a step above the quay, a wall above both
const band = y => Math.floor((y + 1000) / BAND);
const at = (k, b) => k * 32768 + b;

export class Walk {
  constructor({ camera, canvas, meshHeight, places, buildings, trees, names = [], onTime, onLeave }) {
    Object.assign(this, { camera, canvas, meshHeight, places, buildings, names, onTime, onLeave });
    this.flight = null;
    this.on = false;
    this.pos = new Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.vy = 0;
    this.y = 0;
    this.bob = 0;
    this.keys = new Set();
    this.stick = null;
    this.look = null;
    this.solid = new Cells();
    this.floor = new Cells();
    this.roofed = new Set();
    this.surveyed = new Set();
    this.jobs = new Map();
    // The town first, since walks start there, then the others nearest first
    const town = places.findIndex(p => p.place.id === 'town');
    this.order = places.map((p, i) => i).sort((i, j) => (i === town ? -1 : j === town ? 1 : places[i].place.centre.distanceTo(places[town].place.centre) - places[j].place.centre.distanceTo(places[town].place.centre)));
    this.trees = new Map();
    for (const t of trees) {
      const k = Math.floor(t.x / 20) * 4096 + Math.floor(t.z / 20);
      if (!this.trees.has(k)) this.trees.set(k, []);
      this.trees.get(k).push({ x: t.x, z: t.z, r: 0.35 + t.scale * 0.025 });
    }
    this.euler = new Euler(0, 0, 0, 'YXZ');
    this.hint = document.createElement('div');
    this.hint.className = 'note walk-hint';
    this.hint.hidden = true;
    const touch = matchMedia('(pointer: coarse)').matches;
    this.hint.innerHTML = `<p>${touch
      ? 'Left thumb to walk, right thumb to look.'
      : 'Click to look about. <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to walk, <kbd>Shift</kbd> to hurry, <kbd>Space</kbd> to hop, <kbd>[</kbd> <kbd>]</kbd> to turn the day, the number keys or the map to fly elsewhere.'}</p><button class="note-button" type="button">Back to the journey</button>`;
    this.hint.querySelector('button').addEventListener('click', () => this.onLeave());
    document.body.append(this.hint);
    this.dest = document.createElement('p');
    this.dest.className = 'walk-dest';
    this.dest.hidden = true;
    document.body.append(this.dest);
    this.listen();
  }

  // Every surface near the ground is recorded by height: anything facing up is somewhere to
  // stand, anything else is in the way. The survey of each settlement runs as a job a few
  // milliseconds at a time, in the background once the valley has loaded, so the page never
  // stalls; `survey` finishes one at once when it is needed straight away.
  survey(k) {
    if (this.surveyed.has(k)) return;
    const job = this.job(k);
    while (!job.next().done);
  }

  job(k) {
    if (!this.jobs.has(k)) this.jobs.set(k, this.surveyJob(k));
    return this.jobs.get(k);
  }

  // Works for up to `budget` ms on the given settlement, or on the next one not yet surveyed
  step(budget, k = null) {
    if (k === null) {
      k = this.order.find(i => !this.surveyed.has(i));
      if (k === undefined) return;
    } else if (this.surveyed.has(k)) return;
    const job = this.job(k);
    const t0 = performance.now();
    while (performance.now() - t0 < budget) if (job.next().done) return;
  }

  *surveyJob(k) {
    const meshes = this.buildings.children.filter(m => m.userData.place === k);
    for (const root of this.places[k].meshes ?? []) root.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o.geometry?.attributes.position) meshes.push(o); });
    const a = new Vector3(), b = new Vector3(), c = new Vector3(), p = new Vector3(), ab = new Vector3(), ac = new Vector3(), nrm = new Vector3();
    // How far above the ground there is anything to stand on: higher where there is a tower to climb
    const reach = this.places[k].climb ?? 6;
    let work = 0;
    for (const mesh of meshes) {
      mesh.updateMatrixWorld();
      const g = mesh.geometry, pos = g.attributes.position, idx = g.index;
      const n = idx ? idx.count : pos.count;
      const vert = (i, v) => v.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(mesh.matrixWorld);
      for (let i = 0; i < n; i += 3) {
        vert(i, a); vert(i + 1, b); vert(i + 2, c);
        const ground = this.meshHeight((a.x + b.x + c.x) / 3, (a.z + b.z + c.z) / 3);
        const lo = ground - 4, hi = ground + reach, top = ground + Math.max(9, reach);
        if (Math.max(a.y, b.y, c.y) < lo || Math.min(a.y, b.y, c.y) > top) continue;
        const span = Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a));
        const steps = Math.min(400, Math.ceil(span / (CELL * 0.7)));
        ab.subVectors(b, a);
        ac.subVectors(c, a);
        const up = nrm.crossVectors(ab, ac).normalize().y > 0.75;
        for (let s = 0; s <= steps; s++) {
          for (let t = 0; s + t <= steps; t++) {
            p.copy(a).addScaledVector(ab, s / steps).addScaledVector(ac, t / steps);
            const k = key(p.x, p.z);
            if (p.y >= lo && p.y <= hi) (up ? this.floor : this.solid).add(at(k, band(p.y)));
            if (p.y > ground + 1.9 && p.y <= top) this.roofed.add(k);
          }
          work += steps - s + 1;
          if (work > 12000) { work = 0; yield; }
        }
      }
    }
    this.surveyed.add(k);
    this.jobs.delete(k);
  }

  // Where someone whose feet are at `foot` would stand at (x, z): the highest floor they can
  // step up to or drop down onto, or the ground
  standAt(x, z, foot) {
    const g = this.meshHeight(x, z), k = key(x, z);
    for (let b = band(foot + STEP), end = band(Math.max(g, foot - 6)); b >= end; b--) {
      if (this.floor.has(at(k, b))) return Math.max(g, (b + 0.5) * BAND - 1000);
    }
    return g;
  }

  free(x, z, foot = this.meshHeight(x, z)) {
    const stand = this.standAt(x, z, foot);
    const b0 = band(stand + STEP + 0.07), b1 = band(stand + 1.85);
    for (const [dx, dz] of RING) {
      const k = key(x + dx, z + dz);
      for (let b = b0; b <= b1; b++) if (this.solid.has(at(k, b)) || this.floor.has(at(k, b))) return false;
    }
    if (stand < waterLevel(z) - 0.35) return false;
    const cx = Math.floor(x / 20), cz = Math.floor(z / 20);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      for (const t of this.trees.get((cx + i) * 4096 + cz + j) ?? []) {
        if (Math.hypot(t.x - x, t.z - z) < t.r + RADIUS) return false;
      }
    }
    return true;
  }

  nearest() {
    let best = 0, bd = Infinity;
    this.places.forEach((p, i) => {
      const d = Math.hypot(p.place.centre.x - this.pos.x, p.place.centre.z - this.pos.z);
      if (d < bd) { bd = d; best = i; }
    });
    return { index: best, distance: bd };
  }

  // A spot a little way out from a settlement's middle, facing into it
  spawnFor(k) {
    const { place } = this.places[k];
    this.survey(k);
    const start = place.point(0, 0, 14);
    let spot = start.clone();
    search: for (let r = 0; r < 60; r += 0.75) {
      for (let a = 0; a < Math.PI * 2; a += 0.4) {
        const x = start.x + Math.cos(a) * r, z = start.z + Math.sin(a) * r;
        if (this.free(x, z) && !this.roofed.has(key(x, z)) && this.open(x, z)) { spot.set(x, 0, z); break search; }
      }
    }
    return { x: spot.x, z: spot.z, y: this.meshHeight(spot.x, spot.z) + EYE, yaw: Math.atan2(-(place.centre.x - spot.x), -(place.centre.z - spot.z)), pitch: -0.05 };
  }

  // Somewhere with room to walk away in at least two directions, not shut in a courtyard
  open(x, z) {
    let ways = 0;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
      let px = x, pz = z, foot = this.meshHeight(x, z), ok = true;
      for (let i = 0; i < 40 && ok; i++) {
        const nx = px + Math.sin(a) * 0.3, nz = pz + Math.cos(a) * 0.3;
        if (this.free(nx, nz, foot)) { px = nx; pz = nz; foot = this.standAt(px, pz, foot); } else ok = false;
      }
      if (ok && ++ways >= 2) return true;
    }
    return false;
  }

  arrive(k) {
    const s = this.spawnFor(k);
    this.pos.set(s.x, 0, s.z);
    this.y = s.y;
    this.vy = 0;
    this.yaw = s.yaw;
    this.pitch = s.pitch;
  }

  // Fast travel: the walker is lifted up over the valley like a bird, glides to the other
  // settlement and comes down gently at its edge
  travel(k) {
    if (this.flight) return;
    const to = this.spawnFor(k);
    const from = { x: this.pos.x, z: this.pos.z, y: this.y, yaw: this.yaw, pitch: this.pitch };
    const dist = Math.hypot(to.x - from.x, to.z - from.z);
    if (dist < 25) return this.arrive(k);
    this.flight = { from, to, t: 0, dist, dur: MathUtils.clamp(3.5 + dist / 1100, 4, 9), lift: MathUtils.clamp(dist * 0.1, 45, 320), heading: Math.atan2(-(to.x - from.x), -(to.z - from.z)) };
    this.keys.clear();
    this.stick = null;
    if (this.names[k]) {
      this.dest.textContent = this.names[k];
      this.dest.hidden = false;
      requestAnimationFrame(() => this.dest.classList.add('shown'));
    }
  }

  fly(dt) {
    const f = this.flight;
    f.t = Math.min(1, f.t + dt / f.dur);
    const e = f.t * f.t * f.t * (f.t * (f.t * 6 - 15) + 10);
    const x = MathUtils.lerp(f.from.x, f.to.x, e), z = MathUtils.lerp(f.from.z, f.to.z, e);
    const arc = Math.sin(Math.PI * e);
    const clear = this.meshHeight(x, z) + EYE + 35 * arc;
    this.pos.set(x, 0, z);
    this.y = Math.max(MathUtils.lerp(f.from.y, f.to.y, e) + f.lift * arc, clear);
    // Turn to face the way ahead on the climb, look down over the land in flight, and settle
    // into the arrival view on the way down
    const turn = (a, b, t) => a + ((((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI) * t;
    const up = MathUtils.smoothstep(f.t, 0, 0.25), down = MathUtils.smoothstep(f.t, 0.72, 1);
    const cruiseYaw = turn(f.from.yaw, f.heading, up);
    this.yaw = turn(cruiseYaw, f.to.yaw, down);
    this.pitch = MathUtils.lerp(MathUtils.lerp(f.from.pitch, -0.32, up), f.to.pitch, down);
    if (f.t >= 1) {
      this.flight = null;
      this.vy = 0;
      this.dest.classList.remove('shown');
      setTimeout(() => { if (!this.flight) this.dest.hidden = true; }, 700);
    }
  }

  enter(k) {
    this.on = true;
    this.arrive(k);
    this.camera.near = 0.2;
    this.camera.updateProjectionMatrix();
    this.hint.hidden = false;
    requestAnimationFrame(() => this.hint.classList.add('shown'));
    document.body.classList.add('walking');
  }

  leave() {
    this.on = false;
    this.flight = null;
    this.dest.hidden = true;
    this.dest.classList.remove('shown');
    this.keys.clear();
    this.stick = this.look = null;
    if (document.pointerLockElement) document.exitPointerLock();
    this.camera.near = 3;
    this.camera.updateProjectionMatrix();
    this.hint.hidden = true;
    this.hint.classList.remove('shown');
    document.body.classList.remove('walking');
  }

  listen() {
    const ignore = e => e.target.closest?.('button, a, input, .minimap, .debug, .walk-hint, .day-compass');
    window.addEventListener('keydown', e => {
      if (!this.on || e.target.closest?.('input')) return;
      if (/^Digit[1-9]$/.test(e.code) && Number(e.code.slice(5)) <= this.places.length) return this.travel(Number(e.code.slice(5)) - 1);
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('pointerdown', e => {
      if (!this.on || ignore(e)) return;
      if (e.pointerType === 'mouse') {
        if (!document.pointerLockElement) this.canvas.requestPointerLock?.()?.catch?.(() => {});
        this.look = { id: e.pointerId, x: e.clientX, y: e.clientY };
        return;
      }
      if (e.clientX < innerWidth * 0.45 && !this.stick) this.stick = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0 };
      else if (!this.look) this.look = { id: e.pointerId, x: e.clientX, y: e.clientY };
    });
    window.addEventListener('pointermove', e => {
      if (!this.on) return;
      if (document.pointerLockElement === this.canvas && e.pointerType === 'mouse') return this.turn(e.movementX, e.movementY, 0.0022);
      if (this.flight) return;
      if (this.stick?.id === e.pointerId) { this.stick.dx = e.clientX - this.stick.x; this.stick.dy = e.clientY - this.stick.y; }
      if (this.look?.id === e.pointerId) {
        this.turn(e.clientX - this.look.x, e.clientY - this.look.y, e.pointerType === 'mouse' ? 0.004 : 0.006);
        this.look.x = e.clientX;
        this.look.y = e.clientY;
      }
    });
    const end = e => {
      if (this.stick?.id === e.pointerId) this.stick = null;
      if (this.look?.id === e.pointerId) this.look = null;
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  turn(dx, dy, k) {
    this.yaw -= dx * k;
    this.pitch = MathUtils.clamp(this.pitch - dy * k, -1.35, 1.35);
  }

  update(dt, time) {
    if (this.flight) {
      this.fly(dt);
      this.camera.position.set(this.pos.x, this.y, this.pos.z);
      this.camera.quaternion.setFromEuler(this.euler.set(this.pitch, this.yaw, 0));
      return;
    }
    const k = this.keys, has = (...c) => c.some(x => k.has(x));
    let fwd = (has('KeyW', 'ArrowUp') ? 1 : 0) - (has('KeyS', 'ArrowDown') ? 1 : 0);
    let side = (has('KeyD') ? 1 : 0) - (has('KeyA') ? 1 : 0);
    this.yaw += ((has('ArrowLeft') ? 1 : 0) - (has('ArrowRight') ? 1 : 0)) * dt * 1.8;
    if (this.stick) {
      const r = Math.min(1, Math.hypot(this.stick.dx, this.stick.dy) / 60);
      const a = Math.atan2(this.stick.dx, -this.stick.dy);
      fwd = Math.cos(a) * r;
      side = Math.sin(a) * r;
    }
    const len = Math.hypot(fwd, side);
    if (len > 1) { fwd /= len; side /= len; }
    const speed = has('ShiftLeft', 'ShiftRight') ? 12 : 4.5;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const mx = (-sy * fwd + cy * side) * speed * dt, mz = (-cy * fwd - sy * side) * speed * dt;
    const near = this.nearest();
    // Near a settlement not yet surveyed, its survey gets a bigger share of each frame
    if (near.distance < 400) this.step(10, near.index);
    const foot = this.y - EYE;
    if (this.free(this.pos.x + mx, this.pos.z, foot)) this.pos.x += mx;
    if (this.free(this.pos.x, this.pos.z + mz, foot)) this.pos.z += mz;

    const ground = this.standAt(this.pos.x, this.pos.z, foot) + EYE;
    if (has('Space') && this.y <= ground + 0.01) this.vy = 4.2;
    this.vy -= 12 * dt;
    this.y += this.vy * dt;
    if (this.y <= ground) {
      this.y = Math.max(ground, this.y + (ground - this.y) * Math.min(1, dt * 14));
      this.vy = 0;
    }
    const moving = Math.hypot(mx, mz) / Math.max(dt, 1e-3);
    this.bob += moving * dt * 1.9;
    const bob = Math.sin(this.bob) * Math.min(1, moving / 4) * 0.035;

    let turnDay = (has('BracketRight') ? 1 : 0) - (has('BracketLeft') ? 1 : 0);
    if (turnDay) this.onTime((((time + turnDay * dt * 0.08) % 1.25) + 1.25) % 1.25);

    this.camera.position.set(this.pos.x, this.y + bob, this.pos.z);
    this.camera.quaternion.setFromEuler(this.euler.set(this.pitch, this.yaw, 0));
  }
}
