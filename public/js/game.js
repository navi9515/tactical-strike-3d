// Tactical Strike 3D - High-FPS Main Game Engine
class GameEngine {
  constructor() {
    this.container = document.getElementById('game-container');
    this.clock = new THREE.Clock();

    // 1. Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 400);

    // 2. High-Performance WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    // 3. Game Subsystems
    this.map = new TacticalMap(this.scene);
    this.localPlayer = new LocalPlayer(this.camera, this.renderer.domElement, this.map.colliders);
    this.weaponManager = new WeaponManager(this.scene, this.camera);
    this.networkManager = new NetworkManager(this);

    this.isPlaying = false;
    this.selectedWeapon = 'rifle';

    this.initLobbyUI();
    this.initInputListeners();
    this.initRadar();

    window.addEventListener('resize', () => this.onWindowResize());
  }

  initLobbyUI() {
    const btnJoin = document.getElementById('btn-join');
    const nameInput = document.getElementById('player-name-input');
    const weaponCards = document.querySelectorAll('.weapon-card');

    weaponCards.forEach(card => {
      card.addEventListener('click', () => {
        weaponCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.selectedWeapon = card.dataset.weapon;
      });
    });

    btnJoin.addEventListener('click', () => {
      const callsign = nameInput.value || 'Operator';
      document.getElementById('lobby-screen').classList.add('hidden');
      document.getElementById('hud-overlay').classList.remove('hud-hidden');

      this.renderer.domElement.requestPointerLock();

      this.networkManager.connect(callsign, this.selectedWeapon);
      this.weaponManager.switchWeapon(this.selectedWeapon);

      this.isPlaying = true;
    });
  }

  initInputListeners() {
    const dom = this.renderer.domElement;

    dom.addEventListener('click', () => {
      if (this.isPlaying && !this.localPlayer.isDead && document.pointerLockElement !== dom) {
        dom.requestPointerLock();
      }
    });

    window.addEventListener('mousedown', (e) => {
      if (!this.isPlaying || this.localPlayer.isDead || document.pointerLockElement !== dom) return;

      if (e.button === 0) { // Left Click - Fire
        this.tryShoot();
      } else if (e.button === 2) { // Right Click - ADS
        this.weaponManager.setADS(true);
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) {
        this.weaponManager.setADS(false);
      }
    });

    window.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      if (!this.isPlaying) return;

      if (e.code === 'KeyR') {
        this.weaponManager.reload();
      } else if (e.code === 'Digit1') {
        this.weaponManager.switchWeapon('rifle');
      } else if (e.code === 'Digit2') {
        this.weaponManager.switchWeapon('sniper');
      } else if (e.code === 'Digit3') {
        this.weaponManager.switchWeapon('shotgun');
      } else if (e.code === 'Digit4') {
        this.weaponManager.switchWeapon('pistol');
      } else if (e.code === 'Tab') {
        e.preventDefault();
        const scoreModal = document.getElementById('scoreboard-modal');
        if (scoreModal) scoreModal.classList.remove('hidden');
      } else if (e.code === 'KeyT') {
        e.preventDefault();
        const chatInput = document.getElementById('chat-input');
        if (chatInput) chatInput.focus();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Tab') {
        const scoreModal = document.getElementById('scoreboard-modal');
        if (scoreModal) scoreModal.classList.add('hidden');
      }
    });

    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && chatInput.value.trim().length > 0) {
          this.networkManager.sendChat(chatInput.value.trim());
          chatInput.value = '';
          chatInput.blur();
          dom.requestPointerLock();
        }
      });
    }
  }

  tryShoot() {
    this.weaponManager.shoot((weaponKey) => {
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      const origin = new THREE.Vector3();
      this.camera.getWorldPosition(origin);

      this.networkManager.sendShoot({
        origin: { x: origin.x, y: origin.y, z: origin.z },
        direction: { x: dir.x, y: dir.y, z: dir.z },
        weapon: weaponKey
      });
    });
  }

  showHitmarker(isHeadshot) {
    const hm = document.getElementById('hitmarker');
    if (!hm) return;
    hm.className = 'active' + (isHeadshot ? ' headshot' : '');
    window.soundEngine.playHitmarker(isHeadshot);

    setTimeout(() => {
      hm.className = '';
    }, 120);
  }

  addKillFeedItem(data) {
    const feed = document.getElementById('kill-feed');
    if (!feed) return;

    const item = document.createElement('div');
    item.className = 'kill-item';
    item.innerHTML = `
      <span class="killer">${data.killerName}</span>
      <span class="weapon-icon">[${data.weapon.toUpperCase()}]</span>
      <span class="victim">${data.victimName}</span>
      ${data.isHeadshot ? '<span class="headshot-badge">🎯 HEADSHOT</span>' : ''}
    `;

    feed.appendChild(item);
    setTimeout(() => {
      if (feed.contains(item)) feed.removeChild(item);
    }, 4500);
  }

  addChatMessage(sender, text) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'chat-item';
    div.innerHTML = `<span class="chat-sender">${sender}:</span><span class="chat-text">${text}</span>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  triggerRespawnScreen(killerName) {
    const screen = document.getElementById('respawn-screen');
    const text = document.getElementById('killed-by-text');
    const countdown = document.getElementById('respawn-countdown');

    if (!screen) return;
    text.innerText = `Killed by ${killerName || 'Enemy'}`;
    screen.classList.remove('hidden');

    let left = 3;
    countdown.innerText = left;
    const timer = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(timer);
      } else {
        countdown.innerText = left;
      }
    }, 1000);
  }

  initRadar() {
    this.radarCanvas = document.getElementById('radar-canvas');
    if (this.radarCanvas) {
      this.radarCtx = this.radarCanvas.getContext('2d');
    }
  }

  drawRadar() {
    if (!this.radarCtx) return;
    const ctx = this.radarCtx;
    const w = 120;
    const h = 120;
    const cx = w / 2;
    const cy = h / 2;
    const scale = 0.8;

    ctx.clearRect(0, 0, w, h);

    // Radar Grid
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 50, 0, Math.PI * 2);
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.stroke();

    const localPos = this.localPlayer.position;

    // Draw Remote Players
    Object.values(this.networkManager.remotePlayers).forEach(rp => {
      const dx = (rp.targetPos.x - localPos.x) * scale;
      const dz = (rp.targetPos.z - localPos.z) * scale;
      const rx = cx + dx;
      const ry = cy + dz;

      if (rx >= 0 && rx <= w && ry >= 0 && ry <= h) {
        ctx.fillStyle = '#ff4757';
        ctx.beginPath();
        ctx.arc(rx, ry, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw Self Icon & Direction Arrow
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();

    const dirX = Math.sin(this.localPlayer.rotationY) * 12;
    const dirZ = -Math.cos(this.localPlayer.rotationY) * 12;
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - dirX, cy + dirZ);
    ctx.stroke();
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  start() {
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.05);

      if (this.isPlaying) {
        this.localPlayer.update(dt);
        this.weaponManager.update(dt);
        this.map.updatePickups(dt);

        this.networkManager.sendUpdate(this.localPlayer);
        this.networkManager.update(dt);

        this.drawRadar();
      }

      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const game = new GameEngine();
  game.start();
});
