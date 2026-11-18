import * as THREE from 'three';
import { damp, lerpAngle } from '../core/mathUtils';
import type { Player } from '../entities/Player';

/** Third-person chase camera. Smoothly trails the player on foot or the vehicle they drive. */
export class FollowCamera {
  readonly camera: THREE.PerspectiveCamera;
  yaw = 0;
  private readonly pos = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private initialised = false;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.5, 700);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  snapTo(player: Player): void {
    this.yaw = player.vehicle ? player.vehicle.yaw : player.yaw;
    this.initialised = false;
    this.update(player, 1 / 60);
  }

  update(player: Player, dt: number): void {
    const v = player.vehicle;
    let targetYaw: number;
    let dist: number;
    let height: number;
    let lookAhead: number;
    let lookHeight: number;
    let follow: number;

    if (v) {
      const sp = Math.hypot(v.vx, v.vz);
      targetYaw = v.yaw;
      // when reversing look "behind" only slightly: keep the same orientation, pull camera further
      dist = 9 + sp * 0.12;
      height = 4 + sp * 0.04;
      lookAhead = 3;
      lookHeight = 1.2;
      follow = 3.5;
    } else {
      targetYaw = player.yaw;
      dist = 6.5;
      height = 3.2;
      lookAhead = 0.5;
      lookHeight = 1.4;
      const moving = Math.hypot(player.vx, player.vz) > 0.5;
      follow = moving ? 2.2 : 0.4;
    }

    this.yaw = lerpAngle(this.yaw, targetYaw, damp(follow, dt));

    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const cx = player.worldX;
    const cz = player.worldZ;
    const cy = v ? v.visualY : player.visualY;

    const desired = new THREE.Vector3(cx - fx * dist, cy + height, cz - fz * dist);
    const lookTarget = new THREE.Vector3(cx + fx * lookAhead, cy + lookHeight, cz + fz * lookAhead);

    if (!this.initialised) {
      this.pos.copy(desired);
      this.look.copy(lookTarget);
      this.initialised = true;
    } else {
      this.pos.lerp(desired, damp(6, dt));
      this.look.lerp(lookTarget, damp(10, dt));
    }
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }
}
