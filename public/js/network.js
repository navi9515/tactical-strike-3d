// Socket.io Network Manager for Super Slither Arena
class NetworkManager {
  constructor(engine) {
    this.engine = engine;
    this.socket = null;
    this.selfId = null;
    this.lastSendTime = 0;
  }

  connect(playerName, color) {
    this.socket = io();

    this.socket.on('connect', () => {
      this.socket.emit('joinGame', { name: playerName, color: color });
    });

    this.socket.on('initGameState', (data) => {
      this.selfId = data.selfId;
      this.engine.initWorld(data.worldSize, data.food);
    });

    this.socket.on('worldUpdate', (data) => {
      this.engine.updateWorldState(data.players, data.food, data.onlineCount);
    });

    this.socket.on('foodEaten', (data) => {
      if (data.playerId === this.selfId) {
        window.soundEngine.playEat();
      }
    });

    this.socket.on('killFeed', (data) => {
      this.engine.addKillFeedItem(data);
    });

    this.socket.on('chatMessage', (data) => {
      this.engine.addChatMessage(data.sender, data.text);
    });
  }

  sendUpdate(p) {
    if (!this.socket || !this.selfId) return;

    const now = Date.now();
    if (now - this.lastSendTime > 16) { // 60 FPS update rate
      this.lastSendTime = now;
      this.socket.emit('playerUpdate', {
        x: p.x,
        y: p.y,
        angle: p.angle,
        isBoosting: p.isBoosting,
        body: p.body,
        score: p.score
      });
    }
  }

  sendEatFood(foodId) {
    if (this.socket) {
      this.socket.emit('eatFood', foodId);
    }
  }

  sendDie(killerName) {
    if (this.socket) {
      window.soundEngine.playExplode();
      this.socket.emit('playerDied', { killerName });
    }
  }

  sendChat(msg) {
    if (this.socket) {
      this.socket.emit('chatMessage', msg);
    }
  }
}
