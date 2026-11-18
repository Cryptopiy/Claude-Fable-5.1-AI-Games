import type { MissionState } from '../game/systems/MissionSystem';

export interface HudState {
  mode: 'ON FOOT' | 'DRIVING';
  speedKmh: number;
  vehicleName: string;
  objective: string;
  missionState: MissionState;
  missionTimeLeft: number | null;
  wantedLevel: number;
  wantedMessage: string;
  escapeProgress: number;
  hint: string;
  banner: string | null;
  showHelp: boolean;
  fps: number;
}

export const INITIAL_HUD: HudState = {
  mode: 'ON FOOT',
  speedKmh: 0,
  vehicleName: '',
  objective: '',
  missionState: 'idle',
  missionTimeLeft: null,
  wantedLevel: 0,
  wantedMessage: '',
  escapeProgress: 0,
  hint: '',
  banner: null,
  showHelp: true,
  fps: 0,
};
