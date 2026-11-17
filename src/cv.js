import config from '../world.config.js';

// The rest of the code reads the CV as one object. This gathers it from world.config.js and fills
// in anything left out, so a shorter config still builds a whole valley.
const person = config.person ?? {};
const sections = config.sections ?? {};

export default {
  name: person.name ?? 'Your Name',
  shortName: person.shortName ?? (person.name ?? 'They').split(' ')[0],
  title: person.title ?? '',
  location: person.location ?? '',
  tagline: person.tagline ?? '',
  quotes: Object.fromEntries(Object.entries(sections).filter(([, s]) => s?.quote?.text).map(([id, s]) => [id, s.quote])),
  about: config.about ?? [],
  education: config.education ?? [],
  experience: config.experience ?? [],
  skills: config.skills ?? [],
  projects: config.projects ?? [],
  interests: config.interests ?? [],
  travel: { visited: [], alsoShaded: [], wishlist: [], ...(config.travel ?? {}) },
  writings: config.writings ?? [],
  contact: { links: [], ...(config.contact ?? {}) },
};
