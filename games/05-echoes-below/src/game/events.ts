import Phaser from 'phaser';

export const events = new Phaser.Events.EventEmitter();

export const EVENT = {
  UI: 'ui:update',
  TOGGLE_INVENTORY: 'ui:toggle-inventory',
  TOGGLE_PAUSE: 'ui:toggle-pause',
  TOAST: 'ui:toast',
  CRAFT: 'craft',
  SELECT_SLOT: 'select-slot',
  MOVE_SLOT: 'move-slot',
} as const;
