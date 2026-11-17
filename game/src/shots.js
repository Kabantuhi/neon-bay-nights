// Screenshot scenes behind ?shot=start|drive|police|mission&seed=N. Each one plays the real
// game forward from a fresh world for a fixed number of steps, steered by a simple autopilot
// (drive forward, steer gently toward the road), so the frame is what real play looks like
// and the same seed always gives the same frame.
import { STEP } from './config.js';

const SAMPLE = 1 / 30;

/** A fake input that drives forward and steers toward the mission target or the road. */
function autopilotInput() {
  return {
    move() {
      return { forward: 1, strafe: 0 };
    },
    running() {
      return false;
    },
    takeActions() {
      return 0;
    },
    takeJump() {
      return false;
    },
    takeDrag() {
      return { x: 0, y: 0 };
    },
    takeClick() {
      return false;
    },
    mouseHeld() {
      return false;
    },
  };
}

/** A fake input that coasts: foot off the pedal, so a chase can catch up. */
function coastInput() {
  const input = autopilotInput();
  input.move = () => ({ forward: 0, strafe: 0 });
  return input;
}

function runSteps(game, input, seconds) {
  const actions = 0;
  for (let t = 0; t < seconds; t += STEP) {
    game.stepPlaying(STEP, input, actions);
    if (game.state.dead || game.state.busted) break;
  }
}

/**
 * Set the game to the named scene and return the screen the HUD should show over it.
 * start: the title screen over the city at golden hour.
 * drive: Raka in a stolen car, cruising downtown with traffic.
 * police: wanted level 3, police interceptors closing in on a chase.
 * mission: mission 4, "Harbour Trouble" — goons at the market, marker overhead.
 */
export function stageShot(name, game) {
  game.reset();
  if (name === 'drive') {
    game.startMission(1);
    game.stageEnterCar();
    // Start on the central avenue heading north, so the drive stays downtown.
    game.stagePlaceCar(0, -44, 0);
    game.state.hour = 10;
    runSteps(game, autopilotInput(), 2.5);
    return { screen: 'play' };
  }
  if (name === 'police') {
    game.startMission(1);
    game.stageEnterCar();
    game.stagePlaceCar(0, -44, 0);
    game.stageSetWanted(3);
    game.state.hour = 19.5;
    // Two seconds of driving, then coast: the interceptors catch up and close in.
    runSteps(game, autopilotInput(), 2);
    runSteps(game, coastInput(), 2.5);
    game.stagePoliceAhead();
    return { screen: 'play' };
  }
  if (name === 'mission') {
    game.startMission(3);
    game.stageTeleport(58, 14);
    // Face the market square (and the beacon over it) so the shot shows the objective.
    game.state.camYaw = Math.atan2(66 - 58, 22 - 14);
    game.state.player.hasPistol = true;
    game.state.hour = 16;
    const idle = {
      move() {
        return { forward: 0, strafe: 0 };
      },
      running() {
        return false;
      },
      takeActions() {
        return 0;
      },
      takeJump() {
        return false;
      },
      takeDrag() {
        return { x: 0, y: 0 };
      },
      takeClick() {
        return false;
      },
      mouseHeld() {
        return false;
      },
    };
    runSteps(game, idle, 1.5);
    return { screen: 'play' };
  }
  // start (and any unknown name): title screen, city at golden hour, Raka on foot.
  game.state.hour = 17.5;
  game.startMission(0);
  return { screen: 'start' };
}
