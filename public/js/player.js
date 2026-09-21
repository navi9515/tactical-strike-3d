// Local Player FPS Controller & Remote Player Renderer
class LocalPlayer {
  constructor(camera, domElement, mapColliders) {
    this.camera = camera;
    this.domElement = domElement;
    this.colliders = mapColliders;

    // Player State
    this.position = new THREE.Vector3(0, 1.6, 0);
    this.velocity = new THREE.Vector3();
    this.rotationY = 0;
    this.pitch = 0;

    this.health = 100;
    this.armor = 50;
    this.isDead = false;

    // Movement flags
    this.keys = { forward: false, backward: false, left: false, right: false, sprint: false, crouch: false, jump: false };
    this.isCrouching = false;
    this.isSprinting = false;

    // Physics constants
    this.normalHeight = 1.6;
    this.crouchHeight = 1.0;
    this.currentHeight = 1.6;
    this.walkSpeed = 6.0;
    this.sprintSpeed = 10.5;
    this.crouchSpeed = 3.5;
    this.gravity = 25.0;
    this.jumpForce = 8.5;
    this.isGrounded = false;

    // Footstep timer
    this.footstepTimer = 0;

    this.initControls();
  }

  initControls() {
    // Pointer Lock setup
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.domElement || this.isDead) return;

      const sensitivity = 0.0022;
      this.rotationY -= e.movementX * sensitivity;
      this.pitch -= e.movementY * sensitivity;

      // Clamp pitch (-89deg to +89deg)
      this.pitch = Math.max(-Math.PI / 2.05, Math.min(Math.PI / 2.05, this.pitch));
    });

    // Keyboard Listeners
    window.addEventListener('keydown', (e) => this.handleKey(e.code, true));
    window.addEventListener('keyup', (e) => this.handleKey(e.code, false));
  }

  handleKey(code, isPressed) {
    switch (code) {
      case 'KeyW': this.keys.forward = isPressed; break;
      case 'KeyS': this.keys.backward = isPressed; break;
      case 'KeyA': this.keys.left = isPressed; break;
      case 'KeyD': this.keys.right = isPressed; break;
      case 'ShiftLeft': this.keys.sprint = isPressed; break;
      case 'KeyC': this.keys.crouch = isPressed; break;
      case 'Space':
        if (isPressed && this.isGrounded && !this.isDead) {
          this.velocity.y = this.jumpForce;
          this.isGrounded = false;
        }
        break;
    }
  }

  update(dt) {
    if (this.isDead) return;

    // Crouch & Height adjustment
    this.isCrouching = this.keys.crouch;
    this.isSprinting = this.keys.sprint && !this.isCrouching && this.keys.forward;

    const targetHeight = this.isCrouching ? this.crouchHeight : this.normalHeight;
    this.currentHeight += (targetHeight - this.currentHeight) * dt * 10;

    // Calculate movement speed
    let speed = this.walkSpeed;
    if (this.isSprinting) speed = this.sprintSpeed;
    if (this.isCrouching) speed = this.crouchSpeed;

    // Calculate direction vector from input
    const moveDir = new THREE.Vector3();
    if (this.keys.forward) moveDir.z -= 1;
    if (this.keys.backward) moveDir.z += 1;
    if (this.keys.left) moveDir.x -= 1;
    if (this.keys.right) moveDir.x += 1;
    moveDir.normalize();

    // Rotate direction by camera yaw
    const sin = Math.sin(this.rotationY);
    const cos = Math.cos(this.rotationY);
    const worldDX = moveDir.x * cos + moveDir.z * sin;
    const worldDZ = -moveDir.x * sin + moveDir.z * cos;

    // Horizontal movement damping & velocity
    this.velocity.x = worldDX * speed;
    this.velocity.z = worldDZ * speed;

    // Apply Gravity
    this.velocity.y -= this.gravity * dt;

    // Proposed next position
    const nextX = this.position.x + this.velocity.x * dt;
    const nextY = this.position.y + this.velocity.y * dt;
    const nextZ = this.position.z + this.velocity.z * dt;

    // Collision Detection & Floor Check
    this.checkCollisions(nextX, nextY, nextZ);

    // Apply Camera Position & Rotation
    this.camera.position.set(this.position.x, this.position.y + this.currentHeight, this.position.z);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.y = this.rotationY;
    this.camera.rotation.x = this.pitch;

    // Footsteps sound trigger
    if (this.isGrounded && moveDir.lengthSq() > 0) {
      this.footstepTimer += dt * (this.isSprinting ? 2.5 : 1.5);
      if (this.footstepTimer > 1.0) {
        this.footstepTimer = 0;
        window.soundEngine.playFootstep();
      }
    }
  }

  checkCollisions(nextX, nextY, nextZ) {
    // Ground Check
    const minHeight = 0; // ground plane
    if (nextY <= minHeight) {
      this.position.y = minHeight;
      this.velocity.y = 0;
      this.isGrounded = true;
    } else {
      this.position.y = nextY;
    }

    // Player bounding cylinder/box test against map colliders
    const playerRadius = 0.5;
    const playerBox = new THREE.Box3(
      new THREE.Vector3(nextX - playerRadius, this.position.y, nextZ - playerRadius),
      new THREE.Vector3(nextX + playerRadius, this.position.y + this.currentHeight, nextZ + playerRadius)
    );

    let collideX = false;
    let collideZ = false;

    for (let box of this.colliders) {
      if (box.intersectsBox(playerBox)) {
        // Simple slide response
        collideX = true;
        collideZ = true;
        break;
      }
    }

    if (!collideX) this.position.x = nextX;
    if (!collideZ) this.position.z = nextZ;
  }

  takeDamage(amount) {
    if (this.isDead) return;

    if (this.armor > 0) {
      const absorb = Math.min(this.armor, amount * 0.5);
      this.armor -= absorb;
      amount -= absorb;
    }
    this.health = Math.max(0, this.health - amount);

    // Trigger red flash UI
    const flash = document.getElementById('damage-flash');
    flash.classList.add('active');
    setTimeout(() => flash.classList.remove('active'), 150);

    // Update HUD bars
    this.updateHUD();

    if (this.health <= 0) {
      this.isDead = true;
    }
  }

  updateHUD() {
    document.getElementById('health-fill').style.width = `${this.health}%`;
    document.getElementById('health-val').innerText = Math.round(this.health);
    document.getElementById('armor-fill').style.width = `${this.armor}%`;
    document.getElementById('armor-val').innerText = Math.round(this.armor);
  }
}

// Remote Player / Bot Renderer Class
class RemotePlayer {
  constructor(scene, playerData) {
    this.scene = scene;
    this.id = playerData.id;
    this.name = playerData.name;
    this.isBot = playerData.isBot;

    // Target positions for interpolation
    this.targetPos = new THREE.Vector3(playerData.x, playerData.y, playerData.z);
    this.targetRotY = playerData.rotationY || 0;
    this.targetPitch = playerData.pitch || 0;

    this.meshGroup = new THREE.Group();
    this.buildCharacterMesh();
    this.scene.add(this.meshGroup);
  }

  buildCharacterMesh() {
    const armorColor = this.isBot ? 0xd97706 : 0x00f0ff;
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
    const vestMat = new THREE.MeshStandardMaterial({ color: armorColor, roughness: 0.3, metalness: 0.7 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.8 });
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 });

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, 0.35), vestMat);
    torso.position.y = 1.0;
    torso.castShadow = true;
    this.meshGroup.add(torso);

    // Head + Helmet
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), skinMat);
    head.position.y = 1.52;
    head.castShadow = true;
    this.meshGroup.add(head);

    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.6), helmetMat);
    helmet.position.y = 1.54;
    this.meshGroup.add(helmet);

    // Arms
    const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.18), bodyMat);
    lArm.position.set(-0.4, 1.0, 0);
    lArm.castShadow = true;
    this.meshGroup.add(lArm);

    const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.18), bodyMat);
    rArm.position.set(0.4, 1.0, 0);
    rArm.castShadow = true;
    this.meshGroup.add(rArm);

    // Legs
    const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), bodyMat);
    lLeg.position.set(-0.16, 0.35, 0);
    lLeg.castShadow = true;
    this.meshGroup.add(lLeg);

    const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), bodyMat);
    rLeg.position.set(0.16, 0.35, 0);
    rLeg.castShadow = true;
    this.meshGroup.add(rLeg);

    // Name Tag Canvas Sprite
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(8, 14, 26, 0.85)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.font = 'bold 26px Rajdhani';
    ctx.fillStyle = this.isBot ? '#f59e0b' : '#00f0ff';
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
    this.targetPitch = data.pitch || 0;
  }

  interpolate(dt) {
    // Smooth interpolation (LERP)
    this.meshGroup.position.lerp(this.targetPos, dt * 15);
    this.meshGroup.rotation.y = this.targetRotY;
  }

  destroy() {
    this.scene.remove(this.meshGroup);
  }
}
