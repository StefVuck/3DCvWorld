// Firefox and the browsers built on it (Zen, LibreWolf, Floorp) draw this scene far more slowly
// than Chromium or Safari, so their readers get a gentle note once, which they can put away
const KEY = 'valley-gecko-note';
export function geckoNote() {
  const ua = navigator.userAgent;
  if (!/\bFirefox\//.test(ua) && !(/\bGecko\/\d/.test(ua) && !/like Gecko/i.test(ua))) return;
  try { if (localStorage.getItem(KEY)) return; } catch { /* private mode */ }
  const el = document.querySelector('.gecko-note');
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('shown'));
  el.querySelector('button').addEventListener('click', () => {
    el.classList.remove('shown');
    setTimeout(() => { el.hidden = true; }, 600);
    try { localStorage.setItem(KEY, 'seen'); } catch { /* private mode */ }
  });
}
