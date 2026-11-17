import { el, countryName } from './kit.js';

// Countries visited and still to come. Pairs with the ship, whose globe lights them up.
// Content: { visited: [codes], wishlist: [codes], alsoShaded: [names] } with ISO codes.
export default function globe(stop) {
  const t = { visited: [], wishlist: [], ...(stop.content ?? {}) };
  const names = list => list.map(code => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name, 'en-GB'));
  const item = c => el('li', { text: c.name, 'data-code': c.code, tabindex: '0' });
  return [
    el('p', { class: 'lede', text: `${t.visited.length} countries so far, and ${t.wishlist.length} still on the chart.` }),
    el('h3', { text: 'Visited' }),
    el('ul', { class: 'countries visited' }, names(t.visited).map(item)),
    ...(t.wishlist.length ? [el('h3', { text: 'Still to come' }), el('ul', { class: 'countries wishlist' }, names(t.wishlist).map(item))] : []),
  ];
}
