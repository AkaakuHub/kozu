import { valueAt } from './time.ts';
import type { Key, KeyPoint } from './types.ts';

export function scaleRegions(keys: KeyPoint[], start: number, end: number) {
  const regions: { start: number; end: number; key: Key }[] = [];
  if (!keys.length || end <= start) return regions;
  let from = start;
  let key = valueAt(keys, start).key;
  for (const point of keys) {
    if (point.tick <= start) continue;
    if (point.tick >= end) break;
    regions.push({ start: from, end: point.tick, key });
    from = point.tick;
    key = point.key;
  }
  regions.push({ start: from, end, key });
  return regions;
}
