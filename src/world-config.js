import config from '../world.config.js';

// The world options from world.config.js, with defaults for anything left out
const w = config.world ?? {};
export const WORLD = {
  season: w.season ?? 'calendar',
  flags: { watchtower: null, abbey: null, ...(w.flags ?? {}) },
  eggs: { compass: true, choir: true, seasonalScenes: true, rumour: true, ...(w.eggs ?? {}) },
  walk: w.walk ?? true,
  chatter: w.chatter ?? [],
};
export const SITE = config.site ?? {};
