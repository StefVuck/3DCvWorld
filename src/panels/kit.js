// Building blocks for panel layouts: elements, links, coats of arms, margin notes and visit buttons
import { drawArms, drawLogo, loadImage } from '../world/heraldry.js';

export function el(tag, props = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'text') n.textContent = v;
    else if (k === 'class') n.className = v;
    else n.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c) n.append(c);
  return n;
}

export function shield(seed, w = 40, h = 48, logo = null) {
  const c = el('canvas', { class: 'arms', width: w * 2, height: h * 2, 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  ctx.scale(2, 2);
  ctx.beginPath();
  ctx.moveTo(1, 1); ctx.lineTo(w - 1, 1); ctx.lineTo(w - 1, h * 0.55);
  ctx.quadraticCurveTo(w - 1, h * 0.88, w / 2, h - 1);
  ctx.quadraticCurveTo(1, h * 0.88, 1, h * 0.55);
  ctx.closePath();
  const outline = new Path2D();
  outline.moveTo(1, 1); outline.lineTo(w - 1, 1); outline.lineTo(w - 1, h * 0.55);
  outline.quadraticCurveTo(w - 1, h * 0.88, w / 2, h - 1);
  outline.quadraticCurveTo(1, h * 0.88, 1, h * 0.55);
  outline.closePath();
  const edge = () => { ctx.strokeStyle = 'rgba(47,42,34,0.7)'; ctx.lineWidth = 1.2; ctx.stroke(outline); };
  ctx.save();
  ctx.clip(outline);
  if (logo) {
    ctx.fillStyle = logo.field ?? '#f6f0e2';
    ctx.fillRect(0, 0, w, h);
    loadImage(logo.src).then(img => {
      ctx.save();
      ctx.clip(outline);
      drawLogo(ctx, img, 0, 0, w, h, logo);
      ctx.restore();
      edge();
    }).catch(() => {});
  } else drawArms(ctx, 0, 0, w, h, seed);
  ctx.restore();
  edge();
  return c;
}

export function pennant(seed, w = 34, h = 22) {
  const c = el('canvas', { class: 'pennant', width: w * 2, height: h * 2, 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  ctx.scale(2, 2);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(w, h / 2); ctx.lineTo(0, h);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  drawArms(ctx, 0, 0, w, h, seed);
  ctx.restore();
  return c;
}

// A pencilled note in the margin of an entry, pointing to something written about it. `at` is
// the stop's id, a colon and the entry's name, as in world.config.js `writings`.
export function notes(cv, at) {
  return (cv.writings || []).filter(w => w.at === at).map(w => el('aside', { class: 'margin-note' }, [
    el('span', { class: 'note-lead', text: w.lead ?? 'I wrote about this:' }),
    link(w.url, w.title),
    w.minutes ? el('span', { class: 'note-time', text: `${w.minutes} min read` }) : null,
  ]));
}

// A button that flies the camera to the entry's place in the valley; the entry needs a
// data-link of the stop's id, a colon and its index, matching an anchor the place kit set
export const visit = label => el('button', { class: 'visit', type: 'button', text: label });

export const link = (href, text) => (href ? el('a', { href, target: href.startsWith('mailto:') ? '_self' : '_blank', rel: 'noopener', text }) : document.createTextNode(text));

const regionNames = typeof Intl !== 'undefined' && Intl.DisplayNames ? new Intl.DisplayNames(['en-GB'], { type: 'region' }) : null;
const NAMES = { HK: 'Hong Kong', BA: 'Bosnia and Herzegovina', VA: 'Vatican City' };
export const countryName = code => NAMES[code] ?? (regionNames ? regionNames.of(code) : code);

