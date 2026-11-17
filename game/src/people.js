// People of Neon Bay: pedestrians who stroll the sidewalks and flee gunfire, police
// officers on foot who chase and bust the player, and the player character — a courier
// named Raka who gets pulled into the city's underworld. All original characters.
import * as THREE from 'three';
import { CITY_HALF } from './config.js';
import { collideCircle } from './city.js';

const SKIN = [0xe8b98a, 0xc98d5f, 0x8a5a34, 0xf0c8a0];
const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0xfd7e14, 0x1abc9c, 0xecf0f1];
const PANTS = [0x2c3e50, 0x34495e, 0x5d4037, 0x1a1a1a];

export function createPersonMesh(shirt, pants, skin, isPolice) {
  const group = new THREE.Group();
  const skinMaterial = new THREE.MeshLambertMaterial({ color: skin });
  const shirtMaterial = new THREE.MeshLambertMaterial({ color: isPolice ? 0x1a2a4a : shirt });
  const pantsMaterial = new THREE.MeshLambertMaterial({ color: isPolice ? 0x101418 : pants });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), pantsMaterial);
  legs.position.y = 0.4;
  group.add(legs);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.34), shirtMaterial);
  body.position.y = 1.15;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skinMaterial);
  head.position.y = 1.75;
  group.add(head);
  const armMaterial = shirtMaterial;
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.65, 0.16), armMaterial);
  leftArm.position.set(-0.4, 1.15, 0);
  group.add(leftArm);
  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.65, 0.16), armMaterial);
  rightArm.position.set(0.4, 1.15, 0);
  group.add(rightArm);
  if (isPolice) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 10), new THREE.MeshLambertMaterial({ color: 0x0e1420 }));
    cap.position.y = 1.98;
    group.add(cap);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.02), new THREE.MeshBasicMaterial({ color: 0xffd700 }));
    badge.position.set(-0.16, 1.35, 0.18);
    group.add(badge);
  }
  return { group, leftArm, rightArm, body };
}

export function makePedestrian(x, z, rng) {
  const skin = rng.pick(SKIN);
  const { group, leftArm, rightArm } = createPersonMesh(rng.pick(SHIRTS), rng.pick(PANTS), skin, false);
  group.position.set(x, 0, z);
  return {
    mesh: group,
    leftArm,
    rightArm,
    x,
    z,
    heading: rng.range(0, Math.PI * 2),
    speed: rng.range(1.2, 2.2),
    walkPhase: rng.range(0, Math.PI * 2),
    target: null,
    fleeing: false,
    fleeTimer: 0,
    alive: true,
  };
}

export function spawnPedestrians(scene, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const x = rng.range(-CITY_HALF, CITY_HALF);
    const z = rng.range(-CITY_HALF, CITY_HALF);
    const ped = makePedestrian(x, z, rng);
    scene.add(ped.mesh);
    peds.push(ped);
  }
  return peds;
}

/** Pick a nearby sidewalk spot to stroll toward. */
function pickStrollTarget(ped, rng) {
  return {
    x: Math.max(-CITY_HALF, Math.min(CITY_HALF, ped.x + rng.range(-30, 30))),
    z: Math.max(-CITY_HALF, Math.min(CITY_HALF, ped.z + rng.range(-30, 30))),
  };
}

export function updatePedestrian(ped, dt, rng, colliders, danger) {
  if (!ped.alive) return;
  if (danger && Math.hypot(danger.x - ped.x, danger.z - ped.z) < 18) {
    ped.fleeing = true;
    ped.fleeTimer = 3;
  }
  if (ped.fleeTimer > 0) ped.fleeTimer -= dt;
  else ped.fleeing = false;
  if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.z - ped.z) < 1.5) {
    ped.target = pickStrollTarget(ped, rng);
  }
  let tx = ped.target.x;
  let tz = ped.target.z;
  let speed = ped.speed;
  if (ped.fleeing && danger) {
    // Run away from the danger, down the street.
    const dx = ped.x - danger.x;
    const dz = ped.z - danger.z;
    const len = Math.hypot(dx, dz) || 1;
    tx = ped.x + (dx / len) * 20;
    tz = ped.z + (dz / len) * 20;
    speed = 5.5;
  }
  const dx = tx - ped.x;
  const dz = tz - ped.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 0.05) {
    const want = Math.atan2(dx, dz);
    let diff = want - ped.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    ped.heading += Math.max(-3 * dt, Math.min(3 * dt, diff));
    ped.x += Math.sin(ped.heading) * speed * dt;
    ped.z += Math.cos(ped.heading) * speed * dt;
  }
  const pos = { x: ped.x, z: ped.z };
  collideCircle(pos, 0.5, colliders);
  ped.x = pos.x;
  ped.z = pos.z;
  ped.walkPhase += dt * speed * 2.4;
  const swing = Math.sin(ped.walkPhase) * (ped.fleeing ? 0.9 : 0.5);
  ped.leftArm.rotation.x = swing;
  ped.rightArm.rotation.x = -swing;
  ped.mesh.position.set(ped.x, 0, ped.z);
  ped.mesh.rotation.y = ped.heading;
}

export function makePoliceOfficer(x, z, rng) {
  const { group, leftArm, rightArm } = createPersonMesh(0, 0, rng.pick(SKIN), true);
  group.position.set(x, 0, z);
  return {
    mesh: group,
    leftArm,
    rightArm,
    x,
    z,
    heading: 0,
    speed: 0,
    walkPhase: rng.range(0, Math.PI * 2),
    bustTimer: 0,
    alive: true,
  };
}

/** An officer runs at the player; standing close for a while busts them. */
export function updatePoliceOfficer(officer, dt, targetX, targetZ, colliders, bustTime) {
  if (!officer.alive) return 0;
  const dx = targetX - officer.x;
  const dz = targetZ - officer.z;
  const dist = Math.hypot(dx, dz);
  const speed = dist > 12 ? 6.5 : 5.2;
  const want = Math.atan2(dx, dz);
  let diff = want - officer.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  officer.heading += Math.max(-4 * dt, Math.min(4 * dt, diff));
  officer.x += Math.sin(officer.heading) * speed * dt;
  officer.z += Math.cos(officer.heading) * speed * dt;
  const pos = { x: officer.x, z: officer.z };
  collideCircle(pos, 0.5, colliders);
  officer.x = pos.x;
  officer.z = pos.z;
  officer.walkPhase += dt * speed * 2.4;
  const swing = Math.sin(officer.walkPhase) * 0.8;
  officer.leftArm.rotation.x = swing;
  officer.rightArm.rotation.x = -swing;
  officer.mesh.position.set(officer.x, 0, officer.z);
  officer.mesh.rotation.y = officer.heading;
  if (dist < 2.6) {
    officer.bustTimer += dt;
    if (officer.bustTimer >= bustTime) return 2; // busted
    return 1; // closing in
  }
  officer.bustTimer = Math.max(0, officer.bustTimer - dt * 2);
  return 0;
}
