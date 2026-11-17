// Neon Bay Nights — boot and the one loop. Input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves between screens:
// start, playing, paused, wasted, busted and story complete.
//
// ?seed=N fixes the city layout. ?shot=start|drive|police|mission (with &seed=N) stages that
// scene instead of running the loop, paints it a few times and sets window.__shotReady.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createGame } from './game.js';
import { createRenderer } from './render.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE } from './input.js';
import { stageShot } from './shots.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { STORY_INTRO } from './missions.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const rng = createRandom(seed);
const audio = createAudio();
const hud = createHud();
const renderer = createRenderer(canvas);
const game = createGame(renderer.scene, rng, audio, hud);
const state = game.state;
const lamps = game.city.lamps;

function announce(message) {
  status.textContent = message;
}

function runShot(name) {
  const staged = stageShot(name, game);
  hud.update(state);
  if (staged.screen === 'start') {
    hud.showScreen('start');
    hud.setStartStats(state.money, state.missionsDone, false);
  } else {
    hud.hideAllScreens();
  }
  let painted = 0;
  function paint() {
    renderer.render(state, STEP, lamps);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = 'start';
  let saveData = loadGame();

  function startNewGame() {
    game.reset();
    game.startMission(0);
    screen = 'play';
    hud.hideAllScreens();
    hud.showDialogue(STORY_INTRO, 9);
    audio.unlock();
    audio.startMusic();
    announce('Playing Neon Bay Nights. Follow the yellow marker.');
  }

  function continueGame() {
    if (!saveData) {
      startNewGame();
      return;
    }
    game.applySave(saveData);
    screen = 'play';
    hud.hideAllScreens();
    hud.showDialogue(['Welcome back to Neon Bay, Raka. The jobs are waiting.'], 5);
    audio.unlock();
    audio.startMusic();
    announce('Continuing your saved game.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      if (screen === 'start') startNewGame();
      else if (screen === 'dead' || screen === 'busted') {
        hud.showScreen('start');
        screen = 'start';
        hud.setStartStats(state.money, state.missionsDone, hasSave());
        announce('Neon Bay Nights. Press Enter or click to start.');
      } else if (screen === 'done') {
        hud.showScreen('start');
        screen = 'start';
        announce('Neon Bay Nights. Press Enter or click to start.');
      } else if (screen === 'pause') {
        screen = 'play';
        hud.hideAllScreens();
        announce('Playing.');
      }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === 'play') {
        screen = 'pause';
        hud.showScreen('pause');
        announce('Paused.');
      } else if (screen === 'pause') {
        screen = 'play';
        hud.hideAllScreens();
        announce('Playing.');
      }
    }
    return actions;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const actions = handleActions();
    if (screen !== 'play') return;
    game.stepPlaying(STEP, input, actions);
    // The game can end itself (wasted / busted / story done) inside a step.
    if (state.dead || state.busted || state.storyDone) {
      screen = state.screen;
    }
    renderer.render(state, STEP, lamps);
  }

  // Extra keys that are not part of the fixed-step actions: M starts the next job (or
  // retries a failed one), C continues a save from the title screen, F5-style quick save
  // is on the S key, and N toggles the music.
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.code === 'KeyM' && screen === 'play' && !state.mission && !state.storyDone) {
      game.startMission(state.missionIndex);
      hud.toast(`Job ${state.missionIndex + 1} started.`, 2);
    }
    if (event.code === 'KeyM' && screen === 'play' && state.missionFailed) {
      game.startMission(state.missionIndex);
    }
    if (event.code === 'KeyC' && screen === 'start' && hasSave()) continueGame();
    if (event.code === 'KeyS' && screen === 'play') {
      const ok = saveGame(state);
      hud.toast(ok ? 'Game saved.' : 'Could not save (storage is off).', 2);
    }
    if (event.code === 'KeyN') {
      const muted = audio.toggleMute();
      hud.toast(muted ? 'Sound off.' : 'Sound on.', 1);
    }
    if (event.code === 'KeyC' && screen === 'start' && !hasSave()) startNewGame();
  });

  // Clicking the start screen also starts the game (the canvas covers the screen).
  canvas.addEventListener('mousedown', () => {
    if (screen === 'start') startNewGame();
    else if (screen === 'dead' || screen === 'busted' || screen === 'done') {
      hud.showScreen('start');
      screen = 'start';
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'pause';
      hud.showScreen('pause');
      announce('Paused.');
    }
  });

  hud.showScreen('start');
  hud.setStartStats(state.money, state.missionsDone, hasSave());
  announce('Neon Bay Nights. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
