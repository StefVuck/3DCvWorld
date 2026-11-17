import { el } from './panels/kit.js';

// Every file in src/panels/ (other than kit.js) is a panel layout, found automatically: its file
// name is what a stop uses for `panel`. A layout is a function (stop, cv) returning the nodes
// that go on the stop's panel, under its place name and title. See docs/STOPS.md.
export const LAYOUTS = Object.fromEntries(
  Object.entries(import.meta.glob('./panels/*.js', { eager: true }))
    .map(([path, module]) => [path.slice(9, -3), module.default])
    .filter(([name, render]) => name !== 'kit' && typeof render === 'function'),
);

export function buildPanels(container, stops, cv) {
  stops.forEach((s, i) => {
    const render = LAYOUTS[s.panel];
    if (!render) throw new Error(`world.config.js: stop "${s.id}" uses the panel "${s.panel}", but there is no src/panels/${s.panel}.js`);
    if (i > 0) container.append(el('div', { class: 'passage', 'aria-hidden': 'true' }));
    const welcome = s.panel === 'welcome';
    const panel = el('article', { class: `panel side-${s.side}` }, [
      welcome ? null : el('p', { class: 'place', text: s.placeName }),
      welcome ? null : el('h2', { text: s.title }),
      ...render(s, cv),
    ]);
    container.append(el('section', { class: `stop stop-${s.id} layout-${s.panel}`, id: `stop-${s.id}`, 'aria-label': s.title }, panel));
  });
}

// Visit buttons whose entry has no place in the valley (an entry beyond the sixth hall, or a
// stop whose place kit sets no anchors) are taken away once the valley is built
export function pruneVisits(anchors) {
  document.querySelectorAll('.visit').forEach(btn => {
    const key = btn.closest('[data-link]')?.dataset.link;
    if (!key || !anchors.has(key)) btn.remove();
  });
}
