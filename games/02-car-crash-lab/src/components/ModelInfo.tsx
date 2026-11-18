export function ModelInfo() {
  return (
    <details className="model-panel panel">
      <summary>
        <span><i>Σ</i><strong>Physics model & assumptions</strong></span>
        <span className="expand-label">DETAILS <b>＋</b></span>
      </summary>
      <div className="model-content">
        <p>
          A deterministic 120 Hz solver projects oriented 3D rigid volumes onto the track plane,
          resolves contact along the shallowest penetration axis, then applies normal and
          friction impulses to both bodies.
        </p>
        <div className="formula-grid">
          <div><span>Momentum</span><code>p = m · v</code></div>
          <div><span>Kinetic energy</span><code>Eₖ = ½m · v²</code></div>
          <div><span>Impact force</span><code>F̄ = impulse / Δt</code></div>
          <div><span>Damage</span><code>100(1 − e^(−E/430kJ))</code></div>
        </div>
        <p className="model-disclaimer">
          This is an educational comparative model, not an engineering crash certification.
          Impact time varies by obstacle (75–170 ms); damage represents dissipated normal energy.
        </p>
      </div>
    </details>
  );
}
