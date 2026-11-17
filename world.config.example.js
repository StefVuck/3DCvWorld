// Everything that makes the valley yours lives in this one file: who you are, the stops of the
// journey and what each holds, and how the world itself looks and behaves. Run `npm run configure` to fill it in by
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
  // The journey: the stops, in the order the camera visits them, from the mountains to the sea.
  //
  // Each stop has:
  //   id         a short name, used in links (#stop-about) and to point writings at it
  //   place      the place kit that builds it in the valley: one of the files in
  //              src/world/places/ (watchtower, homestead, abbey, town, fair, mills, harbour),
  //              'ship' (aboard the ship at sea) or 'coast' (the coast at nightfall). Each
  //              settlement can be used once. Leave it out for a stop with no place of its own.
  //   panel      the layout that shows it on the page: one of the files in src/panels/
  //              (welcome, prose, entries, halls, stalls, workshops, interests, globe, contact)
  //   content    what the stop holds. Its shape is whatever the panel (and the place kit) read:
  //              each layout file says what it expects at the top.
  //   title, placeName, quote   what is written on the panel, and a line shown over the
  //              landscape when the camera settles
  // and optionally `time` (the hour, 0 at dawn to 1 at nightfall; spread evenly otherwise),
  // `camera` ({ pos, look } in the place's own frame), `site` (where a new place stands) and
  // `show: false` to skip the stop.
  //
  // To add a stop of your own, with a new place kit and panel layout, run `npm run new-stop`.
  journey: [
    { id: 'hero', place: 'watchtower', panel: 'welcome', title: 'Welcome', placeName: 'The Watchtower' },

    {
      id: 'about', place: 'homestead', panel: 'prose', title: 'About', placeName: 'The Homestead',
      quote: { text: 'The only way to do great work is to love what you do.', by: 'Steve Jobs' },
      content: [
        'I like building the tools other people build with: compilers, editors, pipelines and the small utilities that quietly save a team an hour a day.',
        'Away from the keyboard I climb, play in a brass band and walk long distances with a camera.',
      ],
    },

    {
      id: 'education', place: 'abbey', panel: 'entries', title: 'Education', placeName: 'The Abbey',
      quote: { text: 'An investment in knowledge pays the best interest.', by: 'Benjamin Franklin' },
      content: [
        { title: 'MSc Computer Science', meta: ['University of Westhaven', '2018 – 2022'], text: 'First Class Honours. Dissertation on incremental compilation for large monorepos.' },
        { title: 'A Levels', meta: ['Ashdown Grammar School', '2011 – 2018'], text: 'Mathematics, Physics and Computing.' },
      ],
    },

    // The town raises a guild hall for each of the first six items. `trade` chooses what stands
    // outside it: exchange (a market house), school (a schoolroom), lodge (a master builder's
    // crane), ledger (a clerks' hall) or workshop (a wheelwright's yard). `logo` is optional: an
    // image in public/ for the hall's banners and the panel's shield.
    {
      id: 'experience', place: 'town', panel: 'halls', title: 'Experience', placeName: 'The Guild Town',
      quote: { text: 'Pleasure in the job puts perfection in the work.', by: 'Aristotle' },
      content: [
        { role: 'Senior Software Engineer', org: 'Northgate Analytics', trade: 'exchange', place: 'Bristol', period: '2024 – Present', points: ['Leads the build and release tooling for a 200-engineer organisation.', 'Cut median CI time from 41 to 12 minutes with remote caching and test sharding.'] },
        { role: 'Software Engineer', org: 'Oakbuilt Engineering', trade: 'lodge', place: 'Bath', period: '2022 – 2024', points: ['Built the geometry pipeline behind a structural analysis product.', 'Introduced property-based testing across the core solver.'] },
        { role: 'Teaching Assistant', org: 'University of Westhaven', trade: 'school', place: 'Westhaven', period: '2020 – 2022', points: ['Ran labs for the first-year programming course and marked coursework.'] },
        { role: 'Data Engineering Intern', org: 'Kestrel & Lark', trade: 'ledger', place: 'Remote', period: 'Summer 2021', points: ['Moved nightly reporting jobs onto an incremental pipeline.'] },
        { role: 'Volunteer Mentor', org: 'Westhaven Code Club', trade: 'workshop', place: 'Westhaven', period: '2019 – 2021', points: ['Ran weekly sessions teaching young people to build their first games.'] },
      ],
    },

    // Each skill group is a stall at the fair (up to eight), every item its own object on the
    // counter. `trade` dresses the stall: clockmaker, apothecary, glazier, cooper or pedlar.
    {
      id: 'skills', place: 'fair', panel: 'stalls', title: 'Skills', placeName: 'The Fair',
      quote: { text: 'A jack of all trades is a master of none, but oftentimes better than a master of one.', by: 'Anonymous' },
      content: [
        { group: 'Systems', trade: 'clockmaker', items: ['Rust', 'C++', 'Zig'] },
        { group: 'Backend & Data', trade: 'apothecary', items: ['Python', 'Go', 'PostgreSQL'] },
        { group: 'Interfaces', trade: 'glazier', items: ['TypeScript & React', 'Svelte', 'Three.js'] },
        { group: 'Infrastructure', trade: 'cooper', items: ['Kubernetes', 'Terraform', 'Bazel', 'GitHub Actions'] },
        { group: 'Also Worked In', trade: 'pedlar', items: ['Java', 'Kotlin', 'Elixir', 'Haskell', 'Lua'] },
      ],
    },

    // The first six projects are workshops at the mills, under scaffolding while `status` is
    // 'building'. `emblem` adds something outside: clock, tavern, dyer (give it `languages`),
    // press or orrery.
    {
      id: 'projects', place: 'mills', panel: 'workshops', title: 'Projects', placeName: 'The Mills',
      quote: { text: 'Talk is cheap. Show me the code.', by: 'Linus Torvalds' },
      content: [
        { name: 'Tidewater', emblem: 'clock', period: '2025', description: 'A profiler that replays a production trace in slow motion, so you can watch where the time goes.', tags: ['Rust', 'WebGPU'], link: 'https://example.com/tidewater', status: 'done' },
        { name: 'Lantern', emblem: 'tavern', period: '2024', description: 'A tiny static-site generator for recipe collections, with search that works offline.', tags: ['Go'], link: 'https://example.com/lantern', status: 'done' },
        { name: 'Dyehouse', emblem: 'dyer', languages: { Rust: 40, TypeScript: 30, Python: 20, Go: 10 }, period: '2024', description: 'A GitHub Action that charts language usage across every repository you own.', tags: ['Python', 'GitHub Actions'], status: 'done' },
        { name: 'Inkwell', emblem: 'press', period: '2023', description: 'Turns Markdown notes into a printable zine, laid out by a constraint solver.', tags: ['TypeScript'], status: 'done' },
        { name: 'Homelab', period: '2023 – Present', description: 'A small cluster at home, declared entirely in code, with monitoring for every service.', tags: ['NixOS', 'Grafana'], status: 'building' },
        { name: 'Orrery', emblem: 'orrery', period: '2022', description: 'A browser solar system with real orbital mechanics that runs on old laptops.', tags: ['Three.js'], status: 'done' },
        { name: 'Rhythm Lab', period: '2021', description: 'A rhythm game that generates beatmaps from any audio track.', tags: ['DSP'], status: 'done' },
      ],
    },

    // At the harbour inn. An entry with `items` is a list of honours, which become trophies on
    // the shelf by the inn door.
    {
      id: 'interests', place: 'harbour', panel: 'interests', title: 'Outside Work', placeName: 'The Harbour Inn',
      quote: { text: 'No man is really happy or safe without a hobby.', by: 'William Osler' },
      content: [
        { title: 'Music', text: 'Plays cornet in a brass band, and sings in a community choir when the band is quiet.' },
        { title: 'Outdoors', text: 'Climbs indoors in winter and outdoors when the weather allows, and walks long-distance trails.' },
        { title: 'Recognition', items: [['City Hack', 'winner, 2024'], ['Westhaven Code Jam', 'runner-up, 2021'], ['Open Source Award', 'nominee, 2023']] },
      ],
    },

    // Aboard the ship at sea. With the `globe` layout and content { visited: ['GB', 'FR', ...],
    // wishlist: [...] } (two-letter country codes) a globe on deck lights up the countries
    // visited; here it carries writing and talks instead.
    {
      id: 'writing', place: 'ship', panel: 'entries', title: 'Writing & Talks', placeName: 'Further Afield',
      quote: { text: 'Either write something worth reading or do something worth writing.', by: 'Benjamin Franklin' },
      content: [
        { title: 'Build systems are product', meta: ['Talk', 'Tooling Conf', '2025'], text: 'Why a build pipeline deserves a roadmap, an owner and users who are listened to.', link: 'https://example.com/talks/build-systems' },
        { title: 'Watching Time Go By', meta: ['Article', '2024'], text: 'Building a slow-motion profiler, and what it showed about where the time really goes.', link: 'https://example.com/writing/profiling' },
      ],
    },

    {
      id: 'contact', place: 'coast', panel: 'contact', title: 'Contact', placeName: 'The Coast at Nightfall',
      quote: { text: 'So long, and thanks for all the fish.', by: 'Douglas Adams' },
      content: {
        blurb: 'Always happy to talk about developer tooling, build systems and interesting side projects.',
        links: [
          { label: 'Email', text: 'robin@example.com', href: 'mailto:robin@example.com' },
          { label: 'GitHub', text: '@example', href: 'https://github.com/example' },
          { label: 'LinkedIn', text: 'Robin Ashdown', href: 'https://linkedin.com/in/example' },
        ],
      },
    },
  ],

  // Links shown as a pencilled margin note beside the entry they are about: writing, a talk, a
  // repository. `at` is the stop's id, a colon and the entry's name (a role, a skill group, an
  // entry's title). Optional: `minutes` to read, `lead` (the words before the link, 'I wrote
  // about this:' by default) and `said`, which a passer-by says about it on foot.
  writings: [
    { id: 'profiling', at: 'skills:Systems', minutes: 9, title: 'Watching Time Go By: Building a Slow-Motion Profiler', url: 'https://example.com/writing/profiling', said: 'Robin wrote about profiling, you know. Slow motion, of all things.' },
  ],

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

    // Things to find. Switch any of them off with false.
    eggs: {
      compass: true, // a compass on the ship that turns the time of day, and the year
      choir: true, // linger at the abbey and the cloister choir sings
      seasonalScenes: true, // sowing, haymaking, harvest, a bonfire, a Yule tree, snowmen
      rumour: true, // a hint at something to find when the valley loads
    },

    // First-person walking (the 'Explore more on foot' button on the contact stop, or ?walk)
    walk: true,

    // Lines the townsfolk say to each other on foot, added to the built-in ones
    chatter: [
      ['Robin was in the band again last night.', 'Any good?', 'Loud. Very loud.'],
    ],
  },
};
