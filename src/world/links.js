// Scene objects that CV entries point at: hovering an entry lights its object and turns the camera a little towards it
export const anchors = new Map();

export function anchor(key, stop, pos, size = 12, view = null) {
  anchors.set(key, { stop, pos: pos.clone(), size, view: view?.clone() ?? null });
}
