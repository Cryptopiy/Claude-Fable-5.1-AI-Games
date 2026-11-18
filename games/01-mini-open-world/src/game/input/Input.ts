const GAME_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyE',
  'KeyR',
  'KeyH',
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ShiftLeft',
  'ShiftRight',
]);

/** Keyboard state tracker. Listens on window so focus changes in the UI never swallow input. */
export class Input {
  private readonly down = new Set<string>();
  private readonly pressed = new Set<string>();

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!this.down.has(e.code)) this.pressed.add(e.code);
    this.down.add(e.code);
  };
  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.down.delete(e.code);
  };
  private readonly onBlur = (): void => {
    this.down.clear();
  };

  attach(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** True only on the frame the key went down. */
  wasPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  /** Call once per rendered frame after all systems consumed the input. */
  endFrame(): void {
    this.pressed.clear();
  }

  get forward(): boolean {
    return this.isDown('KeyW') || this.isDown('ArrowUp');
  }
  get back(): boolean {
    return this.isDown('KeyS') || this.isDown('ArrowDown');
  }
  get left(): boolean {
    return this.isDown('KeyA') || this.isDown('ArrowLeft');
  }
  get right(): boolean {
    return this.isDown('KeyD') || this.isDown('ArrowRight');
  }
  get brake(): boolean {
    return this.isDown('Space');
  }
}
