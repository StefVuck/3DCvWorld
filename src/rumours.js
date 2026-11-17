// A single rumour, picked at random, drifts in once the valley has loaded: a hint at one of the
// things hidden in it, never the whole answer
import { WORLD } from './world-config.js';
import cv from './cv.js';

// Only hints at things that are switched on in world.config.js
const E = WORLD.eggs;
const calendar = WORLD.season === 'calendar';
const RUMOURS = [
  E.compass && 'Sailors say the compass aboard the ship points to more than north.',
  E.compass && 'They say the compass hides a second face for those who press its crown.',
  E.choir && 'Linger at the abbey a while and the brothers may sing for you.',
  E.dance && 'On real evenings, the fair dances in a ring beneath its flag.',
  E.pigeons && cv.experience.some(j => j.trade === 'exchange') && 'Pigeons fly from the watchtower now and then. Follow them to market.',
  E.cropMark && 'Someone has ploughed strange lines into a field north of the town.',
  'At the fair, a candle burns down the hours of a long night’s work.',
  cv.interests.some(i => i.items) && 'The inn keeps its trophies by the door.',
  cv.experience.some(j => j.trade === 'racing') && 'A racer in team colours tears along the harbour road.',
  'A rider on a penny-farthing wobbles along the road north of the town.',
  calendar && 'The valley keeps the real calendar. Come back in another season.',
  calendar && 'In deep winter, someone skis the slopes above the watchtower.',
  calendar && E.seasonalScenes && 'Come in November and the town lights a bonfire.',
  WORLD.walk && 'The last stop knows a way to wander the valley on foot.',
  'An old stone circle stands on the western heights, if you know where to look.',
].filter(Boolean);

export function rumour() {
  const el = document.querySelector('.rumour');
  const show = () => {
    el.querySelector('p').textContent = RUMOURS[Math.floor(Math.random() * RUMOURS.length)];
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('shown'));
    const hide = () => { el.classList.remove('shown'); setTimeout(() => { el.hidden = true; }, 900); };
    const timer = setTimeout(hide, 11000);
    el.querySelector('button').addEventListener('click', () => { clearTimeout(timer); hide(); }, { once: true });
  };
  // Waits for the Firefox note, if there is one, to be put away first
  const note = document.querySelector('.gecko-note');
  if (note && !note.hidden) note.querySelector('button').addEventListener('click', () => setTimeout(show, 1200), { once: true });
  else show();
}
