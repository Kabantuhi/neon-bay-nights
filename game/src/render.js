// The renderer for Neon Bay Nights: the three.js scene, the third-person camera that follows
// Raka (or his car), and the day/night cycle — sun, sky and street light that change with the
// clock. The game logic lives in game.js; this file only paints its state.
import * as THREE from 'three';
import { CITY_HALF } from './config.js';

const DAY_SKY = new THREE.Color(0x87b5d6);
const SUNSET_SKY = new THREE.Color(0xff9a5c);
const NIGHT_SKY = new THREE.Color(0x0b1026);
const DAY_FOG = new THREE.Color(0x9ab8cc);
const NIGHT_FOG = new THREE.Color(0x0b1026);

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xff9a5c);
  scene.fog = new THREE.Fog(0x9ab8cc, 90, 320);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 800);
  camera.position.set(0, 8, 10);

  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffe0b0, 1.4);
  sun.position.set(60, 80, 40);
  scene.add(sun);
  const moon = new THREE.DirectionalLight(0x8fa8ff, 0.0);
  moon.position.set(-40, 60, -60);
  scene.add(moon);

  // A big gradient sky dome so the horizon is never a flat colour.
  const skyGeometry = new THREE.SphereGeometry(380, 16, 12);
  const skyMaterial = new THREE.MeshBasicMaterial({
    color: 0xff9a5c,
    side: THREE.BackSide,
    fog: false,
  });
  const sky = new THREE.Mesh(skyGeometry, skyMaterial);
  scene.add(sky);

  // A low sun disc that slides across the sky with the clock.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(14, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false }),
  );
  scene.add(sunDisc);

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  // Smooth camera: it eases toward its target so driving over bumps never jerks the view.
  let camX = 0;
  let camY = 8;
  let camZ = 10;
  let lookX = 0;
  let lookY = 2;
  let lookZ = 0;

  function updateCamera(state, dt) {
    const p = state.player;
    const driving = state.driving && state.playerCar;
    const dist = driving ? 13 : 8.5;
    const height = driving ? 5.2 : 4.2;
    const yaw = driving ? state.playerCar.heading : state.camYaw;
    const forwardX = Math.sin(yaw);
    const forwardZ = Math.cos(yaw);
    const tx = p.x - forwardX * dist;
    const tz = p.z - forwardZ * dist;
    const ty = p.y + height;
    const k = Math.min(1, dt * 6);
    camX += (tx - camX) * k;
    camZ += (tz - camZ) * k;
    camY += (ty - camY) * k;
    const lx = p.x + forwardX * 6;
    const lz = p.z + forwardZ * 6;
    const ly = p.y + 1.6;
    lookX += (lx - lookX) * Math.min(1, dt * 8);
    lookY += (ly - lookY) * Math.min(1, dt * 8);
    lookZ += (lz - lookZ) * Math.min(1, dt * 8);
    camera.position.set(camX, camY, camZ);
    camera.lookAt(lookX, lookY, lookZ);
  }

  function updateDayNight(state, lamps) {
    const hour = state.hour;
    // Daylight factor: 1 at noon, 0 at midnight, smooth through dawn and dusk.
    const sunAngle = ((hour - 6) / 12) * Math.PI;
    const daylight = Math.max(0, Math.sin(sunAngle));
    const dusk = Math.max(0, 1 - Math.abs(hour - 18) / 2.5);
    const skyColor = new THREE.Color().copy(NIGHT_SKY);
    if (daylight > 0) skyColor.lerp(DAY_SKY, daylight);
    if (dusk > 0) skyColor.lerp(SUNSET_SKY, dusk * 0.7);
    scene.background.copy(skyColor);
    skyMaterial.color.copy(skyColor);
    scene.fog.color.copy(skyColor).lerp(NIGHT_FOG, 0.15);
    sun.intensity = 0.15 + daylight * 1.35;
    sun.position.set(Math.cos(sunAngle) * 120, 40 + daylight * 70, 60);
    moon.intensity = (1 - daylight) * 0.5;
    ambient.intensity = 0.25 + daylight * 0.35;
    // The sun disc tracks the sun; street lamps glow after dark.
    const discX = Math.cos(sunAngle) * 300;
    const discY = 30 + Math.sin(sunAngle) * 220;
    sunDisc.position.set(discX, discY, -200);
    sunDisc.lookAt(camera.position);
    sunDisc.material.color.setHex(daylight > 0.05 ? 0xffd27a : 0xdde6ff);
    const night = 1 - daylight;
    for (const lamp of lamps) {
      lamp.bulb.material.color.setHex(night > 0.4 ? 0xffe9a8 : 0x8a8a7a);
    }
  }

  return {
    scene,
    camera,
    renderer,
    render(state, dt, lamps) {
      updateCamera(state, dt);
      updateDayNight(state, lamps);
      renderer.render(scene, camera);
    },
    resize,
  };
}
