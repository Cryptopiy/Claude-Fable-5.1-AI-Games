import type { HudState } from './hudState';

interface Props {
  state: HudState;
}

export function HUD({ state }: Props) {
  const wanted = state.wantedLevel > 0;
  return (
    <div className="hud">
      <div className="hud-top-left panel">
        <div className={`mode ${state.mode === 'DRIVING' ? 'mode-driving' : 'mode-foot'}`}>{state.mode}</div>
        {state.mode === 'DRIVING' && (
          <div className="speed">
            <span className="speed-value">{state.speedKmh}</span>
            <span className="speed-unit">km/h</span>
            <span className="vehicle-name">{state.vehicleName}</span>
          </div>
        )}
      </div>

      <div className="hud-top-center">
        <div className={`wanted panel ${wanted ? 'wanted-active' : ''}`}>
          <div className="stars">
            {[0, 1, 2].map((k) => (
              <span key={k} className={k < state.wantedLevel ? 'star on' : 'star'}>
                ★
              </span>
            ))}
          </div>
          <div className="wanted-label">{wanted ? 'WANTED - POLICE IN PURSUIT' : 'No police attention'}</div>
          {wanted && (
            <div className="escape-bar">
              <div className="escape-fill" style={{ width: `${Math.round(state.escapeProgress * 100)}%` }} />
            </div>
          )}
          {state.wantedMessage && <div className="wanted-message">{state.wantedMessage}</div>}
        </div>
      </div>

      <div className="hud-top-right panel">
        <div className="objective-title">
          MISSION
          {state.missionTimeLeft !== null && <span className="timer"> {Math.ceil(state.missionTimeLeft)}s</span>}
        </div>
        <div className={`objective objective-${state.missionState}`}>{state.objective}</div>
      </div>

      {state.banner && <div className="banner">{state.banner}</div>}

      {state.hint && <div className="hint">{state.hint}</div>}

      <div className="hud-bottom-left panel controls">
        {state.showHelp ? (
          <>
            <div className="controls-title">CONTROLS</div>
            <div>
              <kbd>W</kbd>
              <kbd>A</kbd>
              <kbd>S</kbd>
              <kbd>D</kbd> / arrows — move / drive
            </div>
            <div>
              <kbd>E</kbd> enter / exit vehicle
            </div>
            <div>
              <kbd>Space</kbd> handbrake
            </div>
            <div>
              <kbd>R</kbd> restart mission
            </div>
            <div>
              <kbd>H</kbd> hide help
            </div>
            <div className="controls-note">Police react to hitting pedestrians, ramming police cars, wrecking traffic or entering the restricted area.</div>
          </>
        ) : (
          <div>
            <kbd>H</kbd> show controls
          </div>
        )}
      </div>

      <div className="hud-bottom-right">{state.fps} fps</div>
    </div>
  );
}
