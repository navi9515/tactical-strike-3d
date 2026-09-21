const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// World Arena Bounds
const WORLD_SIZE = 3000;
const MAX_FOOD = 400;

const players = {};
const foodList = [];

// Seed initial food dots
for (let i = 0; i < MAX_FOOD; i++) {
  spawnFood();
}

function spawnFood(x, y, value, color) {
  foodList.push({
    id: `f_${Math.random().toString(36).substr(2, 9)}`,
    x: x !== undefined ? x : Math.floor(Math.random() * (WORLD_SIZE - 200) + 100),
    y: y !== undefined ? y : Math.floor(Math.random() * (WORLD_SIZE - 200) + 100),
    value: value || 1,
    color: color || getRandomColor()
  });
}

function getRandomColor() {
  const colors = ['#00f0ff', '#ff0055', '#f59e0b', '#10b981', '#a855f7', '#ec4899', '#3b82f6'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function getRandomSpawn() {
  return {
    x: Math.floor(Math.random() * (WORLD_SIZE - 600) + 300),
    y: Math.floor(Math.random() * (WORLD_SIZE - 600) + 300)
  };
}

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('joinGame', (data) => {
    const spawn = getRandomSpawn();
    const name = (data && data.name && data.name.trim()) ? data.name.trim().substring(0, 15) : `Snake_${socket.id.substring(0, 4)}`;

    players[socket.id] = {
      id: socket.id,
      name: name,
      color: data.color || '#00f0ff',
      x: spawn.x,
      y: spawn.y,
      angle: Math.random() * Math.PI * 2,
      score: 10,
      length: 15,
      isBoosting: false,
      body: [] // Array of {x, y} segment positions
    };

    // Initialize body segments
    for (let i = 0; i < players[socket.id].length; i++) {
      players[socket.id].body.push({ x: spawn.x - i * 10, y: spawn.y });
    }

    socket.emit('initGameState', {
      selfId: socket.id,
      worldSize: WORLD_SIZE,
      players: players,
      food: foodList
    });

    socket.broadcast.emit('playerJoined', players[socket.id]);
  });

  socket.on('playerUpdate', (data) => {
    const p = players[socket.id];
    if (!p) return;

    p.x = data.x;
    p.y = data.y;
    p.angle = data.angle;
    p.isBoosting = data.isBoosting;
    p.body = data.body || p.body;
    p.score = data.score || p.score;
  });

  socket.on('eatFood', (foodId) => {
    const idx = foodList.findIndex(f => f.id === foodId);
    if (idx !== -1) {
      const food = foodList[idx];
      foodList.splice(idx, 1);

      const p = players[socket.id];
      if (p) {
        p.score += food.value;
        p.length = Math.floor(15 + p.score / 2);
      }

      // Maintain food count
      if (foodList.length < MAX_FOOD) {
        spawnFood();
      }

      io.emit('foodEaten', { foodId, playerId: socket.id, newScore: p ? p.score : 0 });
    }
  });

  socket.on('playerDied', (data) => {
    const p = players[socket.id];
    if (p) {
      // Explode snake body into large food orbs
      if (p.body && p.body.length > 0) {
        const step = Math.max(1, Math.floor(p.body.length / 20));
        for (let i = 0; i < p.body.length; i += step) {
          const seg = p.body[i];
          spawnFood(seg.x + (Math.random() - 0.5) * 20, seg.y + (Math.random() - 0.5) * 20, 5, p.color);
        }
      }

      const killerName = data ? data.killerName : 'Barrier';
      io.emit('killFeed', { killerName, victimName: p.name });

      delete players[socket.id];
      io.emit('playerDisconnected', socket.id);
    }
  });

  socket.on('chatMessage', (msg) => {
    const p = players[socket.id];
    if (p && msg) {
      io.emit('chatMessage', { sender: p.name, text: msg.substring(0, 80) });
    }
  });

  socket.on('disconnect', () => {
    const p = players[socket.id];
    if (p) {
      delete players[socket.id];
      io.emit('playerDisconnected', socket.id);
    }
  });
});

// Server Game Loop (40 Ticks/sec)
setInterval(() => {
  io.emit('worldUpdate', {
    players: players,
    food: foodList,
    onlineCount: Object.keys(players).length
  });
}, 25);

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`Super Slither Arena running on http://localhost:${PORT}`);
  console.log(`====================================================`);
});
