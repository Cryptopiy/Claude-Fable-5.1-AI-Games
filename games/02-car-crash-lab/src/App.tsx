import { useCallback, useState } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { CrashScene } from './components/CrashScene';
import { HistoryTable } from './components/HistoryTable';
import { MetricStrip } from './components/MetricStrip';
import { ModelInfo } from './components/ModelInfo';
import { ResultsPanel } from './components/ResultsPanel';
import type {
  CrashResult,
  ImpactData,
  SimulationConfig,
  SimulationPhase,
  SimulationSnapshot,
} from './types';

const DEFAULT_CONFIG: SimulationConfig = {
  speedKmh: 72,
  massKg: 1450,
  angleDeg: 0,
  obstacleType: 'heavy',
  slowMotion: false,
};

const phaseLabel: Record<SimulationPhase, string> = {
  ready: 'SYSTEM READY',
  approach: 'VEHICLE IN MOTION',
  impact: 'IMPACT DETECTED',
  settling: 'SOLVING POST-IMPACT',
  complete: 'RUN COMPLETE',
};

export function App() {
  const [config, setConfig] = useState<SimulationConfig>(DEFAULT_CONFIG);
  const [sceneVersion, setSceneVersion] = useState(0);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<SimulationPhase>('ready');
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [impact, setImpact] = useState<ImpactData | null>(null);
  const [result, setResult] = useState<CrashResult | null>(null);
  const [history, setHistory] = useState<CrashResult[]>([]);

  const handleConfigChange = (patch: Partial<SimulationConfig>) => {
    if (running) return;
    setConfig((current) => ({ ...current, ...patch }));
    setPhase('ready');
    setCurrentSpeed(0);
    setImpact(null);
    setResult(null);
    setSceneVersion((version) => version + 1);
  };

  const handleRun = () => {
    if (running) return;
    setRunning(true);
    setPhase('approach');
    setCurrentSpeed(config.speedKmh);
    setImpact(null);
    setResult(null);
    setSceneVersion((version) => version + 1);
  };

  const handleReset = () => {
    setRunning(false);
    setPhase('ready');
    setCurrentSpeed(0);
    setImpact(null);
    setResult(null);
    setSceneVersion((version) => version + 1);
  };

  const handleTelemetry = useCallback((snapshot: SimulationSnapshot) => {
    setPhase(snapshot.phase);
    setCurrentSpeed(snapshot.currentSpeedKmh);
    setImpact(snapshot.impact);
  }, []);

  const handleComplete = useCallback((newResult: CrashResult) => {
    setRunning(false);
    setResult(newResult);
    setHistory((runs) => [newResult, ...runs].slice(0, 5));
  }, []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Vector Crash Lab home">
          <span className="brand-mark"><i /><i /><i /></span>
          <span><strong>VECTOR</strong><small>CRASH LAB // 3D</small></span>
        </a>
        <div className="system-status">
          <span className={`status-light phase-${phase}`} />
          <span><small>SIMULATION STATUS</small><strong>{phaseLabel[phase]}</strong></span>
        </div>
        <div className="build-label"><span>RIGID BODY SOLVER</span><strong>v1.4.2</strong></div>
      </header>

      <main id="top">
        <section className="hero-copy">
          <div>
            <span className="section-kicker">INTERACTIVE VEHICLE DYNAMICS</span>
            <h1>Collision <em>laboratory.</em></h1>
          </div>
          <p>
            Configure mass, velocity and impact geometry. Observe a deterministic
            three-dimensional collision and inspect the energy transferred.
          </p>
        </section>

        <div className="workspace-grid">
          <ControlPanel
            config={config}
            disabled={running}
            onChange={handleConfigChange}
            onRun={handleRun}
            onReset={handleReset}
          />
          <section className="viewport-panel panel">
            <MetricStrip config={config} currentSpeed={currentSpeed} impact={impact} phase={phase} />
            <div className="viewport-stage">
              <CrashScene
                config={config}
                sceneVersion={sceneVersion}
                running={running}
                onTelemetry={handleTelemetry}
                onComplete={handleComplete}
              />
              <div className="angle-hud">
                <span>TRAJECTORY</span>
                <strong>{config.angleDeg > 0 ? '+' : ''}{config.angleDeg}°</strong>
              </div>
              <div className="solver-hud">
                <i /><span>120 HZ PHYSICS</span>
              </div>
            </div>
          </section>
          <ResultsPanel result={result} />
        </div>

        <HistoryTable history={history} />
        <ModelInfo />
      </main>

      <footer>
        <span>VECTOR DYNAMICS RESEARCH UNIT</span>
        <span>EDUCATIONAL MODEL · SI UNITS · DETERMINISTIC SOLVER</span>
      </footer>
    </div>
  );
}
