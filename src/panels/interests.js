import { el, notes } from './kit.js';

// Interests, each a paragraph or a list of honours. Pairs with the harbour place kit, where a
// list of honours becomes trophies by the inn door. Content: a list of { title, text } or
// { title, items: [[name, detail], ...] }.
export default function interests(stop, cv) {
  return [].concat(stop.content ?? []).map(i => el('article', { class: 'entry' }, [
    el('h3', { text: i.title }),
    i.items
      ? el('ul', { class: 'honours' }, i.items.map(([name, what]) => el('li', {}, [el('span', { class: 'name', text: name }), el('span', { text: what })])))
      : el('p', { text: i.text }),
    ...notes(cv, `${stop.id}:${i.title}`),
  ]));
}
