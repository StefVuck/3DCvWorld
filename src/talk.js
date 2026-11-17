import { Vector3 } from 'three';
import { anchors } from './world/links.js';

// On foot, the people of the valley tell you what the panels would: walk up to a guild hall,
// a stall or a workshop and whoever stands there talks about it, a sentence at a time.

const sentences = text => (text || '').split(/(?<=[.!?])\s+/).filter(Boolean);

function speakers(cv, places, meshHeight) {
  const at = (id, x, z) => places.find(p => p.place.id === id)?.place.point(x, 0, z);
  const list = [];
  // What people say about something written on the subject they are telling you about
  const said = at => (cv.writings || []).filter(w => w.at === at).map(w => w.said).filter(Boolean);
  const add = (pos, who, lines) => {
    if (!pos || !lines.length) return;
    list.push({ pos: pos.clone().setY(meshHeight(pos.x, pos.z) + 2.3), who, lines });
  };

  const N = cv.shortName;
  add(at('watchtower', -10, 6), 'The watchman', [
    `This is the valley of ${cv.name}.`,
    ...(cv.title ? [`${cv.title} by trade.`] : []),
    cv.tagline,
    'Follow the road south and every place will tell you a little more.',
  ]);
  add(at('homestead', -2.5, 1.2), cv.name, cv.about.flatMap(sentences));
  (cv.education || []).forEach((e, i) => add(at('abbey', 42 - i * 6, 10 + i * 4), i ? 'An old schoolmaster' : 'Brother at the abbey', [
    `${N} studied here: ${e.degree}, ${e.institution}, ${e.period}.`,
    ...sentences(e.notes),
  ]));
  (cv.experience || []).forEach((job, i) => {
    const a = anchors.get(`job:${i}`);
    add(a?.pos, `Of the ${job.org} hall`, [
      `${job.role} at ${job.org}, ${job.period}${job.place === 'Remote' ? ', working remotely' : job.place ? `, in ${job.place}` : ''}.`,
      ...(job.points || []).flatMap(sentences),
      ...said(`job:${job.role}`),
    ]);
  });
  (cv.skills || []).forEach((s, i) => {
    const a = anchors.get(`skill:${i}`);
    add(a?.pos, `The ${s.trade || 'stallholder'}`, [
      `${s.group}, finest in the valley!`,
      `${s.items.slice(0, -1).join(', ')}${s.items.length > 1 ? ' and ' : ''}${s.items[s.items.length - 1]}.`,
      ...said(`skill:${s.group}`),
    ]);
  });
  (cv.projects || []).forEach((p, i) => {
    const a = anchors.get(`project:${i}`);
    add(a?.pos, 'A millwright', [
      `This is ${p.name}${p.period ? `, ${p.period}` : ''}.`,
      ...sentences(p.description),
      ...(p.status === 'building' ? ['Still building it, as you can see from the scaffolding.'] : []),
    ]);
  });
  const hobbies = cv.interests || [];
  // Each interest is told by someone at the harbour; a list of honours by the innkeeper, who
  // keeps the trophies
  const comps = hobbies.find(h => h.items);
  const tellers = [[2, 59, 'The choirmaster'], [-10, 72, 'A ferryman'], [14, 66, 'A fisherman'], [-16, 62, 'A boatwright']];
  hobbies.filter(h => !h.items).slice(0, tellers.length).forEach((h, k) => {
    const [x, z, who] = tellers[k];
    add(at('harbour', x, z), who, [`${N} told me about ${h.title.toLowerCase()} once.`, ...sentences(h.text)]);
  });
  if (comps) add(at('harbour', -2.2, 22.7), 'The innkeeper', ['A trophy on the shelf for every one of them:', ...comps.items.map(([what, how]) => `${what}: ${how}.`), ...said('competitions')]);
  if (cv.contact?.blurb) add(at('harbour', 8, 72), 'A sailor', [...sentences(cv.contact.blurb), `You can find ${N} at the end of the journey.`]);
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
