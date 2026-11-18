import type { ImpactData, SimulationConfig, SimulationPhase } from '../types';

interface MetricStripProps {
  config: SimulationConfig;
  currentSpeed: number;
  impact: ImpactData | null;
  phase: SimulationPhase;
}

export function MetricStrip({ config, currentSpeed, impact, phase }: MetricStripProps) {
  const cells = [
    { label: 'CONFIGURED', value: config.speedKmh.toFixed(0), unit: 'km/h' },
    { label: 'LIVE SPEED', value: currentSpeed.toFixed(1), unit: 'km/h', live: phase !== 'ready' },
    { label: 'EST. FORCE', value: impact ? impact.forceKn.toFixed(0) : '—', unit: 'kN' },
    { label: 'DAMAGE', value: impact ? impact.damagePct.toFixed(1) : '—', unit: '%' },
  ];
  return (
    <div className="metric-strip">
      {cells.map((cell) => (
        <div className="metric-cell" key={cell.label}>
          <span>{cell.live && <i className="live-pip" />}{cell.label}</span>
          <strong>{cell.value} <small>{cell.unit}</small></strong>
        </div>
      ))}
    </div>
  );
}
