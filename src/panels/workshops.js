import { el, link, visit } from './kit.js';

// Projects that open to read about. Pairs with the mills place kit, where the first six are
// workshops. Content: a list of { name, period, description, tags, link, status, note, emblem }.
export default function workshops(stop) {
  return [
    el('p', { class: 'lede', text: stop.lede ?? 'Open a project to read about it; the first six have workshops by the river.' }),
    el('div', { class: 'workshops' }, [].concat(stop.content ?? []).map((p, i) => el('details', { class: 'project', 'data-link': `${stop.id}:${i}` }, [
      el('summary', {}, [
        el('span', { class: 'name', text: p.name }),
        p.status === 'building' ? el('span', { class: 'badge', text: 'Building' }) : null,
        el('span', { class: 'meta', text: [p.period, (p.tags || []).slice(0, 3).join(', ')].filter(Boolean).join(' · ') }),
        visit('Visit the workshop'),
      ]),
      el('p', { text: p.description }),
      p.note ? el('p', { class: 'note', text: p.note }) : null,
      p.link ? el('p', {}, [link(p.link, 'Visit the project')]) : null,
    ]))),
  ];
}
