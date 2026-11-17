import { el, link, notes, visit } from './kit.js';

// A list of entries, each with a heading and a little detail. Content: a list of
// { title, meta, text, points, link }, where `meta` is a string or a list of strings (shown
// joined by dots) and `points` a list of bullet points. All but `title` are optional.
export default function entries(stop, cv) {
  return [].concat(stop.content ?? []).map((e, i) => el('article', { class: 'entry', 'data-link': `${stop.id}:${i}` }, [
    el('header', {}, [
      el('h3', {}, link(e.link, e.title)),
      e.meta ? el('p', { class: 'meta', text: [].concat(e.meta).filter(Boolean).join(' · ') }) : null,
      visit(stop.visitLabel ?? 'Visit'),
    ]),
    e.text ? el('p', { text: e.text }) : null,
    e.points?.length ? el('ul', {}, e.points.map(p => el('li', { text: p }))) : null,
    ...notes(cv, `${stop.id}:${e.title}`),
  ]));
}
