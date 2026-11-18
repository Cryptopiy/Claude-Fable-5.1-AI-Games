import type { Vehicle } from '../entities/Vehicle';
import { ROAD_HALF } from '../world/constants';
import type { RoadGraph, Vec2 } from '../world/RoadGraph';
import { obstacleAhead, steerTowards, throttleFor, type AIContext } from './AIContext';

export interface TrafficDriverState {
  kind: 'traffic';
  from: number;
  to: number;
  targets: Vec2[];
  cruise: number;
  stuckTimer: number;
  reverseTimer: number;
  waitTimer: number; // time spent waiting at an intersection
}

export function createTrafficDriver(roads: RoadGraph, from: number, to: number, cruise: number): TrafficDriverState {
  return {
    kind: 'traffic',
    from,
    to,
    targets: [roads.laneEntry(from, to)],
    cruise,
    stuckTimer: 0,
    reverseTimer: 0,
    waitTimer: 0,
  };
}

function chooseNext(roads: RoadGraph, from: number, to: number, rng: () => number): number {
  const n = roads.nodes[to];
  const options = n.neighbors.filter((k) => k !== from);
  if (options.length === 0) return from;
  const d = roads.dir(from, to);
  // prefer going straight
  const weights = options.map((k) => {
    const d2 = roads.dir(to, k);
    const dot = d.x * d2.x + d.z * d2.z;
    return dot > 0.5 ? 2.0 : 1.0;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let k = 0; k < options.length; k++) {
    r -= weights[k];
    if (r <= 0) return options[k];
  }
  return options[options.length - 1];
}

/** True when another vehicle occupies or is about to enter the intersection with priority. */
function mustYield(v: Vehicle, node: number, ctx: AIContext): boolean {
  const n = ctx.roads.nodes[node];
  const box = ROAD_HALF + 0.6;
  const rx = v.rightX();
  const rz = v.rightZ();
  for (const o of ctx.vehicles) {
    if (o === v) continue;
    const dx = o.x - n.x;
    const dz = o.z - n.z;
    const cheb = Math.max(Math.abs(dx), Math.abs(dz));
    if (cheb < box && o.speed > 0.4) return true; // someone inside the intersection
    // priority to the right for vehicles approaching the same intersection
    if (cheb < ROAD_HALF + 9 && o.speed > 1.5) {
      const side = (o.x - v.x) * rx + (o.z - v.z) * rz;
      const towards = (n.x - o.x) * o.forwardX() + (n.z - o.z) * o.forwardZ();
      if (side > 3 && towards > 0) return true;
    }
  }
  return false;
}

export function updateTraffic(v: Vehicle, dt: number, ctx: AIContext): void {
  const st = v.ai;
  if (!st || st.kind !== 'traffic') return;
  const roads = ctx.roads;

  if (st.targets.length === 0) st.targets.push(roads.laneEntry(st.from, st.to));
  let target = st.targets[0];

  // waypoint reached (or passed)?
  const d = roads.dir(st.from, st.to);
  const dx = target.x - v.x;
  const dz = target.z - v.z;
  const along = dx * d.x + dz * d.z;
  if (Math.hypot(dx, dz) < 2.6 || along < -1) {
    st.targets.shift();
    if (st.targets.length === 0) {
      // The queue only empties after the lane entry of `to` was reached:
      // pick the next node and queue the intersection exit + the next entry.
      const next = chooseNext(roads, st.from, st.to, ctx.rng);
      st.targets.push(roads.laneExit(st.to, next));
      st.targets.push(roads.laneEntry(st.to, next));
      st.from = st.to;
      st.to = next;
      st.waitTimer = 0;
    }
    target = st.targets[0];
  }

  // reverse manoeuvre when stuck
  if (st.reverseTimer > 0) {
    st.reverseTimer -= dt;
    v.throttle = -0.6;
    v.steer = -steerTowards(v, target.x, target.z).steer;
    v.handbrake = false;
    return;
  }

  const { steer, angle } = steerTowards(v, target.x, target.z);
  v.steer = steer;

  let targetSpeed = st.cruise;
  if (Math.abs(angle) > 0.25) targetSpeed = Math.min(targetSpeed, 5.5);
  if (Math.abs(angle) > 1.2) targetSpeed = Math.min(targetSpeed, 3);

  const gap = obstacleAhead(v, ctx, 14, 2.4);
  if (gap < Infinity) {
    targetSpeed = Math.min(targetSpeed, Math.max(0, gap - 2.5) * 1.6);
  }

  // intersection yielding while approaching the entry point of the next intersection
  if (st.targets.length === 1) {
    const node = roads.nodes[st.to];
    const distToNode = Math.hypot(node.x - v.x, node.z - v.z);
    if (distToNode < ROAD_HALF + 7 && distToNode > ROAD_HALF + 0.5) {
      if (mustYield(v, st.to, ctx) && st.waitTimer < 6) {
        targetSpeed = 0;
        st.waitTimer += dt;
      }
    }
  }

  throttleFor(v, targetSpeed);

  // stuck detection
  if (targetSpeed > 1 && Math.abs(v.speedFwd) < 0.3) {
    st.stuckTimer += dt;
    if (st.stuckTimer > 3) {
      st.stuckTimer = 0;
      st.reverseTimer = 1.2;
    }
  } else {
    st.stuckTimer = Math.max(0, st.stuckTimer - dt);
  }
}
