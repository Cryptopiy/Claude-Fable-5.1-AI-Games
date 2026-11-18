import * as THREE from 'three';
import { createPoliceDriver, updatePolice } from './ai/PoliceAI';
import { createTrafficDriver, updateTraffic } from './ai/TrafficAI';
import type { AIContext } from './ai/AIContext';
import { mulberry32, pick, randRange, type Rng } from './core/rng';
import { Pedestrian } from './entities/Pedestrian';
import { Player } from './entities/Player';
import { Vehicle } from './entities/Vehicle';
import type { VehicleKind } from './entities/VehicleSpecs';
import { Input } from './input/Input';
import { circleVsObb, type Circle } from './physics/collision';
import { CollisionSystem } from './physics/CollisionSystem';
import { FollowCamera } from './render/FollowCamera';
import { WorldBuilder, groundHeightAt } from './render/WorldBuilder';
import { MissionSystem } from './systems/MissionSystem';
import { WantedSystem } from './systems/WantedSystem';
import { buildCity, type CityData } from './world/CityMap';
import type { HudState } from '../ui/hudState';

const FIXED_DT = 1 / 60;
const MAX_STEPS = 5;
const TRAFFIC_COUNT = 16;
const PEDESTRIAN_COUNT = 48;
const CAR_COLORS = [0xc0392b, 0x2980b9, 0x27ae60, 0xf1c40f, 0x8e44ad, 0xecf0f1, 0x34495e, 0xe67e22, 0x16a085, 0x7f8c8d, 0xbdc3c7];

/**
 * Owns the simulation, the three.js scene and the fixed-step game loop.
 * React only receives lightweight HUD snapshots through `onHud`.
 */
export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: FollowCamera;
  private readonly sun: THREE.DirectionalLight;
  private readonly input = new Input();
  private readonly rng: Rng = mulberry32(2024);

  private readonly city: CityData;
  private readonly vehicles: Vehicle[] = [];
  private readonly police: Vehicle[] = [];
  private readonly pedestrians: Pedestrian[] = [];
  private readonly player: Player;
  private readonly collisions: CollisionSystem;
  private readonly wanted: WantedSystem;
  private readonly mission: MissionSystem;
  private readonly aiCtx: AIContext;

  private raf = 0;
  private lastTime = 0;
  private accumulator = 0;
  private time = 0;
  private hudTimer = 0;
  private fps = 60;
  private showHelp = true;
  private hint = '';
  private running = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onHud: (s: HudState) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene.background = new THREE.Color(0x9fc5e8);
    this.scene.fog = new THREE.Fog(0x9fc5e8, 140, 420);

    const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x5f6b4a, 0.75);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xfff2d9, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 260;
    this.sun.shadow.camera.left = -70;
    this.sun.shadow.camera.right = 70;
    this.sun.shadow.camera.top = 70;
    this.sun.shadow.camera.bottom = -70;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);

    this.city = buildCity(1337);
    this.scene.add(new WorldBuilder(this.city).build());

    // player
    const sp = this.city.playerSpawn;
    this.player = new Player(sp.x, sp.z, sp.yaw);
    this.scene.add(this.player.mesh);

    // parked cars (incl. the mission van)
    let missionVan: Vehicle | null = null;
    for (const pc of this.city.parkedCars) {
      const v = this.addVehicle(pc.kind, pc.x, pc.z, pc.yaw, pc.color ?? pick(this.rng, CAR_COLORS));
      if (pc.mission) missionVan = v;
    }
    if (!missionVan) {
      missionVan = this.addVehicle('van', this.city.missionStart.x + 8, this.city.missionStart.z, 0, 0xe67e22);
    }

    // police fleet
    for (const slot of this.city.policeSlots) {
      const car = this.addVehicle('police', slot.x, slot.z, slot.yaw, 0xffffff);
      car.driver = 'ai';
      car.ai = createPoliceDriver(slot);
      this.police.push(car);
    }

    this.spawnTraffic();
    this.spawnPedestrians();

    this.collisions = new CollisionSystem(this.city.colliders);
    this.wanted = new WantedSystem(this.police, this.city.restrictedZone);
    this.mission = new MissionSystem(this.scene, this.city.missionStart, this.city.missionEnd, missionVan);

    this.aiCtx = {
      roads: this.city.roads,
      vehicles: this.vehicles,
      pedestrians: this.pedestrians,
      player: this.player,
      statics: this.city.colliders,
      rng: this.rng,
      time: 0,
    };

    this.camera = new FollowCamera(this.viewportAspect());
    this.camera.snapTo(this.player);
    this.resize();
  }

  // ---------------------------------------------------------------- lifecycle

  start(): void {
    if (this.running) return;
    this.running = true;
    this.input.attach();
    window.addEventListener('resize', this.resize);
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  dispose(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.input.detach();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const m = o.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }
    });
    this.renderer.dispose();
  }

  private viewportAspect(): number {
    return window.innerWidth / Math.max(1, window.innerHeight);
  }

  private readonly resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.camera.resize(w / Math.max(1, h));
  };

  // ---------------------------------------------------------------- spawning

  private addVehicle(kind: VehicleKind, x: number, z: number, yaw: number, color: number): Vehicle {
    const v = new Vehicle(kind, x, z, yaw, color);
    this.vehicles.push(v);
    this.scene.add(v.mesh);
    return v;
  }

  private spawnTraffic(): void {
    const roads = this.city.roads;
    const kinds: VehicleKind[] = ['sedan', 'sedan', 'hatch', 'taxi', 'pickup', 'van'];
    let attempts = 0;
    let spawned = 0;
    while (spawned < TRAFFIC_COUNT && attempts < 400) {
      attempts++;
      const from = Math.floor(this.rng() * roads.nodes.length);
      const nbs = roads.nodes[from].neighbors;
      const to = nbs[Math.floor(this.rng() * nbs.length)];
      const t = randRange(this.rng, 0.2, 0.8);
      const p = roads.lanePoint(from, to, t);
      let blocked = false;
      for (const v of this.vehicles) {
        if (Math.hypot(v.x - p.x, v.z - p.z) < 9) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      if (Math.hypot(p.x - this.player.x, p.z - this.player.z) < 15) continue;
      const d = roads.dir(from, to);
      const kind = pick(this.rng, kinds);
      const car = this.addVehicle(kind, p.x, p.z, Math.atan2(d.x, d.z), pick(this.rng, CAR_COLORS));
      car.driver = 'ai';
      car.ai = createTrafficDriver(roads, from, to, randRange(this.rng, 9, 14));
      spawned++;
    }
  }

  private spawnPedestrians(): void {
    const g = this.city.sidewalks;
    for (let k = 0; k < PEDESTRIAN_COUNT; k++) {
      let node = Math.floor(this.rng() * g.nodes.length);
      // keep the very first pedestrians away from the spawn point so the player is not swarmed
      for (let tries = 0; tries < 5; tries++) {
        const n = g.nodes[node];
        if (Math.hypot(n.x - this.player.x, n.z - this.player.z) > 10) break;
        node = Math.floor(this.rng() * g.nodes.length);
      }
      const p = new Pedestrian(this.rng, g, node);
      this.pedestrians.push(p);
      this.scene.add(p.mesh);
    }
  }

  // ---------------------------------------------------------------- loop

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);

    let frameDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (!Number.isFinite(frameDt) || frameDt < 0) frameDt = 0;
    frameDt = Math.min(frameDt, 0.1);
    this.fps += (1 / Math.max(frameDt, 1e-3) - this.fps) * 0.05;

    this.handleOneShotInput();

    this.accumulator += frameDt;
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS) {
      this.step(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps++;
    }
    if (steps === MAX_STEPS) this.accumulator = 0;

    this.updateVisuals(frameDt);
    this.camera.update(this.player, frameDt);
    this.updateSun();
    this.renderer.render(this.scene, this.camera.camera);

    this.hudTimer += frameDt;
    if (this.hudTimer > 0.1) {
      this.hudTimer = 0;
      this.publishHud();
    }
    this.input.endFrame();
  };

  private handleOneShotInput(): void {
    if (this.input.wasPressed('KeyE')) {
      if (this.player.vehicle) this.tryExitVehicle();
      else this.tryEnterVehicle();
    }
    if (this.input.wasPressed('KeyR')) {
      this.mission.restart(this.player);
    }
    if (this.input.wasPressed('KeyH')) {
      this.showHelp = !this.showHelp;
    }
  }

  private step(dt: number): void {
    this.time += dt;
    this.aiCtx.time = this.time;

    this.applyPlayerInput();

    // AI drivers
    for (const v of this.vehicles) {
      if (v.driver === 'ai' && v.ai) {
        if (v.ai.kind === 'traffic') updateTraffic(v, dt, this.aiCtx);
        else updatePolice(v, dt, this.aiCtx);
      } else if (v.driver === 'none') {
        v.throttle = 0;
        v.steer = 0;
        v.handbrake = true;
      }
    }

    // pedestrians
    const pv = this.player.vehicle;
    const dangerous = pv !== null && pv.speed > 7;
    for (const p of this.pedestrians) {
      if (dangerous && pv && (p.state === 'walk' || p.state === 'wait')) {
        const d = Math.hypot(p.x - pv.x, p.z - pv.z);
        if (d < 8) p.startFlee(pv.x, pv.z, 3);
      }
      p.update(dt, this.city.sidewalks, this.rng);
    }

    // integrate
    if (this.player.onFoot) this.player.updateOnFoot(dt);
    for (const v of this.vehicles) v.updatePhysics(dt);

    // collisions
    this.collisions.resolve(this.vehicles, this.pedestrians, this.player);
    if (this.player.vehicle) {
      this.player.x = this.player.vehicle.x;
      this.player.z = this.player.vehicle.z;
    }

    // gameplay systems
    this.wanted.handleEvents(this.collisions.events, this.player, this.time);
    this.wanted.update(dt, this.player, this.player.worldX, this.player.worldZ);
    if (this.wanted.busted) this.handleBusted();
    this.mission.update(dt, this.player, this.time);

    // ground height (curbs) - smoothed so the bump is visible but not jarring
    for (const v of this.vehicles) {
      v.visualY += (groundHeightAt(v.x, v.z) - v.visualY) * Math.min(1, dt * 12);
    }
    for (const p of this.pedestrians) {
      p.visualY += (groundHeightAt(p.x, p.z) - p.visualY) * Math.min(1, dt * 14);
    }
    this.player.visualY += (groundHeightAt(this.player.x, this.player.z) - this.player.visualY) * Math.min(1, dt * 14);
  }

  private applyPlayerInput(): void {
    const inp = this.input;
    const v = this.player.vehicle;
    if (v) {
      v.throttle = inp.forward ? 1 : inp.back ? -1 : 0;
      v.steer = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      v.handbrake = inp.brake;
      this.player.moveX = 0;
      this.player.moveZ = 0;
      return;
    }
    // camera-relative movement on foot
    const yaw = this.camera.yaw;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    let mx = 0;
    let mz = 0;
    if (inp.forward) {
      mx += fx;
      mz += fz;
    }
    if (inp.back) {
      mx -= fx;
      mz -= fz;
    }
    if (inp.right) {
      mx += rx;
      mz += rz;
    }
    if (inp.left) {
      mx -= rx;
      mz -= rz;
    }
    const len = Math.hypot(mx, mz);
    if (len > 1e-6) {
      mx /= len;
      mz /= len;
    }
    this.player.moveX = mx;
    this.player.moveZ = mz;
  }

  // ---------------------------------------------------------------- vehicles: enter / exit

  private findEnterableVehicle(): Vehicle | null {
    const probe: Circle = { x: this.player.x, z: this.player.z, r: this.player.radius + 1.7 };
    let best: Vehicle | null = null;
    let bestD = Infinity;
    for (const v of this.vehicles) {
      if (v.isPolice) continue;
      if (v.speed > 2) continue;
      if (!circleVsObb(probe, v.obb)) continue;
      const d = Math.hypot(v.x - this.player.x, v.z - this.player.z);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  private tryEnterVehicle(): void {
    const v = this.findEnterableVehicle();
    if (!v) return;
    v.ai = null;
    v.driver = 'player';
    v.handbrake = false;
    this.player.vehicle = v;
    this.player.x = v.x;
    this.player.z = v.z;
    this.player.vx = 0;
    this.player.vz = 0;
    this.camera.yaw = v.yaw;
  }

  private tryExitVehicle(force = false): void {
    const v = this.player.vehicle;
    if (!v) return;
    if (!force && v.speed > 3) return;

    const fx = v.forwardX();
    const fz = v.forwardZ();
    const rx = v.rightX();
    const rz = v.rightZ();
    const side = v.spec.hx + this.player.radius + 0.5;
    const end = v.spec.hz + this.player.radius + 0.6;
    const candidates: Array<[number, number]> = [
      [v.x - rx * side, v.z - rz * side],
      [v.x + rx * side, v.z + rz * side],
      [v.x - fx * end, v.z - fz * end],
      [v.x + fx * end, v.z + fz * end],
      [v.x - rx * (side + 1.5), v.z - rz * (side + 1.5)],
      [v.x + rx * (side + 1.5), v.z + rz * (side + 1.5)],
    ];
    let spot = candidates[0];
    for (const c of candidates) {
      if (this.isSpotFree(c[0], c[1], v)) {
        spot = c;
        break;
      }
    }
    v.driver = 'none';
    v.throttle = 0;
    v.steer = 0;
    v.handbrake = true;
    this.player.vehicle = null;
    this.player.teleport(spot[0], spot[1], v.yaw);
    this.camera.yaw = v.yaw;
  }

  private isSpotFree(x: number, z: number, ignore: Vehicle): boolean {
    const c: Circle = { x, z, r: this.player.radius + 0.1 };
    for (const s of this.city.colliders) if (circleVsObb(c, s)) return false;
    for (const v of this.vehicles) {
      if (v === ignore) continue;
      if (circleVsObb(c, v.obb)) return false;
    }
    return true;
  }

  private handleBusted(): void {
    if (this.player.vehicle) this.tryExitVehicle(true);
    const bs = this.city.bustedSpawn;
    this.player.teleport(bs.x, bs.z, bs.yaw);
    this.player.visualY = groundHeightAt(bs.x, bs.z);
    this.mission.onBusted();
    this.camera.snapTo(this.player);
  }

  // ---------------------------------------------------------------- visuals / HUD

  private updateVisuals(dt: number): void {
    for (const v of this.vehicles) v.syncMesh(dt, this.time);
    for (const p of this.pedestrians) p.syncMesh(dt);
    this.player.syncMesh();

    // interaction hint
    if (this.player.vehicle) {
      this.hint = this.player.vehicle.speed > 3 ? 'Slow down to exit (E)' : 'Press E to exit the vehicle';
    } else {
      const v = this.findEnterableVehicle();
      this.hint = v ? `Press E to enter the ${v.isMissionCar ? 'delivery van' : v.spec.kind}` : '';
    }
  }

  private updateSun(): void {
    const px = this.player.worldX;
    const pz = this.player.worldZ;
    this.sun.position.set(px + 60, 90, pz + 35);
    this.sun.target.position.set(px, 0, pz);
    this.sun.target.updateMatrixWorld();
  }

  private publishHud(): void {
    const v = this.player.vehicle;
    const m = this.mission.info;
    const w = this.wanted.info;
    this.onHud({
      mode: v ? 'DRIVING' : 'ON FOOT',
      speedKmh: v ? Math.round(v.speed * 3.6) : 0,
      vehicleName: v ? (v.isMissionCar ? 'Delivery van' : v.spec.kind) : '',
      objective: m.objective,
      missionState: m.state,
      missionTimeLeft: m.timeLeft,
      wantedLevel: w.level,
      wantedMessage: w.message,
      escapeProgress: w.escapeProgress,
      hint: this.hint,
      banner: m.banner ?? (w.message === 'BUSTED' ? 'BUSTED' : null),
      showHelp: this.showHelp,
      fps: Math.round(this.fps),
    });
  }
}
