#!/usr/bin/env node
// `npm run check`: reads world.config.js and points out anything that will not show up the way
// you might expect. It never changes the file.

import { access, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { exit } from 'node:process';
import { TRADES } from './lib.mjs';
import { SITE_DEFAULTS, SEA } from '../src/journey/sites.js';

const root = resolve(import.meta.dirname, '..');
const path = resolve(root, 'world.config.js');
let config;
try {
  await access(path);
  config = (await import(pathToFileURL(path).href)).default;
} catch (e) {
  console.error(`Could not load world.config.js: ${e.message}`);
  exit(1);
}

const problems = [], notes = [];
const hex = c => typeof c === 'string' && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(c);
const flag = (name, f) => {
  if (f == null) return;
  if (f.stripes) { if (!f.stripes.length || !f.stripes.every(hex)) problems.push(`${name}: stripes should be a list of hex colours`); }
  else if (!hex(f.field ?? f.plain)) problems.push(`${name}: needs \`field\` (or \`plain\`) as a hex colour`);
  if ((f.cross && !hex(f.cross)) || (f.saltire && !hex(f.saltire))) problems.push(`${name}: the cross colour should be a hex colour`);
};

if (!config.person?.name) problems.push('person.name is empty');

// The journey: ids, place kits and panel layouts that exist, each settlement used once
const kits = (await readdir(resolve(root, 'src/world/places'))).filter(f => f.endsWith('.js') && !['index.js', 'place.js', 'folk.js'].includes(f)).map(f => f.slice(0, -3));
const layouts = (await readdir(resolve(root, 'src/panels'))).filter(f => f.endsWith('.js') && f !== 'kit.js').map(f => f.slice(0, -3));
const journey = (config.journey ?? []).filter(s => s && s.show !== false);
if (!journey.length) problems.push('the journey has no stops');
const ids = new Set(), placesUsed = new Map(), entries = new Set();
journey.forEach((s, i) => {
  const name = `journey stop ${i + 1}${s.id ? ` ("${s.id}")` : ''}`;
  if (!s.id || !/^[a-z][a-z0-9-]*$/.test(s.id)) problems.push(`${name}: needs an \`id\` of lower-case letters, digits and dashes`);
  if (ids.has(s.id)) problems.push(`${name}: another stop has the same id`);
  ids.add(s.id);
  if (s.place && !kits.includes(s.place) && !SEA.has(s.place)) problems.push(`${name}: no place kit "${s.place}" (have ${[...kits, ...SEA].join(', ')})`);
  if (s.place && !SEA.has(s.place)) {
    if (placesUsed.has(s.place)) problems.push(`${name}: the place "${s.place}" is already used by "${placesUsed.get(s.place)}"`);
    placesUsed.set(s.place, s.id);
    if (!SITE_DEFAULTS[s.place] && !s.site) problems.push(`${name}: "${s.place}" is a new place, so it needs a \`site\` ({ z, offset, r })`);
  }
  if (!layouts.includes(s.panel ?? 'prose')) problems.push(`${name}: no panel layout "${s.panel}" (have ${layouts.join(', ')})`);
  const list = Array.isArray(s.content) ? s.content : [];
  // What the built-in place kits read, and how many of them get a building
  if (s.place === 'town') {
    list.forEach((j, k) => { if (j.trade && !TRADES.job.includes(j.trade)) problems.push(`${s.id}[${k}] (${j.org}): unknown trade "${j.trade}"; use one of ${TRADES.job.join(', ')}`); });
    if (list.length > 6) notes.push(`${s.id}: ${list.length} jobs, but only the first 6 get a guild hall`);
  }
  if (s.place === 'fair') {
    list.forEach((g, k) => { if (g.trade && !TRADES.skill.includes(g.trade)) problems.push(`${s.id}[${k}] (${g.group}): unknown trade "${g.trade}"; use one of ${TRADES.skill.join(', ')}`); });
    if (list.length > 8) notes.push(`${s.id}: ${list.length} skill groups, but only the first 8 get a stall`);
  }
  if (s.place === 'mills') {
    list.forEach((p, k) => { if (p.emblem && !TRADES.emblem.includes(p.emblem)) problems.push(`${s.id}[${k}] (${p.name}): unknown emblem "${p.emblem}"; use one of ${TRADES.emblem.join(', ')}`); });
    if (list.length > 6) notes.push(`${s.id}: ${list.length} projects, but only the first 6 get a workshop`);
  }
  if (s.panel === 'globe') {
    const codes = [...(s.content?.visited ?? []), ...(s.content?.wishlist ?? [])].filter(c => !/^[A-Z]{2}$/.test(c));
    if (codes.length) problems.push(`${s.id}: these are not two-letter country codes: ${codes.join(', ')}`);
  }
  for (const e of list) for (const key of ['title', 'name', 'role', 'group']) if (e?.[key]) entries.add(`${s.id}:${e[key]}`);
});
// The settlements must not sit on top of one another
const sites = journey.filter(s => s.place && !SEA.has(s.place)).map(s => ({ id: s.id, ...SITE_DEFAULTS[s.place], ...(s.site ?? {}) }));
for (let i = 0; i < sites.length; i++) for (let k = i + 1; k < sites.length; k++) {
  const a = sites[i], b = sites[k];
  if (Math.hypot(a.z - b.z, a.offset - b.offset) < (a.r ?? 50) + (b.r ?? 50) + 120) problems.push(`"${a.id}" and "${b.id}" stand too close together; move one with \`site.z\` or \`site.offset\``);
}
// Settlements met out of valley order send the camera back up the valley between them
for (let i = 1; i < sites.length; i++) if (sites[i].z < sites[i - 1].z) notes.push(`"${sites[i].id}" stands further up the valley than "${sites[i - 1].id}", which comes before it, so the camera flies back up between them`);
(config.writings ?? []).forEach(w => {
  if (!w.at) notes.push(`writing "${w.title}" has no \`at\`, so it is not shown anywhere yet`);
  else if (!entries.has(w.at)) problems.push(`writing "${w.title}": \`at\` is "${w.at}", which matches no entry (use a stop's id, a colon and an entry's title, name, role or group)`);
});
const wld = config.world ?? {};
for (const [k, f] of Object.entries(wld.flags ?? {})) flag(`world.flags.${k}`, f);
const seasons = ['calendar', 'spring', 'summer', 'autumn', 'winter', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
if (wld.season && !seasons.includes(String(wld.season).toLowerCase())) problems.push(`world.season "${wld.season}" is not 'calendar', a season or a month`);
if (!config.site?.url) notes.push('site.url is empty: link previews will not show an image until it is set');

for (const p of problems) console.log(`\x1b[31m✗\x1b[0m ${p}`);
for (const n of notes) console.log(`\x1b[33m•\x1b[0m ${n}`);
if (!problems.length) console.log(`\x1b[32m✓\x1b[0m world.config.js looks good${notes.length ? ' (see the notes above)' : ''}.`);
exit(problems.length ? 1 : 0);
