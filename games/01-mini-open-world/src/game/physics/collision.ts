import { clamp } from '../core/mathUtils';

/**
 * 2D collision primitives on the XZ ground plane. Every entity in the world lives on the
 * ground, so the vertical axis is ignored for collision purposes while the visual world stays 3D.
 *
 * Yaw convention (matches THREE.Object3D.rotation.y):
 *  - local +z (forward) maps to world (sin(yaw), cos(yaw))
 *  - local +x (right)   maps to world (cos(yaw), -sin(yaw))
 */

export interface OBB {
  x: number;
  z: number;
  hx: number; // half extent along local x (width / 2)
  hz: number; // half extent along local z (length / 2)
  angle: number; // yaw
}

export interface Circle {
  x: number;
  z: number;
  r: number;
}

export interface Contact {
  nx: number;
  nz: number;
  depth: number;
}

/** OBB vs OBB via separating axis theorem. Normal points from `a` to `b`. */
export function obbVsObb(a: OBB, b: OBB): Contact | null {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const ra = a.hx + a.hz;
  const rb = b.hx + b.hz;
  if (dx * dx + dz * dz > (ra + rb) * (ra + rb)) return null;

  const ca = Math.cos(a.angle);
  const sa = Math.sin(a.angle);
  const cb = Math.cos(b.angle);
  const sb = Math.sin(b.angle);

  let minOverlap = Infinity;
  let nx = 0;
  let nz = 0;

  for (let k = 0; k < 4; k++) {
    let ax: number;
    let az: number;
    if (k === 0) {
      ax = ca;
      az = -sa;
    } else if (k === 1) {
      ax = sa;
      az = ca;
    } else if (k === 2) {
      ax = cb;
      az = -sb;
    } else {
      ax = sb;
      az = cb;
    }
    const d = dx * ax + dz * az;
    const pa = a.hx * Math.abs(ca * ax - sa * az) + a.hz * Math.abs(sa * ax + ca * az);
    const pb = b.hx * Math.abs(cb * ax - sb * az) + b.hz * Math.abs(sb * ax + cb * az);
    const overlap = pa + pb - Math.abs(d);
    if (overlap <= 0) return null;
    if (overlap < minOverlap) {
      minOverlap = overlap;
      if (d < 0) {
        nx = -ax;
        nz = -az;
      } else {
        nx = ax;
        nz = az;
      }
    }
  }
  return { nx, nz, depth: minOverlap };
}

/** Circle vs OBB. Normal points from the OBB towards the circle (push circle along +n). */
export function circleVsObb(c: Circle, o: OBB): Contact | null {
  const dx = c.x - o.x;
  const dz = c.z - o.z;
  const reach = o.hx + o.hz + c.r;
  if (dx * dx + dz * dz > reach * reach) return null;

  const co = Math.cos(o.angle);
  const so = Math.sin(o.angle);
  const lx = dx * co - dz * so;
  const lz = dx * so + dz * co;
  const qx = clamp(lx, -o.hx, o.hx);
  const qz = clamp(lz, -o.hz, o.hz);
  const ex = lx - qx;
  const ez = lz - qz;
  const d2 = ex * ex + ez * ez;
  if (d2 > c.r * c.r) return null;

  let nlx: number;
  let nlz: number;
  let depth: number;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    nlx = ex / d;
    nlz = ez / d;
    depth = c.r - d;
  } else {
    const px = o.hx - Math.abs(lx);
    const pz = o.hz - Math.abs(lz);
    if (px < pz) {
      nlx = lx >= 0 ? 1 : -1;
      nlz = 0;
      depth = px + c.r;
    } else {
      nlx = 0;
      nlz = lz >= 0 ? 1 : -1;
      depth = pz + c.r;
    }
  }
  return { nx: nlx * co + nlz * so, nz: -nlx * so + nlz * co, depth };
}

export function circleVsCircle(a: Circle, b: Circle): Contact | null {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const r = a.r + b.r;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;
  if (d2 < 1e-8) return { nx: 1, nz: 0, depth: r };
  const d = Math.sqrt(d2);
  return { nx: dx / d, nz: dz / d, depth: r - d };
}

export function pointInObb(x: number, z: number, o: OBB, margin = 0): boolean {
  const dx = x - o.x;
  const dz = z - o.z;
  const co = Math.cos(o.angle);
  const so = Math.sin(o.angle);
  const lx = dx * co - dz * so;
  const lz = dx * so + dz * co;
  return Math.abs(lx) <= o.hx + margin && Math.abs(lz) <= o.hz + margin;
}

/** Segment / OBB intersection (slab test in OBB local space). */
export function segmentHitsObb(x0: number, z0: number, x1: number, z1: number, o: OBB): boolean {
  const co = Math.cos(o.angle);
  const so = Math.sin(o.angle);
  const ax = x0 - o.x;
  const az = z0 - o.z;
  const bx = x1 - o.x;
  const bz = z1 - o.z;
  const l0x = ax * co - az * so;
  const l0z = ax * so + az * co;
  const l1x = bx * co - bz * so;
  const l1z = bx * so + bz * co;
  const dx = l1x - l0x;
  const dz = l1z - l0z;
  let tmin = 0;
  let tmax = 1;

  if (Math.abs(dx) < 1e-9) {
    if (l0x < -o.hx || l0x > o.hx) return false;
  } else {
    let t1 = (-o.hx - l0x) / dx;
    let t2 = (o.hx - l0x) / dx;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (Math.abs(dz) < 1e-9) {
    if (l0z < -o.hz || l0z > o.hz) return false;
  } else {
    let t1 = (-o.hz - l0z) / dz;
    let t2 = (o.hz - l0z) / dz;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

export function segmentClear(x0: number, z0: number, x1: number, z1: number, obstacles: readonly OBB[]): boolean {
  for (const o of obstacles) {
    if (segmentHitsObb(x0, z0, x1, z1, o)) return false;
  }
  return true;
}
