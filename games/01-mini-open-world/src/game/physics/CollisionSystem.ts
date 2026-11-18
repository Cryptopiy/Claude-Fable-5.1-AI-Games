import type { Pedestrian } from '../entities/Pedestrian';
import type { Player } from '../entities/Player';
import type { Vehicle } from '../entities/Vehicle';
import { circleVsCircle, circleVsObb, obbVsObb, type OBB } from './collision';

export type CollisionEvent =
  | { type: 'vehicle-static'; vehicle: Vehicle; impact: number }
  | { type: 'vehicle-vehicle'; a: Vehicle; b: Vehicle; impact: number }
  | { type: 'vehicle-ped'; vehicle: Vehicle; ped: Pedestrian; impact: number }
  | { type: 'vehicle-player'; vehicle: Vehicle; impact: number };

const RESTITUTION = 0.25;

/**
 * Resolves all collisions of one simulation step (positional correction + velocity response)
 * and reports meaningful impacts to gameplay systems.
 */
export class CollisionSystem {
  readonly events: CollisionEvent[] = [];

  constructor(private readonly statics: OBB[]) {}

  resolve(vehicles: Vehicle[], pedestrians: Pedestrian[], player: Player): void {
    this.events.length = 0;

    // vehicles vs static geometry (two passes for stability in corners)
    for (let pass = 0; pass < 2; pass++) {
      for (const v of vehicles) {
        const box = v.obb;
        for (const s of this.statics) {
          const c = obbVsObb(box, s);
          if (!c) continue;
          v.x -= c.nx * c.depth;
          v.z -= c.nz * c.depth;
          const vn = v.vx * c.nx + v.vz * c.nz;
          if (vn > 0) {
            v.vx -= c.nx * vn * (1 + RESTITUTION);
            v.vz -= c.nz * vn * (1 + RESTITUTION);
            // scraping friction
            v.vx *= 0.9;
            v.vz *= 0.9;
            if (pass === 0 && vn > 2) {
              v.damage += vn;
              v.lastImpact = vn;
              this.events.push({ type: 'vehicle-static', vehicle: v, impact: vn });
            }
          }
          box.x = v.x;
          box.z = v.z;
        }
      }
    }

    // vehicle vs vehicle
    for (let i = 0; i < vehicles.length; i++) {
      const a = vehicles[i];
      for (let j = i + 1; j < vehicles.length; j++) {
        const b = vehicles[j];
        const c = obbVsObb(a.obb, b.obb);
        if (!c) continue;
        const ma = a.spec.mass;
        const mb = b.spec.mass;
        const total = ma + mb;
        const pushA = c.depth * (mb / total);
        const pushB = c.depth * (ma / total);
        a.x -= c.nx * pushA;
        a.z -= c.nz * pushA;
        b.x += c.nx * pushB;
        b.z += c.nz * pushB;

        const rvx = b.vx - a.vx;
        const rvz = b.vz - a.vz;
        const rvn = rvx * c.nx + rvz * c.nz;
        if (rvn < 0) {
          const jImp = (-(1 + RESTITUTION) * rvn) / (1 / ma + 1 / mb);
          a.vx -= (jImp / ma) * c.nx;
          a.vz -= (jImp / ma) * c.nz;
          b.vx += (jImp / mb) * c.nx;
          b.vz += (jImp / mb) * c.nz;
          const impact = -rvn;
          if (impact > 1.5) {
            a.damage += impact * 0.5;
            b.damage += impact * 0.5;
            a.lastImpact = impact;
            b.lastImpact = impact;
            this.events.push({ type: 'vehicle-vehicle', a, b, impact });
          }
        }
      }
    }

    // pedestrians vs vehicles / statics / each other
    for (const p of pedestrians) {
      const circle = p.circle;
      for (const v of vehicles) {
        const c = circleVsObb(circle, v.obb);
        if (!c) continue;
        p.x += c.nx * c.depth;
        p.z += c.nz * c.depth;
        circle.x = p.x;
        circle.z = p.z;
        const impact = v.vx * c.nx + v.vz * c.nz; // vehicle velocity towards the pedestrian
        if (impact > 3 && !p.isDown) {
          p.knockDown(v.x, v.z, v.vx * 0.8 + c.nx * 3, v.vz * 0.8 + c.nz * 3);
          v.vx *= 0.92;
          v.vz *= 0.92;
          this.events.push({ type: 'vehicle-ped', vehicle: v, ped: p, impact });
        } else if (impact > 0.5 && !p.isDown) {
          p.startFlee(v.x, v.z, 3);
        }
      }
      for (const s of this.statics) {
        const c = circleVsObb(circle, s);
        if (!c) continue;
        p.x += c.nx * c.depth;
        p.z += c.nz * c.depth;
        circle.x = p.x;
        circle.z = p.z;
      }
    }
    for (let i = 0; i < pedestrians.length; i++) {
      const a = pedestrians[i];
      for (let j = i + 1; j < pedestrians.length; j++) {
        const b = pedestrians[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        if (dx * dx + dz * dz > 1.2) continue;
        const c = circleVsCircle(a.circle, b.circle);
        if (!c) continue;
        const half = c.depth * 0.5;
        a.x -= c.nx * half;
        a.z -= c.nz * half;
        b.x += c.nx * half;
        b.z += c.nz * half;
      }
    }

    // player on foot
    if (player.onFoot) {
      const circle = player.circle;
      for (let pass = 0; pass < 2; pass++) {
        for (const s of this.statics) {
          const c = circleVsObb(circle, s);
          if (!c) continue;
          player.x += c.nx * c.depth;
          player.z += c.nz * c.depth;
          const vn = player.vx * c.nx + player.vz * c.nz;
          if (vn < 0) {
            player.vx -= c.nx * vn;
            player.vz -= c.nz * vn;
          }
          circle.x = player.x;
          circle.z = player.z;
        }
        for (const v of vehicles) {
          const c = circleVsObb(circle, v.obb);
          if (!c) continue;
          player.x += c.nx * c.depth;
          player.z += c.nz * c.depth;
          const vn = player.vx * c.nx + player.vz * c.nz;
          if (vn < 0) {
            player.vx -= c.nx * vn;
            player.vz -= c.nz * vn;
          }
          circle.x = player.x;
          circle.z = player.z;
          const impact = v.vx * c.nx + v.vz * c.nz;
          if (pass === 0 && impact > 3) {
            player.vx += c.nx * impact * 0.8;
            player.vz += c.nz * impact * 0.8;
            this.events.push({ type: 'vehicle-player', vehicle: v, impact });
          }
        }
      }
      for (const p of pedestrians) {
        const c = circleVsCircle(circle, p.circle);
        if (!c) continue;
        const half = c.depth * 0.5;
        player.x -= c.nx * half;
        player.z -= c.nz * half;
        p.x += c.nx * half;
        p.z += c.nz * half;
      }
    }
  }
}
