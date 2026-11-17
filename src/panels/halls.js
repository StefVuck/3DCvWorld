import { el, shield, notes, visit } from './kit.js';

// Jobs, each with a coat of arms (or a logo). Pairs with the town place kit, which raises a
// guild hall for each of the first six. Content: a list of
// { role, org, place, period, points, logo, trade }.
export default function halls(stop, cv) {
  return [].concat(stop.content ?? []).map((j, i) => el('article', { class: 'entry with-arms', 'data-link': `${stop.id}:${i}` }, [
    shield(j.org, 40, 48, j.logo),
    el('div', {}, [
      el('header', {}, [
        el('h3', { text: j.role }),
        el('p', { class: 'meta', text: [j.org, j.place, j.period].filter(Boolean).join(' · ') }),
        visit('Visit the hall'),
      ]),
      j.points?.length ? el('ul', {}, j.points.map(p => el('li', { text: p }))) : null,
      ...notes(cv, `${stop.id}:${j.role}`),
    ]),
  ]));
}
