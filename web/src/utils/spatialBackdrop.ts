import { ModelConfig } from '../types/aquifer';
import { orientPoint, SpatialCamera } from './spatialCamera';

type Point3 = [number, number, number];
/** Only far-facing domain walls are drawn. These quarter-span reference guides
 * describe the box geometry, not the computational mesh or boundary conditions. */
export function spatialBackdropFaces(config: ModelConfig, camera: Pick<SpatialCamera,'yaw'|'pitch'|'roll'>) {
  const bounds = [[config.minX,config.maxX],[config.minY,config.maxY],[config.minZ??-40,config.maxZ??40]];
  return bounds.flatMap((range, axis) => range.flatMap((value, side) => {
    const normal: Point3 = [0,0,0]; normal[axis] = side===0 ? -1 : 1;
    const depth = orientPoint(...normal,camera.yaw,camera.pitch,camera.roll).depth;
    if(depth<=1e-6) return []; // Leave every near wall open, including below-view orientations.
    const u=(axis+1)%3,v=(axis+2)%3;
    const point=(a:number,b:number):Point3=>{const p:Point3=[0,0,0];p[axis]=value;p[u]=a;p[v]=b;return p;};
    const corners=[point(bounds[u][0],bounds[v][0]),point(bounds[u][1],bounds[v][0]),point(bounds[u][1],bounds[v][1]),point(bounds[u][0],bounds[v][1])];
    const lines=[.25,.5,.75].flatMap(t=>{
      const a=bounds[u][0]+t*(bounds[u][1]-bounds[u][0]),b=bounds[v][0]+t*(bounds[v][1]-bounds[v][0]);
      return [[point(a,bounds[v][0]),point(a,bounds[v][1])],[point(bounds[u][0],b),point(bounds[u][1],b)]];
    });
    return [{axis,side,depth,corners,lines}];
  })).sort((a,b)=>b.depth-a.depth);
}
