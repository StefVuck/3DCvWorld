import { el, link } from './kit.js';
import { WORLD } from '../world-config.js';

// Ways to get in touch, and the way into walking the valley. Hovering a link flashes the
// lighthouse when the stop is at the coast. Content: { blurb, links: [{ label, text, href }] }.
export default function contact(stop, cv) {
  const c = stop.content ?? {};
  return [
    c.blurb ? el('p', { text: c.blurb }) : null,
    el('ul', { class: 'links' }, (c.links || []).map(l => el('li', { 'data-link': 'lighthouse' }, [el('span', { class: 'label', text: l.label }), link(l.href, l.text)]))),
    el('p', { class: 'farewell', text: c.farewell ?? 'Fair winds, traveller.' }),
    WORLD.walk ? el('button', { class: 'explore', type: 'button', text: 'Explore more on foot' }) : null,
    el('p', { class: 'visitors small', hidden: '' }),
    el('p', { class: 'small', text: `${cv.name} · ${new Date().getFullYear()}` }),
  ];
}
