import type {
  BuildingDefinition,
  TerrainData,
  VehicleDefinition,
} from './types';

export const GRID_COLUMNS = 68;
export const GRID_ROWS = 50;
export const CELL_SIZE = 2;
export const ORIGIN_X = -67;
export const ORIGIN_Z = -49;

const mainRoadZ = (x: number) => 1.6 * Math.sin((x + 18) * 0.045);

export function terrainElevation(x: number, z: number): number {
  const inland = Math.max(0, x - ORIGIN_X);
  const coastalRise = 0.18 + inland * 0.044;
  const safeHill = 8.5 * Math.exp(-(((x - 49) / 22) ** 2 + ((z + 27) / 18) ** 2));
  const northRidge = 4.8 * Math.exp(-(((x - 24) / 29) ** 2 + ((z - 38) / 14) ** 2));
  const lowBasin = -1.65 * Math.exp(-(((x + 2) / 19) ** 2 + ((z + 23) / 15) ** 2));
  const undulation =
    0.28 * Math.sin(x * 0.115) * Math.cos(z * 0.09) +
    0.16 * Math.sin((x + z) * 0.18);

  let elevation = coastalRise + safeHill + northRidge + lowBasin + undulation;
  if (isRoad(x, z)) elevation -= 0.38;
  return Math.max(0.08, elevation);
}

export function isRoad(x: number, z: number): boolean {
  const eastWest = Math.abs(z - mainRoadZ(x)) < 1.8;
  const coastal = Math.abs(x + 28) < 1.7 && z > -39 && z < 39;
  const civic = Math.abs(x - 12) < 1.65 && z > -38 && z < 36;
  const upland = Math.abs(x - 45) < 1.7 && z > -42 && z < 31;
  const northLink = Math.abs(z - 27) < 1.65 && x > -29 && x < 46;
  return eastWest || coastal || civic || upland || northLink;
}

const buildingSeed: Array<Omit<BuildingDefinition, 'id'>> = [
  { x: -51, z: -31, width: 9, depth: 8, height: 5.5, color: 0xe7c9a1 },
  { x: -50, z: -17, width: 8, depth: 7, height: 7, color: 0xcf9076 },
  { x: -50, z: 15, width: 9, depth: 8, height: 6, color: 0xe3d5b8 },
  { x: -49, z: 34, width: 10, depth: 8, height: 8, color: 0xb97568 },
  { x: -38, z: -29, width: 8, depth: 10, height: 9, color: 0xd3b085 },
  { x: -38, z: -14, width: 9, depth: 7, height: 5, color: 0xe5d6bd },
  { x: -39, z: 14, width: 9, depth: 8, height: 11, color: 0xbc7f69 },
  { x: -38, z: 37, width: 8, depth: 7, height: 6, color: 0xd8c7a7 },
  { x: -18, z: -34, width: 12, depth: 8, height: 7, color: 0xd8a978 },
  { x: -16, z: -15, width: 10, depth: 8, height: 12, color: 0xb86f5d },
  { x: -16, z: 14, width: 11, depth: 8, height: 8, color: 0xe0c393 },
  { x: -17, z: 38, width: 11, depth: 8, height: 10, color: 0xc48b70 },
  { x: -2, z: -34, width: 9, depth: 10, height: 6, color: 0xe4d4b5 },
  { x: -1, z: -15, width: 9, depth: 8, height: 9, color: 0xc98268 },
  { x: -1, z: 14, width: 9, depth: 8, height: 7, color: 0xdcb88c },
  { x: -1, z: 38, width: 10, depth: 8, height: 13, color: 0xa96458 },
  { x: 26, z: -35, width: 11, depth: 9, height: 8, color: 0xd2a477 },
  { x: 27, z: -16, width: 12, depth: 8, height: 14, color: 0xb87362 },
  { x: 27, z: 14, width: 11, depth: 8, height: 9, color: 0xe1c9a4 },
  { x: 27, z: 38, width: 12, depth: 8, height: 12, color: 0xc18b6e },
  { x: 56, z: -34, width: 14, depth: 10, height: 7, color: 0xe7d6b6, label: 'EVACUATION CENTER' },
  { x: 56, z: -16, width: 11, depth: 8, height: 10, color: 0xbf8269 },
  { x: 56, z: 13, width: 12, depth: 9, height: 12, color: 0xd4a77c },
  { x: 56, z: 36, width: 13, depth: 8, height: 8, color: 0xe5cfaa },
];

const vehicleSeed: Array<Omit<VehicleDefinition, 'id'>> = [
  { x: -56, z: mainRoadZ(-56), heading: 0, mass: 1.05, color: 0xf3c74f },
  { x: -41, z: mainRoadZ(-41), heading: 0, mass: 1.25, color: 0xe65d4f },
  { x: -28, z: -22, heading: Math.PI / 2, mass: 1.4, color: 0xe8e1d5 },
  { x: -25, z: mainRoadZ(-25), heading: 0, mass: 1.1, color: 0x4ea6cc },
  { x: -7, z: mainRoadZ(-7), heading: 0, mass: 1.55, color: 0x384d67 },
  { x: 12, z: -24, heading: Math.PI / 2, mass: 1.2, color: 0xe59648 },
  { x: 19, z: mainRoadZ(19), heading: 0, mass: 1.3, color: 0x71a46b },
  { x: 40, z: mainRoadZ(40), heading: 0, mass: 1.65, color: 0xcfc7bd },
];

export function createTerrainData(): TerrainData {
  const count = GRID_COLUMNS * GRID_ROWS;
  const elevations = new Float32Array(count);
  const roadMask = new Uint8Array(count);
  const blocked = new Uint8Array(count);
  const buildings = buildingSeed.map((building, id) => ({ ...building, id }));
  const vehicles = vehicleSeed.map((vehicle, id) => ({ ...vehicle, id }));

  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let column = 0; column < GRID_COLUMNS; column += 1) {
      const index = row * GRID_COLUMNS + column;
      const x = ORIGIN_X + column * CELL_SIZE;
      const z = ORIGIN_Z + row * CELL_SIZE;
      elevations[index] = terrainElevation(x, z);
      roadMask[index] = isRoad(x, z) ? 1 : 0;

      for (const building of buildings) {
        const insideX = Math.abs(x - building.x) <= building.width * 0.5 + 0.25;
        const insideZ = Math.abs(z - building.z) <= building.depth * 0.5 + 0.25;
        if (insideX && insideZ) {
          blocked[index] = 1;
          break;
        }
      }
    }
  }

  return {
    columns: GRID_COLUMNS,
    rows: GRID_ROWS,
    cellSize: CELL_SIZE,
    originX: ORIGIN_X,
    originZ: ORIGIN_Z,
    elevations,
    roadMask,
    blocked,
    buildings,
    vehicles,
  };
}

export function nearestCellIndex(terrain: TerrainData, x: number, z: number): number {
  const column = Math.max(
    0,
    Math.min(terrain.columns - 1, Math.round((x - terrain.originX) / terrain.cellSize)),
  );
  const row = Math.max(
    0,
    Math.min(terrain.rows - 1, Math.round((z - terrain.originZ) / terrain.cellSize)),
  );
  return row * terrain.columns + column;
}

export function sampleElevation(terrain: TerrainData, x: number, z: number): number {
  return terrain.elevations[nearestCellIndex(terrain, x, z)];
}
