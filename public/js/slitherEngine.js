// 2D Canvas Engine & Snake Physics Controller for Super Slither Arena
class SlitherEngine {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.resizeCanvas();

    // Local Player Snake State
    this.localPlayer = {
      x: 1500,
      y: 1500,
      angle: 0,
      targetAngle: 0,
      speed: 4.5,
      normalSpeed: 4.5,
      boostSpeed: 8.5,
      radius: 14,
      score: 10,
      length: 15,
      name: 'Slither',
      color: '#00f0ff',
      isBoosting: false,
      isDead: false,
      body: []
    };

    this.mouse = { x: 0, y: 0, worldX: 0, worldY: 0 };
    this.worldSize = 3000;
    this.players = {};
    this.foodList = [];

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
    const btnRespawn = document.getElementById('btn-respawn');
    const nameInput = document.getElementById('player-name-input');
    const colorBtns = document.querySelectorAll('.color-btn');

    colorBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        colorBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.localPlayer.color = btn.dataset.color;
      });
    });

    const joinAction = () => {
      this.localPlayer.name = nameInput.value.trim() || 'Slither';
      this.localPlayer.score = 10;
      this.localPlayer.length = 15;
      this.localPlayer.isDead = false;
      this.localPlayer.body = [];

      document.getElementById('lobby-screen').classList.add('hidden');
      document.getElementById('respawn-screen').classList.add('hidden');
      document.getElementById('hud-overlay').classList.remove('hud-hidden');

      this.network.connect(this.localPlayer.name, this.localPlayer.color);
      this.isPlaying = true;
    };

    btnJoin.addEventListener('click', joinAction);
    if (btnRespawn) btnRespawn.addEventListener('click', () => location.reload());
  }

  initInput() {
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });

    window.addEventListener('mousedown', (e) => {
      if (!this.isPlaying || this.localPlayer.isDead) return;
      if (e.button === 0) this.localPlayer.isBoosting = true;
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.localPlayer.isBoosting = false;
    });

    window.addEventListener('keydown', (e) => {
      if (!this.isPlaying) return;
      if (e.code === 'Space') this.localPlayer.isBoosting = true;

      if (e.code === 'KeyT') {
        e.preventDefault();
        const chatInput = document.getElementById('chat-input');
        if (chatInput) chatInput.focus();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this.localPlayer.isBoosting = false;
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

  initWorld(worldSize, foodList) {
    this.worldSize = worldSize;
    this.foodList = foodList;
  }

  updateWorldState(playersList, foodList, onlineCount) {
    this.players = playersList;
    this.foodList = foodList;

    const status = document.getElementById('match-status');
    if (status) {
      if (onlineCount <= 1) {
        status.innerText = `WAITING FOR OPPONENTS (1 SLITHER ONLINE)`;
        status.style.color = '#f59e0b';
      } else {
        status.innerText = `LIVE MATCH (${onlineCount} SLITHERS ONLINE)`;
        status.style.color = '#00f0ff';
      }
    }

    this.updateLeaderboard(playersList);
  }

  updateLocalPhysics(dt) {
    if (this.localPlayer.isDead) return;

    // Camera Center
    const cameraX = this.localPlayer.x - this.canvas.width / 2;
    const cameraY = this.localPlayer.y - this.canvas.height / 2;
    this.mouse.worldX = this.mouse.x + cameraX;
    this.mouse.worldY = this.mouse.y + cameraY;

    // Calculate mouse angle relative to head
    const targetAngle = Math.atan2(
      this.mouse.worldY - this.localPlayer.y,
      this.mouse.worldX - this.localPlayer.x
    );

    // Smooth Head Angle Rotation
    let diff = targetAngle - this.localPlayer.angle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.localPlayer.angle += diff * dt * 10;

    // Speed calculation
    const currentSpeed = (this.localPlayer.isBoosting && this.localPlayer.score > 5)
      ? this.localPlayer.boostSpeed
      : this.localPlayer.normalSpeed;

    // Reduce score slowly while boosting
    if (this.localPlayer.isBoosting && this.localPlayer.score > 5) {
      this.localPlayer.score -= dt * 3;
      this.localPlayer.length = Math.max(15, Math.floor(15 + this.localPlayer.score / 2));
    }

    // Move Head Forward
    this.localPlayer.x += Math.cos(this.localPlayer.angle) * currentSpeed;
    this.localPlayer.y += Math.sin(this.localPlayer.angle) * currentSpeed;

    // Boundary Check
    if (this.localPlayer.x < 50 || this.localPlayer.x > this.worldSize - 50 ||
        this.localPlayer.y < 50 || this.localPlayer.y > this.worldSize - 50) {
      this.die('Boundary Wall');
      return;
    }

    // Update Body Segments History
    this.localPlayer.body.unshift({ x: this.localPlayer.x, y: this.localPlayer.y });
    const targetBodyCount = this.localPlayer.length;
    while (this.localPlayer.body.length > targetBodyCount) {
      this.localPlayer.body.pop();
    }

    // 1. Food Collision Check
    const headRadius = this.localPlayer.radius;
    for (let i = this.foodList.length - 1; i >= 0; i--) {
      const f = this.foodList[i];
      const dx = f.x - this.localPlayer.x;
      const dy = f.y - this.localPlayer.y;
      if (dx * dx + dy * dy < (headRadius + 12) ** 2) {
        this.network.sendEatFood(f.id);
        this.foodList.splice(i, 1);
        this.localPlayer.score += f.value;
        this.localPlayer.length = Math.floor(15 + this.localPlayer.score / 2);
        this.updateHUD();
      }
    }

    // 2. Head-to-Opponent-Body Collision Check
    Object.values(this.players).forEach(other => {
      if (other.id === this.network.selfId || !other.body) return;

      for (let i = 2; i < other.body.length; i++) {
        const seg = other.body[i];
        const dx = seg.x - this.localPlayer.x;
        const dy = seg.y - this.localPlayer.y;
        if (dx * dx + dy * dy < (headRadius + 10) ** 2) {
          this.die(other.name);
          return;
        }
      }
    });

    // Send update to server
    this.network.sendUpdate(this.localPlayer);
  }

  die(killerName) {
    if (this.localPlayer.isDead) return;
    this.localPlayer.isDead = true;
    this.network.sendDie(killerName);
    this.triggerRespawnScreen(killerName);
  }

  updateHUD() {
    const scoreVal = document.getElementById('score-val');
    const lengthVal = document.getElementById('length-val');
    if (scoreVal) scoreVal.innerText = Math.round(this.localPlayer.score);
    if (lengthVal) lengthVal.innerText = Math.round(this.localPlayer.length);
  }

  updateLeaderboard(playersList) {
    const lbList = document.getElementById('lb-list');
    if (!lbList) return;

    const sorted = Object.values(playersList).sort((a, b) => b.score - a.score).slice(0, 5);
    lbList.innerHTML = '';

    sorted.forEach((p, idx) => {
      const div = document.createElement('div');
      div.className = 'lb-row' + (p.id === this.network.selfId ? ' self' : '');
      div.innerHTML = `<span>#${idx + 1} ${p.name}</span><span>${Math.round(p.score)}</span>`;
      lbList.appendChild(div);
    });
  }

  addKillFeedItem(data) {
    const feed = document.getElementById('kill-feed');
    if (!feed) return;

    const item = document.createElement('div');
    item.className = 'kill-item';
    item.innerHTML = `<span class="killer">${data.killerName}</span> trapped <span class="victim">${data.victimName}</span>`;

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
    if (text) text.innerText = `You ran into ${killerName || 'a barrier'}!`;
    if (screen) screen.classList.remove('hidden');
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
    const scale = w / this.worldSize;

    ctx.clearRect(0, 0, w, h);

    // Border
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
    ctx.strokeRect(0, 0, w, h);

    // Draw Players
    Object.values(this.players).forEach(p => {
      ctx.fillStyle = p.id === this.network.selfId ? '#00f0ff' : '#ff0055';
      ctx.beginPath();
      ctx.arc(p.x * scale, p.y * scale, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Camera offset centered on local player snake head
    const cameraX = this.localPlayer.x - w / 2;
    const cameraY = this.localPlayer.y - h / 2;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(-cameraX, -cameraY);

    // 1. Grid Background
    ctx.strokeStyle = '#0e1726';
    ctx.lineWidth = 1;
    const gridSize = 100;
    for (let x = 0; x < this.worldSize; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.worldSize); ctx.stroke();
    }
    for (let y = 0; y < this.worldSize; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.worldSize, y); ctx.stroke();
    }

    // World Red Danger Border
    ctx.strokeStyle = '#ff0055';
    ctx.lineWidth = 8;
    ctx.shadowColor = '#ff0055';
    ctx.shadowBlur = 20;
    ctx.strokeRect(0, 0, this.worldSize, this.worldSize);
    ctx.shadowBlur = 0;

    // 2. Food Dots
    this.foodList.forEach(f => {
      ctx.save();
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.value > 1 ? 8 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 3. Render Snakes (Local & Remote Players)
    Object.values(this.players).forEach(p => {
      if (!p.body || p.body.length === 0) return;

      const isSelf = p.id === this.network.selfId;
      const body = isSelf ? this.localPlayer.body : p.body;
      const color = isSelf ? this.localPlayer.color : (p.color || '#00f0ff');
      const radius = 14 + Math.min(10, p.score / 100);

      // Render Body Segments from Tail to Head
      for (let i = body.length - 1; i >= 0; i--) {
        const seg = body[i];
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = i === 0 ? 15 : 6;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(seg.x, seg.y, radius * (1 - (i / body.length) * 0.4), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Render Head Eyes & Name Tag
      const head = body[0] || { x: p.x, y: p.y };
      const angle = isSelf ? this.localPlayer.angle : p.angle;

      ctx.save();
      ctx.translate(head.x, head.y);
      ctx.rotate(angle);

      // Cute Eyes
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(6, -7, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(6, 7, 4.5, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#000000';
      ctx.beginPath(); ctx.arc(8, -7, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(8, 7, 2, 0, Math.PI * 2); ctx.fill();

      ctx.restore();

      // Name Tag
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Rajdhani';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, head.x, head.y - radius - 10);
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
  const game = new SlitherEngine();
  game.start();
});
