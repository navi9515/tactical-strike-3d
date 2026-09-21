// Network Manager for Real-Time Socket.io Synchronization (Human Players Only)
class NetworkManager {
  constructor(game) {
    this.game = game;
    this.socket = null;
    this.selfId = null;
    this.remotePlayers = {};
    this.updateRate = 1000 / 30; // 30 updates per second
    this.lastSendTime = 0;
  }

  connect(playerName, chosenWeapon) {
    this.socket = io();

    // Connection success
    this.socket.on('connect', () => {
      console.log('Connected to server with Socket ID:', this.socket.id);
      this.socket.emit('joinGame', { name: playerName, weapon: chosenWeapon });
    });

    // Initial game state from server
    this.socket.on('initGameState', (data) => {
      this.selfId = data.selfId;
      console.log('Joined game as:', this.selfId);

      // Initialize existing real players
      Object.values(data.players).forEach(p => {
        if (p.id !== this.selfId) {
          this.remotePlayers[p.id] = new RemotePlayer(this.game.scene, p);
        }
      });

      // Initialize Pickups
      if (data.pickups) {
        this.game.map.initPickups(data.pickups);
      }
    });

    // World snapshot tick update
    this.socket.on('worldUpdate', (data) => {
      const allServerPlayers = data.players;
      const count = data.onlineCount || Object.keys(allServerPlayers).length;

      // Update Top HUD Status Bar
      const statusElem = document.getElementById('match-status');
      if (statusElem) {
        if (count <= 1) {
          statusElem.innerText = `WAITING FOR OPPONENT (1 PLAYER ONLINE)`;
          statusElem.style.color = '#f59e0b';
        } else {
          statusElem.innerText = `LIVE MATCH (${count} PLAYERS ONLINE)`;
          statusElem.style.color = '#00f0ff';
        }
      }

      Object.values(allServerPlayers).forEach(p => {
        if (p.id === this.selfId) return;

        if (!this.remotePlayers[p.id]) {
          this.remotePlayers[p.id] = new RemotePlayer(this.game.scene, p);
        } else {
          this.remotePlayers[p.id].updateData(p);
        }
      });

      // Remove disconnected
      Object.keys(this.remotePlayers).forEach(id => {
        if (!allServerPlayers[id]) {
          this.remotePlayers[id].destroy();
          delete this.remotePlayers[id];
        }
      });

      // Update Leaderboard
      this.updateScoreboard(allServerPlayers);
    });

    // Player joined event
    this.socket.on('playerJoined', (p) => {
      if (p.id !== this.selfId && !this.remotePlayers[p.id]) {
        this.remotePlayers[p.id] = new RemotePlayer(this.game.scene, p);
      }
    });

    // Player disconnected event
    this.socket.on('playerDisconnected', (id) => {
      if (this.remotePlayers[id]) {
        this.remotePlayers[id].destroy();
        delete this.remotePlayers[id];
      }
    });

    // Weapon fired by opponent
    this.socket.on('weaponFired', (data) => {
      if (data.shooterId !== this.selfId) {
        window.soundEngine.playShoot(data.weapon);
        this.renderTracer(data.origin, data.direction);
      }
    });

    // Hit confirmation for self
    this.socket.on('hitConfirmed', (data) => {
      this.game.showHitmarker(data.isHeadshot);
    });

    // Self Hit event
    this.socket.on('playerHit', (data) => {
      if (data.targetId === this.selfId) {
        this.game.localPlayer.health = data.health;
        this.game.localPlayer.armor = data.armor;
        this.game.localPlayer.takeDamage(0); // Trigger flash & UI update
      }
    });

    // Kill Feed Event
    this.socket.on('killFeed', (data) => {
      this.game.addKillFeedItem(data);
      if (data.victimId === this.selfId) {
        this.game.triggerRespawnScreen(data.killerName);
      }
    });

    // Respawn event
    this.socket.on('playerRespawned', (data) => {
      if (data.id === this.selfId) {
        this.game.localPlayer.position.set(data.x, data.y, data.z);
        this.game.localPlayer.health = 100;
        this.game.localPlayer.armor = 50;
        this.game.localPlayer.isDead = false;
        this.game.localPlayer.updateHUD();
        document.getElementById('respawn-screen').classList.add('hidden');
      }
    });

    // Ammo Refill Event
    this.socket.on('ammoRefilled', () => {
      this.game.weaponManager.refillAmmo();
      window.soundEngine.playPickup();
    });

    // Pickup state events
    this.socket.on('pickupCollected', (data) => {
      this.game.map.setPickupVisibility(data.pickupId, false);
      if (data.collectorId === this.selfId) {
        window.soundEngine.playPickup();
      }
    });

    this.socket.on('pickupRespawned', (pickupId) => {
      this.game.map.setPickupVisibility(pickupId, true);
    });

    // Chat Message Event
    this.socket.on('chatMessage', (data) => {
      this.game.addChatMessage(data.sender, data.text);
    });
  }

  sendUpdate(playerState) {
    if (!this.socket || !this.selfId) return;

    const now = Date.now();
    if (now - this.lastSendTime > this.updateRate) {
      this.lastSendTime = now;
      this.socket.emit('playerUpdate', {
        x: playerState.position.x,
        y: playerState.position.y,
        z: playerState.position.z,
        rotationY: playerState.rotationY,
        pitch: playerState.pitch,
        isCrouching: playerState.isCrouching,
        isSprinting: playerState.isSprinting,
        weapon: this.game.weaponManager.currentWeaponKey
      });
    }
  }

  sendShoot(shotData) {
    if (this.socket) {
      this.socket.emit('shoot', shotData);
    }
  }

  sendPickupCollect(pickupId) {
    if (this.socket) {
      this.socket.emit('collectPickup', pickupId);
    }
  }

  sendChat(msg) {
    if (this.socket) {
      this.socket.emit('chatMessage', msg);
    }
  }

  renderTracer(origin, dir) {
    const tracerGeo = new THREE.BufferGeometry();
    const endPoint = new THREE.Vector3(
      origin.x + dir.x * 40,
      origin.y + dir.y * 40,
      origin.z + dir.z * 40
    );
    const positions = new Float32Array([origin.x, origin.y, origin.z, endPoint.x, endPoint.y, endPoint.z]);
    tracerGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const tracerMat = new THREE.LineBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.7 });
    const line = new THREE.Line(tracerGeo, tracerMat);

    this.game.scene.add(line);
    setTimeout(() => {
      this.game.scene.remove(line);
      tracerGeo.dispose();
      tracerMat.dispose();
    }, 50);
  }

  updateScoreboard(allPlayersList) {
    const tbody = document.getElementById('scoreboard-tbody');
    if (!tbody) return;

    const sorted = Object.values(allPlayersList).sort((a, b) => b.score - a.score);
    tbody.innerHTML = '';

    sorted.forEach((p, idx) => {
      const tr = document.createElement('tr');
      if (p.id === this.selfId) tr.classList.add('self-row');

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

  update(dt) {
    Object.values(this.remotePlayers).forEach(p => p.interpolate(dt));
  }
}
