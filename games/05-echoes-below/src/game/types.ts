import type { Station, TileKind } from './constants';

export type ItemCategory = 'block' | 'tool' | 'melee' | 'ranged' | 'ammo' | 'material' | 'consumable' | 'station' | 'armor' | 'accessory' | 'summon';

export interface ItemDef {
  id: string;
  name: string;
  category: ItemCategory;
  color: number;
  maxStack: number;
  description: string;
  tile?: TileKind;
  power?: number;
  damage?: number;
  defense?: number;
  heal?: number;
  ammo?: string;
}

export interface Stack { id: string; qty: number }

export interface Ingredient { id: string; qty: number }

export interface Recipe {
  id: string;
  output: Stack;
  ingredients: Ingredient[];
  station: Station;
}

export interface PlayerStats {
  health: number;
  maxHealth: number;
  defense: number;
  lifeCrystals: number;
  bossDefeated: boolean;
}

export interface SaveData {
  version: 1;
  seed: number;
  slots: Array<Stack | null>;
  selected: number;
  modifications: Record<string, number>;
  stats: PlayerStats;
  playedMs: number;
  timeOfDay: number;
}

export interface UISnapshot {
  slots: Array<Stack | null>;
  selected: number;
  health: number;
  maxHealth: number;
  defense: number;
  timeLabel: string;
  isNight: boolean;
  biome: string;
  depth: string;
  stations: Station[];
  inventoryOpen: boolean;
  paused: boolean;
  boss?: { name: string; health: number; maxHealth: number };
  hint?: string;
}
