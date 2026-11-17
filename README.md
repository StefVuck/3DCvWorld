# 3D CV World

A CV told as a journey down a painted 3D river valley. Scrolling flies the camera from a watchtower in the mountains, past a homestead, an abbey, a guild town, a fair, the mills and a harbour inn, out to a ship at sea and the coast at nightfall, while the day passes from dawn to night. Each place is a section of your CV, and the world is built from what you put in it: every job raises a guild hall in the town, every skill group gets a stall at the fair, and your projects become workshops by the river.

It is a template, and the journey is not fixed. It is a list of stops: each pairs a **place kit** (the settlement that builds it in the valley) with a **panel layout** (how it shows on the page) and gives them its content. Stops can be reordered, renamed, removed, or added with a settlement of their own (`npm run new-stop`). Everything that makes it yours lives in `world.config.js`, and a configure step can fill that file in for you.

Built with [Three.js](https://threejs.org/) and [Vite](https://vitejs.dev/). There are no 3D models or textures to download: the whole valley is generated in code when the page loads.

## Quick start

```sh
npm install
npm run configure   # answer a few questions (or import a JSON Resume)
npm run check       # look the config over
npm run dev         # open the valley at http://localhost:5173
npm run new-stop    # add a stop of your own, with a new settlement and panel
```

The repository ships with a fictional example person, so `npm run dev` works straight away if you want to look around first.

## Configuring

### The configure step

`npm run configure` walks through:
- **You:** your name, the short name townsfolk use for you, title, location and tagline.
- **The site:** its address and description, for link previews.
- **The journey:** which stops to show, and optionally a new title and place name for each. New stops are added with `npm run new-stop` (below).
- **The world:**
  - the time of year;
  - the initials ploughed into a field;
  - the flags on the watchtower and abbey (about two dozen presets, or your own stripes and crosses);
  - the colours of the evening dance;
  - whether visitors can walk the valley on foot;
  - which Easter eggs to keep.

Press Enter to keep the value shown in brackets. The previous file is kept as `world.config.js.bak`.

If you have a [JSON Resume](https://jsonresume.org/schema) file, start from it. Your work, education, skills, projects, awards, interests, publications and profile links are read in, and each job and skill group is given a sensible building:

```sh
npm run configure -- --resume path/to/resume.json
npm run configure -- --quick      # only the questions about you; keep the world as it is
```

### Editing `world.config.js`

Everything the configure step writes, and a little more, can be edited by hand. `world.config.example.js` is a fully commented copy of the example: start there to see every option.

| Key | What it does |
|---|---|
| `site` | The address (for link previews), description and language |
| `person` | Name, short name, title, location, tagline |
| `journey` | The stops, in order. Each has an `id`, a `place` kit, a `panel` layout, its `content`, a `title`, `placeName` and `quote`, and optionally `time`, `camera`, `site` or `show: false` |
| `writings` | Articles or posts, shown as pencilled margin notes beside the entry they are about (`at: '<stop id>:<entry title>'`), each with an object in the valley |
| `world` | Season, flags, initials, dance colours, racing livery, Easter eggs, walking, extra chatter |

What the built-in place kits make of their content:

- **`town`:** a guild hall for each of the first six items, typically jobs. Its `trade` chooses what is built outside:
  - `exchange`: a market house with traders haggling;
  - `school`: a schoolroom;
  - `lodge`: a master builder's crane;
  - `ledger`: a clerks' hall;
  - `racing`: a race car, plus a racer on the roads in your livery.

  An optional `logo` (an image in `public/`) goes on its banners and shield.
- **`fair`:** a stall for each of the first eight groups, with every item as its own object on the counter. `trade` dresses the stall: `clockmaker`, `apothecary`, `glazier`, `cooper` or `pedlar`.
- **`mills`:** a workshop for each of the first six projects, under scaffolding while `status` is `'building'`. An `emblem` adds a `clock`, `tavern`, `dyer` (cloth dyed in your `languages`), `press` or `orrery`.
- **`harbour`:** the inn, where a list of honours becomes trophies by the door.
- **`ship`:** a globe that lights the countries visited.
- **`watchtower`, `homestead`, `abbey`, `coast`:** settings that read no content.

### Adding stops of your own

```sh
npm run new-stop
```

It makes a new place kit and a new panel layout from templates, finds the new settlement a spot in the valley between its neighbours, and adds the stop to `world.config.js`. The new stop works straight away:
- a house, tables and people;
- a camera view, a map marker and Visit buttons;
- someone to tell it in walk mode.

Both files are then yours to change. A new stop can also reuse any existing layout (`entries` suits most lists), and any kit can be paired with any layout.

[docs/STOPS.md](docs/STOPS.md) explains how stops, place kits and panel layouts fit together, and the building blocks for making your own.

`npm run check` points out anything that will not work or show up as you might expect:
- a place kit or layout that does not exist;
- a settlement used twice, or two standing on top of each other;
- unknown trades;
- a writing whose `at` matches nothing;
- more items than buildings;
- bad country codes or colours.

## What visitors can do

- **Scroll** to fly from stop to stop. Snapping lands each panel squarely on screen.
- **Use the map** in the corner to fly straight to any stop.
- **Drag** to orbit round the current stop, and double-click to recentre.
- **Visit:** hall, stall, workshop and writing entries have a button that flies to their place in the valley.
- **Explore on foot:** the contact stop's "Explore more on foot" button, or `?walk`, starts first-person walking from the town.
  - **Controls:** WASD to move, mouse to look, Shift to hurry, Space to hop, `[` and `]` to turn the day, and the number keys (or the map) to fly to another settlement.
  - **Places:** you can go inside the inn and the guild halls, and climb the watchtower.
  - **People:** the townsfolk tell you your CV and chat among themselves.
- **Sound:** a quiet soundscape for each stop, off until switched on.

### Easter eggs

Each visit opens with one random hint at these. Every one can be switched off in `world.eggs`.

- A compass aboard the ship. Clicking it adds a dial to the screen whose points are times of day. Pressing its crown flips it to a twelve-month dial that changes the season.
- Linger at the abbey and the cloister choir begins to sing.
- On real evenings, on the visitor's clock, there is a dance at the fair beneath a flag, and a piper plays on the watchtower.
- Carrier pigeons fly from the watchtower to the market house, if one of your jobs is an `exchange`.
- Your initials are ploughed into a field north of the town, readable from above.
- The year follows the real month, or a fixed one set in `world.season`:
  - sowing in spring and haymaking in summer;
  - harvest in autumn, with the woods turning;
  - a bonfire with fireworks in November;
  - a Yule tree and carollers in December;
  - snow, snowmen and a skier in winter.
- The moon in the sky shows its real phase.

## URL options

| Option | Effect |
|---|---|
| `?debug` | A panel for scrubbing the time of day, toggling the paint filter, a free camera and walking |
| `?still&stop=3` | Renders a single frame at a stop, handy for screenshots; add `&t=0.5` for halfway through the next flight |
| `?walk` | Starts on foot in the town |
| `?month=1` to `?month=12`, `?season=winter` | Previews another time of year |
| `?moon=0.5`, `?evening` | Previews a moon phase or the evening scenes |
| `?paint=1` | Turns on the painterly brush filter |
| `?quality=low` or `?quality=high` | Forces the frame-rate cap on or off |

## Link previews

`site.url` should be the full address the site is served from, ending in a slash. Link previews (Slack, Discord, iMessage and the rest) then show `public/og.jpg`. To make your own:
1. Open `?still&stop=0` in a 1200×630 window.
2. Take a screenshot.
3. Save it over `public/og.jpg`.

## Visitor counter

The contact stop can show how many people have visited, read from `public/visitors.json`:

```json
{ "count": 1234, "lifetime": 9876 }
```

`count` is this site and `lifetime` is every site you run. Either can be left out or 0. Point any analytics export at that file; the line stays hidden while both are 0.

## Deploying

`npm run build` writes a static site to `dist/`, which any static host can serve.

To deploy to GitHub Pages, the workflow in `.github/workflows/deploy.yml` builds and publishes on every push to `main`:
1. In the repository settings, under Pages, choose "GitHub Actions" as the source.
2. Push.

The page uses relative paths, so it works at a sub-path such as `https://you.github.io/your-repo/`. The 404 page, `public/404.html`, uses absolute paths because it can be served at any address. It works best on a custom domain or a user site served at the root.

## Going further

- **Settlements** are modules in `src/world/places/`, one per place kit.
- **Panel layouts** are modules in `src/panels/`.

Both are found automatically, and both can be edited or added to; see [docs/STOPS.md](docs/STOPS.md).

The townsfolk's conversation lines are in `src/chatter.js`. Extra lines can also be added without touching code, in `world.chatter`.

## Performance

The valley is drawn every frame, but the code keeps the cost down:
- only what each stop can see is drawn;
- trees switch to simpler models with distance;
- reflections and shadows are limited to where they show;
- phones are held to 30 frames a second.

Firefox and browsers built on it draw this kind of scene much more slowly than Chromium or Safari, so their visitors see a one-time note saying so.

## Credits

Ambient recordings in `public/audio/` are from Wikimedia Commons, credited in `public/audio/CREDITS.md`. Fonts are EB Garamond and IM Fell English from Google Fonts.
