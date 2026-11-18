export const ROADS = 6; // roads per axis -> (ROADS-1)^2 blocks
export const BLOCK = 34; // block size (including sidewalks)
export const ROAD_W = 12;
export const ROAD_HALF = ROAD_W / 2;
export const LANE_OFFSET = 3; // lane centre offset from the road centre line (right-hand traffic)
export const SIDEWALK_W = 3;
export const PITCH = BLOCK + ROAD_W;
export const CITY_SPAN = (ROADS - 1) * PITCH;
export const CITY_HALF = CITY_SPAN / 2 + ROAD_HALF;
export const WORLD_LIMIT = CITY_HALF + 14;
export const CURB_HEIGHT = 0.15;
export const INTERSECTION_MARGIN = 2; // distance past the road edge where lane entry / exit points sit

export const roadCoord = (i: number): number => -CITY_SPAN / 2 + i * PITCH;
export const blockCenter = (b: number): number => roadCoord(b) + ROAD_HALF + BLOCK / 2;
