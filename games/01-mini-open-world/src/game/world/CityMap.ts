import type { OBB } from '../physics/collision';
import { mulberry32, pick, randInt, randRange, type Rng } from '../core/rng';
import { BLOCK, ROADS, SIDEWALK_W, WORLD_LIMIT, blockCenter } from './constants';
import { RoadGraph } from './RoadGraph';
import { SidewalkGraph } from './SidewalkGraph';
import type { VehicleKind } from '../entities/VehicleSpecs';

export type BlockType = 'buildings' | 'park' | 'depot' | 'warehouse' | 'police' | 'restricted';

export interface BuildingDesc {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  style: number; // index into the facade style table (special styles: 100 depot, 101 warehouse, 102 police, 103 bunker)
}

export type PropKind = 'tree' | 'lamp' | 'bench' | 'crate' | 'fountain' | 'tank' | 'fence' | 'hedge' | 'barrier';

export interface PropDesc {
  kind: PropKind;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  angle: number;
  color?: number;
}

export interface SignDesc {
  text: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  w: number;
  h: number;
  bg: string;
  fg: string;
}

export interface Pose {
  x: number;
  z: number;
  yaw: number;
}

export interface ParkedCarDesc extends Pose {
  kind: VehicleKind;
  color?: number;
  mission?: boolean;
}

export interface BlockDesc {
  bi: number;
  bj: number;
  cx: number;
  cz: number;
  type: BlockType;
}

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CityData {
  blocks: BlockDesc[];
  buildings: BuildingDesc[];
  props: PropDesc[];
  signs: SignDesc[];
  colliders: OBB[];
  parkedCars: ParkedCarDesc[];
  missionStart: { x: number; z: number };
  missionEnd: { x: number; z: number };
  policeSlots: Pose[];
  playerSpawn: Pose;
  bustedSpawn: Pose;
  restrictedZone: Rect;
  roads: RoadGraph;
  sidewalks: SidewalkGraph;
}

const SPECIAL: Record<string, BlockType> = {
  '0,1': 'depot',
  '4,3': 'warehouse',
  '2,2': 'police',
  '4,0': 'restricted',
  '1,3': 'park',
  '3,1': 'park',
  '0,4': 'park',
};

const CAR_COLORS = [0xc0392b, 0x2980b9, 0x27ae60, 0xf1c40f, 0x8e44ad, 0xecf0f1, 0x34495e, 0xe67e22, 0x16a085, 0x7f8c8d];

export function buildCity(seed = 1337): CityData {
  const rng = mulberry32(seed);
  const blocks: BlockDesc[] = [];
  const buildings: BuildingDesc[] = [];
  const props: PropDesc[] = [];
  const signs: SignDesc[] = [];
  const colliders: OBB[] = [];
  const parkedCars: ParkedCarDesc[] = [];

  const addBox = (x: number, z: number, w: number, d: number, angle = 0) => {
    colliders.push({ x, z, hx: w / 2, hz: d / 2, angle });
  };
  const addBuilding = (b: BuildingDesc) => {
    buildings.push(b);
    addBox(b.x, b.z, b.w, b.d);
  };
  const addProp = (p: PropDesc, collide = true) => {
    props.push(p);
    if (collide) addBox(p.x, p.z, p.w, p.d, p.angle);
  };

  let missionStart = { x: 0, z: 0 };
  let missionEnd = { x: 0, z: 0 };
  const policeSlots: Pose[] = [];
  let playerSpawn: Pose = { x: 0, z: 0, yaw: 0 };
  let bustedSpawn: Pose = { x: 0, z: 0, yaw: 0 };
  let restrictedZone: Rect = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };

  const half = BLOCK / 2;
  const inner = half - SIDEWALK_W; // 14

  for (let bi = 0; bi < ROADS - 1; bi++) {
    for (let bj = 0; bj < ROADS - 1; bj++) {
      const cx = blockCenter(bi);
      const cz = blockCenter(bj);
      const type: BlockType = SPECIAL[`${bi},${bj}`] ?? 'buildings';
      blocks.push({ bi, bj, cx, cz, type });

      // lamp posts near the curb, offset from the block centre lines so lot entrances stay clear
      const lampOff = half - 0.6;
      const q = half / 2;
      for (const [lx, lz] of [
        [cx - q, cz - lampOff],
        [cx + q, cz + lampOff],
        [cx - lampOff, cz + q],
        [cx + lampOff, cz - q],
      ]) {
        addProp({ kind: 'lamp', x: lx, z: lz, w: 0.4, d: 0.4, h: 5, angle: 0 });
      }

      switch (type) {
        case 'buildings':
          genBuildingBlock(rng, cx, cz, inner, addBuilding, addProp, parkedCars);
          break;
        case 'park':
          genPark(rng, cx, cz, inner, addProp);
          break;
        case 'depot': {
          addBuilding({ x: cx, z: cz - 6, w: 24, d: 16, h: 9, style: 100 });
          signs.push({ text: 'DISPATCH DEPOT', x: cx, y: 6.5, z: cz + 2.15, yaw: 0, w: 16, h: 2.4, bg: '#d35400', fg: '#ffffff' });
          missionStart = { x: cx, z: cz + 8.5 };
          parkedCars.push({ x: cx + 8, z: cz + 8, yaw: 0, kind: 'van', color: 0xe67e22, mission: true });
          parkedCars.push({ x: cx - 8, z: cz + 8, yaw: 0, kind: 'sedan', color: 0x2980b9 });
          addProp({ kind: 'crate', x: cx - 12.5, z: cz + 12, w: 2, d: 2, h: 1.6, angle: 0.3 });
          addProp({ kind: 'crate', x: cx + 12.5, z: cz + 12.5, w: 2.4, d: 1.6, h: 1.2, angle: -0.2 });
          playerSpawn = { x: cx, z: cz + 15.5, yaw: Math.PI };
          break;
        }
        case 'warehouse': {
          addBuilding({ x: cx, z: cz - 6, w: 26, d: 16, h: 11, style: 101 });
          signs.push({ text: 'HARBOR WAREHOUSE', x: cx, y: 8, z: cz + 2.15, yaw: 0, w: 18, h: 2.4, bg: '#1f3a5f', fg: '#ffffff' });
          missionEnd = { x: cx, z: cz + 8.5 };
          addProp({ kind: 'crate', x: cx - 11.5, z: cz + 11, w: 2.2, d: 2.2, h: 1.8, angle: 0.1 });
          addProp({ kind: 'crate', x: cx + 11.5, z: cz + 11, w: 2.2, d: 2.2, h: 1.4, angle: -0.4 });
          addProp({ kind: 'crate', x: cx + 11.5, z: cz + 6.5, w: 1.6, d: 1.6, h: 1.0, angle: 0.8 });
          break;
        }
        case 'police': {
          addBuilding({ x: cx, z: cz - 6.5, w: 28, d: 15, h: 12, style: 102 });
          signs.push({ text: 'POLICE', x: cx, y: 8.5, z: cz + 1.15, yaw: 0, w: 12, h: 2.6, bg: '#1a3c8a', fg: '#ffffff' });
          for (const sx of [-8, 0, 8]) policeSlots.push({ x: cx + sx, z: cz + 7, yaw: 0 });
          addProp({ kind: 'barrier', x: cx - 13, z: cz + 8, w: 0.6, d: 8, h: 1, angle: 0, color: 0x3b5bdb });
          addProp({ kind: 'barrier', x: cx + 13, z: cz + 8, w: 0.6, d: 8, h: 1, angle: 0, color: 0x3b5bdb });
          bustedSpawn = { x: cx, z: cz + 15.5, yaw: 0 };
          break;
        }
        case 'restricted': {
          const f = inner;
          addProp({ kind: 'fence', x: cx, z: cz - f, w: 2 * f, d: 0.3, h: 2.2, angle: 0 });
          addProp({ kind: 'fence', x: cx - f, z: cz, w: 0.3, d: 2 * f, h: 2.2, angle: 0 });
          addProp({ kind: 'fence', x: cx + f, z: cz, w: 0.3, d: 2 * f, h: 2.2, angle: 0 });
          addProp({ kind: 'fence', x: cx - (f + 4.5) / 2, z: cz + f, w: f - 4.5, d: 0.3, h: 2.2, angle: 0 });
          addProp({ kind: 'fence', x: cx + (f + 4.5) / 2, z: cz + f, w: f - 4.5, d: 0.3, h: 2.2, angle: 0 });
          addProp({ kind: 'tank', x: cx - 8, z: cz - 6, w: 5.6, d: 5.6, h: 5, angle: 0 });
          addProp({ kind: 'tank', x: cx + 8, z: cz - 6, w: 5.6, d: 5.6, h: 5, angle: 0 });
          addProp({ kind: 'tank', x: cx, z: cz - 8, w: 4.6, d: 4.6, h: 6.5, angle: 0 });
          addBuilding({ x: cx + 7, z: cz + 6, w: 8, d: 6, h: 3.5, style: 103 });
          signs.push({ text: 'RESTRICTED AREA - KEEP OUT', x: cx, y: 3.1, z: cz + f + 0.4, yaw: 0, w: 9, h: 1.3, bg: '#b71c1c', fg: '#fff59d' });
          restrictedZone = { minX: cx - f + 0.5, maxX: cx + f - 0.5, minZ: cz - f + 0.5, maxZ: cz + f - 0.5 };
          break;
        }
      }
    }
  }

  // world boundary hedges (keep everything inside the playable area)
  const L = WORLD_LIMIT;
  addProp({ kind: 'hedge', x: 0, z: -L, w: 2 * L + 2, d: 1.2, h: 1.6, angle: 0 });
  addProp({ kind: 'hedge', x: 0, z: L, w: 2 * L + 2, d: 1.2, h: 1.6, angle: 0 });
  addProp({ kind: 'hedge', x: -L, z: 0, w: 1.2, d: 2 * L + 2, h: 1.6, angle: 0 });
  addProp({ kind: 'hedge', x: L, z: 0, w: 1.2, d: 2 * L + 2, h: 1.6, angle: 0 });

  return {
    blocks,
    buildings,
    props,
    signs,
    colliders,
    parkedCars,
    missionStart,
    missionEnd,
    policeSlots,
    playerSpawn,
    bustedSpawn,
    restrictedZone,
    roads: new RoadGraph(),
    sidewalks: new SidewalkGraph(),
  };
}

function genBuildingBlock(
  rng: Rng,
  cx: number,
  cz: number,
  inner: number,
  addBuilding: (b: BuildingDesc) => void,
  addProp: (p: PropDesc, collide?: boolean) => void,
  parkedCars: ParkedCarDesc[],
): void {
  if (rng() < 0.18) {
    // single large tower
    const w = randRange(rng, 18, 24);
    const d = randRange(rng, 18, 24);
    addBuilding({ x: cx, z: cz, w, d, h: randRange(rng, 26, 46), style: randInt(rng, 0, 5) });
    return;
  }
  const lotHalf = inner / 2; // 7
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const lx = cx + sx * lotHalf;
      const lz = cz + sz * lotHalf;
      const r = rng();
      if (r < 0.14) {
        // small parking lot with a parked car and a crate
        if (rng() < 0.8) {
          parkedCars.push({
            x: lx + randRange(rng, -1.5, 1.5),
            z: lz + randRange(rng, -1.5, 1.5),
            yaw: pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]) + randRange(rng, -0.15, 0.15),
            kind: pick(rng, ['sedan', 'hatch', 'pickup', 'taxi'] as VehicleKind[]),
            color: pick(rng, CAR_COLORS),
          });
        }
        addProp({ kind: 'crate', x: lx + sx * 4.5, z: lz + sz * 4.5, w: 1.6, d: 1.6, h: 1.2, angle: rng() });
        continue;
      }
      const w = randRange(rng, 7, 11);
      const d = randRange(rng, 7, 11);
      const tall = rng() > 0.8;
      const h = tall ? randRange(rng, 24, 38) : randRange(rng, 7, 20);
      addBuilding({
        x: lx + randRange(rng, -0.8, 0.8),
        z: lz + randRange(rng, -0.8, 0.8),
        w,
        d,
        h,
        style: randInt(rng, 0, 5),
      });
    }
  }
  // a couple of street trees on the sidewalk corners of the block
  if (rng() < 0.6) {
    const tx = cx + (rng() < 0.5 ? -1 : 1) * (inner + 1.2);
    const tz = cz + randRange(rng, -6, 6);
    addProp({ kind: 'tree', x: tx, z: tz, w: 0.9, d: 0.9, h: randRange(rng, 3.5, 5), angle: 0 });
  }
}

function genPark(rng: Rng, cx: number, cz: number, inner: number, addProp: (p: PropDesc, collide?: boolean) => void): void {
  addProp({ kind: 'fountain', x: cx, z: cz, w: 5.6, d: 5.6, h: 1, angle: 0 });
  for (let k = 0; k < 12; k++) {
    let tx = 0;
    let tz = 0;
    for (let tries = 0; tries < 10; tries++) {
      tx = cx + randRange(rng, -inner + 1.5, inner - 1.5);
      tz = cz + randRange(rng, -inner + 1.5, inner - 1.5);
      if (Math.hypot(tx - cx, tz - cz) > 6.5) break;
    }
    addProp({ kind: 'tree', x: tx, z: tz, w: 0.9, d: 0.9, h: randRange(rng, 3.5, 6), angle: 0 });
  }
  for (const [bx, bz, a] of [
    [cx - 5, cz, Math.PI / 2],
    [cx + 5, cz, Math.PI / 2],
    [cx, cz - 5, 0],
    [cx, cz + 5, 0],
  ]) {
    addProp({ kind: 'bench', x: bx, z: bz, w: 2, d: 0.6, h: 0.5, angle: a });
  }
}
