import { clamp } from '../core/mathUtils';
import { INTERSECTION_MARGIN, LANE_OFFSET, PITCH, ROADS, ROAD_HALF, CITY_SPAN, roadCoord } from './constants';

export interface RoadNode {
  i: number;
  j: number;
  x: number;
  z: number;
  neighbors: number[];
}

export interface Vec2 {
  x: number;
  z: number;
}

/** Grid of intersections. Every road segment connects two adjacent intersections. */
export class RoadGraph {
  readonly nodes: RoadNode[] = [];

  constructor() {
    for (let i = 0; i < ROADS; i++) {
      for (let j = 0; j < ROADS; j++) {
        this.nodes.push({ i, j, x: roadCoord(i), z: roadCoord(j), neighbors: [] });
      }
    }
    for (const n of this.nodes) {
      if (n.i > 0) n.neighbors.push(this.index(n.i - 1, n.j));
      if (n.i < ROADS - 1) n.neighbors.push(this.index(n.i + 1, n.j));
      if (n.j > 0) n.neighbors.push(this.index(n.i, n.j - 1));
      if (n.j < ROADS - 1) n.neighbors.push(this.index(n.i, n.j + 1));
    }
  }

  index(i: number, j: number): number {
    return i * ROADS + j;
  }

  nearestNode(x: number, z: number): number {
    const i = clamp(Math.round((x + CITY_SPAN / 2) / PITCH), 0, ROADS - 1);
    const j = clamp(Math.round((z + CITY_SPAN / 2) / PITCH), 0, ROADS - 1);
    return this.index(i, j);
  }

  /** Unit direction from node a to node b (axis aligned). */
  dir(a: number, b: number): Vec2 {
    const na = this.nodes[a];
    const nb = this.nodes[b];
    const dx = nb.x - na.x;
    const dz = nb.z - na.z;
    const len = Math.hypot(dx, dz) || 1;
    return { x: dx / len, z: dz / len };
  }

  /** Right-hand side of a direction (used for lane offsets). */
  static right(d: Vec2): Vec2 {
    return { x: -d.z, z: d.x };
  }

  /** Lane point at `to`, right before the intersection, for a vehicle travelling from -> to. */
  laneEntry(from: number, to: number): Vec2 {
    const d = this.dir(from, to);
    const r = RoadGraph.right(d);
    const n = this.nodes[to];
    const back = ROAD_HALF + INTERSECTION_MARGIN;
    return { x: n.x + r.x * LANE_OFFSET - d.x * back, z: n.z + r.z * LANE_OFFSET - d.z * back };
  }

  /** Lane point at `from`, right after the intersection, for a vehicle travelling from -> to. */
  laneExit(from: number, to: number): Vec2 {
    const d = this.dir(from, to);
    const r = RoadGraph.right(d);
    const n = this.nodes[from];
    const ahead = ROAD_HALF + INTERSECTION_MARGIN;
    return { x: n.x + r.x * LANE_OFFSET + d.x * ahead, z: n.z + r.z * LANE_OFFSET + d.z * ahead };
  }

  /** Position on the lane of segment from -> to at fraction t (0..1). */
  lanePoint(from: number, to: number, t: number): Vec2 {
    const a = this.nodes[from];
    const b = this.nodes[to];
    const d = this.dir(from, to);
    const r = RoadGraph.right(d);
    return {
      x: a.x + (b.x - a.x) * t + r.x * LANE_OFFSET,
      z: a.z + (b.z - a.z) * t + r.z * LANE_OFFSET,
    };
  }

  /** Breadth-first shortest path (uniform grid). Returns node indices including start and goal. */
  findPath(start: number, goal: number): number[] {
    if (start === goal) return [start];
    const prev = new Int32Array(this.nodes.length).fill(-1);
    const visited = new Uint8Array(this.nodes.length);
    const queue: number[] = [start];
    visited[start] = 1;
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      if (cur === goal) break;
      for (const nb of this.nodes[cur].neighbors) {
        if (!visited[nb]) {
          visited[nb] = 1;
          prev[nb] = cur;
          queue.push(nb);
        }
      }
    }
    if (!visited[goal]) return [start];
    const path: number[] = [];
    let c = goal;
    while (c !== -1) {
      path.push(c);
      c = prev[c];
    }
    path.reverse();
    return path;
  }
}
