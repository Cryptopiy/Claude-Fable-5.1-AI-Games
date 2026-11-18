import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';

export const createGame = (parent: HTMLElement) => new Phaser.Game({
  type: Phaser.AUTO,
  parent,
  width: 1280,
  height: 720,
  backgroundColor: '#11152c',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 520 }, debug: false },
  },
  scene: [BootScene, GameScene],
});
