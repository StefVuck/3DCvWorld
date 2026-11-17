import { Vector3 } from 'three';
import { MODE } from './world/people.js';
import { SEASON } from './season.js';
import { shared } from './atmosphere.js';
import { WORLD } from './world-config.js';
import cv from './cv.js';

// On foot, people standing together talk among themselves: short exchanges, a line each in turn,
// about where they are, the time of year and the time of day. A few nod to whose valley it is.

const ANY = [
  ['Fine weather for it.', 'For what?', 'Anything, really.'],
  ['Did you hear about the miller’s cart?', 'Lost a wheel again?', 'Two, this time.'],
  ['Who’s the stranger?', 'A traveller, by the look of them.', 'Another one reading the signposts, I expect.'],
  ['My cousin went to the city.', 'And?', 'Says everyone there is in a hurry to measure something.'],
  ['How are the hens?', 'Laying, mostly.', 'Mostly is good.'],
  ['You look tired.', 'Up all night again.', 'Not another deadline?'],
  ['Have you read the signposts?', 'Every one of them.', 'Then you know more than I do.'],
  ['Where are you off to?', 'Wherever the road goes.', 'It goes to the harbour.', 'Then the harbour.'],
];
// Lines added in world.config.js
ANY.push(...WORLD.chatter.filter(l => Array.isArray(l) && l.length >= 2));

const PLACE = {
  watchtower: [
    ['Anything on the road?', 'A cart, two sheep and a man on a very tall bicycle.', 'Again?'],
    ['Pigeon’s gone to market.', 'What did it carry?', 'Prices. It always carries prices.'],
    ['You can see the whole valley from up here.', 'All the way to the sea, on a clear day.'],
  ],
  homestead: [
    ['The well’s low.', 'It always says that in summer.'],
    [`${cv.shortName}’s in the workshop again.`, 'Soldering?', 'Something with very small wires.'],
    ['Have you fed the chickens?', 'Twice. They lie about it.'],
  ],
  abbey: [
    ['Have you finished the copying?', 'Nearly. The margins took longest.'],
    ['Brother Anselm fell asleep in Compline.', 'He says it was contemplation.'],
    ['The new scholars are arriving.', 'Engineers, the lot of them.', 'Heaven help the bell tower.'],
  ],
  town: [
    ['Prices are up at the market house.', 'Up by how much?', 'They’ll tell you to the microsecond.'],
    ['The crier’s in good voice today.', 'He’s always in good voice. That’s the problem.'],
    ['Seen the master builder’s new crane?', 'The one with the wheel?', 'He walks inside it. Says it’s efficient.'],
    ['The racing lads are at it again.', 'Covered in grease?', 'Head to toe. Won something, though.'],
    ['Who reads all those ledgers?', 'Someone has to.', 'Someone who likes columns.'],
    ['Mind the cart!', 'I am minding it.', 'Mind it from further away.'],
  ],
  fair: [
    ['How much for the clockwork?', 'More than the apothecary’s tonics.', 'Less than the glazier’s windows, I hope.'],
    ['The pedlar sells everything.', 'Everything?', 'Nine languages’ worth of everything.'],
    ['Are you dancing later?', 'Only if the piper plays.'],
    ['Those three in the green tent haven’t slept.', 'They’ve a candle marked in hours.', 'That explains it.'],
    ['Lovely stall.', 'Nicest one here.', 'You say that about all of them.'],
  ],
  mills: [
    ['The wheel’s turning slow.', 'River’s low.', 'Or the wheel’s old.', 'Both, probably.'],
    ['Is that one still under scaffolding?', 'Still building it.', 'They said that last spring.'],
    ['What’s that one make?', 'Something that measures pints, I’m told.', 'Now that’s useful.'],
  ],
  harbour: [
    ['Tide’s turning.', 'Then so am I. Off home.'],
    ['Will the choir sing tonight?', 'They sing every night.', 'Then yes.'],
    ['The ship’s back.', 'Where from this time?', 'Everywhere, by the look of the flags.'],
    ['Another trophy on the inn shelf.', 'It’ll need a second shelf.'],
  ],
};

const SEASONAL = {
  winter: [
    ['Cold enough for you?', 'My boots have frozen to the step.'],
    ['Who built the snowman?', 'The children.', 'Then who gave it my hat?'],
    ['Someone’s skiing up on the tops.', 'In this?', 'Especially in this.'],
  ],
  spring: [
    ['The orchards are in blossom.', 'Bees will be busy.'],
    ['Sowing’s started.', 'Late, if you ask me.', 'Nobody did.'],
  ],
  summer: [
    ['Hay’s in.', 'All of it?', 'Most of it. The rest is in my boots.'],
    ['Too hot to work.', 'Too hot to talk, as well.', '...'],
  ],
  autumn: [
    ['The leaves are turning.', 'And the evenings drawing in.'],
    ['Good harvest?', 'Good enough. The squashes did well.'],
  ],
  bonfire: [
    ['Going to the bonfire?', 'Wouldn’t miss it.', 'Stand upwind this year.'],
    ['Fireworks tonight!', 'Mind the thatch.'],
  ],
  yule: [
    ['Have you seen the tree in the square?', 'Biggest one yet.'],
    ['The carollers are out.', 'Same three songs as last year?', 'Four, this year.'],
  ],
};

const EVENING = [
  ['Getting dark.', 'Lamps are lit at the inn.', 'Then that’s where I’m going.'],
  ['Late to be out.', 'Late’s when it’s quiet.'],
  ['Hear that?', 'The choir, down at the harbour.'],
];

const pick = list => list[Math.floor(Math.random() * list.length)];

export class Chatter {
  constructor({ camera, people }) {
    this.camera = camera;
    const stand = people.list.filter(p => (p.mode === MODE.idle || p.mode === MODE.conduct || p.mode === MODE.work) && PLACE[p.tag]);
    // Pairs of people standing within a few paces of each other in the same place
    this.pairs = [];
    const used = new Set();
    for (const a of stand) {
      if (used.has(a)) continue;
      let best = null, bd = 5.2;
      for (const b of stand) {
        if (b === a || used.has(b) || b.tag !== a.tag) continue;
        const d = Math.hypot(a.a.x - b.a.x, a.a.z - b.a.z);
        if (d < bd) { bd = d; best = b; }
      }
      if (!best) continue;
      used.add(a); used.add(best);
      const head = p => p.a.clone().setY(p.a.y + 2.05 * p.scale);
      this.pairs.push({ heads: [head(a), head(best)], place: a.tag, mid: a.a.clone().lerp(best.a, 0.5) });
    }
    this.active = [];
    this.wait = 1.5;
    this.v = new Vector3();
    this.fwd = new Vector3();
    this.free = Array.from({ length: 2 }, () => {
      const el = document.createElement('p');
      el.className = 'chat';
      el.hidden = true;
      document.body.append(el);
      return el;
    });
  }

  topics(place) {
    const pools = [ANY, PLACE[place], PLACE[place]];
    const m = SEASON.month;
    if (SEASON.winterAmount >= 0.5) pools.push(SEASONAL.winter);
    else if (m >= 2 && m <= 4) pools.push(SEASONAL.spring);
    else if (m >= 5 && m <= 7) pools.push(SEASONAL.summer);
    else pools.push(SEASONAL.autumn);
    if (m === 10) pools.push(SEASONAL.bonfire, SEASONAL.bonfire);
    if (m === 11) pools.push(SEASONAL.yule, SEASONAL.yule);
    if (shared.uWindowGlow.value > 0.5) pools.push(EVENING);
    return pick(pick(pools));
  }

  start(pair) {
    const el = this.free.pop();
    const c = { pair, lines: this.topics(pair.place), i: -1, left: 0, el, first: Math.random() < 0.5 ? 0 : 1 };
    this.active.push(c);
    this.next(c);
  }

  next(c) {
    c.i++;
    if (c.i >= c.lines.length) return false;
    c.el.textContent = c.lines[c.i];
    c.left = 1.6 + c.lines[c.i].length * 0.055;
    c.el.hidden = false;
    c.el.classList.remove('shown');
    requestAnimationFrame(() => c.el.classList.add('shown'));
    return true;
  }

  end(c) {
    c.el.classList.remove('shown');
    const el = c.el;
    setTimeout(() => { if (!this.active.some(a => a.el === el)) el.hidden = true; }, 400);
    this.free.push(el);
    this.active.splice(this.active.indexOf(c), 1);
    this.wait = 1.5 + Math.random() * 3;
  }

  // `quiet` is where the CV speaker is talking, so nobody chatters over them
  update(dt, on, quiet) {
    if (!on) {
      while (this.active.length) this.end(this.active[0]);
      return;
    }
    const cam = this.camera.position;
    this.camera.getWorldDirection(this.fwd);
    for (let n = this.active.length - 1; n >= 0; n--) {
      const c = this.active[n];
      if (c.pair.mid.distanceTo(cam) > 32 || (quiet && c.pair.mid.distanceTo(quiet) < 10)) { this.end(c); continue; }
      c.left -= dt;
      if (c.left <= 0 && !this.next(c)) { this.end(c); continue; }
      const head = c.pair.heads[(c.i + c.first) % 2];
      const p = this.v.copy(head).project(this.camera);
      const seen = p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05;
      c.el.style.opacity = seen ? '' : '0';
      c.el.style.transform = `translate(${(p.x + 1) / 2 * innerWidth}px, ${(1 - p.y) / 2 * innerHeight}px) translate(-50%, -100%)`;
    }
    this.wait -= dt;
    if (this.wait > 0 || !this.free.length) return;
    const near = this.pairs.filter(pr => {
      if (this.active.some(c => c.pair === pr)) return false;
      const d = pr.mid.distanceTo(cam);
      if (d > 24 || d < 2 || (quiet && pr.mid.distanceTo(quiet) < 10)) return false;
      return this.v.copy(pr.mid).sub(cam).normalize().dot(this.fwd) > 0.3;
    });
    if (near.length) this.start(pick(near));
    else this.wait = 0.8;
  }
}
