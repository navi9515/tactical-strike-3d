const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Game State
const players = {};
const pickups = [
  { id: 'hp1', type: 'health', x: -15, y: 0.5, z: -15, respawnTimer: 0 },
  { id: 'hp2', type: 'health', x: 15, y: 0.5, z: 15, respawnTimer: 0 },
  { id: 'arm1', type: 'armor', x: -15, y: 0.5, z: 15, respawnTimer: 0 },
  { id: 'arm2', type: 'armor', x: 15, y: 0.5, z: -15, respawnTimer: 0 },
  { id: 'ammo1', type: 'ammo', x: 0, y: 0.5, z: 0, respawnTimer: 0 }
];

const SPAWNS = [
  { x: -25, y: 1.6, z: -25 },
  { x: 25, y: 1.6, z: -25 },
  { x: -25, y: 1.6, z: 25 },
  { x: 25, y: 1.6, z: 25 },
  { x: 0, y: 1.6, z: -30 },
  { x: 0, y: 1.6, z: 30 }
];

function getRandomSpawn() {
  const p = SPAWNS[Math.floor(Math.random() * SPAWNS.length)];
  return { x: p.x + (Math.random() - 0.5) * 2, y: p.y, z: p.z + (Math.random() - 0.5) * 2 };
}

// Ray-Cylinder Hit Test for precision shooting
function checkRayPlayerHit(rayOrigin, rayDir, target) {
  // Target Bounding Cylinder
  const targetPos = { x: target.x, y: target.y + 0.9, z: target.z };
  const radius = 0.6;
  const height = 1.8;

  // Vector from origin to target center
  const dx = targetPos.x - rayOrigin.x;
  const dy = targetPos.y - rayOrigin.y;
  const dz = targetPos.z - rayOrigin.z;

  // Projection along ray direction
  const t = dx * rayDir.x + dy * rayDir.y + dz * rayDir.z;
  if (t < 0 || t > 100) return null; // Behind shooter or out of range

  // Closest point on ray
  const closestX = rayOrigin.x + rayDir.x * t;
  const closestY = rayOrigin.y + rayDir.y * t;
  const closestZ = rayOrigin.z + rayDir.z * t;

  // Distance from closest point to target center
  const distSq = (closestX - targetPos.x) ** 2 + (closestZ - targetPos.z) ** 2;
  const verticalDiff = Math.abs(closestY - targetPos.y);

  if (distSq <= radius * radius && verticalDiff <= height / 2) {
    const isHeadshot = closestY > (target.y + 1.4);
    return { hit: true, distance: t, isHeadshot };
  }

  return null;
}

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('joinGame', (data) => {
    const spawn = getRandomSpawn();
    const name = (data && data.name && data.name.trim()) ? data.name.trim().substring(0, 15) : `Operator_${socket.id.substring(0, 4)}`;

    players[socket.id] = {
      id: socket.id,
      name: name,
      x: spawn.x,
      y: spawn.y,
      z: spawn.z,
      rotationY: 0,
      pitch: 0,
      health: 100,
      armor: 50,
      kills: 0,
      deaths: 0,
      score: 0,
      weapon: data.weapon || 'rifle',
      isCrouching: false,
      isSprinting: false
    };

    socket.emit('initGameState', {
      selfId: socket.id,
      players: players,
      pickups: pickups
    });

    socket.broadcast.emit('playerJoined', players[socket.id]);
  });

  socket.on('playerUpdate', (data) => {
    const p = players[socket.id];
    if (!p || p.health <= 0) return;

    p.x = data.x;
    p.y = data.y;
    p.z = data.z;
    p.rotationY = data.rotationY;
    p.pitch = data.pitch;
    p.isCrouching = data.isCrouching;
    p.isSprinting = data.isSprinting;
    p.weapon = data.weapon || p.weapon;
  });

  socket.on('shoot', (shotData) => {
    const shooter = players[socket.id];
    if (!shooter || shooter.health <= 0) return;

    // Broadcast shoot sound/tracer to other players
    socket.broadcast.emit('weaponFired', {
      shooterId: shooter.id,
      weapon: shotData.weapon,
      origin: shotData.origin,
      direction: shotData.direction
    });

    // Check hit against all real players
    let closestHit = null;
    let closestDist = Infinity;
    let hitTarget = null;

    Object.values(players).forEach(target => {
      if (target.id === shooter.id || target.health <= 0) return;

      const hitInfo = checkRayPlayerHit(shotData.origin, shotData.direction, target);
      if (hitInfo && hitInfo.distance < closestDist) {
        closestDist = hitInfo.distance;
        closestHit = hitInfo;
        hitTarget = target;
      }
    });

    if (hitTarget && closestHit) {
      // Calculate damage
      const baseDamage = shotData.weapon === 'sniper' ? 85 : (shotData.weapon === 'shotgun' ? 50 : 25);
      const isHead = closestHit.isHeadshot;
      let damage = baseDamage * (isHead ? 2.0 : 1.0);

      // Apply armor reduction
      if (hitTarget.armor > 0) {
        const absorb = Math.min(hitTarget.armor, damage * 0.4);
        hitTarget.armor -= absorb;
        damage -= absorb;
      }

      hitTarget.health = Math.max(0, hitTarget.health - damage);

      // Send hit confirmed to shooter
      socket.emit('hitConfirmed', {
        targetId: hitTarget.id,
        damage: Math.round(damage),
        isHeadshot: isHead,
        isKill: hitTarget.health <= 0
      });

      // Send damage update to target
      io.to(hitTarget.id).emit('playerHit', {
        health: hitTarget.health,
        armor: hitTarget.armor,
        shooterId: shooter.id
      });

      // Handle Kill
      if (hitTarget.health <= 0) {
        shooter.kills += 1;
        shooter.score += isHead ? 150 : 100;
        hitTarget.deaths += 1;

        io.emit('killFeed', {
          killerName: shooter.name,
          victimName: hitTarget.name,
          weapon: shotData.weapon,
          isHeadshot: isHead
        });

        // Respawn after 3s
        setTimeout(() => {
          if (players[hitTarget.id]) {
            const spawn = getRandomSpawn();
            hitTarget.health = 100;
            hitTarget.armor = 50;
            hitTarget.x = spawn.x;
            hitTarget.y = spawn.y;
            hitTarget.z = spawn.z;
            io.emit('playerRespawned', {
              id: hitTarget.id,
              x: hitTarget.x,
              y: hitTarget.y,
              z: hitTarget.z
            });
          }
        }, 3000);
      }
    }
  });

  socket.on('collectPickup', (pickupId) => {
    const p = players[socket.id];
    if (!p || p.health <= 0) return;

    const pickup = pickups.find(item => item.id === pickupId);
    if (pickup && pickup.respawnTimer <= 0) {
      if (pickup.type === 'health' && p.health < 100) {
        p.health = Math.min(100, p.health + 50);
        pickup.respawnTimer = 15;
      } else if (pickup.type === 'armor' && p.armor < 100) {
        p.armor = Math.min(100, p.armor + 50);
        pickup.respawnTimer = 15;
      } else if (pickup.type === 'ammo') {
        socket.emit('ammoRefilled');
        pickup.respawnTimer = 10;
      }

      io.emit('pickupCollected', { pickupId, collectorId: p.id, health: p.health, armor: p.armor });
    }
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

// Tick Loop (40 Ticks/Sec for ultra smooth network sync)
setInterval(() => {
  pickups.forEach(p => {
    if (p.respawnTimer > 0) {
      p.respawnTimer -= 0.025;
      if (p.respawnTimer <= 0) {
        p.respawnTimer = 0;
        io.emit('pickupRespawned', p.id);
      }
    }
  });

  io.emit('worldUpdate', {
    players: players,
    onlineCount: Object.keys(players).length
  });
}, 25);

server.listen(PORT, () => {
  console.log(`Tactical Strike 3D running on http://localhost:${PORT}`);
});
