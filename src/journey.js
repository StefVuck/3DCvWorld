import { Vector3, Quaternion, Matrix4, MathUtils } from 'three';
import { STOP_SPECS, ACTIVE_PLACES } from './journey/config.js';
import { REFLECTIVE } from './journey/sites.js';

// The stops of the journey, from world.config.js. `place` is the index of the settlement the stop
// visits among those built (in the order they are met), and the two stops at sea are told apart by
// `view`. `kit` names the place kit and `panel` the layout that shows the stop's content.
export const STOPS = STOP_SPECS.map(s => ({
  ...s,
  kit: s.place,
  place: s.place && ACTIVE_PLACES.includes(s.place) ? ACTIVE_PLACES.indexOf(s.place) : undefined,
  view: s.place === 'ship' ? 'voyage' : s.place === 'coast' ? 'coast' : undefined,
  reflect: REFLECTIVE.has(s.place),
}));
export const stopIndex = id => STOPS.findIndex(s => s.id === id);
export const stopOfKit = kit => STOPS.find(s => s.kit === kit);

const UP = new Vector3(0, 1, 0);
const m4 = new Matrix4();

function orient(pos, look, out = new Quaternion()) {
  m4.lookAt(pos, look, UP);
  return out.setFromRotationMatrix(m4);
}

const smoother = t => t * t * t * (t * (t * 6 - 15) + 10);

export class Journey {
  constructor(stops, views, groundAt) {
    this.stops = stops;
    this.portrait = false;
    this.views = views.map(v => ({ basePos: v.pos.clone(), baseLook: v.look.clone(), subject: v.subject?.clone() ?? null, frame: v.frame ?? 0.42, pos: v.pos.clone(), look: v.look.clone(), quat: new Quaternion() }));
    this.views.forEach(v => this.fit(v));
    this.groundAt = groundAt;
    this.ranges = [];
    this.clock = 0;
  }

  setView(i, pos, look, subject) {
    const v = this.views[i];
    v.basePos.copy(pos);
    v.baseLook.copy(look);
    if (subject) (v.subject ??= new Vector3()).copy(subject);
    this.fit(v);
  }

  // Wide screens use the authored view, with the place beside the panel. On a tall, narrow
  // screen the panel sits in the lower half, so the camera backs off and centres the place
  // in the upper half instead (or the lower half, for the title).
  setPortrait(on, fov) {
    this.portrait = on;
    this.fov = fov;
    this.views.forEach(v => this.fit(v));
  }

  fit(v) {
    if (!this.portrait || !v.subject) {
      v.pos.copy(v.basePos);
      v.look.copy(v.baseLook);
    } else {
      const s = v.subject;
      v.pos.copy(s).addScaledVector(v.basePos.clone().sub(s), 1.3);
      v.pos.y = Math.max(v.pos.y, v.basePos.y);
      const dist = v.pos.distanceTo(s);
      v.look.copy(s);
      v.look.y -= dist * Math.tan(MathUtils.degToRad(this.fov / 2)) * v.frame;
    }
    orient(v.pos, v.look, v.quat);
  }

  measure() {
    const vh = window.innerHeight;
    const y0 = window.scrollY;
    this.tops = this.stops.map(s => document.getElementById(`stop-${s.id}`).getBoundingClientRect().top + y0);
    this.bottoms = this.stops.map((s, i) => this.tops[i] + document.getElementById(`stop-${s.id}`).offsetHeight);
    this.ranges = this.stops.map((s, i) => ({
      start: i === 0 ? 0 : this.tops[i] - vh * 0.5,
      end: this.bottoms[i] - vh * 0.5,
    }));
  }

  locate(y) {
    const r = this.ranges;
    for (let i = 0; i < r.length; i++) {
      if (y <= r[i].end || i === r.length - 1) {
        if (i > 0 && y < r[i].start) {
          const t = (y - r[i - 1].end) / Math.max(1, r[i].start - r[i - 1].end);
          return { i: i - 1, t: MathUtils.clamp(t, 0, 1), travel: true, drift: 1 };
        }
        const drift = MathUtils.clamp((y - r[i].start) / Math.max(1, r[i].end - r[i].start), 0, 1);
        return { i, t: 0, travel: false, drift };
      }
    }
    return { i: 0, t: 0, travel: false, drift: 0 };
  }

  scrollTarget(i) {
    return i === 0 ? 0 : this.tops[i];
  }

  // Where scrolling may come to rest: each stop's anchor, or anywhere within a stop taller than the screen
  rest(i) {
    const lo = this.scrollTarget(i);
    return [lo, Math.max(lo, this.bottoms[i] - window.innerHeight)];
  }

  snapTarget(y, dir) {
    const n = this.stops.length;
    for (let i = 0; i < n; i++) {
      const [lo, hi] = this.rest(i);
      if (y < lo - 1) {
        const prev = i > 0 ? this.rest(i - 1)[1] : lo;
        const nudge = window.innerHeight * 0.06;
        if (dir > 0) return y - prev > nudge ? lo : prev;
        return lo - y > nudge ? prev : lo;
      }
      if (y <= hi + 1) return null;
    }
    return this.rest(n - 1)[1];
  }

  dwellPose(i, drift, out) {
    const v = this.views[i];
    const a = (drift - 0.5) * 0.16;
    const toLook = v.look.clone().sub(v.pos);
    const pivot = v.pos.clone().addScaledVector(toLook.clone().normalize(), Math.min(toLook.length(), 60));
    const off = v.pos.clone().sub(pivot);
    off.applyAxisAngle(UP, a).multiplyScalar(1 - drift * 0.05);
    out.pos.copy(pivot).add(off);
    out.pos.y += (drift - 0.5) * 2;
    const k = this.clock, amp = MathUtils.clamp(toLook.length() * 0.012, 0.1, 2.2);
    out.pos.x += Math.sin(k * 0.23) * amp;
    out.pos.y += Math.sin(k * 0.31 + 1.3) * amp * 0.45;
    out.pos.z += Math.cos(k * 0.19 + 0.4) * amp;
    toLook.applyAxisAngle(UP, Math.sin(k * 0.13) * 0.012);
    toLook.y += Math.sin(k * 0.17 + 2) * 0.006 * toLook.length();
    orient(out.pos, out.pos.clone().add(toLook), out.quat);
    out.time = this.stops[i].time + (drift - 0.5) * 0.025;
    return out;
  }

  pose(loc, out = { pos: new Vector3(), quat: new Quaternion(), time: 0 }) {
    if (!loc.travel) return this.dwellPose(loc.i, loc.drift, out);
    const A = this.dwellPose(loc.i, 1, { pos: new Vector3(), quat: new Quaternion(), time: 0 });
    const B = this.dwellPose(loc.i + 1, 0, { pos: new Vector3(), quat: new Quaternion(), time: 0 });
    const atSea = !!(this.stops[loc.i].view || this.stops[loc.i + 1].view);
    return this.fly(A, B, loc.t, { atSea, from: this.views[loc.i].subject, to: this.views[loc.i + 1].subject }, out);
  }

  // An arcing flight from pose A to pose B, t from 0 to 1. At sea the camera keeps the ship
  // (the subjects) in sight; over land it looks a little ahead along the way.
  fly(A, B, t, { atSea = false, from = null, to = null } = {}, out = { pos: new Vector3(), quat: new Quaternion(), time: 0 }) {
    const e = smoother(t);
    const dist = A.pos.distanceTo(B.pos);
    const h = MathUtils.clamp(dist * 0.1, atSea ? 16 : 30, 320);
    const d = B.pos.clone().sub(A.pos);
    const p1 = A.pos.clone().addScaledVector(d, 0.25).addScaledVector(UP, h);
    const p2 = B.pos.clone().addScaledVector(d, -0.25).addScaledVector(UP, h);
    const bez = s => {
      const u = 1 - s;
      return A.pos.clone().multiplyScalar(u * u * u)
        .addScaledVector(p1, 3 * u * u * s)
        .addScaledVector(p2, 3 * u * s * s)
        .addScaledVector(B.pos, s * s * s);
    };
    out.pos.copy(bez(e));
    const ground = this.groundAt(out.pos.x, out.pos.z);
    const lift = Math.sin(t * Math.PI);
    out.pos.y = Math.max(out.pos.y, (atSea ? Math.max(ground, 0) + 6 : ground + 20 + 40 * lift));

    const ahead = bez(Math.min(1, e + 0.15));
    ahead.y = MathUtils.lerp(out.pos.y, ahead.y, 0.5) - 20;
    const qTravel = orient(out.pos, ahead.distanceToSquared(out.pos) > 1 ? ahead : B.pos);
    const turn = smoother(MathUtils.clamp(t * 1.25 - 0.125, 0, 1));
    out.quat.copy(A.quat).slerp(B.quat, turn);
    if (atSea && to) {
      const target = from ? from.clone().lerp(to, smoother(MathUtils.clamp(t * 3 - 0.15, 0, 1))) : to.clone();
      out.quat.slerp(orient(out.pos, target), Math.pow(lift, 0.6));
    } else {
      out.quat.slerp(qTravel, Math.pow(lift, 2) * 0.4);
    }
    out.time = MathUtils.lerp(A.time, B.time, e);
    return out;
  }
}
