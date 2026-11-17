// Neon Bay Nights — the world: player movement and combat, cars and stealing, the wanted
// level and the police who answer it, the six story missions, health packs, effects and the
// clock. The renderer paints this state; this file decides what happens in it.
import * as THREE from 'three';
import { CAR, CITY_HALF, DAY_LENGTH, PEDESTRIANS, PLAYER, START_HOUR, TRAFFIC_CARS, WANTED } from './config.js';
import { buildCity, collideCircle, nearestRoadPoint } from './city.js';
import { drivePlayerCar, makeCar, spawnParkedCars, spawnPoliceCar, spawnTraffic, updatePoliceCar, updateTraffic } from './vehicles.js';
import { makePedestrian, makePoliceOfficer, spawnPedestrians, updatePedestrian, updatePoliceOfficer } from './people.js';
import { getMission, missionCount, missionTarget, storyCompleteText } from './missions.js';
import { ACTION_ENTER, ACTION_PUNCH, ACTION_RELOAD } from './input.js';

const HEALTH_PACKS = [
  { x: -66, z: -66, taken: false },
  { x: 66, z: 66, taken: false },
  { x: -22, z: 66, taken: false },
];

export function createGame(scene, rng, audio, hud) {
  const city = buildCity(scene, rng);
  const colliders = city.colliders;

  // Mission marker: a glowing beacon column plus a spinning diamond over the objective.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 30, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe600, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }),
  );
  beacon.visible = false;
  scene.add(beacon);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.9),
    new THREE.MeshBasicMaterial({ color: 0xffe600 }),
  );
  diamond.visible = false;
  scene.add(diamond);

  // Health packs: white boxes with a green cross, parked by the hospital corners.
  const packMeshes = [];
  for (const pack of HEALTH_PACKS) {
    const group = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xf0f0f0 }));
    box.position.y = 0.6;
    group.add(box);
    const crossMat = new THREE.MeshBasicMaterial({ color: 0x2ecc71 });
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.05), crossMat);
    crossV.position.set(0, 0.6, 0.52);
    group.add(crossV);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.05), crossMat);
    crossH.position.set(0, 0.6, 0.52);
    group.add(crossH);
    group.position.set(pack.x, 0, pack.z);
    scene.add(group);
    packMeshes.push(group);
  }

  // Player character: Raka, the courier — red jacket, so he reads at a glance.
  const playerGroup = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0xc0392b });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b98a });
  const pLegs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), jeans);
  pLegs.position.y = 0.4;
  playerGroup.add(pLegs);
  const pBody = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.34), jacket);
  pBody.position.y = 1.15;
  playerGroup.add(pBody);
  const pHead = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  pHead.position.y = 1.75;
  playerGroup.add(pHead);
  const pArmL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.65, 0.16), jacket);
  pArmL.position.set(-0.4, 1.15, 0);
  playerGroup.add(pArmL);
  const pArmR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.65, 0.16), jacket);
  pArmR.position.set(0.4, 1.15, 0);
  playerGroup.add(pArmR);
  // The pistol, visible in the right hand once Raka has one.
  const pistol = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.45), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  pistol.position.set(0.4, 0.85, 0.25);
  pistol.visible = false;
  playerGroup.add(pistol);
  scene.add(playerGroup);

  const traffic = spawnTraffic(scene, rng, TRAFFIC_CARS);
  const parked = spawnParkedCars(scene, rng, 10);
  const peds = spawnPedestrians(scene, rng, PEDESTRIANS);

  // Particle bursts (sparks, smoke, blood-free impact puffs) from a small reusable pool.
  const particles = [];
  const particleGeometry = new THREE.BoxGeometry(0.18, 0.18, 0.18);
  function spawnBurst(x, y, z, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      let mesh = particles.find((p) => p.life <= 0);
      if (!mesh) {
        mesh = {
          mesh: new THREE.Mesh(particleGeometry, new THREE.MeshBasicMaterial({ color })),
          life: 0,
          vx: 0,
          vy: 0,
          vz: 0,
        };
        scene.add(mesh.mesh);
        particles.push(mesh);
      }
      mesh.mesh.material.color.setHex(color);
      mesh.mesh.position.set(x, y, z);
      mesh.mesh.visible = true;
      mesh.life = rng.range(0.3, 0.7);
      mesh.maxLife = mesh.life;
      mesh.vx = rng.range(-speed, speed);
      mesh.vy = rng.range(0, speed);
      mesh.vz = rng.range(-speed, speed);
    }
  }
  function updateParticles(dt) {
    for (const p of particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        continue;
      }
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= 9 * dt;
      const s = Math.max(0.05, p.life / p.maxLife);
      p.mesh.scale.setScalar(s);
    }
  }

  // Tracer lines for gunshots, fading fast.
  const tracers = [];
  function spawnTracer(from, to) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z),
    ]);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    scene.add(line);
    tracers.push({ line, life: 0.12 });
  }
  function updateTracers(dt) {
    for (let i = tracers.length - 1; i >= 0; i -= 1) {
      tracers[i].life -= dt;
      if (tracers[i].life <= 0) {
        scene.remove(tracers[i].line);
        tracers[i].line.geometry.dispose();
        tracers.splice(i, 1);
      } else {
        tracers[i].line.material.opacity = tracers[i].life / 0.12;
      }
    }
  }

  const state = {
    time: 0,
    hour: START_HOUR,
    money: PLAYER.startMoney,
    wanted: 0,
    lastCrimeTime: -100,
    wantedTimer: 0,
    player: {
      x: 0,
      z: -22,
      y: 0,
      vy: 0,
      heading: Math.PI,
      health: PLAYER.health,
      ammo: PLAYER.magazine,
      reserveAmmo: 48,
      hasPistol: false,
      walkPhase: 0,
      punchCooldown: 0,
      hurtCooldown: 0,
    },
    camYaw: Math.PI,
    camPitch: 0.32,
    driving: false,
    playerCar: null,
    traffic,
    parked,
    peds,
    policeCars: [],
    officers: [],
    goons: [],
    fleeCar: null,
    missionIndex: 0,
    mission: null,
    missionStage: 0,
    missionTarget: null,
    missionsDone: 0,
    storyDone: false,
    dead: false,
    busted: false,
    bustWarning: false,
    screen: 'start',
    danger: null,
    goonsLeft: 0,
    missionFailed: false,
  };

  function playerPos() {
    return { x: state.player.x, z: state.player.z };
  }

  function addWanted(n) {
    state.wanted = Math.min(5, state.wanted + n);
    state.lastCrimeTime = state.time;
    if (state.wanted > 0) audio.siren(true);
  }

  function nearestCar(maxDist) {
    let best = null;
    let bestDist = maxDist;
    const all = [...state.parked, ...state.traffic];
    if (state.playerCar) all.push(state.playerCar);
    for (const car of all) {
      const d = Math.hypot(car.x - state.player.x, car.z - state.player.z);
      if (d < bestDist) {
        bestDist = d;
        best = car;
      }
    }
    return best;
  }

  function enterCar(car) {
    if (car.kind === 'traffic' && car.driver) {
      // Stealing a driven car: the driver bails out and the cops take notice.
      car.driver = false;
      const driver = makePedestrian(car.x + 2, car.z + 2, rng);
      driver.fleeing = true;
      driver.fleeTimer = 4;
      scene.add(driver.mesh);
      state.peds.push(driver);
      addWanted(1);
      hud.toast('Car stolen! The driver ran off — the cops noticed.', 3);
      audio.pickup();
    } else if (car.kind === 'parked') {
      addWanted(1);
      hud.toast('Car stolen! That one had an owner too.', 3);
      audio.pickup();
    }
    state.parked = state.parked.filter((c) => c !== car);
    state.traffic = state.traffic.filter((c) => c !== car);
    car.kind = 'player';
    state.playerCar = car;
    state.driving = true;
    state.player.x = car.x;
    state.player.z = car.z;
    state.player.heading = car.heading;
    playerGroup.visible = false;
    audio.engine(0, true);
  }

  function exitCar() {
    const car = state.playerCar;
    if (!car) return;
    state.driving = false;
    state.playerCar = null;
    car.kind = 'parked';
    car.speed = 0;
    state.parked.push(car);
    const side = 2.6;
    state.player.x = car.x + Math.cos(car.heading) * side;
    state.player.z = car.z - Math.sin(car.heading) * side;
    state.player.heading = car.heading;
    playerGroup.visible = true;
    audio.engine(0, false);
  }

  function hurtPlayer(amount) {
    if (state.player.hurtCooldown > 0 || state.dead) return;
    state.player.health -= amount;
    state.player.hurtCooldown = 0.6;
    audio.hurt();
    spawnBurst(state.player.x, 1.4, state.player.z, 0xff4040, 6, 3);
    if (state.player.health <= 0) {
      state.player.health = 0;
      state.dead = true;
      state.screen = 'dead';
      hud.setEndText('WASTED', `Raka went down in Neon Bay. He kept $${Math.round(state.money)} and ${state.missionsDone} finished jobs.`);
      hud.showScreen('dead');
      audio.stopMusic();
    }
  }

  function bustPlayer() {
    if (state.busted) return;
    state.busted = true;
    state.screen = 'busted';
    const fine = Math.min(state.money, 200);
    state.money -= fine;
    state.wanted = 0;
    audio.siren(false);
    audio.busted();
    hud.setEndText('BUSTED', `The Neon Bay PD caught Raka. Fine: $${fine}. The car is impounded — on foot again.`);
    hud.showScreen('busted');
    if (state.driving) exitCar();
  }

  function startMission(index) {
    const mission = getMission(index);
    if (!mission) return;
    state.mission = mission;
    state.missionIndex = index;
    state.missionStage = 0;
    state.missionTarget = missionTarget(mission, 0);
    state.missionFailed = false;
    state.goons = [];
    state.fleeCar = null;
    hud.showDialogue(mission.lines, 8);
    audio.click();
    if (mission.type === 'combat' || mission.type === 'finale') {
      const count = mission.enemies || 3;
      state.goonsLeft = count;
      for (let i = 0; i < count; i += 1) {
        const gx = mission.target.x + rng.range(-8, 8);
        const gz = mission.target.z + rng.range(-8, 8);
        const goon = makePedestrian(gx, gz, rng);
        scene.add(goon.mesh);
        goon.hp = 100;
        goon.isGoon = true;
        state.goons.push(goon);
      }
      hud.toast(`${count} goons at ${mission.target.label}. Deal with them.`, 4);
    }
    if (mission.type === 'chase') {
      const flee = makeCar(mission.target.x - 40, mission.target.z, Math.PI / 2, 0xb8332a, 'traffic');
      flee.speed = 16;
      flee.hp = 120;
      flee.isFlee = true;
      scene.add(flee.mesh);
      state.fleeCar = flee;
      hud.toast('The courier is running! Catch his car.', 4);
    }
    if (!state.player.hasPistol && index >= 3) {
      state.player.hasPistol = true;
      pistol.visible = true;
      hud.toast('Mira slipped you a pistol. Click to shoot, R to reload.', 4);
    }
    if (index === 3 && !state.player.hasPistol) {
      state.player.hasPistol = true;
      pistol.visible = true;
    }
  }

  function completeMission() {
    const mission = state.mission;
    if (!mission) return;
    state.money += mission.reward;
    state.missionsDone += 1;
    audio.missionDone();
    hud.toast(`Job done! +$${mission.reward}`, 4);
    spawnBurst(state.player.x, 2, state.player.z, 0xffe600, 20, 5);
    state.mission = null;
    state.missionTarget = null;
    state.goons = [];
    state.fleeCar = null;
    beacon.visible = false;
    diamond.visible = false;
    if (state.missionsDone >= missionCount()) {
      state.storyDone = true;
      state.screen = 'done';
      hud.setEndText('NEON BAY IS YOURS', storyCompleteText());
      hud.showScreen('done');
      audio.stopMusic();
      return;
    }
    startMission(state.missionIndex + 1);
  }

  function failMission(reason) {
    if (!state.mission || state.missionFailed) return;
    state.missionFailed = true;
    audio.missionFail();
    hud.toast(`Job failed: ${reason} — try again (M).`, 5);
    state.mission = null;
    state.missionTarget = null;
    state.goons = [];
    if (state.fleeCar) {
      scene.remove(state.fleeCar.mesh);
      state.fleeCar = null;
    }
    beacon.visible = false;
    diamond.visible = false;
  }

  function shoot() {
    const p = state.player;
    if (!p.hasPistol || p.ammo <= 0) {
      audio.click();
      if (p.ammo <= 0) hud.toast('Out of ammo — press R to reload.', 2);
      return;
    }
    p.ammo -= 1;
    audio.gunshot();
    addWanted(1);
    const from = { x: p.x, y: 1.5, z: p.z };
    // Aim along the camera: forward from the player's facing, which follows the camera.
    const dirX = Math.sin(p.heading);
    const dirZ = Math.cos(p.heading);
    let hit = null;
    let hitDist = PLAYER.pistolRange;
    const targets = [];
    for (const goon of state.goons) if (goon.alive) targets.push({ x: goon.x, z: goon.z, ref: goon, kind: 'goon' });
    for (const officer of state.officers) if (officer.alive) targets.push({ x: officer.x, z: officer.z, ref: officer, kind: 'officer' });
    for (const ped of state.peds) if (ped.alive && !ped.isGoon) targets.push({ x: ped.x, z: ped.z, ref: ped, kind: 'ped' });
    if (state.fleeCar) targets.push({ x: state.fleeCar.x, z: state.fleeCar.z, ref: state.fleeCar, kind: 'car' });
    for (const car of state.policeCars) targets.push({ x: car.x, z: car.z, ref: car, kind: 'car' });
    for (const t of targets) {
      const dx = t.x - p.x;
      const dz = t.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist > PLAYER.pistolRange || dist < 0.5) continue;
      const dot = (dx * dirX + dz * dirZ) / dist;
      const perp = Math.abs(dx * dirZ - dz * dirX);
      if (dot > 0.86 && perp < 2.2 && dist < hitDist) {
        hitDist = dist;
        hit = t;
      }
    }
    const end = {
      x: p.x + dirX * hitDist,
      y: 1.4,
      z: p.z + dirZ * hitDist,
    };
    spawnTracer(from, end);
    spawnBurst(p.x + dirX * 0.8, 1.5, p.z + dirZ * 0.8, 0xffe9a8, 3, 2);
    if (!hit) return;
    spawnBurst(hit.x, 1.2, hit.z, 0xff8040, 8, 4);
    if (hit.kind === 'car') {
      hit.ref.hp = (hit.ref.hp ?? 100) - PLAYER.pistolDamage;
      if (hit.ref.hp <= 0) {
        spawnBurst(hit.x, 1, hit.z, 0xffa040, 24, 7);
        audio.crash();
        if (hit.ref.isFlee) {
          state.fleeCar = null;
          scene.remove(hit.ref.mesh);
          completeMission();
        } else {
          scene.remove(hit.ref.mesh);
          state.policeCars = state.policeCars.filter((c) => c !== hit.ref);
        }
      }
      return;
    }
    const person = hit.ref;
    person.hp = (person.hp ?? 100) - PLAYER.pistolDamage;
    state.danger = { x: p.x, z: p.z };
    state.dangerAt = state.time;
    if (person.hp <= 0) {
      person.alive = false;
      person.mesh.visible = false;
      if (hit.kind === 'goon') {
        state.goonsLeft -= 1;
        hud.toast(`Goon down — ${state.goonsLeft} left.`, 2);
        if (state.goonsLeft <= 0 && (state.mission?.type === 'combat' || state.mission?.type === 'finale')) {
          completeMission();
        }
      } else if (hit.kind === 'officer') {
        addWanted(2);
        hud.toast('You shot a cop! Wanted level up.', 3);
      }
    }
  }

  function punch() {
    const p = state.player;
    if (p.punchCooldown > 0) return;
    p.punchCooldown = 0.45;
    audio.punch();
    const dirX = Math.sin(p.heading);
    const dirZ = Math.cos(p.heading);
    const people = [...state.goons, ...state.officers, ...state.peds.filter((q) => q.alive)];
    for (const person of people) {
      if (!person.alive) continue;
      const dx = person.x - p.x;
      const dz = person.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist > PLAYER.punchRange) continue;
      const dot = (dx * dirX + dz * dirZ) / (dist || 1);
      if (dot < 0.3) continue;
      person.hp = (person.hp ?? 100) - PLAYER.punchDamage;
      person.x += dirX * 1.2;
      person.z += dirZ * 1.2;
      person.mesh.position.set(person.x, 0, person.z);
      spawnBurst(person.x, 1.4, person.z, 0xffe9a8, 6, 3);
      if (person.hp <= 0) {
        person.alive = false;
        person.mesh.visible = false;
        if (person.isGoon) {
          state.goonsLeft -= 1;
          if (state.goonsLeft <= 0 && (state.mission?.type === 'combat' || state.mission?.type === 'finale')) completeMission();
        }
      }
      if (state.officers.includes(person)) addWanted(1);
      return;
    }
  }

  function managePolice(dt) {
    // How many units the wanted level asks for.
    const wantCars = state.wanted === 0 ? 0 : Math.min(3, state.wanted);
    const wantOfficers = state.wanted === 0 ? 0 : Math.min(3, state.wanted - 1);
    while (state.policeCars.length < wantCars) {
      const angle = rng.range(0, Math.PI * 2);
      const x = state.player.x + Math.cos(angle) * 55;
      const z = state.player.z + Math.sin(angle) * 55;
      state.policeCars.push(spawnPoliceCar(scene, x, z, rng));
    }
    while (state.policeCars.length > wantCars) {
      const car = state.policeCars.pop();
      scene.remove(car.mesh);
    }
    while (state.officers.length < wantOfficers) {
      const angle = rng.range(0, Math.PI * 2);
      const officer = makePoliceOfficer(
        state.player.x + Math.cos(angle) * 30,
        state.player.z + Math.sin(angle) * 30,
        rng,
      );
      officer.hp = 100;
      scene.add(officer.mesh);
      state.officers.push(officer);
    }
    while (state.officers.length > wantOfficers) {
      const officer = state.officers.pop();
      scene.remove(officer.mesh);
    }
    // Officers who died or wandered off get removed.
    for (let i = state.officers.length - 1; i >= 0; i -= 1) {
      if (!state.officers[i].alive) {
        scene.remove(state.officers[i].mesh);
        state.officers.splice(i, 1);
      }
    }
    audio.siren(state.wanted > 0);
    if (state.wanted > 0) audio.sirenWail(state.time);
  }

  // stepPlaying takes the frame's actions from main.js, which already read them once
  // (pause and confirm live there); the game consumes movement, enter, punch and reload.
  function stepPlaying(dt, input, actions) {
    const p = state.player;
    state.time += dt;
    state.hour = (state.hour + dt / DAY_LENGTH * 24) % 24;
    if (p.punchCooldown > 0) p.punchCooldown -= dt;
    if (p.hurtCooldown > 0) p.hurtCooldown -= dt;
    if (state.danger && state.time - (state.dangerAt || 0) > 5) state.danger = null;

    // Camera orbit from mouse drag.
    const drag = input.takeDrag();
    state.camYaw -= drag.x * 0.005;
    state.camPitch = Math.max(0.08, Math.min(1.1, state.camPitch + drag.y * 0.004));

    const move = input.move();

    if (actions & ACTION_ENTER) {
      if (state.driving) exitCar();
      else {
        const car = nearestCar(4);
        if (car) enterCar(car);
      }
    }
    if (actions & ACTION_PUNCH && !state.driving) punch();
    if (actions & ACTION_RELOAD && p.hasPistol) {
      if (p.reserveAmmo > 0 && p.ammo < PLAYER.magazine) {
        const need = PLAYER.magazine - p.ammo;
        const take = Math.min(need, p.reserveAmmo);
        p.ammo += take;
        p.reserveAmmo -= take;
        audio.click();
        hud.toast(`Reloaded — ${p.ammo}/${p.reserveAmmo} rounds.`, 2);
      }
    }
    if (input.takeClick() && !state.driving) shoot();

    if (state.driving && state.playerCar) {
      const impact = drivePlayerCar(state.playerCar, move, dt, colliders);
      if (impact > 12) {
        audio.crash();
        hurtPlayer(Math.round(impact * 0.4));
        spawnBurst(state.playerCar.x, 1, state.playerCar.z, 0xffa040, 10, 5);
      }
      // Running over a pedestrian is a crime, and the cops notice.
      for (const ped of state.peds) {
        if (!ped.alive) continue;
        if (Math.hypot(ped.x - state.playerCar.x, ped.z - state.playerCar.z) < 1.8) {
          ped.alive = false;
          ped.mesh.visible = false;
          addWanted(1);
          hud.toast('You hit a pedestrian! Wanted level up.', 3);
        }
      }
      state.player.x = state.playerCar.x;
      state.player.z = state.playerCar.z;
      state.player.heading = state.playerCar.heading;
      audio.engine(Math.abs(state.playerCar.speed), true);
    } else {
      // On foot: WASD relative to the camera, Shift to run, Space to jump.
      // Forward on screen is (sin(camYaw), cos(camYaw)); right is (-cos, sin).
      const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
      const sin = Math.sin(state.camYaw);
      const cos = Math.cos(state.camYaw);
      const mx = sin * move.forward - cos * move.strafe;
      const mz = cos * move.forward + sin * move.strafe;
      const len = Math.hypot(mx, mz);
      if (len > 0.01) {
        const nx = p.x + (mx / len) * speed * dt;
        const nz = p.z + (mz / len) * speed * dt;
        const pos = { x: nx, z: nz };
        collideCircle(pos, 0.55, colliders);
        p.x = Math.max(-CITY_HALF - 30, Math.min(CITY_HALF + 30, pos.x));
        p.z = Math.max(-CITY_HALF - 30, Math.min(CITY_HALF + 34, pos.z));
        const wantHeading = Math.atan2(mx, mz);
        let diff = wantHeading - p.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        p.heading += Math.max(-10 * dt, Math.min(10 * dt, diff));
        p.walkPhase += dt * speed * 1.6;
      }
      if (input.takeJump() && p.y <= 0) {
        p.vy = 7;
        audio.click();
      }
      if (p.y > 0 || p.vy !== 0) {
        p.vy -= 22 * dt;
        p.y += p.vy * dt;
        if (p.y <= 0) {
          p.y = 0;
          p.vy = 0;
        }
      }
      const swing = len > 0.01 ? Math.sin(p.walkPhase) * 0.6 : 0;
      pArmL.rotation.x = swing;
      pArmR.rotation.x = -swing;
      playerGroup.position.set(p.x, p.y, p.z);
      playerGroup.rotation.y = p.heading;
      audio.engine(0, false);
    }

    // Traffic and pedestrians live their own lives.
    const allCars = [...state.traffic, ...state.policeCars, ...(state.playerCar ? [state.playerCar] : [])];
    for (const car of state.traffic) updateTraffic(car, dt, rng, allCars);
    for (const ped of state.peds) {
      if (ped.alive) updatePedestrian(ped, dt, rng, colliders, state.danger);
    }

    // Health packs.
    for (let i = 0; i < HEALTH_PACKS.length; i += 1) {
      const pack = HEALTH_PACKS[i];
      if (pack.taken) continue;
      if (Math.hypot(pack.x - p.x, pack.z - p.z) < 2) {
        pack.taken = true;
        packMeshes[i].visible = false;
        p.health = Math.min(PLAYER.health, p.health + 50);
        audio.pickup();
        hud.toast('Health +50', 2);
      }
    }

    // Wanted decay: lay low and the heat fades.
    if (state.wanted > 0 && state.time - state.lastCrimeTime > WANTED.decayDelay) {
      state.wantedTimer += dt;
      if (state.wantedTimer >= WANTED.decayStep) {
        state.wantedTimer = 0;
        state.wanted -= 1;
        if (state.wanted === 0) {
          audio.siren(false);
          hud.toast('You lost the cops. Heat is off.', 3);
        }
      }
    } else {
      state.wantedTimer = 0;
    }
    managePolice(dt);

    // Police cars chase and ram; officers chase on foot and bust.
    const target = { x: p.x, z: p.z };
    for (const car of state.policeCars) {
      const dist = updatePoliceCar(car, dt, target.x, target.z, state.time);
      if (dist < 3.2) {
        if (state.driving && state.playerCar) {
          const impact = Math.abs(car.speed);
          state.playerCar.speed *= 0.5;
          if (impact > 8) {
            audio.crash();
            hurtPlayer(8);
          }
        } else if (state.player.hurtCooldown <= 0) {
          hurtPlayer(6);
        }
      }
    }
    let bustClose = false;
    for (const officer of state.officers) {
      const result = updatePoliceOfficer(officer, dt, target.x, target.z, colliders, WANTED.bustTime);
      if (result === 2) {
        bustPlayer();
        return;
      }
      if (result === 1) bustClose = true;
    }
    state.bustWarning = bustClose;
    if (bustClose) hud.toast('A cop is grabbing you — run!', 1);

    // Goons chase and punch the player.
    for (const goon of state.goons) {
      if (!goon.alive) continue;
      const dx = p.x - goon.x;
      const dz = p.z - goon.z;
      const dist = Math.hypot(dx, dz);
      const speed = dist > 4 ? 5.5 : 2;
      goon.heading = Math.atan2(dx, dz);
      goon.x += Math.sin(goon.heading) * speed * dt;
      goon.z += Math.cos(goon.heading) * speed * dt;
      const pos = { x: goon.x, z: goon.z };
      collideCircle(pos, 0.5, colliders);
      goon.x = pos.x;
      goon.z = pos.z;
      goon.walkPhase += dt * speed * 2.2;
      const swing = Math.sin(goon.walkPhase) * 0.7;
      goon.leftArm.rotation.x = swing;
      goon.rightArm.rotation.x = -swing;
      goon.mesh.position.set(goon.x, 0, goon.z);
      goon.mesh.rotation.y = goon.heading;
      if (dist < 1.8 && p.hurtCooldown <= 0 && !state.driving) {
        hurtPlayer(10);
        hud.toast('A goon hit you!', 1);
      }
    }

    // The fleeing courier drives for the bridge; catch him first.
    if (state.fleeCar) {
      const flee = state.fleeCar;
      const tx = state.mission.target.x;
      const tz = state.mission.target.z;
      const dx = tx - flee.x;
      const dz = tz - flee.z;
      const dist = Math.hypot(dx, dz);
      flee.heading = Math.atan2(dx, dz);
      flee.speed = Math.min(24, flee.speed + 4 * dt);
      flee.x += Math.sin(flee.heading) * flee.speed * dt;
      flee.z += Math.cos(flee.heading) * flee.speed * dt;
      flee.mesh.position.set(flee.x, 0, flee.z);
      flee.mesh.rotation.y = flee.heading;
      // Ramming the flee car damages it.
      if (state.driving && state.playerCar) {
        const rd = Math.hypot(flee.x - state.playerCar.x, flee.z - state.playerCar.z);
        if (rd < 3.4 && Math.abs(state.playerCar.speed) > 6) {
          flee.hp -= 25;
          state.playerCar.speed *= 0.6;
          audio.crash();
          spawnBurst(flee.x, 1, flee.z, 0xffa040, 12, 6);
          if (flee.hp <= 0) {
            scene.remove(flee.mesh);
            state.fleeCar = null;
            completeMission();
          }
        }
      }
      if (dist < 6) failMission('the courier reached the bridge');
    }

    // Mission progress.
    if (state.mission && state.missionTarget) {
      const t = state.missionTarget;
      const dist = Math.hypot(t.x - p.x, t.z - p.z);
      const type = state.mission.type;
      if (type === 'goto' && dist < 4) completeMission();
      else if (type === 'drive' && dist < 5 && state.driving) completeMission();
      else if (type === 'drive' && dist < 5 && !state.driving) hud.toast('You need to be in a car for this job.', 2);
      else if (type === 'pickup' && state.missionStage === 0 && dist < 4) {
        state.missionStage = 1;
        state.missionTarget = missionTarget(state.mission, 1);
        audio.pickup();
        hud.toast('Package grabbed! Now bring it to Dario.', 3);
      } else if (type === 'pickup' && state.missionStage === 1 && dist < 4) completeMission();
      else if (type === 'finale' && state.goonsLeft <= 0) completeMission();
      // Beacon follows the current objective.
      beacon.position.set(t.x, 15, t.z);
      beacon.visible = true;
      diamond.position.set(t.x, 6 + Math.sin(state.time * 2) * 0.5, t.z);
      diamond.rotation.y = state.time * 1.5;
      diamond.visible = true;
    }

    // Slow health regen when out of trouble.
    if (state.wanted === 0 && p.health > 0 && p.health < PLAYER.health) {
      p.health = Math.min(PLAYER.health, p.health + dt * 1.5);
    }

    updateParticles(dt);
    updateTracers(dt);
    hud.update(state);
  }

  function reset() {
    state.time = 0;
    state.hour = START_HOUR;
    state.money = PLAYER.startMoney;
    state.wanted = 0;
    state.lastCrimeTime = -100;
    state.player.x = 0;
    state.player.z = -22;
    state.player.y = 0;
    state.player.vy = 0;
    state.player.heading = Math.PI;
    state.player.health = PLAYER.health;
    state.player.ammo = PLAYER.magazine;
    state.player.reserveAmmo = 48;
    state.player.hasPistol = false;
    state.camYaw = Math.PI;
    state.camPitch = 0.32;
    state.driving = false;
    state.playerCar = null;
    state.missionIndex = 0;
    state.mission = null;
    state.missionTarget = null;
    state.missionsDone = 0;
    state.storyDone = false;
    state.dead = false;
    state.busted = false;
    state.goons = [];
    state.fleeCar = null;
    for (const car of state.policeCars) scene.remove(car.mesh);
    state.policeCars = [];
    for (const officer of state.officers) scene.remove(officer.mesh);
    state.officers = [];
    beacon.visible = false;
    diamond.visible = false;
    pistol.visible = false;
    playerGroup.visible = true;
    playerGroup.position.set(0, 0, -22);
    for (let i = 0; i < HEALTH_PACKS.length; i += 1) {
      HEALTH_PACKS[i].taken = false;
      packMeshes[i].visible = true;
    }
    audio.siren(false);
  }

  function applySave(data) {
    reset();
    state.money = data.money;
    state.player.health = data.health;
    state.player.ammo = data.ammo ?? PLAYER.magazine;
    state.player.reserveAmmo = data.reserveAmmo ?? 48;
    state.hour = data.hour ?? START_HOUR;
    state.missionsDone = data.missionsDone || 0;
    state.missionIndex = data.missionIndex || 0;
    if (data.position) {
      state.player.x = data.position.x;
      state.player.z = data.position.z;
    }
    if (state.missionIndex >= missionCount()) {
      state.storyDone = true;
    } else {
      startMission(state.missionIndex);
    }
  }

  // Staging helpers for the screenshot scenes: the shots module drives the real game
  // forward from a fresh state, so each screenshot is a genuine frame of play.
  function stageEnterCar() {
    const car = nearestCar(200);
    if (car) enterCar(car);
  }
  function stageSetWanted(n) {
    for (let i = 0; i < n; i += 1) addWanted(1);
  }
  function stageTeleport(x, z) {
    state.player.x = x;
    state.player.z = z;
    playerGroup.position.set(x, 0, z);
  }
  // Pull the nearest police interceptor to a spot ahead of the player car, facing it, so
  // a staged chase frame shows the police in the picture, not only on the minimap.
  function stagePoliceAhead() {
    if (state.policeCars.length === 0 || !state.playerCar) return;
    const car = state.playerCar;
    let best = state.policeCars[0];
    let bestDist = Infinity;
    for (const pc of state.policeCars) {
      const d = Math.hypot(pc.x - car.x, pc.z - car.z);
      if (d < bestDist) {
        bestDist = d;
        best = pc;
      }
    }
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    // Directly ahead on the same lane, facing the player head-on.
    best.x = car.x + fx * 22;
    best.z = car.z + fz * 22;
    best.heading = Math.atan2(car.x - best.x, car.z - best.z);
    best.speed = 12;
    best.mesh.position.set(best.x, 0, best.z);
    best.mesh.rotation.y = best.heading;
  }
  // Place the player's car at a chosen road spot, heading along the road.
  function stagePlaceCar(x, z, heading) {
    const car = state.playerCar;
    if (!car) return;
    car.x = x;
    car.z = z;
    car.heading = heading;
    car.speed = 0;
    car.mesh.position.set(x, 0, z);
    car.mesh.rotation.y = heading;
    state.player.x = x;
    state.player.z = z;
    state.player.heading = heading;
  }

  return {
    state,
    city,
    colliders,
    startMission,
    completeMission,
    failMission,
    reset,
    applySave,
    stepPlaying,
    addWanted,
    hurtPlayer,
    playerGroup,
    spawnBurst,
    beacon,
    diamond,
    stageEnterCar,
    stageSetWanted,
    stageTeleport,
    stagePlaceCar,
    stagePoliceAhead,
  };
}
