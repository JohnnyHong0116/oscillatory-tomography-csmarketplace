/** Locate the containing solver cell, without moving or interpolating the well. */
export function fieldCellAt(x: number, y: number, nx: number, ny: number,
  domain: { minX: number; maxX: number; minY: number; maxY: number }) {
  return {
    column: Math.max(0, Math.min(nx - 1, Math.floor((x - domain.minX) / (domain.maxX - domain.minX) * nx))),
    row: Math.max(0, Math.min(ny - 1, Math.floor((y - domain.minY) / (domain.maxY - domain.minY) * ny))),
  };
}
