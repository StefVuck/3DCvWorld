import { drawArms, drawLogo, loadImage } from './world/heraldry.js';
import { WORLD } from './world-config.js';

function el(tag, props = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'text') n.textContent = v;
    else if (k === 'class') n.className = v;
    else n.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c) n.append(c);
  return n;
}

function shield(seed, w = 40, h = 48, logo = null) {
  const c = el('canvas', { class: 'arms', width: w * 2, height: h * 2, 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  ctx.scale(2, 2);
  ctx.beginPath();
  ctx.moveTo(1, 1); ctx.lineTo(w - 1, 1); ctx.lineTo(w - 1, h * 0.55);
  ctx.quadraticCurveTo(w - 1, h * 0.88, w / 2, h - 1);
  ctx.quadraticCurveTo(1, h * 0.88, 1, h * 0.55);
  ctx.closePath();
  const outline = new Path2D();
  outline.moveTo(1, 1); outline.lineTo(w - 1, 1); outline.lineTo(w - 1, h * 0.55);
  outline.quadraticCurveTo(w - 1, h * 0.88, w / 2, h - 1);
  outline.quadraticCurveTo(1, h * 0.88, 1, h * 0.55);
  outline.closePath();
  const edge = () => { ctx.strokeStyle = 'rgba(47,42,34,0.7)'; ctx.lineWidth = 1.2; ctx.stroke(outline); };
  ctx.save();
  ctx.clip(outline);
  if (logo) {
    ctx.fillStyle = logo.field ?? '#f6f0e2';
    ctx.fillRect(0, 0, w, h);
    loadImage(logo.src).then(img => {
      ctx.save();
      ctx.clip(outline);
      drawLogo(ctx, img, 0, 0, w, h, logo);
      ctx.restore();
      edge();
    }).catch(() => {});
  } else drawArms(ctx, 0, 0, w, h, seed);
  ctx.restore();
  edge();
  return c;
}

function pennant(seed, w = 34, h = 22) {
  const c = el('canvas', { class: 'pennant', width: w * 2, height: h * 2, 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  ctx.scale(2, 2);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(w, h / 2); ctx.lineTo(0, h);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  drawArms(ctx, 0, 0, w, h, seed);
  ctx.restore();
  return c;
}

// A pencilled note in the margin of an entry, pointing to something written about it
function notes(cv, at) {
  return (cv.writings || []).filter(w => w.at === at).map(w => el('aside', { class: 'margin-note', 'data-link': `writing:${w.id}` }, [
    el('span', { class: 'note-lead', text: 'I wrote about this:' }),
    link(w.url, w.title),
    el('span', { class: 'note-time', text: `${w.minutes} min read` }),
  ]));
}

const link = (href, text) => (href ? el('a', { href, target: href.startsWith('mailto:') ? '_self' : '_blank', rel: 'noopener', text }) : document.createTextNode(text));

const regionNames = typeof Intl !== 'undefined' && Intl.DisplayNames ? new Intl.DisplayNames(['en-GB'], { type: 'region' }) : null;
const NAMES = { HK: 'Hong Kong', BA: 'Bosnia and Herzegovina', VA: 'Vatican City' };
const countryName = code => NAMES[code] ?? (regionNames ? regionNames.of(code) : code);

export const RENDER = {
  hero(cv) {
    return [
      el('p', { class: 'kicker', text: cv.location }),
      el('h1', { text: cv.name }),
      el('p', { class: 'title', text: cv.title }),
      el('p', { class: 'tagline', text: cv.tagline }),
      el('p', { class: 'cue', text: 'Scroll to set out down the valley' }),
    ];
  },

  about(cv) {
    return (cv.about || []).map(p => el('p', { text: p }));
  },

  education(cv) {
    return (cv.education || []).map(e => el('article', { class: 'entry' }, [
      el('header', {}, [
        el('h3', {}, link(e.link, e.degree)),
        el('p', { class: 'meta', text: `${e.institution} · ${e.period}` }),
      ]),
      e.notes ? el('p', { text: e.notes }) : null,
    ]));
  },

  experience(cv) {
    return (cv.experience || []).map((j, i) => el('article', { class: 'entry with-arms', 'data-link': `job:${i}` }, [
      shield(j.org, 40, 48, j.logo),
      el('div', {}, [
        el('header', {}, [
          el('h3', { text: j.role }),
          el('p', { class: 'meta', text: `${j.org} · ${j.place} · ${j.period}` }),
        ]),
        j.points?.length ? el('ul', {}, j.points.map(p => el('li', { text: p }))) : null,
        ...notes(cv, `job:${j.role}`),
      ]),
    ]));
  },

  skills(cv) {
    return [el('div', { class: 'stalls' }, (cv.skills || []).map((s, i) => el('section', { class: 'stall', 'data-link': `skill:${i}` }, [
      el('h3', {}, [pennant(s.group), document.createTextNode(s.group)]),
      el('ul', { class: 'wares' }, s.items.map((item, k) => el('li', { text: item, 'data-ware': `ware:${i}:${k}`, tabindex: '0' }))),
      ...notes(cv, `skill:${s.group}`),
    ])))];
  },

  projects(cv) {
    return [
      el('p', { class: 'lede', text: 'Open a project to read about it; the first six have workshops by the river.' }),
      el('div', { class: 'workshops' }, (cv.projects || []).map((p, i) => el('details', { class: 'project', 'data-link': `project:${i}` }, [
        el('summary', {}, [
          el('span', { class: 'name', text: p.name }),
          p.status === 'building' ? el('span', { class: 'badge', text: 'Building' }) : null,
          el('span', { class: 'meta', text: [p.period, (p.tags || []).slice(0, 3).join(', ')].filter(Boolean).join(' · ') }),
        ]),
        el('p', { text: p.description }),
        p.note ? el('p', { class: 'note', text: p.note }) : null,
        p.link ? el('p', {}, [link(p.link, 'Visit the project')]) : null,
      ]))),
    ];
  },

  interests(cv) {
    return (cv.interests || []).map(i => el('article', { class: 'entry' }, [
      el('h3', { text: i.title }),
      i.items
        ? el('ul', { class: 'honours' }, i.items.map(([name, what]) => el('li', {}, [el('span', { class: 'name', text: name }), el('span', { text: what })])))
        : el('p', { text: i.text }),
      ...(i.items ? notes(cv, 'competitions') : []),
    ]));
  },

  travel(cv) {
    const t = cv.travel || { visited: [], wishlist: [] };
    const names = list => list.map(code => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name, 'en-GB'));
    const item = c => el('li', { text: c.name, 'data-code': c.code, tabindex: '0' });
    return [
      el('p', { class: 'lede', text: `${t.visited.length} countries so far, and ${t.wishlist.length} still on the chart.` }),
      el('h3', { text: 'Visited' }),
      el('ul', { class: 'countries visited' }, names(t.visited).map(item)),
      el('h3', { text: 'Still to come' }),
      el('ul', { class: 'countries wishlist' }, names(t.wishlist).map(item)),
    ];
  },

  contact(cv) {
    const c = cv.contact || {};
    return [
      c.blurb ? el('p', { text: c.blurb }) : null,
      el('ul', { class: 'links' }, (c.links || []).map(l => el('li', { 'data-link': 'lighthouse' }, [el('span', { class: 'label', text: l.label }), link(l.href, l.text)]))),
      el('p', { class: 'farewell', text: 'Fair winds, traveller.' }),
      WORLD.walk ? el('button', { class: 'explore', type: 'button', text: 'Explore more on foot' }) : null,
      el('p', { class: 'visitors small', hidden: '' }),
      el('p', { class: 'small', text: `${cv.name} · ${new Date().getFullYear()}` }),
    ];
  },
};

const visitLabel = { job: 'Visit the hall', project: 'Visit the workshop', skill: 'Visit the stall', writing: 'Find it' };

function addVisits(root, cv) {
  const limits = { job: 6, project: Math.min(6, (cv.projects || []).length), skill: 8, writing: Infinity };
  root.querySelectorAll('[data-link]').forEach(n => {
    const [kind, i] = n.dataset.link.split(':');
    if (!visitLabel[kind] || Number(i) >= limits[kind]) return;
    const btn = el('button', { class: 'visit', type: 'button', text: visitLabel[kind] });
    // A note's own button goes on the note; an entry's button stays ahead of any notes in it
    if (kind === 'writing') return n.append(btn);
    const host = n.querySelector('summary') ?? n.querySelector('header') ?? n;
    const note = host === n ? n.querySelector(':scope > .margin-note') : null;
    if (note) n.insertBefore(btn, note);
    else host.append(btn);
  });
}

export function buildPanels(container, stops, cv) {
  stops.forEach((s, i) => {
    if (i > 0) container.append(el('div', { class: 'passage', 'aria-hidden': 'true' }));
    const panel = el('article', { class: `panel side-${s.side}` }, [
      s.id === 'hero' ? null : el('p', { class: 'place', text: s.placeName }),
      s.id === 'hero' ? null : el('h2', { text: s.title }),
      ...RENDER[s.id](cv),
    ]);
    container.append(el('section', { class: `stop stop-${s.id}`, id: `stop-${s.id}`, 'aria-label': s.title }, panel));
  });
  addVisits(container, cv);
}
