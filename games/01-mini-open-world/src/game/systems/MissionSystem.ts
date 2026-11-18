import * as THREE from 'three';
import type { Player } from '../entities/Player';
import type { Vehicle } from '../entities/Vehicle';
import { createMarker, type MarkerParts } from '../render/Models';
import { CURB_HEIGHT } from '../world/constants';

export type MissionState = 'idle' | 'get_car' | 'drive' | 'complete' | 'failed';

export interface MissionInfo {
  state: MissionState;
  objective: string;
  timeLeft: number | null;
  banner: string | null;
}

const TIME_LIMIT = 110;

/**
 * "Courier run": reach the depot marker, take the marked van, deliver it to the harbor warehouse.
 */
export class MissionSystem {
  state: MissionState = 'idle';
  private timeLeft = TIME_LIMIT;
  private bannerTimer = 0;
  private banner: string | null = null;
  private completions = 0;

  private readonly startMarker: MarkerParts;
  private readonly endMarker: MarkerParts;
  private readonly carMarker: MarkerParts;
  private readonly vanHome: { x: number; z: number; yaw: number };

  constructor(
    scene: THREE.Scene,
    private readonly start: { x: number; z: number },
    private readonly end: { x: number; z: number },
    private readonly van: Vehicle,
  ) {
    this.startMarker = createMarker(0xffd600);
    this.startMarker.group.position.set(start.x, CURB_HEIGHT, start.z);
    this.endMarker = createMarker(0x00e676, 3);
    this.endMarker.group.position.set(end.x, CURB_HEIGHT, end.z);
    // the car marker is only the floating arrow + beam (no ring on the ground)
    this.carMarker = createMarker(0xff9100, 1.2, false);
    scene.add(this.startMarker.group, this.endMarker.group, this.carMarker.group);
    this.vanHome = { x: van.x, z: van.z, yaw: van.yaw };
    van.isMissionCar = true;
    this.applyVisibility();
  }

  private applyVisibility(): void {
    this.startMarker.group.visible = this.state === 'idle';
    this.carMarker.group.visible = this.state === 'get_car';
    this.endMarker.group.visible = this.state === 'drive';
  }

  private setBanner(text: string, seconds: number): void {
    this.banner = text;
    this.bannerTimer = seconds;
  }

  restart(player: Player): void {
    // put the van back to the depot; if the player is inside it they come along
    this.van.x = this.vanHome.x;
    this.van.z = this.vanHome.z;
    this.van.yaw = this.vanHome.yaw;
    this.van.vx = 0;
    this.van.vz = 0;
    this.van.damage = 0;
    if (player.vehicle === this.van) {
      player.x = this.van.x;
      player.z = this.van.z;
    }
    this.state = 'idle';
    this.timeLeft = TIME_LIMIT;
    this.setBanner('Mission reset', 1.5);
    this.applyVisibility();
  }

  /** Called when the player is arrested. */
  onBusted(): void {
    if (this.state === 'get_car' || this.state === 'drive') {
      this.state = 'failed';
      this.setBanner('MISSION FAILED - BUSTED', 4);
      this.applyVisibility();
    }
  }

  update(dt: number, player: Player, time: number): void {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0 && this.state !== 'complete' && this.state !== 'failed') this.banner = null;
    }

    const px = player.worldX;
    const pz = player.worldZ;

    switch (this.state) {
      case 'idle': {
        if (Math.hypot(px - this.start.x, pz - this.start.z) < 3) {
          this.state = player.vehicle === this.van ? 'drive' : 'get_car';
          this.timeLeft = TIME_LIMIT;
          this.setBanner('MISSION STARTED: Courier run', 2.5);
          this.applyVisibility();
        }
        break;
      }
      case 'get_car': {
        if (player.vehicle === this.van) {
          this.state = 'drive';
          this.setBanner('Deliver the van to the Harbor Warehouse', 2.5);
          this.applyVisibility();
        }
        break;
      }
      case 'drive': {
        this.timeLeft -= dt;
        if (player.vehicle === this.van && Math.hypot(px - this.end.x, pz - this.end.z) < 4 && this.van.speed < 4) {
          this.state = 'complete';
          this.completions += 1;
          this.setBanner(`MISSION COMPLETE  (${Math.ceil(TIME_LIMIT - this.timeLeft)}s)`, 6);
          this.applyVisibility();
        } else if (this.timeLeft <= 0) {
          this.state = 'failed';
          this.setBanner('MISSION FAILED - Out of time', 5);
          this.applyVisibility();
        }
        break;
      }
      default:
        break;
    }

    // marker animation
    const bob = Math.sin(time * 3) * 0.3;
    for (const m of [this.startMarker, this.endMarker, this.carMarker]) {
      if (!m.group.visible) continue;
      m.group.rotation.y = time * 0.8;
      m.cone.position.y = 3.6 + bob;
    }
    if (this.carMarker.group.visible) {
      this.carMarker.group.position.set(this.van.x, this.van.visualY + 0.2, this.van.z);
    }
  }

  get info(): MissionInfo {
    let objective: string;
    switch (this.state) {
      case 'idle':
        objective = this.completions > 0 ? 'Return to the yellow marker at the Dispatch Depot to replay the mission' : 'Walk to the yellow marker at the Dispatch Depot';
        break;
      case 'get_car':
        objective = 'Get in the marked orange delivery van';
        break;
      case 'drive':
        objective = 'Deliver the van to the green marker at the Harbor Warehouse (east side)';
        break;
      case 'complete':
        objective = 'Delivered! Press R to replay the mission';
        break;
      case 'failed':
        objective = 'Mission failed. Press R to restart';
        break;
    }
    return {
      state: this.state,
      objective,
      timeLeft: this.state === 'drive' ? Math.max(0, this.timeLeft) : null,
      banner: this.banner,
    };
  }
}
