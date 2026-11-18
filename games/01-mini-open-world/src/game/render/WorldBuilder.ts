import * as THREE from 'three';
import type { BuildingDesc, CityData, PropDesc, SignDesc } from '../world/CityMap';
import { BLOCK, CITY_HALF, CURB_HEIGHT, PITCH, ROADS, ROAD_HALF, ROAD_W, SIDEWALK_W, WORLD_LIMIT, roadCoord } from '../world/constants';
import { makeFacadeTexture, makeGrassTexture, makeHazardTexture, makeIndustrialTexture, makeTextTexture } from './Textures';

const FACADE_WALLS = ['#b8b0a4', '#9aa5b1', '#c9b79c', '#8f8f97', '#d6cfc4', '#7d8a99'];

export class WorldBuilder {
  readonly group = new THREE.Group();
  private readonly facadeTextures: THREE.CanvasTexture[] = [];
  private readonly facadeMats = new Map<string, THREE.MeshStandardMaterial>();

  constructor(private readonly city: CityData) {
    for (let k = 0; k < FACADE_WALLS.length; k++) {
      this.facadeTextures.push(makeFacadeTexture(FACADE_WALLS[k], 17 + k * 31));
    }
  }

  build(): THREE.Group {
    this.buildGround();
    this.buildRoads();
    this.buildBlocks();
    for (const b of this.city.buildings) this.buildBuilding(b);
    for (const p of this.city.props) this.buildProp(p);
    for (const s of this.city.signs) this.buildSign(s);
    return this.group;
  }

  private buildGround(): void {
    const grass = makeGrassTexture();
    grass.repeat.set(80, 80);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_LIMIT * 2 + 200, WORLD_LIMIT * 2 + 200),
      new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  private buildRoads(): void {
    const asphalt = new THREE.MeshStandardMaterial({ color: 0x3a3d43, roughness: 0.95 });
    const roadGeoH = new THREE.BoxGeometry(BLOCK, 0.02, ROAD_W);
    const roadGeoV = new THREE.BoxGeometry(ROAD_W, 0.02, BLOCK);
    const crossGeo = new THREE.BoxGeometry(ROAD_W, 0.02, ROAD_W);
    const segCount = ROADS * (ROADS - 1);
    const roadsH = new THREE.InstancedMesh(roadGeoH, asphalt, segCount);
    const roadsV = new THREE.InstancedMesh(roadGeoV, asphalt, segCount);
    const crossings = new THREE.InstancedMesh(crossGeo, asphalt, ROADS * ROADS);
    const m = new THREE.Matrix4();
    let h = 0;
    let v = 0;
    let c = 0;
    for (let i = 0; i < ROADS; i++) {
      for (let j = 0; j < ROADS; j++) {
        m.makeTranslation(roadCoord(i), 0, roadCoord(j));
        crossings.setMatrixAt(c++, m);
        if (i + 1 < ROADS) {
          m.makeTranslation((roadCoord(i) + roadCoord(i + 1)) / 2, 0, roadCoord(j));
          roadsH.setMatrixAt(h++, m);
        }
        if (j + 1 < ROADS) {
          m.makeTranslation(roadCoord(i), 0, (roadCoord(j) + roadCoord(j + 1)) / 2);
          roadsV.setMatrixAt(v++, m);
        }
      }
    }
    for (const im of [roadsH, roadsV, crossings]) {
      im.receiveShadow = true;
      this.group.add(im);
    }

    // dashed centre lines
    const dashMat = new THREE.MeshStandardMaterial({ color: 0xf2d16b, roughness: 0.8 });
    const dashGeoH = new THREE.BoxGeometry(2.2, 0.03, 0.18);
    const dashGeoV = new THREE.BoxGeometry(0.18, 0.03, 2.2);
    const perSeg = Math.floor((BLOCK - 4) / 4);
    const dashesH = new THREE.InstancedMesh(dashGeoH, dashMat, segCount * perSeg);
    const dashesV = new THREE.InstancedMesh(dashGeoV, dashMat, segCount * perSeg);
    let dh = 0;
    let dv = 0;
    for (let i = 0; i < ROADS; i++) {
      for (let j = 0; j < ROADS; j++) {
        for (let k = 0; k < perSeg; k++) {
          const off = -BLOCK / 2 + 4 + k * 4;
          if (i + 1 < ROADS) {
            m.makeTranslation((roadCoord(i) + roadCoord(i + 1)) / 2 + off, 0.02, roadCoord(j));
            dashesH.setMatrixAt(dh++, m);
          }
          if (j + 1 < ROADS) {
            m.makeTranslation(roadCoord(i), 0.02, (roadCoord(j) + roadCoord(j + 1)) / 2 + off);
            dashesV.setMatrixAt(dv++, m);
          }
        }
      }
    }
    this.group.add(dashesH, dashesV);

    // crosswalk stripes on all four sides of every intersection
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.8 });
    const stripeGeoX = new THREE.BoxGeometry(0.6, 0.03, 2.4); // stripes for crossings that span the x-direction road
    const stripeGeoZ = new THREE.BoxGeometry(2.4, 0.03, 0.6);
    const stripesPer = 8;
    const stripesX = new THREE.InstancedMesh(stripeGeoX, stripeMat, ROADS * ROADS * 2 * stripesPer);
    const stripesZ = new THREE.InstancedMesh(stripeGeoZ, stripeMat, ROADS * ROADS * 2 * stripesPer);
    let sx = 0;
    let sz = 0;
    for (let i = 0; i < ROADS; i++) {
      for (let j = 0; j < ROADS; j++) {
        const x0 = roadCoord(i);
        const z0 = roadCoord(j);
        for (let k = 0; k < stripesPer; k++) {
          const t = -ROAD_HALF + 1 + k * ((ROAD_W - 2) / (stripesPer - 1));
          // crossings over the vertical road (walk along x): stripes located north / south of the intersection
          m.makeTranslation(x0 + t, 0.02, z0 - ROAD_HALF + 1.4);
          stripesX.setMatrixAt(sx++, m);
          m.makeTranslation(x0 + t, 0.02, z0 + ROAD_HALF - 1.4);
          stripesX.setMatrixAt(sx++, m);
          m.makeTranslation(x0 - ROAD_HALF + 1.4, 0.02, z0 + t);
          stripesZ.setMatrixAt(sz++, m);
          m.makeTranslation(x0 + ROAD_HALF - 1.4, 0.02, z0 + t);
          stripesZ.setMatrixAt(sz++, m);
        }
      }
    }
    this.group.add(stripesX, stripesZ);
  }

  private buildBlocks(): void {
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xb9b9b4, roughness: 0.9 });
    const lotMat = new THREE.MeshStandardMaterial({ color: 0x6b6f75, roughness: 0.95 });
    const grassTex = makeGrassTexture();
    grassTex.repeat.set(6, 6);
    const parkMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 });
    const hazardTex = makeHazardTexture();
    hazardTex.repeat.set(6, 6);
    const hazardMat = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 1 });
    const policeLotMat = new THREE.MeshStandardMaterial({ color: 0x5a6270, roughness: 0.95 });

    const blockGeo = new THREE.BoxGeometry(BLOCK, CURB_HEIGHT, BLOCK);
    const innerSize = BLOCK - SIDEWALK_W * 2;
    const innerGeo = new THREE.PlaneGeometry(innerSize, innerSize);

    for (const b of this.city.blocks) {
      const slab = new THREE.Mesh(blockGeo, curbMat);
      slab.position.set(b.cx, CURB_HEIGHT / 2, b.cz);
      slab.receiveShadow = true;
      this.group.add(slab);

      let mat: THREE.Material = lotMat;
      if (b.type === 'park') mat = parkMat;
      else if (b.type === 'restricted') mat = hazardMat;
      else if (b.type === 'police') mat = policeLotMat;
      const inner = new THREE.Mesh(innerGeo, mat);
      inner.rotation.x = -Math.PI / 2;
      inner.position.set(b.cx, CURB_HEIGHT + 0.01, b.cz);
      inner.receiveShadow = true;
      this.group.add(inner);
    }

    // outer ring sidewalk beyond the ring road
    const ringW = SIDEWALK_W;
    const ringLen = CITY_HALF * 2 + ringW * 2;
    const ringGeoH = new THREE.BoxGeometry(ringLen, CURB_HEIGHT, ringW);
    const ringGeoV = new THREE.BoxGeometry(ringW, CURB_HEIGHT, ringLen);
    for (const s of [-1, 1]) {
      const rh = new THREE.Mesh(ringGeoH, curbMat);
      rh.position.set(0, CURB_HEIGHT / 2, s * (CITY_HALF + ringW / 2));
      rh.receiveShadow = true;
      const rv = new THREE.Mesh(ringGeoV, curbMat);
      rv.position.set(s * (CITY_HALF + ringW / 2), CURB_HEIGHT / 2, 0);
      rv.receiveShadow = true;
      this.group.add(rh, rv);
    }
  }

  private facadeMaterial(style: number, w: number, h: number): THREE.MeshStandardMaterial {
    if (style >= 100) {
      const key = `special-${style}`;
      let mat = this.facadeMats.get(key);
      if (!mat) {
        let tex: THREE.CanvasTexture;
        if (style === 100) tex = makeIndustrialTexture('#c9743a', '#8a4a1f');
        else if (style === 101) tex = makeIndustrialTexture('#5d738c', '#2f4256');
        else if (style === 102) tex = makeIndustrialTexture('#dfe4ea', '#2b4fb3');
        else tex = makeIndustrialTexture('#6f705f', '#3f4034');
        tex.repeat.set(Math.max(1, Math.round(w / 8)), 1);
        mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
        this.facadeMats.set(key, mat);
      }
      return mat;
    }
    const base = this.facadeTextures[style % this.facadeTextures.length];
    const tex = base.clone();
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(h / 3.2)));
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
  }

  private buildBuilding(b: BuildingDesc): void {
    const sideMat = this.facadeMaterial(b.style, b.w, b.h);
    const roofColor = b.style >= 100 ? 0x4b4f55 : 0x55595f;
    const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 1 });
    const mats = [sideMat, sideMat, roofMat, roofMat, sideMat, sideMat];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mats);
    mesh.position.set(b.x, CURB_HEIGHT + b.h / 2, b.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);

    // roof trim + a small rooftop box for silhouette variety
    const trim = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.4, 0.35, b.d + 0.4), new THREE.MeshStandardMaterial({ color: 0x2f3338 }));
    trim.position.set(b.x, CURB_HEIGHT + b.h + 0.17, b.z);
    trim.castShadow = true;
    this.group.add(trim);
    if (b.h > 12 && b.style < 100) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.3, 1.2, b.d * 0.3), roofMat);
      box.position.set(b.x + b.w * 0.15, CURB_HEIGHT + b.h + 0.95, b.z - b.d * 0.15);
      box.castShadow = true;
      this.group.add(box);
    }
  }

  private buildProp(p: PropDesc): void {
    const y0 = CURB_HEIGHT;
    switch (p.kind) {
      case 'tree': {
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.32, p.h * 0.45, 7),
          new THREE.MeshStandardMaterial({ color: 0x6d4c2f, roughness: 1 }),
        );
        trunk.position.set(p.x, y0 + p.h * 0.225, p.z);
        trunk.castShadow = true;
        const crown = new THREE.Mesh(
          new THREE.SphereGeometry(p.h * 0.32, 10, 8),
          new THREE.MeshStandardMaterial({ color: (p.x * 7 + p.z * 13) % 2 === 0 ? 0x3f7d3a : 0x4f9142, roughness: 1 }),
        );
        crown.position.set(p.x, y0 + p.h * 0.7, p.z);
        crown.castShadow = true;
        this.group.add(trunk, crown);
        break;
      }
      case 'lamp': {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, p.h, 6), new THREE.MeshStandardMaterial({ color: 0x3c3f44, metalness: 0.5 }));
        pole.position.set(p.x, y0 + p.h / 2, p.z);
        pole.castShadow = true;
        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.3, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0xfff1c0, emissive: 0xffe08a, emissiveIntensity: 0.9 }),
        );
        head.position.set(p.x, y0 + p.h + 0.15, p.z);
        this.group.add(pole, head);
        break;
      }
      case 'bench': {
        const bench = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 }));
        bench.position.set(p.x, y0 + p.h / 2, p.z);
        bench.rotation.y = p.angle;
        bench.castShadow = true;
        this.group.add(bench);
        break;
      }
      case 'crate': {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), new THREE.MeshStandardMaterial({ color: 0xa8763e, roughness: 0.9 }));
        crate.position.set(p.x, y0 + p.h / 2, p.z);
        crate.rotation.y = p.angle;
        crate.castShadow = true;
        crate.receiveShadow = true;
        this.group.add(crate);
        break;
      }
      case 'fountain': {
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(p.w / 2, p.w / 2 + 0.2, p.h, 8), new THREE.MeshStandardMaterial({ color: 0xa9a9a0 }));
        rim.position.set(p.x, y0 + p.h / 2, p.z);
        rim.castShadow = true;
        const water = new THREE.Mesh(
          new THREE.CylinderGeometry(p.w / 2 - 0.4, p.w / 2 - 0.4, 0.1, 8),
          new THREE.MeshStandardMaterial({ color: 0x3fa7d6, roughness: 0.1, metalness: 0.2 }),
        );
        water.position.set(p.x, y0 + p.h + 0.02, p.z);
        const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 2.2, 8), new THREE.MeshStandardMaterial({ color: 0xa9a9a0 }));
        spout.position.set(p.x, y0 + p.h + 1.1, p.z);
        this.group.add(rim, water, spout);
        break;
      }
      case 'tank': {
        const tank = new THREE.Mesh(
          new THREE.CylinderGeometry(p.w / 2, p.w / 2, p.h, 16),
          new THREE.MeshStandardMaterial({ color: 0xb0b8b0, metalness: 0.6, roughness: 0.4 }),
        );
        tank.position.set(p.x, y0 + p.h / 2, p.z);
        tank.castShadow = true;
        tank.receiveShadow = true;
        const band = new THREE.Mesh(new THREE.CylinderGeometry(p.w / 2 + 0.05, p.w / 2 + 0.05, 0.4, 16), new THREE.MeshStandardMaterial({ color: 0xb71c1c }));
        band.position.set(p.x, y0 + p.h * 0.6, p.z);
        this.group.add(tank, band);
        break;
      }
      case 'fence': {
        const fence = new THREE.Mesh(
          new THREE.BoxGeometry(p.w, p.h, p.d),
          new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.6, metalness: 0.4, transparent: true, opacity: 0.75 }),
        );
        fence.position.set(p.x, y0 + p.h / 2, p.z);
        fence.rotation.y = p.angle;
        fence.castShadow = true;
        this.group.add(fence);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(p.w + 0.1, 0.12, p.d + 0.1), new THREE.MeshStandardMaterial({ color: 0xb71c1c }));
        rail.position.set(p.x, y0 + p.h, p.z);
        this.group.add(rail);
        break;
      }
      case 'hedge': {
        const hedge = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), new THREE.MeshStandardMaterial({ color: 0x2f6b2f, roughness: 1 }));
        hedge.position.set(p.x, p.h / 2, p.z);
        hedge.castShadow = true;
        this.group.add(hedge);
        break;
      }
      case 'barrier': {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), new THREE.MeshStandardMaterial({ color: p.color ?? 0xcccccc, roughness: 0.6 }));
        bar.position.set(p.x, y0 + p.h / 2, p.z);
        bar.rotation.y = p.angle;
        bar.castShadow = true;
        this.group.add(bar);
        break;
      }
    }
  }

  private buildSign(s: SignDesc): void {
    const tex = makeTextTexture(s.text, s.bg, s.fg);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35 }));
    mesh.position.set(s.x, s.y, s.z);
    mesh.rotation.y = s.yaw;
    this.group.add(mesh);
  }
}

/** Ground height at a world position: blocks are raised by the curb height. */
export function groundHeightAt(x: number, z: number): number {
  const half = BLOCK / 2;
  const ix = Math.floor((x + CITY_HALF) / PITCH);
  const iz = Math.floor((z + CITY_HALF) / PITCH);
  if (ix < 0 || iz < 0 || ix >= ROADS - 1 || iz >= ROADS - 1) {
    // outer ring sidewalk
    const ax = Math.abs(x);
    const az = Math.abs(z);
    const inRing = (ax >= CITY_HALF && ax <= CITY_HALF + SIDEWALK_W) || (az >= CITY_HALF && az <= CITY_HALF + SIDEWALK_W);
    return inRing && ax <= CITY_HALF + SIDEWALK_W && az <= CITY_HALF + SIDEWALK_W ? CURB_HEIGHT : 0;
  }
  const cx = roadCoord(ix) + ROAD_HALF + half;
  const cz = roadCoord(iz) + ROAD_HALF + half;
  if (Math.abs(x - cx) <= half && Math.abs(z - cz) <= half) return CURB_HEIGHT;
  return 0;
}
