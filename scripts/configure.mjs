#!/usr/bin/env node
// `npm run configure`: builds world.config.js by asking a few questions. It starts from the
// current config (or a JSON Resume file, if you have one), so pressing Enter keeps what is there.
//
//   npm run configure                         ask everything
//   npm run configure -- --resume resume.json start from a JSON Resume file
//   npm run configure -- --quick              only who you are; keep the world as it is

import { createInterface } from 'node:readline/promises';
import { readFile, writeFile, copyFile, access } from 'node:fs/promises';
import { stdin, stdout, argv, exit } from 'node:process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { FLAG_PRESETS, fromJsonResume, serialise } from './lib.mjs';

const root = resolve(import.meta.dirname, '..');
const target = resolve(root, 'world.config.js');
const args = argv.slice(2);
const arg = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

if (!stdin.isTTY) {
  console.error('The configure step asks questions, so it needs to run in a terminal.');
  exit(1);
}

const rl = createInterface({ input: stdin, output: stdout });
const dim = s => `\x1b[2m${s}\x1b[0m`, bold = s => `\x1b[1m${s}\x1b[0m`;
const ask = async (q, def = '') => {
  const a = (await rl.question(`${q}${def !== '' ? dim(` [${def}]`) : ''} `)).trim();
  return a === '' ? def : a;
};
const yes = async (q, def = true) => {
  const a = (await rl.question(`${q} ${dim(def ? '[Y/n]' : '[y/N]')} `)).trim().toLowerCase();
  return a === '' ? def : a.startsWith('y');
};
const pick = async (q, options, def) => {
  options.forEach((o, i) => console.log(`  ${dim(String(i + 1).padStart(2))}  ${o}`));
  const a = await ask(q, def);
  const n = Number(a);
  return Number.isInteger(n) && n >= 1 && n <= options.length ? options[n - 1] : (options.find(o => o.toLowerCase() === String(a).toLowerCase()) ?? def);
};
const heading = s => console.log(`\n${bold(s)}`);

async function load(path) {
  try {
    await access(path);
    return (await import(`${pathToFileURL(path).href}?t=${Date.now()}`)).default;
  } catch {
    return null;
  }
}

async function flagStep(label, current) {
  const names = ['none', 'keep current', ...Object.keys(FLAG_PRESETS), 'stripes in my own colours', 'a cross in my own colours', 'a diagonal cross in my own colours'];
  const choice = await pick(`  ${label}:`, names, current ? 'keep current' : 'none');
  if (choice === 'none') return null;
  if (choice === 'keep current') return current;
  if (FLAG_PRESETS[choice]) return { ...FLAG_PRESETS[choice], shape: current?.shape ?? 'pennant' };
  if (choice.startsWith('stripes')) {
    const colours = (await ask('    Colours, comma separated (hex like #2e5e8c):', '#2e5e8c, #f2ead8, #2e5e8c')).split(',').map(s => s.trim()).filter(Boolean);
    const direction = (await yes('    Vertical stripes?', false)) ? 'vertical' : 'horizontal';
    return { stripes: colours, direction, shape: (await yes('    Triangular pennant (no for a square flag)?', true)) ? 'pennant' : 'square' };
  }
  const field = await ask('    Background colour:', '#7a2a24');
  const cross = await ask('    Cross colour:', '#f2ead8');
  return { ...(choice.startsWith('a cross') ? { cross } : { saltire: cross }), field, shape: 'square' };
}

console.log(bold('\n3D CV World: configure your valley'));
console.log(dim('Press Enter to keep the value in brackets. Nothing is written until the end.\n'));

let config = (await load(target)) ?? (await load(resolve(root, 'world.config.example.js'))) ?? {};
config = structuredClone(config);

// Start from a JSON Resume, if there is one
const resumePath = arg('--resume') ?? (await ask('Path to a JSON Resume file to import (leave empty to skip):', ''));
if (resumePath) {
  try {
    const imported = fromJsonResume(JSON.parse(await readFile(resolve(process.cwd(), resumePath), 'utf8')));
    const fresh = await yes('Replace the current content (jobs, projects, skills...) with the imported résumé?', true);
    config = fresh ? { ...config, ...imported, person: { ...config.person, ...imported.person } } : { ...config, person: { ...config.person, ...imported.person } };
    const count = id => imported.journey.find(s => s.id === id)?.content?.length ?? 0;
    console.log(dim(`Imported ${count('experience')} jobs, ${count('projects')} projects, ${count('skills')} skill groups.`));
  } catch (e) {
    console.log(`Could not read that file (${e.message}); carrying on without it.`);
  }
}

heading('You');
const p = config.person ?? {};
p.name = await ask('Your name:', p.name ?? '');
p.shortName = await ask('What townsfolk call you:', p.shortName || p.name.split(/\s+/)[0]);
p.title = await ask('Title:', p.title ?? '');
p.location = await ask('Where you are based:', p.location ?? '');
p.tagline = await ask('One-line tagline:', p.tagline ?? '');
config.person = p;

if (!args.includes('--quick')) {
  heading('The site');
  config.site = config.site ?? {};
  config.site.url = await ask('Address it will be served from, ending in / (leave empty if unknown):', config.site.url ?? '');
  config.site.description = await ask('Description for link previews:', config.site.description ?? '');

  heading('The journey');
  console.log(dim('The first and last stops always stay. To add a stop of your own, run npm run new-stop.'));
  config.journey = config.journey ?? [];
  const rename = await yes('Rename any stops?', false);
  const last = config.journey.length - 1;
  for (const [i, s] of config.journey.entries()) {
    if (i > 0 && i < last) s.show = await yes(`  Show ${s.title ?? s.id}${s.placeName ? ` (${s.placeName})` : ''}?`, s.show !== false);
    if (s.show === false) continue;
    delete s.show;
    if (rename && i > 0) {
      s.title = await ask(`    Title for ${s.title ?? s.id}:`, s.title ?? s.id);
      s.placeName = await ask('    Place name:', s.placeName ?? '');
    }
  }

  heading('The world');
  const w = config.world = config.world ?? {};
  const season = await pick('Time of year:', ['calendar', 'spring', 'summer', 'autumn', 'winter'], w.season ?? 'calendar');
  w.season = season;
  console.log('Flags (pick a number or type a name):');
  w.flags = w.flags ?? {};
  w.flags.watchtower = await flagStep('On the watchtower', w.flags.watchtower);
  w.flags.abbey = await flagStep('On the abbey spire', w.flags.abbey);
  w.walk = await yes('Allow walking the valley on foot?', w.walk !== false);
  const eggs = w.eggs = { compass: true, choir: true, seasonalScenes: true, rumour: true, ...(w.eggs ?? {}) };
  if (!(await yes('Keep all the Easter eggs?', Object.values(eggs).every(Boolean)))) {
    const label = { compass: 'the compass on the ship', choir: 'the abbey choir', seasonalScenes: 'seasonal scenes (harvest, bonfire, Yule tree...)', rumour: 'a hint when the valley loads' };
    for (const k of Object.keys(label)) eggs[k] = await yes(`  Keep ${label[k]}?`, eggs[k]);
  }
}

rl.close();

// Keep the hand-edited file safe before replacing it
try {
  await access(target);
  await copyFile(target, `${target}.bak`);
  console.log(dim('\nThe previous config was saved as world.config.js.bak.'));
} catch { /* first run */ }
await writeFile(target, serialise(config));
console.log(`\n${bold('Done.')} Written to world.config.js. Run ${bold('npm run check')} to look it over, then ${bold('npm run dev')} to walk it.\n`);
