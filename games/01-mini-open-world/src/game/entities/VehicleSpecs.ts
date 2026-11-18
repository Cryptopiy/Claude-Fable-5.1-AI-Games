export type VehicleKind = 'sedan' | 'hatch' | 'van' | 'taxi' | 'police' | 'pickup';

export interface VehicleSpec {
  kind: VehicleKind;
  hx: number; // half width
  hz: number; // half length
  bodyHeight: number;
  cabin: { w: number; h: number; l: number; z: number };
  maxSpeed: number; // units per second
  accel: number;
  brake: number;
  drag: number;
  maxSteer: number; // radians at the front wheels
  mass: number;
}

const base = {
  drag: 0.32,
  maxSteer: 0.62,
};

export const VEHICLE_SPECS: Record<VehicleKind, VehicleSpec> = {
  sedan: {
    ...base,
    kind: 'sedan',
    hx: 1.0,
    hz: 2.2,
    bodyHeight: 0.7,
    cabin: { w: 1.7, h: 0.6, l: 2.1, z: -0.2 },
    maxSpeed: 27,
    accel: 9.5,
    brake: 24,
    mass: 1,
  },
  hatch: {
    ...base,
    kind: 'hatch',
    hx: 0.92,
    hz: 1.9,
    bodyHeight: 0.7,
    cabin: { w: 1.6, h: 0.62, l: 2.0, z: -0.35 },
    maxSpeed: 25,
    accel: 9,
    brake: 24,
    mass: 0.9,
  },
  taxi: {
    ...base,
    kind: 'taxi',
    hx: 1.0,
    hz: 2.2,
    bodyHeight: 0.7,
    cabin: { w: 1.7, h: 0.6, l: 2.1, z: -0.2 },
    maxSpeed: 27,
    accel: 9.5,
    brake: 24,
    mass: 1,
  },
  van: {
    ...base,
    kind: 'van',
    hx: 1.1,
    hz: 2.5,
    bodyHeight: 0.8,
    cabin: { w: 2.05, h: 1.0, l: 3.7, z: -0.5 },
    maxSpeed: 22,
    accel: 7.5,
    brake: 20,
    mass: 1.5,
  },
  pickup: {
    ...base,
    kind: 'pickup',
    hx: 1.05,
    hz: 2.5,
    bodyHeight: 0.75,
    cabin: { w: 1.85, h: 0.75, l: 1.6, z: 0.5 },
    maxSpeed: 24,
    accel: 8.5,
    brake: 22,
    mass: 1.3,
  },
  police: {
    ...base,
    kind: 'police',
    hx: 1.0,
    hz: 2.3,
    bodyHeight: 0.7,
    cabin: { w: 1.7, h: 0.6, l: 2.2, z: -0.2 },
    maxSpeed: 31,
    accel: 12,
    brake: 26,
    mass: 1.1,
  },
};
