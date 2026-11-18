import type { Vehicle } from '../entities/Vehicle';
import { pointInObb, segmentClear } from '../physics/collision';
import type { Pose } from '../world/CityMap';
import type { RoadGraph, Vec2 } from '../world/RoadGraph';
import { obstacleAhead, steerTowards, throttleFor, type AIContext } from './AIContext';

export type PoliceState = 'idle' | 'pursue' | 'return';

export interface PoliceDriverState {
  kind: 'police';
  state: PoliceState;
  home: Pose;
  path: Vec2[];
  repathTimer: number;
  stuckTimer: number;
  reverseTimer: number;
  direct: boolean;
}

export function createPoliceDriver(home: Pose): PoliceDriverState {
  return {
    kind: 'police',
    state: 'idle',
    home,
    path: [],
    repathTimer: 0,
    stuckTimer: 0,
    reverseTimer: 0,
    direct: false,
  };
}

/** Convert a node path into lane waypoints (exit of each node + entry of the next). */
function pathToWaypoints(roads: RoadGraph, nodes: number[]): Vec2[] {
  const out: Vec2[] = [];
  for (let k = 0; k + 1 < nodes.length; k++) {
    out.push(roads.laneExit(nodes[k], nodes[k + 1]));
    out.push(roads.laneEntry(nodes[k], nodes[k + 1]));
  }
  if (nodes.length === 1) {
    const n = roads.nodes[nodes[0]];
    out.push({ x: n.x, z: n.z });
  }
  return out;
}

function planRoute(v: Vehicle, st: PoliceDriverState, tx: number, tz: number, roads: RoadGraph): void {
  const start = roads.nearestNode(v.x, v.z);
  const goal = roads.nearestNode(tx, tz);
  const nodes = roads.findPath(start, goal);
  st.path = pathToWaypoints(roads, nodes);
  // drop waypoints that are already behind us
  while (st.path.length > 1) {
    const p = st.path[0];
    const ahead = (p.x - v.x) * v.forwardX() + (p.z - v.z) * v.forwardZ();
    if (ahead < -2 || Math.hypot(p.x - v.x, p.z - v.z) < 3) st.path.shift();
    else break;
  }
}

/** Simple feeler-based avoidance against static geometry. Returns a steering correction. */
function avoidStatics(v: Vehicle, ctx: AIContext): number {
  const fx = v.forwardX();
  const fz = v.forwardZ();
  const rx = v.rightX();
  const rz = v.rightZ();
  const look = 5 + Math.abs(v.speedFwd) * 0.35;
  const probe = (side: number): boolean => {
    const px = v.x + fx * look + rx * side;
    const pz = v.z + fz * look + rz * side;
    for (const o of ctx.statics) {
      if (pointInObb(px, pz, o, 0.6)) return true;
    }
    return false;
  };
  const center = probe(0);
  const left = probe(-2.2);
  const right = probe(2.2);
  if (!center && !left && !right) return 0;
  if (center && !left && right) return -1;
  if (center && left && !right) return 1;
  if (center && left && right) return 0;
  if (left) return 0.6;
  if (right) return -0.6;
  return 0;
}

export function updatePolice(v: Vehicle, dt: number, ctx: AIContext): void {
  const st = v.ai;
  if (!st || st.kind !== 'police') return;
  const roads = ctx.roads;
  const pl = ctx.player;

  if (st.state === 'idle') {
    v.throttle = 0;
    v.steer = 0;
    v.handbrake = true;
    v.sirenOn = false;
    return;
  }

  v.sirenOn = st.state === 'pursue';

  // choose the goal
  const goalX = st.state === 'pursue' ? pl.worldX + pl.worldVx * 0.35 : st.home.x;
  const goalZ = st.state === 'pursue' ? pl.worldZ + pl.worldVz * 0.35 : st.home.z;
  const distGoal = Math.hypot(goalX - v.x, goalZ - v.z);

  st.repathTimer -= dt;
  if (st.repathTimer <= 0) {
    st.repathTimer = 0.6;
    const los = distGoal < 45 && segmentClear(v.x, v.z, goalX, goalZ, ctx.statics);
    st.direct = los || (st.path.length === 0 && distGoal < 20);
    if (!st.direct) planRoute(v, st, goalX, goalZ, roads);
  }

  // reverse manoeuvre when stuck against something
  if (st.reverseTimer > 0) {
    st.reverseTimer -= dt;
    v.throttle = -0.7;
    v.steer = -steerTowards(v, goalX, goalZ).steer;
    v.handbrake = false;
    return;
  }

  let tx = goalX;
  let tz = goalZ;
  if (!st.direct && st.path.length > 0) {
    let p = st.path[0];
    const ahead = (p.x - v.x) * v.forwardX() + (p.z - v.z) * v.forwardZ();
    if (Math.hypot(p.x - v.x, p.z - v.z) < 3.2 || ahead < -1.5) {
      st.path.shift();
      if (st.path.length > 0) p = st.path[0];
      else st.direct = true;
    }
    if (!st.direct) {
      tx = p.x;
      tz = p.z;
    }
  }

  const { steer, angle } = steerTowards(v, tx, tz, 2.6);
  v.steer = Math.max(-1, Math.min(1, steer + avoidStatics(v, ctx)));

  let targetSpeed = v.spec.maxSpeed * (st.state === 'pursue' ? 0.9 : 0.5);
  if (Math.abs(angle) > 0.35) targetSpeed = Math.min(targetSpeed, 7);
  if (Math.abs(angle) > 1.3) targetSpeed = Math.min(targetSpeed, 3.5);

  if (st.state === 'pursue') {
    // close in, but do not run over the player when they are on foot
    if (pl.onFoot) {
      if (distGoal < 14) targetSpeed = Math.min(targetSpeed, Math.max(0, distGoal - 4.5) * 1.8);
    } else if (distGoal < 12) {
      targetSpeed = Math.min(targetSpeed, Math.max(6, pl.vehicle ? pl.vehicle.speed + 4 : 6));
    }
    // avoid traffic (excluding the player's car, which we are trying to ram)
    const gap = obstacleAhead(v, ctx, 12, 2.2, false);
    if (gap < 8) {
      targetSpeed = Math.min(targetSpeed, Math.max(2, gap * 1.5));
      v.steer = Math.max(-1, Math.min(1, v.steer - 0.5));
    }
  } else {
    const gap = obstacleAhead(v, ctx, 14, 2.4);
    if (gap < Infinity) targetSpeed = Math.min(targetSpeed, Math.max(0, gap - 2.5) * 1.6);
    if (distGoal < 10) targetSpeed = Math.min(targetSpeed, Math.max(1.5, distGoal * 0.8));
  }

  throttleFor(v, targetSpeed);

  if (targetSpeed > 1.5 && Math.abs(v.speedFwd) < 0.4) {
    st.stuckTimer += dt;
    if (st.stuckTimer > 2.2) {
      st.stuckTimer = 0;
      st.reverseTimer = 1.1;
    }
  } else {
    st.stuckTimer = Math.max(0, st.stuckTimer - dt);
  }
}
