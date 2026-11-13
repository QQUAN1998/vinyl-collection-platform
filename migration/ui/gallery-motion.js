// Native scroll-view owns momentum; this model only snaps and projects the visuals.
function geometry(width, kind) {
  const base = Math.min(340, Math.max(180, width * .68));
  const card = Math.round(base * (kind === 'live' ? .78 : 1));
  return { card, pitch: card + 22, inset: Math.max(0, (width - card) / 2) };
}
function position(left, pitch, count) {
  return Math.max(0, Math.min(Math.max(0, count - 1), Math.round(left / pitch)));
}
function frame(left, pitch, count) {
  const center = left / pitch, active = position(left, pitch, count), styles = {};
  for (let i = Math.max(0, active - 3); i <= Math.min(count - 1, active + 3); i++) {
    const distance = Math.max(-1, Math.min(1, i - center));
    styles[i] = 'transform:perspective(900px) rotateY(' + (-distance * 9).toFixed(2) + 'deg) rotateZ(' + (distance * 4.5).toFixed(2) + 'deg);';
  }
  return { active, styles, rulerOffset: -(center * 12) % 24 };
}
// Keep the scroll track's full extent while mounting only nearby artwork nodes.
function window(slides, physical, pitch) {
  const first = Math.max(0, physical - 3);
  const last = Math.min(slides.length - 1, physical + 3);
  return {
    visibleSlides: slides.slice(first, last + 1),
    windowBefore: first * pitch,
    windowAfter: Math.max(0, (slides.length - last - 1) * pitch - 22)
  };
}
module.exports = { geometry, position, frame, window };
