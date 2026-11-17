import config from '../../world.config.js';
import { SITE_DEFAULTS, SEA } from './sites.js';

// The journey from world.config.js, checked and filled in. Each stop names the place kit that
// builds it in the valley (`place`), the panel layout that shows it on the page (`panel`) and its
// own `content`, which both of them read. Everything else has a sensible default.

const fail = msg => { throw new Error(`world.config.js: ${msg}`); };
const list = config.journey ?? fail('there is no `journey` list');
if (!list.length) fail('the journey is empty');

const seen = new Set(), places = new Set();
const shown = list.filter(s => s && s.show !== false);
export const STOP_SPECS = shown.map((s, i) => {
  if (!s.id || !/^[a-z][a-z0-9-]*$/.test(s.id)) fail(`stop ${i + 1} needs an \`id\` of lower-case letters, digits and dashes`);
  if (seen.has(s.id)) fail(`two stops have the id "${s.id}"`);
  seen.add(s.id);
  if (s.place && !SEA.has(s.place)) {
    if (places.has(s.place)) fail(`the place "${s.place}" is used by two stops; each settlement can appear once`);
    places.add(s.place);
    if (!SITE_DEFAULTS[s.place] && !s.site) fail(`stop "${s.id}" uses the new place "${s.place}", so it needs a \`site\` ({ z, offset, r })`);
  }
  return {
    id: s.id,
    place: s.place ?? null,
    panel: s.panel ?? 'prose',
    title: s.title ?? s.id[0].toUpperCase() + s.id.slice(1),
    placeName: s.placeName ?? '',
    quote: s.quote?.text ? s.quote : null,
    content: s.content ?? null,
    site: s.site ?? null,
    camera: s.camera ?? null,
    side: s.side ?? (i === 0 ? 'centre' : 'left'),
    // Spread across the day from dawn to nightfall unless a stop sets its own hour (0 to 1)
    time: s.time ?? 0.05 + (shown.length > 1 ? (i / (shown.length - 1)) * 0.78 : 0),
  };
});

// The settlements in the order they are met, which is the order they are built in
export const ACTIVE_PLACES = STOP_SPECS.filter(s => s.place && !SEA.has(s.place)).map(s => s.place);
