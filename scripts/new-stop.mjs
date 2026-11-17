#!/usr/bin/env node
// `npm run new-stop`: adds a stop to the journey. It can make a new place kit (the settlement
// that builds it in the valley) and a new panel layout (how it shows on the page) from templates,
// works out where the new settlement can stand, and slots the stop into world.config.js.
//
// Every question can be answered up front instead:
//   npm run new-stop -- --id talks --title Talks --place-name "The Lecture Hall" \
//     --after skills --place new --panel new --side east --distance 260

import { createInterface } from 'node:readline/promises';
import { readFile, writeFile, access, readdir } from 'node:fs/promises';
import { stdin, stdout, argv, exit } from 'node:process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { SITE_DEFAULTS, SEA } from '../src/journey/sites.js';

const root = resolve(import.meta.dirname, '..');
const configPath = resolve(root, 'world.config.js');
const args = argv.slice(2);
const flag = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const exists = p => access(p).then(() => true, () => false);
const bold = s => `\x1b[1m${s}\x1b[0m`, dim = s => `\x1b[2m${s}\x1b[0m`;

const interactive = stdin.isTTY;
const rl = interactive ? createInterface({ input: stdin, output: stdout }) : null;
const ask = async (name, q, def = '') => {
  if (flag(name) !== undefined) return flag(name);
  if (!interactive) return def;
  const a = (await rl.question(`${q}${def !== '' ? dim(` [${def}]`) : ''} `)).trim();
  return a === '' ? def : a;
};

const config = (await import(`${pathToFileURL(configPath).href}?t=${Date.now()}`)).default;
const journey = config.journey ?? [];
const kits = (await readdir(resolve(root, 'src/world/places'))).filter(f => f.endsWith('.js') && !['index.js', 'place.js', 'folk.js'].includes(f)).map(f => f.slice(0, -3));
const layouts = (await readdir(resolve(root, 'src/panels'))).filter(f => f.endsWith('.js') && f !== 'kit.js').map(f => f.slice(0, -3));
const used = new Set(journey.map(s => s.place).filter(Boolean));

console.log(bold('\nAdd a stop to the journey\n'));

// What it is called
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const title = await ask('title', 'Title on the panel:', 'Talks');
const id = slug(await ask('id', 'Id (used in links, like #stop-talks):', slug(title)));
if (!id || journey.some(s => s.id === id)) { console.error(`There is already a stop called "${id}".`); exit(1); }
const placeName = await ask('place-name', 'Place name above the title:', `The ${title} House`);

// Where in the journey
if (interactive && flag('after') === undefined) journey.forEach((s, i) => console.log(`  ${dim(String(i + 1).padStart(2))}  ${s.id}${s.place ? dim(` (${s.place})`) : ''}`));
const afterAnswer = await ask('after', 'Comes after which stop (number or id)?', journey.at(-3)?.id ?? journey.at(-1)?.id);
const afterIndex = /^\d+$/.test(afterAnswer) ? Number(afterAnswer) - 1 : journey.findIndex(s => s.id === afterAnswer);
if (afterIndex < 0 || afterIndex >= journey.length) { console.error(`No stop "${afterAnswer}" in the journey.`); exit(1); }

// The place kit
const free = kits.filter(k => !used.has(k));
const placeAnswer = await ask('place', `Place kit: "new" to make one, or an unused one (${free.join(', ') || 'none free'}):`, 'new');
const newKit = placeAnswer === 'new';
const kit = newKit ? slug(await ask('kit-name', 'Name for the new place kit:', id)) : placeAnswer;
if (!newKit && !kits.includes(kit) && !SEA.has(kit)) { console.error(`There is no place kit "${kit}" in src/world/places/.`); exit(1); }
if (newKit && kits.includes(kit)) { console.error(`src/world/places/${kit}.js already exists; pick another name, or use it as an existing kit.`); exit(1); }
if (used.has(kit)) { console.error(`The place "${kit}" is already used by another stop.`); exit(1); }

// The panel layout
const panelAnswer = await ask('panel', `Panel layout: "new" to make one, or one of ${layouts.join(', ')}:`, 'new');
const newPanel = panelAnswer === 'new';
const panel = newPanel ? slug(await ask('panel-name', 'Name for the new layout:', kit)) : panelAnswer;
if (!newPanel && !layouts.includes(panel)) { console.error(`There is no layout "${panel}" in src/panels/.`); exit(1); }
if (newPanel && layouts.includes(panel)) { console.error(`src/panels/${panel}.js already exists.`); exit(1); }

// Where a new settlement stands: halfway between its neighbours down the valley, on whichever bank
// has more room, clear of every other settlement
let site = null;
if (newKit) {
  const zOf = s => s.site?.z ?? SITE_DEFAULTS[s.place]?.z;
  const before = journey.slice(0, afterIndex + 1).reverse().find(s => zOf(s) !== undefined);
  const after = journey.slice(afterIndex + 1).find(s => zOf(s) !== undefined);
  let z = before && after ? (zOf(before) + zOf(after)) / 2 : before ? Math.min(zOf(before) + 1200, 7000) : after ? zOf(after) - 1200 : 0;
  z = Math.max(-8800, Math.min(7000, Math.round(z / 50) * 50));
  const sites = journey.filter(s => s.place && !SEA.has(s.place)).map(s => ({ id: s.id, z: zOf(s), offset: s.site?.offset ?? SITE_DEFAULTS[s.place]?.offset ?? 0 }));
  const nearest = sites.reduce((best, s) => (Math.abs(s.z - z) < Math.abs((best?.z ?? Infinity) - z) ? s : best), null);
  const suggested = nearest && nearest.offset > 0 ? 'west' : 'east';
  const side = (await ask('side', 'Which bank of the river, east or west?', suggested)).toLowerCase().startsWith('w') ? -1 : 1;
  const distance = Number(await ask('distance', 'How far from the river, in metres (150 to 600)?', '260'));
  site = { z, offset: side * Math.max(120, Math.min(900, distance || 260)), r: 45, blend: 70, lift: 1 };
  const clash = sites.find(s => Math.hypot(s.z - site.z, s.offset - site.offset) < 450);
  if (clash) console.log(`\x1b[33m•\x1b[0m It is close to "${clash.id}". Move it with \`site.z\` in world.config.js if the two overlap.`);
}

rl?.close();

// Write the new files from the templates
const fill = (text, values) => text.replace(/__([A-Z]+)__/g, (_, k) => values[k]);
const camel = s => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
if (newKit) {
  const out = resolve(root, `src/world/places/${kit}.js`);
  const text = await readFile(resolve(root, 'scripts/templates/place.js.txt'), 'utf8');
  await writeFile(out, fill(text, { TITLE: placeName, KIT: kit, ROT: site.offset > 0 ? '-Math.PI / 2' : 'Math.PI / 2', SEED: String(100 + (kit.length * 37) % 900) }));
  console.log(`${bold('+')} src/world/places/${kit}.js`);
}
if (newPanel) {
  const out = resolve(root, `src/panels/${panel}.js`);
  if (await exists(out)) { console.error(`${out} exists.`); exit(1); }
  const text = await readFile(resolve(root, 'scripts/templates/panel.js.txt'), 'utf8');
  await writeFile(out, fill(text, { TITLE: title, NAME: camel(panel) }));
  console.log(`${bold('+')} src/panels/${panel}.js`);
}

// Slot the stop into world.config.js, after the stop it follows, keeping the file's comments
const source = await readFile(configPath, 'utf8');
function endOfStop(text, stopId) {
  const journeyAt = text.indexOf('journey:');
  const idAt = text.indexOf(`id: '${stopId}'`, journeyAt) >= 0 ? text.indexOf(`id: '${stopId}'`, journeyAt) : text.indexOf(`id: "${stopId}"`, journeyAt);
  if (idAt < 0) return -1;
  let depth = 0, i = idAt, quote = null;
  for (; i >= 0; i--) {
    const c = text[i];
    if (c === '}') depth++;
    if (c === '{') { if (depth === 0) break; depth--; }
  }
  depth = 0;
  for (; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
    if (c === "'" || c === '"' || c === '`') quote = c;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') { depth--; if (depth === 0) break; }
  }
  return text[i + 1] === ',' ? i + 2 : i + 1;
}
const q = s => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const entry = [
  '',
  '',
  `    // Added by npm run new-stop: ${newKit ? `src/world/places/${kit}.js builds it` : `the ${kit} place kit builds it`}, ${newPanel ? `src/panels/${panel}.js shows it` : `the ${panel} layout shows it`}`,
  '    {',
  `      id: ${q(id)}, place: ${q(kit)}, panel: ${q(panel)}, title: ${q(title)}, placeName: ${q(placeName)},`,
  ...(site ? [`      site: { z: ${site.z}, offset: ${site.offset}, r: ${site.r}, blend: ${site.blend}, lift: ${site.lift} },`] : []),
  '      content: [',
  `        { title: 'The first thing here', text: 'A sentence or two about it.' },`,
  `        { title: 'The second thing', text: 'Another sentence or two.' },`,
  '      ],',
  '    },',
].join('\n');
const at = endOfStop(source, journey[afterIndex].id);
if (at < 0) {
  console.log(`\nCould not find where to put it in world.config.js; add this to \`journey\` yourself:\n${entry}\n`);
} else {
  await writeFile(configPath, source.slice(0, at) + entry + source.slice(at));
  console.log(`${bold('+')} a "${id}" stop in world.config.js, after "${journey[afterIndex].id}"`);
}
console.log(`\nRun ${bold('npm run dev')} and open ${bold(`#stop-${id}`)} to see it. docs/STOPS.md explains how to make it your own.\n`);
