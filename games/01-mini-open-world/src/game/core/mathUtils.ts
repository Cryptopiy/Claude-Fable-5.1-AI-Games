export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Frame-rate independent smoothing factor. */
export const damp = (k: number, dt: number): number => 1 - Math.exp(-k * dt);

export function approach(cur: number, target: number, maxDelta: number): number {
  if (cur < target) return Math.min(cur + maxDelta, target);
  return Math.max(cur - maxDelta, target);
}

export function wrapAngle(a: number): number {
  a = a % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  else if (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Heading (yaw) from one point to another. Forward vector convention: (sin(yaw), cos(yaw)). */
export function headingTo(fromX: number, fromZ: number, toX: number, toZ: number): number {
  return Math.atan2(toX - fromX, toZ - fromZ);
}

export function dist2(ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  return dx * dx + dz * dz;
}

export function dist(ax: number, az: number, bx: number, bz: number): number {
  return Math.sqrt(dist2(ax, az, bx, bz));
}

export function lerpAngle(a: number, b: number, t: number): number {
  return a + wrapAngle(b - a) * t;
}

export function safeNum(v: number, fallback: number): number {
  return Number.isFinite(v) ? v : fallback;
}
