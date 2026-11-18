import { BIOME_NAMES, SAVE_KEY, type Biome, type Station } from './constants';
import { EVENT, events } from './events';
import { Inventory } from './Inventory';
import type { PlayerStats, SaveData, UISnapshot } from './types';

const freshStats = (): PlayerStats => ({ health: 100, maxHealth: 100, defense: 0, lifeCrystals: 0, bossDefeated: false });

class GameStore {
  seed = Math.floor(Math.random() * 2_000_000_000);
  inventory = new Inventory();
  modifications: Record<string, number> = {};
  stats = freshStats();
  nearbyStations: Station[] = ['hand'];
  timeOfDay = 0.28;
  playedMs = 0;
  biome: Biome = 'forest';
  depth = 'Surface';
  inventoryOpen = false;
  paused = false;
  boss: UISnapshot['boss'];
  hint = 'A/D to move • Space to jump • Mine a nearby tree';

  constructor() {
    this.load();
    events.on(EVENT.CRAFT, (id: string) => {
      if (this.inventory.craft(id, this.nearbyStations)) this.toast('Crafted successfully');
      else this.toast('Missing ingredients, space, or station');
      this.emit();
    });
    events.on(EVENT.SELECT_SLOT, (index: number) => { this.inventory.select(index); this.emit(); });
    events.on(EVENT.MOVE_SLOT, (index: number) => {
      if (index < 0 || index >= this.inventory.slots.length || index === this.inventory.selected) return;
      const held = this.inventory.slots[this.inventory.selected];
      this.inventory.slots[this.inventory.selected] = this.inventory.slots[index];
      this.inventory.slots[index] = held;
      this.emit();
    });
  }

  emit() { events.emit(EVENT.UI, this.snapshot()); }
  toast(message: string) { this.hint = message; events.emit(EVENT.TOAST, message); this.emit(); }

  snapshot(): UISnapshot {
    const cycleHour = Math.floor((this.timeOfDay * 24 + 6) % 24);
    const minute = Math.floor((this.timeOfDay * 24 * 60) % 60).toString().padStart(2, '0');
    return {
      slots: this.inventory.slots.map((slot) => slot ? { ...slot } : null),
      selected: this.inventory.selected,
      health: Math.max(0, Math.round(this.stats.health)), maxHealth: this.stats.maxHealth,
      defense: this.stats.defense, timeLabel: `${cycleHour.toString().padStart(2, '0')}:${minute}`,
      isNight: this.isNight(), biome: BIOME_NAMES[this.biome], depth: this.depth,
      stations: [...this.nearbyStations], inventoryOpen: this.inventoryOpen,
      paused: this.paused, boss: this.boss ? { ...this.boss } : undefined, hint: this.hint,
    };
  }

  isNight() { return this.timeOfDay < 0.19 || this.timeOfDay > 0.73; }

  useLifeCrystal() {
    if (!this.inventory.remove('lifeCrystal', 1)) return false;
    if (this.stats.lifeCrystals >= 5) { this.inventory.add('lifeCrystal', 1); return false; }
    this.stats.lifeCrystals++; this.stats.maxHealth += 20; this.stats.health = this.stats.maxHealth;
    this.toast('Heartseed absorbed — maximum health increased');
    return true;
  }

  equipArmor(id: string, defense: number) {
    if (!this.inventory.remove(id, 1)) return false;
    this.stats.defense = Math.max(this.stats.defense, defense);
    this.toast(`Armor equipped — defense ${this.stats.defense}`);
    return true;
  }

  save() {
    const data: SaveData = {
      version: 1, seed: this.seed, slots: this.inventory.slots, selected: this.inventory.selected,
      modifications: this.modifications, stats: this.stats, playedMs: this.playedMs, timeOfDay: this.timeOfDay,
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* storage can be unavailable */ }
  }

  private load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as SaveData;
      if (data.version !== 1 || !Array.isArray(data.slots)) return;
      this.seed = data.seed; this.inventory = new Inventory(data.slots);
      this.inventory.select(data.selected ?? 0); this.modifications = data.modifications ?? {};
      const loadedStats = { ...freshStats(), ...data.stats };
      loadedStats.maxHealth = Number.isFinite(loadedStats.maxHealth) ? Math.max(100, loadedStats.maxHealth) : 100;
      loadedStats.health = Number.isFinite(loadedStats.health) ? Math.max(1, Math.min(loadedStats.maxHealth, loadedStats.health)) : loadedStats.maxHealth;
      loadedStats.defense = Number.isFinite(loadedStats.defense) ? Math.max(0, loadedStats.defense) : 0;
      this.stats = loadedStats;
      this.playedMs = data.playedMs ?? 0; this.timeOfDay = data.timeOfDay ?? 0.28;
      this.hint = 'World restored from your last expedition';
    } catch { /* start clean if save data is malformed */ }
  }
}

export const gameStore = new GameStore();
