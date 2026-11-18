import type { SimulationPhase, SimulationStats, TerrainData } from './types';
import { nearestCellIndex } from './terrain';

const FLOOD_THRESHOLD = 0.08;
const OCEAN_LEVEL = 0.05;

export class WaterSimulation {
  readonly waterDepth: Float32Array;
  readonly flowX: Float32Array;
  readonly flowZ: Float32Array;

  private readonly nextWater: Float32Array;
  private readonly nextFlowX: Float32Array;
  private readonly nextFlowZ: Float32Array;
  private readonly terrain: TerrainData;
  private landCellCount = 0;
  private waveHeight = 8;
  private elapsed = 0;
  private running = false;
  private phase: SimulationPhase = 'Ready';

  constructor(terrain: TerrainData) {
    this.terrain = terrain;
    const count = terrain.columns * terrain.rows;
    this.waterDepth = new Float32Array(count);
    this.nextWater = new Float32Array(count);
    this.flowX = new Float32Array(count);
    this.flowZ = new Float32Array(count);
    this.nextFlowX = new Float32Array(count);
    this.nextFlowZ = new Float32Array(count);

    for (let index = 0; index < count; index += 1) {
      if (!terrain.blocked[index]) this.landCellCount += 1;
    }
  }

  start(height: number): void {
    this.reset();
    this.waveHeight = this.clampHeight(height);
    this.running = true;
    this.phase = 'Wave building';
  }

  reset(): void {
    this.waterDepth.fill(0);
    this.nextWater.fill(0);
    this.flowX.fill(0);
    this.flowZ.fill(0);
    this.nextFlowX.fill(0);
    this.nextFlowZ.fill(0);
    this.elapsed = 0;
    this.running = false;
    this.phase = 'Ready';
  }

  setWaveHeight(height: number): void {
    this.waveHeight = this.clampHeight(height);
  }

  isRunning(): boolean {
    return this.running;
  }

  getElapsed(): number {
    return this.elapsed;
  }

  step(deltaSeconds: number): void {
    if (!this.running) return;

    const dt = Math.max(0, Math.min(deltaSeconds, 0.1));
    if (dt === 0) return;
    this.elapsed += dt;
    this.updatePhase();

    const { columns, rows, elevations, blocked, cellSize } = this.terrain;
    const surge = this.surgeEnvelope(this.elapsed);
    this.nextWater.set(this.waterDepth);
    this.nextFlowX.fill(0);
    this.nextFlowZ.fill(0);

    // The western edge is an open ocean reservoir. Its level rises with the
    // configured tsunami and later falls, allowing water to drain seaward.
    for (let row = 0; row < rows; row += 1) {
      const index = row * columns;
      const alongshoreVariation = 0.96 + 0.04 * Math.sin(row * 0.38 + this.elapsed * 1.7);
      const targetSurface = OCEAN_LEVEL + this.waveHeight * surge * alongshoreVariation;
      this.waterDepth[index] = Math.max(0, targetSurface - elevations[index]);
    }

    const neighborOffsets = [
      { dc: 1, dr: 0 },
      { dc: -1, dr: 0 },
      { dc: 0, dr: 1 },
      { dc: 0, dr: -1 },
    ];

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const index = row * columns + column;
        const depth = this.waterDepth[index];
        if (blocked[index] || depth < 0.001) continue;

        const head = elevations[index] + depth;
        const candidates: Array<{ index: number; dc: number; dr: number; drop: number }> = [];
        let totalDrop = 0;

        for (const neighbor of neighborOffsets) {
          const nc = column + neighbor.dc;
          const nr = row + neighbor.dr;
          if (nc < 0 || nc >= columns || nr < 0 || nr >= rows) continue;
          const neighborIndex = nr * columns + nc;
          if (blocked[neighborIndex]) continue;

          const neighborHead = elevations[neighborIndex] + this.waterDepth[neighborIndex];
          const drop = head - neighborHead;
          if (drop <= 0.001) continue;
          candidates.push({ index: neighborIndex, dc: neighbor.dc, dr: neighbor.dr, drop });
          totalDrop += drop;
        }

        if (totalDrop <= 0) continue;
        const pressureOutflow = totalDrop * 0.78 * dt;
        const stabilityLimit = depth * Math.min(0.62, dt * 7.5);
        const totalOutflow = Math.min(depth, pressureOutflow, stabilityLimit);

        for (const candidate of candidates) {
          const amount = totalOutflow * (candidate.drop / totalDrop);
          this.nextWater[index] -= amount;
          this.nextWater[candidate.index] += amount;
          this.nextFlowX[index] += candidate.dc * amount;
          this.nextFlowZ[index] += candidate.dr * amount;
          this.nextFlowX[candidate.index] += candidate.dc * amount;
          this.nextFlowZ[candidate.index] += candidate.dr * amount;
        }
      }
    }

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const index = row * columns + column;
        if (blocked[index]) {
          this.nextWater[index] = 0;
          continue;
        }

        const depth = Math.max(0, Number.isFinite(this.nextWater[index]) ? this.nextWater[index] : 0);
        const movingVolume = Math.hypot(this.nextFlowX[index], this.nextFlowZ[index]);
        const estimatedSpeed = Math.min(11, (movingVolume * cellSize) / (Math.max(depth, 0.08) * dt));
        const invMagnitude = movingVolume > 1e-6 ? 1 / movingVolume : 0;
        const targetVx = this.nextFlowX[index] * invMagnitude * estimatedSpeed;
        const targetVz = this.nextFlowZ[index] * invMagnitude * estimatedSpeed;
        this.flowX[index] = this.flowX[index] * 0.36 + targetVx * 0.64;
        this.flowZ[index] = this.flowZ[index] * 0.36 + targetVz * 0.64;

        const infiltration = this.elapsed > 38 ? 0.0018 * dt : 0.00035 * dt;
        this.waterDepth[index] = Math.max(0, depth - infiltration);
      }

      const edgeIndex = row * columns;
      const alongshoreVariation = 0.96 + 0.04 * Math.sin(row * 0.38 + this.elapsed * 1.7);
      const edgeSurface = OCEAN_LEVEL + this.waveHeight * surge * alongshoreVariation;
      this.waterDepth[edgeIndex] = Math.max(0, edgeSurface - elevations[edgeIndex]);
    }

    if (this.elapsed >= 96) {
      this.running = false;
      this.phase = 'Settled';
      this.flowX.fill(0);
      this.flowZ.fill(0);
    }
  }

  getDepthAtWorld(x: number, z: number): number {
    return this.waterDepth[nearestCellIndex(this.terrain, x, z)] ?? 0;
  }

  getFlowAtWorld(x: number, z: number): { x: number; z: number } {
    const index = nearestCellIndex(this.terrain, x, z);
    return { x: this.flowX[index] ?? 0, z: this.flowZ[index] ?? 0 };
  }

  getStats(displacedVehicles: number): SimulationStats {
    let floodedCells = 0;
    let maxDepth = 0;

    for (let index = 0; index < this.waterDepth.length; index += 1) {
      if (this.terrain.blocked[index]) continue;
      const depth = this.waterDepth[index];
      if (depth > FLOOD_THRESHOLD) floodedCells += 1;
      if (depth > maxDepth) maxDepth = depth;
    }

    let floodedBuildings = 0;
    for (const building of this.terrain.buildings) {
      const xOffset = building.width * 0.5 + this.terrain.cellSize;
      const zOffset = building.depth * 0.5 + this.terrain.cellSize;
      const samples = [
        this.getDepthAtWorld(building.x - xOffset, building.z),
        this.getDepthAtWorld(building.x + xOffset, building.z),
        this.getDepthAtWorld(building.x, building.z - zOffset),
        this.getDepthAtWorld(building.x, building.z + zOffset),
      ];
      if (Math.max(...samples) > 0.12) floodedBuildings += 1;
    }

    return {
      phase: this.phase,
      running: this.running,
      floodedPercent: this.landCellCount > 0 ? (floodedCells / this.landCellCount) * 100 : 0,
      maxDepth,
      floodedBuildings,
      totalBuildings: this.terrain.buildings.length,
      displacedVehicles,
      totalVehicles: this.terrain.vehicles.length,
      elapsed: this.elapsed,
    };
  }

  private updatePhase(): void {
    if (this.elapsed < 5.5) this.phase = 'Wave building';
    else if (this.elapsed < 17) this.phase = 'Coastal impact';
    else if (this.elapsed < 43) this.phase = 'Inland flooding';
    else this.phase = 'Water receding';
  }

  private surgeEnvelope(time: number): number {
    if (time < 6) {
      const t = time / 6;
      return t * t * (3 - 2 * t);
    }
    if (time < 35) return 1;
    return Math.exp(-(time - 35) / 20);
  }

  private clampHeight(height: number): number {
    return Math.max(1, Math.min(20, Number.isFinite(height) ? height : 8));
  }
}
