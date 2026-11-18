import type { Rng } from '../core/rng';
import type { Pedestrian } from '../entities/Pedestrian';
import type { Player } from '../entities/Player';
import type { Vehicle } from '../entities/Vehicle';
import type { OBB } from '../physics/collision';
import type { RoadGraph } from '../world/RoadGraph';

export interface AIContext {
  roads: RoadGraph;
  vehicles: Vehicle[];
  pedestrians: Pedestrian[];
  player: Player;
  statics: OBB[];
  rng: Rng;
  time: number;
}

/**
 * Returns the longitudinal distance to the closest obstacle (vehicle, pedestrian, player)
 * inside a corridor in front of the vehicle, or Infinity.
 */
export function obstacleAhead(v: Vehicle, ctx: AIContext, range: number, halfWidth: number, includePlayerVehicle = true): number {
  const fx = v.forwardX();
  const fz = v.forwardZ();
  const rx = v.rightX();
  const rz = v.rightZ();
  let best = Infinity;

  for (const o of ctx.vehicles) {
    if (o === v) continue;
    if (!includePlayerVehicle && o.driver === 'player') continue;
    const dx = o.x - v.x;
    const dz = o.z - v.z;
    const f = dx * fx + dz * fz;
    if (f <= 0 || f > range + o.spec.hz) continue;
    const l = dx * rx + dz * rz;
    if (Math.abs(l) > halfWidth + o.spec.hx * 0.6) continue;
    const gap = f - o.spec.hz - v.spec.hz;
    if (gap < best) best = gap;
  }
  for (const p of ctx.pedestrians) {
    const dx = p.x - v.x;
    const dz = p.z - v.z;
    const f = dx * fx + dz * fz;
    if (f <= 0 || f > range) continue;
    const l = dx * rx + dz * rz;
    if (Math.abs(l) > halfWidth) continue;
    const gap = f - v.spec.hz - p.radius;
    if (gap < best) best = gap;
  }
  const pl = ctx.player;
  if (pl.onFoot) {
    const dx = pl.x - v.x;
    const dz = pl.z - v.z;
    const f = dx * fx + dz * fz;
    if (f > 0 && f <= range) {
      const l = dx * rx + dz * rz;
      if (Math.abs(l) <= halfWidth) {
        const gap = f - v.spec.hz - pl.radius;
        if (gap < best) best = gap;
      }
    }
  }
  return best;
}

/** Steering input to face a target point. */
export function steerTowards(v: Vehicle, tx: number, tz: number, gain = 2.2): { steer: number; angle: number } {
  const desired = Math.atan2(tx - v.x, tz - v.z);
  let diff = desired - v.yaw;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  const steer = Math.max(-1, Math.min(1, diff * gain));
  return { steer, angle: diff };
}

/** Throttle to reach a target speed; stops cleanly instead of creeping backwards. */
export function throttleFor(v: Vehicle, targetSpeed: number): void {
  const err = targetSpeed - v.speedFwd;
  if (targetSpeed <= 0.15 && v.speedFwd < 0.6 && v.speedFwd > -0.6) {
    v.throttle = 0;
    v.handbrake = true;
    return;
  }
  v.handbrake = false;
  v.throttle = Math.max(-1, Math.min(1, err * 0.45));
}
