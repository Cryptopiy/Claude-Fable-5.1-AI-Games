import { useEffect, useRef, useState } from 'react';
import { Game } from './game/Game';
import { HUD } from './ui/HUD';
import { INITIAL_HUD, type HudState } from './ui/hudState';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let game: Game | null = null;
    try {
      game = new Game(canvas, setHud);
      game.start();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    return () => {
      game?.dispose();
    };
  }, []);

  return (
    <div className="app">
      <canvas ref={canvasRef} className="game-canvas" />
      {error ? <div className="error">Failed to start the game: {error}</div> : <HUD state={hud} />}
    </div>
  );
}
