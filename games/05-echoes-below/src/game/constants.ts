export const TILE = 16;
export const WORLD_W = 240;
export const WORLD_H = 104;
export const HOTBAR_SIZE = 10;
export const INVENTORY_SIZE = 40;
export const SAVE_KEY = 'echoes-below-save-v1';

export enum TileKind {
  Dirt,
  Grass,
  Stone,
  Sand,
  Snow,
  Ice,
  Wood,
  Leaves,
  Copper,
  Iron,
  Moonstone,
  RuinBrick,
  Platform,
  Workbench,
  Furnace,
  Anvil,
  Torch,
  Chest,
  Shrine,
  Jungle,
}

export type Biome = 'forest' | 'desert' | 'snow' | 'overgrowth';
export type Station = 'hand' | 'workbench' | 'furnace' | 'anvil';

export const BIOME_NAMES: Record<Biome, string> = {
  forest: 'Pinewild',
  desert: 'Amber Dunes',
  snow: 'Glassfrost',
  overgrowth: 'Verdant Scar',
};

export const TILE_SOLID = new Set<TileKind>([
  TileKind.Dirt, TileKind.Grass, TileKind.Stone, TileKind.Sand,
  TileKind.Snow, TileKind.Ice, TileKind.Wood, TileKind.Copper,
  TileKind.Iron, TileKind.Moonstone, TileKind.RuinBrick,
  TileKind.Platform, TileKind.Workbench, TileKind.Furnace,
  TileKind.Anvil, TileKind.Jungle,
]);
