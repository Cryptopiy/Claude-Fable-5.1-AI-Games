import * as THREE from 'three';
import { headingTo, lerpAngle, safeNum, wrapAngle } from '../core/mathUtils';
import type { Rng } from '../core/rng';
import type { Circle } from '../physics/collision';
import { createHumanoid, type HumanoidParts } from '../render/Models';
import type { SidewalkGraph } from '../world/SidewalkGraph';

export type PedState = 'walk' | 'wait' | 'flee' | 'down';

const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xecf0f1, 0x95a5a6, 0xd35400, 0x34495e];
const PANTS = [0x2c3e50, 0x34495e, 0x7f8c8d, 0x5d4037, 0x1a237e, 0x263238];

export class Pedestrian {
  x: number;
  z: number;
  yaw = 0;
  vx = 0;
  vz = 0;
  visualY = 0;
  readonly radius = 0.35;
  readonly walkSpeed: number;

  state: PedState = 'walk';
  timer = 0;
  prevNode: number;
  targetNode: number;
  fleeX = 0;
  fleeZ = 0;

  private progress = 0;
  private stuckCheck = 0;
  private animPhase: number;

  readonly mesh: THREE.Group;
  private readonly parts: HumanoidParts;
  private readonly circleCache: Circle;

  constructor(rng: Rng, graph: SidewalkGraph, node: number) {
    const n = graph.nodes[node];
    this.x = n.x + (rng() - 0.5) * 1.5;
    this.z = n.z + (rng() - 0.5) * 1.5;
    this.prevNode = node;
    const nb = n.neighbors;
    this.targetNode = nb[Math.floor(rng() * nb.length)];
    this.walkSpeed = 1.2 + rng() * 1.1;
    this.animPhase = rng() * Math.PI * 2;
    this.timer = rng() * 2;
    this.parts = createHumanoid(
      SHIRTS[Math.floor(rng() * SHIRTS.length)],
      PANTS[Math.floor(rng() * PANTS.length)],
      Math.floor(rng() * 5),
      false,
    );
    this.mesh = this.parts.group;
    this.circleCache = { x: this.x, z: this.z, r: this.radius };
    this.yaw = headingTo(this.x, this.z, graph.nodes[this.targetNode].x, graph.nodes[this.targetNode].z);
  }

  get circle(): Circle {
    this.circleCache.x = this.x;
    this.circleCache.z = this.z;
    return this.circleCache;
  }

  /** Simple state machine: walk between sidewalk nodes, pause sometimes, flee from danger. */
  update(dt: number, graph: SidewalkGraph, rng: Rng): void {
    this.timer -= dt;
    let desiredVx = 0;
    let desiredVz = 0;

    switch (this.state) {
      case 'walk': {
        const t = graph.nodes[this.targetNode];
        const dx = t.x - this.x;
        const dz = t.z - this.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.9) {
          this.arrive(graph, rng);
        } else {
          desiredVx = (dx / d) * this.walkSpeed;
          desiredVz = (dz / d) * this.walkSpeed;
        }
        // stuck detection: not making progress for a while -> turn around / wait
        this.stuckCheck += dt;
        if (this.stuckCheck > 1.6) {
          if (this.progress < 0.6) {
            const tmp = this.targetNode;
            this.targetNode = this.prevNode;
            this.prevNode = tmp;
            this.state = 'wait';
            this.timer = 0.4 + rng() * 0.8;
          }
          this.progress = 0;
          this.stuckCheck = 0;
        }
        break;
      }
      case 'wait':
        if (this.timer <= 0) {
          this.state = 'walk';
          this.stuckCheck = 0;
          this.progress = 0;
        }
        break;
      case 'flee': {
        const dx = this.x - this.fleeX;
        const dz = this.z - this.fleeZ;
        const d = Math.hypot(dx, dz) || 1;
        const sp = this.walkSpeed * 2.1;
        desiredVx = (dx / d) * sp;
        desiredVz = (dz / d) * sp;
        if (this.timer <= 0) {
          this.state = 'walk';
          this.retarget(graph);
        }
        break;
      }
      case 'down':
        if (this.timer <= 0) {
          this.state = 'flee';
          this.timer = 4;
        }
        break;
    }

    const k = Math.min(1, dt * 8);
    this.vx += (desiredVx - this.vx) * k;
    this.vz += (desiredVz - this.vz) * k;
    const nx = this.x + this.vx * dt;
    const nz = this.z + this.vz * dt;
    this.progress += Math.hypot(nx - this.x, nz - this.z);
    this.x = safeNum(nx, this.x);
    this.z = safeNum(nz, this.z);
    if (!Number.isFinite(this.vx) || !Number.isFinite(this.vz)) {
      this.vx = 0;
      this.vz = 0;
    }

    const sp = Math.hypot(this.vx, this.vz);
    if (sp > 0.2) {
      this.yaw = lerpAngle(this.yaw, Math.atan2(this.vx, this.vz), Math.min(1, dt * 10));
    }
    this.animPhase += dt * sp * 4.5;
  }

  private arrive(graph: SidewalkGraph, rng: Rng): void {
    const n = graph.nodes[this.targetNode];
    const options = n.neighbors.filter((k) => k !== this.prevNode);
    const list = options.length > 0 ? options : n.neighbors;
    const next = list[Math.floor(rng() * list.length)];
    this.prevNode = this.targetNode;
    this.targetNode = next;
    if (rng() < 0.18) {
      this.state = 'wait';
      this.timer = 1 + rng() * 3;
    }
    this.progress = 0;
    this.stuckCheck = 0;
  }

  private retarget(graph: SidewalkGraph): void {
    const nearest = graph.nearest(this.x, this.z);
    this.prevNode = nearest;
    this.targetNode = nearest;
    this.progress = 0;
    this.stuckCheck = 0;
  }

  startFlee(fromX: number, fromZ: number, seconds = 4): void {
    if (this.state === 'down') return;
    this.state = 'flee';
    this.fleeX = fromX;
    this.fleeZ = fromZ;
    this.timer = seconds;
  }

  knockDown(fromX: number, fromZ: number, impulseX: number, impulseZ: number): void {
    this.state = 'down';
    this.timer = 3;
    this.fleeX = fromX;
    this.fleeZ = fromZ;
    this.vx = impulseX;
    this.vz = impulseZ;
  }

  get isDown(): boolean {
    return this.state === 'down';
  }

  syncMesh(dt: number): void {
    this.mesh.position.set(this.x, this.visualY, this.z);
    this.mesh.rotation.y = this.yaw;

    const sp = Math.hypot(this.vx, this.vz);
    const swing = Math.sin(this.animPhase) * Math.min(1, sp / this.walkSpeed) * 0.7;
    this.parts.legL.rotation.x = swing;
    this.parts.legR.rotation.x = -swing;
    this.parts.armL.rotation.x = -swing * 0.8;
    this.parts.armR.rotation.x = swing * 0.8;

    const targetTilt = this.state === 'down' ? Math.PI / 2 : 0;
    const body = this.parts.body;
    body.rotation.x += (targetTilt - body.rotation.x) * Math.min(1, dt * 8);
    body.position.y = this.state === 'down' ? 0.3 : 0;
    if (this.state === 'down') body.rotation.z = wrapAngle(body.rotation.z);
  }
}
