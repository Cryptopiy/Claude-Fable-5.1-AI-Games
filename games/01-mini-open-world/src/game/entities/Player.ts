import * as THREE from 'three';
import { lerpAngle, safeNum } from '../core/mathUtils';
import type { Circle } from '../physics/collision';
import { createHumanoid, type HumanoidParts } from '../render/Models';
import type { Vehicle } from './Vehicle';

export class Player {
  x: number;
  z: number;
  yaw: number;
  vx = 0;
  vz = 0;
  visualY = 0;
  readonly radius = 0.4;
  readonly runSpeed = 6.5;

  vehicle: Vehicle | null = null;

  /** desired movement direction in world space (unit length or zero), set by input handling */
  moveX = 0;
  moveZ = 0;

  readonly mesh: THREE.Group;
  private readonly parts: HumanoidParts;
  private animPhase = 0;
  private readonly circleCache: Circle;

  constructor(x: number, z: number, yaw: number) {
    this.x = x;
    this.z = z;
    this.yaw = yaw;
    this.parts = createHumanoid(0xff7a00, 0x1f3b73, 0, true);
    this.mesh = this.parts.group;
    this.circleCache = { x, z, r: this.radius };
  }

  get circle(): Circle {
    this.circleCache.x = this.x;
    this.circleCache.z = this.z;
    return this.circleCache;
  }

  get onFoot(): boolean {
    return this.vehicle === null;
  }

  /** World position regardless of whether the player is inside a vehicle. */
  get worldX(): number {
    return this.vehicle ? this.vehicle.x : this.x;
  }
  get worldZ(): number {
    return this.vehicle ? this.vehicle.z : this.z;
  }
  get worldVx(): number {
    return this.vehicle ? this.vehicle.vx : this.vx;
  }
  get worldVz(): number {
    return this.vehicle ? this.vehicle.vz : this.vz;
  }

  updateOnFoot(dt: number): void {
    const tx = this.moveX * this.runSpeed;
    const tz = this.moveZ * this.runSpeed;
    const k = Math.min(1, dt * 12);
    this.vx += (tx - this.vx) * k;
    this.vz += (tz - this.vz) * k;
    this.x = safeNum(this.x + this.vx * dt, this.x);
    this.z = safeNum(this.z + this.vz * dt, this.z);
    if (!Number.isFinite(this.vx) || !Number.isFinite(this.vz)) {
      this.vx = 0;
      this.vz = 0;
    }
    const sp = Math.hypot(this.vx, this.vz);
    if (sp > 0.3) this.yaw = lerpAngle(this.yaw, Math.atan2(this.vx, this.vz), Math.min(1, dt * 14));
    this.animPhase += dt * sp * 3.2;
  }

  teleport(x: number, z: number, yaw: number): void {
    this.x = x;
    this.z = z;
    this.yaw = yaw;
    this.vx = 0;
    this.vz = 0;
  }

  syncMesh(): void {
    if (this.vehicle) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;
    this.mesh.position.set(this.x, this.visualY, this.z);
    this.mesh.rotation.y = this.yaw;
    const sp = Math.hypot(this.vx, this.vz);
    const swing = Math.sin(this.animPhase) * Math.min(1, sp / this.runSpeed) * 0.9;
    this.parts.legL.rotation.x = swing;
    this.parts.legR.rotation.x = -swing;
    this.parts.armL.rotation.x = -swing;
    this.parts.armR.rotation.x = swing;
    const marker = this.mesh.getObjectByName('playerMarker');
    if (marker) marker.position.y = 2.25 + Math.sin(this.animPhase * 0.5 + performance.now() * 0.004) * 0.1;
  }
}
