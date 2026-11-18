import Phaser from 'phaser';
import { TILE, TILE_SOLID, TileKind, WORLD_H, WORLD_W, type Station } from '../constants';
import { ITEMS, TILE_DROPS, TILE_HARDNESS } from '../data/items';
import { EnemySystem } from '../entities/EnemySystem';
import { EVENT, events } from '../events';
import { gameStore } from '../GameStore';
import { WorldGenerator, type GeneratedWorld } from '../world/WorldGenerator';

type ArcadeSprite = Phaser.Physics.Arcade.Sprite;

export class GameScene extends Phaser.Scene {
  private worldData!: GeneratedWorld;
  private map!: Phaser.Tilemaps.Tilemap;
  private terrain!: Phaser.Tilemaps.TilemapLayer;
  private player!: ArcadeSprite;
  private npc!: ArcadeSprite;
  private pickups!: Phaser.Physics.Arcade.Group;
  private enemies!: EnemySystem;
  private keys!: Record<'left' | 'right' | 'jump', Phaser.Input.Keyboard.Key>;
  private mining = { key: '', progress: 0 };
  private target!: Phaser.GameObjects.Graphics;
  private effects!: Phaser.GameObjects.Graphics;
  private darkness!: Phaser.GameObjects.Rectangle;
  private glow!: Phaser.GameObjects.Graphics;
  private nextAction = 0;
  private nextStationScan = 0;
  private nextAtmosphere = 0;
  private nextHudSync = 0;
  private nextEntityCleanup = 0;
  private invulnerableUntil = 0;
  private dead = false;
  private facing = 1;
  private onboarding = 0;
  private lastSavedAt = 0;
  private readonly onUnload = () => gameStore.save();
  private readonly toggleInventory = () => this.setOverlay('inventory');
  private readonly togglePause = () => this.setOverlay('pause');

  constructor() { super('game'); }

  create() {
    this.worldData = WorldGenerator.generate(gameStore.seed, gameStore.modifications);
    this.createBackground();
    this.map = this.make.tilemap({ data: this.worldData.data, tileWidth: TILE, tileHeight: TILE });
    const tiles = this.map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0);
    if (!tiles) throw new Error('Could not create generated tileset');
    const layer = this.map.createLayer(0, tiles, 0, 0);
    if (!layer) throw new Error('Could not create world layer');
    this.terrain = layer.setDepth(0);
    this.terrain.setCollision([...TILE_SOLID]);

    this.physics.world.setBounds(0, 0, WORLD_W * TILE, WORLD_H * TILE);
    this.player = this.physics.add.sprite(this.worldData.spawn.x, this.worldData.spawn.y, 'player');
    this.player.setDepth(5).setCollideWorldBounds(true).setMaxVelocity(150, 440);
    (this.player.body as Phaser.Physics.Arcade.Body).setSize(10, 21).setOffset(1, 1);
    this.physics.add.collider(this.player, this.terrain);

    this.cameras.main.setBounds(0, 0, WORLD_W * TILE, WORLD_H * TILE).startFollow(this.player, true, .09, .09).setZoom(2);
    this.cameras.main.roundPixels = true;

    this.pickups = this.physics.add.group();
    this.physics.add.collider(this.pickups, this.terrain);
    this.physics.add.overlap(this.player, this.pickups, (_player, object) => this.collectPickup(object as ArcadeSprite));

    this.enemies = new EnemySystem(this, this.player, this.terrain, {
      hurtPlayer: (damage, sourceX) => this.hurtPlayer(damage, sourceX),
      dropItem: (id, qty, x, y) => this.dropItem(id, qty, x, y),
      bossChanged: (health, maxHealth) => {
        gameStore.boss = health !== undefined && maxHealth !== undefined ? { name: 'Rift Warden', health, maxHealth } : undefined;
        gameStore.emit();
      },
      bossDefeated: () => {
        gameStore.stats.bossDefeated = true; gameStore.toast('THE RIFT WARDEN IS SILENCED — new rift recipes unlocked'); gameStore.save();
      },
    });

    const npcTileX = Math.floor(this.worldData.spawn.x / TILE) + 6;
    this.npc = this.physics.add.sprite(npcTileX * TILE, this.worldData.surface[npcTileX] * TILE - 12, 'npc').setDepth(5).setCollideWorldBounds(true);
    this.physics.add.collider(this.npc, this.terrain);
    this.add.text(this.npc.x, this.npc.y - 20, 'Mara • Wayfinder', { fontFamily: 'monospace', fontSize: '7px', color: '#ffe89b', stroke: '#1b1830', strokeThickness: 2 }).setOrigin(.5).setDepth(6);

    this.target = this.add.graphics().setDepth(12);
    this.effects = this.add.graphics().setDepth(8);
    this.darkness = this.add.rectangle(0, 0, 10, 10, 0x08101e, 0).setOrigin(0).setScrollFactor(0).setDepth(9);
    this.glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(10);

    this.keys = this.input.keyboard!.addKeys({ left: 'A', right: 'D', jump: 'SPACE' }) as typeof this.keys;
    this.input.keyboard!.on('keydown-E', this.toggleInventory);
    this.input.keyboard!.on('keydown-ESC', this.togglePause);
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      if (/^[0-9]$/.test(event.key)) {
        const index = event.key === '0' ? 9 : Number(event.key) - 1;
        gameStore.inventory.select(index); gameStore.emit();
      }
    });
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objects: Phaser.GameObjects.GameObject[], _dx: number, dy: number) => {
      gameStore.inventory.select(gameStore.inventory.selected + (dy > 0 ? 1 : -1)); gameStore.emit();
    });
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => { if (pointer.rightButtonDown()) this.handleRightClick(pointer); });
    this.input.mouse?.disableContextMenu();

    events.on(EVENT.TOGGLE_INVENTORY, this.toggleInventory);
    events.on(EVENT.TOGGLE_PAUSE, this.togglePause);
    window.addEventListener('beforeunload', this.onUnload);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.time.delayedCall(200, () => gameStore.emit());
  }

  update(time: number, delta: number) {
    if (gameStore.paused || gameStore.inventoryOpen || this.dead) { this.player.setVelocityX(0); return; }
    gameStore.playedMs += delta;
    gameStore.timeOfDay = (gameStore.timeOfDay + delta / 480_000) % 1;

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const move = (this.keys.left.isDown ? -1 : 0) + (this.keys.right.isDown ? 1 : 0);
    this.player.setVelocityX(move * 92);
    if (move) { this.facing = move; this.player.setFlipX(move < 0); }
    if (Phaser.Input.Keyboard.JustDown(this.keys.jump) && body.blocked.down) this.player.setVelocityY(-205);

    const pointer = this.input.activePointer;
    this.drawTarget(pointer);
    if (pointer.leftButtonDown()) this.handleLeftHeld(pointer, time, delta);
    else { this.mining.key = ''; this.mining.progress = 0; }

    const tx = Phaser.Math.Clamp(Math.floor(this.player.x / TILE), 0, WORLD_W - 1);
    const ty = Phaser.Math.Clamp(Math.floor(this.player.y / TILE), 0, WORLD_H - 1);
    gameStore.biome = WorldGenerator.biomeAt(tx);
    gameStore.depth = WorldGenerator.depthAt(ty);
    this.enemies.update(time, gameStore.biome, gameStore.depth, gameStore.isNight());

    if (time > this.nextStationScan) { this.scanStations(); this.nextStationScan = time + 450; }
    if (time > this.nextAtmosphere) { this.updateAtmosphere(); this.nextAtmosphere = time + 250; }
    if (time > this.nextHudSync) { gameStore.emit(); this.nextHudSync = time + 500; }
    if (time > this.nextEntityCleanup) { this.cleanupPickups(time); this.nextEntityCleanup = time + 2000; }
    if (time - this.lastSavedAt > 30_000) { gameStore.save(); this.lastSavedAt = time; }
  }

  private handleLeftHeld(pointer: Phaser.Input.Pointer, time: number, delta: number) {
    const stack = gameStore.inventory.selectedStack;
    const item = gameStore.inventory.selectedItem;
    if (!stack || !item) return;
    const { tx, ty, distance } = this.pointerTile(pointer);
    const tile = this.terrain.getTileAt(tx, ty);
    if (item.category === 'tool' && tile && tile.index >= 0 && distance <= TILE * 5.2) {
      this.mineTile(tile, item.power ?? 1, item.id === 'axe', delta);
      return;
    }
    if (time < this.nextAction) return;
    if (item.category === 'melee' || item.category === 'tool') {
      const hits = this.enemies.melee(this.player.x, this.player.y, this.facing, item.damage ?? 5, item.category === 'melee' ? 38 : 28);
      this.drawSwing(item.color); this.nextAction = time + (hits ? 330 : 240);
    } else if (item.category === 'ranged') {
      if (item.ammo && gameStore.inventory.remove(item.ammo, 1)) {
        this.enemies.shoot(this.player.x + this.facing * 7, this.player.y - 4, pointer.worldX, pointer.worldY, item.damage ?? 10);
        this.nextAction = time + 360; gameStore.emit();
      } else { gameStore.toast('You need arrows'); this.nextAction = time + 700; }
    } else if (item.category === 'consumable') {
      if (item.heal && gameStore.stats.health < gameStore.stats.maxHealth && gameStore.inventory.removeSelected()) {
        gameStore.stats.health = Math.min(gameStore.stats.maxHealth, gameStore.stats.health + item.heal); gameStore.toast(`Restored ${item.heal} health`);
      }
      this.nextAction = time + 700;
    } else if (item.category === 'accessory') {
      gameStore.useLifeCrystal(); this.nextAction = time + 700;
    } else if (item.category === 'armor') {
      gameStore.equipArmor(item.id, item.defense ?? 0); this.nextAction = time + 700;
    } else if (item.category === 'summon') {
      this.trySummonBoss(); this.nextAction = time + 900;
    }
  }

  private mineTile(tile: Phaser.Tilemaps.Tile, power: number, axe: boolean, delta: number) {
    const kind = tile.index as TileKind;
    if (kind === TileKind.Chest || kind === TileKind.Shrine) return;
    if (axe && kind !== TileKind.Wood && kind !== TileKind.Leaves) { gameStore.hint = 'Use a pickaxe on terrain and ore'; return; }
    const required = kind === TileKind.Moonstone ? 2 : kind === TileKind.Iron || kind === TileKind.Anvil ? 1 : 0;
    if (power < required) { gameStore.hint = 'Your pick is too weak for this material'; return; }
    const key = `${tile.x},${tile.y}`;
    if (this.mining.key !== key) { this.mining.key = key; this.mining.progress = 0; }
    const rate = power * (axe ? 2.6 : 1);
    this.mining.progress += delta * rate;
    const hardness = TILE_HARDNESS[kind] ?? 500;
    this.target.fillStyle(0xffffff, Phaser.Math.Clamp(this.mining.progress / hardness, .08, .55)).fillRect(tile.pixelX + 2, tile.pixelY + 2, 12, 12);
    if (this.mining.progress < hardness) return;
    this.terrain.removeTileAt(tile.x, tile.y);
    gameStore.modifications[key] = -1;
    const drop = TILE_DROPS[kind]; if (drop) this.dropItem(drop, 1, tile.pixelX + 8, tile.pixelY + 8);
    this.blockParticles(tile.pixelX + 8, tile.pixelY + 8, ITEMS[drop ?? 'stone']?.color ?? 0xffffff);
    this.mining.key = ''; this.mining.progress = 0;
  }

  private handleRightClick(pointer: Phaser.Input.Pointer) {
    if (gameStore.paused || gameStore.inventoryOpen || this.dead) return;
    const { tx, ty, distance } = this.pointerTile(pointer);
    if (distance > TILE * 5.2) { gameStore.toast('Out of reach'); return; }
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, this.npc.x, this.npc.y) < 58) {
      gameStore.toast(gameStore.stats.bossDefeated ? 'Mara: The deep song is quiet. Riftglass can now be forged.' : 'Mara: Gather wood, smelt iron, then seek moonstone and the violet shrine.');
      return;
    }
    const tile = this.terrain.getTileAt(tx, ty);
    if (tile?.index === TileKind.Chest) { this.openChest(tx, ty); return; }
    if (tile?.index === TileKind.Shrine) { gameStore.toast('The shrine waits for a Hollow Beacon. Select it and left-click nearby.'); return; }
    if (tile && tile.index >= 0) return;
    const stack = gameStore.inventory.selectedStack; const item = gameStore.inventory.selectedItem;
    if (!stack || item?.tile === undefined) return;
    const placedKind = item.tile;
    if (this.player.getBounds().contains(tx * TILE + 8, ty * TILE + 8)) { gameStore.toast('Cannot place a block inside yourself'); return; }
    if (!this.hasSolidNeighbor(tx, ty) && placedKind !== TileKind.Torch) { gameStore.toast('Place blocks next to existing terrain'); return; }
    if (placedKind === TileKind.Torch && !this.hasSolidNeighbor(tx, ty)) { gameStore.toast('Torches need a nearby surface'); return; }
    const placed = this.terrain.putTileAt(placedKind, tx, ty);
    if (!placed) return;
    placed.setCollision(TILE_SOLID.has(placedKind));
    gameStore.modifications[`${tx},${ty}`] = placedKind;
    gameStore.inventory.removeSelected(); gameStore.emit();
  }

  private trySummonBoss() {
    const shrineX = this.worldData.shrine.x * TILE + TILE / 2;
    const shrineY = this.worldData.shrine.y * TILE + TILE / 2;
    if (gameStore.stats.bossDefeated) { gameStore.toast('The Rift Warden has already been defeated'); return; }
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, shrineX, shrineY) > TILE * 8) { gameStore.toast('The Hollow Beacon only answers at the deep violet shrine'); return; }
    if (!gameStore.inventory.removeSelected()) return;
    if (this.enemies.spawnBoss(shrineX, shrineY - 85)) {
      gameStore.toast('RIFT WARDEN AWAKENS'); this.cameras.main.shake(650, .012); gameStore.emit();
    } else gameStore.inventory.add('bossSigil', 1);
  }

  private openChest(tx: number, ty: number) {
    const site = this.worldData.chests.find((chest) => chest.x === tx && chest.y === ty);
    const tier = site?.tier ?? 1;
    const loot = tier === 1
      ? [['torch', 10], ['arrow', 25], ['potion', 2], ['copperOre', 8]] as const
      : tier === 2
        ? [['torch', 14], ['ironOre', 15], ['potion', 3], ['lifeCrystal', 1]] as const
        : [['ironOre', 18], ['lifeCrystal', 2], ['potion', 5], ['starBow', 1], ['arrow', 45]] as const;
    for (const [id, qty] of loot) if (!gameStore.inventory.add(id, qty)) this.dropItem(id, qty, tx * TILE + 8, ty * TILE);
    this.terrain.removeTileAt(tx, ty); gameStore.modifications[`${tx},${ty}`] = -1;
    gameStore.toast(`Ancient cache opened — tier ${tier} supplies recovered`); gameStore.save();
  }

  private collectPickup(pickup: ArcadeSprite) {
    const id = pickup.getData('item') as string; const qty = pickup.getData('qty') as number;
    if (!gameStore.inventory.add(id, qty)) return;
    pickup.destroy();
    if (this.onboarding === 0 && id === 'wood') { this.onboarding = 1; gameStore.toast('Wood collected • Press E to open crafting and inventory'); }
    else gameStore.emit();
  }

  private dropItem(id: string, qty: number, x: number, y: number) {
    if (!ITEMS[id]) return;
    const def = ITEMS[id];
    const nearby = (this.pickups.getChildren() as ArcadeSprite[]).find((child) => child.active && child.getData('item') === id && Phaser.Math.Distance.Between(x, y, child.x, child.y) < 28 && (child.getData('qty') ?? 0) + qty <= def.maxStack);
    if (nearby) { nearby.setData('qty', (nearby.getData('qty') ?? 0) + qty).setData('expiresAt', this.time.now + 90_000); return; }
    const active = (this.pickups.getChildren() as ArcadeSprite[]).filter((child) => child.active);
    if (active.length >= 64) active.sort((a, b) => (a.getData('expiresAt') ?? 0) - (b.getData('expiresAt') ?? 0))[0]?.destroy();
    const pickup = this.pickups.create(x, y, 'pickup') as ArcadeSprite | null;
    if (!pickup) return;
    const rare = id === 'riftCore' || def.category === 'accessory';
    pickup.setDataEnabled().setData({ item: id, qty, expiresAt: this.time.now + (rare ? 300_000 : 90_000) }).setTint(def.color).setBounce(.35).setVelocity(Phaser.Math.Between(-45, 45), -75).setDepth(6);
    (pickup.body as Phaser.Physics.Arcade.Body).setSize(7, 7);
  }

  private cleanupPickups(time: number) {
    for (const pickup of [...this.pickups.getChildren()] as ArcadeSprite[]) {
      const invalid = !Number.isFinite(pickup.x) || !Number.isFinite(pickup.y);
      const outside = pickup.x < -32 || pickup.x > WORLD_W * TILE + 32 || pickup.y > WORLD_H * TILE + 32;
      if (!pickup.active || invalid || outside || time >= (pickup.getData('expiresAt') ?? 0)) pickup.destroy();
    }
  }

  private hurtPlayer(rawDamage: number, sourceX: number) {
    const now = this.time.now;
    if (this.dead || now < this.invulnerableUntil) return;
    const damage = Math.max(1, rawDamage - gameStore.stats.defense);
    gameStore.stats.health = Math.max(0, gameStore.stats.health - damage);
    this.invulnerableUntil = now + 750;
    this.player.setTintFill(0xff667d).setVelocity(Math.sign(this.player.x - sourceX) * 115, -95);
    this.time.delayedCall(120, () => this.player.active && this.player.clearTint());
    this.cameras.main.shake(100, .007); gameStore.emit();
    if (gameStore.stats.health <= 0) this.die();
  }

  private die() {
    this.dead = true; this.player.setTint(0x444b65).setVelocity(0, -120);
    gameStore.toast('You fell. Returning to the surface…');
    this.time.delayedCall(1800, () => {
      this.player.setPosition(this.worldData.spawn.x, this.worldData.spawn.y).setVelocity(0).clearTint();
      gameStore.stats.health = gameStore.stats.maxHealth; this.dead = false; this.invulnerableUntil = this.time.now + 1500;
      gameStore.save(); gameStore.emit();
    });
  }

  private drawTarget(pointer: Phaser.Input.Pointer) {
    this.target.clear();
    const { tx, ty, distance } = this.pointerTile(pointer);
    const valid = distance <= TILE * 5.2;
    this.target.lineStyle(1, valid ? 0xf8e6a1 : 0xee5d75, .9).strokeRect(tx * TILE + .5, ty * TILE + .5, TILE - 1, TILE - 1);
    const item = gameStore.inventory.selectedItem; const tile = this.terrain.getTileAt(tx, ty);
    if (valid && item?.tile !== undefined && (!tile || tile.index < 0)) this.target.fillStyle(item.color, .28).fillRect(tx * TILE + 1, ty * TILE + 1, 14, 14);
  }

  private drawSwing(color: number) {
    this.effects.clear().lineStyle(3, color, .9).beginPath();
    const start = this.facing > 0 ? -1 : Math.PI + 1;
    this.effects.arc(this.player.x, this.player.y, 25, start, start + this.facing * 2).strokePath();
    this.time.delayedCall(100, () => this.effects.clear());
  }

  private blockParticles(x: number, y: number, color: number) {
    const burst = this.add.particles(x, y, 'pickup', { speed: { min: 15, max: 65 }, angle: { min: 190, max: 350 }, gravityY: 190, lifespan: 360, quantity: 6, scale: { start: .42, end: 0 }, tint: color, emitting: false }).setDepth(11);
    burst.explode(6); this.time.delayedCall(450, () => burst.destroy());
  }

  private pointerTile(pointer: Phaser.Input.Pointer) {
    const tx = Phaser.Math.Clamp(Math.floor(pointer.worldX / TILE), 0, WORLD_W - 1);
    const ty = Phaser.Math.Clamp(Math.floor(pointer.worldY / TILE), 0, WORLD_H - 1);
    return { tx, ty, distance: Phaser.Math.Distance.Between(this.player.x, this.player.y, tx * TILE + 8, ty * TILE + 8) };
  }

  private hasSolidNeighbor(tx: number, ty: number) {
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const tile = this.terrain.getTileAt(tx + dx, ty + dy); return !!tile && tile.index >= 0;
    });
  }

  private scanStations() {
    const centerX = Math.floor(this.player.x / TILE); const centerY = Math.floor(this.player.y / TILE);
    const found = new Set<Station>(['hand']);
    for (let y = centerY - 5; y <= centerY + 5; y++) for (let x = centerX - 5; x <= centerX + 5; x++) {
      const kind = this.terrain.getTileAt(x, y)?.index;
      if (kind === TileKind.Workbench) found.add('workbench');
      if (kind === TileKind.Furnace) found.add('furnace');
      if (kind === TileKind.Anvil) found.add('anvil');
    }
    const next = [...found];
    if (next.join() !== gameStore.nearbyStations.join()) { gameStore.nearbyStations = next; gameStore.emit(); }
  }

  private updateAtmosphere() {
    const daylight = Phaser.Math.Clamp((Math.sin((gameStore.timeOfDay - .15) * Math.PI * 2) + .35) / 1.35, .08, 1);
    const top = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0x11152c), Phaser.Display.Color.ValueToColor(0x66bce3), 100, daylight * 100,
    );
    this.cameras.main.setBackgroundColor(Phaser.Display.Color.GetColor(top.r, top.g, top.b));
    const tileY = this.player.y / TILE;
    const underground = Phaser.Math.Clamp((tileY - 34) / 40, 0, .72);
    this.darkness.setSize(this.scale.width / 2 + 4, this.scale.height / 2 + 4).setAlpha(underground + (gameStore.isNight() ? .16 : 0));
    this.glow.clear();
    const view = this.cameras.main.worldView;
    const minX = Math.max(0, Math.floor(view.left / TILE) - 2); const maxX = Math.min(WORLD_W - 1, Math.ceil(view.right / TILE) + 2);
    const minY = Math.max(0, Math.floor(view.top / TILE) - 2); const maxY = Math.min(WORLD_H - 1, Math.ceil(view.bottom / TILE) + 2);
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) if (this.terrain.getTileAt(x, y)?.index === TileKind.Torch) {
      this.glow.fillStyle(0xff7f32, .08).fillCircle(x * TILE + 8, y * TILE + 8, 54);
      this.glow.fillStyle(0xffd36b, .18).fillCircle(x * TILE + 8, y * TILE + 8, 25);
    }
    if (gameStore.inventory.selectedItem?.id === 'torch') this.glow.fillStyle(0xffc45c, .12).fillCircle(this.player.x, this.player.y, 42);
  }

  private createBackground() {
    const far = this.add.graphics().setScrollFactor(.08).setDepth(-10);
    far.fillStyle(0x263c5a, .8);
    for (let x = -100; x < WORLD_W * TILE + 200; x += 170) far.fillTriangle(x, 390, x + 90, 190 + (x % 130), x + 190, 390);
    const near = this.add.graphics().setScrollFactor(.18).setDepth(-9);
    near.fillStyle(0x182e42, .86);
    for (let x = -80; x < WORLD_W * TILE + 200; x += 120) near.fillTriangle(x, 430, x + 60, 270 + (x % 90), x + 135, 430);
    const stars = this.add.graphics().setScrollFactor(0).setDepth(-8);
    stars.fillStyle(0xffffff, .45);
    for (let i = 0; i < 50; i++) stars.fillRect((i * 83) % 700, (i * 47) % 170, 1, 1);
  }

  private setOverlay(kind: 'inventory' | 'pause') {
    if (kind === 'inventory') {
      gameStore.inventoryOpen = !gameStore.inventoryOpen;
      if (gameStore.inventoryOpen) { gameStore.paused = false; this.scanStations(); }
    }
    else { gameStore.paused = !gameStore.paused; if (gameStore.paused) gameStore.inventoryOpen = false; }
    if (gameStore.inventoryOpen || gameStore.paused) this.physics.world.pause(); else this.physics.world.resume();
    gameStore.emit();
  }

  private cleanup() {
    window.removeEventListener('beforeunload', this.onUnload);
    events.off(EVENT.TOGGLE_INVENTORY, this.toggleInventory);
    events.off(EVENT.TOGGLE_PAUSE, this.togglePause);
    gameStore.save();
  }
}
