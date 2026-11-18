# Vector // Car Crash Lab

> **Как запустить готовую сборку / How to run the ready-made build:** см. / see [HOW_TO_PLAY.md](../../HOW_TO_PLAY.md) в корне репозитория / in the repository root. Если ниже упоминаются другие файлы запуска — их в этом репозитории нет / if other launch files are mentioned below, they are not part of this repository.

An interactive deterministic 3D crash-test laboratory built with React, TypeScript,
Vite and Three.js. All geometry is generated at runtime; the project uses no external
models, textures, API keys or backend.

## Run

```bash
npm install
npm run dev
```

## Physics model

The simulation uses a fixed 120 Hz time step. The vehicle is an oriented 3D box and
the selected barrier is an axis-aligned 3D box. At contact, the solver:

1. derives a collision normal from volume penetration;
2. splits relative velocity into normal and tangential components;
3. applies a restitution impulse using both bodies' inverse masses;
4. applies a Coulomb-limited friction impulse;
5. converts the off-axis impulse into vehicle yaw;
6. integrates post-impact sliding with rolling resistance and quadratic drag.

The concrete wall has infinite effective mass. The steel barrier weighs 5,000 kg and
the polymer barrier 420 kg, so the same vehicle meaningfully displaces each one by a
different amount.

Estimated average impact force is the normal impulse divided by an assumed crush
interval: 75 ms for concrete, 110 ms for steel, and 170 ms for the light polymer
barrier. Damage is a bounded percentage derived from dissipated normal collision
energy: `100 × (1 − exp(−E / 430 kJ))`. It is intended for controlled comparison,
not engineering certification.

## Included features

- 10–200 km/h speed, 700–3,000 kg mass, and −60° to +60° trajectory controls
- three obstacles with distinct mass, friction, restitution, and impact duration
- perspective camera, shadows, procedural vehicle and laboratory environment
- rigid-body rebound, sliding, yaw, barrier displacement, and stable settling
- energy-derived deformation, correct impact zone, debris, sparks, tire marks, shake
- live speed and impact telemetry plus a complete final report
- session history for the latest five completed experiments
- reliable reset and repeat runs; optional deterministic slow motion
- responsive desktop, laptop, and tablet layouts
