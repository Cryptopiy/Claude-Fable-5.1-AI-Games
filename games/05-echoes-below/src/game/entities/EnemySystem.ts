import Phaser from 'phaser';
import { TILE, WORLD_H, WORLD_W, type Biome } from '../constants';

export type EnemyKind = 'mossling' | 'shambler' | 'gloomwing' | 'spitter' | 'thornling' | 'crawler' | 'boss';

interface EnemyConfig { hp: number; damage: number; speed: number; flying?: boolean; drop: string }

const CONFIG: Record<EnemyKind, EnemyConfig> = {
  mossling: { hp: 28, damage: 9, speed: 34, drop: 'dirt' },
  shambler: { hp: 46, damage: 13, speed: 42, drop: 'wood' },
  gloomwing: { hp: 34, damage: 11, speed: 58, flying: true, drop: 'arrow' },
  spitter: { hp: 42, damage: 12, speed: 30, drop: 'copperOre' },
  thornling: { hp: 55, damage: 16, speed: 76, drop: 'potion' },
  crawler: { hp: 70, damage: 19, speed: 48, drop: 'ironOre' },
  boss: { hp: 720, damage: 25, speed: 82, flying: true, drop: 'riftCore' },
};

export interface EnemyCallbacks {
  hurtPlayer: (damage: number, sourceX: number) => void;
  dropItem: (id: string, qty: number, x: number, y: number) => void;
  bossChanged: (health?: number, maxHealth?: number) => void;
  bossDefeated: () => void;
}

type EnemySprite = Phaser.Physics.Arcade.Sprite;

export class EnemySystem {
  readonly enemies: Phaser.Physics.Arcade.Group;
  readonly arrows: Phaser.Physics.Arcade.Group;
  readonly hostileShots: Phaser.Physics.Arcade.Group;
  private nextSpawn = 0;
  private nextCleanup = 0;

  constructor(
    private scene: Phaser.Scene,
    private player: Phaser.Physics.Arcade.Sprite,
    private terrain: Phaser.Tilemaps.TilemapLayer,
    private callbacks: EnemyCallbacks,
  ) {
    this.enemies = scene.physics.add.group({ maxSize: 18 });
    this.arrows = scene.physics.add.group({ maxSize: 32 });
    this.hostileShots = scene.physics.add.group({ maxSize: 96 });
    scene.physics.add.collider(this.enemies, this.terrain);
    scene.physics.add.collider(this.arrows, this.terrain, (object) => (object as Phaser.GameObjects.GameObject).destroy());
    scene.physics.add.collider(this.hostileShots, this.terrain, (object) => (object as Phaser.GameObjects.GameObject).destroy());
    scene.physics.add.overlap(player, this.enemies, (_player, foe) => {
      const enemy = foe as EnemySprite; this.callbacks.hurtPlayer(enemy.getData('damage'), enemy.x);
    });
    scene.physics.add.overlap(player, this.hostileShots, (_player, shot) => {
      const projectile = shot as Phaser.Physics.Arcade.Sprite;
      this.callbacks.hurtPlayer(projectile.getData('damage') ?? 10, projectile.x); projectile.destroy();
    });
    scene.physics.add.overlap(this.arrows, this.enemies, (shot, foe) => {
      const projectile = shot as Phaser.Physics.Arcade.Sprite;
      this.damage(foe as EnemySprite, projectile.getData('damage') ?? 10, (projectile.body as Phaser.Physics.Arcade.Body).velocity.x * 0.04);
      projectile.destroy();
    });
  }

  update(time: number, biome: Biome, depth: string, isNight: boolean) {
    const list = [...this.enemies.getChildren()] as EnemySprite[];
    for (const enemy of list) {
      if (!enemy.active) continue;
      if (!Number.isFinite(enemy.x) || !Number.isFinite(enemy.y)) { enemy.destroy(); continue; }
      const kind = enemy.getData('kind') as EnemyKind;
      const dx = this.player.x - enemy.x; const dy = this.player.y - enemy.y;
      const config = CONFIG[kind]; const phase = kind === 'boss' && enemy.getData('hp') < config.hp * .5 ? 1 : 0;
      enemy.setFlipX(dx < 0);
      if (kind === 'mossling') {
        enemy.setVelocityX(Math.sign(dx) * config.speed);
        if ((enemy.body as Phaser.Physics.Arcade.Body).blocked.down && time > (enemy.getData('nextJump') ?? 0)) { enemy.setVelocityY(-145); enemy.setData('nextJump', time + 1300); }
      } else if (kind === 'shambler' || kind === 'thornling' || kind === 'crawler') {
        enemy.setVelocityX(Math.sign(dx) * config.speed * (kind === 'thornling' ? 1.25 : 1));
        if ((enemy.body as Phaser.Physics.Arcade.Body).blocked.down && Math.abs(dy) > 18) enemy.setVelocityY(-125);
      } else if (kind === 'gloomwing') {
        this.disableGravity(enemy); enemy.setVelocity(Math.sign(dx) * config.speed, Math.sign(dy) * 36 + Math.sin(time / 180) * 25);
      } else if (kind === 'spitter') {
        enemy.setVelocityX(Math.abs(dx) < 110 ? -Math.sign(dx) * config.speed : Math.sign(dx) * config.speed);
        if (time > (enemy.getData('nextAttack') ?? 0) && Math.abs(dx) < 250) { this.fireHostile(enemy, this.player.x, this.player.y, 90, 11); enemy.setData('nextAttack', time + 2300); }
      } else if (kind === 'boss') this.updateBoss(enemy, time, dx, dy, phase);
      if (Math.abs(dx) > 900 && kind !== 'boss') enemy.destroy();
    }
    const cap = isNight ? 14 : 9;
    if (time > this.nextSpawn && list.filter((enemy) => enemy.active && enemy.getData('kind') !== 'boss').length < cap) {
      this.spawnForRegion(biome, depth);
      this.nextSpawn = time + (isNight ? 1500 : 2700);
    }
    if (time > this.nextCleanup) { this.cleanupProjectiles(time); this.nextCleanup = time + 1000; }
  }

  spawnBoss(x: number, y: number) {
    if ((this.enemies.getChildren() as EnemySprite[]).some((enemy) => enemy.active && enemy.getData('kind') === 'boss')) return false;
    const boss = this.spawn('boss', x, y);
    if (!boss) return false;
    boss.setScale(1.35).setDepth(6);
    (boss.body as Phaser.Physics.Arcade.Body).setSize(30, 26).setAllowGravity(false);
    this.callbacks.bossChanged(CONFIG.boss.hp, CONFIG.boss.hp);
    return true;
  }

  shoot(x: number, y: number, targetX: number, targetY: number, damage: number) {
    const shot = this.arrows.create(x, y, 'arrowProjectile') as Phaser.Physics.Arcade.Sprite | null;
    if (!shot) return;
    const angle = Phaser.Math.Angle.Between(x, y, targetX, targetY);
    shot.setRotation(angle).setVelocity(Math.cos(angle) * 330, Math.sin(angle) * 330).setData({ damage, expiresAt: this.scene.time.now + 2500 }).setDepth(7);
    this.disableGravity(shot);
  }

  melee(x: number, y: number, facing: number, damage: number, reach = 32) {
    const zone = new Phaser.Geom.Rectangle(x + (facing > 0 ? 0 : -reach), y - 18, reach, 36);
    let hit = 0;
    for (const enemy of this.enemies.getChildren() as EnemySprite[]) {
      if (enemy.active && Phaser.Geom.Rectangle.Overlaps(zone, enemy.getBounds())) {
        this.damage(enemy, damage, facing * 95); hit++;
      }
    }
    return hit;
  }

  private spawnForRegion(biome: Biome, depth: string) {
    let pool: EnemyKind[];
    if (depth === 'Deep Caverns') pool = ['crawler', 'gloomwing', 'spitter'];
    else if (depth === 'Underground') pool = ['crawler', 'mossling', 'gloomwing'];
    else if (biome === 'overgrowth') pool = ['thornling', 'spitter', 'mossling'];
    else if (biome === 'desert') pool = ['spitter', 'shambler'];
    else pool = ['mossling', 'shambler', 'gloomwing'];
    const kind = Phaser.Utils.Array.GetRandom(pool);
    const side = Math.random() < .5 ? -1 : 1;
    const x = Phaser.Math.Clamp(this.player.x + side * Phaser.Math.Between(190, 300), 30, WORLD_W * TILE - 30);
    const y = CONFIG[kind].flying ? this.player.y - 50 : this.findGroundY(x, this.player.y / TILE);
    this.spawn(kind, x, y);
  }

  private findGroundY(worldX: number, desiredTileY: number) {
    const tx = Phaser.Math.Clamp(Math.floor(worldX / TILE), 1, WORLD_W - 2);
    const origin = Phaser.Math.Clamp(Math.floor(desiredTileY), 2, WORLD_H - 3);
    for (let radius = 0; radius < 25; radius++) {
      for (const y of [origin + radius, origin - radius]) {
        if (y < 2 || y >= WORLD_H - 2) continue;
        const here = this.terrain.getTileAt(tx, y); const above = this.terrain.getTileAt(tx, y - 1); const below = this.terrain.getTileAt(tx, y + 1);
        if ((!here || here.index < 0) && (!above || above.index < 0) && below && below.index >= 0) return y * TILE + 7;
      }
    }
    return this.player.y - 20;
  }

  private spawn(kind: EnemyKind, x: number, y: number): EnemySprite | null {
    const config = CONFIG[kind];
    const enemy = this.enemies.create(x, y, kind) as EnemySprite | null;
    if (!enemy) return null;
    enemy.setDataEnabled().setData({ kind, hp: config.hp, maxHp: config.hp, damage: config.damage, nextAttack: 0 });
    enemy.setBounce(.05).setCollideWorldBounds(true).setDepth(5);
    if (config.flying) this.disableGravity(enemy);
    return enemy;
  }

  private updateBoss(boss: EnemySprite, time: number, dx: number, dy: number, phase: number) {
    this.disableGravity(boss);
    const attack = Math.floor(time / (phase ? 1800 : 2500)) % 3;
    const speed = CONFIG.boss.speed * (phase ? 1.45 : 1);
    if (attack === 0) boss.setVelocity(Math.sign(dx) * speed * 1.8, Math.sign(dy) * speed * .45);
    if (attack === 1) {
      boss.setVelocity(Math.sign(dx) * speed * .45, Math.sin(time / 170) * speed);
      if (time > (boss.getData('nextAttack') ?? 0)) {
        for (let i = 0; i < (phase ? 10 : 7); i++) {
          const angle = i / (phase ? 10 : 7) * Math.PI * 2;
          this.fireHostile(boss, boss.x + Math.cos(angle) * 30, boss.y + Math.sin(angle) * 30, phase ? 125 : 95, phase ? 18 : 14, angle);
        }
        boss.setData('nextAttack', time + (phase ? 900 : 1350));
      }
    }
    if (attack === 2) {
      const targetY = this.player.y - 105;
      boss.setVelocity(Math.sign(dx) * speed * .7, Math.sign(targetY - boss.y) * speed);
      if (time > (boss.getData('nextAttack') ?? 0)) {
        for (let offset = -80; offset <= 80; offset += 40) this.fireHostileAt(this.player.x + offset, this.player.y - 180, Math.PI / 2, 145, phase ? 20 : 15);
        boss.setData('nextAttack', time + (phase ? 750 : 1150));
        this.scene.cameras.main.shake(160, .006);
      }
    }
  }

  private fireHostile(origin: EnemySprite, targetX: number, targetY: number, speed: number, damage: number, forcedAngle?: number) {
    const shot = this.hostileShots.create(origin.x, origin.y, 'enemyProjectile') as Phaser.Physics.Arcade.Sprite | null;
    if (!shot) return;
    const angle = forcedAngle ?? Phaser.Math.Angle.Between(origin.x, origin.y, targetX, targetY);
    shot.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed).setData({ damage, expiresAt: this.scene.time.now + 3500 }).setDepth(7);
    this.disableGravity(shot);
  }

  private fireHostileAt(x: number, y: number, angle: number, speed: number, damage: number) {
    const shot = this.hostileShots.create(x, y, 'enemyProjectile') as Phaser.Physics.Arcade.Sprite | null;
    if (!shot) return;
    shot.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed).setData({ damage, expiresAt: this.scene.time.now + 3500 }).setDepth(7);
    this.disableGravity(shot);
  }

  private cleanupProjectiles(time: number) {
    const prune = (group: Phaser.Physics.Arcade.Group) => {
      for (const child of [...group.getChildren()] as Phaser.Physics.Arcade.Sprite[]) {
        const invalid = !Number.isFinite(child.x) || !Number.isFinite(child.y);
        const outside = child.x < -64 || child.x > WORLD_W * TILE + 64 || child.y < -64 || child.y > WORLD_H * TILE + 64;
        if (!child.active || invalid || outside || time >= (child.getData('expiresAt') ?? 0)) child.destroy();
      }
    };
    prune(this.arrows); prune(this.hostileShots);
  }

  private disableGravity(sprite: Phaser.Physics.Arcade.Sprite) {
    (sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
  }

  private damage(enemy: EnemySprite, amount: number, knockback: number) {
    if (!enemy.active) return;
    const hp = Math.max(0, (enemy.getData('hp') as number) - amount);
    enemy.setData('hp', hp).setTintFill(0xffffff).setVelocityX(knockback);
    this.scene.time.delayedCall(80, () => enemy.active && enemy.clearTint());
    const number = this.scene.add.text(enemy.x, enemy.y - 14, `${Math.round(amount)}`, { fontFamily: 'monospace', fontSize: '10px', color: '#fff4a8', stroke: '#251a2d', strokeThickness: 3 }).setOrigin(.5).setDepth(20);
    this.scene.tweens.add({ targets: number, y: number.y - 24, alpha: 0, duration: 650, onComplete: () => number.destroy() });
    if (enemy.getData('kind') === 'boss') this.callbacks.bossChanged(hp, CONFIG.boss.hp);
    if (hp <= 0) this.kill(enemy);
  }

  private kill(enemy: EnemySprite) {
    const kind = enemy.getData('kind') as EnemyKind;
    const config = CONFIG[kind];
    this.callbacks.dropItem(config.drop, kind === 'boss' ? 2 : Phaser.Math.Between(1, 3), enemy.x, enemy.y);
    if (kind === 'boss') { this.callbacks.bossChanged(); this.callbacks.bossDefeated(); }
    const burst = this.scene.add.particles(enemy.x, enemy.y, 'pickup', { speed: { min: 20, max: 80 }, lifespan: 350, quantity: 8, scale: { start: .6, end: 0 }, tint: kind === 'boss' ? 0xe168ff : 0xffd16e, emitting: false }).setDepth(12);
    burst.explode(8); this.scene.time.delayedCall(450, () => burst.destroy());
    enemy.destroy();
  }
}
