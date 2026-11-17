import config from '../world.config.js';
import { STOP_SPECS } from './journey/config.js';

// Who the valley belongs to, and a way for any part of the world to find the content of a stop.
// Content belongs to stops (world.config.js `journey`), and a few things cut across them (the
// racing cart on the roads, the trophies by the inn door): those ask for the content of the stop
// a given place kit builds, through `byPlace`.
const person = config.person ?? {};
const byPlace = kit => STOP_SPECS.find(s => s.place === kit)?.content;
const listOf = kit => (Array.isArray(byPlace(kit)) ? byPlace(kit) : []);

export default {
  name: person.name ?? 'Your Name',
  shortName: person.shortName ?? (person.name ?? 'They').split(' ')[0],
  title: person.title ?? '',
  location: person.location ?? '',
  tagline: person.tagline ?? '',
  quotes: Object.fromEntries(STOP_SPECS.filter(s => s.quote).map(s => [s.id, s.quote])),
  writings: config.writings ?? [],
  byPlace,
  // Content of the built-in kits, for the parts of the world that read across stops
  get experience() { return listOf('town'); },
  get skills() { return listOf('fair'); },
  get projects() { return listOf('mills'); },
  get interests() { return listOf('harbour'); },
  get travel() { return { visited: [], wishlist: [], alsoShaded: [], ...(byPlace('ship') ?? {}) }; },
  get contact() { return { links: [], ...(byPlace('coast') ?? {}) }; },
};
