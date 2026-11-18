import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createTerrainData, sampleElevation } from '../simulation/terrain';
import { WaterSimulation } from '../simulation/WaterSimulation';
import {
  createVehicleStates,
  resetVehicleStates,
  stepVehicles,
} from '../simulation/VehicleSystem';
import type { SimulationStats, VehicleState } from '../simulation/types';
import {
  createBuildings,
  createOcean,
  createRoadMarkings,
  createTerrainBase,
  createTerrainMesh,
  createVehicles,
  createWaterInstances,
  type BuildingVisual,
} from './sceneObjects';

export interface TsunamiSceneHandle {
  start: (waveHeight: number) => void;
  reset: () => void;
  setWaveHeight: (waveHeight: number) => void;
}

interface TsunamiSceneProps {
  onStats: (stats: SimulationStats) => void;
}

export const TsunamiScene = forwardRef<TsunamiSceneHandle, TsunamiSceneProps>(
  function TsunamiScene({ onStats }, ref) {
    const hostRef = useRef<HTMLDivElement>(null);
    const onStatsRef = useRef(onStats);
    const simulationRef = useRef<WaterSimulation | null>(null);
    const vehicleStatesRef = useRef<VehicleState[]>([]);
    const terrain = useMemo(() => createTerrainData(), []);

    useEffect(() => {
      onStatsRef.current = onStats;
    }, [onStats]);

    const emitStats = (): void => {
      const simulation = simulationRef.current;
      if (!simulation) return;
      const displaced = vehicleStatesRef.current.reduce(
        (total, vehicle) => total + (vehicle.displaced ? 1 : 0),
        0,
      );
      onStatsRef.current(simulation.getStats(displaced));
    };

    useImperativeHandle(ref, () => ({
      start: (waveHeight: number) => {
        const simulation = simulationRef.current;
        if (!simulation) return;
        resetVehicleStates(vehicleStatesRef.current);
        simulation.start(waveHeight);
        emitStats();
      },
      reset: () => {
        const simulation = simulationRef.current;
        if (!simulation) return;
        simulation.reset();
        resetVehicleStates(vehicleStatesRef.current);
        emitStats();
      },
      setWaveHeight: (waveHeight: number) => {
        simulationRef.current?.setWaveHeight(waveHeight);
      },
    }));

    useEffect(() => {
      const host = hostRef.current;
      if (!host) return undefined;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x99b6b3);
      scene.fog = new THREE.FogExp2(0x9bb9b5, 0.0036);

      const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 600);
      camera.position.set(112, 91, 118);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.setAttribute('role', 'img');
      renderer.domElement.setAttribute(
        'aria-label',
        'Interactive 3D coastal city showing terrain, buildings, vehicles, and simulated flood water',
      );
      renderer.domElement.tabIndex = 0;
      host.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(2, 4, 0);
      controls.enableDamping = true;
      controls.dampingFactor = 0.055;
      controls.minDistance = 54;
      controls.maxDistance = 245;
      controls.maxPolarAngle = Math.PI * 0.475;
      controls.update();

      const hemisphere = new THREE.HemisphereLight(0xd9f2ef, 0x6b6750, 2.15);
      scene.add(hemisphere);
      const sun = new THREE.DirectionalLight(0xfff0d1, 3.2);
      sun.position.set(-65, 112, 58);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -95;
      sun.shadow.camera.right = 95;
      sun.shadow.camera.top = 80;
      sun.shadow.camera.bottom = -80;
      sun.shadow.camera.near = 10;
      sun.shadow.camera.far = 260;
      sun.shadow.bias = -0.00025;
      scene.add(sun);

      scene.add(createTerrainBase(terrain));
      scene.add(createTerrainMesh(terrain));
      scene.add(createRoadMarkings(terrain));
      const buildings = createBuildings(terrain);
      scene.add(buildings.group);

      const simulation = new WaterSimulation(terrain);
      simulationRef.current = simulation;
      const vehicleStates = createVehicleStates(terrain);
      vehicleStatesRef.current = vehicleStates;
      const vehicleObjects = createVehicles(vehicleStates, terrain);
      for (const vehicle of vehicleObjects) scene.add(vehicle);

      const waterInstances = createWaterInstances(terrain);
      scene.add(waterInstances);
      const ocean = createOcean(terrain);
      scene.add(ocean.mesh, ocean.foam);

      const gridMarker = createOrientationMarker();
      gridMarker.position.set(58, sampleElevation(terrain, 58, 43) + 0.1, 43);
      scene.add(gridMarker);

      const instanceDummy = new THREE.Object3D();
      const shallowColor = new THREE.Color(0x55c7d0);
      const deepColor = new THREE.Color(0x075782);
      const waterColor = new THREE.Color();
      let accumulator = 0;
      let lastTime = performance.now();
      let visualTime = 0;
      let statsTimer = 0;
      let animationFrame = 0;
      const fixedStep = 0.05;

      const updateWaterVisuals = (): void => {
        let visibleCount = 0;
        const maxInstances = terrain.columns * terrain.rows;

        for (let row = 0; row < terrain.rows; row += 1) {
          for (let column = 0; column < terrain.columns; column += 1) {
            const index = row * terrain.columns + column;
            const depth = simulation.waterDepth[index];
            if (depth <= 0.025 || terrain.blocked[index] || visibleCount >= maxInstances) continue;

            const x = terrain.originX + column * terrain.cellSize;
            const z = terrain.originZ + row * terrain.cellSize;
            instanceDummy.position.set(x, terrain.elevations[index] + depth * 0.5 + 0.025, z);
            instanceDummy.scale.set(1, Math.max(0.05, depth), 1);
            instanceDummy.rotation.set(0, 0, 0);
            instanceDummy.updateMatrix();
            waterInstances.setMatrixAt(visibleCount, instanceDummy.matrix);
            const depthMix = Math.min(1, depth / 5.5);
            waterColor.lerpColors(shallowColor, deepColor, depthMix);
            waterInstances.setColorAt(visibleCount, waterColor);
            visibleCount += 1;
          }
        }

        waterInstances.count = visibleCount;
        waterInstances.instanceMatrix.needsUpdate = true;
        if (waterInstances.instanceColor) waterInstances.instanceColor.needsUpdate = true;
      };

      const updateVehicleVisuals = (): void => {
        for (let index = 0; index < vehicleStates.length; index += 1) {
          const state = vehicleStates[index];
          const object = vehicleObjects[index];
          const depth = simulation.getDepthAtWorld(state.x, state.z);
          const buoyancy = smoothstep(0.25, 1.1, depth);
          const ground = sampleElevation(terrain, state.x, state.z);
          object.position.set(state.x, ground + 0.15 + buoyancy * Math.min(1.15, depth * 0.45), state.z);
          object.rotation.set(state.pitch, -state.yaw, state.roll);
        }
      };

      const updateBuildingFloodState = (visuals: BuildingVisual[]): void => {
        for (const building of visuals) {
          const xOffset = building.width * 0.5 + terrain.cellSize;
          const zOffset = building.depth * 0.5 + terrain.cellSize;
          const depth = Math.max(
            simulation.getDepthAtWorld(building.x - xOffset, building.z),
            simulation.getDepthAtWorld(building.x + xOffset, building.z),
            simulation.getDepthAtWorld(building.x, building.z - zOffset),
            simulation.getDepthAtWorld(building.x, building.z + zOffset),
          );
          const wetness = Math.min(1, depth / 2.5);
          building.material.emissive.setRGB(0.015 * wetness, 0.13 * wetness, 0.16 * wetness);
          building.material.roughness = 0.82 - wetness * 0.2;
        }
      };

      const animate = (now: number): void => {
        const frameDelta = Math.min(0.1, Math.max(0, (now - lastTime) / 1000));
        const runningAtFrameStart = simulation.isRunning();
        lastTime = now;
        visualTime += frameDelta;
        statsTimer += frameDelta;
        accumulator = Math.min(0.3, accumulator + frameDelta);

        while (accumulator >= fixedStep) {
          if (simulation.isRunning()) {
            simulation.step(fixedStep);
            stepVehicles(vehicleStates, terrain, simulation, fixedStep, simulation.getElapsed());
          }
          accumulator -= fixedStep;
        }

        ocean.material.uniforms.uTime.value = visualTime;
        const centerEdgeIndex = Math.floor(terrain.rows / 2) * terrain.columns;
        const edgeDepth = simulation.waterDepth[centerEdgeIndex];
        ocean.material.uniforms.uSurge.value = Math.min(1, edgeDepth / 8);
        ocean.foam.position.y = 0.16 + Math.min(2.4, edgeDepth * 0.16);
        ocean.foam.scale.z = 0.96 + Math.sin(visualTime * 2.4) * 0.025;

        updateWaterVisuals();
        updateVehicleVisuals();
        if (animationFrame % 4 === 0) updateBuildingFloodState(buildings.visuals);
        if (statsTimer >= 0.14 && (runningAtFrameStart || simulation.isRunning())) {
          emitStats();
          statsTimer = 0;
        }

        controls.update();
        renderer.render(scene, camera);
        animationFrame = requestAnimationFrame(animate);
      };

      const resize = (): void => {
        const width = Math.max(1, host.clientWidth);
        const height = Math.max(1, host.clientHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      resize();
      emitStats();
      animationFrame = requestAnimationFrame(animate);

      return () => {
        cancelAnimationFrame(animationFrame);
        resizeObserver.disconnect();
        controls.dispose();
        scene.traverse((object) => {
          if (!(object instanceof THREE.Mesh || object instanceof THREE.Sprite)) return;
          object.geometry?.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            if ('map' in material && material.map instanceof THREE.Texture) material.map.dispose();
            material.dispose();
          }
        });
        renderer.dispose();
        renderer.domElement.remove();
        simulationRef.current = null;
        vehicleStatesRef.current = [];
      };
    }, [terrain]);

    return <div ref={hostRef} className="scene-host" />;
  },
);

function createOrientationMarker(): THREE.Group {
  const group = new THREE.Group();
  const green = new THREE.MeshStandardMaterial({ color: 0xa5d87e, emissive: 0x142b0d });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 0.45, 24), green);
  base.position.y = 0.22;
  group.add(base);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.35, 4.5, 5), green);
  cone.position.y = 2.7;
  group.add(cone);
  return group;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
