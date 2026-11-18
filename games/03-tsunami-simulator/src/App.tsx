import { useCallback, useRef, useState } from 'react';
import type { SimulationStats } from './simulation/types';
import { TsunamiScene, type TsunamiSceneHandle } from './three/TsunamiScene';

const INITIAL_STATS: SimulationStats = {
  phase: 'Ready',
  running: false,
  floodedPercent: 0,
  maxDepth: 0,
  floodedBuildings: 0,
  totalBuildings: 24,
  displacedVehicles: 0,
  totalVehicles: 8,
  elapsed: 0,
};

function App() {
  const sceneRef = useRef<TsunamiSceneHandle>(null);
  const [waveHeight, setWaveHeight] = useState(8);
  const [stats, setStats] = useState<SimulationStats>(INITIAL_STATS);

  const handleStats = useCallback((nextStats: SimulationStats) => {
    setStats(nextStats);
  }, []);

  const handleWaveHeight = (height: number): void => {
    setWaveHeight(height);
    sceneRef.current?.setWaveHeight(height);
  };

  const handleStart = (): void => {
    sceneRef.current?.start(waveHeight);
  };

  const handleReset = (): void => {
    sceneRef.current?.reset();
  };

  const severity = waveHeight <= 5 ? 'Limited surge' : waveHeight <= 12 ? 'Major inundation' : 'Extreme event';
  const startLabel = stats.running
    ? 'TSUNAMI IN PROGRESS'
    : stats.phase === 'Settled'
      ? 'RUN SIMULATION AGAIN'
      : 'START TSUNAMI';

  return (
    <main className="app-shell">
      <TsunamiScene ref={sceneRef} onStats={handleStats} />
      <div className="atmosphere" aria-hidden="true" />

      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 44 44" role="presentation">
              <path d="M5 27c6-1 8-7 14-7 7 0 7 7 14 7 3 0 5-1 7-3-2 9-9 15-18 15C13 39 7 35 5 27Z" />
              <path d="M7 19c5-1 7-6 12-6 6 0 7 6 13 6 3 0 5-1 7-3-2 6-7 10-14 10-8 0-14-3-18-7Z" />
            </svg>
          </span>
          <div>
            <p className="eyebrow">COASTAL IMPACT LAB</p>
            <h1>Tsunami Simulator</h1>
          </div>
        </div>
        <div className={`event-state ${stats.running ? 'is-active' : ''}`}>
          <span className="state-dot" aria-hidden="true" />
          <span>{stats.phase}</span>
        </div>
      </header>

      <section className="stats-panel" aria-label="Live simulation statistics">
        <div className="primary-stat">
          <div className="stat-heading">
            <span>Flooded area</span>
            <strong>{stats.floodedPercent.toFixed(1)}%</strong>
          </div>
          <div className="progress-track" aria-hidden="true">
            <span style={{ width: `${Math.min(100, stats.floodedPercent)}%` }} />
          </div>
        </div>
        <div className="stat-grid">
          <Stat label="Max depth" value={`${stats.maxDepth.toFixed(1)} m`} />
          <Stat label="Buildings" value={`${stats.floodedBuildings} / ${stats.totalBuildings}`} />
          <Stat label="Vehicles moved" value={`${stats.displacedVehicles} / ${stats.totalVehicles}`} />
          <Stat label="Elapsed" value={formatTime(stats.elapsed)} />
        </div>
      </section>

      <aside className="control-panel" aria-label="Tsunami controls">
        <div className="panel-kicker">
          <span>EVENT PARAMETERS</span>
          <span className={`severity severity-${severity.split(' ')[0].toLowerCase()}`}>{severity}</span>
        </div>

        <div className="wave-control">
          <label htmlFor="wave-height">Wave height</label>
          <output htmlFor="wave-height">
            <strong>{waveHeight}</strong>
            <span>meters</span>
          </output>
          <input
            id="wave-height"
            type="range"
            min="1"
            max="20"
            step="1"
            value={waveHeight}
            onChange={(event) => handleWaveHeight(Number(event.target.value))}
            aria-describedby="wave-impact-note"
          />
          <div className="range-labels" aria-hidden="true">
            <span>1 m</span>
            <span>10 m</span>
            <span>20 m</span>
          </div>
          <p id="wave-impact-note" className="impact-note">
            {impactDescription(waveHeight)}
          </p>
        </div>

        <button className="start-button" type="button" onClick={handleStart} disabled={stats.running}>
          <span className="start-icon" aria-hidden="true">▶</span>
          <span>{startLabel}</span>
        </button>
        <button className="reset-button" type="button" onClick={handleReset}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5.4 7.3A8 8 0 1 1 4 12h2a6 6 0 1 0 1.1-3.5L10 11H3V4l2.4 3.3Z" />
          </svg>
          Reset environment
        </button>

        <p className="interaction-hint">
          <span className="mouse-icon" aria-hidden="true" />
          Drag to orbit · Scroll to zoom
        </p>
      </aside>

      <aside className="elevation-legend" aria-label="Elevation legend">
        <span>Elevation</span>
        <div className="legend-ramp" aria-hidden="true" />
        <div className="legend-labels">
          <span>0 m coast</span>
          <span>14 m high ground</span>
        </div>
      </aside>

      <div className="sea-label" aria-hidden="true">
        <span /> PACIFIC OCEAN
      </div>
      <div className="model-note">SIMULATION MODEL · 2 M GRID · LIVE WATER FLOW</div>
    </main>
  );
}

interface StatProps {
  label: string;
  value: string;
}

function Stat({ label, value }: StatProps) {
  return (
    <div className="stat-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatTime(seconds: number): string {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(wholeSeconds % 60).padStart(2, '0')}`;
}

function impactDescription(height: number): string {
  if (height <= 5) return 'Low coastal ground and harbor roads are most exposed.';
  if (height <= 12) return 'Water can enter central streets and the low inland basin.';
  return 'Deep, fast water may reach the ridge below the high-ground refuge.';
}

export default App;
