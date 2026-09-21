// Weapon Systems & 3D Procedural Mesh Builder
class WeaponManager {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.currentWeaponKey = 'rifle';
    this.weaponMeshGroup = new THREE.Group();

    // Weapon Specs
    this.weapons = {
      rifle: {
        name: 'M4A1 RIFLE',
        clipSize: 30,
        reserveAmmo: 120,
        currentClip: 30,
        fireRate: 110, // ms
        recoilX: 0.03,
        recoilY: 0.04,
        recoilRecoverSpeed: 12,
        adsFov: 55,
        defaultFov: 75,
        adsOffset: { x: 0, y: -0.16, z: -0.32 },
        hipOffset: { x: 0.22, y: -0.22, z: -0.45 }
      },
      sniper: {
        name: 'AWM SNIPER',
        clipSize: 5,
        reserveAmmo: 25,
        currentClip: 5,
        fireRate: 900,
        recoilX: 0.08,
        recoilY: 0.15,
        recoilRecoverSpeed: 5,
        adsFov: 20,
        defaultFov: 75,
        adsOffset: { x: 0, y: -0.14, z: -0.2 },
        hipOffset: { x: 0.25, y: -0.24, z: -0.5 }
      },
      shotgun: {
        name: 'M4 SHOTGUN',
        clipSize: 8,
        reserveAmmo: 32,
        currentClip: 8,
        fireRate: 750,
        recoilX: 0.06,
        recoilY: 0.12,
        recoilRecoverSpeed: 8,
        adsFov: 60,
        defaultFov: 75,
        adsOffset: { x: 0, y: -0.18, z: -0.35 },
        hipOffset: { x: 0.24, y: -0.24, z: -0.45 }
      },
      pistol: {
        name: 'TACTICAL PISTOL',
        clipSize: 15,
        reserveAmmo: 60,
        currentClip: 15,
        fireRate: 200,
        recoilX: 0.02,
        recoilY: 0.03,
        recoilRecoverSpeed: 15,
        adsFov: 65,
        defaultFov: 75,
        adsOffset: { x: 0, y: -0.15, z: -0.3 },
        hipOffset: { x: 0.2, y: -0.2, z: -0.4 }
      }
    };

    this.isReloading = false;
    this.isADS = false;
    this.lastShootTime = 0;
    this.recoilOffset = { x: 0, y: 0, z: 0, rotX: 0, rotY: 0 };
    this.targetPos = new THREE.Vector3();

    // Attach group to camera
    this.camera.add(this.weaponMeshGroup);
    this.scene.add(this.camera);

    this.buildWeaponMeshes();
    this.switchWeapon('rifle');
  }

  // Build Procedural 3D Weapon Models with Three.js
  buildWeaponMeshes() {
    this.weaponModels = {};

    const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.3, metalness: 0.8 });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6, metalness: 0.3 });
    const silverMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.2, metalness: 0.9 });
    const redDotMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });

    // 1. M4A1 RIFLE MESH
    const rifleGroup = new THREE.Group();
    // Receiver
    const rBody = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.35), darkMetalMat);
    rifleGroup.add(rBody);
    // Barrel
    const rBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.35, 12), silverMat);
    rBarrel.rotation.x = Math.PI / 2;
    rBarrel.position.set(0, 0.01, -0.3);
    rifleGroup.add(rBarrel);
    // Handguard
    const rGuard = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.25), blackMat);
    rGuard.position.set(0, 0.01, -0.2);
    rifleGroup.add(rGuard);
    // Stock
    const rStock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.2), blackMat);
    rStock.position.set(0, -0.01, 0.22);
    rifleGroup.add(rStock);
    // Magazine
    const rMag = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.06), darkMetalMat);
    rMag.position.set(0, -0.1, -0.05);
    rMag.rotation.x = -0.2;
    rifleGroup.add(rMag);
    // Red Dot Sight
    const rSight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.08), blackMat);
    rSight.position.set(0, 0.06, -0.05);
    const rDot = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 8), redDotMat);
    rDot.position.set(0, 0.06, -0.05);
    rifleGroup.add(rSight);
    rifleGroup.add(rDot);

    this.weaponModels.rifle = rifleGroup;

    // 2. AWM SNIPER MESH
    const sniperGroup = new THREE.Group();
    const sBody = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.55), darkMetalMat);
    sniperGroup.add(sBody);
    const sBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 12), silverMat);
    sBarrel.rotation.x = Math.PI / 2;
    sBarrel.position.set(0, 0.015, -0.45);
    sniperGroup.add(sBarrel);
    // Scope cylinder
    const sScope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 16), blackMat);
    sScope.rotation.x = Math.PI / 2;
    sScope.position.set(0, 0.08, -0.05);
    sniperGroup.add(sScope);
    const sStock = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.1, 0.28), blackMat);
    sStock.position.set(0, -0.01, 0.32);
    sniperGroup.add(sStock);

    this.weaponModels.sniper = sniperGroup;

    // 3. M4 SHOTGUN MESH
    const sgGroup = new THREE.Group();
    const sgBody = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.4), darkMetalMat);
    sgGroup.add(sgBody);
    const sgBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.38, 12), darkMetalMat);
    sgBarrel.rotation.x = Math.PI / 2;
    sgBarrel.position.set(0, 0.02, -0.32);
    sgGroup.add(sgBarrel);
    const sgPump = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.18, 12), blackMat);
    sgPump.rotation.x = Math.PI / 2;
    sgPump.position.set(0, -0.01, -0.28);
    sgGroup.add(sgPump);

    this.weaponModels.shotgun = sgGroup;

    // 4. PISTOL MESH
    const pistolGroup = new THREE.Group();
    const pSlide = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.18), silverMat);
    pSlide.position.set(0, 0.03, -0.04);
    pistolGroup.add(pSlide);
    const pFrame = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.1, 0.06), blackMat);
    pFrame.position.set(0, -0.03, 0.02);
    pFrame.rotation.x = 0.2;
    pistolGroup.add(pFrame);

    this.weaponModels.pistol = pistolGroup;

    // Add Muzzle Flash Light
    this.muzzleLight = new THREE.PointLight(0xffaa22, 0, 10);
    this.weaponMeshGroup.add(this.muzzleLight);
  }

  switchWeapon(key) {
    if (!this.weapons[key] || this.isReloading) return;
    this.currentWeaponKey = key;
    const w = this.weapons[key];

    // Remove existing meshes from group
    while (this.weaponMeshGroup.children.length > 0) {
      this.weaponMeshGroup.remove(this.weaponMeshGroup.children[0]);
    }

    // Add selected model mesh
    const model = this.weaponModels[key];
    if (model) this.weaponMeshGroup.add(model);
    this.weaponMeshGroup.add(this.muzzleLight);

    // Update UI HUD
    document.getElementById('hud-weapon-name').innerText = w.name;
    document.getElementById('ammo-clip').innerText = w.currentClip;
    document.getElementById('ammo-reserve').innerText = w.reserveAmmo;
  }

  setADS(state) {
    if (this.isReloading) return;
    this.isADS = state;
    const scopeElem = document.getElementById('sniper-scope');
    const crosshair = document.getElementById('crosshair');

    if (this.currentWeaponKey === 'sniper') {
      if (this.isADS) {
        scopeElem.classList.add('active');
        crosshair.style.display = 'none';
        this.camera.fov = this.weapons.sniper.adsFov;
      } else {
        scopeElem.classList.remove('active');
        crosshair.style.display = 'block';
        this.camera.fov = this.weapons.sniper.defaultFov;
      }
      this.camera.updateProjectionMatrix();
    }
  }

  shoot(onShotCallback) {
    const now = Date.now();
    const w = this.weapons[this.currentWeaponKey];

    if (this.isReloading) return false;
    if (w.currentClip <= 0) {
      this.reload();
      return false;
    }
    if (now - this.lastShootTime < w.fireRate) return false;

    this.lastShootTime = now;
    w.currentClip -= 1;
    document.getElementById('ammo-clip').innerText = w.currentClip;

    // Trigger sound
    window.soundEngine.playShoot(this.currentWeaponKey);

    // Apply Recoil Kick
    this.recoilOffset.z += 0.08;
    this.recoilOffset.rotX += w.recoilY;
    this.recoilOffset.rotY += (Math.random() - 0.5) * w.recoilX;

    // Trigger Muzzle Light Flash
    this.muzzleLight.intensity = 5;
    setTimeout(() => { this.muzzleLight.intensity = 0; }, 40);

    // Bullet Tracers / Particle effect
    this.createBulletTracer();

    if (onShotCallback) onShotCallback(this.currentWeaponKey);

    return true;
  }

  reload() {
    const w = this.weapons[this.currentWeaponKey];
    if (this.isReloading || w.currentClip === w.clipSize || w.reserveAmmo <= 0) return;

    this.isReloading = true;
    if (this.isADS) this.setADS(false);

    const reloadIndicator = document.getElementById('reload-indicator');
    reloadIndicator.classList.remove('hidden');

    window.soundEngine.playReload();

    // Reload animation dip
    this.recoilOffset.rotX = -0.4;

    setTimeout(() => {
      const needed = w.clipSize - w.currentClip;
      const added = Math.min(needed, w.reserveAmmo);
      w.currentClip += added;
      w.reserveAmmo -= added;

      document.getElementById('ammo-clip').innerText = w.currentClip;
      document.getElementById('ammo-reserve').innerText = w.reserveAmmo;

      this.isReloading = false;
      reloadIndicator.classList.add('hidden');
    }, 1200);
  }

  refillAmmo() {
    Object.values(this.weapons).forEach(w => {
      w.reserveAmmo += w.clipSize * 3;
    });
    const w = this.weapons[this.currentWeaponKey];
    document.getElementById('ammo-reserve').innerText = w.reserveAmmo;
  }

  createBulletTracer() {
    const tracerGeo = new THREE.BufferGeometry();
    const origin = new THREE.Vector3();
    this.camera.getWorldPosition(origin);
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);

    const endPoint = origin.clone().add(dir.clone().multiplyScalar(40));

    const positions = new Float32Array([
      origin.x + dir.x * 0.5, origin.y - 0.1 + dir.y * 0.5, origin.z + dir.z * 0.5,
      endPoint.x, endPoint.y, endPoint.z
    ]);
    tracerGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const tracerMat = new THREE.LineBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.8 });
    const tracerLine = new THREE.Line(tracerGeo, tracerMat);

    this.scene.add(tracerLine);

    setTimeout(() => {
      this.scene.remove(tracerLine);
      tracerGeo.dispose();
      tracerMat.dispose();
    }, 50);
  }

  update(dt) {
    const w = this.weapons[this.currentWeaponKey];

    // Smooth ADS interpolation
    const offset = this.isADS ? w.adsOffset : w.hipOffset;
    this.weaponMeshGroup.position.x += (offset.x - this.weaponMeshGroup.position.x) * dt * 15;
    this.weaponMeshGroup.position.y += (offset.y - this.weaponMeshGroup.position.y) * dt * 15;
    this.weaponMeshGroup.position.z += (offset.z - this.recoilOffset.z - this.weaponMeshGroup.position.z) * dt * 15;

    // Recoil recovery
    this.recoilOffset.z *= 0.8;
    this.recoilOffset.rotX *= 0.8;
    this.recoilOffset.rotY *= 0.8;

    this.weaponMeshGroup.rotation.x = this.recoilOffset.rotX;
    this.weaponMeshGroup.rotation.y = this.recoilOffset.rotY;
  }
}
