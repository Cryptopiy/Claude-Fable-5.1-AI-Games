# Echoes Below

> **Как запустить готовую сборку / How to run the ready-made build:** см. / see [HOW_TO_PLAY.md](../../HOW_TO_PLAY.md) в корне репозитория / in the repository root. Если ниже упоминаются другие файлы запуска — их в этом репозитории нет / if other launch files are mentioned below, they are not part of this repository.

An original side-view pixel sandbox built with React, TypeScript, Vite, and Phaser 3. Explore a deterministic world, mine and rebuild it, progress through crafting tiers, raid buried cabins, and confront the Rift Warden.

## Setup

```bash
npm install
npm run dev
```

Production build command:

```bash
npm run build
```

## Controls

| Input | Action |
| --- | --- |
| `A` / `D` | Move |
| `Space` | Jump |
| `1`–`0` or mouse wheel | Select hotbar slot |
| Left mouse | Mine, melee attack, fire, or use selected item |
| Right mouse | Place a block or interact with NPC/chest/shrine |
| `E` | Inventory and crafting |
| `Esc` | Pause |

Click a backpack slot while the inventory is open to swap it with the currently selected hotbar slot.

## Progression route

1. Fell trees and mine copper, stone, and dirt with the starter tools.
2. Hand-craft a Field Bench, then build a Stone Furnace.
3. Smelt copper and iron. Craft and place an Iron Anvil.
4. Forge an Iron Pick. It can break Moonstone in the deep caverns.
5. Explore the four buried cabins. Their caches contain supplies, Heartseeds, and deep-tier loot.
6. Forge a Hollow Beacon with moonstone and a Heartseed.
7. Take it to the violet shrine in the deep arena, select it, and left-click to summon the Rift Warden.
8. Use the dropped Rift Core to forge the final pick or sword.

## Implemented systems

- Deterministic 240×104 tile world with hills, valleys, cellular caverns, winding tunnels, large rooms, ore veins, cabins, and a boss arena.
- Pinewild, Amber Dunes, Glassfrost, and Verdant Scar biomes with distinct ground, color, vegetation, and enemy pools.
- Surface, Underground, and Deep Cavern zones with increasing darkness and resource quality.
- Arcade movement, gravity, jumping, tile collision, smooth camera, respawn, defense, permanent health upgrades, knockback, hit flashes, damage numbers, and camera shake.
- Reach-limited mining with hardness, tool power gates, hold progress, block particles, physical drops, and atomic inventory pickup.
- Reach-limited placement with previews, inventory consumption, neighbor support, player-overlap protection, collision updates, and re-mining.
- Forty inventory slots, ten-slot hotbar, stack limits, tooltips, backpack/hotbar swapping, and shared state across every gameplay system.
- Hand, bench, furnace, and anvil crafting. Recipes consume real ingredients and are locked to nearby stations.
- Three normal tool/armor tiers plus Rift equipment; melee and ranged weapons, arrows, healing, and permanent Heartseed upgrades.
- Continuous eight-minute day/night cycle, dynamic sky/ambient darkness, local torch glow, depth/biome/time HUD, and increased night spawning.
- Six regional enemies: Mossling, Shambler, Gloomwing, Ember Spitter, Thornling, and Crystal Crawler.
- Friendly Wayfinder Mara with contextual hints; shelter materials include solid blocks, wood, platforms, torches, and all stations.
- Four loot caches with depth-scaled rewards and overflow-safe physical drops.
- Original two-phase Rift Warden boss with charges, radial volleys, falling projectile rain, a dedicated health bar, and a unique crafting reward.
- Local browser save of seed, world edits, inventory, selected slot, health upgrades, armor defense, boss state, played time, and day/night time.
- Long-session safeguards cap enemies, projectiles, and physical drops; nearby drops merge and stale entities are reclaimed periodically.

## Important simplifications

- Platforms use full tile collision rather than one-way collision.
- The friendly NPC provides guidance instead of a currency/shop system.
- Lighting is a lightweight ambient overlay plus additive torch halos, not per-pixel shadow casting.
- Art is generated at startup from original geometric pixel shapes; no external asset or network request is required.
- The save regenerates the deterministic base world and reapplies only changed tiles.

## Source layout

```text
src/
├── game/
│   ├── data/items.ts             Item catalog, recipes, tile drops/hardness
│   ├── entities/EnemySystem.ts   Enemies, projectiles, combat, boss AI
│   ├── scenes/BootScene.ts       Original runtime-generated pixel artwork
│   ├── scenes/GameScene.ts       World play, mining, placement, lighting, input
│   ├── world/WorldGenerator.ts   Seeded terrain, biomes, caves, ruins, ores
│   ├── constants.ts
│   ├── config.ts
│   ├── events.ts
│   ├── GameStore.ts
│   ├── Inventory.ts
│   └── types.ts
├── ui/App.tsx                    React HUD, inventory, crafting, pause UI
├── main.tsx
├── styles.css
└── vite-env.d.ts
```
