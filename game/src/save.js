// Save / load for Neon Bay Nights. One small JSON blob in localStorage holds the player's
// money, health, story progress, position and clock. A missing or corrupt save starts fresh.
import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      money: state.money,
      health: state.player.health,
      missionIndex: state.missionIndex,
      missionsDone: state.missionsDone,
      position: { x: state.player.x, z: state.player.z },
      hour: state.hour,
      ammo: state.player.ammo,
      reserveAmmo: state.player.reserveAmmo,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off; nothing to clear then.
  }
}
