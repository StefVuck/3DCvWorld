import { el, pennant, notes, visit } from './kit.js';

// Skill groups as chips. Pairs with the fair place kit, where each group is a stall and each
// item its own object (hovering an item lifts it). Content: a list of { group, trade, items }.
export default function stalls(stop, cv) {
  return [el('div', { class: 'stalls' }, [].concat(stop.content ?? []).map((s, i) => el('section', { class: 'stall', 'data-link': `${stop.id}:${i}` }, [
    el('h3', {}, [pennant(s.group), document.createTextNode(s.group)]),
    el('ul', { class: 'wares' }, (s.items ?? []).map((item, k) => el('li', { text: item, 'data-ware': `ware:${i}:${k}`, tabindex: '0' }))),
    visit('Visit the stall'),
    ...notes(cv, `${stop.id}:${s.group}`),
  ])))];
}
