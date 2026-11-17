// Cars for Neon Bay Nights: the mesh factory, parked cars to steal, traffic that follows the
// road grid, and police interceptors that chase the player. Every car is original geometry:
// boxes, cylinders and a light bar — no borrowed models.
import * as THREE from 'three';
import { CAR, CITY_HALF } from './config.js';
import { collideCircle, isOnRoad, nearestRoadPoint, randomRoadPosition } from './city.js';

const TRAFFIC_COLORS = [0xd8d8d8, 0x2a2a2e, 0xb8332a, 0x2a6db8, 0xe0a030, 0x4a8f5f, 0x7a4a9e, 0xc0c8d0];
const WHEEL_GEOMETRY = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
const WHEEL_MATERIAL = new THREE.MeshLambertMaterial({ color: 0x141414 });

export function createCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.7, 4.4), bodyMaterial);
  body.position.y = 0.65;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.65, 2.2),
    new THREE.MeshLambertMaterial({ color: 0x1a2028 }),
  );
  cabin.position.set(0, 1.3, -0.2);
  group.add(cabin);
  const wheels = [];
  for (const [wx, wz] of [[-1.0, 1.4], [1.0, 1.4], [-1.0, -1.4], [1.0, -1.4]]) {
    const wheel = new THREE.Mesh(WHEEL_GEOMETRY, WHEEL_MATERIAL);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  // Headlights and tail lights.
  const headMaterial = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const hx of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), headMaterial);
    head.position.set(hx, 0.7, 2.22);
    group.add(head);
  }
  const tailMaterial = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const tx of [-0.7, 0.7]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tailMaterial);
    tail.position.set(tx, 0.7, -2.22);
    group.add(tail);
  }
  let lightBar = null;
  if (isPolice) {
    lightBar = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.25, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff2020 }),
    );
    lightBar.position.set(0, 1.75, -0.2);
    group.add(lightBar);
    const star = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.5, 0.05),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    star.position.set(0, 0.7, 2.24);
    group.add(star);
  }
  return { group, wheels, lightBar };
}

export function makeCar(x, z, heading, color, kind) {
  const isPolice = kind === 'police';
  const { group, wheels, lightBar } = createCarMesh(isPolice ? 0x111418 : color, isPolice);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  return {
    mesh: group,
    wheels,
    lightBar,
    x,
    z,
    heading,
    speed: 0,
    color,
    kind,
    driver: kind === 'traffic',
    target: null,
    stuck: 0,
    flash: 0,
  };
}

/** A parked car sits at a road edge, engine off, waiting to be stolen. */
export function spawnParkedCars(scene, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const road = randomRoadPosition(rng);
    const heading = road.alongRoad === 'x' ? 0 : Math.PI / 2;
    const side = rng.chance(0.5) ? 1 : -1;
    const x = road.alongRoad === 'x' ? road.x : road.x + side * 4.6;
    const z = road.alongRoad === 'x' ? road.z + side * 4.6 : road.z;
    const car = makeCar(x, z, heading + (rng.chance(0.5) ? 0 : Math.PI), rng.pick(TRAFFIC_COLORS), 'parked');
    scene.add(car.mesh);
    cars.push(car);
  }
  return cars;
}

export function spawnTraffic(scene, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const road = randomRoadPosition(rng);
    const heading = road.alongRoad === 'x' ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
    const car = makeCar(road.x, road.z, heading, rng.pick(TRAFFIC_COLORS), 'traffic');
    car.speed = rng.range(6, 11);
    scene.add(car.mesh);
    cars.push(car);
  }
  return cars;
}

/** Pick the next intersection along the car's current heading. */
function nextIntersection(car) {
  const dirX = Math.sin(car.heading);
  const dirZ = Math.cos(car.heading);
  const step = 44;
  let x = car.x + dirX * step;
  let z = car.z + dirZ * step;
  x = Math.max(-CITY_HALF, Math.min(CITY_HALF, x));
  z = Math.max(-CITY_HALF, Math.min(CITY_HALF, z));
  return { x, z };
}

export function updateTraffic(car, dt, rng, allCars) {
  if (!car.target) car.target = nextIntersection(car);
  const dx = car.target.x - car.x;
  const dz = car.target.z - car.z;
  const dist = Math.hypot(dx, dz);
  const wantHeading = Math.atan2(dx, dz);
  let diff = wantHeading - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
  // Slow down for the car ahead on the same road.
  let desired = 9;
  for (const other of allCars) {
    if (other === car || other.kind === 'parked') continue;
    const ox = other.x - car.x;
    const oz = other.z - car.z;
    const ahead = ox * Math.sin(car.heading) + oz * Math.cos(car.heading);
    const side = Math.abs(ox * Math.cos(car.heading) - oz * Math.sin(car.heading));
    if (ahead > 0 && ahead < 9 && side < 2.4) {
      desired = Math.min(desired, Math.max(0, other.speed - 1));
    }
  }
  car.speed += (desired - car.speed) * Math.min(1, dt * 1.2);
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  if (dist < 3 || Math.abs(car.x) > CITY_HALF + 2 || Math.abs(car.z) > CITY_HALF + 2) {
    // At an intersection: mostly straight on, sometimes turn.
    if (rng.chance(0.35)) car.heading += rng.pick([-Math.PI / 2, Math.PI / 2]);
    car.x = Math.max(-CITY_HALF, Math.min(CITY_HALF, car.x));
    car.z = Math.max(-CITY_HALF, Math.min(CITY_HALF, car.z));
    car.target = nextIntersection(car);
  }
  // Keep traffic on the roads: nudge a drifting car back to the nearest road line.
  if (!isOnRoad(car.x, car.z)) {
    const near = nearestRoadPoint(car.x, car.z);
    car.x += (near.x - car.x) * Math.min(1, dt * 0.8);
    car.z += (near.z - car.z) * Math.min(1, dt * 0.8);
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  for (const wheel of car.wheels) wheel.rotation.x += (car.speed * dt) / 0.42;
}

/** Player driving: arcade handling — W/S throttle, A/D steer, Space handbrake. */
export function drivePlayerCar(car, move, dt, colliders) {
  const forward = move.forward;
  const steer = move.strafe;
  if (forward > 0) car.speed += CAR.accel * dt;
  else if (forward < 0) {
    car.speed -= (car.speed > 0.5 ? CAR.brake : CAR.reverseAccel) * dt;
  } else {
    car.speed -= car.speed * CAR.drag * dt;
    if (Math.abs(car.speed) < 0.1) car.speed = 0;
  }
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
  const steerAmount = steer * CAR.turnRate * dt * Math.min(1, Math.abs(car.speed) / 8 + 0.25) * (car.speed < 0 ? -1 : 1);
  car.heading += steerAmount;
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  // Buildings stop the car; a hard hit costs a little speed and makes a sound (the game
  // listens for the speed drop through the returned impact value).
  let impact = 0;
  const probe = { x: nx, z: nz };
  collideCircle(probe, 1.6, colliders);
  if (probe.x !== nx || probe.z !== nz) {
    impact = Math.abs(car.speed);
    car.speed *= 0.35;
  }
  car.x = probe.x;
  car.z = probe.z;
  car.x = Math.max(-CITY_HALF - 30, Math.min(CITY_HALF + 30, car.x));
  car.z = Math.max(-CITY_HALF - 30, Math.min(CITY_HALF + 34, car.z));
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  for (const wheel of car.wheels) wheel.rotation.x += (car.speed * dt) / 0.42;
  return impact;
}

export function spawnPoliceCar(scene, x, z, rng) {
  const heading = rng.range(0, Math.PI * 2);
  const car = makeCar(x, z, heading, 0x111418, 'police');
  car.speed = 14;
  scene.add(car.mesh);
  return car;
}

/** A police interceptor steers at the player and rams; its light bar flashes red/blue. */
export function updatePoliceCar(car, dt, targetX, targetZ, time) {
  const dx = targetX - car.x;
  const dz = targetZ - car.z;
  const dist = Math.hypot(dx, dz);
  const wantHeading = Math.atan2(dx, dz);
  let diff = wantHeading - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turn = Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  car.heading += turn;
  const desired = dist > 30 ? 26 : 20;
  car.speed += (desired - car.speed) * Math.min(1, dt * 0.9);
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  if (car.lightBar) {
    car.lightBar.material.color.setHex(Math.floor(time * 6) % 2 === 0 ? 0xff2020 : 0x2040ff);
  }
  for (const wheel of car.wheels) wheel.rotation.x += (car.speed * dt) / 0.42;
  return dist;
}
