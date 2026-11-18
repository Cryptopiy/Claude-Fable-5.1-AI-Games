import Phaser from 'phaser';
import { TileKind } from '../constants';

const TILE_COLORS = [
  0x8b5a36, 0x4f8f4b, 0x69717e, 0xd8ad63, 0xe1f2ff, 0x9ccce0,
  0x925a31, 0x397445, 0xb96a46, 0xaeb6c3, 0x55cedc, 0x596073,
  0xba7a42, 0x9e6038, 0x6e7480, 0x9ca6b4, 0xff9f32, 0xb87b35,
  0x9a48bd, 0x315d3c,
];

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  create() {
    this.makeTileSheet();
    this.makeActors();
    this.scene.start('game');
  }

  private makeTileSheet() {
    const size = 16;
    const canvas = this.textures.createCanvas('tiles', TILE_COLORS.length * size, size)!;
    const ctx = canvas.getContext();
    ctx.imageSmoothingEnabled = false;
    TILE_COLORS.forEach((color, index) => {
      const x = index * size;
      const css = `#${color.toString(16).padStart(6, '0')}`;
      ctx.fillStyle = css; ctx.fillRect(x, 0, size, size);
      ctx.fillStyle = 'rgba(255,255,255,.13)';
      ctx.fillRect(x + 2 + index % 3, 3, 3, 2); ctx.fillRect(x + 10, 10 - index % 4, 2, 2);
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x, 14, size, 2); ctx.fillRect(x + 6, 7, 4, 2);
      if (index === TileKind.Grass) { ctx.fillStyle = '#83ce58'; ctx.fillRect(x, 0, size, 4); ctx.fillRect(x + 3, 4, 2, 2); }
      if (index === TileKind.Jungle) { ctx.fillStyle = '#5da84a'; ctx.fillRect(x, 0, size, 3); ctx.fillRect(x + 1, 4, 2, 4); }
      if (index === TileKind.Snow) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x, 0, size, 5); }
      if (([TileKind.Copper, TileKind.Iron, TileKind.Moonstone] as number[]).includes(index)) {
        ctx.fillStyle = index === TileKind.Copper ? '#ef9d68' : index === TileKind.Iron ? '#e7edf5' : '#93fbff';
        ctx.fillRect(x + 2, 4, 4, 3); ctx.fillRect(x + 9, 9, 5, 3);
      }
      if (index === TileKind.Wood) { ctx.fillStyle = '#633a27'; ctx.fillRect(x + 3, 0, 2, size); ctx.fillRect(x + 11, 0, 2, size); }
      if (index === TileKind.Leaves) { ctx.fillStyle = '#58a950'; ctx.fillRect(x + 2, 2, 5, 5); ctx.fillRect(x + 9, 7, 5, 5); }
      if (index === TileKind.Platform) { ctx.clearRect(x, 0, size, 9); ctx.fillStyle = '#d19a5a'; ctx.fillRect(x, 9, size, 4); ctx.fillStyle = '#75482e'; ctx.fillRect(x + 3, 13, 2, 3); ctx.fillRect(x + 11, 13, 2, 3); }
      if (index === TileKind.Torch) { ctx.clearRect(x, 0, size, size); ctx.fillStyle = '#7c4a2d'; ctx.fillRect(x + 7, 7, 2, 8); ctx.fillStyle = '#fff080'; ctx.fillRect(x + 6, 2, 4, 5); ctx.fillStyle = '#ff7f32'; ctx.fillRect(x + 7, 0, 2, 4); }
      if (index === TileKind.Chest) { ctx.clearRect(x, 0, size, 4); ctx.fillStyle = '#e2a14e'; ctx.fillRect(x + 1, 4, 14, 11); ctx.fillStyle = '#6b3b27'; ctx.fillRect(x + 1, 8, 14, 2); ctx.fillStyle = '#fff19b'; ctx.fillRect(x + 7, 8, 2, 4); }
      if (index === TileKind.Shrine) { ctx.clearRect(x, 0, size, size); ctx.fillStyle = '#733b91'; ctx.fillRect(x + 2, 11, 12, 5); ctx.fillStyle = '#d76cff'; ctx.fillRect(x + 6, 2, 4, 10); ctx.fillStyle = '#fff'; ctx.fillRect(x + 7, 4, 2, 2); }
    });
    canvas.refresh();
  }

  private makeActors() {
    this.textureFromGraphics('player', 12, 22, (g) => {
      g.fillStyle(0xf0c9a5).fillRect(3, 1, 6, 6);
      g.fillStyle(0x543928).fillRect(2, 0, 8, 3);
      g.fillStyle(0x41b7a2).fillRect(2, 7, 8, 9);
      g.fillStyle(0x243247).fillRect(2, 16, 3, 6).fillRect(7, 16, 3, 6);
      g.fillStyle(0xffffff).fillRect(8, 3, 1, 1);
    });
    this.textureFromGraphics('npc', 12, 22, (g) => {
      g.fillStyle(0xd39d78).fillRect(3, 1, 6, 6); g.fillStyle(0xf2cc49).fillRect(2, 0, 8, 3);
      g.fillStyle(0xc84d75).fillRect(2, 7, 8, 9); g.fillStyle(0x3e294c).fillRect(2, 16, 3, 6).fillRect(7, 16, 3, 6);
    });
    const actor = (key: string, color: number, accent: number, flying = false) => this.textureFromGraphics(key, 16, 14, (g) => {
      g.fillStyle(color).fillRoundedRect(1, flying ? 3 : 2, 14, 11, 4);
      g.fillStyle(accent).fillRect(3, 5, 3, 3).fillRect(10, 5, 3, 3);
      g.fillStyle(0xffffff).fillRect(4, 5, 1, 1).fillRect(11, 5, 1, 1);
      if (flying) g.fillStyle(color, .75).fillTriangle(1, 6, -5, 1, -3, 10).fillTriangle(15, 6, 21, 1, 19, 10);
    });
    actor('mossling', 0x65b94e, 0x2b5735);
    actor('shambler', 0x9b684e, 0x482e35);
    actor('gloomwing', 0x856ad1, 0x33285f, true);
    actor('spitter', 0xdb914f, 0x713928);
    actor('thornling', 0x43bd72, 0x18552f);
    actor('crawler', 0x4aaec2, 0x183f67);
    this.textureFromGraphics('boss', 34, 30, (g) => {
      g.fillStyle(0x251a43).fillRoundedRect(2, 5, 30, 23, 6); g.fillStyle(0x9d43cf).fillRect(6, 2, 5, 10).fillRect(23, 2, 5, 10);
      g.fillStyle(0xf57dff).fillCircle(17, 14, 6); g.fillStyle(0xffffff).fillCircle(17, 14, 2);
      g.fillStyle(0x6d328f).fillTriangle(2, 17, -5, 11, 0, 25).fillTriangle(32, 17, 39, 11, 34, 25);
    });
    this.textureFromGraphics('pickup', 8, 8, (g) => { g.fillStyle(0xffdc72).fillRect(2, 0, 4, 8).fillRect(0, 2, 8, 4); g.fillStyle(0xffffff).fillRect(3, 1, 2, 2); });
    this.textureFromGraphics('arrowProjectile', 10, 3, (g) => { g.fillStyle(0xe8d5aa).fillRect(0, 1, 8, 1); g.fillStyle(0xffffff).fillTriangle(7, 0, 10, 1, 7, 3); });
    this.textureFromGraphics('enemyProjectile', 6, 6, (g) => { g.fillStyle(0xf36bb0).fillCircle(3, 3, 3); g.fillStyle(0xffffff).fillRect(2, 1, 2, 2); });
  }

  private textureFromGraphics(key: string, width: number, height: number, draw: (g: Phaser.GameObjects.Graphics) => void) {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    draw(g); g.generateTexture(key, width, height); g.destroy();
  }
}
