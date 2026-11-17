// Everything that makes the valley yours lives in this one file: who you are, what goes on each
// stop, and how the world itself looks and behaves. Run `npm run configure` to fill it in by
// answering a few questions (it can also import a JSON Resume file), or edit it by hand.
//
// The content below is a fictional example, so the template runs straight away.

export default {
  // ---------------------------------------------------------------------------------------------
  // The site, for the browser tab and link previews when it is shared
  site: {
    // The address the site will be served from (ending in a slash). Leave empty if you do not
    // know it yet: link previews then fall back to relative paths.
    url: '',
    description: 'A CV told as a journey down a river valley, from a watchtower in the mountains to the sea.',
    language: 'en-GB',
  },

  // ---------------------------------------------------------------------------------------------
  // You
  person: {
    name: 'Robin Ashdown',
    // Used by townsfolk when they talk about you on foot ("Robin wrote it up, you know")
    shortName: 'Robin',
    title: 'Software Engineer',
    location: 'Bristol, England',
    tagline: 'Software engineer, building tools for people who build things.',
  },

  // ---------------------------------------------------------------------------------------------
  // The stops of the journey, in order. Each can be renamed, given a quote (shown over the
  // landscape when the camera settles there) or switched off with `show: false`. The welcome stop
  // at the watchtower and the contact stop at the coast are always shown.
  sections: {
    about: { title: 'About', placeName: 'The Homestead', quote: { text: 'The only way to do great work is to love what you do.', by: 'Steve Jobs' } },
    education: { title: 'Education', placeName: 'The Abbey', quote: { text: 'An investment in knowledge pays the best interest.', by: 'Benjamin Franklin' } },
    experience: { title: 'Experience', placeName: 'The Guild Town', quote: { text: 'Pleasure in the job puts perfection in the work.', by: 'Aristotle' } },
    skills: { title: 'Skills', placeName: 'The Fair', quote: { text: 'A jack of all trades is a master of none, but oftentimes better than a master of one.', by: 'Anonymous' } },
    projects: { title: 'Projects', placeName: 'The Mills', quote: { text: 'Talk is cheap. Show me the code.', by: 'Linus Torvalds' } },
    interests: { title: 'Interests', placeName: 'The Harbour Inn', quote: { text: 'No man is really happy or safe without a hobby.', by: 'William Osler' } },
    travel: { title: 'Travel', placeName: 'The Voyage', quote: { text: 'The world is a book, and those who do not travel read only one page.', by: 'Augustine of Hippo' } },
    contact: { title: 'Contact', placeName: 'The Coast at Nightfall', quote: { text: 'So long, and thanks for all the fish.', by: 'Douglas Adams' } },
  },

  // ---------------------------------------------------------------------------------------------
  // What goes on each stop. Every list can be shorter, longer or empty.

  about: [
    'I like building the tools other people build with: compilers, editors, pipelines and the small utilities that quietly save a team an hour a day.',
    'Away from the keyboard I climb, play in a brass band and walk long distances with a camera.',
  ],

  education: [
    { degree: 'MSc Computer Science', institution: 'University of Westhaven', period: '2018 – 2022', notes: 'First Class Honours. Dissertation on incremental compilation for large monorepos.' },
    { degree: 'A Levels', institution: 'Ashdown Grammar School', period: '2011 – 2018', notes: 'Mathematics, Physics and Computing.' },
  ],

  // Each job raises a guild hall in the town (up to six). `trade` chooses what stands outside it:
  //   exchange  an open market house with traders haggling (and carrier pigeons that fly to it)
  //   school    a schoolroom with desks and a blackboard
  //   lodge     a master builder's lodge with a model and a treadwheel crane
  //   ledger    a clerks' hall with ledgers and a bookcase
  //   racing    a workshop with a race car on stands (a racer in its colours runs the roads)
  // `logo` is optional: an image in public/ drawn on the hall's banners and shield.
  experience: [
    { role: 'Senior Software Engineer', org: 'Northgate Analytics', trade: 'exchange', place: 'Bristol', period: '2024 – Present', points: ['Leads the build and release tooling for a 200-engineer organisation.', 'Cut median CI time from 41 to 12 minutes with remote caching and test sharding.'] },
    { role: 'Software Engineer', org: 'Oakbuilt Engineering', trade: 'lodge', place: 'Bath', period: '2022 – 2024', points: ['Built the geometry pipeline behind a structural analysis product.', 'Introduced property-based testing across the core solver.'] },
    { role: 'Teaching Assistant', org: 'University of Westhaven', trade: 'school', place: 'Westhaven', period: '2020 – 2022', points: ['Ran labs for the first-year programming course and marked coursework.'] },
    { role: 'Data Engineering Intern', org: 'Kestrel & Lark', trade: 'ledger', place: 'Remote', period: 'Summer 2021', points: ['Moved nightly reporting jobs onto an incremental pipeline.'] },
    { role: 'Electronics Lead', org: 'Westhaven Racing', trade: 'racing', place: 'Westhaven', period: '2019 – 2021', points: ['Designed the telemetry board for the student race car.'] },
  ],

  // Each skill group is a stall at the fair (up to eight). `trade` dresses the stall, and every
  // item becomes its own object on the counter:
  //   clockmaker (systems), apothecary (backend and data), glazier (interfaces),
  //   cooper (infrastructure), pedlar (everything else, sold from a cart)
  skills: [
    { group: 'Systems', trade: 'clockmaker', items: ['Rust', 'C++', 'Zig'] },
    { group: 'Backend & Data', trade: 'apothecary', items: ['Python', 'Go', 'PostgreSQL'] },
    { group: 'Interfaces', trade: 'glazier', items: ['TypeScript & React', 'Svelte', 'Three.js'] },
    { group: 'Infrastructure', trade: 'cooper', items: ['Kubernetes', 'Terraform', 'Bazel', 'GitHub Actions'] },
    { group: 'Also Worked In', trade: 'pedlar', items: ['Java', 'Kotlin', 'Elixir', 'Haskell', 'Lua'] },
  ],

  // The first six projects become workshops at the mills, under scaffolding while `status` is
  // 'building'. `emblem` adds something outside: clock, tavern, dyer (give it `languages`, a
  // share of code by language, drawn as dyed cloth), press or orrery.
  projects: [
    { name: 'Tidewater', emblem: 'clock', period: '2025', description: 'A profiler that replays a production trace in slow motion, so you can watch where the time goes.', tags: ['Rust', 'WebGPU'], link: 'https://example.com/tidewater', status: 'done' },
    { name: 'Lantern', emblem: 'tavern', period: '2024', description: 'A tiny static-site generator for recipe collections, with search that works offline.', tags: ['Go'], link: 'https://example.com/lantern', status: 'done' },
    { name: 'Dyehouse', emblem: 'dyer', languages: { Rust: 40, TypeScript: 30, Python: 20, Go: 10 }, period: '2024', description: 'A GitHub Action that charts language usage across every repository you own.', tags: ['Python', 'GitHub Actions'], status: 'done' },
    { name: 'Inkwell', emblem: 'press', period: '2023', description: 'Turns Markdown notes into a printable zine, laid out by a constraint solver.', tags: ['TypeScript'], status: 'done' },
    { name: 'Homelab', period: '2023 – Present', description: 'A small cluster at home, declared entirely in code, with monitoring for every service.', tags: ['NixOS', 'Grafana'], status: 'building' },
    { name: 'Orrery', emblem: 'orrery', period: '2022', description: 'A browser solar system with real orbital mechanics that runs on old laptops.', tags: ['Three.js'], status: 'done' },
    { name: 'Rhythm Lab', period: '2021', description: 'A rhythm game that generates beatmaps from any audio track.', tags: ['DSP'], status: 'done' },
  ],

  // At the harbour inn. An interest with `items` is a list of honours; its entries become
  // trophies on the shelf by the inn door.
  interests: [
    { title: 'Music', text: 'Plays cornet in a brass band, and sings in a community choir when the band is quiet.' },
    { title: 'Outdoors', text: 'Climbs indoors in winter and outdoors when the weather allows, and walks long-distance trails.' },
    { title: 'Competitions', items: [['City Hack', 'winner, 2024'], ['Westhaven Code Jam', 'runner-up, 2021'], ['Formula Student', 'best electronics, 2020']] },
  ],

  // ISO country codes. Visited countries are lit on the globe aboard the ship.
  travel: {
    visited: ['GB', 'IE', 'FR', 'ES', 'PT', 'IT', 'DE', 'NL', 'NO', 'JP', 'US', 'CA'],
    // Shaded on the globe as visited, but not listed or counted (named as in the globe's map data)
    alsoShaded: [],
    wishlist: ['IS', 'NZ', 'PE', 'KR'],
  },

  // Writing, shown as a pencilled margin note beside the entry it is about, with an object in
  // the valley at the same place. `at` is 'competitions', 'skill:<group>' or 'job:<role>'. For
  // the objects: a pamphlet by the trophies, a ledger on a stall counter (punched cards on the
  // pedlar's cart) or chalk on the school's blackboard. `said` is what a passer-by says about it.
  writings: [
    { id: 'profiling', at: 'skill:Systems', minutes: 9, title: 'Watching Time Go By: Building a Slow-Motion Profiler', url: 'https://example.com/writing/profiling', said: 'That ledger on the counter is Robin’s write-up on profiling.' },
  ],

  contact: {
    blurb: 'Always happy to talk about developer tooling, build systems and interesting side projects.',
    links: [
      { label: 'Email', text: 'robin@example.com', href: 'mailto:robin@example.com' },
      { label: 'GitHub', text: '@example', href: 'https://github.com/example' },
      { label: 'LinkedIn', text: 'Robin Ashdown', href: 'https://linkedin.com/in/example' },
    ],
  },

  // ---------------------------------------------------------------------------------------------
  // The world itself
  world: {
    // 'calendar' follows the visitor's real month (snow in winter, blossom in spring, harvest
    // and bonfires in autumn). A month name ('january' ... 'december') or a season ('winter',
    // 'spring', 'summer', 'autumn') fixes the valley to that time of year instead.
    season: 'calendar',

    // Flags flown in the valley. Each is { stripes: [colours...], direction: 'horizontal' or
    // 'vertical' }, { cross: colour, field: colour } (a Nordic cross), { saltire: colour,
    // field: colour } (a diagonal cross) or { plain: colour }, or null for no flag.
    // `shape` is 'pennant' (a triangle) or 'square'.
    flags: {
      watchtower: { stripes: ['#2e5e8c', '#f2ead8', '#2e5e8c'], direction: 'horizontal', shape: 'pennant' },
      abbey: { cross: '#f2ead8', field: '#7a2a24', shape: 'square' },
    },

    // Your initials, ploughed into a field north of the town and readable from above
    initials: 'RA',

    // Colours of the folk dance at the fair on real evenings, and of the flag beside it
    dance: { colours: ['#a8322d', '#f2ead8', '#2f5a8f'], flag: { stripes: ['#a8322d', '#f2ead8', '#2f5a8f'], direction: 'vertical', shape: 'pennant' } },

    // The racing cart's livery (used when a job has trade 'racing')
    racing: { body: '#e8b923', trim: '#1c1a17' },

    // Things to find. Switch any of them off with false.
    eggs: {
      compass: true, // a compass on the ship that turns the time of day, and the year
      choir: true, // linger at the abbey and the cloister choir sings
      dance: true, // an evening dance at the fair, and a piper on the watchtower
      pigeons: true, // carrier pigeons from the watchtower to the market house
      cropMark: true, // your initials ploughed into a field
      seasonalScenes: true, // sowing, haymaking, harvest, bonfire night, a Yule tree, snowmen
      rumour: true, // a hint at one of these when the valley loads
    },

    // First-person walking (the 'Explore more on foot' button on the contact stop, or ?walk)
    walk: true,

    // Lines the townsfolk say to each other on foot, added to the built-in ones
    chatter: [
      ['Robin was in the band again last night.', 'Any good?', 'Loud. Very loud.'],
    ],
  },
};
