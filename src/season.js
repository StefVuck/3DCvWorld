// The valley follows the real calendar month by month: snow comes and goes through late autumn
// to early spring, orchards and hawthorns blossom in spring, the woods turn in autumn, and the
// moon shows its real phase. ?month=1-12, ?season= and ?moon= override the date for testing.
import { WORLD } from './world-config.js';

const params = new URLSearchParams(location.search);
const now = new Date();

// How strongly each part of the year shows, January to December
const YEAR = {
  winter: [1, 0.9, 0.35, 0, 0, 0, 0, 0, 0, 0, 0.3, 0.8],
  blossom: [0, 0, 0.3, 0.9, 0.55, 0.1, 0, 0, 0, 0, 0, 0],
  autumn: [0.15, 0, 0, 0, 0, 0, 0, 0.05, 0.35, 0.8, 0.95, 0.45],
  snowLine: [380, 420, 700, 1000, 1150, 1300, 1320, 1320, 1250, 1150, 800, 450],
};
export const WINTER_SNOW_LINE = 380;
const NAMED = { winter: 0, spring: 3, summer: 6, autumn: 9 };

// world.config.js can fix the valley to one month or season instead of following the calendar
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const fixed = String(WORLD.season).toLowerCase();
const configured = MONTHS.includes(fixed) ? MONTHS.indexOf(fixed) : NAMED[fixed];
const asked = params.has('month') ? Number(params.get('month')) - 1 : NAMED[params.get('season')] ?? configured;
const calendar = Number.isInteger(asked) && asked >= 0 && asked < 12 ? asked : now.getMonth();

// Days since a known new moon (6 January 2000, 18:14 UTC) over the synodic month
const SYNODIC = 29.530588853;
const phase = params.has('moon') ? Number(params.get('moon')) : ((((now - Date.UTC(2000, 0, 6, 18, 14)) / 86400000) % SYNODIC) + SYNODIC) % SYNODIC / SYNODIC;

const hour = now.getHours();
export const SEASON = {
  calendar,
  moonPhase: phase,
  // Real evening on the visitor's clock
  evening: params.has('evening') || hour >= 17 || hour < 5,
};

function apply(m) {
  const amounts = Object.fromEntries(Object.entries(YEAR).map(([k, v]) => [k, v[m]]));
  Object.assign(SEASON, {
    month: m,
    winterAmount: amounts.winter,
    blossomAmount: amounts.blossom,
    autumnAmount: amounts.autumn,
    snowLine: amounts.snowLine,
    winter: amounts.winter >= 0.5,
    blossom: amounts.blossom >= 0.5,
  });
}
apply(calendar);

// Scenes that belong to part of the year: sowing, haymaking, harvest, Bonfire Night, snowmen, Yule
const FESTIVAL = {
  'season:sowing': m => m === 2 || m === 3,
  'season:hay': m => m >= 5 && m <= 7,
  'season:harvest': m => m === 8 || m === 9,
  'season:bonfire': m => m === 10,
  'season:yule': m => m === 11,
  'season:snow': () => SEASON.winterAmount >= 0.75,
};
export const inSeason = tag => FESTIVAL[tag]?.(SEASON.month) ?? true;

// The back of the day compass turns the year; null goes back to the calendar's month
const listeners = [];
export const onSeason = fn => listeners.push(fn);
export function setMonth(m) {
  m ??= SEASON.calendar;
  if (m === SEASON.month) return;
  apply(m);
  for (const fn of listeners) fn(SEASON);
}
