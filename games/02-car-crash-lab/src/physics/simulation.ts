import { OBSTACLES } from './obstacles';
import type {
  CrashResult,
  DamageSeverity,
  DamageZone,
  ImpactData,
  SimulationConfig,
  SimulationSnapshot,
  Vec2,
} from '../types';

const CAR_LENGTH = 4.5;
const CAR_WIDTH = 1.86;
const START_DISTANCE = 25;
const MAX_RUN_TIME = 13;
const EPSILON = 1e-6;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const length = (v: Vec2) => Math.hypot(v.x, v.z);

const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.z * b.z;

const scale = (v: Vec2, factor: number): Vec2 => ({
  x: v.x * factor,
  z: v.z * factor,
});

const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, z: a.z + b.z });

const finiteVec = (v: Vec2): Vec2 => ({
  x: Number.isFinite(v.x) ? clamp(v.x, -120, 120) : 0,
  z: Number.isFinite(v.z) ? clamp(v.z, -120, 120) : 0,
});

export function severityForDamage(damage: number): DamageSeverity {
  if (damage < 20) return 'Minor';
  if (damage < 50) return 'Moderate';
  if (damage < 80) return 'Severe';
  return 'Catastrophic';
}

function damageZone(yaw: number, collisionNormal: Vec2): DamageZone {
  // The normal points from obstacle to vehicle; invert it to locate the contact
  // face in the vehicle's local frame. Steep glancing angles therefore move the
  // damage highlight from the nose to the physically correct left/right side.
  const towardObstacle = {
    x: -collisionNormal.x,
    z: -collisionNormal.z,
  };
  const mag = Math.max(length(towardObstacle), EPSILON);
  const world = scale(towardObstacle, 1 / mag);
  const heading = { x: Math.cos(yaw), z: -Math.sin(yaw) };
  const right = { x: -heading.z, z: heading.x };
  const localForward = dot(world, heading);
  const localRight = dot(world, right);

  if (Math.abs(localForward) >= Math.abs(localRight)) {
    return localForward >= 0 ? 'front' : 'rear';
  }
  return localRight >= 0 ? 'right' : 'left';
}

export class CrashSimulation {
  readonly config: SimulationConfig;
  snapshot: SimulationSnapshot;
  private collided = false;
  private settleTimer = 0;
  private resultEmitted = false;
  private readonly obstacleMass: number;

  constructor(config: SimulationConfig) {
    this.config = { ...config };
    const angle = (config.angleDeg * Math.PI) / 180;
    const direction = { x: Math.cos(angle), z: Math.sin(angle) };
    const speedMs = config.speedKmh / 3.6;
    this.obstacleMass = OBSTACLES[config.obstacleType].massKg;
    this.snapshot = {
      phase: 'ready',
      elapsedS: 0,
      carPosition: scale(direction, -START_DISTANCE),
      carVelocity: scale(direction, speedMs),
      carYaw: -angle,
      carRoll: 0,
      carPitch: 0,
      carAngularVelocity: 0,
      obstaclePosition: { x: 0, z: 0 },
      obstacleVelocity: { x: 0, z: 0 },
      currentSpeedKmh: 0,
      impact: null,
      impactFlash: 0,
    };
  }

  start(): void {
    if (this.snapshot.phase === 'ready') {
      this.snapshot.phase = 'approach';
      this.snapshot.currentSpeedKmh = this.config.speedKmh;
    }
  }

  /**
   * Deterministic fixed-step rigid-body approximation.
   * Collision volumes are oriented car and axis-aligned obstacle boxes projected
   * onto the ground plane. Impulses use relative normal velocity, effective mass,
   * restitution and Coulomb-limited tangential friction.
   */
  step(rawDt: number): CrashResult | null {
    const state = this.snapshot;
    if (state.phase === 'ready' || state.phase === 'complete') return null;

    const dt = clamp(rawDt, 0, 1 / 30);
    state.elapsedS += dt;
    state.impactFlash = Math.max(0, state.impactFlash - dt * 3.2);

    state.carPosition = add(state.carPosition, scale(state.carVelocity, dt));
    state.carYaw += state.carAngularVelocity * dt;
    state.obstaclePosition = add(state.obstaclePosition, scale(state.obstacleVelocity, dt));

    if (!this.collided && this.boxesOverlap()) this.resolveImpact();

    if (this.collided) {
      if (state.impact && state.elapsedS > state.impact.timeS + EPSILON) {
        state.phase = 'settling';
      }
      this.integratePostImpact(dt);
      const carStopped = length(state.carVelocity) < 0.16;
      const obstacleStopped = length(state.obstacleVelocity) < 0.1;
      this.settleTimer = carStopped && obstacleStopped ? this.settleTimer + dt : 0;
    }

    state.carVelocity = finiteVec(state.carVelocity);
    state.obstacleVelocity = finiteVec(state.obstacleVelocity);
    state.carYaw = Number.isFinite(state.carYaw) ? state.carYaw : 0;
    state.currentSpeedKmh = length(state.carVelocity) * 3.6;

    if ((this.collided && this.settleTimer > 0.7) || state.elapsedS >= MAX_RUN_TIME) {
      state.phase = 'complete';
      const finalResult = !this.resultEmitted ? this.makeResult() : null;
      state.carVelocity = { x: 0, z: 0 };
      state.obstacleVelocity = { x: 0, z: 0 };
      state.currentSpeedKmh = 0;
      if (finalResult) {
        this.resultEmitted = true;
        return finalResult;
      }
    }

    return null;
  }

  private boxesOverlap(): boolean {
    const state = this.snapshot;
    const obstacle = OBSTACLES[this.config.obstacleType];
    const cos = Math.abs(Math.cos(state.carYaw));
    const sin = Math.abs(Math.sin(state.carYaw));
    const carHalfX = cos * (CAR_LENGTH / 2) + sin * (CAR_WIDTH / 2);
    const carHalfZ = sin * (CAR_LENGTH / 2) + cos * (CAR_WIDTH / 2);
    const dx = Math.abs(state.carPosition.x - state.obstaclePosition.x);
    const dz = Math.abs(state.carPosition.z - state.obstaclePosition.z);
    return dx <= carHalfX + obstacle.widthM / 2 && dz <= carHalfZ + obstacle.depthM / 2;
  }

  private resolveImpact(): void {
    const state = this.snapshot;
    const obstacle = OBSTACLES[this.config.obstacleType];
    const vehicleMass = this.config.massKg;
    const impactSpeed = length(state.carVelocity);

    // The shallowest penetration axis supplies the collision normal. All supplied
    // barriers are wide in Z, so typical runs correctly resolve against the X face.
    const dx = state.carPosition.x - state.obstaclePosition.x;
    const dz = state.carPosition.z - state.obstaclePosition.z;
    const normal: Vec2 = Math.abs(dx) / obstacle.widthM > Math.abs(dz) / obstacle.depthM
      ? { x: Math.sign(dx) || -1, z: 0 }
      : { x: 0, z: Math.sign(dz) || -1 };
    const tangent = { x: -normal.z, z: normal.x };
    const relative = {
      x: state.carVelocity.x - state.obstacleVelocity.x,
      z: state.carVelocity.z - state.obstacleVelocity.z,
    };
    const normalVelocity = dot(relative, normal);
    if (normalVelocity >= 0) return;

    const invVehicle = 1 / vehicleMass;
    const invObstacle = Number.isFinite(this.obstacleMass) ? 1 / this.obstacleMass : 0;
    const invMassSum = Math.max(invVehicle + invObstacle, EPSILON);
    const normalImpulse = -(1 + obstacle.restitution) * normalVelocity / invMassSum;

    const tangentVelocity = dot(relative, tangent);
    const freeFrictionImpulse = -tangentVelocity / invMassSum;
    const maxFrictionImpulse = obstacle.friction * normalImpulse;
    const frictionImpulse = clamp(
      freeFrictionImpulse,
      -maxFrictionImpulse,
      maxFrictionImpulse,
    );
    const totalImpulse = add(scale(normal, normalImpulse), scale(tangent, frictionImpulse));

    state.carVelocity = add(state.carVelocity, scale(totalImpulse, invVehicle));
    if (invObstacle > 0) {
      state.obstacleVelocity = add(
        state.obstacleVelocity,
        scale(totalImpulse, -invObstacle),
      );
    }

    const effectiveMass = 1 / invMassSum;
    const normalApproachSpeed = -normalVelocity;
    const energyDissipated =
      0.5 * effectiveMass * normalApproachSpeed ** 2 * (1 - obstacle.restitution ** 2);
    // 430 kJ is a simplified passenger-cell crash-energy scale. The exponential
    // curve prevents unbounded values while preserving speed-squared sensitivity.
    const damage = clamp(100 * (1 - Math.exp(-energyDissipated / 430_000)), 0, 100);
    const zone = damageZone(state.carYaw, normal);

    // Off-axis impulse produces yaw. This is an explicit angular response tied to
    // angle, impulse and vehicle inertia rather than a visual-only rotation.
    const angleFactor = Math.sin((this.config.angleDeg * Math.PI) / 180);
    const inertia = (vehicleMass * (CAR_LENGTH ** 2 + CAR_WIDTH ** 2)) / 12;
    const leverArm = CAR_LENGTH * 0.38;
    const angularImpulse = normalImpulse * leverArm * angleFactor;
    state.carAngularVelocity = clamp(angularImpulse / inertia, -2.8, 2.8);
    state.carPitch = clamp(-(damage / 100) * 0.09, -0.09, 0);
    state.carRoll = clamp(-angleFactor * (damage / 100) * 0.14, -0.14, 0.14);

    const impact: ImpactData = {
      speedKmh: impactSpeed * 3.6,
      normalSpeedMs: normalApproachSpeed,
      impulseNs: normalImpulse,
      forceKn: normalImpulse / obstacle.impactDurationS / 1000,
      damagePct: damage,
      severity: severityForDamage(damage),
      zone,
      energyBeforeKj: (0.5 * vehicleMass * impactSpeed ** 2) / 1000,
      energyDissipatedKj: energyDissipated / 1000,
      timeS: state.elapsedS,
    };

    state.impact = impact;
    state.impactFlash = clamp(0.2 + damage / 90, 0.2, 1);
    state.phase = 'impact';
    this.collided = true;
  }

  private integratePostImpact(dt: number): void {
    const state = this.snapshot;
    const obstacle = OBSTACLES[this.config.obstacleType];
    const carSpeed = length(state.carVelocity);
    const obstacleSpeed = length(state.obstacleVelocity);

    // Rolling/sliding resistance plus aerodynamic drag. Deceleration is clamped so
    // velocity cannot reverse as a numerical artifact at low speed.
    if (carSpeed > EPSILON) {
      const deceleration = 3.1 + 0.018 * carSpeed ** 2;
      const nextSpeed = Math.max(0, carSpeed - deceleration * dt);
      state.carVelocity = scale(state.carVelocity, nextSpeed / carSpeed);
    }
    if (obstacleSpeed > EPSILON) {
      const deceleration = 5.4 * obstacle.friction;
      const nextSpeed = Math.max(0, obstacleSpeed - deceleration * dt);
      state.obstacleVelocity = scale(state.obstacleVelocity, nextSpeed / obstacleSpeed);
    }

    state.carAngularVelocity *= Math.exp(-2.25 * dt);
    state.carRoll *= Math.exp(-2.8 * dt);
    state.carPitch *= Math.exp(-2.8 * dt);
    if (Math.abs(state.carAngularVelocity) < 0.006) state.carAngularVelocity = 0;
  }

  private makeResult(): CrashResult {
    const state = this.snapshot;
    const impact = state.impact;
    const obstacle = OBSTACLES[this.config.obstacleType];
    const energyAfter =
      0.5 * this.config.massKg * length(state.carVelocity) ** 2 +
      (Number.isFinite(this.obstacleMass)
        ? 0.5 * this.obstacleMass * length(state.obstacleVelocity) ** 2
        : 0);

    return {
      id: Date.now(),
      timestamp: Date.now(),
      initialSpeedKmh: this.config.speedKmh,
      impactSpeedKmh: impact?.speedKmh ?? 0,
      massKg: this.config.massKg,
      angleDeg: this.config.angleDeg,
      obstacleType: this.config.obstacleType,
      forceKn: impact?.forceKn ?? 0,
      damagePct: impact?.damagePct ?? 0,
      severity: impact?.severity ?? 'Minor',
      damageZone: impact?.zone ?? 'front',
      finalX: state.carPosition.x,
      finalY: state.carPosition.z,
      finalYawDeg: (-state.carYaw * 180) / Math.PI,
      energyBeforeKj: impact?.energyBeforeKj ?? 0,
      energyAfterKj: energyAfter / 1000,
      impactDurationS: obstacle.impactDurationS,
    };
  }
}
