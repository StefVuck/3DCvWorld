// Where each built-in place kit sits in the valley. `z` runs from the mountains (-9000) to the sea
// (+9000); `offset` is the distance east (+) or west (-) of the river; `r` is the radius of the
// flat shelf the settlement stands on, `blend` how gently it meets the hillside, and `lift` how
// far it is raised above the ground there. A stop can override any of these with its own `site`,
// and a new place kit gives its whole site that way (npm run new-stop does it for you).
export const SITE_DEFAULTS = {
  watchtower: { z: -7600, offset: 450, r: 15, blend: 40, lift: 0.5 },
  homestead: { z: -4600, offset: 330, r: 52, blend: 75, lift: 1.5 },
  abbey: { z: -2800, offset: -720, r: 60, blend: 85, lift: 1 },
  town: { z: 600, offset: 160, r: 118, blend: 110, lift: 1.5 },
  fair: { z: 2700, offset: -105, r: 60, blend: 70, lift: 0.8 },
  mills: { z: 4400, offset: 92, r: 52, blend: 70, lift: 1.2 },
  harbour: { z: 7650, offset: 118, r: 62, blend: 80, lift: 2.4 },
};

// Places by the water have a live reflection in their view
export const REFLECTIVE = new Set(['mills', 'harbour', 'ship', 'coast']);

// Two stops that are not settlements: aboard the ship at sea, and the coast at nightfall
export const SEA = new Set(['ship', 'coast']);
