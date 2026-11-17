import { WebGLRenderer, Scene, PerspectiveCamera, Vector3, Vector2, MeshBasicMaterial, MathUtils, Matrix4, Quaternion, Group } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Lenis from 'lenis';
import { riverX, waterLevel } from './world/valley.js';
import { buildHeightTexture, buildTerrain, meshHeightSampler, TerrainShadowBake } from './world/terrain.js';
import { placeTrees, Forest } from './world/trees.js';
import { buildWater, swellUniforms } from './world/water.js';
import { swell } from './world/waves.js';
import { buildShip, GLOBE_AT } from './world/ship.js';
import { buildGlobe } from './world/globe.js';
import { buildGlow } from './world/glow.js';
import { anchors } from './world/links.js';
import { visibilityJob } from './world/visibility.js';
import { buildSky } from './world/sky.js';
import { shared, state, setTimeOfDay } from './atmosphere.js';
import { Painterly } from './post/painterly.js';
import { buildPlaces } from './world/places/index.js';
import { Builder, buildingMeshes } from './world/kit.js';
import { GroundAtlas } from './world/ground.js';
import { Heraldry } from './world/heraldry.js';
import { Banners } from './world/banners.js';
import { Spinners } from './world/spinners.js';
import { scatterDetail } from './world/detail.js';
import { buildSmoke } from './world/smoke.js';
import { buildSnowfall } from './world/snowfall.js';
import { People, Birds } from './world/people.js';
import { Wares } from './world/wares.js';
import { Carts } from './world/carts.js';
import { buildLore } from './world/lore.js';
import { SEASON, onSeason, inSeason } from './season.js';
import { Compass, buildBinnacle } from './compass.js';
import { showVisitors } from './visitors.js';
import { LocalShadow } from './world/shadows.js';
import { Reflection } from './world/reflection.js';
import { STOPS, Journey } from './journey.js';
import { buildPanels, pruneVisits } from './panels.js';
import { Minimap } from './minimap.js';
import cv from './cv.js';
import { Q, LOW } from './quality.js';
import { Soundscape } from './audio.js';
import { WORLD } from './world-config.js';
import { Walk } from './walk.js';
import { geckoNote } from './gecko.js';
import { rumour } from './rumours.js';
import { Talk } from './talk.js';
import { Chatter } from './chatter.js';

const params = new URLSearchParams(location.search);
const still = params.has('still');
const debug = params.has('debug');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const statusEl = document.querySelector('.loading p');
const frame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
const status = async msg => { statusEl.textContent = msg; await frame(); };

// Nothing the reader does while the valley is loading should move the journey along: the page
// is held at the top, scrolling and scroll keys are swallowed, and the browser is told not to
// restore an old scroll position on reload
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const SCROLL_KEYS = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End'];
const holdStill = e => {
  if (e.type === 'keydown' && !SCROLL_KEYS.includes(e.key)) return;
  e.preventDefault();
  e.stopImmediatePropagation();
};
const holdEvents = ['wheel', 'touchmove', 'keydown'];
for (const ev of holdEvents) window.addEventListener(ev, holdStill, { passive: false, capture: true });
document.documentElement.classList.add('holding');
function releaseHold() {
  for (const ev of holdEvents) window.removeEventListener(ev, holdStill, { capture: true });
  document.documentElement.classList.remove('holding');
  window.scrollTo(0, 0);
}

buildPanels(document.querySelector('#journey'), STOPS, cv);
showVisitors(document.querySelector('.visitors'));
if (debug) document.body.classList.add('debug-on');

const renderer = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: still });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, still ? 1 : Q.pixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
document.querySelector('.stage').append(renderer.domElement);

const scene = new Scene();
const camera = new PerspectiveCamera(42, window.innerWidth / window.innerHeight, 3, 40000);

const [NX, NZ] = Q.terrain;
let chatter, townsfolk, talk, snowfall, walker, compass, binnacle, lore, traffic, wares, swellMesh, heightCPU, folk, flocks, meshHeight, forest, places, details = [], localShadow, reflection, spinners, buildings, journey, minimap, ship, globe, glow, terrainBake;
const staticCasters = [];

function stopViews() {
  const v = (pos, look) => ({ pos: pos.clone(), look: look.clone() });
  return STOPS.map(s => {
    if (s.view) return v(new Vector3(), new Vector3(0, 0, 1));
    const p = places[s.place];
    if (!p) return v(new Vector3(0, 200, -9000), new Vector3(0, 0, 0));
    // A stop can frame itself with `camera` ({ pos, look, subject } in the place's own frame);
    // otherwise the place kit's view is used (its wide welcome view on the opening stop)
    if (s.camera) {
      const pt = a => p.place.point(...a);
      return { ...v(pt(s.camera.pos), pt(s.camera.look)), subject: s.camera.subject ? pt(s.camera.subject) : pt(s.camera.look) };
    }
    const view = (s.panel === 'welcome' && p.welcomeView) || p.view;
    return { ...v(view.pos, view.look), subject: view.subject ?? p.place.point(0, 5, 0), ...(view.frame !== undefined ? { frame: view.frame } : {}) };
  });
}

async function build() {
  await status('Surveying the valley');
  const { tex, bounds, sampleCPU } = buildHeightTexture(512);
  heightCPU = sampleCPU;

  await status('Raising the hills');
  const canopyUniform = { value: null };
  const terrain = buildTerrain({ nx: NX, nz: NZ, heightTex: tex, heightBounds: bounds, canopy: { uniform: canopyUniform, bounds: null } });
  meshHeight = meshHeightSampler(terrain, NX, NZ);
  terrainBake = new TerrainShadowBake(renderer, Q.terrainShadow);

  await status('Raising the settlements');
  const builder = new Builder();
  const heraldry = new Heraldry();
  const banners = new Banners(heraldry);
  spinners = new Spinners();
  const people = new People(), birds = new Birds();
  townsfolk = people;
  wares = new Wares();
  places = buildPlaces({ builder, heraldry, banners, spinners, cv, people, birds, wares });
  await status('Peopling the roads and the river');
  const carts = new Carts();
  lore = buildLore({ places, builder, people, birds, carts, banners, heraldry, meshHeight, terrain, cv });
  folk = people.build();
  flocks = birds.build();
  traffic = carts.build();
  buildings = buildingMeshes(builder, places.map(p => p.parts));
  const bannerMesh = banners.build();

  const atlas = new GroundAtlas();
  for (const p of places) atlas.paint(p.place, p.groundSize, p.paint);
  atlas.finish();
  terrain.material.uniforms.uSiteAtlas.value = atlas.texture;
  atlas.bounds.forEach((b, i) => terrain.material.uniforms.uSiteBounds.value[i].copy(b));
  terrain.material.uniforms.uSiteCount.value = atlas.count;

  await status('Planting woods and hedgerows');
  const trees = placeTrees(meshHeight, sampleCPU, places.flatMap(p => p.extras));
  forest = new Forest(trees, sampleCPU);
  canopyUniform.value = forest.canopy.uniform.value;
  terrain.material.uniforms.uCanopyBounds.value = forest.canopy.bounds;

  await status('Sowing the meadows');
  details = places.map(p => scatterDetail({
    centre: p.place.centre, radius: p.detail.radius, count: Math.round(p.detail.count * Q.grass), meshHeight, heightCPU: sampleCPU, decal: atlas,
  }));
  const smoke = new Group();
  let smokeMaterial = null;
  places.forEach((p, k) => {
    if (!p.chimneys.length) return;
    const m = buildSmoke(p.chimneys, 70, smokeMaterial);
    smokeMaterial = m.material;
    m.userData.placeIndex = k;
    smoke.add(m);
  });

  await status('Rigging the ship');
  const shipPos = new Vector3(riverX(9450) - 40, 0, 9450);
  ship = buildShip(heraldry, cv, shipPos, new Vector3(-0.3, 0, 0.95));
  binnacle = buildBinnacle();
  if (WORLD.eggs.compass) ship.group.add(binnacle);
  globe = buildGlobe(cv.travel);
  globe.group.position.copy(GLOBE_AT);
  // The globe stands on deck only when the ship's stop lists places visited (the globe layout)
  if (Array.isArray(cv.byPlace('ship')?.visited)) ship.group.add(globe.group);
  Object.assign(swell, { x: shipPos.x, z: shipPos.z });
  swellUniforms.uSwell.value.set(shipPos.x, shipPos.z, swell.radius, 1);
  swellUniforms.uShip.value.set(shipPos.x, shipPos.z, ship.heading.x, ship.heading.z);
  const lighthouse = places.find(p => p.lighthouse)?.lighthouse;
  glow = buildGlow(lighthouse ? [lighthouse, ship.lantern] : [ship.lantern]);

  await status('Filling the river');
  const water = buildWater();
  swellMesh = water.userData.swell;
  swellMesh.visible = true;
  smokeGroup = smoke;
  scene.add(buildSky(), terrain, water, forest.group, buildings, spinners.group, smoke, ship.group, glow.mesh, ...details.map(d => d.mesh));
  if (bannerMesh) {
    scene.add(bannerMesh);
    bannerGroup = bannerMesh;
    for (const m of bannerMesh.children) {
      const c = m.geometry.boundingSphere.center;
      let best = -1, bd = 400;
      places.forEach((p, k) => { const d = Math.hypot(p.place.centre.x - c.x, p.place.centre.z - c.z); if (d < bd) { bd = d; best = k; } });
      m.userData.placeIndex = best;
    }
  }
  snowfall = buildSnowfall();
  scene.add(snowfall);
  scene.add(folk, flocks, traffic, wares.group, ...places.flatMap(p => p.meshes ?? []), ...lore.meshes.map(e => e.mesh), ...lore.windows);

  localShadow = new LocalShadow(renderer, Q.localShadow);
  const depth = new MeshBasicMaterial({ colorWrite: false });
  for (const mesh of buildings.children) if (!mesh.userData.interior) staticCasters.push({ mesh, depthMaterial: depth });
  for (const it of spinners.items) staticCasters.push({ mesh: it.mesh, depthMaterial: depth });
  reflection = new Reflection(renderer, Q.reflection);
  // The reflection is small and blurred: figures, carts, wares and lit windows would not show in it
  reflection.hide = [water, smoke, snowfall, glow.mesh, flocks, folk, traffic, wares.group, ...lore.windows, ...lore.meshes.filter(e => e.mesh.isPoints).map(e => e.mesh), ...details.map(d => d.mesh), ...(bannerMesh ? [bannerMesh] : [])];

  journey = new Journey(STOPS, stopViews(), (x, z) => meshHeight(x, z));
  lens();
  camera.updateProjectionMatrix();
  minimap = new Minimap(document.querySelector('.minimap'), STOPS, journey.views, i => goToStop(i));
  ship.update(0);
  if (shipStop >= 0) minimap.setMarker(shipStop, ship.group.position.x, ship.group.position.z);
  if (coastStop >= 0) minimap.setMarker(coastStop, ship.group.position.x + 250, ship.group.position.z + 500);

  for (const g of [folk, flocks, traffic]) for (const m of g.children) m.userData.placeIndex = places.findIndex(p => p.place.id === m.userData.tag);
  // Nothing in the valley moves except through its shaders, so world matrices are fixed once
  for (const root of [terrain, forest.group, buildings]) {
    root.updateMatrixWorld(true);
    root.traverse(o => { o.matrixAutoUpdate = false; o.matrixWorldAutoUpdate = false; });
  }
  shipViews();
  startVisibility();

  await status('Casting long shadows');
  setTimeOfDay(STOPS[0].time);
  runSunJobNow();
  // Compile every shader now, behind the loading screen, rather than on first sight mid-journey
  await status('Mixing the paints');
  try { await renderer.compileAsync(scene, camera); } catch { /* falls back to compiling on first use */ }
  console.info(`trees: ${trees.length}, detail: ${details.reduce((a, d) => a + d.mesh.geometry.instanceCount, 0)}`);
}

// What each stop and each flight can see, so everything else can be left undrawn
const vis = { job: null, ready: false, sets: [], chunks: 0, states: [] };
function eyeOf(pose) {
  return { pos: pose.pos.clone(), dir: new Vector3(0, 0, -1).applyQuaternion(pose.quat) };
}
function startVisibility() {
  const n = STOPS.length;
  const blank = () => ({ pos: new Vector3(), quat: new Quaternion(), time: 0 });
  const sets = Array.from({ length: 2 * n - 1 }, () => []);
  for (const portrait of [false, true]) {
    journey.setPortrait(portrait, portrait ? 56 : 42);
    for (let i = 0; i < n; i++) {
      for (const drift of [0, 0.5, 1]) sets[i].push(eyeOf(journey.dwellPose(i, drift, blank())));
      if (i < n - 1) for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) sets[n + i].push(eyeOf(journey.pose({ i, t, travel: true, drift: 1 }, blank())));
    }
  }
  lens();
  anchors.forEach(a => { if (a.view) sets[a.stop].push({ pos: a.view.clone(), dir: a.pos.clone().sub(a.view).normalize() }); });
  const items = forest.chunks.map(c => {
    const step = Math.max(1, Math.floor(c.list.length / 10));
    const pts = [];
    for (let k = 0; k < c.list.length; k += step) {
      const t = c.list[k];
      pts.push(new Vector3(t.x, t.y + t.scale * 1.5 * t.stretch, t.z));
    }
    return pts;
  });
  vis.chunks = items.length;
  for (const p of places) {
    const c = p.place.centre;
    const pts = [[0, 0], [45, 45], [-45, 45], [45, -45], [-45, -45]].map(([x, z]) => new Vector3(c.x + x, c.y + 10, c.z + z));
    if (p.lighthouse) pts.push(p.lighthouse.clone());
    items.push(pts);
  }
  items.push([ship.group.position.clone().setY(12)]);
  // Figures, animals, boats and landmarks outside the settlements are tested in their own right
  const around = s => [s.center.clone(), ...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([x, z]) => s.center.clone().add(new Vector3(x * s.radius * 0.7, 2, z * s.radius * 0.7)))];
  vis.extras = [];
  const extra = (objects, points) => { vis.extras.push({ objects, index: items.length }); items.push(points); };
  for (const g of [folk, flocks, traffic]) for (const m of g.children) if (m.userData.placeIndex < 0) extra([m], around(m.boundingSphere));
  for (const e of lore.meshes) {
    if (e.always) continue;
    e.mesh.geometry.computeBoundingSphere();
    extra([e.mesh], e.points?.length ? e.points : around(e.mesh.geometry.boundingSphere));
  }
  vis.sets = sets.map(() => new Set());
  vis.job = visibilityJob(items, sets, heightCPU, vis.sets);
  vis.t0 = performance.now();
}
function finishVisibility() {
  const n = STOPS.length, s = vis.sets;
  vis.states = s.slice(0, n).concat(s.slice(n).map((f, i) => new Set([...f, ...s[i], ...s[i + 1]])));
  vis.ready = true;
  vis.job = null;
  if (debug) console.info(`visibility ready in ${(performance.now() - vis.t0).toFixed(0)} ms; ${vis.states.map(s => s.size).join(',')}`);
}
function stepVisibility(budgetMs) {
  if (!vis.job) return;
  const t0 = performance.now();
  while (performance.now() - t0 < budgetMs) {
    if (vis.job.next().done) return finishVisibility();
  }
}

// Only the stops where water is a real part of the picture get a live reflection; elsewhere the
// river is out of view or a thin distant ribbon, and the water's own sky reflection is enough.
// Where it is on it is redrawn every frame: a reflection refreshed less often lags the drifting
// camera and then jumps to catch up, which reads as the water juddering.
function wantsReflection() {
  const on = STOPS[lastLoc.i].reflect || (lastLoc.travel && STOPS[lastLoc.i + 1]?.reflect);
  if (!on) shared.uReflectOn.value = 0;
  return on;
}

// Things belonging to stops two or more away are not drawn unless that stop's view can see them
let lastLoc = { i: 0, travel: false }, fireworks, smokeGroup, bannerGroup;
const placeOn = [];
function cullByStop() {
  const n = STOPS.length;
  const walking = walker?.on;
  const set = vis.ready && !jump.on && !walking ? vis.states[lastLoc.travel ? n + lastLoc.i : lastLoc.i] : null;
  const lo = lastLoc.i - 1, hi = lastLoc.i + (lastLoc.travel ? 1 : 0) + 1;
  const near = s => jump.on || (s >= lo && s <= hi);
  // On foot the stops' sight lines mean nothing, so settlements are drawn within a few miles
  const within = (p, r) => Math.hypot(p.x - camera.position.x, p.z - camera.position.z) < r;
  places.forEach((p, k) => {
    placeOn[k] = walking ? within(p.place.centre, walker.flight ? 6000 : 3500) : !set || set.has(vis.chunks + k) || STOPS.some((s, i) => s.place === k && near(i));
  });
  const shipOn = walking ? within(ship.group.position, 4000) : !set || set.has(vis.chunks + places.length) || STOPS.some((s, i) => s.view && near(i));
  for (const m of buildings.children) {
    m.visible = m.userData.place < 0 || placeOn[m.userData.place];
    if (m.userData.interior && m.visible) {
      const s = m.geometry.boundingSphere;
      m.visible = camera.position.distanceTo(s.center) - s.radius < 60;
    }
  }
  for (const m of smokeGroup.children) m.visible = placeOn[m.userData.placeIndex];
  for (const m of bannerGroup?.children ?? []) m.visible = m.userData.placeIndex < 0 || placeOn[m.userData.placeIndex];
  places.forEach((p, k) => {
    for (let j = p.spun[0]; j < p.spun[1]; j++) spinners.items[j].mesh.visible = placeOn[k];
    for (const m of p.meshes ?? []) m.visible = placeOn[k];
  });
  for (const g of [folk, flocks, traffic]) for (const m of g.children) if (m.userData.placeIndex >= 0) m.visible = m.visible && placeOn[m.userData.placeIndex];
  for (const e of vis.extras ?? []) for (const o of e.objects) o.visible = o.visible !== false && (!set || set.has(e.index));
  for (const m of lore.windows) m.visible = placeOn[m.userData.placeIndex] && shared.uWindowGlow.value > 0.01;
  // Fireworks only go up after dark, over the town
  fireworks ??= lore.meshes.find(e => e.mesh.isPoints)?.mesh ?? false;
  if (fireworks) fireworks.visible = fireworks.visible && placeOn[places.findIndex(p => p.place.id === 'town')] && shared.uWindowGlow.value > 0.3;
  for (const m of traffic.children) if (m.userData.tag === 'skier') m.visible = m.visible && SEASON.winter;
  for (const m of folk.children) if (m.userData.tag.startsWith('season:')) m.visible = m.visible && inSeason(m.userData.tag);
  for (const e of lore.meshes) if (e.mesh.userData.tag?.startsWith('season:')) e.mesh.visible = e.mesh.visible && inSeason(e.mesh.userData.tag);
  for (const m of lore.windows) if (m.userData.tag) m.visible = m.visible && inSeason(m.userData.tag);
  details.forEach((d, k) => { d.mesh.visible = d.mesh.visible && placeOn[k]; });
  wares.group.visible = placeOn[places.findIndex(p => p.place.id === 'fair')];
  ship.group.visible = shipOn;
  swellMesh.visible = shipOn;
  glow.mesh.visible = shared.uWindowGlow.value > 0.001;
  return set;
}

// Sun-dependent work (tree occlusion, cast shadows on the ground, grass shading) is too heavy
// for one frame, so it runs as a job sliced across frames whenever the light has moved enough.
let sunJob = null, sunPending = false, sunTime = -1;
function* sunWork() {
  const L = shared.uSunDir.value.clone();
  yield* forest.sunJob(L);
  for (const d of details) yield* d.sunJob(L);
}
function requestSun() { sunPending = true; terrainBake.bake(); }
function stepSunJob(budgetMs) {
  if (!sunJob && sunPending) { sunJob = sunWork(); sunPending = false; }
  if (!sunJob) return;
  const t0 = performance.now();
  while (performance.now() - t0 < budgetMs) {
    if (sunJob.next().done) {
      sunJob = null;
      refreshShadow(true);
      return;
    }
  }
}
function runSunJobNow() {
  terrainBake.bake();
  sunJob = sunWork();
  while (!sunJob.next().done);
  sunJob = null;
  sunTime = state.time;
  refreshShadow(true);
}

let shadowPlace = -1;
function nearestPlace() {
  let best = 0, bd = Infinity;
  places.forEach((p, i) => {
    const d = Math.hypot(p.place.centre.x - camera.position.x, p.place.centre.z - camera.position.z);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

const shipCasters = () => [{ mesh: ship.mesh, depthMaterial: new MeshBasicMaterial({ colorWrite: false, side: 2 }) }];
let shipShadowCasters = null;
function refreshShadow(force = false) {
  const nearShip = camera.position.distanceTo(ship.group.position) < 160;
  if (nearShip) {
    if (shadowPlace !== -2) {
      shadowPlace = -2;
      localShadow.radius = 26;
      Object.assign(localShadow.camera, { left: -26, right: 26, top: 26, bottom: -26 });
      localShadow.setCasters(shipShadowCasters ??= shipCasters());
    }
    if (force || frameNo % 2 === 0) localShadow.update(scene, shared.uSunDir.value, ship.group.position);
    return;
  }
  const i = nearestPlace();
  if (i === shadowPlace && !force) return;
  shadowPlace = i;
  const centre = places[i].place.centre;
  const radius = Math.max(70, places[i].groundSize * 0.55);
  localShadow.radius = radius;
  Object.assign(localShadow.camera, { left: -radius, right: radius, top: radius, bottom: -radius });
  localShadow.setCasters([
    ...staticCasters,
    ...forest.shadowCasters(centre, radius).map(mesh => ({ mesh, depthMaterial: forest.depthMaterial })),
  ]);
  localShadow.update(scene, shared.uSunDir.value, centre);
}

const painter = new Painterly(renderer, Q);
if (params.get('paint') === '1') {
  painter.enabled = true;
  painter.qGrade.material.uniforms.uSharpen.value = 0.45;
}
if (params.get('dither') === '0') painter.params.levels.value = 0;

let lenis = null, controls = null, manualTime = null, active = 0;
const pose = { pos: new Vector3(), quat: camera.quaternion.clone(), time: 0 };

const snap = { busy: false, held: false, last: 0, changed: 0, dir: 1 };

function glide(y, duration) {
  snap.busy = true;
  lenis.scrollTo(y, { duration, easing: t => 0.5 - 0.5 * Math.cos(Math.PI * t), onComplete: () => { snap.busy = false; } });
}

// Jumping more than one stop (from the map, or Home and End) flies straight there: the page
// moves at once and the camera takes a single direct flight instead of touring every stop between
const jump = { on: false, from: null, i: 0, start: 0, dur: 0 };
function goToStop(i) {
  if (walker?.on) return walker.travel(STOPS[i].place ?? places.length - 1);
  const y = journey.scrollTarget(i);
  if (!lenis) return window.scrollTo(0, y);
  if (Math.abs(i - active) <= 1) return glide(y, flightTime(lenis.targetScroll, y));
  const target = journey.dwellPose(i, 0.5, { pos: new Vector3(), quat: new Quaternion(), time: 0 });
  Object.assign(jump, {
    on: true, i, start: performance.now(),
    from: { pos: camera.position.clone(), quat: camera.quaternion.clone(), time: state.time },
    dur: MathUtils.clamp(2 + camera.position.distanceTo(target.pos) / 2500, 2.5, 6) * 1000,
  });
  snap.busy = false;
  document.body.classList.add('jumping');
  lenis.scrollTo(y, { immediate: true, force: true });
  snap.last = y;
}

function directFlight(loc) {
  if (!jump.on) return;
  const t = (performance.now() - jump.start) / jump.dur;
  // The panel stays hidden in flight and fades in as the camera arrives
  if (t > 0.85) document.body.classList.remove('jumping');
  if (t >= 1 || loc.travel || loc.i !== jump.i) {
    jump.on = false;
    document.body.classList.remove('jumping');
    return;
  }
  const B = { pos: pose.pos.clone(), quat: pose.quat.clone(), time: pose.time };
  journey.fly(jump.from, B, t, { atSea: !!STOPS[jump.i].view, to: journey.views[jump.i].subject }, pose);
}

// Once the reader stops scrolling between two places, carry them on to the next one in the
// direction they were heading, so every panel settles squarely on screen
function watchSnap(now) {
  const y = lenis.targetScroll;
  if (Math.abs(y - snap.last) > 0.5) {
    if (!snap.busy) snap.dir = Math.sign(y - snap.last) || snap.dir;
    snap.last = y;
    snap.changed = now;
  }
  if (snap.busy || snap.held || now - snap.changed < 180) return;
  const to = journey.snapTarget(y, snap.dir);
  if (to === null || Math.abs(to - y) < 1) return;
  glide(to, flightTime(y, to));
}

// Long enough that the camera never has to rush: scaled by how far it actually travels
function flightTime(from, to) {
  const a = journey.pose(journey.locate(from), { pos: new Vector3(), quat: camera.quaternion.clone(), time: 0 }).pos;
  const b = journey.pose(journey.locate(to), { pos: new Vector3(), quat: camera.quaternion.clone(), time: 0 }).pos;
  const scroll = Math.abs(to - from) / window.innerHeight;
  return MathUtils.clamp(0.8 + scroll * 0.9 + Math.sqrt(a.distanceTo(b)) * 0.05, 0.6, 7);
}

function snapInput() {
  const user = () => { snap.busy = false; };
  window.addEventListener('wheel', user, { passive: true });
  window.addEventListener('touchstart', () => { user(); snap.held = true; }, { passive: true });
  window.addEventListener('touchend', () => { snap.held = false; snap.changed = performance.now(); }, { passive: true });
  window.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.clientX > document.documentElement.clientWidth) snap.held = true; });
  window.addEventListener('pointerup', () => { snap.held = false; });
  window.addEventListener('keydown', e => {
    if (walker?.on || !['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End'].includes(e.key) || e.target.closest?.('input')) return;
    e.preventDefault();
    if (e.key === 'Home') return goToStop(0);
    if (e.key === 'End') return goToStop(STOPS.length - 1);
    const down = e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey);
    const y = lenis.targetScroll, vh = window.innerHeight;
    for (let i = 0; i < STOPS.length; i++) {
      const [lo, hi] = journey.rest(i);
      if (y >= lo - 1 && y <= hi + 1 && hi - lo > 1) {
        const inside = down ? Math.min(hi, y + vh * 0.8) : Math.max(lo, y - vh * 0.8);
        if (Math.abs(inside - y) > 1) return glide(inside, 0.7);
      }
    }
    goToStop(MathUtils.clamp(active + (down ? 1 : -1), 0, STOPS.length - 1));
  });
}

const shipStop = STOPS.findIndex(s => s.view === 'voyage');
const coastStop = STOPS.findIndex(s => s.view === 'coast');
const SHIP_FROM = Math.min(...[shipStop, coastStop].filter(i => i >= 0), Infinity);
// The ship rocks every frame, so its views follow it; these run each frame from the Travel stop
// on and reuse their vectors rather than allocating new ones
const SV = Array.from({ length: 9 }, () => new Vector3());
let lighthouse;
function shipViews() {
  const g = ship.group, [a, b, c, at, away, side, from, look, sub] = SV;
  // Aboard: framed on the globe, or on the compass binnacle when there is no globe on deck
  if (shipStop >= 0) journey.setView(shipStop, g.localToWorld(a.set(-12.9, 6.9, 3.4)), g.localToWorld(globe.group.parent ? b.set(-8.9, 5.1, -1.3) : b.set(-8.2, 5.7, 0.0)), g.localToWorld(globe.group.parent ? c.copy(GLOBE_AT) : c.set(-9.0, 5.3, 1.6)));
  // The coast view looks back past the ship towards the lighthouse, or where the harbour would be
  lighthouse ??= places.find(p => p.lighthouse)?.lighthouse ?? new Vector3(riverX(7650) + 118, 20, 7650);
  if (coastStop < 0) return;
  at.copy(g.position).setY(4);
  away.copy(at).sub(lighthouse).setY(0).normalize();
  side.set(-away.z, 0, away.x);
  from.copy(at).addScaledVector(away, 70).addScaledVector(side, 22).setY(13);
  look.copy(at).addScaledVector(away, -40).addScaledVector(side, 30).setY(2);
  journey.setView(coastStop, from, look, sub.copy(at).setY(6));
  // The moon hangs a little to the right of the coast view, above the sea
  shared.uMoonDir.value.copy(look).sub(from).setY(0).normalize().applyAxisAngle(UP, -0.12).setY(0.2).normalize();
}

function applyScroll(y) {
  if (active >= SHIP_FROM - 1) shipViews();
  const loc = journey.locate(y);
  if (reduceMotion && loc.travel) {
    loc.i = loc.t < 0.5 ? loc.i : loc.i + 1;
    loc.travel = false;
    loc.drift = loc.t < 0.5 ? 1 : 0;
  }
  journey.pose(loc, pose);
  directFlight(loc);
  lastLoc = loc;
  if (focus.amount > 0.001 && !loc.travel) {
    const ease = focus.amount * focus.amount * (3 - 2 * focus.amount);
    pose.pos.lerp(focus.view, ease);
    lookM.lookAt(pose.pos, focus.pos, UP);
    lookQ.setFromRotationMatrix(lookM);
    yawQ.setFromAxisAngle(UP, Math.atan(clearCentre(loc.i) * Math.tan(MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
    pose.quat.slerp(yawQ.multiply(lookQ), ease);
  }
  applyOrbit(loc);
  if (!controls) {
    camera.position.copy(pose.pos);
    camera.quaternion.copy(pose.quat);
  }
  const t = manualTime ?? pose.time;
  compass?.follow(pose.time);
  if (Math.abs(t - state.time) > 0.0003) setTimeOfDay(t);
  if (Math.abs(state.time - sunTime) > 0.02) {
    sunTime = state.time;
    requestSun();
  }
  active = loc.travel ? (loc.t < 0.5 ? loc.i : loc.i + 1) : loc.i;
  return loc;
}

// Hovering a CV entry lights the thing it points at in the scene and turns the camera slightly towards it
const focus = { key: null, amount: 0, light: 0, pos: new Vector3(), view: new Vector3(), size: 12 };
const lookM = new Matrix4(), lookQ = new Quaternion(), yawQ = new Quaternion(), UP = new Vector3(0, 1, 0);

// Dragging the scene orbits the camera round whatever the stop is looking at (or the place
// being visited). It eases back once the reader moves on to another stop.
const orbit = { yaw: 0, pitch: 0, toYaw: 0, toPitch: 0, stop: -1, drag: null };
const orbitQ = new Quaternion(), orbitQ2 = new Quaternion(), orbitV = new Vector3(), orbitAxis = new Vector3();
function applyOrbit(loc) {
  const here = loc.travel ? -1 : loc.i;
  if (here !== orbit.stop) {
    orbit.stop = here;
    orbit.toYaw = orbit.toPitch = 0;
  }
  orbit.yaw += (orbit.toYaw - orbit.yaw) * 0.15;
  orbit.pitch += (orbit.toPitch - orbit.pitch) * 0.15;
  if (Math.abs(orbit.yaw) < 1e-4 && Math.abs(orbit.pitch) < 1e-4) return;
  const v = journey.views[loc.i];
  const pivot = document.body.classList.contains('visiting') ? focus.pos : (v.subject ?? v.look);
  const off = orbitV.copy(pose.pos).sub(pivot);
  orbitQ.setFromAxisAngle(UP, orbit.yaw);
  off.applyQuaternion(orbitQ);
  orbitAxis.set(off.z, 0, -off.x).normalize();
  orbitQ2.setFromAxisAngle(orbitAxis, orbit.pitch);
  off.applyQuaternion(orbitQ2);
  pose.pos.copy(pivot).add(off);
  pose.pos.y = Math.max(pose.pos.y, meshHeight(pose.pos.x, pose.pos.z) + 3, (STOPS[loc.i].view ? 1.5 : -Infinity));
  pose.quat.premultiply(orbitQ).premultiply(orbitQ2);
}

function orbitInput() {
  const skip = e => e.target.closest('.panel, .minimap, .map-toggle, .visit-back, .debug, button, a, input, summary');
  window.addEventListener('pointerdown', e => {
    if (e.button !== 0 || skip(e) || controls || walker?.on) return;
    orbit.drag = { x: e.clientX, y: e.clientY, yaw: orbit.toYaw, pitch: orbit.toPitch, id: e.pointerId, live: e.pointerType === 'mouse' };
  });
  window.addEventListener('pointermove', e => {
    const d = orbit.drag;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.live) {
      if (Math.abs(dx) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) { orbit.drag = null; return; }
      d.live = true;
    }
    document.body.classList.add('orbiting');
    orbit.toYaw = d.yaw - (dx / window.innerWidth) * Math.PI * 1.4;
    orbit.toPitch = MathUtils.clamp(d.pitch - (dy / window.innerHeight) * 0.9, -0.45, 0.3);
  });
  const end = () => { orbit.drag = null; document.body.classList.remove('orbiting'); };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  window.addEventListener('dblclick', e => { if (!skip(e)) orbit.toYaw = orbit.toPitch = 0; });
}

// Horizontal centre of the screen left uncovered by a stop's panel, from -1 (left edge) to 1
function clearCentre(i) {
  const panel = document.querySelector(`#stop-${STOPS[i].id} .panel`);
  const w = window.innerWidth;
  if (!panel || w <= 720 || document.body.classList.contains('visiting')) return 0;
  const r = panel.getBoundingClientRect();
  return ((r.right + w) / 2 / w) * 2 - 1;
}

// Touch screens have no hover, so entries carry a button that flies to their place instead;
// the panels step aside until the reader taps back or scrolls on
const visit = { at: 0 };
function endVisit() {
  focus.key = null;
  orbit.toYaw = orbit.toPitch = 0;
  document.body.classList.remove('visiting');
}
function tapToVisit() {
  document.querySelectorAll('.visit').forEach(btn => btn.addEventListener('click', e => {
    e.preventDefault();
    focus.key = btn.closest('[data-link]').dataset.link;
    visit.at = lenis ? lenis.targetScroll : window.scrollY;
    document.body.classList.add('visiting');
    orbit.toYaw = orbit.toPitch = 0;
  }));
  document.querySelector('.visit-back').addEventListener('click', endVisit);
  window.addEventListener('keydown', e => { if (e.key === 'Escape') endVisit(); });
}
function watchVisit() {
  if (!document.body.classList.contains('visiting')) return;
  const y = lenis ? lenis.targetScroll : window.scrollY;
  const a = anchors.get(focus.key);
  if (Math.abs(y - visit.at) > 60 || !a || a.stop !== active) endVisit();
}

// On a desktop, hovering a contact link still makes the lighthouse flash; halls, workshops and
// stalls are visited with their buttons instead, so reading never moves the camera
function linkHover() {
  if (!window.matchMedia('(hover: hover)').matches) return;
  document.querySelectorAll('[data-link="lighthouse"]').forEach(el => {
    const on = () => { focus.key = el.dataset.link; };
    const off = () => { if (focus.key === el.dataset.link) focus.key = null; };
    el.addEventListener('mouseenter', on);
    el.addEventListener('focusin', on);
    el.addEventListener('mouseleave', off);
    el.addEventListener('focusout', off);
  });
}

// Pointing at a skill on the panel lifts its object at the fair stall and lights it up
let wareKey = null;
function wareHover() {
  document.querySelectorAll('[data-ware]').forEach(li => {
    const on = () => { wareKey = li.dataset.ware; }, off = () => { if (wareKey === li.dataset.ware) wareKey = null; };
    li.addEventListener('mouseenter', on);
    li.addEventListener('focus', on);
    li.addEventListener('mouseleave', off);
    li.addEventListener('blur', off);
    li.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') wareKey = wareKey === li.dataset.ware ? null : li.dataset.ware; });
  });
}

function updateFocus(dt) {
  const a = focus.key ? anchors.get(focus.key) : null;
  const k = Math.min(1, dt * 3.5);
  const was = focus.amount;
  focus.amount += ((a && a.stop === active ? 1 : 0) - focus.amount) * k;
  focus.light += ((focus.key === 'lighthouse' && active === coastStop ? 1 : 0) - focus.light) * k;
  if (a) {
    const view = a.view ?? camera.position;
    if (was < 0.05) { focus.pos.copy(a.pos); focus.view.copy(view); }
    else { focus.pos.lerp(a.pos, k); focus.view.lerp(view, k); }
    focus.size = a.size;
  }
  if (glow.materials.length > 1) glow.materials[0].uniforms.uBoost.value = focus.light;
}

// Sound is off until asked for; the choice is remembered, and a remembered 'on' starts with the
// first touch, click or key press because browsers will not play sound before one
const sound = new Soundscape();
if (debug) Object.assign(window, { __sound: sound, __camera: camera, __focus2: () => focus, __binnacle: () => binnacle });
const soundPos = new Vector3();
function soundUI() {
  const btn = document.querySelector('.sound-toggle');
  const set = on => {
    btn.setAttribute('aria-pressed', String(on));
    try { localStorage.setItem('valley-sound', on ? 'on' : 'off'); } catch { /* private mode */ }
    if (on) sound.start(); else sound.stop();
  };
  btn.addEventListener('click', () => set(btn.getAttribute('aria-pressed') !== 'true'));
  let saved = null;
  try { saved = localStorage.getItem('valley-sound'); } catch { /* private mode */ }
  if (saved === 'on') {
    btn.setAttribute('aria-pressed', 'true');
    const go = () => { sound.start(); for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.removeEventListener(ev, go); };
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, go);
  }
  document.addEventListener('visibilitychange', () => {
    if (!sound.ctx || !sound.on) return;
    if (document.hidden) sound.ctx.suspend(); else sound.ctx.resume();
  });
}

// Linger at the abbey and the choir in the cloister starts to sing
const choir = { linger: 0 };
function updateChoir(dt) {
  const gate = lore.choir?.get('choir')?.uniforms.uGate;
  if (!gate) return 0;
  const here = !lastLoc.travel && STOPS[lastLoc.i]?.kit === 'abbey';
  choir.linger = here ? choir.linger + dt : 0;
  gate.value += ((choir.linger > 3.5 ? 1 : 0) - gate.value) * Math.min(1, dt * 1.2);
  return gate.value;
}

let choirLevel = 0, soundWeights;
function updateSound(dt) {
  choirLevel = updateChoir(dt);
  if (!sound.on) return;
  const weights = (soundWeights ??= STOPS.map(() => 0)).fill(0);
  if (lastLoc.travel) {
    const e = MathUtils.smootherstep(lastLoc.t, 0, 1);
    weights[lastLoc.i] = 1 - e;
    weights[lastLoc.i + 1] = e;
  } else weights[lastLoc.i] = 1;
  const speed = dt > 0 ? camera.position.distanceTo(soundPos) / dt : 0;
  soundPos.copy(camera.position);
  const day = MathUtils.smoothstep(shared.uSunDir.value.y, -0.02, 0.12);
  sound.update({ weights, day, speed: lastLoc.travel ? speed : 0, visit: document.body.classList.contains('visiting') ? focus.key : null, extra: { choir: choirLevel * 0.45 } });
}

// Each stop's quote appears over the landscape once the camera has settled there, and drifts
// away again as it flies on
const inscription = { el: null, current: null, since: 0 };
function updateInscription(now) {
  const el = inscription.el ??= document.querySelector('.inscription');
  const id = lastLoc.travel || jump.on || walker?.on ? null : STOPS[lastLoc.i].id;
  const quote = id && cv.quotes?.[id] ? id : null;
  if (quote !== inscription.current) {
    inscription.current = quote;
    inscription.since = now;
    el.classList.remove('shown');
    return;
  }
  if (!quote || el.classList.contains('shown') || now - inscription.since < 1500) return;
  el.querySelector('blockquote').textContent = cv.quotes[quote].text;
  el.querySelector('figcaption').textContent = cv.quotes[quote].by;
  el.classList.add('shown');
}

function debugUI() {
  const slider = document.querySelector('#time');
  slider.addEventListener('input', () => { manualTime = Number(slider.value); });
  const paint = document.querySelector('#paint');
  paint.checked = painter.enabled;
  paint.addEventListener('change', () => { painter.enabled = paint.checked; painter.setSize(...painter.full); });
  const dither = document.querySelector('#dither');
  dither.checked = painter.params.levels.value > 0;
  dither.addEventListener('change', () => { painter.params.levels.value = dither.checked ? 64 : 0; });
  const walkBox = document.querySelector('#walk');
  walkBox.checked = walker.on;
  walkBox.addEventListener('change', () => (walkBox.checked ? startWalk() : stopWalk()));
  const free = document.querySelector('#free');
  free.addEventListener('change', () => {
    if (free.checked) {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.copy(journey.views[active].look);
      document.querySelector('.stage').style.zIndex = 8;
    } else {
      controls?.dispose();
      controls = null;
      document.querySelector('.stage').style.zIndex = 0;
    }
  });
}

function lens() {
  const portrait = window.innerWidth / window.innerHeight < 0.9;
  camera.fov = portrait ? 56 : 42;
  journey?.setPortrait(portrait, camera.fov);
}

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  lens();
  camera.updateProjectionMatrix();
  const s = renderer.getDrawingBufferSize(new Vector2());
  painter.setSize(s.x, s.y);
  reflection?.setSize(s.x, s.y);
  journey?.measure();
}
window.addEventListener('resize', resize);

let lastT = 0, frameNo = 0, mapKey = '';
// Figures and birds more than a mile or so away are smaller than a pixel, so skip them
function cullFolk() {
  for (const e of lore.meshes) e.mesh.visible = true;
  for (const g of [folk, flocks, traffic]) {
    for (const m of g.children) m.visible = camera.position.distanceTo(m.boundingSphere.center) < 1400 + m.boundingSphere.radius;
  }
}

function cullDetail() {
  details.forEach((d, i) => {
    const c = places[i].place.centre;
    d.mesh.visible = Math.hypot(camera.position.x - c.x, camera.position.z - c.z) < places[i].detail.radius + 140;
  });
}

function renderFrame() {
  frameNo++;
  cullDetail();
  cullFolk();
  const allowed = cullByStop();
  const t = shared.uTime.value;
  ship.update(t);
  globe.update(Math.min(0.1, Math.abs(t - lastT)), t, camera);
  lastT = t;
  globe.material.uniforms.uLamp.value.copy(ship.lantern);
  spinners.update(t);
  forest.updateLOD(camera, allowed);
  refreshShadow();
  if (wantsReflection()) {
    forest.reflectionLOD(camera, allowed);
    reflection.update(scene, camera, waterLevel(MathUtils.clamp(camera.position.z, -9800, 9000)));
    forest.updateLOD(camera, allowed);
  }
  painter.render(scene, camera, state.exposure);
  // The map only needs redrawing when the camera has moved or turned
  const mk = `${camera.position.x.toFixed(0)},${camera.position.z.toFixed(0)},${camera.quaternion.y.toFixed(3)},${active}`;
  if (mk !== mapKey) { mapKey = mk; minimap.update(camera, active); }
}

// ?bench times each part of a frame, forcing the GPU to finish between parts
function bench(frames = 6) {
  const gl = renderer.getContext();
  const px = new Uint8Array(4);
  const sync = () => { renderer.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
  const time = fn => {
    sync();
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) { fn(); sync(); }
    return +((performance.now() - t0) / frames).toFixed(1);
  };
  const r = {};
  r.reflection = time(() => { forest.reflectionLOD(camera); reflection.update(scene, camera, waterLevel(MathUtils.clamp(camera.position.z, -9800, 9000))); forest.updateLOD(camera); });
  r.scene = time(() => { renderer.setRenderTarget(painter.scene); renderer.render(scene, camera); renderer.setRenderTarget(null); });
  r.frameNoPaint = time(() => { painter.enabled = false; painter.render(scene, camera, state.exposure); painter.enabled = true; });
  r.frame = time(() => painter.render(scene, camera, state.exposure));
  r.post = +(r.frame - r.frameNoPaint).toFixed(1);
  const vis = (list, v) => list.forEach(o => { o.visible = v; });
  const groups = { trees: [forest.group], grass: details.map(d => d.mesh), buildings: [buildings], water: scene.children.filter(o => o.userData.water) };
  for (const [k, list] of Object.entries(groups)) {
    vis(list, false);
    r[`sceneWithout_${k}`] = time(() => { renderer.setRenderTarget(painter.scene); renderer.render(scene, camera); renderer.setRenderTarget(null); });
    vis(list, true);
  }
  for (const lod of ['hi', 'lo', 'far']) {
    const shown = forest.chunks.filter(c => c[lod].visible);
    shown.forEach(c => { c[lod].visible = false; });
    r[`sceneWithout_${lod}`] = time(() => { renderer.setRenderTarget(painter.scene); renderer.render(scene, camera); renderer.setRenderTarget(null); });
    r[`${lod}Instances`] = shown.reduce((a, c) => a + c[lod].count, 0);
    shown.forEach(c => { c[lod].visible = true; });
  }
  r.info = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
  console.info('BENCH ' + JSON.stringify(r));
}

// Dynamic resolution: steer the internal render scale towards roughly 50 frames a second
const perf = { acc: 0, n: 0, scale: Q.paintScale };
function adapt(dtMs) {
  perf.acc += dtMs;
  perf.n++;
  if (perf.acc < 1000) return;
  const avg = perf.acc / perf.n;
  perf.acc = perf.n = 0;
  if (debug) document.querySelector('#fps').textContent = `${LOW ? 'low' : 'high'} · ${(1000 / avg).toFixed(0)} fps · ${avg.toFixed(1)} ms · render scale ${perf.scale.toFixed(2)}`;
  const target = Q.frameMs || 20;
  if (avg > target * 1.2) perf.scale = Math.max(Q.minScale, perf.scale - 0.06);
  else if (avg < target * 0.75) perf.scale = Math.min(Q.maxScale, perf.scale + 0.05);
  // Only a few fixed steps, so a frame rate hovering near the line does not reallocate the
  // render targets every second
  const steps = [Q.maxScale, (Q.maxScale + Q.minScale) / 2, Q.minScale];
  painter.setScale(steps.reduce((best, v) => (Math.abs(v - perf.scale) < Math.abs(best - perf.scale) ? v : best)));
}

let last = performance.now();
function loop(now) {
  // Phones are held to 30 frames a second, which halves the work and spares the battery
  if (Q.frameMs && now - last < Q.frameMs - 2) {
    requestAnimationFrame(loop);
    return;
  }
  const dt = Math.min(0.1, (now - last) / 1000);
  adapt(now - last);
  last = now;
  if (!reduceMotion) shared.uTime.value += dt;
  const winter = shared.uWinter, wants = SEASON.winterAmount;
  if (winter.value !== wants) winter.value = Math.abs(wants - winter.value) < 0.005 ? wants : winter.value + (wants - winter.value) * Math.min(1, dt * (reduceMotion ? 10 : 0.8));
  snowfall.visible = winter.value > 0.005;
  const snow = shared.uSnowLine;
  if (snow.value !== SEASON.snowLine) snow.value = Math.abs(SEASON.snowLine - snow.value) < 1 ? SEASON.snowLine : snow.value + (SEASON.snowLine - snow.value) * Math.min(1, dt * (reduceMotion ? 10 : 1.2));
  talk?.update(dt, walker?.on && !walker.flight);
  chatter?.update(dt, walker?.on && !walker.flight, talk?.current?.pos);
  if (walker?.on) walkFrame(dt);
  else {
    lenis?.raf(now);
    if (lenis && journey) watchSnap(now);
    if (journey) journey.clock = shared.uTime.value;
    applyScroll(lenis ? lenis.scroll : window.scrollY);
  }
  controls?.update();
  stepSunJob(4);
  if (!sunJob) stepVisibility(4);
  // Once the valley is otherwise idle, survey the settlements for walking in the background
  if (!sunJob && !vis.job && walker && !walker.on) walker.step(3);
  watchVisit();
  updateFocus(dt);
  lore.update(shared.uTime.value);
  wares.update(shared.uTime.value, wareKey, dt);
  updateSound(dt);
  updateInscription(now);
  renderFrame();
  requestAnimationFrame(loop);
}

// ?walk, or the debug panel, sets the reader down on foot; the journey waits where it was left
let walkFrom = 0;
function startWalk(i = active) {
  if (walker.on) return;
  walkFrom = active;
  endVisit();
  // A stop at sea (or a section switched off) sets the walker down in the town instead
  const into = STOPS[i];
  walker.enter(into?.place ?? places.findIndex(p => p.place.id === 'town'));
  manualTime ??= into?.time ?? 0.37;
  lenis?.stop();
  const box = document.querySelector('#walk');
  if (box) box.checked = true;
}
function stopWalk() {
  if (!walker.on) return;
  walker.leave();
  manualTime = compass?.el.classList.contains('turned') ? manualTime : null;
  if (params.has('walk')) {
    params.delete('walk');
    const q = [...params].map(([k, v]) => (v ? `${k}=${v}` : k)).join('&');
    history.replaceState(null, '', location.pathname + (q ? `?${q}` : '') + location.hash);
  }
  journey.measure();
  active = walkFrom;
  const y = journey.scrollTarget(active);
  window.scrollTo(0, y);
  lenis?.scrollTo(y, { immediate: true, force: true });
  lenis?.start();
  snap.last = y;
  const box = document.querySelector('#walk');
  if (box) box.checked = false;
}
// The stop for a settlement, or the nearest one along the journey if its section is switched off
function stopNearPlace(k) {
  let best = 0, bd = Infinity;
  STOPS.forEach((s, i) => { if (s.place !== undefined && Math.abs(s.place - k) < bd) { bd = Math.abs(s.place - k); best = i; } });
  return best;
}
function walkFrame(dt) {
  walker.update(dt, state.time);
  const near = walker.nearest();
  const i = camera.position.distanceTo(ship.group.position) < 200 && shipStop >= 0 ? shipStop : stopNearPlace(near.index);
  lastLoc = { i, travel: false, t: 0, drift: 0 };
  active = i;
  const t = manualTime ?? STOPS[i].time;
  if (Math.abs(t - state.time) > 0.0003) setTimeOfDay(t);
  if (Math.abs(state.time - sunTime) > 0.02) {
    sunTime = state.time;
    requestSun();
  }
}

function mapToggle() {
  const btn = document.querySelector('.map-toggle'), map = document.querySelector('.minimap');
  btn.addEventListener('click', () => {
    const open = map.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });
  map.addEventListener('click', e => {
    if (e.target.classList.contains('marker') && window.innerWidth <= 720) {
      map.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
}

function globeHover() {
  document.querySelectorAll('.countries li').forEach(li => {
    const on = () => globe.focus(li.dataset.code), off = () => globe.release();
    li.addEventListener('mouseenter', on);
    li.addEventListener('focus', on);
    li.addEventListener('mouseleave', off);
    li.addEventListener('blur', off);
  });
}

function observePanels() {
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) e.target.classList.add('seen');
  }, { threshold: 0, rootMargin: '0px 0px 10% 0px' });
  document.querySelectorAll('.panel').forEach(p => io.observe(p));
}

(async () => {
  try {
    observePanels();
    mapToggle();
    await build();
    await document.fonts?.ready;
    lore.signs.draw();
    pruneVisits(anchors);
    journey.measure();
    new ResizeObserver(() => journey.measure()).observe(document.querySelector('#journey'));
    globeHover();
    linkHover();
    tapToVisit();
    wareHover();
    orbitInput();
    if (WORLD.eggs.compass) compass = new Compass({
      camera, canvas: renderer.domElement, mesh: binnacle,
      isAboard: () => active === shipStop && !lastLoc.travel,
      onTime: t => { manualTime = t; },
    });
    onSeason(s => forest.setSeason(s));
    soundUI();
    walker = new Walk({
      camera, canvas: renderer.domElement, meshHeight, places, buildings,
      trees: forest.chunks.flatMap(c => c.list),
      names: places.map((p, k) => STOPS.find(s => s.place === k)?.placeName),
      onTime: t => { manualTime = t; },
      onLeave: () => stopWalk(),
    });
    talk = new Talk({ camera, cv, places, meshHeight });
    chatter = new Chatter({ camera, people: townsfolk });
    if (debug) Object.assign(window, { __walk: walker, __talk: talk, __chatter: chatter, __forest: forest, __buildings: buildings });
    if (params.has('walk') && !still && WORLD.walk) startWalk(STOPS.findIndex(s => s.id === 'experience'));
    if (debug) debugUI();
    releaseHold();
    document.body.classList.add('ready');
    if (!still) {
      setTimeout(geckoNote, 1500);
      if (!params.has('walk') && WORLD.eggs.rumour) setTimeout(rumour, 2600);
    }
    document.querySelector('.explore')?.addEventListener('click', () => startWalk(STOPS.findIndex(s => s.id === 'experience')));

    if (still) {
      document.querySelector('.loading').remove();
      if (!params.has('nocull')) while (vis.job) stepVisibility(1000);
      document.querySelector('.minimap').style.cssText = 'opacity:1;transition:none';
      document.querySelectorAll('.panel').forEach(p => { p.style.transition = 'none'; p.classList.add('seen'); });
      const i = Number(params.get('stop') ?? 0), t = Number(params.get('t') ?? 0);
      const y = t > 0 ? MathUtils.lerp(journey.ranges[i].end, journey.ranges[i + 1].start, t) : journey.scrollTarget(i);
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, y);
      ship.update(12);
      applyScroll(y);
      runSunJobNow();
      for (let k = 0; k < 120; k++) globe.update(0.05, 12 + k * 0.001, camera);
      shared.uTime.value = 12;
      renderFrame();
      if (params.has('bench')) bench();
      window.__stop = (i, t = 0) => {
        const y = t > 0 ? MathUtils.lerp(journey.ranges[i].end, journey.ranges[i + 1].start, t) : journey.scrollTarget(i);
        window.scrollTo(0, y);
        applyScroll(y);
        runSunJobNow();
        renderFrame();
        updateInscription(0);
        updateInscription(5000);
        document.querySelector('.inscription').style.transition = 'none';
      };
      window.__view = (i, pos, look) => {
        journey.setView(i, new Vector3(...pos), new Vector3(...look));
        window.__stop(i);
      };
      window.__focus = (i, key) => {
        focus.key = key;
        const an = anchors.get(key);
        if (an) { focus.pos.copy(an.pos); focus.view.copy(an.view ?? an.pos); focus.size = an.size; }
        focus.amount = an ? 1 : 0;
        focus.light = key === 'lighthouse' ? 1 : 0;
        document.body.classList.toggle('visiting', !!an);
        updateFocus(0);
        window.__stop(i);
      };
      window.__lore = lore;
      window.__time = t => { manualTime = t; };
      window.__ware = key => { wares.update(12, key, 10); renderFrame(); };
      window.__fly = (from, to, t) => {
        const blank = () => ({ pos: new Vector3(), quat: new Quaternion(), time: 0 });
        const A = journey.dwellPose(from, 0.5, blank()), B = journey.dwellPose(to, 0.5, blank());
        const p = journey.fly(A, B, t, { atSea: !!STOPS[to].view, to: journey.views[to].subject }, blank());
        camera.position.copy(p.pos);
        camera.quaternion.copy(p.quat);
        setTimeOfDay(p.time);
        vis.ready = false;
        runSunJobNow();
        renderFrame();
      };
      window.__viewLocal = (i, pi, pos, look) => {
        const pl = places[pi].place;
        window.__view(i, pl.point(...pos).toArray(), pl.point(...look).toArray());
      };
      document.body.dataset.rendered = '1';
      return;
    }

    if (!reduceMotion) {
      lenis = new Lenis({ autoRaf: false, lerp: 0.09, wheelMultiplier: 0.9 });
      snap.last = lenis.targetScroll;
      snapInput();
      if (walker.on) lenis.stop();
    }
    requestAnimationFrame(loop);
    // An address like /#stop-projects flies straight there once the valley is ready
    const linked = STOPS.findIndex(s => location.hash === `#stop-${s.id}`);
    if (linked > 0 && !walker.on) setTimeout(() => goToStop(linked), 600);
  } catch (err) {
    statusEl.textContent = `Something went wrong: ${err.message}`;
    console.error(err);
  }
})();
