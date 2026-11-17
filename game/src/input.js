// Keyboard + mouse input for Neon Bay Nights. WASD moves, Shift runs, E enters/exits a car,
// F punches, R reloads, Space jumps, mouse drag orbits the camera, click shoots, Esc pauses.
// The input object only records state; the game reads it each fixed step.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_RELOAD = 16;
export const ACTION_JUMP = 32;

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  Space: ACTION_CONFIRM,
  Escape: ACTION_PAUSE,
  KeyE: ACTION_ENTER,
  KeyF: ACTION_PUNCH,
  KeyR: ACTION_RELOAD,
};

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let actions = 0;
  let mouseDown = false;
  let mouseClicked = false;
  let dragX = 0;
  let dragY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    pressed.add(event.code);
    const action = KEY_ACTIONS[event.code];
    if (action !== undefined) actions |= action;
    if (event.code === 'Space') event.preventDefault();
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onMouseDown(event) {
    if (event.button === 0) {
      mouseDown = true;
      mouseClicked = true;
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
    }
  }
  function onMouseMove(event) {
    if (!dragging) return;
    dragX += event.clientX - lastX;
    dragY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  }
  function onMouseUp() {
    dragging = false;
    mouseDown = false;
  }
  function onBlur() {
    keys.clear();
    dragging = false;
    mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('blur', onBlur);

  return {
    // Movement axes in camera space: forward/back and strafe, each -1..1.
    move() {
      let forward = 0;
      let strafe = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) forward += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) forward -= 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) strafe -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) strafe += 1;
      return { forward, strafe };
    },
    running() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeJump() {
      if (pressed.has('Space')) {
        pressed.delete('Space');
        return true;
      }
      return false;
    },
    // Mouse drag since the last read, in pixels; the camera consumes it.
    takeDrag() {
      const taken = { x: dragX, y: dragY };
      dragX = 0;
      dragY = 0;
      return taken;
    },
    takeClick() {
      const clicked = mouseClicked;
      mouseClicked = false;
      return clicked;
    },
    mouseHeld() {
      return mouseDown;
    },
    clearPressed() {
      pressed.clear();
    },
  };
}
