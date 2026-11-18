import { TILE, TileKind, WORLD_H, WORLD_W, type Biome } from '../constants';

class Random {
  constructor(private state: number) {}
  next() {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }
  int(min: number, max: number) { return Math.floor(this.next() * (max - min + 1)) + min; }
}

export interface ChestSite { x: number; y: number; tier: number }
export interface GeneratedWorld {
  data: number[][];
  surface: number[];
  spawn: { x: number; y: number };
  chests: ChestSite[];
  shrine: { x: number; y: number };
}

export class WorldGenerator {
  static biomeAt(x: number): Biome {
    if (x < 54) return 'desert';
    if (x < 124) return 'forest';
    if (x < 182) return 'overgrowth';
    return 'snow';
  }

  static depthAt(tileY: number) {
    if (tileY < 42) return 'Surface';
    if (tileY < 72) return 'Underground';
    return 'Deep Caverns';
  }

  static generate(seed: number, modifications: Record<string, number>): GeneratedWorld {
    const rng = new Random(seed);
    const data = Array.from({ length: WORLD_H }, () => Array(WORLD_W).fill(-1));
    const surface: number[] = [];
    let height = 28;

    for (let x = 0; x < WORLD_W; x++) {
      height += (rng.next() - 0.5) * 2.1;
      height += Math.sin(x * 0.075) * 0.22;
      height = Math.max(22, Math.min(35, height));
      const yTop = Math.round(height);
      surface[x] = yTop;
      const biome = this.biomeAt(x);
      const top = biome === 'desert' ? TileKind.Sand : biome === 'snow' ? TileKind.Snow : biome === 'overgrowth' ? TileKind.Jungle : TileKind.Grass;
      for (let y = yTop; y < WORLD_H; y++) {
        if (y === yTop) data[y][x] = top;
        else if (y < yTop + (biome === 'desert' ? 9 : 6)) data[y][x] = biome === 'snow' ? TileKind.Ice : biome === 'desert' ? TileKind.Sand : biome === 'overgrowth' ? TileKind.Jungle : TileKind.Dirt;
        else data[y][x] = TileKind.Stone;
      }
    }

    // Cellular caverns, with broad rooms and thinner connecting worms.
    for (let y = 38; y < WORLD_H - 3; y++) {
      for (let x = 3; x < WORLD_W - 3; x++) {
        const waves = Math.sin(x * 0.19 + seed) + Math.sin(y * 0.27) + Math.sin((x + y) * 0.11);
        const chance = y > 72 ? 0.29 : 0.21;
        if (rng.next() < chance && waves > -0.65) data[y][x] = -1;
      }
    }
    for (let walker = 0; walker < 22; walker++) {
      let x = rng.int(8, WORLD_W - 9);
      let y = rng.int(42, WORLD_H - 9);
      const length = rng.int(45, 110);
      for (let step = 0; step < length; step++) {
        const radius = rng.int(1, y > 70 ? 3 : 2);
        this.carve(data, x, y, radius, radius);
        x = Math.max(4, Math.min(WORLD_W - 5, x + rng.int(-2, 2)));
        y = Math.max(39, Math.min(WORLD_H - 5, y + rng.int(-1, 1)));
      }
    }

    this.scatterVeins(data, rng, TileKind.Copper, 55, 32, 68, 5);
    this.scatterVeins(data, rng, TileKind.Iron, 43, 48, 90, 6);
    this.scatterVeins(data, rng, TileKind.Moonstone, 28, 73, 99, 5);

    // Vegetation gives each region its own surface silhouette.
    for (let x = 6; x < WORLD_W - 5; x += rng.int(4, 8)) {
      const biome = this.biomeAt(x);
      if (biome === 'desert') continue;
      const ground = surface[x];
      const trunkHeight = biome === 'snow' ? rng.int(4, 6) : rng.int(5, 8);
      for (let y = ground - 1; y > ground - trunkHeight; y--) data[y][x] = TileKind.Wood;
      for (let ox = -2; ox <= 2; ox++) for (let oy = -2; oy <= 1; oy++) {
        if (Math.abs(ox) + Math.abs(oy) < 4 && rng.next() > 0.14) data[ground - trunkHeight + oy][x + ox] = TileKind.Leaves;
      }
    }

    const chests: ChestSite[] = [];
    const cabinSpecs = [
      { x: 27, y: 53, tier: 1 }, { x: 77, y: 66, tier: 1 },
      { x: 137, y: 78, tier: 2 }, { x: 213, y: 87, tier: 3 },
    ];
    cabinSpecs.forEach((site) => {
      this.buildCabin(data, site.x, site.y);
      data[site.y + 3][site.x] = TileKind.Chest;
      chests.push({ x: site.x, y: site.y + 3, tier: site.tier });
    });

    // A hand-shaped arena keeps the original boss reachable and readable.
    const shrine = { x: 170, y: 91 };
    this.carve(data, shrine.x, shrine.y - 4, 15, 7);
    for (let x = shrine.x - 15; x <= shrine.x + 15; x++) data[shrine.y + 4][x] = TileKind.RuinBrick;
    data[shrine.y + 3][shrine.x] = TileKind.Shrine;

    const spawnX = 94;
    const spawnY = surface[spawnX] - 2;
    for (let y = spawnY - 5; y <= spawnY + 1; y++) for (let x = spawnX - 3; x <= spawnX + 3; x++) {
      if (y < surface[x]) data[y][x] = -1;
    }

    Object.entries(modifications).forEach(([key, value]) => {
      const [x, y] = key.split(',').map(Number);
      if (Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(value) && value >= -1 && value < 20 && x >= 0 && x < WORLD_W && y >= 0 && y < WORLD_H) data[y][x] = value;
    });

    return { data, surface, spawn: { x: spawnX * TILE + TILE / 2, y: spawnY * TILE }, chests, shrine };
  }

  private static carve(data: number[][], cx: number, cy: number, rx: number, ry: number) {
    for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) {
      if (x > 1 && x < WORLD_W - 2 && y > 2 && y < WORLD_H - 2 && ((x - cx) ** 2 / rx ** 2 + (y - cy) ** 2 / ry ** 2) <= 1.25) data[y][x] = -1;
    }
  }

  private static scatterVeins(data: number[][], rng: Random, kind: TileKind, count: number, minY: number, maxY: number, size: number) {
    for (let vein = 0; vein < count; vein++) {
      let x = rng.int(3, WORLD_W - 4); let y = rng.int(minY, maxY);
      for (let n = 0; n < rng.int(3, size); n++) {
        if (data[y][x] === TileKind.Stone) data[y][x] = kind;
        x = Math.max(2, Math.min(WORLD_W - 3, x + rng.int(-1, 1)));
        y = Math.max(minY, Math.min(maxY, y + rng.int(-1, 1)));
      }
    }
  }

  private static buildCabin(data: number[][], cx: number, cy: number) {
    for (let y = cy - 3; y <= cy + 4; y++) for (let x = cx - 5; x <= cx + 5; x++) {
      const wall = y === cy - 3 || y === cy + 4 || x === cx - 5 || x === cx + 5;
      data[y][x] = wall ? TileKind.RuinBrick : -1;
    }
    data[cy + 3][cx - 4] = TileKind.Torch;
    data[cy + 3][cx + 4] = TileKind.Torch;
  }
}
