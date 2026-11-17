import { populate } from './folk.js';
import { STOPS } from '../../journey.js';
import { ACTIVE_PLACES } from '../../journey/config.js';

// Every file in this folder (other than the helpers) is a place kit, found automatically: its
// file name is the name a stop uses for `place`. A kit exports `place` (its Place) and
// `build(ctx)`, which adds its buildings to ctx.builder and returns how the stop is framed. The
// stop that uses it, with its content, arrives as ctx.stop. See docs/STOPS.md.
const HELPERS = new Set(['index', 'place', 'folk']);
export const KITS = Object.fromEntries(
  Object.entries(import.meta.glob('./*.js', { eager: true }))
    .map(([path, module]) => [path.slice(2, -3), module])
    .filter(([name]) => !HELPERS.has(name)),
);

export function buildPlaces(ctx) {
  const built = ACTIVE_PLACES.map(name => {
    const module = KITS[name];
    if (!module?.build) throw new Error(`world.config.js: no place kit called "${name}" (looked for src/world/places/${name}.js)`);
    const stop = STOPS.find(s => s.kit === name);
    const start = ctx.builder.parts.length, spun = ctx.spinners.items.length;
    const place = { name: stop.placeName || name, kit: name, stop, ...module.build({ ...ctx, stop }) };
    place.parts = [start, ctx.builder.parts.length];
    place.spun = [spun, ctx.spinners.items.length];
    return place;
  });
  populate(ctx.people, ctx.birds, new Set(ACTIVE_PLACES));
  return built;
}
