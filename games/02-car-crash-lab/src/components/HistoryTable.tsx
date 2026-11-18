import { OBSTACLES } from '../physics/obstacles';
import type { CrashResult } from '../types';

export function HistoryTable({ history }: { history: CrashResult[] }) {
  return (
    <section className="history-panel panel">
      <div className="panel-heading history-heading">
        <div>
          <span className="eyebrow">SESSION LOG</span>
          <h2>Last experiments</h2>
        </div>
        <span className="run-count">{history.length} / 5 RUNS</span>
      </div>
      <div className="history-scroll">
        <table>
          <thead>
            <tr>
              <th>RUN</th><th>SPEED</th><th>MASS</th><th>ANGLE</th><th>OBSTACLE</th><th>FORCE</th><th>DAMAGE</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr className="empty-row"><td colSpan={7}>No completed experiments in this session</td></tr>
            ) : history.map((run, index) => (
              <tr key={run.id}>
                <td><span className="run-number">{String(history.length - index).padStart(2, '0')}</span></td>
                <td>{run.impactSpeedKmh.toFixed(0)} <small>km/h</small></td>
                <td>{run.massKg.toLocaleString()} <small>kg</small></td>
                <td>{run.angleDeg > 0 ? '+' : ''}{run.angleDeg}°</td>
                <td>{OBSTACLES[run.obstacleType].shortName}</td>
                <td>{run.forceKn.toFixed(0)} <small>kN</small></td>
                <td><span className={`damage-pill damage-${run.severity.toLowerCase()}`}>{run.damagePct.toFixed(0)}%</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
