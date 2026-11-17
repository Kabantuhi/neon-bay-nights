// Neon Bay — configuration for "Neon Bay Nights", an original open-world crime game.
// Every number that tunes the city, the cars, the police and the missions lives here so the
// rest of the game can stay readable. Nothing here comes from any commercial game.
export const GAME_TITLE = 'Neon Bay Nights';
export const CITY_NAME = 'Neon Bay';

// The city is a grid of blocks. Roads run between blocks; block centres sit on a lattice.
export const BLOCK = 44; // distance between block centres, in metres
export const BLOCKS = 5; // blocks per side (5 x 5 = 25 blocks)
export const ROAD_WIDTH = 12;
export const CITY_HALF = (BLOCKS * BLOCK) / 2; // 110
export const WORLD_SIZE = CITY_HALF * 2 + 80;

// Player on foot.
export const PLAYER = {
  walkSpeed: 7,
  runSpeed: 11,
  health: 100,
  punchDamage: 25,
  punchRange: 2.2,
  pistolDamage: 34,
  pistolRange: 90,
  magazine: 12,
  startMoney: 150,
};

// Cars.
export const CAR = {
  accel: 22,
  brake: 34,
  reverseAccel: 12,
  maxSpeed: 38,
  maxReverse: 10,
  turnRate: 1.9,
  drag: 0.35,
};

// Wanted level and police.
export const WANTED = {
  maxStars: 5,
  decayDelay: 14, // seconds without a crime before stars start falling
  decayStep: 9, // seconds per star lost while hidden
  bustRange: 2.6,
  bustTime: 2.2, // seconds a cop must stay close on foot to bust the player
};

// Day / night.
export const DAY_LENGTH = 240; // seconds for a full day
export const START_HOUR = 17.5; // golden hour at the start screen

// Traffic and pedestrians.
export const TRAFFIC_CARS = 14;
export const PEDESTRIANS = 26;

// Missions pay out in dollars; the story is original fiction about Neon Bay.
export const MISSION_REWARDS = [400, 650, 900, 1200, 1800, 3000];

export const SAVE_KEY = 'neon-bay-nights-save-v1';
export const STEP = 1 / 60;
