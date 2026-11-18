import { OBSTACLES } from '../physics/obstacles';
import type { CrashResult } from '../types';

interface ResultsPanelProps {
  result: CrashResult | null;
}

const severityClass: Record<CrashResult['severity'], string> = {
  Minor: 'severity-minor',
  Moderate: 'severity-moderate',
  Severe: 'severity-severe',
  Catastrophic: 'severity-catastrophic',
};

export function ResultsPanel({ result }: ResultsPanelProps) {
  return (
    <section className="results-panel panel">
      <div className="panel-heading">
        <span className="eyebrow">POST-IMPACT REPORT</span>
        <span className="panel-index">02</span>
      </div>
      {!result ? (
        <div className="results-empty">
          <div className="scan-symbol"><span /></div>
          <strong>AWAITING COLLISION DATA</strong>
          <p>Configure a test and run the simulation to generate a complete impact report.</p>
        </div>
      ) : (
        <div className="results-content">
          <div className="result-headline">
            <div>
              <span>DAMAGE ASSESSMENT</span>
              <strong>{result.damagePct.toFixed(1)}<small>%</small></strong>
            </div>
            <span className={`severity-badge ${severityClass[result.severity]}`}>{result.severity}</span>
          </div>
          <div className="damage-meter"><i style={{ width: `${result.damagePct}%` }} /></div>
          <div className="result-grid">
            <ResultDatum label="Impact speed" value={`${result.impactSpeedKmh.toFixed(1)} km/h`} />
            <ResultDatum label="Est. impact force" value={`${result.forceKn.toFixed(0)} kN`} />
            <ResultDatum label="Final position" value={`X ${result.finalX.toFixed(2)} · Z ${result.finalY.toFixed(2)} m`} />
            <ResultDatum label="Final yaw" value={`${result.finalYawDeg.toFixed(1)}°`} />
            <ResultDatum label="Impact zone" value={result.damageZone.toUpperCase()} />
            <ResultDatum label="Obstacle" value={OBSTACLES[result.obstacleType].shortName} />
            <ResultDatum label="Initial energy" value={`${result.energyBeforeKj.toFixed(0)} kJ`} />
            <ResultDatum label="Vehicle mass" value={`${result.massKg.toLocaleString()} kg`} />
          </div>
          <div className="force-assumption">
            <span>i</span>
            Force estimate = collision impulse ÷ {Math.round(result.impactDurationS * 1000)} ms assumed crush interval.
          </div>
        </div>
      )}
    </section>
  );
}

function ResultDatum({ label, value }: { label: string; value: string }) {
  return <div className="result-datum"><span>{label}</span><strong>{value}</strong></div>;
}
