#!/usr/bin/env node
// `npm run check`: reads world.config.js and points out anything that will not show up the way
// you might expect. It never changes the file.

import { access } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { exit } from 'node:process';
import { TRADES } from './lib.mjs';

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
const jobs = config.experience ?? [], skills = config.skills ?? [], projects = config.projects ?? [];
jobs.forEach((j, i) => { if (j.trade && !TRADES.job.includes(j.trade)) problems.push(`experience[${i}] (${j.org}): unknown trade "${j.trade}"; use one of ${TRADES.job.join(', ')}`); });
skills.forEach((s, i) => { if (s.trade && !TRADES.skill.includes(s.trade)) problems.push(`skills[${i}] (${s.group}): unknown trade "${s.trade}"; use one of ${TRADES.skill.join(', ')}`); });
projects.forEach((p, i) => { if (p.emblem && !TRADES.emblem.includes(p.emblem)) problems.push(`projects[${i}] (${p.name}): unknown emblem "${p.emblem}"; use one of ${TRADES.emblem.join(', ')}`); });
if (jobs.length > 6) notes.push(`${jobs.length} jobs: all are listed, but only the first 6 get a guild hall`);
if (skills.length > 8) notes.push(`${skills.length} skill groups: only the first 8 get a stall`);
if (projects.length > 6) notes.push(`${projects.length} projects: all are listed, but only the first 6 get a workshop`);
const codes = [...(config.travel?.visited ?? []), ...(config.travel?.wishlist ?? [])];
const bad = codes.filter(c => !/^[A-Z]{2}$/.test(c));
if (bad.length) problems.push(`travel: these are not two-letter country codes: ${bad.join(', ')}`);
const targets = new Set(['competitions', ...skills.map(s => `skill:${s.group}`), ...jobs.map(j => `job:${j.role}`)]);
(config.writings ?? []).forEach(w => {
  if (!w.at) notes.push(`writing "${w.title}" has no \`at\`, so it is not shown anywhere yet`);
  else if (!targets.has(w.at)) problems.push(`writing "${w.title}": \`at\` is "${w.at}", which matches no competition list, skill group or job role`);
});
const wld = config.world ?? {};
for (const [k, f] of Object.entries(wld.flags ?? {})) flag(`world.flags.${k}`, f);
if (wld.dance?.flag) flag('world.dance.flag', wld.dance.flag);
if (wld.dance?.colours && !wld.dance.colours.every(hex)) problems.push('world.dance.colours should all be hex colours');
const seasons = ['calendar', 'spring', 'summer', 'autumn', 'winter', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
if (wld.season && !seasons.includes(String(wld.season).toLowerCase())) problems.push(`world.season "${wld.season}" is not 'calendar', a season or a month`);
if (!config.site?.url) notes.push('site.url is empty: link previews will not show an image until it is set');

for (const p of problems) console.log(`\x1b[31m✗\x1b[0m ${p}`);
for (const n of notes) console.log(`\x1b[33m•\x1b[0m ${n}`);
if (!problems.length) console.log(`\x1b[32m✓\x1b[0m world.config.js looks good${notes.length ? ' (see the notes above)' : ''}.`);
exit(problems.length ? 1 : 0);
