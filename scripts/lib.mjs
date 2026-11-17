// Shared pieces for the configure and check scripts

export const TRADES = {
  job: ['exchange', 'school', 'lodge', 'ledger', 'workshop'],
  skill: ['clockmaker', 'apothecary', 'glazier', 'cooper', 'pedlar'],
  emblem: ['clock', 'tavern', 'dyer', 'press', 'orrery'],
};

// The built-in journey: which place kit and panel layout each stop uses, and its usual names
export const BUILT_IN_STOPS = [
  { id: 'hero', place: 'watchtower', panel: 'welcome', title: 'Welcome', placeName: 'The Watchtower' },
  { id: 'about', place: 'homestead', panel: 'prose', title: 'About', placeName: 'The Homestead' },
  { id: 'education', place: 'abbey', panel: 'entries', title: 'Education', placeName: 'The Abbey' },
  { id: 'experience', place: 'town', panel: 'halls', title: 'Experience', placeName: 'The Guild Town' },
  { id: 'skills', place: 'fair', panel: 'stalls', title: 'Skills', placeName: 'The Fair' },
  { id: 'projects', place: 'mills', panel: 'workshops', title: 'Projects', placeName: 'The Mills' },
  { id: 'interests', place: 'harbour', panel: 'interests', title: 'Outside Work', placeName: 'The Harbour Inn' },
  { id: 'writing', place: 'ship', panel: 'entries', title: 'Writing & Talks', placeName: 'Further Afield' },
  { id: 'contact', place: 'coast', panel: 'contact', title: 'Contact', placeName: 'The Coast at Nightfall' },
];

// Flags that can be drawn from stripes and crosses, offered by name when configuring
export const FLAG_PRESETS = {
  France: { stripes: ['#0055a4', '#ffffff', '#ef4135'], direction: 'vertical' },
  Italy: { stripes: ['#009246', '#ffffff', '#ce2b37'], direction: 'vertical' },
  Ireland: { stripes: ['#169b62', '#ffffff', '#ff883e'], direction: 'vertical' },
  Belgium: { stripes: ['#000000', '#fdda24', '#ef3340'], direction: 'vertical' },
  Romania: { stripes: ['#002b7f', '#fcd116', '#ce1126'], direction: 'vertical' },
  Nigeria: { stripes: ['#008751', '#ffffff', '#008751'], direction: 'vertical' },
  Germany: { stripes: ['#000000', '#dd0000', '#ffce00'], direction: 'horizontal' },
  Netherlands: { stripes: ['#ae1c28', '#ffffff', '#21468b'], direction: 'horizontal' },
  Austria: { stripes: ['#ed2939', '#ffffff', '#ed2939'], direction: 'horizontal' },
  Hungary: { stripes: ['#ce2939', '#ffffff', '#477050'], direction: 'horizontal' },
  Poland: { stripes: ['#ffffff', '#dc143c'], direction: 'horizontal' },
  Ukraine: { stripes: ['#0057b7', '#ffd700'], direction: 'horizontal' },
  Russia: { stripes: ['#ffffff', '#0039a6', '#d52b1e'], direction: 'horizontal' },
  Serbia: { stripes: ['#c6363c', '#0c4076', '#ffffff'], direction: 'horizontal' },
  Bulgaria: { stripes: ['#ffffff', '#00966e', '#d62612'], direction: 'horizontal' },
  Estonia: { stripes: ['#0072ce', '#000000', '#ffffff'], direction: 'horizontal' },
  Lithuania: { stripes: ['#fdb913', '#006a44', '#c1272d'], direction: 'horizontal' },
  Colombia: { stripes: ['#fcd116', '#fcd116', '#003893', '#ce1126'], direction: 'horizontal' },
  Indonesia: { stripes: ['#ff0000', '#ffffff'], direction: 'horizontal' },
  Sweden: { cross: '#fecc02', field: '#006aa7' },
  Denmark: { cross: '#ffffff', field: '#c8102e' },
  Finland: { cross: '#002f6c', field: '#ffffff' },
  Iceland: { cross: '#dc1e35', field: '#02529c' },
  Scotland: { saltire: '#ffffff', field: '#005eb8' },
  Japan: null,
};
delete FLAG_PRESETS.Japan;

// Guesses which building a job or stall a skill group should get, from the words in it
export function guessJobTrade(text) {
  const t = text.toLowerCase();
  if (/teach|tutor|lectur|instructor|teaching|professor|demonstrator/.test(t)) return 'school';
  if (/mechanic|technician|workshop|maker|craft|hardware|manufactur/.test(t)) return 'workshop';
  if (/bank|trading|trader|capital|finance|financial|market|exchange|fund|invest|quant/.test(t)) return 'exchange';
  if (/engineer|construct|architect|build|design|civil|mechanical|structural/.test(t)) return 'lodge';
  return 'ledger';
}

export function guessSkillTrade(name, items) {
  const t = `${name} ${items.join(' ')}`.toLowerCase();
  if (/\bc\b|c\+\+|rust|zig|embedded|assembly|cuda|systems|firmware|fpga|verilog|performance/.test(t)) return 'clockmaker';
  if (/react|vue|svelte|angular|css|html|typescript|front|ui|ux|design|three\.js|interface/.test(t)) return 'glazier';
  if (/docker|kubernetes|k8s|aws|gcp|azure|terraform|ci|devops|linux|cloud|infra|nix|ansible/.test(t)) return 'cooper';
  if (/python|sql|postgres|go\b|golang|java\b|backend|data|spark|pandas|ml|machine learning|node/.test(t)) return 'apothecary';
  return 'pedlar';
}

// A period from JSON Resume dates ("2021-09" and "2024-06" become "Sep 2021 – Jun 2024")
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const date = d => {
  if (!d) return '';
  const [y, m] = String(d).split('-');
  return m ? `${MONTHS[Number(m) - 1] ?? ''} ${y}`.trim() : y;
};
const period = (a, b) => (a ? `${date(a)} – ${b ? date(b) : 'Present'}` : date(b));

// Reads a JSON Resume (https://jsonresume.org/schema) into the shape world.config.js uses
export function fromJsonResume(r) {
  const b = r.basics ?? {};
  const loc = b.location ?? {};
  const parts = {
    person: {
      name: b.name ?? '',
      shortName: (b.name ?? '').split(/\s+/)[0] ?? '',
      title: b.label ?? '',
      location: [loc.city, loc.region ?? loc.countryCode].filter(Boolean).join(', '),
      tagline: b.label && loc.city ? `${b.label}, based in ${loc.city}.` : (b.label ?? ''),
    },
    about: (b.summary ?? '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean),
    education: (r.education ?? []).map(e => ({
      title: [e.studyType, e.area].filter(Boolean).join(' '),
      meta: [e.institution ?? '', period(e.startDate, e.endDate)].filter(Boolean),
      text: [e.score, ...(e.courses ?? [])].filter(Boolean).join('. ') + ((e.score || e.courses?.length) ? '.' : ''),
      ...(e.url ? { link: e.url } : {}),
    })),
    experience: [...(r.work ?? []), ...(r.volunteer ?? []).map(v => ({ ...v, name: v.organization }))].map(w => ({
      role: w.position ?? '',
      org: w.name ?? '',
      trade: guessJobTrade(`${w.position ?? ''} ${w.name ?? ''} ${w.summary ?? ''}`),
      place: w.location ?? '',
      period: period(w.startDate, w.endDate),
      points: w.highlights?.length ? w.highlights : (w.summary ? [w.summary] : []),
    })),
    skills: (r.skills ?? []).map(s => ({ group: s.name ?? '', trade: guessSkillTrade(s.name ?? '', s.keywords ?? []), items: s.keywords?.length ? s.keywords : [s.name] })),
    projects: (r.projects ?? []).map((p, i) => ({
      name: p.name ?? '',
      ...(i < 5 ? { emblem: ['clock', 'tavern', 'press', 'orrery', 'clock'][i] } : {}),
      period: period(p.startDate, p.endDate),
      description: p.description ?? (p.highlights ?? []).join(' '),
      tags: p.keywords ?? [],
      ...(p.url ? { link: p.url } : {}),
      status: p.endDate ? 'done' : 'building',
    })),
    interests: [
      ...(r.interests ?? []).map(i => ({ title: i.name ?? '', text: (i.keywords ?? []).join(', ') + ((i.keywords ?? []).length ? '.' : '') })),
      ...((r.awards ?? []).length ? [{ title: 'Awards', items: r.awards.map(a => [a.title ?? '', [a.awarder, date(a.date)].filter(Boolean).join(', ')]) }] : []),
    ],
    publications: (r.publications ?? []).map(p => ({ title: p.name ?? '', meta: [p.publisher, date(p.releaseDate)].filter(Boolean), text: p.summary ?? '', ...(p.url ? { link: p.url } : {}) })),
    contact: {
      blurb: '',
      links: [
        ...(b.email ? [{ label: 'Email', text: b.email, href: `mailto:${b.email}` }] : []),
        ...(b.url ? [{ label: 'Website', text: b.url.replace(/^https?:\/\//, '').replace(/\/$/, ''), href: b.url }] : []),
        ...(b.profiles ?? []).map(p => ({ label: p.network ?? 'Profile', text: p.username ? `@${p.username}` : (p.url ?? ''), href: p.url ?? '' })),
      ],
    },
  };
  const content = { about: parts.about, education: parts.education, experience: parts.experience, skills: parts.skills, projects: parts.projects, interests: parts.interests, writing: parts.publications, contact: parts.contact };
  const out = {
    person: parts.person,
    // A stop with nothing to show (no publications, say) is left out
    journey: BUILT_IN_STOPS.map(s => ({ ...s, ...(content[s.id] ? { content: content[s.id] } : {}) })).filter(s => !Array.isArray(s.content) || s.content.length || s.id === 'hero'),
    writings: [],
  };
  return out;
}

// Writes the config back as a JavaScript module, readable and with a pointer to the documented
// example
export function serialise(config) {
  const body = JSON.stringify(config, null, 2)
    .replace(/^(\s*)"([A-Za-z_$][\w$]*)":/gm, '$1$2:');
  return `// Written by \`npm run configure\`. Every option is explained in world.config.example.js and
// in the README; edit this file by hand at any time, or run the configure step again.

export default ${body};
`;
}
