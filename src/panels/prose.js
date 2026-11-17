import { el } from './kit.js';

// Paragraphs of text. Content: a string, or a list of strings (one per paragraph).
export default function prose(stop) {
  return [].concat(stop.content ?? []).map(p => el('p', { text: p }));
}
