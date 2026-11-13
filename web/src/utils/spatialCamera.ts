/** Camera-only math. World coordinates, fields and solver inputs never change. */
export type SpatialCamera = { yaw: number; pitch: number; roll: number; zoom: number; panX: number; panY: number };
export type StandardView = 'Front'|'Back'|'Left'|'Right'|'Top'|'Bottom'|'Isometric';
export const HOME_CAMERA: SpatialCamera = {yaw:-35,pitch:25,roll:0,zoom:1,panX:0,panY:0};
export const STANDARD_VIEWS: Record<StandardView, [number,number]> = {
  Front:[0,0], Back:[180,0], Left:[90,0], Right:[-90,0], Top:[0,90], Bottom:[0,-90], Isometric:[-45,35.264389682754654],
};
export const wrapAngle = (v:number) => ((v+180)%360+360)%360-180;
export const clampZoom = (v:number) => Math.max(.4,Math.min(5,v));
/** Cache the rotation basis when projecting many points at the same camera pose. */
export function spatialOrientation(yaw: number, pitch: number, roll = 0) {
  const radians = Math.PI / 180;
  const sinYaw = Math.sin(yaw * radians), cosYaw = Math.cos(yaw * radians);
  const sinPitch = Math.sin(pitch * radians), cosPitch = Math.cos(pitch * radians);
  const sinRoll = Math.sin(roll * radians), cosRoll = Math.cos(roll * radians);
  return (x: number, y: number, z: number) => {
    const horizontal = x * cosYaw - y * sinYaw;
    const forward = x * sinYaw + y * cosYaw;
    const vertical = -forward * sinPitch - z * cosPitch;
    return {
      x: horizontal * cosRoll - vertical * sinRoll,
      y: horizontal * sinRoll + vertical * cosRoll,
      depth: forward * cosPitch - z * sinPitch,
    };
  };
}

export function orientPoint(x: number, y: number, z: number, yaw: number, pitch: number, roll = 0) {
  return spatialOrientation(yaw, pitch, roll)(x, y, z);
}
/** Orient toward a cube face, edge or corner. +Z is always elevation. */
export function poseToward(x:number,y:number,z:number): Pick<SpatialCamera,'yaw'|'pitch'|'roll'> {
  return {yaw:Math.atan2(-x,-y)*180/Math.PI,pitch:Math.asin(z/Math.hypot(x,y,z))*180/Math.PI,roll:0};
}
export function zoomAt(camera:SpatialCamera,factor:number,x=0,y=0):SpatialCamera {
  const zoom=clampZoom(camera.zoom*factor),ratio=zoom/camera.zoom;
  return {...camera,zoom,panX:x-(x-camera.panX)*ratio,panY:y-(y-camera.panY)*ratio};
}
export function cameraViewName(c:SpatialCamera) {
  for(const [name,[yaw,pitch]] of Object.entries(STANDARD_VIEWS))
    if(Math.abs(wrapAngle(c.yaw-yaw))<.01&&Math.abs(c.pitch-pitch)<.01&&Math.abs(wrapAngle(c.roll))<.01)return name;
  return 'Custom view';
}
