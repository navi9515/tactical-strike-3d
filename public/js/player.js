// High Performance Local Player & Remote Player Controller
class LocalPlayer {
  constructor(camera, domElement, colliders) {
    this.camera = camera;
    this.domElement = domElement;
    this.colliders = colliders;

    this.position = new THREE.Vector3(0, 1.6, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.rotationY = 0;
    this.pitch = 0;

    this.health = 100;
    this.armor = 50;
    this.isDead = false;

    this.keys = { W: false, A: false, S: false, D: false, Shift: false, Crouch: false, Space: false };
    this.isCrouching = false;
    this.isSprinting = false;
    this.isGrounded = true;

    this.footstepTimer = 0;

    this.initInput();
  }

  initInput() {
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.domElement || this.isDead) return;
      const sensitivity = 0.0022;
      this.rotationY -= e.movementX * sensitivity;
      this.pitch -= e.movementY * sensitivity;
      this.pitch = Math.max(-Math.PI / 2.05, Math.min(Math.PI / 2.05, this.pitch));
    });

    window.addEventListener('keydown', (e) => this.setKeyState(e.code, true));
    window.addEventListener('keyup', (e) => this.setKeyState(e.code, false));
  }

  setKeyState(code, state) {
    if (code === 'KeyW') this.keys.W = state;
    if (code === 'KeyS') this.keys.S = state;
    if (code === 'KeyA') this.keys.A = state;
    if (code === 'KeyD') this.keys.D = state;
    if (code === 'ShiftLeft') this.keys.Shift = state;
    if (code === 'KeyC') this.keys.Crouch = state;
    if (code === 'Space' && state && this.isGrounded && !this.isDead) {
      this.velocity.y = 9.0;
      this.isGrounded = false;
    }
  }

  update(dt) {
    if (this.isDead) return;

    this.isCrouching = this.keys.Crouch;
    this.isSprinting = this.keys.Shift && !this.isCrouching && this.keys.W;

    const eyeHeight = this.isCrouching ? 1.0 : 1.6;

    // Movement Direction
    let speed = this.isSprinting ? 10.0 : (this.isCrouching ? 3.5 : 6.0);
    const inputDir = new THREE.Vector3();
    if (this.keys.W) inputDir.z -= 1;
    if (this.keys.S) inputDir.z += 1;
    if (this.keys.A) inputDir.x -= 1;
    if (this.keys.D) inputDir.x += 1;
    inputDir.normalize();

    // Rotate input vector by camera Yaw
    const sin = Math.sin(this.rotationY);
    const cos = Math.cos(this.rotationY);
    const worldX = inputDir.x * cos + inputDir.z * sin;
    const worldZ = -inputDir.x * sin + inputDir.z * cos;

    // Smooth Velocity Interpolation (Butter Smooth Control)
    this.velocity.x += (worldX * speed - this.velocity.x) * dt * 15;
    this.velocity.z += (worldZ * speed - this.velocity.z) * dt * 15;

    // Gravity
    this.velocity.y -= 25.0 * dt;

    // Next proposed position
    let nextX = this.position.x + this.velocity.x * dt;
    let nextY = this.position.y + this.velocity.y * dt;
    let nextZ = this.position.z + this.velocity.z * dt;

    // Map Boundaries & Ground Check
    const BOUND = 55;
    nextX = Math.max(-BOUND, Math.min(BOUND, nextX));
    nextZ = Math.max(-BOUND, Math.min(BOUND, nextZ));

    if (nextY <= 0) {
      nextY = 0;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    // AABB Collision Detection against obstacles
    const playerRadius = 0.45;
    const playerBox = new THREE.Box3(
      new THREE.Vector3(nextX - playerRadius, nextY, nextZ - playerRadius),
      new THREE.Vector3(nextX + playerRadius, nextY + eyeHeight, nextZ + playerRadius)
    );

    for (let collider of this.colliders) {
      if (collider.intersectsBox(playerBox)) {
        // Wall Slide Response
        nextX = this.position.x;
        nextZ = this.position.z;
        break;
      }
    }

    this.position.set(nextX, nextY, nextZ);

    // Apply Camera Position & Rotation
    this.camera.position.set(this.position.x, this.position.y + eyeHeight, this.position.z);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.y = this.rotationY;
    this.camera.rotation.x = this.pitch;

    // Footsteps
    if (this.isGrounded && inputDir.lengthSq() > 0) {
      this.footstepTimer += dt * (this.isSprinting ? 2.8 : 1.8);
      if (this.footstepTimer >= 1.0) {
        this.footstepTimer = 0;
        window.soundEngine.playFootstep();
      }
    }
  }

  takeDamage(amount) {
    if (this.isDead) return;
    this.updateHUD();

    const flash = document.getElementById('damage-flash');
    if (flash) {
      flash.classList.add('active');
      setTimeout(() => flash.classList.remove('active'), 120);
    }
  }

  updateHUD() {
    const hpFill = document.getElementById('health-fill');
    const hpVal = document.getElementById('health-val');
    const armFill = document.getElementById('armor-fill');
    const armVal = document.getElementById('armor-val');

    if (hpFill) hpFill.style.width = `${this.health}%`;
    if (hpVal) hpVal.innerText = Math.round(this.health);
    if (armFill) armFill.style.width = `${this.armor}%`;
    if (armVal) armVal.innerText = Math.round(this.armor);
  }
}

// Remote Player Renderer with Smooth Snapshot Interpolation
class RemotePlayer {
  constructor(scene, data) {
    this.scene = scene;
    this.id = data.id;
    this.name = data.name;

    this.targetPos = new THREE.Vector3(data.x, data.y, data.z);
    this.targetRotY = data.rotationY || 0;

    this.meshGroup = new THREE.Group();
    this.meshGroup.position.copy(this.targetPos);
    this.buildCharacterMesh();
    this.scene.add(this.meshGroup);
  }

  buildCharacterMesh() {
    const vestMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, roughness: 0.3, metalness: 0.8 });
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfbcfe8 });

    // Body
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, 0.35), vestMat);
    torso.position.y = 0.95;
    this.meshGroup.add(torso);

    // Head & Helmet
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), skinMat);
    head.position.y = 1.5;
    this.meshGroup.add(head);

    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), helmetMat);
    helmet.position.y = 1.52;
    this.meshGroup.add(helmet);

    // Legs
    const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.22), bodyMat);
    lLeg.position.set(-0.16, 0.33, 0);
    const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.22), bodyMat);
    rLeg.position.set(0.16, 0.33, 0);
    this.meshGroup.add(lLeg);
    this.meshGroup.add(rLeg);

    // Name Tag Canvas Sprite
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(8, 14, 26, 0.85)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.font = 'bold 26px Rajdhani';
    ctx.fillStyle = '#00f0ff';
    ctx.textAlign = 'center';
    ctx.fillText(this.name, 128, 42);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(0, 2.0, 0);
    sprite.scale.set(1.5, 0.4, 1);
    this.meshGroup.add(sprite);
  }

  updateData(data) {
    this.targetPos.set(data.x, data.y, data.z);
    this.targetRotY = data.rotationY || 0;
  }

  interpolate(dt) {
    // Ultra smooth lerp for 60fps movement
    this.meshGroup.position.lerp(this.targetPos, dt * 18);
    this.meshGroup.rotation.y = this.targetRotY;
  }

  destroy() {
    this.scene.remove(this.meshGroup);
  }
}
