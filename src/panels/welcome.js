import { el } from './kit.js';

// The opening stop: who you are, large, over the landscape. Content is ignored; it reads `person`.
export default function welcome(stop, cv) {
  return [
    el('p', { class: 'kicker', text: cv.location }),
    el('h1', { text: cv.name }),
    el('p', { class: 'title', text: cv.title }),
    el('p', { class: 'tagline', text: cv.tagline }),
    el('p', { class: 'cue', text: stop.content?.cue ?? 'Scroll to set out down the valley' }),
  ];
}
