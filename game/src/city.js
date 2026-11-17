// The city of Neon Bay: a sun-soaked grid of blocks, towers, palms, lamps and a bayfront.
// Everything is built from three.js boxes, cylinders and one procedural window texture, so
// the whole city is original geometry drawn by this code — no borrowed art.
import * as THREE from 'three';
import { BLOCK, BLOCKS, CITY_HALF, ROAD_WIDTH } from './config.js';

const BUILDING_COLORS = [0x8f7fb8, 0xc98a6b, 0x6ba3b8, 0xb8a06b, 0x9b6b8f, 0x7fb08a, 0xb87b7b, 0x5f7fa8];
const NEON_COLORS = [0xff2e88, 0x00e5ff, 0xffe600, 0x7cff00, 0xff6a00];

/** A small canvas texture of lit windows, shared by every tower and tinted per building. */
function makeWindowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#20242e';
  ctx.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 248; y += 16) {
    for (let x = 8; x < 120; x += 16) {
      const lit = Math.random() < 0.45;
      ctx.fillStyle = lit ? (Math.random() < 0.7 ? '#ffd98a' : '#9adfff') : '#11141c';
      ctx.fillRect(x, y, 10, 10);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function blockCentre(ix, iz) {
  return { x: -CITY_HALF + BLOCK / 2 + ix * BLOCK, z: -CITY_HALF + BLOCK / 2 + iz * BLOCK };
}

export function isOnRoad(x, z) {
  const roadHalf = ROAD_WIDTH / 2;
  for (let i = 0; i <= BLOCKS; i += 1) {
    const line = -CITY_HALF + i * BLOCK;
    if (Math.abs(x - line) < roadHalf || Math.abs(z - line) < roadHalf) return true;
  }
  return false;
}

export function nearestRoadPoint(x, z) {
  let bestX = x;
  let bestZ = z;
  let best = Infinity;
  for (let i = 0; i <= BLOCKS; i += 1) {
    const line = -CITY_HALF + i * BLOCK;
    const dx = Math.abs(x - line);
    if (dx < best) {
      best = dx;
      bestX = line;
      bestZ = z;
    }
    const dz = Math.abs(z - line);
    if (dz < best) {
      best = dz;
      bestX = x;
      bestZ = line;
    }
  }
  return { x: bestX, z: bestZ };
}

export function randomRoadPosition(rng) {
  const i = rng.int(0, BLOCKS);
  const line = -CITY_HALF + i * BLOCK;
  const along = rng.range(-CITY_HALF, CITY_HALF);
  if (rng.chance(0.5)) return { x: line + rng.range(-2.5, 2.5), z: along, alongRoad: 'z' };
  return { x: along, z: line + rng.range(-2.5, 2.5), alongRoad: 'x' };
}

export function buildCity(scene, rng) {
  const colliders = [];
  const lamps = [];
  const windowTexture = makeWindowTexture();

  // Ground: warm sand-coloured base, then the road grid on top of it.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 160, CITY_HALF * 2 + 160),
    new THREE.MeshLambertMaterial({ color: 0x8a7f6a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  scene.add(ground);

  // The bay: a blue plane along the south edge, past the last row of blocks.
  const bay = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 160, 70),
    new THREE.MeshLambertMaterial({ color: 0x1e6f8e }),
  );
  bay.rotation.x = -Math.PI / 2;
  bay.position.set(0, -0.02, CITY_HALF + 55);
  scene.add(bay);
  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 160, 18),
    new THREE.MeshLambertMaterial({ color: 0xd9c08a }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0, CITY_HALF + 12);
  scene.add(beach);

  // Roads: dark strips along every grid line, plus a pale centre line.
  const roadMaterial = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
  const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xd8d8c8 });
  const roadLength = CITY_HALF * 2 + ROAD_WIDTH;
  for (let i = 0; i <= BLOCKS; i += 1) {
    const line = -CITY_HALF + i * BLOCK;
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(roadLength, ROAD_WIDTH), roadMaterial);
      road.rotation.x = -Math.PI / 2;
      road.rotation.z = horizontal ? 0 : Math.PI / 2;
      road.position.set(horizontal ? 0 : line, 0.01, horizontal ? line : 0);
      scene.add(road);
      for (let d = -CITY_HALF; d <= CITY_HALF; d += 8) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.35), lineMaterial);
        dash.rotation.x = -Math.PI / 2;
        dash.rotation.z = horizontal ? 0 : Math.PI / 2;
        dash.position.set(horizontal ? d : line, 0.02, horizontal ? line : d);
        scene.add(dash);
      }
    }
  }

  // Blocks: sidewalks, towers, palms, lamps and the occasional neon sign.
  const sidewalkMaterial = new THREE.MeshLambertMaterial({ color: 0x9a938a });
  const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x7a5a3a });
  const leafMaterial = new THREE.MeshLambertMaterial({ color: 0x2f8f4e });
  const lampPoleMaterial = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const lampBulbMaterial = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let ix = 0; ix < BLOCKS; ix += 1) {
    for (let iz = 0; iz < BLOCKS; iz += 1) {
      const centre = blockCentre(ix, iz);
      const sidewalk = new THREE.Mesh(
        new THREE.BoxGeometry(BLOCK - ROAD_WIDTH, 0.3, BLOCK - ROAD_WIDTH),
        sidewalkMaterial,
      );
      sidewalk.position.set(centre.x, 0.1, centre.z);
      scene.add(sidewalk);

      const count = rng.int(1, 3);
      for (let b = 0; b < count; b += 1) {
        const w = rng.range(9, 15);
        const d = rng.range(9, 15);
        const h = rng.range(8, count === 1 ? 55 : 26);
        const ox = (b % 2 === 0 ? -1 : 1) * rng.range(0, 6);
        const oz = (b < 2 ? -1 : 1) * rng.range(0, 6);
        const px = centre.x + ox;
        const pz = centre.z + oz;
        const tex = windowTexture.clone();
        tex.needsUpdate = true;
        tex.repeat.set(Math.max(1, Math.round(w / 6)), Math.max(1, Math.round(h / 8)));
        const material = new THREE.MeshLambertMaterial({
          color: rng.pick(BUILDING_COLORS),
          map: tex,
          emissive: 0x111111,
        });
        const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
        building.position.set(px, 0.25 + h / 2, pz);
        scene.add(building);
        // Flat roof cap so towers read as buildings, not plain boxes.
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6),
          new THREE.MeshLambertMaterial({ color: 0x3c414d }),
        );
        roof.position.set(px, 0.25 + h + 0.25, pz);
        scene.add(roof);
        colliders.push({ minX: px - w / 2, maxX: px + w / 2, minZ: pz - d / 2, maxZ: pz + d / 2 });
        // A neon sign on some towers, facing the nearest road.
        if (rng.chance(0.35)) {
          const sign = new THREE.Mesh(
            new THREE.BoxGeometry(Math.min(w, 8), 1.1, 0.3),
            new THREE.MeshBasicMaterial({ color: rng.pick(NEON_COLORS) }),
          );
          sign.position.set(px, 0.25 + h * 0.72, pz + d / 2 + 0.2);
          scene.add(sign);
        }
      }

      // Palms along the block edges.
      for (let p = 0; p < 3; p += 1) {
        const px = centre.x + rng.range(-14, 14);
        const pz = centre.z + rng.range(-14, 14);
        if (isOnRoad(px, pz)) continue;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 5, 6), trunkMaterial);
        trunk.position.set(px, 2.7, pz);
        trunk.rotation.z = rng.range(-0.12, 0.12);
        scene.add(trunk);
        const leaves = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.2, 7), leafMaterial);
        leaves.position.set(px, 5.8, pz);
        scene.add(leaves);
      }

      // One street lamp per block corner.
      const lampX = centre.x + (BLOCK - ROAD_WIDTH) / 2 - 1;
      const lampZ = centre.z + (BLOCK - ROAD_WIDTH) / 2 - 1;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), lampPoleMaterial);
      pole.position.set(lampX, 3.2, lampZ);
      scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampBulbMaterial);
      bulb.position.set(lampX, 6.3, lampZ);
      scene.add(bulb);
      lamps.push({ x: lampX, z: lampZ, bulb });
    }
  }

  return { colliders, lamps };
}

/** Push a circle (x, z, radius) out of every building collider it overlaps. */
export function collideCircle(position, radius, colliders) {
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(position.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(position.z, c.maxZ));
    const dx = position.x - cx;
    const dz = position.z - cz;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius) {
      if (distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        position.x = cx + (dx / dist) * radius;
        position.z = cz + (dz / dist) * radius;
      } else {
        position.x = c.maxX + radius;
      }
    }
  }
}
