import * as THREE from 'three';
import { OBSTACLES } from '../physics/obstacles';
import type { DamageZone, ObstacleType } from '../types';

const bodyMaterial = new THREE.MeshStandardMaterial({
  color: 0xe8edf2,
  roughness: 0.28,
  metalness: 0.68,
});
const darkMaterial = new THREE.MeshStandardMaterial({
  color: 0x10151a,
  roughness: 0.62,
  metalness: 0.22,
});
const glassMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x172c38,
  roughness: 0.08,
  metalness: 0.15,
  transmission: 0.2,
  transparent: true,
  opacity: 0.88,
});

export interface CarVisual {
  group: THREE.Group;
  hood: THREE.Mesh;
  trunk: THREE.Mesh;
  bumperFront: THREE.Mesh;
  zoneMeshes: Record<DamageZone, THREE.Mesh>;
  wheels: THREE.Mesh[];
}

function box(
  size: [number, number, number],
  material: THREE.Material,
  position: [number, number, number],
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createCar(): CarVisual {
  const group = new THREE.Group();
  group.name = 'vehicle-rigid-body';

  const lower = box([4.5, 0.48, 1.86], bodyMaterial, [0, 0.58, 0]);
  lower.geometry.translate(0, 0, 0);
  group.add(lower);

  const hood = box([1.38, 0.25, 1.76], bodyMaterial.clone(), [1.35, 0.91, 0]);
  const trunk = box([0.82, 0.3, 1.7], bodyMaterial.clone(), [-1.73, 0.91, 0]);
  group.add(hood, trunk);

  const cabin = box([2.08, 0.72, 1.56], glassMaterial, [-0.32, 1.2, 0]);
  cabin.geometry = new THREE.BoxGeometry(2.08, 0.72, 1.56);
  group.add(cabin);

  const roof = box([1.5, 0.09, 1.51], darkMaterial, [-0.42, 1.59, 0]);
  group.add(roof);

  const splitter = box([0.18, 0.2, 1.88], darkMaterial, [2.29, 0.43, 0]);
  const rearBumper = box([0.16, 0.2, 1.86], darkMaterial, [-2.28, 0.43, 0]);
  group.add(splitter, rearBumper);

  const wheelGeometry = new THREE.CylinderGeometry(0.38, 0.38, 0.27, 20);
  wheelGeometry.rotateX(Math.PI / 2);
  const wheelPositions: [number, number, number][] = [
    [1.35, 0.43, 0.94],
    [1.35, 0.43, -0.94],
    [-1.4, 0.43, 0.94],
    [-1.4, 0.43, -0.94],
  ];
  const wheels = wheelPositions.map((position) => {
    const wheel = new THREE.Mesh(wheelGeometry, darkMaterial);
    wheel.position.set(...position);
    wheel.castShadow = true;
    group.add(wheel);
    return wheel;
  });

  const rimGeometry = new THREE.CylinderGeometry(0.19, 0.19, 0.285, 12);
  rimGeometry.rotateX(Math.PI / 2);
  wheelPositions.forEach((position) => {
    const rim = new THREE.Mesh(
      rimGeometry,
      new THREE.MeshStandardMaterial({ color: 0x9ca7af, metalness: 0.9, roughness: 0.2 }),
    );
    rim.position.set(...position);
    group.add(rim);
  });

  const lightMaterial = new THREE.MeshStandardMaterial({
    color: 0xd9fbff,
    emissive: 0xb8f1ff,
    emissiveIntensity: 1.7,
  });
  [-0.58, 0.58].forEach((z) => {
    group.add(box([0.08, 0.2, 0.42], lightMaterial, [2.29, 0.79, z]));
  });

  const damageMaterial = () =>
    new THREE.MeshStandardMaterial({
      color: 0xff321f,
      emissive: 0xff1600,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

  const zoneMeshes: Record<DamageZone, THREE.Mesh> = {
    front: box([0.06, 0.56, 1.72], damageMaterial(), [2.31, 0.67, 0]),
    rear: box([0.06, 0.56, 1.72], damageMaterial(), [-2.31, 0.67, 0]),
    left: box([2.85, 0.53, 0.05], damageMaterial(), [0.05, 0.69, -0.955]),
    right: box([2.85, 0.53, 0.05], damageMaterial(), [0.05, 0.69, 0.955]),
  };
  Object.values(zoneMeshes).forEach((zone) => group.add(zone));

  group.position.y = 0.02;
  return { group, hood, trunk, bumperFront: splitter, zoneMeshes, wheels };
}

export function applyCarDamage(car: CarVisual, zone: DamageZone, damage: number): void {
  const normalized = THREE.MathUtils.clamp(damage / 100, 0, 1);
  Object.entries(car.zoneMeshes).forEach(([key, mesh]) => {
    const material = mesh.material as THREE.MeshStandardMaterial;
    material.opacity = key === zone ? 0.22 + normalized * 0.66 : 0;
    material.emissiveIntensity = 0.4 + normalized * 2.5;
  });

  if (zone === 'front') {
    car.hood.scale.x = 1 - normalized * 0.34;
    car.hood.position.x = 1.35 - normalized * 0.22;
    car.hood.rotation.z = normalized * 0.055;
    car.bumperFront.position.x = 2.29 - normalized * 0.52;
    car.bumperFront.rotation.z = normalized * 0.13;
  } else if (zone === 'rear') {
    car.trunk.scale.x = 1 - normalized * 0.3;
    car.trunk.position.x = -1.73 + normalized * 0.2;
  } else {
    const side = zone === 'left' ? -1 : 1;
    car.hood.rotation.x = side * normalized * 0.05;
  }
}

export function createObstacle(type: ObstacleType): THREE.Group {
  const definition = OBSTACLES[type];
  const group = new THREE.Group();
  group.name = `obstacle-${type}`;
  const mainMaterial = new THREE.MeshStandardMaterial({
    color: definition.color,
    roughness: type === 'concrete' ? 0.9 : 0.48,
    metalness: type === 'heavy' ? 0.72 : 0.08,
  });

  if (type === 'concrete') {
    const body = box(
      [definition.widthM, definition.heightM, definition.depthM],
      mainMaterial,
      [0, definition.heightM / 2, 0],
    );
    group.add(body);
    const seamMaterial = new THREE.MeshStandardMaterial({ color: 0x4f5960, roughness: 0.88 });
    for (let z = -4.5; z <= 4.5; z += 1.5) {
      group.add(box([0.06, 2.72, 0.035], seamMaterial, [-0.39, 1.36, z]));
    }
    const warning = new THREE.MeshStandardMaterial({ color: 0xf3ad21, roughness: 0.5 });
    group.add(box([0.08, 0.14, 5.4], warning, [-0.4, 0.34, 0]));
  } else if (type === 'heavy') {
    const base = box([1.15, 0.58, 8.2], mainMaterial, [0, 0.31, 0]);
    const beam = box([0.54, 0.38, 8.4], mainMaterial, [-0.2, 1.15, 0]);
    group.add(base, beam);
    const braceMaterial = new THREE.MeshStandardMaterial({ color: 0x273039, metalness: 0.78 });
    for (let z = -3.5; z <= 3.5; z += 1.75) {
      const brace = box([0.16, 1.05, 0.16], braceMaterial, [0.16, 0.88, z]);
      brace.rotation.z = -0.32;
      group.add(brace);
    }
  } else {
    const segments = 5;
    for (let i = 0; i < segments; i += 1) {
      const z = (i - (segments - 1) / 2) * 1.1;
      const segmentMaterial = new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0xef553d : 0xe7e9e3,
        roughness: 0.58,
      });
      const segment = box([1, 1.05, 1.02], segmentMaterial, [0, 0.53, z]);
      group.add(segment);
      group.add(box([1.04, 0.14, 0.82], darkMaterial, [0, 0.22, z]));
    }
  }

  return group;
}

export function createEnvironment(scene: THREE.Scene): void {
  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x11181d, roughness: 0.94 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 70), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const trackMaterial = new THREE.MeshStandardMaterial({ color: 0x293138, roughness: 0.84 });
  const track = new THREE.Mesh(new THREE.PlaneGeometry(72, 50), trackMaterial);
  track.rotation.x = -Math.PI / 2;
  track.position.y = 0.012;
  track.receiveShadow = true;
  scene.add(track);

  const borderMaterial = new THREE.MeshStandardMaterial({
    color: 0x49d5df,
    emissive: 0x1a7379,
    emissiveIntensity: 0.5,
  });
  [-25, 25].forEach((z) => {
    const border = box([72, 0.025, 0.07], borderMaterial, [0, 0.035, z]);
    scene.add(border);
  });

  const dashMaterial = new THREE.MeshStandardMaterial({ color: 0x86939c, roughness: 0.7 });
  for (let x = -34; x <= 33; x += 3) {
    scene.add(box([1.25, 0.018, 0.055], dashMaterial, [x, 0.035, 0]));
  }

  const markerMaterial = new THREE.MeshStandardMaterial({ color: 0xf4b63d, emissive: 0x6b4300 });
  for (let x = -30; x <= 30; x += 5) {
    [-25.5, 25.5].forEach((z) => {
      const post = box([0.08, 0.65, 0.08], markerMaterial, [x, 0.33, z]);
      scene.add(post);
      const cap = box([0.38, 0.06, 0.18], markerMaterial, [x, 0.68, z]);
      scene.add(cap);
    });
  }

  const impactMaterial = new THREE.MeshBasicMaterial({
    color: 0xff542f,
    transparent: true,
    opacity: 0.68,
    side: THREE.DoubleSide,
  });
  [1.1, 1.8, 2.5].forEach((radius) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius, radius + 0.035, 64), impactMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(-1.2, 0.045, 0);
    scene.add(ring);
  });

  const grid = new THREE.GridHelper(88, 44, 0x223139, 0x182229);
  grid.position.y = 0.02;
  scene.add(grid);

  const backdrop = box(
    [0.6, 7, 62],
    new THREE.MeshStandardMaterial({ color: 0x151e24, roughness: 0.86 }),
    [17, 3.5, 0],
  );
  scene.add(backdrop);
  for (let z = -27; z <= 27; z += 3) {
    const light = box(
      [0.05, 0.18, 1.4],
      new THREE.MeshStandardMaterial({
        color: 0x78f5ef,
        emissive: 0x38d8d2,
        emissiveIntensity: 2,
      }),
      [16.66, 5.5, z],
    );
    scene.add(light);
  }
}

export function disposeObject(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material.dispose());
  });
}
