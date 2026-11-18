# Mini Open World

> **Как запустить готовую сборку / How to run the ready-made build:** см. / see [HOW_TO_PLAY.md](../../HOW_TO_PLAY.md) в корне репозитория / in the repository root. Если ниже упоминаются другие файлы запуска — их в этом репозитории нет / if other launch files are mentioned below, they are not part of this repository.

A compact real-time 3D open-world sandbox in the browser: walk, drive, traffic, pedestrians,
collisions, one courier mission and a police pursuit system - all in one simulation.

Built with **TypeScript + React + Vite + Three.js**. No backend, no external assets: every model,
texture and the whole city are generated in code.

## Install & run

```bash
npm install
npm run dev
```

Open the printed URL (default `http://localhost:5173`). `npm run build` type-checks and creates a
production build.

## Controls

| Key                     | Action                                        |
| ----------------------- | --------------------------------------------- |
| `W A S D` / arrow keys  | Move on foot (camera relative) / drive        |
| `E`                     | Enter the nearest car / exit (when slow)      |
| `Space`                 | Handbrake while driving                       |
| `R`                     | Restart / replay the mission                  |
| `H`                     | Toggle the controls panel                     |

## Gameplay

- **Mission "Courier run"**: walk to the yellow marker at the *Dispatch Depot* (you spawn next to
  it), get into the marked orange delivery van, drive it to the green marker at the *Harbor
  Warehouse* on the east side before the timer runs out. Success / failure banners are shown;
  `R` resets the van and the mission so it can be replayed.
- **Police**: hitting a pedestrian with your car, ramming a police car, wrecking three vehicles in
  a short time or entering the fenced *Restricted Area* (north-east) raises the wanted level
  (1-3 stars). One police car per star leaves the station (city centre) and pursues you on foot or
  in a car, using the road network and line-of-sight steering. Stay far away from the police for
  ~14 s to lose a star. If a police car stops next to you while you are on foot or almost
  stationary, you are **busted**: you respawn in front of the station and an active mission fails.

## Implemented systems

| Area            | Where                                     | Notes |
| --------------- | ----------------------------------------- | ----- |
| Game loop       | `src/game/Game.ts`                        | Fixed 60 Hz simulation step with accumulator, rendering every frame, throttled HUD snapshots pushed to React |
| Input           | `src/game/input/Input.ts`                 | Window-level key tracking, one-shot presses, no focus loss after UI interaction |
| World data      | `src/game/world/*`                        | Seeded procedural 5x5-block city, road graph (intersections + lanes), sidewalk graph, special blocks (depot, warehouse, police station, restricted area, parks), static collider list |
| Rendering       | `src/game/render/*`                       | Three.js meshes for roads, curbs, buildings with canvas facade textures, props, signs, cars, humanoids, mission markers; chase camera; sun light with player-following shadow frustum, fog |
| Player          | `src/game/entities/Player.ts`             | Camera-relative running with inertia, circle collider, walk animation, enter/exit logic (valid non-colliding exit spot search) |
| Vehicles        | `src/game/entities/Vehicle.ts`            | Arcade car model: throttle/brake/reverse, drag, lateral grip, speed-dependent bicycle steering, handbrake slides, wheel/steer/brake-light visuals |
| Traffic AI      | `src/game/ai/TrafficAI.ts`                | Lane following through intersections with random routing, following distance, pedestrian/player yielding, intersection priority, stuck recovery |
| Pedestrian AI   | `src/game/entities/Pedestrian.ts`         | State machine (walk / wait / flee / knocked down) over the sidewalk network with individual speeds and stuck detection |
| Police AI       | `src/game/ai/PoliceAI.ts`                 | BFS path over the road graph to the player, direct pursuit with line-of-sight, feeler-based obstacle avoidance, return-to-station |
| Collisions      | `src/game/physics/*`                      | 2D OBB/OBB (SAT) and circle/OBB tests on the ground plane, positional correction, impulse response with mass, event reporting for gameplay |
| Wanted system   | `src/game/systems/WantedSystem.ts`        | Crimes, star level, police activation, escape timer, busted detection |
| Mission         | `src/game/systems/MissionSystem.ts`       | Idle -> get car -> drive -> complete/failed, markers, timer, restart |
| HUD             | `src/ui/HUD.tsx`                          | Mode, speed, mission objective and timer, wanted stars, hints, banners, controls |

## File structure

```
01_mini_open_world/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  README.md
  src/
    main.tsx
    App.tsx
    styles.css
    ui/
      HUD.tsx
      hudState.ts
    game/
      Game.ts
      core/
        mathUtils.ts
        rng.ts
      input/
        Input.ts
      physics/
        collision.ts
        CollisionSystem.ts
      world/
        constants.ts
        CityMap.ts
        RoadGraph.ts
        SidewalkGraph.ts
      entities/
        VehicleSpecs.ts
        Vehicle.ts
        Player.ts
        Pedestrian.ts
      ai/
        AIContext.ts
        TrafficAI.ts
        PoliceAI.ts
      systems/
        WantedSystem.ts
        MissionSystem.ts
      render/
        Models.ts
        Textures.ts
        WorldBuilder.ts
        FollowCamera.ts
```

## Implementation notes

- Simulation state lives entirely in plain TypeScript classes; React only renders the HUD from a
  snapshot published ~10 times per second.
- Collision volumes are oriented boxes (cars, buildings, props) and circles (people) evaluated on
  the XZ plane, matching the 3D geometry; curbs raise entities visually but do not block them.
- Right-hand traffic: lane centres are offset 3 units from the road centre line; intersection entry
  and exit points are generated from the road graph for both traffic and police routing.
- Parked cars and slow/stopped traffic cars can be entered; police cars cannot.
