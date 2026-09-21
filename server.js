const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Game state (Pure Human Multiplayer - NO BOTS)
const players = {};
const pickups = [];
const MAP_BOUNDS = { minX: -60, maxX: 60, minZ: -60, maxZ: 60 };

// Spawns configuration
const SPAWN_POINTS = [
  { x: -45, y: 1.6, z: -45 },
  { x: 45, y: 1.6, z: -45 },
  { x: -45, y: 1.6, z: 45 },
  { x: 45, y: 1.6, z: 45 },
  { x: 0, y: 1.6, z: -45 },
  { x: 0, y: 1.6, z: 45 },
  { x: -45, y: 1.6, z: 0 },
  { x: 45, y: 1.6, z: 0 },
  { x: 0, y: 10, z: 0 } // Sniper tower top
];

// Initial Pickups
const INITIAL_PICKUPS = [
  { id: 'hp_1', type: 'health', x: -20, y: 0.5, z: -20, respawnTimer: 0 },
  { id: 'hp_2', type: 'health', x: 20, y: 0.5, z: 20, respawnTimer: 0 },
  { id: 'arm_1', type: 'armor', x: -20, y: 0.5, z: 20, respawnTimer: 0 },
  { id: 'arm_2', type: 'armor', x: 20, y: 0.5, z: -20, respawnTimer: 0 },
  { id: 'ammo_1', type: 'ammo', x: 0, y: 0.5, z: -30, respawnTimer: 0 },
  { id: 'ammo_2', type: 'ammo', x: 0, y: 0.5, z: 30, respawnTimer: 0 },
  { id: 'hp_tower', type: 'health', x: 0, y: 10.5, z: 0, respawnTimer: 0 }
];

INITIAL_PICKUPS.forEach(p => pickups.push({ ...p }));

// Weapons Data
const WEAPONS = {
  rifle: { name: 'Assault Rifle', damage: 24, headshotMult: 2.2, fireRate: 110, spread: 0.02 },
  sniper: { name: 'Sniper Rifle', damage: 85, headshotMult: 2.5, fireRate: 900, spread: 0.005 },
  shotgun: { name: 'Shotgun', damage: 14, headshotMult: 1.5, fireRate: 750, spread: 0.08, pellets: 8 },
  pistol: { name: 'Tactical Pistol', damage: 20, headshotMult: 2.0, fireRate: 200, spread: 0.03 }
};

function getRandomSpawn() {
  const p = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
  return { x: p.x + (Math.random() - 0.5) * 4, y: p.y, z: p.z + (Math.random() - 0.5) * 4 };
}

// Shot logic & collision validation (Real Players ONLY)
function executeShot(shooter, shotData) {
  const w = WEAPONS[shotData.weapon] || WEAPONS.rifle;

  // Broadcast shoot event to all clients so they render opponent muzzle & sound
  io.emit('weaponFired', {
    shooterId: shooter.id,
    weapon: shotData.weapon,
    origin: shotData.origin,
    direction: shotData.direction
  });

  // Target list contains ONLY real human players who opened website
  const targets = Object.values(players);

  targets.forEach(target => {
    if (target.id === shooter.id || target.health <= 0) return;

    // Hit distance test
    const dx = target.x - shotData.origin.x;
    const dz = target.z - shotData.origin.z;
    const dist2D = Math.sqrt(dx * dx + dz * dz);

    if (dist2D > 60) return; // Max range

    // Check angle alignment
    const shotAngle = Math.atan2(shotData.direction.x, shotData.direction.z);
    const targetAngle = Math.atan2(dx, dz);
    const angleDiff = Math.abs(shotAngle - targetAngle);

    if (angleDiff < 0.18 || angleDiff > Math.PI * 2 - 0.18) {
      // Hit detected on real opponent!
      const isHeadshot = Math.random() < 0.25; // 25% headshot multiplier
      let rawDamage = w.damage * (isHeadshot ? w.headshotMult : 1.0);
      
      // Armor reduction
      if (target.armor > 0) {
        const armorAbsorb = Math.min(target.armor, rawDamage * 0.5);
        target.armor -= armorAbsorb;
        rawDamage -= armorAbsorb;
      }

      target.health = Math.max(0, target.health - rawDamage);

      // Send hit notification to shooter socket
      io.to(shooter.id).emit('hitConfirmed', {
        targetId: target.id,
        damage: Math.round(rawDamage),
        isHeadshot,
        isKill: target.health <= 0
      });

      // Notify hit target
      io.to(target.id).emit('playerHit', {
        targetId: target.id,
        health: target.health,
        armor: target.armor,
        shooterId: shooter.id
      });

      // Handle Kill
      if (target.health <= 0) {
        shooter.kills += 1;
        shooter.score += isHeadshot ? 150 : 100;
        target.deaths += 1;

        io.emit('killFeed', {
          killerId: shooter.id,
          killerName: shooter.name,
          victimId: target.id,
          victimName: target.name,
          weapon: shotData.weapon,
          isHeadshot
        });

        // Respawn timer
        setTimeout(() => {
          if (players[target.id]) {
            const spawn = getRandomSpawn();
            target.health = 100;
            target.armor = 50;
            target.x = spawn.x;
            target.y = spawn.y;
            target.z = spawn.z;
            io.emit('playerRespawned', {
              id: target.id,
              x: target.x,
              y: target.y,
              z: target.z,
              health: 100,
              armor: 50
            });
          }
        }, 3000);
      }
    }
  });
}

// Socket Connection handling for real users
io.on('connection', (socket) => {
  console.log(`Real player connected: ${socket.id}`);

  // Handle player join request
  socket.on('joinGame', (data) => {
    const spawn = getRandomSpawn();
    const playerName = (data && data.name && data.name.trim()) ? data.name.trim().substring(0, 15) : `Operator_${socket.id.substring(0, 4)}`;

    players[socket.id] = {
      id: socket.id,
      name: playerName,
      isBot: false,
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

    // Send full init state to joining player
    socket.emit('initGameState', {
      selfId: socket.id,
      players: players,
      pickups: pickups
    });

    // Notify other players
    socket.broadcast.emit('playerJoined', players[socket.id]);
  });

  // Handle position/state updates from client
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

  // Handle shoot event from client
  socket.on('shoot', (shotData) => {
    const p = players[socket.id];
    if (!p || p.health <= 0) return;

    executeShot(p, shotData);
  });

  // Handle Pickup collection
  socket.on('collectPickup', (pickupId) => {
    const p = players[socket.id];
    if (!p || p.health <= 0) return;

    const pickup = pickups.find(item => item.id === pickupId);
    if (pickup && pickup.respawnTimer <= 0) {
      if (pickup.type === 'health' && p.health < 100) {
        p.health = Math.min(100, p.health + 40);
        pickup.respawnTimer = 15;
      } else if (pickup.type === 'armor' && p.armor < 100) {
        p.armor = Math.min(100, p.armor + 50);
        pickup.respawnTimer = 15;
      } else if (pickup.type === 'ammo') {
        socket.emit('ammoRefilled');
        pickup.respawnTimer = 10;
      }

      io.emit('pickupCollected', { pickupId, respawnTime: pickup.respawnTimer, collectorId: p.id, playerHealth: p.health, playerArmor: p.armor });
    }
  });

  // Handle Chat Message
  socket.on('chatMessage', (msg) => {
    const p = players[socket.id];
    if (p && msg) {
      io.emit('chatMessage', { sender: p.name, text: msg.substring(0, 80) });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

// Server Game Loop (30 Ticks/sec)
let lastTick = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = (now - lastTick) / 1000;
  lastTick = now;

  // Tick pickups respawn timers
  pickups.forEach(p => {
    if (p.respawnTimer > 0) {
      p.respawnTimer -= dt;
      if (p.respawnTimer <= 0) {
        p.respawnTimer = 0;
        io.emit('pickupRespawned', p.id);
      }
    }
  });

  // Broadcast world state containing ONLY real human players to all connected clients
  io.emit('worldUpdate', {
    players: players,
    onlineCount: Object.keys(players).length
  });
}, 1000 / 30);

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`Tactical Strike 3D Server running on http://localhost:${PORT}`);
  console.log(`Mode: PURE HUMAN MULTIPLAYER (NO BOTS)`);
  console.log(`====================================================`);
});
