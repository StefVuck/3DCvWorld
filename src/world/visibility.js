// The journey only ever looks at the valley from a known set of places, so what each stop (and
// each flight between stops) can possibly see is worked out once, after loading: an object is
// visible to an eye if one of its sample points is ahead of it and not hidden behind the hills.

const COS_HALF = Math.cos((80 * Math.PI) / 180);

function sees(eye, p, heightAt, far) {
  const dx = p.x - eye.pos.x, dy = p.y - eye.pos.y, dz = p.z - eye.pos.z;
  const d = Math.hypot(dx, dy, dz);
  if (d < 250) return true;
  if (d > far) return false;
  if ((dx * eye.dir.x + dy * eye.dir.y + dz * eye.dir.z) / d < COS_HALF) return false;
  const steps = Math.min(40, Math.ceil(d / 50));
  for (let k = 1; k < steps; k++) {
    const s = k / steps;
    const x = eye.pos.x + dx * s, y = eye.pos.y + dy * s, z = eye.pos.z + dz * s;
    if (heightAt(x, z) > y + 2) return false;
  }
  return true;
}

// items: arrays of sample points; eyeSets: arrays of { pos, dir }. Fills out[set] with the
// indices of the items that set can see, one item per step so the work can be spread out.
export function* visibilityJob(items, eyeSets, heightAt, out, far = 9500) {
  for (let i = 0; i < items.length; i++) {
    eyeSets.forEach((eyes, s) => {
      if (eyes.some(eye => items[i].some(p => sees(eye, p, heightAt, far)))) out[s].add(i);
    });
    yield;
  }
}
