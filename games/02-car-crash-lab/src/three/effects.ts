import * as THREE from 'three';
import type { Vec2 } from '../types';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  kind: 'spark' | 'debris';
}

export class CrashEffects {
  private readonly scene: THREE.Scene;
  private particles: Particle[] = [];
  private tireMarks: THREE.Mesh[] = [];
  private markDistance = 0;
  private lastPosition: Vec2 | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  burst(position: Vec2, damage: number, direction: Vec2): void {
    const sparkCount = Math.round(8 + damage * 0.28);
    const debrisCount = damage > 38 ? Math.round(2 + damage / 18) : 0;
    const seed = Math.round(damage * 97) + 41;
    const random = mulberry32(seed);

    for (let i = 0; i < sparkCount; i += 1) {
      const material = new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0xffffff : 0xff9f24 });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 4), material);
      mesh.position.set(position.x, 0.55 + random() * 0.65, position.z);
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(
          -direction.x * (1 + random() * 4) + (random() - 0.5) * 5,
          2.2 + random() * 5.4,
          -direction.z * (1 + random() * 4) + (random() - 0.5) * 5,
        ),
        life: 0.35 + random() * 0.65,
        kind: 'spark',
      });
    }

    for (let i = 0; i < debrisCount; i += 1) {
      const material = new THREE.MeshStandardMaterial({
        color: i % 2 ? 0xcbd2d5 : 0x1b2227,
        roughness: 0.6,
      });
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.08 + random() * 0.18, 0.04 + random() * 0.09, 0.08 + random() * 0.2),
        material,
      );
      mesh.position.set(position.x, 0.52 + random() * 0.5, position.z);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(
          -direction.x * (0.8 + random() * 2.4) + (random() - 0.5) * 2,
          1.2 + random() * 2.8,
          -direction.z * (0.8 + random() * 2.4) + (random() - 0.5) * 2,
        ),
        life: 2.8 + random() * 2.2,
        kind: 'debris',
      });
    }
  }

  update(dt: number): void {
    this.particles = this.particles.filter((particle) => {
      particle.life -= dt;
      particle.velocity.y -= 9.81 * dt;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      particle.mesh.rotation.x += dt * 5.2;
      particle.mesh.rotation.z += dt * 3.7;

      // Each debris mesh uses its bounding sphere as a 3D ground collision volume.
      if (particle.mesh.position.y < 0.035) {
        particle.mesh.position.y = 0.035;
        particle.velocity.y = Math.abs(particle.velocity.y) * (particle.kind === 'debris' ? 0.26 : 0.08);
        particle.velocity.x *= 0.72;
        particle.velocity.z *= 0.72;
      }

      if (particle.kind === 'spark') {
        const material = particle.mesh.material as THREE.MeshBasicMaterial;
        material.opacity = Math.min(1, particle.life * 2.5);
        material.transparent = true;
      }

      if (particle.life > 0) return true;
      this.scene.remove(particle.mesh);
      particle.mesh.geometry.dispose();
      (particle.mesh.material as THREE.Material).dispose();
      return false;
    });
  }

  addTireMarks(position: Vec2, yaw: number, moving: boolean): void {
    if (!moving) {
      this.lastPosition = position;
      return;
    }
    if (this.lastPosition) this.markDistance += Math.hypot(
      position.x - this.lastPosition.x,
      position.z - this.lastPosition.z,
    );
    this.lastPosition = { ...position };
    if (this.markDistance < 0.36) return;
    this.markDistance = 0;

    const material = new THREE.MeshBasicMaterial({
      color: 0x050708,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    });
    [-0.74, 0.74].forEach((offset) => {
      const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.13), material.clone());
      const lateralX = Math.sin(yaw) * offset;
      const lateralZ = Math.cos(yaw) * offset;
      mark.rotation.x = -Math.PI / 2;
      mark.rotation.z = yaw;
      mark.position.set(position.x + lateralX, 0.048, position.z + lateralZ);
      this.scene.add(mark);
      this.tireMarks.push(mark);
    });
  }

  dispose(): void {
    [...this.particles.map((p) => p.mesh), ...this.tireMarks].forEach((mesh) => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => material.dispose());
    });
    this.particles = [];
    this.tireMarks = [];
  }
}

function mulberry32(seed: number): () => number {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
