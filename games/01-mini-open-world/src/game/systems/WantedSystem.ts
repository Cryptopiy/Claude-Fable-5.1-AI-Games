import type { Player } from '../entities/Player';
import type { Vehicle } from '../entities/Vehicle';
import type { CollisionEvent } from '../physics/CollisionSystem';
import type { Rect } from '../world/CityMap';

export interface WantedInfo {
  level: number;
  message: string;
  escapeProgress: number; // 0..1 how close the player is to losing the current star
  busted: boolean;
}

const MAX_LEVEL = 3;
const ESCAPE_DISTANCE = 42;
const ESCAPE_TIME = 14;
const LONG_CHASE_TIME = 75;

/**
 * Tracks the wanted level, decides what counts as a crime and controls the police fleet.
 */
export class WantedSystem {
  level = 0;
  message = '';
  private messageTimer = 0;
  private escapeTimer = 0;
  private chaseTimer = 0;
  private vehicleHits: number[] = [];
  private restrictedFlag = false;
  private restrictedCooldown = 0;
  private bustTimer = 0;
  busted = false;
  private bustCooldown = 0;

  constructor(
    private readonly police: Vehicle[],
    private readonly restricted: Rect,
  ) {}

  private addWanted(amount: number, reason: string): void {
    if (this.bustCooldown > 0) return;
    this.level = Math.min(MAX_LEVEL, this.level + amount);
    this.message = reason;
    this.messageTimer = 3.5;
    this.escapeTimer = 0;
  }

  /** Feed collision events from the current step. */
  handleEvents(events: CollisionEvent[], player: Player, time: number): void {
    for (const e of events) {
      switch (e.type) {
        case 'vehicle-ped':
          if (e.vehicle.driver === 'player') this.addWanted(1, 'You hit a pedestrian!');
          break;
        case 'vehicle-vehicle': {
          const playerCar = player.vehicle;
          if (!playerCar) break;
          if (e.a !== playerCar && e.b !== playerCar) break;
          const other = e.a === playerCar ? e.b : e.a;
          if (other.isPolice && e.impact > 4) {
            this.addWanted(1, 'You rammed a police car!');
          } else if (!other.isPolice && e.impact > 5) {
            this.vehicleHits.push(time);
            this.vehicleHits = this.vehicleHits.filter((t) => time - t < 25);
            if (this.vehicleHits.length >= 3) {
              this.vehicleHits.length = 0;
              this.addWanted(1, 'Reckless driving: multiple vehicles damaged!');
            }
          }
          break;
        }
        default:
          break;
      }
    }
  }

  update(dt: number, player: Player, playerX: number, playerZ: number): void {
    this.busted = false;
    if (this.messageTimer > 0) this.messageTimer -= dt;
    else if (this.level === 0) this.message = '';
    if (this.bustCooldown > 0) this.bustCooldown -= dt;

    // restricted area trespassing
    const r = this.restricted;
    const inside = playerX > r.minX && playerX < r.maxX && playerZ > r.minZ && playerZ < r.maxZ;
    if (inside) {
      if (!this.restrictedFlag && this.restrictedCooldown <= 0) {
        this.restrictedFlag = true;
        this.addWanted(1, 'Trespassing in a restricted area!');
      }
    } else if (this.restrictedFlag) {
      this.restrictedFlag = false;
      this.restrictedCooldown = 12;
    }
    if (this.restrictedCooldown > 0) this.restrictedCooldown -= dt;

    // police fleet activation
    for (let k = 0; k < this.police.length; k++) {
      const car = this.police[k];
      const st = car.ai;
      if (!st || st.kind !== 'police') continue;
      const shouldChase = k < this.level;
      if (shouldChase && st.state !== 'pursue') {
        st.state = 'pursue';
        st.repathTimer = 0;
      } else if (!shouldChase && st.state === 'pursue') {
        st.state = 'return';
        st.repathTimer = 0;
      }
      if (st.state === 'return' && Math.hypot(car.x - st.home.x, car.z - st.home.z) < 2.5 && car.speed < 1.5) {
        st.state = 'idle';
        car.vx = 0;
        car.vz = 0;
      }
    }

    if (this.level === 0) {
      this.escapeTimer = 0;
      this.chaseTimer = 0;
      this.bustTimer = 0;
      return;
    }

    // escape logic: lose a star when no active police car is close for a while
    let nearest = Infinity;
    for (const car of this.police) {
      const st = car.ai;
      if (!st || st.kind !== 'police' || st.state !== 'pursue') continue;
      const d = Math.hypot(car.x - playerX, car.z - playerZ);
      if (d < nearest) nearest = d;
    }
    if (nearest > ESCAPE_DISTANCE) this.escapeTimer += dt;
    else this.escapeTimer = Math.max(0, this.escapeTimer - dt * 0.6);
    this.chaseTimer += dt;
    if (this.escapeTimer >= ESCAPE_TIME || this.chaseTimer >= LONG_CHASE_TIME) {
      this.level -= 1;
      this.escapeTimer = 0;
      this.chaseTimer = LONG_CHASE_TIME * 0.4;
      this.message = this.level > 0 ? 'Wanted level decreased' : 'You lost the police';
      this.messageTimer = 3;
    }

    // busted check: police stopped next to a slow / on-foot player
    const playerSlow = player.onFoot || (player.vehicle ? player.vehicle.speed < 2.5 : true);
    if (nearest < 5.5 && playerSlow) this.bustTimer += dt;
    else this.bustTimer = Math.max(0, this.bustTimer - dt);
    if (this.bustTimer > 2.2) {
      this.bustTimer = 0;
      this.busted = true;
      this.level = 0;
      this.escapeTimer = 0;
      this.chaseTimer = 0;
      this.vehicleHits.length = 0;
      this.message = 'BUSTED';
      this.messageTimer = 4;
      this.bustCooldown = 5;
    }
  }

  get info(): WantedInfo {
    return {
      level: this.level,
      message: this.message,
      escapeProgress: Math.min(1, this.escapeTimer / ESCAPE_TIME),
      busted: this.busted,
    };
  }

  reset(): void {
    this.level = 0;
    this.message = '';
    this.escapeTimer = 0;
    this.chaseTimer = 0;
    this.vehicleHits.length = 0;
    this.bustTimer = 0;
  }
}
