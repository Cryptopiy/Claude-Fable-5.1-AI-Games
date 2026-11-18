export type SimulationPhase =
  | 'Ready'
  | 'Wave building'
  | 'Coastal impact'
  | 'Inland flooding'
  | 'Water receding'
  | 'Settled';

export interface SimulationStats {
  phase: SimulationPhase;
  running: boolean;
  floodedPercent: number;
  maxDepth: number;
  floodedBuildings: number;
  totalBuildings: number;
  displacedVehicles: number;
  totalVehicles: number;
  elapsed: number;
}

export interface BuildingDefinition {
  id: number;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  color: number;
  label?: string;
}

export interface VehicleDefinition {
  id: number;
  x: number;
  z: number;
  heading: number;
  mass: number;
  color: number;
}

export interface TerrainData {
  columns: number;
  rows: number;
  cellSize: number;
  originX: number;
  originZ: number;
  elevations: Float32Array;
  roadMask: Uint8Array;
  blocked: Uint8Array;
  buildings: BuildingDefinition[];
  vehicles: VehicleDefinition[];
}

export interface VehicleState extends VehicleDefinition {
  initialX: number;
  initialZ: number;
  vx: number;
  vz: number;
  yaw: number;
  roll: number;
  pitch: number;
  lastDepth: number;
  displaced: boolean;
}
