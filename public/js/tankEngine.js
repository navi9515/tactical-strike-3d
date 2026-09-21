// 2D Canvas Engine & Tank Physics Controller for Cyber Tank Wars
class TankEngine {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.resizeCanvas();

    // Local Player State
    this.localPlayer = {
      x: 900,
      y: 600,
      bodyAngle: 0,
      turretAngle: 0,
      speed: 0,
      maxSpeed: 5.5,
      rotateSpeed: 0.05,
      health: 100,
      armor: 50,
      name: 'Commander',
      color: '#00f0ff',
      isDead: false
    };

    this.keys = { W: false, S: false, A: false, D: false, Shift: false };
    this.mouse = { x: 0, y: 0, worldX: 0, worldY: 0, isDown: false };

    this.worldMap = { width: 1800, height: 1200, obstacles: [] };
    this.players = {};
    this.bullets = [];
    this.pickups = [];
    this.particles = [];

    this.network = new NetworkManager(this);
    this.isPlaying = false;

    this.initLobbyUI();
    this.initInput();
    this.initRadar();

    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  initLobbyUI() {
    const btnJoin = document.getElementById('btn-join');
    const nameInput = document.getElementById('player-name-input');
    const colorBtns = document.querySelectorAll('.color-btn');

    colorBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        colorBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.localPlayer.color = btn.dataset.color;
      });
    });

    btnJoin.addEventListener('click', () => {
      this.localPlayer.name = nameInput.value.trim() || 'Commander';
      document.getElementById('lobby-screen').classList.add('hidden');
      document.getElementById('hud-overlay').classList.remove('hud-hidden');

      this.network.connect(this.localPlayer.name, this.localPlayer.color);
      this.isPlaying = true;
    });
  }

  initInput() {
    window.addEventListener('keydown', (e) => {
      if (!this.isPlaying) return;
      if (e.code === 'KeyW') this.keys.W = true;
      if (e.code === 'KeyS') this.keys.S = true;
      if (e.code === 'KeyA') this.keys.A = true;
      if (e.code === 'KeyD') this.keys.D = true;
      if (e.code === 'ShiftLeft') this.keys.Shift = true;

      if (e.code === 'Tab') {
        e.preventDefault();
        document.getElementById('scoreboard-modal').classList.remove('hidden');
      } else if (e.code === 'KeyT') {
        e.preventDefault();
        const chatInput = document.getElementById('chat-input');
        if (chatInput) chatInput.focus();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyW') this.keys.W = false;
      if (e.code === 'KeyS') this.keys.S = false;
      if (e.code === 'KeyA') this.keys.A = false;
      if (e.code === 'KeyD') this.keys.D = false;
      if (e.code === 'ShiftLeft') this.keys.Shift = false;

      if (e.code === 'Tab') {
        document.getElementById('scoreboard-modal').classList.add('hidden');
      }
    });

    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });

    window.addEventListener('mousedown', (e) => {
      if (!this.isPlaying || this.localPlayer.isDead) return;
      if (e.button === 0) {
        window.soundEngine.playCannon();
        this.network.sendShoot();
      }
    });

    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && chatInput.value.trim().length > 0) {
          this.network.sendChat(chatInput.value.trim());
          chatInput.value = '';
          chatInput.blur();
        }
      });
    }
  }

  initWorld(map, pickups) {
    this.worldMap = map;
    this.pickups = pickups;
  }

  updateWorldState(playersList, bulletsList, onlineCount) {
    this.players = playersList;
    this.bullets = bulletsList;

    const self = playersList[this.network.selfId];
    if (self) {
      // Sync local badges
      document.getElementById('badge-shield').classList.toggle('hidden', !(self.shield > 0));
      document.getElementById('badge-triple').classList.toggle('hidden', !(self.tripleShot > 0));
      document.getElementById('badge-speed').classList.toggle('hidden', !(self.speedBoost > 0));
    }

    const status = document.getElementById('match-status');
    if (status) {
      if (onlineCount <= 1) {
        status.innerText = `WAITING FOR OPPONENT (1 PLAYER ONLINE)`;
        status.style.color = '#f59e0b';
      } else {
        status.innerText = `LIVE MATCH (${onlineCount} PLAYERS ONLINE)`;
        status.style.color = '#00f0ff';
      }
    }

    this.updateScoreboard(playersList);
  }

  updateLocalPhysics(dt) {
    if (this.localPlayer.isDead) return;

    const self = this.players[this.network.selfId];
    const topSpeed = (self && self.speedBoost > 0) ? 8.5 : (this.keys.Shift ? 7.5 : 5.0);

    // Body rotation
    if (this.keys.A) this.localPlayer.bodyAngle -= this.localPlayer.rotateSpeed;
    if (this.keys.D) this.localPlayer.bodyAngle += this.localPlayer.rotateSpeed;

    // Movement Forward/Backward
    let targetSpeed = 0;
    if (this.keys.W) targetSpeed = topSpeed;
    if (this.keys.S) targetSpeed = -topSpeed * 0.6;

    this.localPlayer.speed += (targetSpeed - this.localPlayer.speed) * dt * 10;

    let nextX = this.localPlayer.x + Math.cos(this.localPlayer.bodyAngle) * this.localPlayer.speed;
    let nextY = this.localPlayer.y + Math.sin(this.localPlayer.bodyAngle) * this.localPlayer.speed;

    // Map boundary check
    nextX = Math.max(30, Math.min(this.worldMap.width - 30, nextX));
    nextY = Math.max(30, Math.min(this.worldMap.height - 30, nextY));

    // Obstacle Box Collisions
    const r = 24;
    let collide = false;
    for (let obs of this.worldMap.obstacles) {
      const closestX = Math.max(obs.x, Math.min(nextX, obs.x + obs.w));
      const closestY = Math.max(obs.y, Math.min(nextY, obs.y + obs.h));
      const dx = nextX - closestX;
      const dy = nextY - closestY;
      if ((dx * dx + dy * dy) < (r * r)) {
        collide = true;
        break;
      }
    }

    if (!collide) {
      this.localPlayer.x = nextX;
      this.localPlayer.y = nextY;
    }

    // Turret aiming towards Mouse World Coordinate
    const cameraX = this.localPlayer.x - this.canvas.width / 2;
    const cameraY = this.localPlayer.y - this.canvas.height / 2;
    this.mouse.worldX = this.mouse.x + cameraX;
    this.mouse.worldY = this.mouse.y + cameraY;

    this.localPlayer.turretAngle = Math.atan2(
      this.mouse.worldY - this.localPlayer.y,
      this.mouse.worldX - this.localPlayer.x
    );

    // Check Pickup Collections
    this.pickups.forEach(p => {
      if (p.active) {
        const dx = p.x - this.localPlayer.x;
        const dy = p.y - this.localPlayer.y;
        if (dx * dx + dy * dy < 35 * 35) {
          this.network.sendPickupCollect(p.id);
        }
      }
    });

    // Send network state update
    this.network.sendUpdate(this.localPlayer);
  }

  spawnExplosion(x, y) {
    window.soundEngine.playExplosion();
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.3,
        color: Math.random() > 0.5 ? '#ffaa00' : '#ff0055'
      });
    }
  }

  setPickupActive(pickupId, active) {
    const p = this.pickups.find(item => item.id === pickupId);
    if (p) p.active = active;
  }

  updateHUD() {
    const hpFill = document.getElementById('health-fill');
    const hpVal = document.getElementById('health-val');
    const armFill = document.getElementById('armor-fill');
    const armVal = document.getElementById('armor-val');

    if (hpFill) hpFill.style.width = `${this.localPlayer.health}%`;
    if (hpVal) hpVal.innerText = Math.round(this.localPlayer.health);
    if (armFill) armFill.style.width = `${this.localPlayer.armor}%`;
    if (armVal) armVal.innerText = Math.round(this.localPlayer.armor);
  }

  addKillFeedItem(data) {
    const feed = document.getElementById('kill-feed');
    if (!feed) return;

    const item = document.createElement('div');
    item.className = 'kill-item';
    item.innerHTML = `<span class="killer">${data.killerName}</span> [CANNON] <span class="victim">${data.victimName}</span>`;

    feed.appendChild(item);
    setTimeout(() => { if (feed.contains(item)) feed.removeChild(item); }, 4000);
  }

  addChatMessage(sender, text) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'chat-item';
    div.innerHTML = `<span class="chat-sender">${sender}:</span><span>${text}</span>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  triggerRespawnScreen(killerName) {
    const screen = document.getElementById('respawn-screen');
    const text = document.getElementById('killed-by-text');
    const countdown = document.getElementById('respawn-countdown');

    if (!screen) return;
    text.innerText = `Destroyed by ${killerName || 'Enemy Tank'}`;
    screen.classList.remove('hidden');

    let left = 3;
    countdown.innerText = left;
    const timer = setInterval(() => {
      left -= 1;
      if (left <= 0) clearInterval(timer);
      else countdown.innerText = left;
    }, 1000);
  }

  updateScoreboard(playersList) {
    const tbody = document.getElementById('scoreboard-tbody');
    if (!tbody) return;

    const sorted = Object.values(playersList).sort((a, b) => b.score - a.score);
    tbody.innerHTML = '';

    sorted.forEach((p, idx) => {
      const tr = document.createElement('tr');
      if (p.id === this.network.selfId) tr.classList.add('self-row');
      tr.innerHTML = `
        <td>#${idx + 1}</td>
        <td>${p.name}</td>
        <td style="color:#00f0ff;">${p.kills}</td>
        <td style="color:#ff4757;">${p.deaths}</td>
        <td style="color:#f59e0b;">${p.score}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  initRadar() {
    this.radarCanvas = document.getElementById('radar-canvas');
    if (this.radarCanvas) this.radarCtx = this.radarCanvas.getContext('2d');
  }

  drawRadar() {
    if (!this.radarCtx) return;
    const ctx = this.radarCtx;
    const w = 110;
    const h = 110;
    const scaleX = w / this.worldMap.width;
    const scaleY = h / this.worldMap.height;

    ctx.clearRect(0, 0, w, h);

    // Map bounds
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
    ctx.strokeRect(0, 0, w, h);

    // Draw Obstacles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    this.worldMap.obstacles.forEach(obs => {
      ctx.fillRect(obs.x * scaleX, obs.y * scaleY, obs.w * scaleX, obs.h * scaleY);
    });

    // Draw Players
    Object.values(this.players).forEach(p => {
      ctx.fillStyle = p.id === this.network.selfId ? '#00f0ff' : '#ff4757';
      ctx.beginPath();
      ctx.arc(p.x * scaleX, p.y * scaleY, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Camera offset centered on local player
    const cameraX = this.localPlayer.x - w / 2;
    const cameraY = this.localPlayer.y - h / 2;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(-cameraX, -cameraY);

    // 1. Cyber Grid Floor
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const gridSize = 80;
    for (let x = 0; x < this.worldMap.width; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.worldMap.height); ctx.stroke();
    }
    for (let y = 0; y < this.worldMap.height; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.worldMap.width, y); ctx.stroke();
    }

    // World Boundary Border
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 15;
    ctx.strokeRect(0, 0, this.worldMap.width, this.worldMap.height);
    ctx.shadowBlur = 0;

    // 2. Obstacles
    this.worldMap.obstacles.forEach(obs => {
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 3;
      ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
    });

    // 3. Power-Ups
    this.pickups.forEach(p => {
      if (p.active) {
        ctx.save();
        ctx.translate(p.x, p.y);

        let color = '#00f0ff';
        let icon = '🛡️';
        if (p.type === 'triple') { color = '#f59e0b'; icon = '🚀'; }
        if (p.type === 'speed') { color = '#eab308'; icon = '⚡'; }
        if (p.type === 'health') { color = '#10b981'; icon = '💊'; }

        // Glow Aura
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();

        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, 0, 0);

        ctx.restore();
      }
    });

    // 4. Bullets
    this.bullets.forEach(b => {
      ctx.save();
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 5. Explosions Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.life -= 0.016;

      if (pt.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4 * pt.life, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Tanks (Local & Remote Players)
    Object.values(this.players).forEach(p => {
      if (p.health <= 0) return;

      const isSelf = p.id === this.network.selfId;
      const x = isSelf ? this.localPlayer.x : p.x;
      const y = isSelf ? this.localPlayer.y : p.y;
      const bodyAngle = isSelf ? this.localPlayer.bodyAngle : p.bodyAngle;
      const turretAngle = isSelf ? this.localPlayer.turretAngle : p.turretAngle;

      ctx.save();
      ctx.translate(x, y);

      // Active Shield Ring
      if (p.shield > 0) {
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(0, 0, 32, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Tank Body Chassis
      ctx.save();
      ctx.rotate(bodyAngle);

      // Treads
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-24, -20, 48, 8);
      ctx.fillRect(-24, 12, 48, 8);

      // Main Hull
      ctx.fillStyle = p.color || '#00f0ff';
      ctx.fillRect(-18, -14, 36, 28);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(-18, -14, 36, 28);

      ctx.restore();

      // Laser Sight Line (for self)
      if (isSelf) {
        ctx.save();
        ctx.rotate(turretAngle);
        ctx.strokeStyle = 'rgba(255, 0, 85, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(35, 0);
        ctx.lineTo(400, 0);
        ctx.stroke();
        ctx.restore();
      }

      // Tank Turret
      ctx.save();
      ctx.rotate(turretAngle);

      // Cannon Barrel
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, -4, 32, 8);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(26, -5, 8, 10); // Muzzle Hider

      // Turret Dome
      ctx.fillStyle = '#111827';
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = p.color || '#00f0ff';
      ctx.lineWidth = 2; ctx.stroke();

      ctx.restore();

      // Player Name & Health Bar Tag
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px Rajdhani';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, 0, -32);

      // Health bar above tank
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(-20, -26, 40, 5);
      ctx.fillStyle = '#ff0055';
      ctx.fillRect(-20, -26, (p.health / 100) * 40, 5);

      ctx.restore();
    });

    ctx.restore(); // Restore camera offset
  }

  start() {
    let lastTime = performance.now();
    const loop = (now) => {
      requestAnimationFrame(loop);
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      if (this.isPlaying) {
        this.updateLocalPhysics(dt);
        this.drawRadar();
      }

      this.render();
    };
    loop(lastTime);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const game = new TankEngine();
  game.start();
});
