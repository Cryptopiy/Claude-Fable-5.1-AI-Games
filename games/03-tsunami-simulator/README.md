# Tsunami Disaster Simulator

> **Как запустить готовую сборку / How to run the ready-made build:** см. / see [HOW_TO_PLAY.md](../../HOW_TO_PLAY.md) в корне репозитория / in the repository root. Если ниже упоминаются другие файлы запуска — их в этом репозитории нет / if other launch files are mentioned below, they are not part of this repository.

An interactive browser-based 3D tsunami simulation built with React, TypeScript, Vite, and Three.js. Everything in the scene is generated locally in code; there are no external APIs, map downloads, or asset dependencies.

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## How the model works

### Terrain and water propagation

The island is a 68 × 50 height field with 2-meter cells. The exact same elevation array drives both the Three.js terrain vertices and the flood model. It combines a rising coastal slope, an inland basin, two ridges, and a high-ground refuge. Roads subtract elevation from the terrain, so they can channel water naturally.

Each flood cell stores terrain height, water depth, and a smoothed two-dimensional flow vector. The west edge acts as an open ocean boundary whose water level follows a rise, peak, and recession envelope scaled by the selected 1–20 meter wave height. At fixed 50 ms simulation steps, water moves from cells with greater hydraulic head (`terrain + depth`) to lower reachable neighbors. A stability cap prevents any cell from exporting more water than it contains. Building footprints are blocked, so the flow must spread around them. Permanent ocean cells are rendered separately and are never counted as flooded land.

### Vehicle force model

Each vehicle samples the water depth and flow vector under its current world position. Water below the buoyancy threshold has little effect. Deeper water blends the vehicle velocity toward local flow using depth-dependent drag divided by vehicle mass. A rapidly rising local depth adds a small wave-front impulse. Vehicles bob and rotate while floating, are speed-clamped, stay within the terrain, and stop or rebound when their simplified collision circle reaches a building footprint. A vehicle is counted as displaced after moving more than 2.5 meters from its initial position.

## Controls

- Set **Wave height** from 1 to 20 meters. It may also be changed during an active run.
- Select **START TSUNAMI** to begin the progressive event.
- Select **RESET ENVIRONMENT** to clear all water, counters, flow, and vehicle motion.
- Drag the 3D view to orbit and use the wheel or trackpad to zoom.
- After a run settles, start again directly or reset first.

## Deliberate simplifications

- This is a stable height-field / shallow-flow approximation, not full computational fluid dynamics.
- Water uses four-neighbor grid transport and axis-aligned blocked building footprints.
- Vehicles use drag, buoyancy, and simple footprint collisions rather than a rigid-body physics engine.
- Buildings do not structurally fail; a subtle material change indicates surrounding floodwater.
- Simulation time advances at one displayed second per real second and stops after the recession period.

## File structure

```text
.
├── .gitignore
├── 03_disaster_simulator.md
├── index.html
├── package.json
├── README.md
├── Results
├── src
│   ├── App.tsx
│   ├── main.tsx
│   ├── styles.css
│   ├── simulation
│   │   ├── terrain.ts
│   │   ├── types.ts
│   │   ├── VehicleSystem.ts
│   │   └── WaterSimulation.ts
│   └── three
│       ├── sceneObjects.ts
│       └── TsunamiScene.tsx
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

## Acceptance checklist

- [x] Perspective 3D coastal terrain with visibly meaningful elevation
- [x] Ocean boundary, low coast, basin, ridges, and elevated safe area
- [x] Roads, 24 fixed buildings, and 8 movable vehicles
- [x] Adjustable 1–20 meter wave height changes inundation head and vehicle force
- [x] Large start button begins a continuously evolving event
- [x] Water enters progressively from the ocean edge using neighbor connectivity
- [x] Low ground floods before higher ground; roads and depressions channel or collect water
- [x] Dynamic water cells show the advancing front and varying water depth
- [x] Vehicles sample actual local water and can drift, rotate, and hit buildings
- [x] Flooded-area percentage excludes the permanent ocean and uses live land-cell depth
- [x] Maximum depth, flooded buildings, moved vehicles, and elapsed time update live
- [x] Reset restores water, flow, vehicle transforms, time, and counters
- [x] Repeated runs do not accumulate render loops, objects, or simulation state
- [x] Typed arrays, fixed time steps, instancing, and throttled UI statistics limit overhead

Per the delivery request, the project was not launched, built, or runtime-tested after implementation.
