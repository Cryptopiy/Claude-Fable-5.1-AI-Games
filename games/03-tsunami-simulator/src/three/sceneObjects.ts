import * as THREE from 'three';
import type { TerrainData, VehicleState } from '../simulation/types';
import { sampleElevation, terrainElevation } from '../simulation/terrain';

export interface BuildingVisual {
  material: THREE.MeshStandardMaterial;
  x: number;
  z: number;
  width: number;
  depth: number;
}

export interface OceanVisual {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  material: THREE.ShaderMaterial;
  foam: THREE.Mesh;
}

export function createTerrainMesh(terrain: TerrainData): THREE.Mesh {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const color = new THREE.Color();

  for (let row = 0; row < terrain.rows; row += 1) {
    for (let column = 0; column < terrain.columns; column += 1) {
      const index = row * terrain.columns + column;
      const x = terrain.originX + column * terrain.cellSize;
      const z = terrain.originZ + row * terrain.cellSize;
      const elevation = terrain.elevations[index];
      positions.push(x, elevation, z);

      if (terrain.roadMask[index]) {
        color.setHex(0x4a514f);
      } else if (elevation < 1.5) {
        color.setHex(0x7fa67b);
      } else if (elevation < 4) {
        color.setHex(0x91a86e);
      } else if (elevation < 7) {
        color.setHex(0xa9a36d);
      } else if (elevation < 10) {
        color.setHex(0xb89972);
      } else {
        color.setHex(0xc6b28d);
      }

      const contourShade = Math.floor(elevation / 1.5) % 2 === 0 ? 0.96 : 1.035;
      color.multiplyScalar(contourShade);
      colors.push(color.r, color.g, color.b);
    }
  }

  for (let row = 0; row < terrain.rows - 1; row += 1) {
    for (let column = 0; column < terrain.columns - 1; column += 1) {
      const a = row * terrain.columns + column;
      const b = a + 1;
      const c = a + terrain.columns;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

export function createTerrainBase(terrain: TerrainData): THREE.Mesh {
  const width = (terrain.columns - 1) * terrain.cellSize + 3;
  const depth = (terrain.rows - 1) * terrain.cellSize + 3;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, 3.5, depth),
    new THREE.MeshStandardMaterial({ color: 0x5d5d48, roughness: 1 }),
  );
  mesh.position.set(
    terrain.originX + ((terrain.columns - 1) * terrain.cellSize) / 2,
    -1.72,
    terrain.originZ + ((terrain.rows - 1) * terrain.cellSize) / 2,
  );
  mesh.receiveShadow = true;
  return mesh;
}

export function createBuildings(
  terrain: TerrainData,
): { group: THREE.Group; visuals: BuildingVisual[] } {
  const group = new THREE.Group();
  const visuals: BuildingVisual[] = [];
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x404847, roughness: 0.88 });
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0x9bc3c0,
    emissive: 0x10282a,
    roughness: 0.32,
    metalness: 0.22,
  });

  for (const building of terrain.buildings) {
    const root = new THREE.Group();
    const baseElevation = sampleElevation(terrain, building.x, building.z);
    root.position.set(building.x, baseElevation, building.z);

    const material = new THREE.MeshStandardMaterial({
      color: building.color,
      roughness: 0.82,
      emissive: 0x000000,
    });
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(building.width, building.height, building.depth),
      material,
    );
    body.position.y = building.height * 0.5;
    body.castShadow = true;
    body.receiveShadow = true;
    root.add(body);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(building.width + 0.4, 0.42, building.depth + 0.4),
      roofMaterial,
    );
    roof.position.y = building.height + 0.18;
    roof.castShadow = true;
    root.add(roof);

    const floors = Math.max(1, Math.floor(building.height / 3));
    const windowColumns = Math.max(2, Math.floor(building.width / 3.2));
    for (let floor = 0; floor < floors; floor += 1) {
      for (let column = 0; column < windowColumns; column += 1) {
        const window = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.72), windowMaterial);
        window.position.set(
          -building.width * 0.5 + ((column + 1) * building.width) / (windowColumns + 1),
          1.65 + floor * 2.65,
          building.depth * 0.5 + 0.011,
        );
        root.add(window);
      }
    }

    group.add(root);
    visuals.push({
      material,
      x: building.x,
      z: building.z,
      width: building.width,
      depth: building.depth,
    });
  }

  const evacuationMarker = createEvacuationMarker(terrain);
  group.add(evacuationMarker);
  return { group, visuals };
}

export function createRoadMarkings(terrain: TerrainData): THREE.Group {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0xf4e6b2, roughness: 0.78 });
  const dashGeometry = new THREE.BoxGeometry(3.4, 0.07, 0.2);

  for (let x = -61; x <= 62; x += 7) {
    const z = 1.6 * Math.sin((x + 18) * 0.045);
    const nextZ = 1.6 * Math.sin((x + 21) * 0.045);
    const dash = new THREE.Mesh(dashGeometry, paint);
    dash.position.set(x, terrainElevation(x, z) + 0.07, z);
    dash.rotation.y = -Math.atan2(nextZ - z, 3);
    dash.receiveShadow = true;
    group.add(dash);
  }

  const verticalDashGeometry = new THREE.BoxGeometry(0.2, 0.07, 3.4);
  for (const x of [-28, 12, 45]) {
    for (let z = -36; z <= 34; z += 7) {
      const dash = new THREE.Mesh(verticalDashGeometry, paint);
      dash.position.set(x, terrainElevation(x, z) + 0.07, z);
      dash.receiveShadow = true;
      group.add(dash);
    }
  }

  for (let x = -23; x <= 42; x += 7) {
    const dash = new THREE.Mesh(dashGeometry, paint);
    dash.position.set(x, terrainElevation(x, 27) + 0.07, 27);
    dash.receiveShadow = true;
    group.add(dash);
  }
  return group;
}

export function createVehicles(
  states: VehicleState[],
  terrain: TerrainData,
): THREE.Group[] {
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x151a1b, roughness: 0.8 });
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0x294d5a,
    roughness: 0.25,
    metalness: 0.25,
  });

  return states.map((state) => {
    const car = new THREE.Group();
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: state.color,
      roughness: 0.48,
      metalness: 0.12,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.72, 1.65), bodyMaterial);
    body.position.y = 0.44;
    body.castShadow = true;
    car.add(body);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.64, 1.45), glassMaterial);
    cabin.position.set(-0.18, 1.05, 0);
    cabin.castShadow = true;
    car.add(cabin);

    for (const wheelX of [-1.05, 1.05]) {
      for (const wheelZ of [-0.82, 0.82]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.22, 10), wheelMaterial);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(wheelX, 0.28, wheelZ);
        car.add(wheel);
      }
    }

    car.position.set(state.x, sampleElevation(terrain, state.x, state.z) + 0.15, state.z);
    car.rotation.y = -state.heading;
    car.traverse((object) => {
      object.userData.vehicleId = state.id;
    });
    return car;
  });
}

export function createWaterInstances(terrain: TerrainData): THREE.InstancedMesh {
  const geometry = new THREE.BoxGeometry(terrain.cellSize * 0.96, 1, terrain.cellSize * 0.96);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x2a9fc0,
    transparent: true,
    opacity: 0.66,
    roughness: 0.2,
    metalness: 0,
    transmission: 0.06,
    depthWrite: false,
    vertexColors: true,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, terrain.columns * terrain.rows);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  return mesh;
}

export function createOcean(terrain: TerrainData): OceanVisual {
  const width = 92;
  const depth = (terrain.rows - 1) * terrain.cellSize + 16;
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uSurge: { value: 0 },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uSurge;
      varying float vWave;
      void main() {
        vec3 p = position;
        float wave = sin(p.x * 0.18 + uTime * 1.7) * 0.14;
        wave += sin(p.y * 0.24 - uTime * 1.25) * 0.09;
        wave += sin((p.x + p.y) * 0.1 + uTime) * 0.05;
        p.z += wave + uSurge * 0.12;
        vWave = wave;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      varying float vWave;
      void main() {
        vec3 deep = vec3(0.018, 0.28, 0.38);
        vec3 crest = vec3(0.18, 0.61, 0.67);
        float mixAmount = clamp(vWave * 2.4 + 0.45, 0.0, 1.0);
        gl_FragColor = vec4(mix(deep, crest, mixAmount), 0.9);
      }
    `,
  });
  const geometry = new THREE.PlaneGeometry(width, depth, 34, 34);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(terrain.originX - width * 0.5 + 0.5, 0.03, 0);
  mesh.renderOrder = 2;

  const foam = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.08, depth - 6),
    new THREE.MeshBasicMaterial({ color: 0xc8f0e9, transparent: true, opacity: 0.72 }),
  );
  foam.position.set(terrain.originX - 0.25, 0.15, 0);
  foam.renderOrder = 3;
  return { mesh, material, foam };
}

function createEvacuationMarker(terrain: TerrainData): THREE.Group {
  const x = 56;
  const z = -43;
  const y = sampleElevation(terrain, x, z);
  const group = new THREE.Group();
  group.position.set(x, y + 0.12, z);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(4.2, 0.22, 8, 40),
    new THREE.MeshStandardMaterial({ color: 0x86d672, emissive: 0x193c1b }),
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 5.5, 8),
    new THREE.MeshStandardMaterial({ color: 0xe7ede5 }),
  );
  pole.position.y = 2.75;
  group.add(pole);

  const label = createTextSprite('HIGH GROUND  •  SAFE ZONE');
  label.position.set(0, 6.4, 0);
  label.scale.set(14, 3.5, 1);
  group.add(label);
  return group;
}

function createTextSprite(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 160;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = 'rgba(5, 24, 25, 0.86)';
    context.beginPath();
    context.roundRect(4, 4, 760, 152, 34);
    context.fill();
    context.strokeStyle = '#9be68d';
    context.lineWidth = 6;
    context.stroke();
    context.fillStyle = '#f3f8ec';
    context.font = '700 40px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 384, 82);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = 8;
  return sprite;
}
