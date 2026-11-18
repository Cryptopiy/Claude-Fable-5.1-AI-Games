import * as THREE from 'three';
import { approach, clamp, safeNum, wrapAngle } from '../core/mathUtils';
import type { OBB } from '../physics/collision';
import { createCarMesh, type CarMeshParts } from '../render/Models';
import { VEHICLE_SPECS, type VehicleKind, type VehicleSpec } from './VehicleSpecs';
import type { TrafficDriverState } from '../ai/TrafficAI';
import type { PoliceDriverState } from '../ai/PoliceAI';

export type DriverKind = 'none' | 'player' | 'ai';

let nextVehicleId = 1;

export class Vehicle {
  readonly id = nextVehicleId++;
  readonly spec: VehicleSpec;
  readonly isPolice: boolean;
  isMissionCar = false;

  x: number;
  z: number;
  yaw: number;
  vx = 0;
  vz = 0;
  speedFwd = 0;
  visualY = 0;

  // controller inputs (set every frame by the player or an AI driver)
  throttle = 0;
  steer = 0;
  handbrake = false;

  driver: DriverKind = 'none';
  ai: TrafficDriverState | PoliceDriverState | null = null;
  damage = 0;
  lastImpact = 0;
  sirenOn = false;

  readonly mesh: THREE.Group;
  private readonly parts: CarMeshParts;
  private wheelSpin = 0;
  private currentSteerVisual = 0;
  private readonly obbCache: OBB;

  constructor(kind: VehicleKind, x: number, z: number, yaw: number, color: number) {
    this.spec = VEHICLE_SPECS[kind];
    this.isPolice = kind === 'police';
    this.x = x;
    this.z = z;
    this.yaw = yaw;
    this.parts = createCarMesh(this.spec, color, this.isPolice);
    this.mesh = this.parts.group;
    this.obbCache = { x, z, hx: this.spec.hx, hz: this.spec.hz, angle: yaw };
    this.syncMesh(0, 0);
  }

  get obb(): OBB {
    this.obbCache.x = this.x;
    this.obbCache.z = this.z;
    this.obbCache.angle = this.yaw;
    return this.obbCache;
  }

  get speed(): number {
    return Math.hypot(this.vx, this.vz);
  }

  forwardX(): number {
    return Math.sin(this.yaw);
  }
  forwardZ(): number {
    return Math.cos(this.yaw);
  }
  rightX(): number {
    return Math.cos(this.yaw);
  }
  rightZ(): number {
    return -Math.sin(this.yaw);
  }

  /** Arcade car model: separate longitudinal / lateral velocity, bicycle steering. */
  updatePhysics(dt: number): void {
    const s = this.spec;
    const fx = this.forwardX();
    const fz = this.forwardZ();
    const rx = this.rightX();
    const rz = this.rightZ();

    let vF = this.vx * fx + this.vz * fz;
    let vL = this.vx * rx + this.vz * rz;

    const t = clamp(this.throttle, -1, 1);
    if (t > 0) {
      if (vF < -0.3) vF += s.brake * t * dt; // braking out of reverse
      else vF += s.accel * t * dt;
    } else if (t < 0) {
      if (vF > 0.3) vF += s.brake * t * dt; // braking
      else vF += s.accel * 0.55 * t * dt; // reverse
    }
    if (this.handbrake) vF = approach(vF, 0, s.brake * 1.1 * dt);

    // aerodynamic drag + rolling resistance
    vF -= vF * s.drag * dt;
    vF = approach(vF, 0, 1.4 * dt);
    vF = clamp(vF, -s.maxSpeed * 0.4, s.maxSpeed);

    // lateral grip (tyres) - weaker while the handbrake is on so the car can slide
    const grip = this.handbrake ? 2.2 : 9;
    vL *= Math.max(0, 1 - grip * dt);

    // steering: less steering angle at speed, turning rate depends on speed (bicycle model)
    const speedFactor = 1 / (1 + Math.abs(vF) / 16);
    const steerAngle = clamp(this.steer, -1, 1) * s.maxSteer * speedFactor;
    const wheelBase = s.hz * 1.55;
    const yawRate = (vF / wheelBase) * Math.tan(steerAngle);
    this.yaw = wrapAngle(this.yaw + yawRate * dt);

    this.vx = fx * vF + rx * vL;
    this.vz = fz * vF + rz * vL;
    this.speedFwd = vF;

    const nx = this.x + this.vx * dt;
    const nz = this.z + this.vz * dt;
    this.x = safeNum(nx, this.x);
    this.z = safeNum(nz, this.z);
    if (!Number.isFinite(this.vx) || !Number.isFinite(this.vz)) {
      this.vx = 0;
      this.vz = 0;
    }
    if (!Number.isFinite(this.yaw)) this.yaw = 0;
    this.currentSteerVisual += (steerAngle - this.currentSteerVisual) * Math.min(1, dt * 10);
  }

  syncMesh(dt: number, time: number): void {
    this.mesh.position.set(this.x, this.visualY, this.z);
    this.mesh.rotation.y = this.yaw;

    this.wheelSpin += (this.speedFwd / 0.38) * dt;
    for (const w of this.parts.wheelsAll) {
      w.rotation.x = this.wheelSpin;
    }
    for (const w of this.parts.wheelsFront) {
      w.rotation.y = this.currentSteerVisual;
    }

    const braking = (this.throttle < 0 && this.speedFwd > 0.3) || this.handbrake;
    this.parts.brakeMat.emissiveIntensity = braking ? 2.2 : 0.4;

    if (this.parts.sirenRed && this.parts.sirenBlue) {
      if (this.sirenOn) {
        const phase = Math.floor(time * 6) % 2 === 0;
        this.parts.sirenRed.emissiveIntensity = phase ? 3 : 0.1;
        this.parts.sirenBlue.emissiveIntensity = phase ? 0.1 : 3;
      } else {
        this.parts.sirenRed.emissiveIntensity = 0.2;
        this.parts.sirenBlue.emissiveIntensity = 0.2;
      }
    }
  }

  setColor(color: number): void {
    this.parts.bodyMat.color.setHex(color);
  }
}
