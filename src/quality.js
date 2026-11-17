// Every device draws the same valley; phones and tablets are only held to 30 frames a second,
// which halves the work and spares the battery. ?quality=low or ?quality=high overrides the guess.
const forced = new URLSearchParams(location.search).get('quality');
const touch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
const small = Math.min(window.innerWidth, window.innerHeight) <= 720;

export const LOW = forced ? forced === 'low' : touch || small;

export const Q = {
  pixelRatio: 1.5, paintScale: 1, minScale: 0.7, maxScale: 1, kuwaharaRadius: 3, frameMs: LOW ? 1000 / 30 : 0,
  terrain: [640, 1100], terrainShadow: 1024, localShadow: 2048, reflection: 0.3,
  grass: 1, trees: 1, hiDistance: 650, midDistance: 2800, farDistance: 9000,
};
