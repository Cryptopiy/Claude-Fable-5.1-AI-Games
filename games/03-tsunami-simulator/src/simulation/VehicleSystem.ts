import type { TerrainData, VehicleState } from './types';
import { sampleElevation } from './terrain';
import { WaterSimulation } from './WaterSimulation';

export function createVehicleStates(terrain: TerrainData): VehicleState[] {
  return terrain.vehicles.map((vehicle) => ({
    ...vehicle,
    initialX: vehicle.x,
    initialZ: vehicle.z,
    vx: 0,
    vz: 0,
    yaw: vehicle.heading,
    roll: 0,
    pitch: 0,
    lastDepth: 0,
    displaced: false,
  }));
}

export function resetVehicleStates(states: VehicleState[]): void {
  for (const state of states) {
    state.x = state.initialX;
    state.z = state.initialZ;
    state.vx = 0;
    state.vz = 0;
    state.yaw = state.heading;
    state.roll = 0;
    state.pitch = 0;
    state.lastDepth = 0;
    state.displaced = false;
  }
}

export function stepVehicles(
  states: VehicleState[],
  terrain: TerrainData,
  water: WaterSimulation,
  deltaSeconds: number,
  elapsed: number,
): void {
  const dt = Math.max(0, Math.min(deltaSeconds, 0.1));
  const minX = terrain.originX + 1;
  const maxX = terrain.originX + (terrain.columns - 1) * terrain.cellSize - 1;
  const minZ = terrain.originZ + 1;
  const maxZ = terrain.originZ + (terrain.rows - 1) * terrain.cellSize - 1;

  for (const state of states) {
    const depth = water.getDepthAtWorld(state.x, state.z);
    const flow = water.getFlowAtWorld(state.x, state.z);
    const floating = smoothstep(0.25, 1.1, depth);
    const boreRise = dt > 0 ? Math.max(0, depth - state.lastDepth) / dt : 0;
    state.lastDepth = depth;

    if (floating > 0) {
      const targetVx = flow.x * (0.42 + depth * 0.09) + boreRise * 0.16;
      const targetVz = flow.z * (0.42 + depth * 0.09);
      const response = (1.25 + depth * 0.38) * floating / state.mass;
      state.vx += (targetVx - state.vx) * Math.min(1, response * dt);
      state.vz += (targetVz - state.vz) * Math.min(1, response * dt);
    } else {
      const dryFriction = Math.exp(-7 * dt);
      state.vx *= dryFriction;
      state.vz *= dryFriction;
    }

    const speed = Math.hypot(state.vx, state.vz);
    if (speed > 8) {
      state.vx = (state.vx / speed) * 8;
      state.vz = (state.vz / speed) * 8;
    }

    let nextX = Math.max(minX, Math.min(maxX, state.x + state.vx * dt));
    let nextZ = Math.max(minZ, Math.min(maxZ, state.z + state.vz * dt));
    if (collidesWithBuilding(nextX, nextZ, terrain)) {
      nextX = state.x;
      nextZ = state.z;
      state.vx *= -0.12;
      state.vz *= -0.12;
    }

    state.x = nextX;
    state.z = nextZ;
    if (speed > 0.08) {
      const flowHeading = Math.atan2(state.vz, state.vx);
      state.yaw += shortestAngle(state.yaw, flowHeading) * Math.min(1, dt * 1.8);
    }

    const bob = floating * Math.sin(elapsed * 3.2 + state.id * 1.7);
    state.roll = floating * Math.sin(elapsed * 2.3 + state.id) * 0.13;
    state.pitch = floating * Math.cos(elapsed * 1.9 + state.id * 0.8) * 0.1 + bob * 0.025;
    state.displaced = state.displaced || Math.hypot(state.x - state.initialX, state.z - state.initialZ) > 2.5;

    // Reading the terrain here also guards all vehicle coordinates against
    // invalid positions before they are consumed by the renderer.
    if (!Number.isFinite(sampleElevation(terrain, state.x, state.z))) {
      state.x = state.initialX;
      state.z = state.initialZ;
      state.vx = 0;
      state.vz = 0;
    }
  }
}

function collidesWithBuilding(x: number, z: number, terrain: TerrainData): boolean {
  const vehicleRadius = 1.25;
  return terrain.buildings.some(
    (building) =>
      Math.abs(x - building.x) < building.width * 0.5 + vehicleRadius &&
      Math.abs(z - building.z) < building.depth * 0.5 + vehicleRadius,
  );
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function shortestAngle(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}
