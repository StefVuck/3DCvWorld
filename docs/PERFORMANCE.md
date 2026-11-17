# Performance

The valley is a large scene drawn every frame on whatever device the visitor has. This page covers the rules it follows and where in the code each is applied, so a new place kit or panel can keep to them.

## Sources

The rules come from three Three.js best-practice guides. They are worth running over the code with an AI assistant or by hand after any large change:

- **Three.js Best Practices**, a 100-rule guide in 17 categories based on the official guidance in the `llms` branch of three.js. It is published as an agent skill at [deadronos/copilot-chat-playground](https://github.com/deadronos/copilot-chat-playground) (`npx skillfish add deadronos/copilot-chat-playground three-best-practices`).
- **[CloudAI-X/threejs-skills](https://github.com/CloudAI-X/threejs-skills)**, skill files on fundamentals, geometry, materials, shaders, performance and post-processing.

Only the rules below matter here. Large parts of those guides cover things this project does not use: WebXR, physics, loading glTF models, TSL and WebGPU, React.

## The rules that matter, and where they are applied

### Draw only what can be seen

- **Per-stop visibility** (`src/world/visibility.js`, `cullByStop` in `src/main.js`). Each stop's camera positions are known in advance, so after load a background job works out which tree chunks, settlements and other objects each stop and each flight can see, using the terrain for line of sight. Everything else is hidden. A new place kit's meshes take part automatically if they are returned in `meshes` (or built into `builder`).
- **Frustum culling.** Every instanced mesh gets a bounding sphere around where its instances can be (`computeBoundingSphere`, or a sphere set by hand for things that move or are scaled in the shader). Only the sky and the snow, which surround the camera, opt out.
- **Grouping by place.** People, carts, smoke, banners and lit windows are split per settlement so they can be culled with it. Use `people.tag` (or `crowdKit`) in a new kit so its figures join that grouping.
- **Interiors** are separate meshes, drawn only when the camera is within about 60 m.

### Fewer draw calls and triangles (*geometry-merge-static, geometry-instanced-mesh, geometry-lod*)

- **Static buildings are merged** into one mesh per settlement through the `Builder` (`src/world/kit.js`). Add to the builder rather than creating meshes.
- **Repeated things are instanced:** trees, people, birds, carts, grass, window glows.
- **Trees have three levels of detail:** close, mid and far (`src/world/trees.js`). Close detail is chosen per tree near the camera, not per 600 m chunk. The far model has no trunk; its crown reaches the ground instead.
- **Settlements only exist if the journey uses them.**

### Shaders (*shader-avoid-discard, shader-precompute-cpu*)

- **Avoid `discard`.** It stops the GPU rejecting hidden pixels early. The leaf-card cut-out is only in the close-tree material; mid and far trees use a variant without it.
- **Precompute on the CPU.** Tree shading from the sun and the canopy's shadow on the ground are worked out on the CPU in slices, then uploaded. The canopy's footprint, which does not depend on the sun, is drawn once.
- **Compile shaders behind the loading screen** (`renderer.compileAsync`), so the first sight of a stop does not stall.

### The render loop (*render-avoid-allocations, render-cache-computations*)

- **Never allocate in the loop.** Reuse `Vector3`, `Quaternion` and arrays held outside it. The reflection, the ship's camera views and the sound mixer all do.
- **Slice heavy work** into a few milliseconds a frame:
  - the visibility job;
  - the sun job;
  - the walk-mode collision survey.

  Collision sets are split into shards, so growing them never rehashes a million entries at once.
- **Redraw only on change.** The map's canvas, for example, is redrawn only when the camera moves.
- **Static world matrices are frozen** (`matrixAutoUpdate = false`).

### Lighting, shadows and reflections (*lighting-shadow-selective, lighting-shadow-camera-tight, scene-layers*)

- **No real-time lights.** Lighting is in the shaders from shared uniforms (`src/atmosphere.js`).
- **One local shadow map, fitted to the nearest settlement.** Its casters are small meshes holding only the trees near it, not whole forest chunks.
- **A planar reflection only at stops where water is in the picture.** It is redrawn every frame there, because refreshing it less often makes the water judder. It skips what would not show in a small, blurred reflection: people, carts, wares, lit windows and far trees.

### Post-processing and resolution (*render-pixel-ratio, render-antialias-wisely, mobile*)

- **Pixel ratio is capped at 1.5.**
- **Dynamic resolution** steps between three fixed scales to hold about 50 fps, rather than resizing its render targets continuously.
- **With the paint filter off** (the default), tone mapping happens inside the final grade pass, saving a full-screen pass.
- **Phones are held to 30 fps.** Firefox-based browsers, which draw this kind of scene much more slowly, get a one-time note.

## Checking

- **`?debug`** shows frames per second, time per frame and the current render scale.
- **`?still&stop=N&bench`** logs a `BENCH` line to the console with the time spent on each part of a frame, the draw calls and the triangle count. Compare before and after a change; headless software rendering is slow, so compare relative numbers only.
- **The browser's performance profiler** shows long tasks. Any work that blocks a frame for more than a few milliseconds should be sliced.
