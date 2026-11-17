// The HUD for Neon Bay Nights: health, money, wanted stars, clock, speed, mission objective,
// a live canvas minimap, dialogue box and the menu overlays. All DOM — the 3D view stays clean.
import { BLOCK, BLOCKS, CITY_HALF, WANTED } from './config.js';

function starString(stars) {
  let out = '';
  for (let i = 0; i < WANTED.maxStars; i += 1) out += i < stars ? '★' : '☆';
  return out;
}

function formatClock(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function createHud() {
  const el = (id) => document.getElementById(id);
  const hud = el('hud');
  const starsEl = el('stars');
  const healthFill = el('health-fill');
  const healthText = el('health-text');
  const moneyEl = el('money');
  const clockEl = el('clock');
  const objectiveEl = el('objective-text');
  const objectiveDist = el('objective-dist');
  const speedEl = el('speed');
  const speedValue = el('speed-value');
  const minimap = el('minimap');
  const minimapCtx = minimap.getContext('2d');
  const dialogueEl = el('dialogue');
  const dialogueText = el('dialogue-text');
  const toastEl = el('toast');
  const crosshair = el('crosshair');
  const screens = {
    start: el('screen-start'),
    pause: el('screen-pause'),
    dead: el('screen-dead'),
    busted: el('screen-busted'),
    done: el('screen-done'),
  };
  let toastTimer = null;
  let dialogueTimer = null;

  function showScreen(name) {
    for (const key of Object.keys(screens)) {
      if (screens[key]) screens[key].classList.toggle('hidden', key !== name);
    }
    hud.classList.toggle('hidden', name === 'start');
  }

  function drawMinimap(state) {
    const size = minimap.width;
    const scale = size / (CITY_HALF * 2 + 40);
    const toMap = (x, z) => [(x + CITY_HALF + 20) * scale, (z + CITY_HALF + 20) * scale];
    minimapCtx.fillStyle = '#141a20';
    minimapCtx.fillRect(0, 0, size, size);
    // Bay at the bottom.
    minimapCtx.fillStyle = '#1e6f8e';
    const bay = toMap(-CITY_HALF - 20, CITY_HALF + 8);
    minimapCtx.fillRect(0, bay[1], size, size - bay[1]);
    // Roads.
    minimapCtx.strokeStyle = '#5a6270';
    minimapCtx.lineWidth = 4;
    for (let i = 0; i <= BLOCKS; i += 1) {
      const line = -CITY_HALF + i * BLOCK;
      const a = toMap(line, -CITY_HALF);
      const b = toMap(line, CITY_HALF);
      minimapCtx.beginPath();
      minimapCtx.moveTo(a[0], a[1]);
      minimapCtx.lineTo(b[0], b[1]);
      minimapCtx.stroke();
      const c = toMap(-CITY_HALF, line);
      const d = toMap(CITY_HALF, line);
      minimapCtx.beginPath();
      minimapCtx.moveTo(c[0], c[1]);
      minimapCtx.lineTo(d[0], d[1]);
      minimapCtx.stroke();
    }
    const dot = (x, z, color, r) => {
      const p = toMap(x, z);
      minimapCtx.fillStyle = color;
      minimapCtx.beginPath();
      minimapCtx.arc(p[0], p[1], r, 0, Math.PI * 2);
      minimapCtx.fill();
    };
    // Mission marker.
    if (state.missionTarget) dot(state.missionTarget.x, state.missionTarget.z, '#ffe600', 5);
    // Goons.
    for (const goon of state.goons || []) if (goon.alive) dot(goon.x, goon.z, '#ff4040', 3);
    // Police cars and officers.
    for (const car of state.policeCars || []) dot(car.x, car.z, '#4080ff', 3.5);
    for (const officer of state.officers || []) dot(officer.x, officer.z, '#4080ff', 3);
    // Traffic.
    for (const car of state.traffic || []) dot(car.x, car.z, '#c8c8c8', 2);
    // Player arrow, pointing where the player faces.
    const p = toMap(state.player.x, state.player.z);
    minimapCtx.save();
    minimapCtx.translate(p[0], p[1]);
    minimapCtx.rotate(state.player.heading);
    minimapCtx.fillStyle = '#ffffff';
    minimapCtx.beginPath();
    minimapCtx.moveTo(0, -7);
    minimapCtx.lineTo(5, 6);
    minimapCtx.lineTo(-5, 6);
    minimapCtx.closePath();
    minimapCtx.fill();
    minimapCtx.restore();
    // North edge.
    minimapCtx.fillStyle = '#ffffff';
    minimapCtx.font = 'bold 11px sans-serif';
    minimapCtx.fillText('N', size / 2 - 4, 12);
  }

  return {
    showScreen,
    hideAllScreens() {
      for (const key of Object.keys(screens)) {
        if (screens[key]) screens[key].classList.add('hidden');
      }
      hud.classList.remove('hidden');
    },
    setStartStats(money, missionsDone, hasSaveGame) {
      const stats = el('start-stats');
      if (stats) {
        stats.textContent = hasSaveGame
          ? `Save found: $${money} — ${missionsDone} of ${6} jobs done. Press C to continue.`
          : 'New game: Raka owes $5,000. Six jobs stand between him and freedom.';
      }
    },
    update(state) {
      starsEl.textContent = starString(state.wanted);
      starsEl.classList.toggle('hot', state.wanted > 0);
      const health = Math.max(0, Math.round(state.player.health));
      healthFill.style.width = `${health}%`;
      healthFill.classList.toggle('low', health < 30);
      healthText.textContent = `${health}`;
      moneyEl.textContent = `$${Math.round(state.money).toLocaleString('en-US')}`;
      clockEl.textContent = formatClock(state.hour);
      if (state.mission) {
        objectiveEl.textContent = `${state.mission.id}. ${state.mission.title} — ${state.mission.hint}`;
        if (state.missionTarget) {
          const dist = Math.hypot(state.missionTarget.x - state.player.x, state.missionTarget.z - state.player.z);
          objectiveDist.textContent = `${Math.round(dist)}m → ${state.missionTarget.label}`;
        } else objectiveDist.textContent = '';
      } else {
        objectiveEl.textContent = 'Free roam — Neon Bay is yours. Press M for the next job.';
        objectiveDist.textContent = '';
      }
      if (state.driving && state.playerCar) {
        speedEl.classList.remove('hidden');
        speedValue.textContent = `${Math.round(Math.abs(state.playerCar.speed) * 3.6)}`;
      } else {
        speedEl.classList.add('hidden');
      }
      crosshair.classList.toggle('hidden', !(state.player.hasPistol && !state.driving));
      drawMinimap(state);
    },
    showDialogue(lines, seconds) {
      dialogueText.textContent = lines.join(' ');
      dialogueEl.classList.remove('hidden');
      if (dialogueTimer) window.clearTimeout(dialogueTimer);
      dialogueTimer = window.setTimeout(() => dialogueEl.classList.add('hidden'), (seconds || 7) * 1000);
    },
    hideDialogue() {
      dialogueEl.classList.add('hidden');
      if (dialogueTimer) window.clearTimeout(dialogueTimer);
    },
    toast(message, seconds) {
      toastEl.textContent = message;
      toastEl.classList.remove('hidden');
      if (toastTimer) window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => toastEl.classList.add('hidden'), (seconds || 3) * 1000);
    },
    setEndText(title, body) {
      const titleEl = el('end-title');
      if (titleEl) titleEl.textContent = title;
      for (const id of ['end-body-dead', 'end-body-busted', 'end-body-done']) {
        const bodyEl = el(id);
        if (bodyEl) bodyEl.textContent = body;
      }
    },
  };
}
