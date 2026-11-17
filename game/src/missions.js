// The story of Neon Bay Nights — original fiction, original characters. Raka, a bike courier,
// owes money to the wrong people and works it off one job at a time, until the jobs point at
// the man who runs the whole bay: Victor Marlowe, the harbour king.
import { CITY_HALF } from './config.js';

export const STORY_INTRO = [
  'Neon Bay. A city that never sleeps and never forgives.',
  'Raka owes $5,000 to the harbour crew. Tonight, he starts paying it back — one job at a time.',
  'Follow the yellow marker. Finish the job, get paid, stay alive.',
];

// Each mission: a title, who gives it, short dialogue, a target on the map, a type and a reward.
// Targets are street corners of the city grid, chosen by hand so every job crosses town.
export const MISSIONS = [
  {
    id: 1,
    title: 'First Delivery',
    giver: 'Mira — the Fixer',
    lines: [
      'Mira: "Raka. One parcel, one address. Don\'t open it, don\'t stop for anyone."',
      'Mira: "The yellow marker is the drop-off. Walk or drive — just get there."',
    ],
    type: 'goto',
    target: { x: -66, z: 66, label: 'Drop-off: Palm Court' },
    reward: 400,
    hint: 'Reach the yellow marker.',
  },
  {
    id: 2,
    title: 'Borrowed Wheels',
    giver: 'Mira — the Fixer',
    lines: [
      'Mira: "You\'re too slow on foot. Take any car on the street — press E next to one."',
      'Mira: "The owner might object. That\'s their problem. Drive to the garage."',
    ],
    type: 'drive',
    target: { x: 66, z: -66, label: 'Garage: Dockside Motors' },
    reward: 650,
    hint: 'Steal a car (E) and drive to the marker.',
  },
  {
    id: 3,
    title: 'The Pickup',
    giver: 'Dario — the Driver',
    lines: [
      'Dario: "My cousin left a package at the pier. The harbour crew is watching it."',
      'Dario: "Grab it fast and bring it to me. If the cops show up, don\'t stop running."',
    ],
    type: 'pickup',
    target: { x: 22, z: 110, label: 'Pier package' },
    targetB: { x: -22, z: -22, label: 'Dario\'s corner' },
    reward: 900,
    hint: 'Grab the package at the pier, then bring it to Dario.',
  },
  {
    id: 4,
    title: 'Harbour Trouble',
    giver: 'Mira — the Fixer',
    lines: [
      'Mira: "Marlowe\'s goons are shaking down my couriers at the market."',
      'Mira: "You have a pistol now. Make them leave. Punch (F) or shoot (click)."',
    ],
    type: 'combat',
    target: { x: 66, z: 22, label: 'Market square' },
    enemies: 3,
    reward: 1200,
    hint: 'Deal with the 3 goons at the market.',
  },
  {
    id: 5,
    title: 'Hot Pursuit',
    giver: 'Dario — the Driver',
    lines: [
      'Dario: "Marlowe\'s courier is running with our money. He\'s fast and he\'s armed."',
      'Dario: "Chase his car down and take him out before he reaches the bridge."',
    ],
    type: 'chase',
    target: { x: -66, z: -66, label: 'Bridge checkpoint' },
    reward: 1800,
    hint: 'Catch the fleeing courier car before it escapes.',
  },
  {
    id: 6,
    title: 'The Harbour King',
    giver: 'Mira — the Fixer',
    lines: [
      'Mira: "It all leads to Marlowe. His yacht, his men, his money — at the marina."',
      'Mira: "Finish this and your debt is gone. Neon Bay is yours, Raka."',
    ],
    type: 'finale',
    target: { x: 0, z: 110, label: 'Marina: Marlowe\'s yacht' },
    enemies: 5,
    reward: 3000,
    hint: 'Storm the marina and deal with Marlowe\'s crew.',
  },
];

export function getMission(index) {
  if (index < 0 || index >= MISSIONS.length) return null;
  return MISSIONS[index];
}

export function missionCount() {
  return MISSIONS.length;
}

/** The current objective position for a mission in a given stage (0 = first leg). */
export function missionTarget(mission, stage) {
  if (stage === 1 && mission.targetB) return mission.targetB;
  return mission.target;
}

export function storyCompleteText() {
  return 'Marlowe is done. The debt is paid, the bay is quiet — for tonight. Raka owns Neon Bay.';
}

// A goon is a hostile pedestrian: same mesh as a pedestrian, but it chases and punches.
export function goonLabel(index) {
  return `Goon ${index + 1}`;
}

export const SPAWN_POINTS = {
  playerStart: { x: 0, z: -22 },
  marina: { x: 0, z: 110 },
  market: { x: 66, z: 22 },
};

export const CITY_BOUNDS = CITY_HALF;
