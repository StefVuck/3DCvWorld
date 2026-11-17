import config from '../world.config.js';

// The world options from world.config.js, with defaults for anything left out
const w = config.world ?? {};
export const WORLD = {
  season: w.season ?? 'calendar',
  flags: { watchtower: null, abbey: null, ...(w.flags ?? {}) },
  initials: (w.initials ?? (config.person?.name ?? '').split(/\s+/).map(s => s[0]).join('')).slice(0, 3).toUpperCase(),
  dance: { colours: ['#a8322d', '#f2ead8', '#2f5a8f'], flag: null, ...(w.dance ?? {}) },
  racing: { body: '#e8b923', trim: '#1c1a17', ...(w.racing ?? {}) },
  eggs: { compass: true, choir: true, dance: true, pigeons: true, cropMark: true, seasonalScenes: true, rumour: true, ...(w.eggs ?? {}) },
  walk: w.walk ?? true,
  chatter: w.chatter ?? [],
};
export const SITE = config.site ?? {};
