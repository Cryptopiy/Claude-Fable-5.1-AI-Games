import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CrashSimulation } from '../physics/simulation';
import type { CrashResult, SimulationConfig, SimulationSnapshot } from '../types';
import { CrashEffects } from '../three/effects';
import {
  applyCarDamage,
  createCar,
  createEnvironment,
  createObstacle,
  disposeObject,
} from '../three/visuals';

interface CrashSceneProps {
  config: SimulationConfig;
  sceneVersion: number;
  running: boolean;
  onTelemetry: (snapshot: SimulationSnapshot) => void;
  onComplete: (result: CrashResult) => void;
}

export function CrashScene({
  config,
  sceneVersion,
  running,
  onTelemetry,
  onComplete,
}: CrashSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const telemetryRef = useRef(onTelemetry);
  const completeRef = useRef(onComplete);
  telemetryRef.current = onTelemetry;
  completeRef.current = onComplete;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d12);
    scene.fog = new THREE.FogExp2(0x090d12, 0.018);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 180);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    createEnvironment(scene);
    const car = createCar();
    const obstacle = createObstacle(config.obstacleType);
    scene.add(car.group, obstacle);

    const hemisphere = new THREE.HemisphereLight(0xbcecf4, 0x1a2024, 1.55);
    scene.add(hemisphere);
    const keyLight = new THREE.DirectionalLight(0xf2fbff, 4.2);
    keyLight.position.set(-8, 15, 10);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.left = -24;
    keyLight.shadow.camera.right = 24;
    keyLight.shadow.camera.top = 18;
    keyLight.shadow.camera.bottom = -18;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 60;
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0x3be7e4, 28, 28, 1.8);
    rimLight.position.set(-7, 4, -6);
    scene.add(rimLight);
    const impactLight = new THREE.PointLight(0xff6a2a, 0, 18, 2);
    impactLight.position.set(-1, 1.2, 0);
    scene.add(impactLight);

    const simulation = new CrashSimulation(config);
    const effects = new CrashEffects(scene);
    let impactTriggered = false;
    let animationFrame = 0;
    let previousTime = performance.now();
    let accumulator = 0;
    let telemetryElapsed = 0;
    const fixedStep = 1 / 120;
    const cameraTarget = new THREE.Vector3();
    const desiredCamera = new THREE.Vector3();

    const setVisualState = (snapshot: SimulationSnapshot, dt: number) => {
      car.group.position.set(snapshot.carPosition.x, 0.02, snapshot.carPosition.z);
      car.group.rotation.set(snapshot.carRoll, snapshot.carYaw, snapshot.carPitch, 'YXZ');
      obstacle.position.set(snapshot.obstaclePosition.x, 0, snapshot.obstaclePosition.z);

      const wheelTravel = (snapshot.currentSpeedKmh / 3.6) * dt / 0.38;
      car.wheels.forEach((wheel) => {
        wheel.rotation.z -= wheelTravel;
      });

      if (snapshot.impact && !impactTriggered) {
        impactTriggered = true;
        applyCarDamage(car, snapshot.impact.zone, snapshot.impact.damagePct);
        const speed = Math.max(Math.hypot(snapshot.carVelocity.x, snapshot.carVelocity.z), 0.01);
        effects.burst(snapshot.carPosition, snapshot.impact.damagePct, {
          x: snapshot.carVelocity.x / speed,
          z: snapshot.carVelocity.z / speed,
        });
      }

      effects.addTireMarks(
        snapshot.carPosition,
        snapshot.carYaw,
        snapshot.phase === 'settling' && snapshot.currentSpeedKmh > 2,
      );
      effects.update(dt);
      impactLight.intensity = snapshot.impactFlash * 42;

      const headingX = Math.cos(snapshot.carYaw);
      const headingZ = -Math.sin(snapshot.carYaw);
      const sideX = -headingZ;
      const sideZ = headingX;
      desiredCamera.set(
        snapshot.carPosition.x - headingX * 8.5 + sideX * 9.5,
        6.4,
        snapshot.carPosition.z - headingZ * 8.5 + sideZ * 9.5,
      );

      if (snapshot.impactFlash > 0.08) {
        const shake = snapshot.impactFlash * 0.16;
        desiredCamera.x += Math.sin(snapshot.elapsedS * 93) * shake;
        desiredCamera.y += Math.sin(snapshot.elapsedS * 117) * shake;
        desiredCamera.z += Math.cos(snapshot.elapsedS * 81) * shake;
      }

      camera.position.lerp(desiredCamera, 1 - Math.exp(-dt * 3.2));
      cameraTarget.set(
        snapshot.carPosition.x + headingX * 3.2,
        0.75,
        snapshot.carPosition.z + headingZ * 3.2,
      );
      camera.lookAt(cameraTarget);
    };

    if (running) simulation.start();
    const initial = simulation.snapshot;
    const initialHeadingX = Math.cos(initial.carYaw);
    const initialHeadingZ = -Math.sin(initial.carYaw);
    const initialSideX = -initialHeadingZ;
    const initialSideZ = initialHeadingX;
    camera.position.set(
      initial.carPosition.x - initialHeadingX * 8.5 + initialSideX * 9.5,
      6.4,
      initial.carPosition.z - initialHeadingZ * 8.5 + initialSideZ * 9.5,
    );
    setVisualState(initial, 0);
    telemetryRef.current({ ...initial });

    const resize = () => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    const animate = (time: number) => {
      const realDt = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;
      const timeScale = config.slowMotion ? 0.28 : 1;
      const scaledDt = realDt * timeScale;
      accumulator += scaledDt;
      let result: CrashResult | null = null;

      while (accumulator >= fixedStep && !result) {
        result = simulation.step(fixedStep);
        accumulator -= fixedStep;
      }

      setVisualState(simulation.snapshot, scaledDt);
      telemetryElapsed += realDt;
      if (telemetryElapsed >= 0.06 || result) {
        telemetryElapsed = 0;
        telemetryRef.current({
          ...simulation.snapshot,
          carPosition: { ...simulation.snapshot.carPosition },
          carVelocity: { ...simulation.snapshot.carVelocity },
          obstaclePosition: { ...simulation.snapshot.obstaclePosition },
          obstacleVelocity: { ...simulation.snapshot.obstacleVelocity },
        });
      }
      if (result) completeRef.current(result);

      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      effects.dispose();
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
    };
    // sceneVersion is an intentional reset token; config is captured atomically.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneVersion]);

  return (
    <div className="scene-canvas" ref={containerRef}>
      <div className="camera-tag">
        <span className="record-dot" /> CAM 01 · DYNAMIC TRACK
      </div>
      <div className="scale-legend" aria-hidden="true">
        <span>0</span><i /><span>5 m</span>
      </div>
    </div>
  );
}
