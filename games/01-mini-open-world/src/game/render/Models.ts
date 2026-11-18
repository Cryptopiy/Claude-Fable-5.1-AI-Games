import * as THREE from 'three';
import type { VehicleSpec } from '../entities/VehicleSpecs';

/** Shared geometries / materials to keep draw setup cheap. */
const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.32, 14);
wheelGeo.rotateZ(Math.PI / 2);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.9 });
const hubMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.4, metalness: 0.6 });
const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.34, 10);
hubGeo.rotateZ(Math.PI / 2);
const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fd3ff, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.85 });
const headlightMat = new THREE.MeshStandardMaterial({ color: 0xfff6d0, emissive: 0xfff2b0, emissiveIntensity: 1.2 });
const taillightMat = new THREE.MeshStandardMaterial({ color: 0x8a0f0f, emissive: 0xff2020, emissiveIntensity: 0.4 });

export interface CarMeshParts {
  group: THREE.Group;
  wheelsFront: THREE.Object3D[];
  wheelsAll: THREE.Object3D[];
  bodyMat: THREE.MeshStandardMaterial;
  brakeMat: THREE.MeshStandardMaterial;
  sirenRed?: THREE.MeshStandardMaterial;
  sirenBlue?: THREE.MeshStandardMaterial;
}

export function createCarMesh(spec: VehicleSpec, color: number, police: boolean): CarMeshParts {
  const g = new THREE.Group();
  const w = spec.hx * 2;
  const l = spec.hz * 2;
  const bodyY = 0.42 + spec.bodyHeight / 2;

  const bodyMat = new THREE.MeshStandardMaterial({ color: police ? 0xf4f6f8 : color, roughness: 0.35, metalness: 0.25 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, spec.bodyHeight, l), bodyMat);
  body.position.y = bodyY;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  const cabinTop = bodyY + spec.bodyHeight / 2;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(spec.cabin.w, spec.cabin.h, spec.cabin.l), bodyMat);
  cabin.position.set(0, cabinTop + spec.cabin.h / 2, spec.cabin.z);
  cabin.castShadow = true;
  g.add(cabin);

  // windows (front + back glass planes slightly proud of the cabin)
  const glassF = new THREE.Mesh(new THREE.BoxGeometry(spec.cabin.w * 0.9, spec.cabin.h * 0.7, 0.05), glassMat);
  glassF.position.set(0, cabinTop + spec.cabin.h / 2 + 0.02, spec.cabin.z + spec.cabin.l / 2 + 0.02);
  g.add(glassF);
  const glassB = glassF.clone();
  glassB.position.z = spec.cabin.z - spec.cabin.l / 2 - 0.02;
  g.add(glassB);
  const glassSideGeo = new THREE.BoxGeometry(0.05, spec.cabin.h * 0.6, spec.cabin.l * 0.8);
  const glassL = new THREE.Mesh(glassSideGeo, glassMat);
  glassL.position.set(-spec.cabin.w / 2 - 0.02, cabinTop + spec.cabin.h / 2 + 0.02, spec.cabin.z);
  g.add(glassL);
  const glassR = glassL.clone();
  glassR.position.x = spec.cabin.w / 2 + 0.02;
  g.add(glassR);

  if (police) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.04, spec.bodyHeight * 0.4, l * 0.92),
      new THREE.MeshStandardMaterial({ color: 0x1f3fbf, roughness: 0.4 }),
    );
    stripe.position.y = bodyY - 0.05;
    g.add(stripe);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 0.03, l * 0.25), new THREE.MeshStandardMaterial({ color: 0x1f3fbf }));
    hood.position.set(0, bodyY + spec.bodyHeight / 2 + 0.02, l * 0.32);
    g.add(hood);
  }

  const wheelsAll: THREE.Object3D[] = [];
  const wheelsFront: THREE.Object3D[] = [];
  const wz = spec.hz - 0.75;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      // pivot handles steering (yaw), spinner handles rolling (about the axle)
      const pivot = new THREE.Group();
      pivot.position.set(sx * (spec.hx - 0.05), 0.38, sz * wz);
      const spinner = new THREE.Group();
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.castShadow = true;
      const hub = new THREE.Mesh(hubGeo, hubMat);
      spinner.add(wheel);
      spinner.add(hub);
      pivot.add(spinner);
      g.add(pivot);
      wheelsAll.push(spinner);
      if (sz > 0) wheelsFront.push(pivot);
    }
  }

  const hlGeo = new THREE.BoxGeometry(0.38, 0.2, 0.08);
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(hlGeo, headlightMat);
    hl.position.set(sx * (spec.hx - 0.3), bodyY + 0.05, spec.hz + 0.02);
    g.add(hl);
  }
  const brakeMat = taillightMat.clone();
  for (const sx of [-1, 1]) {
    const tl = new THREE.Mesh(hlGeo, brakeMat);
    tl.position.set(sx * (spec.hx - 0.3), bodyY + 0.05, -spec.hz - 0.02);
    g.add(tl);
  }

  const parts: CarMeshParts = { group: g, wheelsFront, wheelsAll, bodyMat, brakeMat };

  if (police) {
    const barY = cabinTop + spec.cabin.h + 0.1;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 0.42), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    bar.position.set(0, barY, spec.cabin.z);
    g.add(bar);
    const sirenRed = new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff0000, emissiveIntensity: 0.2 });
    const sirenBlue = new THREE.MeshStandardMaterial({ color: 0x2a5cff, emissive: 0x0033ff, emissiveIntensity: 0.2 });
    const lightGeo = new THREE.BoxGeometry(0.5, 0.2, 0.36);
    const red = new THREE.Mesh(lightGeo, sirenRed);
    red.position.set(-0.32, barY + 0.14, spec.cabin.z);
    const blue = new THREE.Mesh(lightGeo, sirenBlue);
    blue.position.set(0.32, barY + 0.14, spec.cabin.z);
    g.add(red, blue);
    parts.sirenRed = sirenRed;
    parts.sirenBlue = sirenBlue;
  }

  if (spec.kind === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.25, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xffee58, emissive: 0xffd600, emissiveIntensity: 0.5 }),
    );
    sign.position.set(0, cabinTop + spec.cabin.h + 0.12, spec.cabin.z);
    g.add(sign);
  }

  return parts;
}

export interface HumanoidParts {
  group: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  body: THREE.Group; // everything above ground (so it can be tilted when knocked down)
}

const skinTones = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const legGeo = new THREE.BoxGeometry(0.22, 0.75, 0.22);
const armGeo = new THREE.BoxGeometry(0.14, 0.6, 0.14);
const torsoGeo = new THREE.BoxGeometry(0.5, 0.65, 0.3);
const headGeo = new THREE.SphereGeometry(0.18, 12, 10);
const brimGeo = new THREE.BoxGeometry(0.3, 0.05, 0.2);

export function createHumanoid(shirt: number, pants: number, skinIndex: number, isPlayer: boolean): HumanoidParts {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.8 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skinTones[skinIndex % skinTones.length], roughness: 0.7 });

  const makeLimb = (geo: THREE.BoxGeometry, mat: THREE.Material, len: number) => {
    const pivot = new THREE.Group();
    const m = new THREE.Mesh(geo, mat);
    m.position.y = -len / 2;
    m.castShadow = true;
    pivot.add(m);
    return pivot;
  };

  const legL = makeLimb(legGeo, pantsMat, 0.75);
  legL.position.set(-0.13, 0.75, 0);
  const legR = makeLimb(legGeo, pantsMat, 0.75);
  legR.position.set(0.13, 0.75, 0);
  body.add(legL, legR);

  const torso = new THREE.Mesh(torsoGeo, shirtMat);
  torso.position.y = 0.75 + 0.325;
  torso.castShadow = true;
  body.add(torso);

  const armL = makeLimb(armGeo, shirtMat, 0.6);
  armL.position.set(-0.33, 1.38, 0);
  const armR = makeLimb(armGeo, shirtMat, 0.6);
  armR.position.set(0.33, 1.38, 0);
  body.add(armL, armR);

  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.y = 1.6;
  head.castShadow = true;
  body.add(head);

  const brim = new THREE.Mesh(brimGeo, new THREE.MeshStandardMaterial({ color: isPlayer ? 0x111111 : shirt }));
  brim.position.set(0, 1.68, 0.2);
  body.add(brim);

  if (isPlayer) {
    const marker = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.45, 4),
      new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00bcd4, emissiveIntensity: 0.9 }),
    );
    marker.rotation.x = Math.PI;
    marker.position.y = 2.25;
    marker.name = 'playerMarker';
    body.add(marker);
  }

  return { group, legL, legR, armL, armR, body };
}

export interface MarkerParts {
  group: THREE.Group;
  cone: THREE.Mesh;
}

export function createMarker(color: number, radius = 2.5, groundRing = true): MarkerParts {
  const group = new THREE.Group();
  if (groundRing) {
    const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.5, 40, 1, true), ringMat);
    ring.position.y = 0.4;
    group.add(ring);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, depthWrite: false }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.17;
    group.add(disc);
  }
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 40, 8, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }),
  );
  beam.position.y = 20;
  group.add(beam);
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.7, 1.4, 4),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8 }),
  );
  cone.rotation.x = Math.PI;
  cone.position.y = 3.6;
  group.add(cone);
  return { group, cone };
}
