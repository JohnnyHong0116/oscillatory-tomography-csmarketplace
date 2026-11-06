import { ModelConfig } from '../types/aquifer';
import { orientPoint, SpatialCamera } from './spatialCamera';

/** Apply camera pan/zoom in SVG units after equal-scale world projection. */
export function spatialCameraProjection(c:ModelConfig,camera:SpatialCamera,w=440,h=410,cx=w/2,cy=h/2) {
  const base=spatialProjection(c,camera.yaw,camera.pitch,w,h,camera.roll);
  return {corners:base.corners,project:(x:number,y:number,z:number)=>{
    const p=base.project(x,y,z);
    return {x:cx+(p.x-w/2)*camera.zoom+camera.panX,y:cy+(p.y-h/2)*camera.zoom+camera.panY,depth:p.depth};
  }};
}

/** Propose a mesh within the interactive inversion budget. Applying it is an
 * explicit user action: never silently coarsen scientific inputs on 3D entry.
 * Prefer preserving the user's Z sampling, then scale XY in the same proportion. */
export function suggestedSpatialGrid(c: ModelConfig) {
  const budget = 3600;
  const nz = Number.isInteger(c.gridNz) && c.gridNz! >= 3 && c.gridNz! <= 60 ? c.gridNz! : 10;
  const nx = Number.isInteger(c.gridNx) && c.gridNx >= 3 ? c.gridNx : 20;
  const ny = Number.isInteger(c.gridNy) && c.gridNy >= 3 ? c.gridNy : 20;
  const factor = Math.min(1, Math.sqrt(budget / (nx * ny * nz)));
  let x = Math.max(3, Math.min(60, Math.floor(nx * factor)));
  let y = Math.max(3, Math.min(60, Math.floor(ny * factor)));
  while (x * y * nz > budget) {
    if (x >= y && x > 3) x--;
    else if (y > 3) y--;
    else break;
  }
  return { gridNx: x, gridNy: y, gridNz: nz };
}

export function spatialIssues(c: ModelConfig, inversion = false) {
  const issues: string[] = [];
  if (c.syntheticRealization === 'matlab_reference' && (
    c.dimension !== 3 || c.syntheticField !== 'geostatistical' || (c.syntheticSeed ?? 0) !== 0 ||
    ![8,20].includes(c.gridNx) || c.gridNy !== c.gridNx || c.gridNz !== c.gridNx ||
    [c.minX,c.maxX,c.minY,c.maxY,c.minZ,c.maxZ].some((v,i)=>v!==[-40,40,-40,40,-40,40][i])
  )) issues.push('MATLAB reference truth uses seed 0, domain −40…40 m on XYZ and an 8³ or 20³ mesh. Restore those settings or switch to a custom NumPy realization.');
  if (c.dimension !== 3) return issues;
  const
    nz = c.gridNz ?? 0,
    lo = c.minZ ?? NaN,
    hi = c.maxZ ?? NaN;
  if (c.testCase === 'black_kipp')
    issues.push('Black–Kipp analytical comparison requires 2D. Select tomography for 3D.');
  if (![lo, hi].every(Number.isFinite) || lo >= hi)
    issues.push('Enter finite Z extents with minimum below maximum.');
  if (!Number.isInteger(nz) || nz < 3 || nz > 60) issues.push('Use 3–60 whole Z cells.');
  const limit = inversion ? 3600 : 8000;
  if (inversion && (c.tests.length > 30 || c.tests.reduce((n,t)=>n+t.observationWellIds.length,0)>100))
    issues.push('Interactive 3D inversion supports at most 30 tests / 100 response pairs. Use the reduced MATLAB 3D recovery example, or explicitly reduce your test selection. The full MATLAB configuration supports forward prediction.');
  if (c.gridNx * c.gridNy * nz > limit)
    issues.push(
      `Your 3D grid has ${c.gridNx * c.gridNy * nz} cells (${c.gridNx} × ${c.gridNy} × ${nz}). The ${inversion ? 'inversion' : 'forward'} limit is ${limit}; reduce the grid counts in Model dimensions / Domain discretization.`,
    );
  const hz = (hi - lo) / (2 * nz);
  if (c.wells.some((w) => !Number.isFinite(w.z) || w.z! < lo + hz || w.z! > hi - hz))
    issues.push('Every 3D well port needs a Z coordinate within the outer cell centers.');
  if (!Number.isFinite(c.corrLengthZ) || (c.corrLengthZ ?? 0) <= 0)
    issues.push('Enter a positive vertical correlation length.');
  return issues;
}

/** Orthographic camera with one physical scale on all three axes. No depth
 * exaggeration: project all box corners to fit the chosen viewport. */
export function spatialProjection(c: ModelConfig, yaw: number, pitch: number, w = 440, h = 410, roll = 0) {
  const raw = (x: number, y: number, z: number) => {
    const X = x - (c.minX + c.maxX) / 2,
      Y = y - (c.minY + c.maxY) / 2,
      Z = z - ((c.minZ ?? -40) + (c.maxZ ?? 40)) / 2;
    return orientPoint(X,Y,Z,yaw,pitch,roll);
  };
  const corners = [c.minX, c.maxX].flatMap((x) =>
    [c.minY, c.maxY].flatMap((y) => [c.minZ ?? -40, c.maxZ ?? 40].map((z) => ({ x, y, z }))),
  );
  const projected = corners.map((p) => raw(p.x, p.y, p.z)),
    xs = projected.map((p) => p.x),
    ys = projected.map((p) => p.y);
  const scale = Math.min(
    (w - 100) / (Math.max(...xs) - Math.min(...xs)),
    (h - 100) / (Math.max(...ys) - Math.min(...ys)),
  );
  return {
    corners,
    project: (x: number, y: number, z: number) => {
      const p = raw(x, y, z);
      return { x: w / 2 + p.x * scale, y: h / 2 + p.y * scale, depth: p.depth };
    },
  };
}
