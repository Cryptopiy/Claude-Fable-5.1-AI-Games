import type { CSSProperties } from 'react';
import { obstacleList } from '../physics/obstacles';
import type { ObstacleType, SimulationConfig } from '../types';

interface ControlPanelProps {
  config: SimulationConfig;
  disabled: boolean;
  onChange: (patch: Partial<SimulationConfig>) => void;
  onRun: () => void;
  onReset: () => void;
}

interface ParameterSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  disabled: boolean;
  onChange: (value: number) => void;
}

function ParameterSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  disabled,
  onChange,
}: ParameterSliderProps) {
  const percent = ((value - min) / (max - min)) * 100;
  const sliderStyle = { '--slider-value': `${percent}%` } as CSSProperties;
  return (
    <label className="parameter-control">
      <span className="parameter-label">
        <span>{label}</span>
        <strong>{value.toLocaleString()} <small>{unit}</small></strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        style={sliderStyle}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="range-limits"><span>{min}</span><span>{max}</span></span>
    </label>
  );
}

export function ControlPanel({
  config,
  disabled,
  onChange,
  onRun,
  onReset,
}: ControlPanelProps) {
  return (
    <aside className="control-panel panel">
      <div className="panel-heading">
        <span className="eyebrow">INPUT PARAMETERS</span>
        <span className="panel-index">01</span>
      </div>

      <div className="parameter-stack">
        <ParameterSlider
          label="Vehicle speed"
          value={config.speedKmh}
          min={10}
          max={200}
          step={1}
          unit="km/h"
          disabled={disabled}
          onChange={(speedKmh) => onChange({ speedKmh })}
        />
        <ParameterSlider
          label="Vehicle mass"
          value={config.massKg}
          min={700}
          max={3000}
          step={50}
          unit="kg"
          disabled={disabled}
          onChange={(massKg) => onChange({ massKg })}
        />
        <ParameterSlider
          label="Collision angle"
          value={config.angleDeg}
          min={-60}
          max={60}
          step={1}
          unit="°"
          disabled={disabled}
          onChange={(angleDeg) => onChange({ angleDeg })}
        />
      </div>

      <fieldset className="obstacle-selector" disabled={disabled}>
        <legend>Obstacle type</legend>
        {obstacleList.map((obstacle) => (
          <label
            className={`obstacle-option ${config.obstacleType === obstacle.id ? 'selected' : ''}`}
            key={obstacle.id}
          >
            <input
              type="radio"
              name="obstacle"
              value={obstacle.id}
              checked={config.obstacleType === obstacle.id}
              onChange={() => onChange({ obstacleType: obstacle.id as ObstacleType })}
            />
            <span className={`obstacle-icon obstacle-icon-${obstacle.id}`} aria-hidden="true" />
            <span><strong>{obstacle.shortName}</strong><small>{obstacle.description}</small></span>
            <i className="radio-mark" />
          </label>
        ))}
      </fieldset>

      <label className={`toggle-row ${disabled ? 'disabled' : ''}`}>
        <span><strong>Slow motion</strong><small>28% simulation speed</small></span>
        <input
          type="checkbox"
          checked={config.slowMotion}
          disabled={disabled}
          onChange={(event) => onChange({ slowMotion: event.target.checked })}
        />
        <i aria-hidden="true" />
      </label>

      <div className="action-row">
        <button className="run-button" type="button" disabled={disabled} onClick={onRun}>
          <span className="play-icon" aria-hidden="true" />
          RUN CRASH
        </button>
        <button className="reset-button" type="button" onClick={onReset} aria-label="Reset simulation">
          <span aria-hidden="true">↻</span>
          RESET
        </button>
      </div>
      <p className="control-note">Parameters lock while the rigid-body solver is running.</p>
    </aside>
  );
}
