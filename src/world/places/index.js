import * as watchtower from './watchtower.js';
import * as homestead from './homestead.js';
import * as abbey from './abbey.js';
import * as town from './town.js';
import * as fair from './fair.js';
import * as mills from './mills.js';
import * as harbour from './harbour.js';
import { populate } from './folk.js';

export const PLACES = [
  { name: 'The Watchtower', module: watchtower },
  { name: 'The Homestead', module: homestead },
  { name: 'The Abbey', module: abbey },
  { name: 'The Guild Town', module: town },
  { name: 'The Fair', module: fair },
  { name: 'The Mills', module: mills },
  { name: 'The Harbour', module: harbour },
];

export function buildPlaces(ctx) {
  const built = PLACES.map(p => {
    const start = ctx.builder.parts.length, spun = ctx.spinners.items.length;
    const place = { name: p.name, ...p.module.build(ctx) };
    place.parts = [start, ctx.builder.parts.length];
    place.spun = [spun, ctx.spinners.items.length];
    return place;
  });
  populate(ctx.people, ctx.birds);
  return built;
}
