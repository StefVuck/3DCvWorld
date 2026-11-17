# Stops: how the journey fits together

The journey is a list of stops in `world.config.js`. Each stop joins up three things:

```
world.config.js                 src/world/places/<place>.js        src/panels/<panel>.js
{ id, place, panel, content } → builds it in the valley          → shows it on the page
                                (buildings, people, camera view,    (the card that sits over the
                                 anchors for "visit" buttons)        landscape)
```

The **place kit** and the **panel layout** both read the stop's `content`, so one stop's words become both a building in the valley and a card on the page. Neither is tied to a CV section: the town builds a guild hall per item, whatever the stop is called; the `entries` layout lists any titled items.

Both kinds are discovered automatically. A file dropped into `src/world/places/` is a place kit named after the file; a file in `src/panels/` is a panel layout named after the file. Nothing needs registering.

## The quickest way: `npm run new-stop`

```sh
npm run new-stop
```

It asks:
- for a title;
- where in the journey the stop goes;
- whether to make a new place kit or reuse an unused one;
- whether to make a new panel layout or reuse one;
- for a new settlement, which bank of the river it stands on.

It then:
- writes the new files from templates (`scripts/templates/`);
- finds the new settlement a spot between its neighbours;
- adds the stop to `world.config.js` with placeholder content.

`npm run dev` and open `#stop-<id>`: the stop is there, with a house, tables, people and a working camera. From there, everything is yours to change.

All the questions can be answered on the command line for scripting:

```sh
npm run new-stop -- --title Talks --place-name "The Lecture Hall" --after skills \
  --place new --panel new --side east --distance 260
```

Run `npm run check` afterwards: it catches missing kits or layouts, a settlement used twice, settlements standing on top of each other and writings that point at nothing.

## A stop in `world.config.js`

```js
{
  id: 'talks',                 // links (#stop-talks), visit anchors ('talks:0') and writings ('talks:<title>')
  place: 'talks',              // the place kit: src/world/places/talks.js, or 'ship' / 'coast' at sea
  panel: 'entries',            // the layout: src/panels/entries.js
  title: 'Talks',              // on the card
  placeName: 'The Lecture Hall',
  quote: { text: '…', by: '…' },              // shown over the landscape when the camera settles
  content: [ { title: 'Rust at scale', text: '…' } ],   // whatever the kit and layout read
  site: { z: 3550, offset: 260, r: 45 },      // where a new settlement stands (see below)
  camera: { pos: [16, 12, 30], look: [0, 2, 0] },       // optional: override the kit's view
  time: 0.5,                   // optional: the hour, 0 at dawn to 1 at nightfall
  show: false,                 // optional: leave the stop out
}
```

Reordering the list reorders the journey. The hour is spread evenly from dawn to nightfall unless a stop sets `time`. The first stop gets the large welcome card if its panel is `welcome`.

## Place kits

A place kit is a module in `src/world/places/` that exports two things:

```js
export const place = new Place('talks', Math.PI / 2);   // its frame: the name, and which way it faces

export function build({ builder, people, birds, stop, cv, banners, heraldry, spinners, wares }) {
  place.build(builder, b => { /* buildings, in the place's own frame */ });
  return { place, chimneys: [], extras: [], groundSize: 90, paint: g => {}, detail: {}, view: {} };
}
```

**The place's frame.** Coordinates are in metres:
- the origin is the middle of the settlement's flat shelf;
- y is height above it;
- `place.point(x, y, z)` converts to world coordinates, for anything outside the builder.

**Building.** `b.box`, `b.cylinder`, `b.cone`, `b.blob`, `b.beam`, `b.gableRoof`, `b.timberWall` and `b.group(at(x, y, z, rotation), g => …)` come from `src/world/kit.js`. Surfaces such as `SURF.stone`, `SURF.plaster`, `SURF.thatch`, `SURF.plank` and `SURF.glass` give each its painted texture.

There are ready-made pieces in `src/world/props.js`:
- `house` (with `interior` for a room you can walk into);
- `stoneTower`, `climbTower`, `stall`, `tent`, `barrel`, `crate`, `boat`;
- `curtainWall`, `wattle`, `postRail`;
- animals.

The built-in kits are the best examples. `homestead.js` is the simplest; `town.js` shows content becoming buildings.

**Content.** `stop.content` is whatever the stop holds in the config. Read it however suits the kit.

**Anchors.** These are what "Visit" buttons fly to:

```js
anchor(`${stop.id}:${i}`, stopIndex(stop.id), place.point(x, 1.2, z), 4, place.point(x + 2, 3, z + 8));
//      the entry's key   which stop           what to look at          size  where the camera stands
```

A panel entry with `data-link="${stop.id}:${i}"` gets a working Visit button. Buttons with no matching anchor are removed when the valley loads.

**People.** `crowdKit(people, place, r, birds)` places figures in the kit's own frame:
- `k.idle(x, z, facing, { mode })`;
- `k.walk([x, z], [x, z])`;
- `k.gather(x, z, r0, r1, n)`;
- `k.circle(x, z, radius, n)`.

The modes are `MODE.idle`, `work`, `conduct`, `sing` and `pipe`. The figures are culled along with the settlement.

**What it returns:**

| Key | What it is |
|---|---|
| `place` | The `Place` |
| `view` | `{ pos, look, subject }` in world coordinates: the camera at the stop (`subject` is kept in frame on phones) |
| `paint(g)` | Ground under the settlement, on a canvas: `g.disc`, `g.rect`, `g.path`, `g.poly` in local metres. Red is trodden earth, green tilled soil, blue settlement ground (no fields or hedges) |
| `groundSize` | How many metres across that painting covers |
| `detail` | `{ radius, count }` of grass and flowers around it |
| `extras` | Extra trees: `{ x, z, scale, kind: 'broad' or 'conifer' }` in world coordinates |
| `chimneys` | Points that smoke |
| `meshes` | Any meshes of its own (bunting, carts) to add to the scene |
| `welcomeView` | An optional wider view, for when it opens the journey |

**On foot.** In walk mode, someone at each stop tells its content. A kit can choose who by exporting `speakers(stop, h)`:
- `h.add(h.at(x, z), 'The keeper', [lines…])` adds a teller;
- `h.said(at)` gives the passer-by lines of matching writings;
- `h.sentences(text)` splits text into lines.

Without it, a local reads the panel's text aloud.

**Where it stands.** The built-in kits have their spots in `src/journey/sites.js`. A new one gives its own as the stop's `site`:
- `z` runs from the mountains (−9000) to the sea (+9000);
- `offset` is metres east (+) or west (−) of the river;
- `r` is the radius of the flat shelf;
- `blend` is how gently the shelf meets the hillside;
- `lift` raises the shelf.

The terrain flattens itself under every settlement in the journey and clears trees and fields around it. Up to 16 settlements fit.

## Panel layouts

A panel layout is a module in `src/panels/` whose default export takes the stop and the CV and returns the nodes for the card:

```js
import { el, link, notes, visit } from './kit.js';

export default function talks(stop, cv) {
  return stop.content.map((t, i) => el('article', { class: 'entry', 'data-link': `${stop.id}:${i}` }, [
    el('header', {}, [el('h3', {}, link(t.link, t.title)), visit('Visit the hall')]),
    el('p', { text: t.text }),
    ...notes(cv, `${stop.id}:${t.title}`),
  ]));
}
```

The place name and title are added above it. `kit.js` has these helpers:
- `el(tag, props, children)` builds an element;
- `link(href, text)` makes a link;
- `visit(label)` adds a button that flies to the entry's anchor;
- `notes(cv, at)` adds margin notes for writings;
- `shield` and `pennant` draw heraldry;
- `countryName` names a country from its code.

Styles live in `index.html`. The classes the built-in layouts use (`entry`, `meta`, `lede`, `stalls`, `workshops`, `honours`, `countries`) are there to reuse. Every stop's section also carries `layout-<panel>` for styling a layout of your own.

**The built-in layouts and the content they read:**

| Layout | Content |
|---|---|
| `welcome` | none (reads `person`) |
| `prose` | a string or list of paragraphs |
| `entries` | `[{ title, meta, text, points, link }]` |
| `halls` | `[{ role, org, place, period, points, logo, trade }]` |
| `stalls` | `[{ group, trade, items }]` |
| `workshops` | `[{ name, period, description, tags, link, status, emblem }]` |
| `interests` | `[{ title, text }` or `{ title, items: [[name, detail]] }]` |
| `globe` | `{ visited, wishlist, alsoShaded }` |
| `contact` | `{ blurb, links: [{ label, text, href }], farewell }` |

## The built-in place kits

| Kit | Builds | Reads |
|---|---|---|
| `watchtower` | A tower you can climb, a hut, a flag | nothing |
| `homestead` | A cottage with a study inside, barn, garden, animals | nothing |
| `abbey` | Church, cloister, a choir that sings if you linger | nothing |
| `town` | A walled town with a guild hall per item, decorated by `trade` | jobs (`halls`) |
| `fair` | A stall per group and an object per item, dressed by `trade` | skill groups (`stalls`) |
| `mills` | A workshop per item, with an `emblem` and scaffolding while `status` is `'building'` | projects (`workshops`) |
| `harbour` | Quays, boats, the inn with its taproom; honours become trophies | interests (`interests`) |
| `ship`, `coast` | Aboard the ship with its globe; the coast at nightfall with its lighthouse | travel (`globe`), contact |

Any kit can pair with any layout. The town works for anything with roles and organisations, and the `entries` layout works with any kit.

## Things that span the whole valley

Some things don't belong to one stop:
- **Roads:** these join the settlements on the east bank in order.
- **River life:** boats and the like.
- **Seasonal scenes:** each depends on the town and the homestead being present.
- **Easter eggs:** these too depend on settlements being present.

They live in `src/world/lore.js` and `src/world/seasonal.js`, and each skips itself when the settlement it needs isn't in the journey.
