import type { ObstacleDefinition, ObstacleType } from '../types';

export const OBSTACLES: Record<ObstacleType, ObstacleDefinition> = {
  concrete: {
    id: 'concrete',
    name: 'Reinforced concrete wall',
    shortName: 'Concrete wall',
    description: 'Fixed • near-zero give',
    massKg: Number.POSITIVE_INFINITY,
    restitution: 0.07,
    friction: 0.72,
    impactDurationS: 0.075,
    widthM: 0.72,
    depthM: 11.5,
    heightM: 2.7,
    color: 0x78818a,
  },
  heavy: {
    id: 'heavy',
    name: 'Mobile steel barrier',
    shortName: 'Heavy barrier',
    description: '5,000 kg • limited travel',
    massKg: 5000,
    restitution: 0.16,
    friction: 0.52,
    impactDurationS: 0.11,
    widthM: 1.15,
    depthM: 8.2,
    heightM: 1.65,
    color: 0xf2a51a,
  },
  light: {
    id: 'light',
    name: 'Polymer water barrier',
    shortName: 'Light barrier',
    description: '420 kg • high displacement',
    massKg: 420,
    restitution: 0.28,
    friction: 0.34,
    impactDurationS: 0.17,
    widthM: 1.0,
    depthM: 5.8,
    heightM: 1.1,
    color: 0xef553d,
  },
};

export const obstacleList = Object.values(OBSTACLES);
