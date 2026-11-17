// Shows the number of unique visitors, read from public/visitors.json at load. Anything that
// writes that file can feed it: `{ "count": 1234, "lifetime": 9876 }`, where count is this site
// and lifetime is every site together, or just `1234` for the count alone. A number that is
// missing, unreadable or zero is left out, and the line stays hidden if both are.
const num = v => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? n : 0; };
const fmt = n => n.toLocaleString('en-GB');

export async function showVisitors(el, src = 'visitors.json') {
  try {
    const res = await fetch(src, { cache: 'no-store' });
    if (!res.ok) return;
    const text = (await res.text()).trim();
    let count, lifetime;
    try {
      const data = JSON.parse(text);
      if (typeof data === 'number') count = data;
      else {
        count = data.count ?? data.visitors ?? data.unique;
        lifetime = data.lifetime ?? data.total;
      }
    } catch {
      count = Number(text);
    }
    count = num(count);
    lifetime = num(lifetime);
    let line = '';
    if (count) line = `${fmt(count)} ${count === 1 ? 'traveller has' : 'travellers have'} passed this way`;
    if (lifetime) line += line ? `, and ${fmt(lifetime)} along all my roads.` : `${fmt(lifetime)} ${lifetime === 1 ? 'traveller has' : 'travellers have'} passed along all my roads.`;
    else if (line) line += '.';
    if (!line) return;
    el.textContent = line;
    el.hidden = false;
  } catch { /* offline or blocked: leave it hidden */ }
}
