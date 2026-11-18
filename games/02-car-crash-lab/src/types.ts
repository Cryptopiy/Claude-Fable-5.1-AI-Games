export type ObstacleType = 'concrete' | 'heavy' | 'light';
export type DamageZone = 'front' | 'rear' | 'left' | 'right';
export type SimulationPhase = 'ready' | 'approach' | 'impact' | 'settling' | 'complete';

export interface Vec2 {
  x: number;
  z: number;
}

export interface SimulationConfig {
  speedKmh: number;
  massKg: number;
  angleDeg: number;
  obstacleType: ObstacleType;
  slowMotion: boolean;
}

export interface ObstacleDefinition {
  id: ObstacleType;
  name: string;
  shortName: string;
  description: string;
  massKg: number;
  restitution: number;
  friction: number;
  impactDurationS: number;
  widthM: number;
  depthM: number;
  heightM: number;
  color: number;
}

export interface ImpactData {
  speedKmh: number;
  normalSpeedMs: number;
  impulseNs: number;
  forceKn: number;
  damagePct: number;
  severity: DamageSeverity;
  zone: DamageZone;
  energyBeforeKj: number;
  energyDissipatedKj: number;
  timeS: number;
}

export type DamageSeverity = 'Minor' | 'Moderate' | 'Severe' | 'Catastrophic';

export interface SimulationSnapshot {
  phase: SimulationPhase;
  elapsedS: number;
  carPosition: Vec2;
  carVelocity: Vec2;
  carYaw: number;
  carRoll: number;
  carPitch: number;
  carAngularVelocity: number;
  obstaclePosition: Vec2;
  obstacleVelocity: Vec2;
  currentSpeedKmh: number;
  impact: ImpactData | null;
  impactFlash: number;
}

export interface CrashResult {
  id: number;
  timestamp: number;
  initialSpeedKmh: number;
  impactSpeedKmh: number;
  massKg: number;
  angleDeg: number;
  obstacleType: ObstacleType;
  forceKn: number;
  damagePct: number;
  severity: DamageSeverity;
  damageZone: DamageZone;
  finalX: number;
  finalY: number;
  finalYawDeg: number;
  energyBeforeKj: number;
  energyAfterKj: number;
  impactDurationS: number;
}
