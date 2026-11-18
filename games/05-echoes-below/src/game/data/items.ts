import { TileKind, type Station } from '../constants';
import type { ItemDef, Recipe } from '../types';

export const ITEMS: Record<string, ItemDef> = {
  dirt: { id: 'dirt', name: 'Loam Block', category: 'block', color: 0x8b5a36, maxStack: 999, description: 'Plain, dependable building earth.', tile: TileKind.Dirt },
  stone: { id: 'stone', name: 'Stone Block', category: 'block', color: 0x6f7886, maxStack: 999, description: 'Dense masonry material.', tile: TileKind.Stone },
  sand: { id: 'sand', name: 'Sun Sand', category: 'block', color: 0xd9ad63, maxStack: 999, description: 'Warm desert sand.', tile: TileKind.Sand },
  snow: { id: 'snow', name: 'Packed Snow', category: 'block', color: 0xdbeeff, maxStack: 999, description: 'Cold and surprisingly sturdy.', tile: TileKind.Snow },
  jungle: { id: 'jungle', name: 'Scar Turf', category: 'block', color: 0x32643f, maxStack: 999, description: 'Root-bound soil from the Verdant Scar.', tile: TileKind.Jungle },
  wood: { id: 'wood', name: 'Wildwood', category: 'block', color: 0x9a6138, maxStack: 999, description: 'Useful for shelter and early crafting.', tile: TileKind.Wood },
  platform: { id: 'platform', name: 'Wood Platform', category: 'block', color: 0xc38a4e, maxStack: 999, description: 'A thin traversable building piece.', tile: TileKind.Platform },
  torch: { id: 'torch', name: 'Ember Torch', category: 'block', color: 0xffb341, maxStack: 999, description: 'Pushes back cavern darkness.', tile: TileKind.Torch },
  workbench: { id: 'workbench', name: 'Field Bench', category: 'station', color: 0x9f693e, maxStack: 99, description: 'Unlocks practical crafting.', tile: TileKind.Workbench },
  furnace: { id: 'furnace', name: 'Stone Furnace', category: 'station', color: 0xd86b3b, maxStack: 99, description: 'Smelts ore into bars.', tile: TileKind.Furnace },
  anvil: { id: 'anvil', name: 'Iron Anvil', category: 'station', color: 0xaeb7c8, maxStack: 99, description: 'Shapes advanced equipment.', tile: TileKind.Anvil },
  copperOre: { id: 'copperOre', name: 'Copper Ore', category: 'material', color: 0xc9784a, maxStack: 999, description: 'A soft surface metal.' },
  ironOre: { id: 'ironOre', name: 'Iron Ore', category: 'material', color: 0xc7ccd6, maxStack: 999, description: 'Strong metal from below.' },
  moonOre: { id: 'moonOre', name: 'Moonstone Ore', category: 'material', color: 0x77e4ef, maxStack: 999, description: 'Deep crystal. Requires an iron pick.' },
  copperBar: { id: 'copperBar', name: 'Copper Bar', category: 'material', color: 0xe9945e, maxStack: 999, description: 'Refined crafting metal.' },
  ironBar: { id: 'ironBar', name: 'Iron Bar', category: 'material', color: 0xd8deea, maxStack: 999, description: 'Refined durable metal.' },
  moonBar: { id: 'moonBar', name: 'Moonstone Bar', category: 'material', color: 0xa0f6ff, maxStack: 999, description: 'A humming blue alloy.' },
  copperPick: { id: 'copperPick', name: 'Copper Pick', category: 'tool', color: 0xdb8753, maxStack: 1, description: 'Mining power I.', power: 1, damage: 5 },
  ironPick: { id: 'ironPick', name: 'Iron Pick', category: 'tool', color: 0xc9d0dd, maxStack: 1, description: 'Mining power II. Breaks moonstone.', power: 2, damage: 8 },
  moonPick: { id: 'moonPick', name: 'Moon Pick', category: 'tool', color: 0x62eff6, maxStack: 1, description: 'Mining power III. Extremely fast.', power: 3, damage: 13 },
  voidPick: { id: 'voidPick', name: 'Rift Pick', category: 'tool', color: 0xe168ff, maxStack: 1, description: 'Boss-forged mining power IV.', power: 4, damage: 20 },
  axe: { id: 'axe', name: 'Trail Axe', category: 'tool', color: 0xf0be6a, maxStack: 1, description: 'Fells trees quickly.', power: 2, damage: 8 },
  shortsword: { id: 'shortsword', name: 'Scout Blade', category: 'melee', color: 0xf0e5c5, maxStack: 1, description: 'A swift close-range weapon.', damage: 12 },
  ironBlade: { id: 'ironBlade', name: 'Iron Falchion', category: 'melee', color: 0xe8edf5, maxStack: 1, description: 'Broad reach and reliable damage.', damage: 25 },
  riftBlade: { id: 'riftBlade', name: 'Riftglass Saber', category: 'melee', color: 0xe168ff, maxStack: 1, description: 'Forged from the Warden\'s core.', damage: 48 },
  starBow: { id: 'starBow', name: 'Starling Bow', category: 'ranged', color: 0x86ccff, maxStack: 1, description: 'Fires arrows toward the cursor.', damage: 19, ammo: 'arrow' },
  arrow: { id: 'arrow', name: 'Arrow', category: 'ammo', color: 0xe7d4a8, maxStack: 999, description: 'Ammunition for bows.' },
  potion: { id: 'potion', name: 'Moss Tonic', category: 'consumable', color: 0xf75c74, maxStack: 30, description: 'Restores 45 health.', heal: 45 },
  ironArmor: { id: 'ironArmor', name: 'Ironweave Coat', category: 'armor', color: 0xaab5c7, maxStack: 1, description: 'Use to equip. +5 defense.', defense: 5 },
  moonArmor: { id: 'moonArmor', name: 'Moonplate', category: 'armor', color: 0x7cebf4, maxStack: 1, description: 'Use to equip. +10 defense.', defense: 10 },
  lifeCrystal: { id: 'lifeCrystal', name: 'Heartseed', category: 'accessory', color: 0xff6b91, maxStack: 10, description: 'Use for a permanent +20 maximum health.' },
  bossSigil: { id: 'bossSigil', name: 'Hollow Beacon', category: 'summon', color: 0xe168ff, maxStack: 10, description: 'Use at the deep shrine to call the Rift Warden.' },
  riftCore: { id: 'riftCore', name: 'Rift Core', category: 'material', color: 0xfb7cff, maxStack: 99, description: 'Proof that the deep Warden fell.' },
};

export const RECIPES: Recipe[] = [
  { id: 'platform', output: { id: 'platform', qty: 4 }, ingredients: [{ id: 'wood', qty: 1 }], station: 'hand' },
  { id: 'torch', output: { id: 'torch', qty: 4 }, ingredients: [{ id: 'wood', qty: 1 }, { id: 'copperOre', qty: 1 }], station: 'hand' },
  { id: 'workbench', output: { id: 'workbench', qty: 1 }, ingredients: [{ id: 'wood', qty: 10 }], station: 'hand' },
  { id: 'arrow', output: { id: 'arrow', qty: 20 }, ingredients: [{ id: 'wood', qty: 1 }, { id: 'stone', qty: 1 }], station: 'hand' },
  { id: 'furnace', output: { id: 'furnace', qty: 1 }, ingredients: [{ id: 'stone', qty: 20 }, { id: 'torch', qty: 3 }], station: 'workbench' },
  { id: 'anvil', output: { id: 'anvil', qty: 1 }, ingredients: [{ id: 'ironBar', qty: 5 }, { id: 'wood', qty: 8 }], station: 'workbench' },
  { id: 'axe', output: { id: 'axe', qty: 1 }, ingredients: [{ id: 'wood', qty: 8 }, { id: 'copperOre', qty: 5 }], station: 'workbench' },
  { id: 'copperPick', output: { id: 'copperPick', qty: 1 }, ingredients: [{ id: 'wood', qty: 5 }, { id: 'copperBar', qty: 8 }], station: 'workbench' },
  { id: 'starBow', output: { id: 'starBow', qty: 1 }, ingredients: [{ id: 'wood', qty: 12 }, { id: 'copperBar', qty: 5 }], station: 'workbench' },
  { id: 'copperBar', output: { id: 'copperBar', qty: 1 }, ingredients: [{ id: 'copperOre', qty: 3 }], station: 'furnace' },
  { id: 'ironBar', output: { id: 'ironBar', qty: 1 }, ingredients: [{ id: 'ironOre', qty: 3 }], station: 'furnace' },
  { id: 'moonBar', output: { id: 'moonBar', qty: 1 }, ingredients: [{ id: 'moonOre', qty: 4 }], station: 'furnace' },
  { id: 'ironPick', output: { id: 'ironPick', qty: 1 }, ingredients: [{ id: 'wood', qty: 5 }, { id: 'ironBar', qty: 10 }], station: 'anvil' },
  { id: 'ironBlade', output: { id: 'ironBlade', qty: 1 }, ingredients: [{ id: 'ironBar', qty: 8 }], station: 'anvil' },
  { id: 'ironArmor', output: { id: 'ironArmor', qty: 1 }, ingredients: [{ id: 'ironBar', qty: 14 }], station: 'anvil' },
  { id: 'moonPick', output: { id: 'moonPick', qty: 1 }, ingredients: [{ id: 'ironBar', qty: 4 }, { id: 'moonBar', qty: 12 }], station: 'anvil' },
  { id: 'moonArmor', output: { id: 'moonArmor', qty: 1 }, ingredients: [{ id: 'moonBar', qty: 16 }], station: 'anvil' },
  { id: 'bossSigil', output: { id: 'bossSigil', qty: 1 }, ingredients: [{ id: 'moonBar', qty: 8 }, { id: 'lifeCrystal', qty: 1 }], station: 'anvil' },
  { id: 'voidPick', output: { id: 'voidPick', qty: 1 }, ingredients: [{ id: 'riftCore', qty: 1 }, { id: 'moonBar', qty: 10 }], station: 'anvil' },
  { id: 'riftBlade', output: { id: 'riftBlade', qty: 1 }, ingredients: [{ id: 'riftCore', qty: 1 }, { id: 'moonBar', qty: 8 }], station: 'anvil' },
];

export const STATION_LABELS: Record<Station, string> = {
  hand: 'By hand', workbench: 'Field Bench', furnace: 'Stone Furnace', anvil: 'Iron Anvil',
};

export const TILE_DROPS: Partial<Record<TileKind, string>> = {
  [TileKind.Dirt]: 'dirt', [TileKind.Grass]: 'dirt', [TileKind.Stone]: 'stone',
  [TileKind.Sand]: 'sand', [TileKind.Snow]: 'snow', [TileKind.Ice]: 'snow',
  [TileKind.Wood]: 'wood', [TileKind.Copper]: 'copperOre', [TileKind.Iron]: 'ironOre',
  [TileKind.Moonstone]: 'moonOre', [TileKind.RuinBrick]: 'stone', [TileKind.Platform]: 'platform',
  [TileKind.Workbench]: 'workbench', [TileKind.Furnace]: 'furnace', [TileKind.Anvil]: 'anvil',
  [TileKind.Torch]: 'torch', [TileKind.Jungle]: 'jungle',
};

export const TILE_HARDNESS: Partial<Record<TileKind, number>> = {
  [TileKind.Dirt]: 260, [TileKind.Grass]: 280, [TileKind.Stone]: 700,
  [TileKind.Sand]: 240, [TileKind.Snow]: 260, [TileKind.Ice]: 450,
  [TileKind.Wood]: 480, [TileKind.Copper]: 650, [TileKind.Iron]: 950,
  [TileKind.Moonstone]: 1350, [TileKind.RuinBrick]: 850, [TileKind.Jungle]: 360,
  [TileKind.Platform]: 220, [TileKind.Workbench]: 450, [TileKind.Furnace]: 850,
  [TileKind.Anvil]: 900, [TileKind.Torch]: 80,
  [TileKind.Leaves]: 100,
};
