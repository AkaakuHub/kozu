export function zoomRoll(
  current: { zoom: number; left: number },
  factor: number,
  center: number,
  pan: number,
  keyboardWidth: number,
) {
  const zoom = Math.min(240, Math.max(24, current.zoom * factor));
  const beat = (current.left + center - pan - keyboardWidth) / current.zoom;
  return { zoom, left: Math.max(0, beat * zoom - center + keyboardWidth) };
}
