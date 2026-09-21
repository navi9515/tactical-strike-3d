// Realistic 3D Map & Tactical Arena Builder
class TacticalMap {
  constructor(scene) {
    this.scene = scene;
    this.colliders = []; // Bounding boxes for player physics
    this.pickupsMap = {}; // 3D Mesh references for pickups

    this.initLightingAndAtmosphere();
    this.buildGroundAndWalls();
    this.buildWarehouseStructure();
    this.buildShippingContainers();
    this.buildSniperTower();
    this.buildBarricadesAndCrates();
  }

  initLightingAndAtmosphere() {
    // Fog for depth
    this.scene.fog = new THREE.FogExp2(0x0c121e, 0.015);
    this.scene.background = new THREE.Color(0x0c121e);

    // Hemisphere Light (Sky & Ground tint)
    const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x111827, 0.6);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    // Directional Sun Light with Shadows
    const sun = new THREE.DirectionalLight(0xfff5ea, 1.2);
    sun.position.set(40, 80, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 200;
    const d = 70;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);
  }

  buildGroundAndWalls() {
    // Ground Mesh
    const groundGeo = new THREE.PlaneGeometry(140, 140, 32, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.8,
      metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Grid Floor Overlay
    const grid = new THREE.GridHelper(140, 70, 0x00f0ff, 0x334155);
    grid.position.y = 0.02;
    this.scene.add(grid);

    // Perimeter Boundary Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    const wallHeight = 12;
    const wallThickness = 2;
    const mapSize = 130;

    const wallGeos = [
      { pos: [0, wallHeight/2, -mapSize/2], size: [mapSize, wallHeight, wallThickness] },
      { pos: [0, wallHeight/2, mapSize/2], size: [mapSize, wallHeight, wallThickness] },
      { pos: [-mapSize/2, wallHeight/2, 0], size: [wallThickness, wallHeight, mapSize] },
      { pos: [mapSize/2, wallHeight/2, 0], size: [wallThickness, wallHeight, mapSize] }
    ];

    wallGeos.forEach(w => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...w.size), wallMat);
      mesh.position.set(...w.pos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      const box = new THREE.Box3().setFromObject(mesh);
      this.colliders.push(box);
    });
  }

  buildWarehouseStructure() {
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5, metalness: 0.6 });
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });

    // Central Warehouse Walls
    const warehouseParts = [
      // Back Wall
      { pos: [0, 4, -25], size: [40, 8, 1] },
      // Side Left Wall
      { pos: [-20, 4, -10], size: [1, 8, 30] },
      // Side Right Wall
      { pos: [20, 4, -10], size: [1, 8, 30] },
      // Second Floor Balcony Platform
      { pos: [0, 5, -20], size: [38, 0.5, 10] }
    ];

    warehouseParts.forEach(p => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...p.size), metalMat);
      mesh.position.set(...p.pos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.colliders.push(new THREE.Box3().setFromObject(mesh));
    });

    // Warehouse Interior Red Lighting
    const indLight = new THREE.PointLight(0xff3300, 2, 25);
    indLight.position.set(0, 7, -15);
    this.scene.add(indLight);
  }

  buildShippingContainers() {
    const containerColors = [0x991b1b, 0x1e3a8a, 0x065f46, 0xd97706];

    const containers = [
      { pos: [-30, 2, -35], size: [5, 4, 12], rot: 0, colorIdx: 0 },
      { pos: [-30, 6, -35], size: [5, 4, 12], rot: 0.1, colorIdx: 1 },
      { pos: [30, 2, -35], size: [5, 4, 12], rot: 0, colorIdx: 2 },
      { pos: [-35, 2, 20], size: [12, 4, 5], rot: 0, colorIdx: 3 },
      { pos: [35, 2, 20], size: [12, 4, 5], rot: 0, colorIdx: 0 },
      { pos: [20, 2, 35], size: [5, 4, 12], rot: 0.4, colorIdx: 1 },
      { pos: [-20, 2, 35], size: [5, 4, 12], rot: -0.3, colorIdx: 2 }
    ];

    containers.forEach(c => {
      const mat = new THREE.MeshStandardMaterial({
        color: containerColors[c.colorIdx],
        roughness: 0.4,
        metalness: 0.5
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...c.size), mat);
      mesh.position.set(...c.pos);
      mesh.rotation.y = c.rot;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.colliders.push(new THREE.Box3().setFromObject(mesh));
    });
  }

  buildSniperTower() {
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.8 });

    // 4 Support Pillars
    const pillarPositions = [[-2.5, 5, -2.5], [2.5, 5, -2.5], [-2.5, 5, 2.5], [2.5, 5, 2.5]];
    pillarPositions.forEach(p => {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 10, 8), towerMat);
      pillar.position.set(...p);
      pillar.castShadow = true;
      this.scene.add(pillar);
    });

    // Tower Platform Top
    const platform = new THREE.Mesh(new THREE.BoxGeometry(7, 0.4, 7), towerMat);
    platform.position.set(0, 10, 0);
    platform.castShadow = true;
    platform.receiveShadow = true;
    this.scene.add(platform);
    this.colliders.push(new THREE.Box3().setFromObject(platform));

    // Guard Rails
    const railMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b });
    const rails = [
      { pos: [0, 10.6, -3.4], size: [6.8, 0.8, 0.1] },
      { pos: [0, 10.6, 3.4], size: [6.8, 0.8, 0.1] },
      { pos: [-3.4, 10.6, 0], size: [0.1, 0.8, 6.8] },
      { pos: [3.4, 10.6, 0], size: [0.1, 0.8, 6.8] }
    ];
    rails.forEach(r => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(...r.size), railMat);
      rail.position.set(...r.pos);
      this.scene.add(rail);
      this.colliders.push(new THREE.Box3().setFromObject(rail));
    });

    // Tower Beacon Light
    const beacon = new THREE.PointLight(0x00f0ff, 3, 20);
    beacon.position.set(0, 12, 0);
    this.scene.add(beacon);
  }

  buildBarricadesAndCrates() {
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.7 });

    const props = [
      { type: 'crate', pos: [-8, 1, -10], size: [2, 2, 2] },
      { type: 'crate', pos: [-6, 1, -10], size: [2, 2, 2] },
      { type: 'crate', pos: [-7, 3, -10], size: [2, 2, 2] },
      { type: 'crate', pos: [8, 1, 10], size: [2, 2, 2] },
      { type: 'crate', pos: [10, 1, 12], size: [2.5, 2.5, 2.5] },
      { type: 'barrier', pos: [0, 1, -38], size: [6, 2, 1] },
      { type: 'barrier', pos: [0, 1, 38], size: [6, 2, 1] },
      { type: 'barrier', pos: [-38, 1, 0], size: [1, 2, 6] },
      { type: 'barrier', pos: [38, 1, 0], size: [1, 2, 6] }
    ];

    props.forEach(p => {
      const mat = p.type === 'crate' ? crateMat : barrierMat;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...p.size), mat);
      mesh.position.set(...p.pos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.colliders.push(new THREE.Box3().setFromObject(mesh));
    });
  }

  // Create Pickup Meshes (Health, Armor, Ammo)
  initPickups(pickupsList) {
    pickupsList.forEach(p => {
      const group = new THREE.Group();
      let mesh, color, lightColor;

      if (p.type === 'health') {
        color = 0xff0055;
        lightColor = 0xff0055;
        // Cross mesh
        const v = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.2), new THREE.MeshBasicMaterial({ color }));
        const h = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.2), new THREE.MeshBasicMaterial({ color }));
        group.add(v);
        group.add(h);
      } else if (p.type === 'armor') {
        color = 0x00f0ff;
        lightColor = 0x00f0ff;
        // Shield Octahedron mesh
        mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), new THREE.MeshStandardMaterial({ color, roughness: 0.2, metalness: 0.9 }));
        group.add(mesh);
      } else {
        color = 0xf59e0b;
        lightColor = 0xf59e0b;
        // Ammo box mesh
        mesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.4), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
        group.add(mesh);
      }

      const light = new THREE.PointLight(lightColor, 2, 6);
      group.add(light);

      group.position.set(p.x, p.y, p.z);
      this.scene.add(group);
      this.pickupsMap[p.id] = group;
    });
  }

  updatePickups(dt) {
    Object.values(this.pickupsMap).forEach(g => {
      if (g.visible) {
        g.rotation.y += dt * 2;
        g.position.y += Math.sin(Date.now() * 0.004) * 0.002;
      }
    });
  }

  setPickupVisibility(pickupId, visible) {
    if (this.pickupsMap[pickupId]) {
      this.pickupsMap[pickupId].visible = visible;
    }
  }
}
