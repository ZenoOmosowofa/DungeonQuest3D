(function () {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x090b11);
  scene.fog = new THREE.FogExp2(0x0a0d14, 0.02);

  const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 2000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  const ui = {
    stats: document.getElementById("statsLabel"),
    resources: document.getElementById("resourcesLabel"),
    quest: document.getElementById("questLabel"),
    location: document.getElementById("locationLabel"),
    log: document.getElementById("log"),
    mapTitle: document.getElementById("mapTitle"),
    mapCanvas: document.getElementById("mapCanvas"),
    storeStatus: document.getElementById("storeStatus"),
    overlay: document.getElementById("overlay"),
    pauseMenu: document.getElementById("pauseMenu"),
    storeModal: document.getElementById("storeModal"),
    rewardModal: document.getElementById("rewardModal"),
    rewardChoices: document.getElementById("rewardChoices"),
    resumeButton: document.getElementById("resumeButton"),
    quitButton: document.getElementById("quitButton"),
    closeStoreButton: document.getElementById("closeStoreButton"),
    transitionFx: document.getElementById("transitionFx"),
    controlsPanel: document.getElementById("controlsPanel"),
    healthBarPanel: document.getElementById("healthBarPanel"),
    healthBar: document.getElementById("healthBar"),
    healthText: document.getElementById("healthText"),
    healthBarPanelTown: document.getElementById("healthBarPanelTown"),
    healthBarTown: document.getElementById("healthBarTown"),
    healthTextTown: document.getElementById("healthTextTown")
  };
  const mapContext = ui.mapCanvas.getContext("2d");

  const storeButtons = Array.from(document.querySelectorAll("[data-buy]"));
  const clock = new THREE.Clock();
  const keys = {};
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  const classes = {
    tank: { maxHp: 220, damage: 15, speed: 5.8, name: "Tank" },
    hunter: { maxHp: 170, damage: 20, speed: 6.8, name: "Hunter" },
    assassin: { maxHp: 140, damage: 24, speed: 7.2, name: "Assassin" },
    rogue: { maxHp: 200, damage: 18, speed: 7.0, name: "Rogue" }
  };

  const shared = {
    floor: new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.95 }),
    wall: new THREE.MeshStandardMaterial({ color: 0x615548, roughness: 1 }),
    store: new THREE.MeshStandardMaterial({ color: 0x67d5df, emissive: 0x1c6672, transparent: true, opacity: 0.7 }),
    portal: new THREE.MeshStandardMaterial({ color: 0xbe84ff, emissive: 0x4c2080, transparent: true, opacity: 0.74 }),
    chest: new THREE.MeshStandardMaterial({ color: 0x8f5b2b, metalness: 0.35, roughness: 0.62 }),
    potion: new THREE.MeshStandardMaterial({ color: 0x4bc3a7, emissive: 0x21554a, roughness: 0.25 })
  };

  const game = {
    started: false,
    paused: false,
    mode: "town",
    dungeonLevel: 0,
    floorSeed: 2,
    dungeonCleared: false,
    transitionTimer: 0,
    interactionCooldown: 0,
    attackTimer: 0,
    dashTimer: 0,
    dashCooldown: 0,
    quest: null,
    world: null,
    portalMesh: null,
    worldExit: null,
    monsters: [],
    attacks: [],
    pickups: [],
    chests: [],
    props: [],
    logs: [],
    pointerLocked: false,
    storeOpen: false,
    cameraRig: {
      yaw: 0,
      pitch: -0.18
    },
    player: {
      maxHp: 100,
      hp: 100,
      damage: 18,
      speed: 6.6,
      coins: 0,
      potions: 2,
      attackRange: 2.6,
      attackRate: 0.42,
      critChance: 0.08,
      luck: 0.05,
      level: 1,
      xp: 0,
      position: new THREE.Vector3(0, 0, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      isJumping: false,
      jumpPower: 12,
      gravity: 24,
      groundLevel: 0.7,
      mesh: null,
      sprite: null,
      animationTime: 0,
      isMoving: false,
      isRunning: false,
      walkCycle: 0,
      model: {}
    }
  };

  setupScene();
  bindEvents();
  buildTown();
  updateHud();
  animate();

  function setupScene() {
    scene.add(new THREE.HemisphereLight(0x8ca7ff, 0x24170d, 1.08));

    const sun = new THREE.DirectionalLight(0xffedc9, 1.75);
    sun.position.set(52, 72, 36);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -90;
    sun.shadow.camera.right = 90;
    sun.shadow.camera.top = 90;
    sun.shadow.camera.bottom = -90;
    scene.add(sun);

    const fill = new THREE.PointLight(0x6dc8ff, 1.1, 240);
    fill.position.set(0, 36, 0);
    scene.add(fill);

    const player = new THREE.Group();
    const cloakMat = new THREE.MeshStandardMaterial({ color: 0x11151c, roughness: 0.9 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x5f6f73, roughness: 0.82 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.25, 0.52), cloakMat);
    torso.position.y = 1.6;
    torso.castShadow = true;
    player.add(torso);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.72, 0.58), skinMat);
    head.position.y = 2.48;
    head.castShadow = true;
    player.add(head);

    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.1, 8), cloakMat);
    hood.position.set(0, 2.8, -0.05);
    hood.rotation.x = Math.PI;
    hood.castShadow = true;
    player.add(hood);

    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.85, 1.05),
      new THREE.MeshBasicMaterial({ map: createElfTexture(), transparent: true })
    );
    face.position.set(0, 2.5, 0.33);
    player.add(face);

    const armLeft = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.1, 0.28), cloakMat);
    const armRight = armLeft.clone();
    armLeft.position.set(-0.72, 1.65, 0);
    armRight.position.set(0.72, 1.65, 0);
    armLeft.castShadow = true;
    armRight.castShadow = true;
    player.add(armLeft);
    player.add(armRight);

    const legLeft = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.25, 0.34), new THREE.MeshStandardMaterial({ color: 0x232933, roughness: 0.92 }));
    const legRight = legLeft.clone();
    legLeft.position.set(-0.22, 0.63, 0);
    legRight.position.set(0.22, 0.63, 0);
    legLeft.castShadow = true;
    legRight.castShadow = true;
    player.add(legLeft);
    player.add(legRight);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.8, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    player.add(shadow);

    scene.add(player);
    game.player.mesh = player;
    game.player.sprite = face;
    game.player.model = { torso, head, face, armLeft, armRight, legLeft, legRight, shadow };
  }

  function bindEvents() {
    window.addEventListener("resize", onResize);

    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      keys[key] = true;
      if (key === "shift") {
        event.preventDefault();
        dash();
      }
      if (key === " ") {
        event.preventDefault();
        jump();
      }
      if (key === "q") {
        drinkPotion();
      }
      if (key === "p") {
        if (!game.storeOpen && ui.rewardModal.classList.contains("hidden")) {
          game.paused = !game.paused;
          updatePauseMenu();
        }
      }
      if (key === "e") {
        interact();
      }
    });

    window.addEventListener("keyup", (event) => {
      keys[event.key.toLowerCase()] = false;
    });

    // Class selection buttons
    const classButtons = Array.from(document.querySelectorAll(".class-button"));
    classButtons.forEach((button) => {
      button.addEventListener("click", () => {
        selectClass(button.dataset.class);
      });
    });

    ui.resumeButton.addEventListener("click", () => {
      game.paused = false;
      updatePauseMenu();
      requestPointer();
    });

    ui.quitButton.addEventListener("click", () => {
      game.paused = false;
      updatePauseMenu();
      buildTown();
    });

    ui.closeStoreButton.addEventListener("click", () => {
      closeStore();
      requestPointer();
    });

    renderer.domElement.addEventListener("click", () => {
      if (game.started) {
        requestPointer();
      }
    });

    document.addEventListener("pointerlockchange", () => {
      game.pointerLocked = document.pointerLockElement === renderer.domElement;
    });

    window.addEventListener("mousemove", (event) => {
      if (!game.pointerLocked || !game.started) {
        return;
      }
      game.cameraRig.yaw -= event.movementX * 0.0025;
      game.cameraRig.pitch -= event.movementY * 0.0018;
      game.cameraRig.pitch = THREE.MathUtils.clamp(game.cameraRig.pitch, -0.48, 0.3);
    });

    window.addEventListener("mousedown", () => {
      keys.mouse = true;
    });

    window.addEventListener("mouseup", () => {
      keys.mouse = false;
    });

    storeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        attemptPurchase(button.dataset.buy);
      });
    });
  }

  function selectClass(className) {
    const selectedClass = classes[className];
    if (!selectedClass) return;

    // Apply class stats to player
    game.player.maxHp = selectedClass.maxHp;
    game.player.hp = selectedClass.maxHp;
    game.player.damage = selectedClass.damage;
    game.player.speed = selectedClass.speed;

    game.started = true;
    ui.overlay.classList.add("hidden");
    addLog(`Welcome, ${selectedClass.name}! Walk to the central portal and press E.`);
    requestPointer();
  }

  function requestPointer() {
    if (renderer.domElement.requestPointerLock) {
      renderer.domElement.requestPointerLock();
    }
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function updatePauseMenu() {
    const showPause = game.paused && ui.rewardModal.classList.contains("hidden") && ui.storeModal.classList.contains("hidden");
    if (showPause) {
      ui.pauseMenu.classList.remove("hidden");
    } else {
      ui.pauseMenu.classList.add("hidden");
    }
  }

  function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.033);
    if (!game.started || game.paused) {
      updateHud();
      drawMap();
      renderer.render(scene, camera);
      return;
    }

    game.interactionCooldown = Math.max(0, game.interactionCooldown - delta);
    game.attackTimer = Math.max(0, game.attackTimer - delta);
    game.dashTimer = Math.max(0, game.dashTimer - delta);
    game.dashCooldown = Math.max(0, game.dashCooldown - delta);
    game.transitionTimer = Math.max(0, game.transitionTimer - delta);

    updatePortalFx();
    updatePlayer(delta);
    updateMonsters(delta);
    updatePickups(delta);
    updateAttacks(delta);
    updateProps(delta);
    updateCamera(delta);
    checkQuestProgress();
    updateHud();
    drawMap();

    renderer.render(scene, camera);
  }

  function updatePortalFx() {
    if (game.transitionTimer > 0) {
      ui.transitionFx.classList.remove("hidden");
      ui.transitionFx.classList.add("active");
    } else if (!ui.transitionFx.classList.contains("hidden")) {
      ui.transitionFx.classList.remove("active");
      window.setTimeout(() => {
        if (game.transitionTimer <= 0) {
          ui.transitionFx.classList.add("hidden");
        }
      }, 700);
    }
  }

  function updatePlayer(delta) {
    const moveInput = new THREE.Vector3(
      (keys.d ? 1 : 0) - (keys.a ? 1 : 0),
      0,
      (keys.s ? 1 : 0) - (keys.w ? 1 : 0)
    );

    const previous = game.player.position.clone();
    game.player.isMoving = moveInput.lengthSq() > 0;
    if (moveInput.lengthSq() > 0) {
      moveInput.normalize();
      const yaw = game.cameraRig.yaw;
      const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const right = new THREE.Vector3(forward.z, 0, -forward.x);
      const worldMove = new THREE.Vector3()
        .addScaledVector(right, moveInput.x)
        .addScaledVector(forward, moveInput.z)
        .normalize();

      const speed = game.dashTimer > 0 ? game.player.speed * 2.8 : game.player.speed;
      game.player.isRunning = game.dashTimer > 0;
      game.player.position.addScaledVector(worldMove, speed * delta);
      game.player.mesh.rotation.y = Math.atan2(worldMove.x, worldMove.z);
    } else {
      game.player.isRunning = false;
    }

    // Apply gravity
    game.player.velocity.y -= game.player.gravity * delta;
    game.player.position.y += game.player.velocity.y * delta;

    // Keep player above ground
    if (game.player.position.y <= game.player.groundLevel) {
      game.player.position.y = game.player.groundLevel;
      game.player.velocity.y = 0;
      game.player.isJumping = false;
    }

    constrainPlayer(previous);
    game.player.mesh.position.copy(game.player.position);
    animatePlayerModel(delta);

    if (keys.mouse) {
      tryAttack();
    }
  }

  function animatePlayerModel(delta) {
    const { torso, head, face, armLeft, armRight, legLeft, legRight } = game.player.model;
    if (!torso) {
      return;
    }

    const speed = game.player.isRunning ? 11 : 7;
    const stride = game.player.isRunning ? 0.95 : 0.55;
    game.player.animationTime += delta * speed;

    const cycle = game.player.isMoving ? Math.sin(game.player.animationTime) : 0;
    const bounce = game.player.isMoving ? Math.abs(Math.sin(game.player.animationTime)) * (game.player.isRunning ? 0.12 : 0.06) : 0;

    torso.position.y = 1.6 + bounce;
    head.position.y = 2.48 + bounce;
    face.position.y = 2.5 + bounce;

    armLeft.rotation.x = cycle * stride;
    armRight.rotation.x = -cycle * stride;
    legLeft.rotation.x = -cycle * stride;
    legRight.rotation.x = cycle * stride;

    armLeft.position.y = 1.65 + bounce;
    armRight.position.y = 1.65 + bounce;
    legLeft.position.y = 0.63 + bounce * 0.2;
    legRight.position.y = 0.63 + bounce * 0.2;
  }

  function constrainPlayer(previous) {
    if (game.mode === "town") {
      const radius = 130;
      const planar = game.player.position.clone();
      planar.y = 0;
      if (planar.length() > radius) {
        planar.setLength(radius);
        game.player.position.x = planar.x;
        game.player.position.z = planar.z;
      }
      return;
    }

    const tileSize = game.world.tileSize;
    const offset = game.world.offset;
    const cellX = Math.round((game.player.position.x + offset) / tileSize);
    const cellZ = Math.round((game.player.position.z + offset) / tileSize);
    if (!isWalkable(cellX, cellZ)) {
      game.player.position.copy(previous);
    }
  }

  function updateCamera(delta) {
    const player = game.player.position;
    const yaw = game.cameraRig.yaw;
    const pitch = game.cameraRig.pitch;

    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const side = new THREE.Vector3(forward.z, 0, -forward.x);
    const desired = player.clone()
      .addScaledVector(forward, 4.2)
      .addScaledVector(side, 2.2)
      .add(new THREE.Vector3(0, 3.5 + pitch * 4, 0));

    camera.position.lerp(desired, 1 - Math.pow(0.00005, delta));
    game.player.sprite.lookAt(camera.position);
    camera.lookAt(player.clone().add(new THREE.Vector3(0, 1.8, 0)));
  }

  function updateHud() {
    ui.location.textContent = game.mode === "town" ? "Ancient Hub" : `Dungeon Floor ${game.dungeonLevel}`;
    ui.stats.textContent = `HP ${Math.ceil(game.player.hp)}/${game.player.maxHp} | DMG ${game.player.damage} | SPD ${game.player.speed.toFixed(1)} | LVL ${game.player.level}`;
    ui.resources.textContent = `Coins ${game.player.coins} | Potions ${game.player.potions} | Crit ${Math.round(game.player.critChance * 100)}% | Luck ${Math.round(game.player.luck * 100)}%`;
    ui.quest.textContent = game.quest ? `Quest: ${game.quest.text} (${game.quest.progress}/${game.quest.target})` : "Quest: explore and survive";
    ui.mapTitle.textContent = game.mode === "town" ? "Hub Map" : "Dungeon Map";
    ui.storeStatus.innerHTML = `Coins ${game.player.coins}. Buy potions and permanent upgrades here.`;
    
    // Update health bars
    const healthPercent = Math.max(0, Math.min(100, (game.player.hp / game.player.maxHp) * 100));
    if (game.mode === "dungeon") {
      ui.healthBar.style.width = healthPercent + "%";
      ui.healthText.textContent = `${Math.ceil(game.player.hp)} / ${game.player.maxHp}`;
    } else if (game.mode === "town") {
      ui.healthBarTown.style.width = healthPercent + "%";
      ui.healthTextTown.textContent = `${Math.ceil(game.player.hp)} / ${game.player.maxHp}`;
    }
    
    updatePauseMenu();
  }

  function drawMap() {
    const ctx = mapContext;
    const w = ui.mapCanvas.width;
    const h = ui.mapCanvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#081018";
    ctx.fillRect(0, 0, w, h);

    if (game.mode === "town") {
      const center = w / 2;
      ctx.strokeStyle = "rgba(174, 201, 226, 0.12)";
      [50, 85, 130].forEach((r) => {
        ctx.beginPath();
        ctx.arc(center, center, r * 0.75, 0, Math.PI * 2);
        ctx.stroke();
      });
      drawDot(center, center, 8, "#b97cff");
      drawDot(center - 64, center, 7, "#6ce0e9");
      const px = center + game.player.position.x * 2.1;
      const pz = center + game.player.position.z * 2.1;
      drawDot(px, pz, 6, "#ffe3ac");
      return;
    }

    const grid = game.world.grid;
    const cell = Math.max(2, Math.floor(w / grid.length));
    const ox = Math.floor((w - grid.length * cell) / 2);
    const oy = Math.floor((h - grid.length * cell) / 2);
    for (let z = 0; z < grid.length; z += 1) {
      for (let x = 0; x < grid.length; x += 1) {
        ctx.fillStyle = grid[z][x] === 0 ? "#34424a" : "#101820";
        ctx.fillRect(ox + x * cell, oy + z * cell, cell, cell);
      }
    }

    game.chests.forEach((chest) => {
      if (!chest.opened) {
        const point = worldToMapCell(chest.mesh.position, cell, ox, oy);
        drawDot(point.x, point.y, Math.max(2, cell), "#f4bf5f");
      }
    });
    game.monsters.forEach((monster) => {
      const point = worldToMapCell(monster.mesh.position, cell, ox, oy);
      drawDot(point.x, point.y, Math.max(2, cell), monster.type === "boss" ? "#ff0000" : "#7f989b");
    });
    if (game.worldExit && game.worldExit.visible) {
      const point = worldToMapCell(game.worldExit.position, cell, ox, oy);
      drawDot(point.x, point.y, Math.max(2, cell), "#ca93ff");
    }
    const playerPoint = worldToMapCell(game.player.position, cell, ox, oy);
    drawDot(playerPoint.x, playerPoint.y, Math.max(2, cell), "#ffe3ac");
  }

  function drawDot(x, y, radius, color) {
    mapContext.fillStyle = color;
    mapContext.beginPath();
    mapContext.arc(x, y, radius, 0, Math.PI * 2);
    mapContext.fill();
  }

  function worldToMapCell(position, cell, ox, oy) {
    const x = Math.round((position.x + game.world.offset) / game.world.tileSize);
    const z = Math.round((position.z + game.world.offset) / game.world.tileSize);
    return { x: ox + x * cell + cell / 2, y: oy + z * cell + cell / 2 };
  }

  function addLog(text) {
    game.logs.unshift(text);
    game.logs = game.logs.slice(0, 8);
    ui.log.innerHTML = game.logs.map((entry) => `<div>${entry}</div>`).join("");
  }

  function clearWorld() {
    while (worldGroup.children.length > 0) {
      disposeTree(worldGroup.children[0]);
    }
    game.monsters = [];
    game.attacks = [];
    game.pickups = [];
    game.chests = [];
    game.props = [];
    game.portalMesh = null;
    game.worldExit = null;
  }

  function disposeTree(object) {
    object.traverse((node) => {
      if (node.geometry) {
        node.geometry.dispose();
      }
      if (node.material) {
        if (Array.isArray(node.material)) {
          node.material.forEach((material) => material.dispose());
        } else if (!isSharedMaterial(node.material)) {
          node.material.dispose();
        }
      }
    });
    if (object.parent) {
      object.parent.remove(object);
    }
  }

  function isSharedMaterial(material) {
    return Object.values(shared).includes(material);
  }

  function buildTown() {
    clearWorld();
    game.mode = "town";
    game.dungeonCleared = false;
    game.storeOpen = false;
    ui.storeModal.classList.add("hidden");
    // Show controls and town health bar, hide dungeon health bar
    ui.controlsPanel.classList.remove("hidden");
    ui.healthBarPanel.classList.add("hidden");
    ui.healthBarPanelTown.classList.remove("hidden");
    game.player.position.set(0, 0.8, 32);
    game.cameraRig.yaw = Math.PI;
    game.player.mesh.position.copy(game.player.position);

    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(140, 160, 1.5, 64),
      new THREE.MeshStandardMaterial({ color: 0x263d35, roughness: 0.95 })
    );
    floor.receiveShadow = true;
    worldGroup.add(floor);

    const centerDais = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 11, 1.8, 32),
      new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.88 })
    );
    centerDais.position.set(0, 0.9, 0);
    centerDais.castShadow = true;
    centerDais.receiveShadow = true;
    worldGroup.add(centerDais);

    const portal = new THREE.Group();
    const portalRing = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.38, 18, 72), shared.portal);
    portalRing.rotation.x = Math.PI / 2;
    portalRing.position.y = 2.25;
    portal.add(portalRing);
    const portalCore = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.3, 0.8, 32), shared.portal);
    portalCore.position.y = 1.95;
    portal.add(portalCore);
    worldGroup.add(portal);
    game.portalMesh = portal;

    buildDungeonEntrance();

    buildShop();

    buildStatueRings();

    game.world = {
      storeZone: new THREE.Vector3(-32, 0.6, 0),
      portalZone: new THREE.Vector3(0, 0.6, 0)
    };

    setQuest(makeQuest("town"));
    addLog("The hub statues watch over the portal. Press E at the center to enter the dungeon.");
  }

  function buildDungeonEntrance() {
    const entrance = new THREE.Group();
    entrance.position.set(0, 0.9, 0);

    // Left pillar
    const leftPillar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 4.8, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x5a5550, roughness: 0.92 })
    );
    leftPillar.position.set(-3.5, 2.8, 0);
    leftPillar.castShadow = true;
    leftPillar.receiveShadow = true;
    entrance.add(leftPillar);

    // Right pillar
    const rightPillar = leftPillar.clone();
    rightPillar.position.set(3.5, 2.8, 0);
    entrance.add(rightPillar);

    // Stone arch (curved top)
    const archGroup = new THREE.Group();
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI;
      const x = Math.cos(angle - Math.PI / 2) * 4.2;
      const y = Math.sin(angle - Math.PI / 2) * 3.2 + 4.5;
      
      const stone = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.7, 1),
        new THREE.MeshStandardMaterial({ color: 0x6a6360, roughness: 0.88 })
      );
      stone.position.set(x, y, 0);
      stone.castShadow = true;
      stone.receiveShadow = true;
      archGroup.add(stone);
    }
    entrance.add(archGroup);

    // Dark entrance opening (background)
    const opening = new THREE.Mesh(
      new THREE.BoxGeometry(6.2, 3.8, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x0a0f14, roughness: 1 })
    );
    opening.position.set(0, 2.2, 0.6);
    opening.receiveShadow = true;
    entrance.add(opening);

    // Weathered stone frame around opening
    const frameTop = new THREE.Mesh(
      new THREE.BoxGeometry(7, 0.6, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x4a4238, roughness: 0.95 })
    );
    frameTop.position.set(0, 4.2, 0);
    frameTop.castShadow = true;
    frameTop.receiveShadow = true;
    entrance.add(frameTop);

    const frameLeft = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 3.8, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x4a4238, roughness: 0.95 })
    );
    frameLeft.position.set(-3.8, 2.2, 0);
    frameLeft.castShadow = true;
    frameLeft.receiveShadow = true;
    entrance.add(frameLeft);

    const frameRight = frameLeft.clone();
    frameRight.position.set(3.8, 2.2, 0);
    entrance.add(frameRight);

    // Bottom threshold
    const threshold = new THREE.Mesh(
      new THREE.BoxGeometry(7.2, 0.4, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x3a3228, roughness: 0.98 })
    );
    threshold.position.set(0, 0.3, 0);
    threshold.castShadow = true;
    threshold.receiveShadow = true;
    entrance.add(threshold);

    worldGroup.add(entrance);
  }

  function buildShop() {
    const shop = new THREE.Group();
    shop.position.set(-32, 0, 0);

    // Platform base (smaller, more compact)
    const platform = new THREE.Mesh(
      new THREE.BoxGeometry(5, 0.5, 4.5),
      new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.85 })
    );
    platform.position.y = 0.25;
    platform.castShadow = true;
    platform.receiveShadow = true;
    shop.add(platform);

    // Wooden posts (4 corner pillars - smaller)
    const postMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.8 });
    const postPositions = [[-1.8, 0, -1.8], [1.8, 0, -1.8], [-1.8, 0, 1.8], [1.8, 0, 1.8]];
    postPositions.forEach((pos) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 2.8, 10), postMat);
      post.position.set(pos[0], pos[1] + 1.6, pos[2]);
      post.castShadow = true;
      post.receiveShadow = true;
      shop.add(post);
    });

    // Simple peaked roof (smaller)
    const roofLeft = new THREE.Mesh(
      new THREE.BoxGeometry(5.5, 0.25, 2.5),
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.72 })
    );
    roofLeft.position.y = 2.88;
    roofLeft.rotation.z = 0.28;
    roofLeft.castShadow = true;
    shop.add(roofLeft);

    const roofRight = roofLeft.clone();
    roofRight.rotation.z = -0.28;
    shop.add(roofRight);

    // Counter (compact stand style)
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 0.95, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x5a3a2a, roughness: 0.78 })
    );
    counter.position.y = 0.9;
    counter.position.z = 1.2;
    counter.castShadow = true;
    counter.receiveShadow = true;
    shop.add(counter);

    // Counter top (glowing)
    const counterTop = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.12, 1.3),
      new THREE.MeshStandardMaterial({ color: 0x67d5df, emissive: 0x1c6672, roughness: 0.3 })
    );
    counterTop.position.y = 1.48;
    counterTop.position.z = 1.2;
    counterTop.castShadow = true;
    shop.add(counterTop);

    // Display shelf for potions
    const shelf = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 0.18, 1.0),
      new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.75 })
    );
    shelf.position.y = 2.2;
    shelf.position.z = 1.5;
    shelf.castShadow = true;
    shop.add(shelf);

    // Add potion bottles on the shelf
    const potionBottles = [
      { x: -1.4, z: 1.5, rotation: 0.1 },
      { x: -0.6, z: 1.55, rotation: -0.08 },
      { x: 0.2, z: 1.5, rotation: 0.12 },
      { x: 1.0, z: 1.55, rotation: -0.1 },
      { x: 1.6, z: 1.52, rotation: 0.06 }
    ];

    potionBottles.forEach((pos) => {
      // Bottle body (main potion container)
      const bottle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.25, 0.45, 8),
        shared.potion
      );
      bottle.position.set(pos.x, 2.55, pos.z);
      bottle.rotation.z = pos.rotation;
      bottle.castShadow = true;
      bottle.receiveShadow = true;
      shop.add(bottle);

      // Bottle cap/stopper
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.18, 0.12, 6),
        new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.7 })
      );
      cap.position.set(pos.x, 2.78, pos.z);
      cap.castShadow = true;
      cap.receiveShadow = true;
      shop.add(cap);

      // Liquid inside bottle (glowing effect)
      const liquid = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.23, 0.38, 8),
        new THREE.MeshStandardMaterial({ color: 0x3dd9c3, emissive: 0x1a7a6a, roughness: 0.2 })
      );
      liquid.position.set(pos.x, 2.50, pos.z);
      liquid.rotation.z = pos.rotation;
      shop.add(liquid);
    });

    worldGroup.add(shop);
  }

  function buildStatueRings() {
    const rings = [
      { radius: 40, count: 10, scale: 1.0 },
      { radius: 60, count: 14, scale: 0.9 },
      { radius: 85, count: 16, scale: 0.8 },
      { radius: 110, count: 18, scale: 0.7 },
      { radius: 135, count: 20, scale: 0.65 }
    ];

    rings.forEach((ring) => {
      for (let i = 0; i < ring.count; i += 1) {
        const angle = (i / ring.count) * Math.PI * 2;
        const statue = createGiantStatue(ring.scale);
        statue.position.set(Math.cos(angle) * ring.radius, 0, Math.sin(angle) * ring.radius);
        statue.lookAt(0, 3, 0);
        worldGroup.add(statue);
      }
    });

    // Add some scattered smaller trees in between
    const rng = mulberry32(12345);
    for (let i = 0; i < 35; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 45 + Math.random() * 85;
      const scale = 0.5 + Math.random() * 0.4;
      const tree = createGiantStatue(scale);
      tree.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      worldGroup.add(tree);
    }
  }

  function createGiantStatue(scale) {
    const group = new THREE.Group();
    const trunk = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.8 });
    const foliage = new THREE.MeshStandardMaterial({ color: 0x2d5a2d, emissive: 0x1a3a1a, roughness: 0.9 });

    // Trunk
    const trunkMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 8, 12), trunk);
    trunkMesh.position.y = 4;
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    group.add(trunkMesh);

    // Foliage - multiple cone layers for canopy
    const canopyLayers = [
      { height: 6, radius: 4, y: 10 },
      { height: 5, radius: 3.5, y: 14.5 },
      { height: 4, radius: 2.5, y: 18.5 }
    ];

    canopyLayers.forEach((layer) => {
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(layer.radius, layer.height, 16), foliage);
      canopy.position.y = layer.y;
      canopy.castShadow = true;
      canopy.receiveShadow = true;
      group.add(canopy);
    });

    group.scale.setScalar(1.7 * scale);
    return group;
  }

  function enterDungeon() {
    game.transitionTimer = 1.2;
    ui.transitionFx.classList.remove("hidden");
    ui.transitionFx.classList.add("active");

    window.setTimeout(() => {
      game.dungeonLevel += 1;
      game.floorSeed += 17;
      game.mode = "dungeon";
      game.dungeonCleared = false;
      clearWorld();

      // Hide controls and town health bar, show dungeon health bar
      ui.controlsPanel.classList.add("hidden");
      ui.healthBarPanel.classList.remove("hidden");
      ui.healthBarPanelTown.classList.add("hidden");

      const rng = mulberry32(game.floorSeed);
      closeStore();
      const size = 33 + game.dungeonLevel * 3;
      const grid = createGrid(size, size, 1);
      const rooms = carveRooms(grid, rng, size);
      connectRooms(grid, rooms);
      sprinkleTurns(grid, rng, size);

      const tileSize = 4;
      const offset = ((size - 1) * tileSize) / 2;
      const floorGroup = new THREE.Group();

      for (let z = 0; z < size; z += 1) {
        for (let x = 0; x < size; x += 1) {
          const worldX = x * tileSize - offset;
          const worldZ = z * tileSize - offset;
          if (grid[z][x] === 0) {
            const tile = new THREE.Mesh(new THREE.BoxGeometry(tileSize, 0.5, tileSize), shared.floor.clone());
            tile.material.color.offsetHSL((rng() - 0.5) * 0.04, 0, (rng() - 0.5) * 0.08);
            tile.position.set(worldX, 0.45, worldZ);
            tile.rotation.y = Math.floor(rng() * 4) * (Math.PI / 2);
            tile.receiveShadow = true;
            floorGroup.add(tile);

            if (rng() > 0.82) {
              const crack = new THREE.Mesh(
                new THREE.BoxGeometry(tileSize * 0.7, 0.06, tileSize * 0.14),
                new THREE.MeshStandardMaterial({ color: 0x151a1f, roughness: 1 })
              );
              crack.position.set(worldX + (rng() - 0.5), 0.73, worldZ + (rng() - 0.5));
              crack.rotation.y = rng() * Math.PI;
              floorGroup.add(crack);
            }
          } else {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(tileSize, 8 + rng() * 3, tileSize), shared.wall.clone());
            wall.material.color.offsetHSL((rng() - 0.5) * 0.03, 0, (rng() - 0.5) * 0.08);
            wall.position.set(worldX, 4.65, worldZ);
            wall.castShadow = true;
            wall.receiveShadow = true;
            floorGroup.add(wall);
          }
        }
      }

      worldGroup.add(floorGroup);

      const startPosition = roomCenter(rooms[0], tileSize, offset);
      const bossPosition = roomCenter(rooms[rooms.length - 1], tileSize, offset);
      game.world = { grid, tileSize, offset, size };

      game.player.position.copy(startPosition);
      game.player.position.y = 0.7;
      game.player.mesh.position.copy(game.player.position);
      game.cameraRig.yaw = Math.PI;

      spawnDungeonProps(rooms, tileSize, offset, rng, bossPosition);
      setQuest(makeQuest("dungeon"));
      addLog(`Entered floor ${game.dungeonLevel}. Explore the dungeon and survive.`);
    }, 580);
  }

  function spawnDungeonProps(rooms, tileSize, offset, rng, exitPosition) {
    rooms.forEach((room, index) => {
      if (index !== 0) {
        const monsterCount = index === rooms.length - 1 ? 1 : 1 + Math.floor(rng() * 2) + Math.floor(game.dungeonLevel / 2);
        for (let i = 0; i < monsterCount; i += 1) {
          const px = (room.x + 1 + Math.floor(rng() * Math.max(1, room.w - 2))) * tileSize - offset;
          const pz = (room.y + 1 + Math.floor(rng() * Math.max(1, room.h - 2))) * tileSize - offset;
          const type = index === rooms.length - 1 ? "boss" : rng() > 0.68 ? "orc" : rng() > 0.28 ? "goblin" : "slime";
          spawnMonster(new THREE.Vector3(px, 0.13, pz), type);
        }
      }

      if (index > 0 && index < rooms.length - 1 && rng() > 0.48) {
        const chestPos = roomCenter(room, tileSize, offset).add(new THREE.Vector3(rng() * 2.4 - 1.2, 0, rng() * 2.4 - 1.2));
        spawnChest(chestPos, rng);
      }

      if (index > 0) {
        createTorch(roomCenter(room, tileSize, offset).clone().add(new THREE.Vector3(1.2, 0, -1.2)));
      }
    });

    const exit = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.4, 24), shared.portal);
    exit.position.copy(exitPosition);
    exit.position.y = 0.7;
    exit.visible = false;
    worldGroup.add(exit);
    game.worldExit = exit;
  }

  function createTorch(position) {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.1, 8), shared.wall);
    pole.position.y = 1.45;
    group.add(pole);

    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xffb547, emissive: 0x8c3500 })
    );
    flame.position.y = 2.55;
    group.add(flame);

    const light = new THREE.PointLight(0xffab55, 1.5, 16);
    light.position.y = 2.65;
    group.add(light);

    group.position.copy(position);
    worldGroup.add(group);
    game.props.push(group);
  }

  function spawnChest(position, rng) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 1), shared.chest);
    mesh.position.copy(position);
    mesh.position.y = 1.05;
    mesh.castShadow = true;
    worldGroup.add(mesh);
    game.chests.push({
      mesh,
      opened: false,
      rewardCoins: 10 + Math.floor(rng() * 16) + game.dungeonLevel * 4,
      rewardPotion: rng() > 0.5 ? 1 : 0
    });
  }

  function spawnMonster(position, type) {
    const stats = type === "boss"
      ? { hp: 150 + game.dungeonLevel * 45, speed: 3.1, damage: 24 + game.dungeonLevel * 3, scale: 2.4, color: 0xc95555, coin: 90 + game.dungeonLevel * 20 }
      : type === "orc"
        ? { hp: 64 + game.dungeonLevel * 18, speed: 3.3, damage: 15 + game.dungeonLevel * 2, scale: 1.45, color: 0x6e6a58, coin: 24 + game.dungeonLevel * 6 }
        : type === "goblin"
          ? { hp: 42 + game.dungeonLevel * 12, speed: 4.4, damage: 10 + game.dungeonLevel * 1.6, scale: 1.05, color: 0x6cc16f, coin: 17 + game.dungeonLevel * 4 }
        : { hp: 34 + game.dungeonLevel * 10, speed: 4.2, damage: 8 + game.dungeonLevel * 1.5, scale: 1, color: 0x64d49a, coin: 14 + game.dungeonLevel * 4 };

    const mesh = new THREE.Group();
    const visuals = createMonsterVisual(type, stats);
    mesh.add(visuals.root);

    mesh.position.copy(position);
    worldGroup.add(mesh);
    game.monsters.push({
      type,
      hp: stats.hp,
      damage: stats.damage,
      speed: stats.speed,
      coin: stats.coin,
      mesh,
      hitCooldown: Math.random() * 0.3,
      anim: Math.random() * Math.PI * 2,
      visuals
    });
  }

  function createMonsterVisual(type, stats) {
    const root = new THREE.Group();
    if (type === "slime" || type === "boss") {
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.9 * stats.scale, 18, 18),
        new THREE.MeshStandardMaterial({ color: stats.color, roughness: 0.55 })
      );
      body.position.y = 0.9 * stats.scale;
      body.castShadow = true;
      root.add(body);

      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.12 * stats.scale, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0xf5f1e9, emissive: 0x383838 })
      );
      eye.position.set(0.18 * stats.scale, 1.05 * stats.scale, 0.68 * stats.scale);
      root.add(eye);
      return { root, body };
    }

    const skin = new THREE.MeshStandardMaterial({ color: type === "goblin" ? 0x78b86d : 0x8a7961, roughness: 0.8 });
    const armor = new THREE.MeshStandardMaterial({ color: type === "goblin" ? 0x38452f : 0x46403a, roughness: 0.92 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9 * stats.scale, 1.2 * stats.scale, 0.5 * stats.scale), armor);
    torso.position.y = 1.8 * stats.scale;
    torso.castShadow = true;
    root.add(torso);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.66 * stats.scale, 0.7 * stats.scale, 0.52 * stats.scale), skin);
    head.position.y = 2.7 * stats.scale;
    head.castShadow = true;
    root.add(head);

    const legLeft = new THREE.Mesh(new THREE.BoxGeometry(0.24 * stats.scale, 0.95 * stats.scale, 0.24 * stats.scale), armor);
    const legRight = legLeft.clone();
    legLeft.position.set(-0.2 * stats.scale, 0.95 * stats.scale, 0);
    legRight.position.set(0.2 * stats.scale, 0.95 * stats.scale, 0);
    root.add(legLeft);
    root.add(legRight);

    const armLeft = new THREE.Mesh(new THREE.BoxGeometry(0.2 * stats.scale, 0.9 * stats.scale, 0.2 * stats.scale), skin);
    const armRight = armLeft.clone();
    armLeft.position.set(-0.58 * stats.scale, 1.85 * stats.scale, 0);
    armRight.position.set(0.58 * stats.scale, 1.85 * stats.scale, 0);
    root.add(armLeft);
    root.add(armRight);

    return { root, torso, head, legLeft, legRight, armLeft, armRight };
  }

  function isMonsterWalkable(position) {
    if (!game.world || !game.world.grid) {
      return true;
    }
    const tileSize = game.world.tileSize;
    const offset = game.world.offset;
    const cellX = Math.round((position.x + offset) / tileSize);
    const cellZ = Math.round((position.z + offset) / tileSize);
    return isWalkable(cellX, cellZ);
  }

  function moveMonsterTowards(monster, direction, delta) {
    const moveVector = direction.clone().setY(0).normalize().multiplyScalar(monster.speed * delta);
    const nextPosition = monster.mesh.position.clone().add(moveVector);

    if (isMonsterWalkable(nextPosition)) {
      monster.mesh.position.copy(nextPosition);
      return;
    }

    const stepX = new THREE.Vector3(Math.sign(moveVector.x), 0, 0).multiplyScalar(Math.abs(moveVector.x));
    const stepZ = new THREE.Vector3(0, 0, Math.sign(moveVector.z)).multiplyScalar(Math.abs(moveVector.z));

    if (Math.abs(stepX.x) > 0 && isMonsterWalkable(monster.mesh.position.clone().add(stepX))) {
      monster.mesh.position.add(stepX);
    } else if (Math.abs(stepZ.z) > 0 && isMonsterWalkable(monster.mesh.position.clone().add(stepZ))) {
      monster.mesh.position.add(stepZ);
    }
  }

  function updateMonsters(delta) {
    const detectionRange = 9.0;
    const attackRange = 2.0;

    for (const monster of game.monsters) {
      monster.anim += delta * monster.speed * 1.8;
      const toPlayer = new THREE.Vector3().subVectors(game.player.position, monster.mesh.position);
      toPlayer.y = 0;
      const distance = toPlayer.length();
      const seesPlayer = distance <= detectionRange;

      if (seesPlayer && distance > 0.1) {
        moveMonsterTowards(monster, toPlayer, delta);
        monster.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
      }

      animateMonster(monster);

      monster.hitCooldown -= delta;
      if (seesPlayer && distance < attackRange && monster.hitCooldown <= 0) {
        monster.hitCooldown = 0.95;
        game.player.hp -= monster.damage;
        addLog(`You were hit for ${Math.round(monster.damage)}.`);
        if (game.player.hp <= 0) {
          handleDefeat();
          break;
        }
      }
    }
  }

  function animateMonster(monster) {
    if (monster.type === "slime" || monster.type === "boss") {
      monster.visuals.root.scale.y = 0.92 + Math.abs(Math.sin(monster.anim)) * 0.18;
      monster.visuals.root.scale.x = 1.02 - Math.abs(Math.sin(monster.anim)) * 0.08;
      monster.visuals.root.scale.z = monster.visuals.root.scale.x;
      return;
    }

    const cycle = Math.sin(monster.anim);
    monster.visuals.legLeft.rotation.x = cycle * 0.6;
    monster.visuals.legRight.rotation.x = -cycle * 0.6;
    monster.visuals.armLeft.rotation.x = -cycle * 0.5;
    monster.visuals.armRight.rotation.x = cycle * 0.5;
  }

  function tryAttack() {
    if (game.attackTimer > 0) {
      return;
    }
    const target = findClosestMonster(game.player.attackRange + 0.9);
    if (!target) {
      return;
    }

    game.attackTimer = game.player.attackRate;
    const critical = Math.random() < game.player.critChance;
    const damage = critical ? game.player.damage * 1.85 : game.player.damage;

    const slash = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.12, 8, 24, Math.PI),
      new THREE.MeshStandardMaterial({ color: critical ? 0xffd76f : 0x9be6ff, emissive: critical ? 0xa86812 : 0x1e5f6c, transparent: true })
    );
    slash.rotation.z = Math.PI / 2;
    slash.position.copy(game.player.position).add(new THREE.Vector3(0, 1.4, 0));
    worldGroup.add(slash);
    game.attacks.push({ mesh: slash, life: 0.18 });

    target.hp -= damage;
    addLog(`${critical ? "Critical hit" : "Hit"} for ${Math.round(damage)}.`);
    if (target.hp <= 0) {
      killMonster(target);
    }
  }

  function updateAttacks(delta) {
    game.attacks = game.attacks.filter((attack) => {
      attack.life -= delta;
      attack.mesh.scale.multiplyScalar(1 + delta * 5);
      attack.mesh.material.opacity = Math.max(0, attack.life * 5);
      if (attack.life <= 0) {
        disposeTree(attack.mesh);
        return false;
      }
      return true;
    });
  }

  function findClosestMonster(maxDistance) {
    let best = null;
    let bestDistance = maxDistance;
    for (const monster of game.monsters) {
      const distance = monster.mesh.position.distanceTo(game.player.position);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = monster;
      }
    }
    return best;
  }

  function killMonster(monster) {
    game.player.coins += monster.coin;
    game.player.xp += 20 + monster.coin;
    maybeLevelUp();
    maybeDropPotion(monster.mesh.position);
    incrementQuest("kill");

    if (monster.type === "boss") {
      game.dungeonCleared = true;
      if (game.worldExit) {
        game.worldExit.visible = true;
      }
      addLog(`Boss defeated. +${monster.coin} coins. The exit portal is open.`);
    } else {
      addLog(`Monster defeated. +${monster.coin} coins.`);
    }

    game.monsters = game.monsters.filter((entry) => entry !== monster);
    disposeTree(monster.mesh);
  }

  function maybeDropPotion(position) {
    if (Math.random() > 0.18 + game.player.luck) {
      return;
    }
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.45, 4, 8), shared.potion);
    mesh.position.copy(position);
    mesh.position.y = 0.8;
    worldGroup.add(mesh);
    game.pickups.push({ type: "potion", amount: 1, mesh });
  }

  function updatePickups(delta) {
    const bob = Math.sin(performance.now() * 0.004) * 0.16;
    game.pickups = game.pickups.filter((pickup) => {
      pickup.mesh.rotation.y += delta * 2;
      pickup.mesh.position.y = 0.8 + bob;
      if (pickup.mesh.position.distanceTo(game.player.position) < 1.5) {
        game.player.potions += pickup.amount;
        addLog("Potion collected.");
        incrementQuest("collect");
        disposeTree(pickup.mesh);
        return false;
      }
      return true;
    });
  }

  function updateProps(delta) {
    if (game.portalMesh) {
      game.portalMesh.rotation.y += delta * 0.6;
    }
    if (game.worldExit) {
      game.worldExit.rotation.y += delta * 0.8;
    }
    game.props.forEach((prop) => {
      prop.rotation.y += delta * 0.2;
    });
  }

  function dash() {
    if (game.dashCooldown > 0) {
      return;
    }
    game.dashTimer = 0.22;
    game.dashCooldown = 1.7;
    addLog("Dash!");
  }

  function jump() {
    if (game.player.isJumping || game.player.position.y > game.player.groundLevel + 0.1) {
      return;
    }
    game.player.velocity.y = game.player.jumpPower;
    game.player.isJumping = true;
  }

  function drinkPotion() {
    if (game.player.potions <= 0 || game.player.hp >= game.player.maxHp) {
      return;
    }
    game.player.potions -= 1;
    game.player.hp = Math.min(game.player.maxHp, game.player.hp + 45);
    addLog("Potion consumed. Health restored.");
  }

  function interact() {
    if (game.interactionCooldown > 0) {
      return;
    }
    game.interactionCooldown = 0.25;

    if (game.mode === "town") {
      if (game.player.position.distanceTo(game.world.portalZone) < 8) {
        enterDungeon();
        return;
      }
      if (game.player.position.distanceTo(game.world.storeZone) < 5.6) {
        openStore();
      } else {
        addLog("Move into the blue ring to enter the shop.");
      }
      return;
    }

    const chest = game.chests.find((entry) => !entry.opened && entry.mesh.position.distanceTo(game.player.position) < 2.2);
    if (chest) {
      openChest(chest);
      return;
    }

    if (game.dungeonCleared && game.worldExit && game.worldExit.position.distanceTo(game.player.position) < 3.1) {
      completeFloor();
    }
  }

  function openStore() {
    game.storeOpen = true;
    game.paused = true;
    ui.storeModal.classList.remove("hidden");
    updatePauseMenu();
  }

  function closeStore() {
    game.storeOpen = false;
    game.paused = false;
    ui.storeModal.classList.add("hidden");
    updatePauseMenu();
  }

  function openChest(chest) {
    chest.opened = true;
    chest.mesh.rotation.x = -0.35;
    game.player.coins += chest.rewardCoins;
    game.player.potions += chest.rewardPotion;
    addLog(`Chest opened. +${chest.rewardCoins} coins${chest.rewardPotion ? " and a potion" : ""}.`);
    incrementQuest("collect");
  }

  function completeFloor() {
    addLog(`Floor ${game.dungeonLevel} cleared.`);
    incrementQuest("boss");
    showRewards();
  }

  function showRewards() {
    game.paused = true;
    ui.rewardModal.classList.remove("hidden");
    ui.rewardChoices.innerHTML = "";

    const rewards = [
      { label: "Sharpened Blade", detail: "+6 damage", apply: () => { game.player.damage += 6; } },
      { label: "Swift Boots", detail: "+0.9 speed", apply: () => { game.player.speed += 0.9; } },
      { label: "Greater Vitality", detail: "+30 max HP, heal 20", apply: () => { game.player.maxHp += 30; game.player.hp = Math.min(game.player.maxHp, game.player.hp + 20); } },
      { label: "Lucky Charm", detail: "+8% luck, +4% crit", apply: () => { game.player.luck += 0.08; game.player.critChance += 0.04; } }
    ];

    rewards.forEach((reward) => {
      const button = document.createElement("button");
      button.innerHTML = `${reward.label}<br><small>${reward.detail}</small>`;
      button.addEventListener("click", () => {
        reward.apply();
        ui.rewardModal.classList.add("hidden");
        game.paused = false;
        buildTown();
        addLog(`${reward.label} claimed.`);
      });
      ui.rewardChoices.appendChild(button);
    });
  }

  function attemptPurchase(type) {
    if (game.mode !== "town" || game.player.position.distanceTo(game.world.storeZone) > 5.6) {
      addLog("Move into the blue store ring first.");
      return;
    }

    const items = {
      potion: { cost: 20, apply: () => { game.player.potions += 1; addLog("Bought a potion."); } },
      power: { cost: 45, apply: () => { game.player.damage += 4; addLog("Bought a power-up. Damage increased."); } },
      vitality: { cost: 55, apply: () => { game.player.maxHp += 20; game.player.hp = Math.min(game.player.maxHp, game.player.hp + 20); addLog("Bought vitality. Max HP increased."); } }
    };

    const item = items[type];
    if (!item || game.player.coins < item.cost) {
      addLog("Not enough coins.");
      return;
    }
    game.player.coins -= item.cost;
    item.apply();
  }

  function handleDefeat() {
    addLog("You lost the dungeon run. No new money from uncleared enemies.");
    game.player.hp = game.player.maxHp;
    buildTown();
  }

  function maybeLevelUp() {
    let required = game.player.level * 100;
    while (game.player.xp >= required) {
      game.player.level += 1;
      game.player.xp -= required;
      game.player.maxHp += 18;
      game.player.hp = Math.min(game.player.maxHp, game.player.hp + 20);
      game.player.damage += 4;
      addLog(`Level up! You are now level ${game.player.level}.`);
      required = game.player.level * 100;
    }
  }

  function makeQuest(mode) {
    if (mode === "town") {
      return { kind: "travel", target: 1, progress: 0, text: "Step into the center portal and descend" };
    }
    const quests = [
      { kind: "kill", target: 4 + game.dungeonLevel, progress: 0, text: "Defeat monsters on this floor" },
      { kind: "collect", target: 2, progress: 0, text: "Loot treasure and collect potions" },
      { kind: "boss", target: 1, progress: 0, text: "Defeat the floor boss and escape alive" }
    ];
    return quests[Math.floor(Math.random() * quests.length)];
  }

  function setQuest(quest) {
    game.quest = quest;
  }

  function incrementQuest(kind) {
    if (!game.quest || game.quest.kind !== kind) {
      return;
    }
    game.quest.progress = Math.min(game.quest.target, game.quest.progress + 1);
    if (game.quest.progress >= game.quest.target) {
      rewardQuest();
    }
  }

  function checkQuestProgress() {
    if (game.mode === "town" && game.quest && game.quest.kind === "travel" && game.player.position.distanceTo(game.world.portalZone) < 8) {
      game.quest.progress = 1;
      rewardQuest();
    }
  }

  function rewardQuest() {
    addLog(`Quest completed: ${game.quest.text}. Reward +35 coins.`);
    game.player.coins += 35;
    game.quest = game.mode === "town" ? null : makeQuest(game.mode);
  }

  function isWalkable(x, z) {
    const row = game.world.grid[z];
    return !!(row && row[x] === 0);
  }

  function createGrid(width, height, fillValue) {
    return Array.from({ length: height }, () => Array.from({ length: width }, () => fillValue));
  }

  function carveRooms(grid, rng, size) {
    const rooms = [];
    const roomCount = 8 + Math.floor(rng() * 4);

    for (let i = 0; i < roomCount; i += 1) {
      const w = 4 + Math.floor(rng() * 4);
      const h = 4 + Math.floor(rng() * 4);
      const x = 1 + Math.floor(rng() * (size - w - 2));
      const y = 1 + Math.floor(rng() * (size - h - 2));
      let overlaps = false;

      rooms.forEach((room) => {
        if (x < room.x + room.w + 2 && x + w + 2 > room.x && y < room.y + room.h + 2 && y + h + 2 > room.y) {
          overlaps = true;
        }
      });

      if (overlaps) {
        continue;
      }

      rooms.push({ x, y, w, h });
      for (let yy = y; yy < y + h; yy += 1) {
        for (let xx = x; xx < x + w; xx += 1) {
          grid[yy][xx] = 0;
        }
      }
    }

    if (rooms.length < 2) {
      const fallback = [{ x: 2, y: 2, w: 5, h: 5 }, { x: size - 8, y: size - 8, w: 5, h: 5 }];
      fallback.forEach((room) => {
        for (let yy = room.y; yy < room.y + room.h; yy += 1) {
          for (let xx = room.x; xx < room.x + room.w; xx += 1) {
            grid[yy][xx] = 0;
          }
        }
      });
      return fallback;
    }

    rooms.sort((a, b) => a.x + a.y - (b.x + b.y));
    return rooms;
  }

  function connectRooms(grid, rooms) {
    for (let i = 1; i < rooms.length; i += 1) {
      const a = centerCell(rooms[i - 1]);
      const b = centerCell(rooms[i]);
      carveCorridor(grid, a.x, a.y, b.x, a.y);
      carveCorridor(grid, b.x, a.y, b.x, b.y);
    }
  }

  function sprinkleTurns(grid, rng, size) {
    const count = 18 + Math.floor(rng() * 18);
    for (let i = 0; i < count; i += 1) {
      const x = 2 + Math.floor(rng() * (size - 4));
      const z = 2 + Math.floor(rng() * (size - 4));
      if (grid[z][x] === 0) {
        const length = 2 + Math.floor(rng() * 4);
        const horizontal = rng() > 0.5;
        for (let step = 0; step < length; step += 1) {
          const xx = horizontal ? x + step : x;
          const zz = horizontal ? z : z + step;
          if (grid[zz] && grid[zz][xx] !== undefined) {
            grid[zz][xx] = 0;
          }
        }
      }
    }
  }

  function carveCorridor(grid, x1, y1, x2, y2) {
    const dx = Math.sign(x2 - x1);
    const dy = Math.sign(y2 - y1);
    let x = x1;
    let y = y1;
    grid[y][x] = 0;
    while (x !== x2 || y !== y2) {
      if (x !== x2) {
        x += dx;
      } else if (y !== y2) {
        y += dy;
      }
      grid[y][x] = 0;
    }
  }

  function centerCell(room) {
    return { x: Math.floor(room.x + room.w / 2), y: Math.floor(room.y + room.h / 2) };
  }

  function roomCenter(room, tileSize, offset) {
    const cell = centerCell(room);
    return new THREE.Vector3(cell.x * tileSize - offset, 0.6, cell.y * tileSize - offset);
  }

  function createElfTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 384;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#101319";
    ctx.beginPath();
    ctx.moveTo(128, 84);
    ctx.lineTo(96, 116);
    ctx.lineTo(104, 204);
    ctx.lineTo(88, 336);
    ctx.lineTo(122, 336);
    ctx.lineTo(128, 268);
    ctx.lineTo(134, 336);
    ctx.lineTo(168, 336);
    ctx.lineTo(152, 204);
    ctx.lineTo(160, 116);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.arc(128, 60, 34, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#161b23";
    ctx.beginPath();
    ctx.moveTo(128, 34);
    ctx.lineTo(84, 62);
    ctx.lineTo(100, 8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(128, 34);
    ctx.lineTo(172, 62);
    ctx.lineTo(156, 8);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#8dcad0";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(114, 58);
    ctx.lineTo(124, 58);
    ctx.moveTo(132, 58);
    ctx.lineTo(142, 58);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function mulberry32(seed) {
    let t = seed;
    return function () {
      t += 0x6d2b79f5;
      let x = Math.imul(t ^ (t >>> 15), t | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
})();
