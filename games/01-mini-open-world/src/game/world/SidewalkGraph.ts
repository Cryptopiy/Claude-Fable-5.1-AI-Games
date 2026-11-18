import { ROADS, ROAD_HALF, SIDEWALK_W, roadCoord } from './constants';

export interface WalkNode {
  x: number;
  z: number;
  neighbors: number[];
}

/**
 * Pedestrian waypoint network: one node on each of the four sidewalk corners around every
 * intersection. Edges run along the block sides and across the roads (crosswalks).
 */
export class SidewalkGraph {
  readonly nodes: WalkNode[] = [];

  constructor() {
    const off = ROAD_HALF + SIDEWALK_W / 2;
    for (let i = 0; i < ROADS; i++) {
      for (let j = 0; j < ROADS; j++) {
        for (let sx = 0; sx < 2; sx++) {
          for (let sz = 0; sz < 2; sz++) {
            this.nodes.push({
              x: roadCoord(i) + (sx ? off : -off),
              z: roadCoord(j) + (sz ? off : -off),
              neighbors: [],
            });
          }
        }
      }
    }
    const id = (i: number, j: number, sx: number, sz: number) => ((i * ROADS + j) * 2 + sx) * 2 + sz;
    const link = (a: number, b: number) => {
      this.nodes[a].neighbors.push(b);
      this.nodes[b].neighbors.push(a);
    };
    for (let i = 0; i < ROADS; i++) {
      for (let j = 0; j < ROADS; j++) {
        // crosswalks
        link(id(i, j, 0, 0), id(i, j, 1, 0));
        link(id(i, j, 0, 1), id(i, j, 1, 1));
        link(id(i, j, 0, 0), id(i, j, 0, 1));
        link(id(i, j, 1, 0), id(i, j, 1, 1));
        // along block edges
        if (i + 1 < ROADS) {
          link(id(i, j, 1, 0), id(i + 1, j, 0, 0));
          link(id(i, j, 1, 1), id(i + 1, j, 0, 1));
        }
        if (j + 1 < ROADS) {
          link(id(i, j, 0, 1), id(i, j + 1, 0, 0));
          link(id(i, j, 1, 1), id(i, j + 1, 1, 0));
        }
      }
    }
  }

  nearest(x: number, z: number): number {
    let best = 0;
    let bestD = Infinity;
    for (let k = 0; k < this.nodes.length; k++) {
      const n = this.nodes[k];
      const d = (n.x - x) * (n.x - x) + (n.z - z) * (n.z - z);
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    return best;
  }
}
