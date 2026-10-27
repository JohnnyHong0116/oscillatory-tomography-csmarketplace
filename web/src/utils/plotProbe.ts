export interface ProbePoint<T> {
  cx: number;
  cy: number;
  details: T;
}

/** Screen positions already include any log transforms. Comparing those
 * positions, rather than raw values, preserves what the user actually sees. */
export function nearestPlotPoint<T>(
  points: ProbePoint<T>[],
  x: number,
  y: number,
): ProbePoint<T> | null {
  if (![x, y].every(Number.isFinite)) return null;
  let nearest: ProbePoint<T> | null = null,
    best = Infinity;
  for (const point of points) {
    const distance = (point.cx - x) ** 2 + (point.cy - y) ** 2;
    if (Number.isFinite(distance) && distance < best) {
      best = distance;
      nearest = point;
    }
  }
  return nearest;
}
