import { Vector3 } from 'three';
import { anchors } from './world/links.js';
import { STOPS } from './journey.js';
import { KITS } from './world/places/index.js';

// On foot, the people of the valley tell you what the panels would: walk up to a guild hall,
// a stall or a workshop and whoever stands there talks about it, a sentence at a time.

const sentences = text => (text || '').split(/(?<=[.!?])\s+/).filter(Boolean);

// Built-in tellers for the built-in place kits. A kit of your own can export `speakers(h)`
// instead (see docs/STOPS.md); any other stop gets a local who reads its panel's text.
const BUILT_IN = {
  watchtower: (stop, h) => h.add(h.at(-10, 6), 'The watchman', [
    `This is the valley of ${h.cv.name}.`,
    ...(h.cv.title ? [`${h.cv.title} by trade.`] : []),
    h.cv.tagline,
    'Follow the road south and every place will tell you a little more.',
  ]),
  homestead: (stop, h) => h.add(h.at(-2.5, 1.2), h.cv.name, [].concat(stop.content ?? []).filter(x => typeof x === 'string').flatMap(sentences)),
  abbey: (stop, h) => [].concat(stop.content ?? []).forEach((e, i) => h.add(h.at(42 - i * 6, 10 + i * 4), i ? 'An old schoolmaster' : 'Brother at the abbey', [
    `${h.N} studied here: ${[e.title, ...[].concat(e.meta ?? [])].filter(Boolean).join(', ')}.`,
    ...sentences(e.text),
  ])),
  town: (stop, h) => [].concat(stop.content ?? []).forEach((job, i) => h.add(anchors.get(`${stop.id}:${i}`)?.pos, `Of the ${job.org} hall`, [
    `${job.role} at ${job.org}${job.period ? `, ${job.period}` : ''}${job.place === 'Remote' ? ', working remotely' : job.place ? `, in ${job.place}` : ''}.`,
    ...(job.points || []).flatMap(sentences),
    ...h.said(`${stop.id}:${job.role}`),
  ])),
  fair: (stop, h) => [].concat(stop.content ?? []).forEach((s, i) => h.add(anchors.get(`${stop.id}:${i}`)?.pos, `The ${s.trade || 'stallholder'}`, [
    `${s.group}, finest in the valley!`,
    `${s.items.slice(0, -1).join(', ')}${s.items.length > 1 ? ' and ' : ''}${s.items[s.items.length - 1]}.`,
    ...h.said(`${stop.id}:${s.group}`),
  ])),
  mills: (stop, h) => [].concat(stop.content ?? []).forEach((p, i) => h.add(anchors.get(`${stop.id}:${i}`)?.pos, 'A millwright', [
    `This is ${p.name}${p.period ? `, ${p.period}` : ''}.`,
    ...sentences(p.description),
    ...(p.status === 'building' ? ['Still building it, as you can see from the scaffolding.'] : []),
  ])),
  // Each interest is told by someone at the harbour; a list of honours by the innkeeper
  harbour: (stop, h) => {
    const all = [].concat(stop.content ?? []);
    const tellers = [[2, 59, 'The fiddler'], [-10, 72, 'A ferryman'], [14, 66, 'A fisherman'], [-16, 62, 'A boatwright']];
    all.filter(x => !x.items).slice(0, tellers.length).forEach((x, k) => {
      const [px, pz, who] = tellers[k];
      h.add(h.at(px, pz), who, [`${h.N} told me about ${String(x.title).toLowerCase()} once.`, ...sentences(x.text)]);
    });
    const honours = all.find(x => x.items);
    if (honours) h.add(h.at(-2.2, 22.7), 'The innkeeper', ['A trophy on the shelf for every one of them:', ...honours.items.map(([what, how]) => `${what}: ${how}.`), ...h.said(`${stop.id}:${honours.title}`)]);
  },
};

// What a panel says, as sentences, for a stop with no teller of its own
function readAloud(content) {
  return [].concat(content ?? []).flatMap(x => (typeof x === 'string' ? sentences(x) : x && typeof x === 'object' ? [x.title ?? x.name ?? x.role ?? x.group, x.text ?? x.description].filter(Boolean).flatMap(sentences) : []));
}

function speakers(cv, places, meshHeight) {
  const list = [];
  const add = (pos, who, lines) => {
    lines = (lines ?? []).filter(Boolean);
    if (!pos || !lines.length) return;
    list.push({ pos: pos.clone().setY(meshHeight(pos.x, pos.z) + 2.3), who, lines });
  };
  const said = at => (cv.writings || []).filter(w => w.at === at).map(w => w.said).filter(Boolean);
  for (const stop of STOPS) {
    const built = places.find(p => p.kit === stop.kit);
    const h = { cv, N: cv.shortName, add, said, sentences, anchors, at: (x, z) => built?.place.point(x, 0, z) };
    if (KITS[stop.kit]?.speakers) KITS[stop.kit].speakers(stop, h);
    else if (BUILT_IN[stop.kit]) BUILT_IN[stop.kit](stop, h);
    else if (built) add(h.at(0, 8), 'A local', readAloud(stop.content));
  }
  // At the harbour, a sailor points the way to the last stop
  const harbour = places.find(p => p.kit === 'harbour'), contact = STOPS.find(s => s.panel === 'contact');
  if (harbour && contact?.content?.blurb) add(harbour.place.point(8, 0, 72), 'A sailor', [...sentences(contact.content.blurb), `You can find ${cv.shortName} at the end of the journey.`]);
  return list;
}

export class Talk {
  constructor({ camera, cv, places, meshHeight }) {
    this.camera = camera;
    this.list = speakers(cv, places, meshHeight);
    this.el = document.createElement('figure');
    this.el.className = 'speech';
    this.el.hidden = true;
    this.el.innerHTML = '<figcaption></figcaption><blockquote></blockquote>';
    document.body.append(this.el);
    this.current = null;
    this.line = 0;
    this.left = 0;
    this.v = new Vector3();
    this.fwd = new Vector3();
  }

  say() {
    const s = this.current;
    this.el.querySelector('figcaption').textContent = s.who;
    this.el.querySelector('blockquote').textContent = s.lines[this.line];
    this.left = 2.2 + s.lines[this.line].length * 0.05;
  }

  hide() {
    this.current = null;
    this.el.classList.remove('shown');
    this.el.hidden = true;
  }

  update(dt, on) {
    if (!on) { if (this.current) this.hide(); return; }
    const cam = this.camera.position;
    this.camera.getWorldDirection(this.fwd);
    let best = null, bd = 11;
    for (const s of this.list) {
      const d = s.pos.distanceTo(cam);
      if (d < bd && this.v.copy(s.pos).sub(cam).normalize().dot(this.fwd) > 0.35) { bd = d; best = s; }
    }
    if (best !== this.current) {
      // Keep talking a moment longer to someone just out of view, so a glance away does not cut them off
      if (!best && this.current && this.current.pos.distanceTo(cam) < 14) best = this.current;
      else if (best) {
        this.current = best;
        this.line = 0;
        this.say();
        this.el.hidden = false;
        requestAnimationFrame(() => this.el.classList.add('shown'));
      } else return this.hide();
    }
    if (!this.current) return;
    this.left -= dt;
    if (this.left <= 0) {
      this.line = (this.line + 1) % this.current.lines.length;
      this.say();
    }
    const p = this.v.copy(this.current.pos).project(this.camera);
    const visible = p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1;
    this.el.style.opacity = visible ? '' : '0';
    const x = Math.min(innerWidth - 170, Math.max(170, (p.x + 1) / 2 * innerWidth));
    const y = Math.max(90, (1 - p.y) / 2 * innerHeight);
    this.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  }
}
