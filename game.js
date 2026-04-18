// ============================================
// MAIN GAME INITIALIZATION
// ============================================

(function () {
  // Create the 3D scene - the container for all game objects
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x090b11); // Dark blue-black background color
  scene.fog = new THREE.FogExp2(0x0a0d14, 0.02); // Add fog for depth perception

  // Create the camera - determines what part of the scene is visible
  const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 2000);
  
  // Create the renderer - draws the 3D scene to the web page
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight); // Set canvas to full window size
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Optimize for high-DPI screens
  renderer.shadowMap.enabled = true; // Enable shadow rendering
  document.body.appendChild(renderer.domElement); // Add canvas to the HTML body

  // ============================================
  // UI ELEMENT REFERENCES
  // ============================================
  // Store references to all HTML UI elements for easy access
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
    healthTextTown: document.getElementById("healthTextTown"),
    townStatsPanel: document.getElementById("townStatsPanel"),
    slashDamageText: document.getElementById("slashDamageText")
  };
  
  // Get 2D context for drawing the minimap
  const mapContext = ui.mapCanvas.getContext("2d");

  // Get all store purchase buttons from the HTML
  const storeButtons = Array.from(document.querySelectorAll("[data-buy]"));
  
  // Clock for tracking delta time between frames (for smooth animations)
  const clock = new THREE.Clock();
  
  // Object to track which keyboard keys are currently pressed
  const keys = {};
  
  // Group to hold all world objects (terrain, buildings, etc.)
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  // ============================================
  // CHARACTER CLASS DEFINITIONS
  // ============================================
  // Define the different character classes with their stats
  const classes = {
    tank: { maxHp: 220, damage: 15, speed: 5.8, name: "Tank" },       // High HP, low damage, slow
    hunter: { maxHp: 170, damage: 20, speed: 6.8, name: "Hunter" },   // Medium HP, good damage, fast
    assassin: { maxHp: 140, damage: 24, speed: 7.2, name: "Assassin" }, // Low HP, highest damage, fastest
    rogue: { maxHp: 200, damage: 18, speed: 7.0, name: "Rogue" }      // Balanced stats
  };

  // ============================================
  // SHARED MATERIALS
  // ============================================
  // Reusable materials for different object types (optimizes memory)
  const shared = {
    floor: new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.95 }),
    wall: new THREE.MeshStandardMaterial({ color: 0x615548, roughness: 1 }),
    store: new THREE.MeshStandardMaterial({ color: 0x67d5df, emissive: 0x1c6672, transparent: true, opacity: 0.7 }),
    portal: new THREE.MeshStandardMaterial({ color: 0xbe84ff, emissive: 0x4c2080, transparent: true, opacity: 0.74 }),
    chest: new THREE.MeshStandardMaterial({ color: 0x8f5b2b, metalness: 0.35, roughness: 0.62 }),
    potion: new THREE.MeshStandardMaterial({ color: 0x4bc3a7, emissive: 0x21554a, roughness: 0.25 })
  };

  // ============================================
  // MAIN GAME STATE
  // ============================================
  // Global game state object - holds all game variables
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
    isGameOver: false,
    stats: {
      slainMonsters: 0
    },
    cameraRig: {
      yaw: 0,
      pitch: -0.18
    },
    player: {
      maxHp: 100,           // Maximum health points
      hp: 100,              // Current health points
      damage: 18,           // Attack damage
      speed: 6.6,           // Movement speed
      coins: 0,             // Currency amount
      potions: 2,           // Health potions in inventory
      attackRange: 2.6,     // How far attacks can reach
      attackRate: 0.42,     // Time between attacks (seconds)
      critChance: 0.08,     // 8% chance for critical hits
      luck: 0.05,           // 5% luck factor for drops
      level: 1,             // Current player level
      xp: 0,                // Experience points
      position: new THREE.Vector3(0, 0, 0),  // 3D position in world
      velocity: new THREE.Vector3(0, 0, 0),  // Current movement velocity
      isJumping: false,     // Whether player is in the air
      jumpPower: 12,        // Initial upward velocity when jumping
      gravity: 24,          // Downward acceleration
      groundLevel: 0.7,     // Y position of the ground
      mesh: null,           // Reference to player 3D model
      sprite: null,         // Reference to player face sprite
      animationTime: 0,     // Timer for walk cycle animation
      isMoving: false,      // Whether player is moving
      isRunning: false,     // Whether player is dashing/running
      walkCycle: 0,         // Current frame in walk animation
      model: {}             // References to body parts for animation
    }
  };

  // ============================================
  // INITIALIZATION
  // ============================================
  // Set up the 3D scene, create UI, bind input handlers, build the town, update display, start game loop
  setupScene();           // Create lights, camera, and player model
  createGameOverOverlay(); // Create the game over screen HTML
  bindEvents();           // Set up keyboard/mouse event listeners
  buildTown();            // Generate the starting town area
  updateHud();            // Update the UI with initial values
  animate();              // Start the main game loop

  // ============================================
  // SCENE SETUP - Create lights and player model
  // ============================================
  function setupScene() {
    // Add ambient light (sky color, ground color, intensity)
    scene.add(new THREE.HemisphereLight(0x8ca7ff, 0x24170d, 1.08));

    // Create the main directional light (sun) - casts shadows
    const sun = new THREE.DirectionalLight(0xffedc9, 1.75);
    sun.position.set(52, 72, 36);           // Position high in the sky
    sun.castShadow = true;                  // Enable shadow casting
    sun.shadow.mapSize.set(2048, 2048);     // High-res shadow map
    sun.shadow.camera.left = -90;           // Shadow camera bounds
    sun.shadow.camera.right = 90;
    sun.shadow.camera.top = 90;
    sun.shadow.camera.bottom = -90;
    scene.add(sun);

    // Add fill light to brighten shadows
    const fill = new THREE.PointLight(0x6dc8ff, 1.1, 240);
    fill.position.set(0, 36, 0);
    scene.add(fill);

    // ============================================
    // CREATE PLAYER MODEL
    // ============================================
    const player = new THREE.Group();  // Group to hold all body parts
    
    // Create materials for different body parts
    const cloakMat = new THREE.MeshStandardMaterial({ color: 0x11151c, roughness: 0.9 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x5f6f73, roughness: 0.82 });

    // Create torso (body)
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.25, 0.52), cloakMat);
    torso.position.y = 1.6;              // Position at chest height
    torso.castShadow = true;             // Enable shadows
    player.add(torso);

    // Create head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.72, 0.58), skinMat);
    head.position.y = 2.48;
    head.castShadow = true;
    player.add(head);

    // Create hood (cone on top of head)
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.1, 8), cloakMat);
    hood.position.set(0, 2.8, -0.05);
    hood.rotation.x = Math.PI;           // Flip upside down
    hood.castShadow = true;
    player.add(hood);

    // Create face (textured plane)
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.85, 1.05),
      new THREE.MeshBasicMaterial({ map: createElfTexture(), transparent: true })
    );
    face.position.set(0, 2.5, 0.33);
    player.add(face);

    // Create arms (left and right)
    const armLeft = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.1, 0.28), cloakMat);
    const armRight = armLeft.clone();
    armLeft.position.set(-0.72, 1.65, 0);   // Left side
    armRight.position.set(0.72, 1.65, 0);   // Right side
    armLeft.castShadow = true;
    armRight.castShadow = true;
    player.add(armLeft);
    player.add(armRight);

    // Create legs (left and right)
    const legLeft = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.25, 0.34), new THREE.MeshStandardMaterial({ color: 0x232933, roughness: 0.92 }));
    const legRight = legLeft.clone();
    legLeft.position.set(-0.22, 0.63, 0);
    legRight.position.set(0.22, 0.63, 0);
    legLeft.castShadow = true;
    legRight.castShadow = true;
    player.add(legLeft);
    player.add(legRight);

    // Create shadow underneath player
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.8, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 })
    );
    shadow.rotation.x = -Math.PI / 2;    // Flatten to ground
    shadow.position.y = 0.02;
    player.add(shadow);

    // Add player to scene and store references
    scene.add(player);
    game.player.mesh = player;           // Store 3D model reference
    game.player.sprite = face;           // Store face sprite reference
    game.player.model = { torso, head, face, armLeft, armRight, legLeft, legRight, shadow }; // Store body parts
  }

  // ============================================
  // EVENT BINDING - Set up all input handlers
  // ============================================
  function bindEvents() {
    // Handle window resize - update camera aspect ratio and renderer size
    window.addEventListener("resize", onResize);

    // Handle key press - track pressed keys and trigger actions
    window.addEventListener("keydown", (event) => {
      if (game.isGameOver) return;  // Don't process input if game is over
      
      const key = event.key.toLowerCase();
      keys[key] = true;  // Mark key as pressed
      
      // Shift - dash ability
      if (key === "shift") {
        event.preventDefault();
        dash();
      }
      // Space - jump
      if (key === " ") {
        event.preventDefault();
        jump();
      }
      // Q - use health potion
      if (key === "q") {
        drinkPotion();
      }
      // P - pause/unpause game
      if (key === "p") {
        if (!game.storeOpen && ui.rewardModal.classList.contains("hidden")) {
          game.paused = !game.paused;
          updatePauseMenu();
        }
      }
      // E - interact with objects
      if (key === "e") {
        interact();
      }
    });

    // Handle key release - mark keys as not pressed
    window.addEventListener("keyup", (event) => {
      if (game.isGameOver) return;
      keys[event.key.toLowerCase()] = false;
    });

    // Class selection buttons - let player choose character class
    const classButtons = Array.from(document.querySelectorAll(".class-button"));
    classButtons.forEach((button) => {
      button.addEventListener("click", () => {
        selectClass(button.dataset.class);
      });
    });

    // Resume button - unpause the game
    ui.resumeButton.addEventListener("click", () => {
      game.paused = false;
      updatePauseMenu();
      requestPointer();
    });

    // Quit button - close the game window
    ui.quitButton.addEventListener("click", () => {
      window.close();
    });

    // Close store button
    ui.closeStoreButton.addEventListener("click", () => {
      closeStore();
      requestPointer();
    });

    // Click on game canvas - request pointer lock for mouse control
    renderer.domElement.addEventListener("click", () => {
      if (game.isGameOver) return;
      if (game.started) {
        requestPointer();
      }
    });

    // Pointer lock change - track if mouse is locked to game
    document.addEventListener("pointerlockchange", () => {
      game.pointerLocked = document.pointerLockElement === renderer.domElement;
    });

    // Mouse movement - rotate camera (look around)
    window.addEventListener("mousemove", (event) => {
      if (game.isGameOver || !game.pointerLocked || !game.started) {
        return;
      }
      game.cameraRig.yaw -= event.movementX * 0.0025;
      game.cameraRig.pitch -= event.movementY * 0.0018;
      game.cameraRig.pitch = THREE.MathUtils.clamp(game.cameraRig.pitch, -0.48, 0.3);
    });

    window.addEventListener("mousedown", () => {
      if (game.isGameOver) {
        return;
      }
      keys.mouse = true;
    });

    window.addEventListener("mouseup", () => {
      if (game.isGameOver) {
        return;
      }
      keys.mouse = false;
    });

    storeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        attemptPurchase(button.dataset.buy);
      });
    });
  }

  // ============================================
  // SELECT CLASS - Choose character class at game start
  // ============================================
  function selectClass(className) {
    const selectedClass = classes[className];
    if (!selectedClass) return;

    // Apply selected class stats to player
    game.player.maxHp = selectedClass.maxHp;
    game.player.hp = selectedClass.maxHp;
    game.player.damage = selectedClass.damage;
    game.player.speed = selectedClass.speed;

    // Start the game
    game.started = true;
    ui.overlay.classList.add("hidden");  // Hide class selection screen
    addLog(`Welcome, ${selectedClass.name}! Walk to the central portal and press E.`);
    requestPointer();  // Lock mouse to game
  }

  // ============================================
  // REQUEST POINTER LOCK - Lock mouse to game canvas
  // ============================================
  function requestPointer() {
    if (renderer.domElement.requestPointerLock) {
      renderer.domElement.requestPointerLock();
    }
  }

  // ============================================
  // ON RESIZE - Handle window resizing
  // ============================================
  function onResize() {
    // Update camera aspect ratio
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    // Update renderer size
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ============================================
  // CREATE GAME OVER OVERLAY - Build the death screen HTML
  // ============================================
  function createGameOverOverlay() {
    const wrapper = document.createElement("div");
    wrapper.id = "gameOverOverlay";
    wrapper.className = "hidden";
    wrapper.style.position = "fixed";
    wrapper.style.inset = "0";
    wrapper.style.zIndex = "40";
    wrapper.style.display = "none";
    wrapper.style.placeItems = "center";
    wrapper.style.background = "rgba(4, 4, 8, 0.82)";
    wrapper.style.backdropFilter = "blur(8px)";

    const card = document.createElement("div");
    card.style.width = "min(520px, calc(100vw - 32px))";
    card.style.padding = "28px";
    card.style.borderRadius = "24px";
    card.style.border = "1px solid rgba(255, 215, 138, 0.24)";
    card.style.background = "linear-gradient(180deg, rgba(32, 18, 24, 0.96), rgba(14, 16, 24, 0.96))";
    card.style.boxShadow = "0 20px 60px rgba(0, 0, 0, 0.45)";
    card.style.textAlign = "center";
    card.style.color = "#f5efe2";
    card.innerHTML = `
      <h2 style="margin:0 0 12px;font-size:2rem;letter-spacing:0.05em;">Game Over</h2>
      <p style="margin:0 0 16px;color:#c7beaf;">Your run has ended. Click anywhere to continue.</p>
      <div id="gameOverStats" style="display:grid;gap:10px;text-align:left;background:rgba(255,255,255,0.04);border-radius:16px;padding:16px;"></div>
    `;

    wrapper.appendChild(card);
    document.body.appendChild(wrapper);

    wrapper.addEventListener("click", () => {
      if (!game.isGameOver) {
        return;
      }
      hideGameOverScreen();
      resetRunToClassSelection();
    });

    ui.gameOverOverlay = wrapper;
    ui.gameOverStats = card.querySelector("#gameOverStats");
  }

  function showGameOverScreen() {
    const maxSlashDamage = Math.round(game.player.damage * 1.85);
    ui.gameOverStats.innerHTML = [
      `Monsters Slain: ${game.stats.slainMonsters}`,
      `Total Health: ${game.player.maxHp}`,
      `Max Slash Damage: ${maxSlashDamage}`
    ].map((line) => `<div>${line}</div>`).join("");
    ui.gameOverOverlay.classList.remove("hidden");
    ui.gameOverOverlay.style.display = "grid";
  }

  function hideGameOverScreen() {
    game.isGameOver = false;
    game.paused = false;
    keys.mouse = false;
    ui.gameOverOverlay.classList.add("hidden");
    ui.gameOverOverlay.style.display = "none";
  }

  function updatePauseMenu() {
    const showPause = game.paused && ui.rewardModal.classList.contains("hidden") && ui.storeModal.classList.contains("hidden");
    if (showPause) {
      ui.pauseMenu.classList.remove("hidden");
    } else {
      ui.pauseMenu.classList.add("hidden");
    }
  }

  // ============================================
  // MAIN GAME LOOP - Called every frame
  // ============================================
  function animate() {
    requestAnimationFrame(animate);  // Schedule next frame

    // Get time since last frame (capped at 0.033s to prevent huge jumps)
    const delta = Math.min(clock.getDelta(), 0.033);
    
    // If game hasn't started or is paused, just render scene and update UI
    if (!game.started || game.paused) {
      updateHud();
      drawMap();
      renderer.render(scene, camera);
      return;
    }

    // Decrease all cooldown timers
    game.interactionCooldown = Math.max(0, game.interactionCooldown - delta);
    game.attackTimer = Math.max(0, game.attackTimer - delta);
    game.dashTimer = Math.max(0, game.dashTimer - delta);
    game.dashCooldown = Math.max(0, game.dashCooldown - delta);
    game.transitionTimer = Math.max(0, game.transitionTimer - delta);

    // Update all game systems
    updatePortalFx();        // Animate portal effects
    updatePlayer(delta);     // Move player and handle input
    updateMonsters(delta);   // Update enemy AI and movement
    updatePickups(delta);    // Handle item pickups
    updateAttacks(delta);    // Process combat attacks
    updateProps(delta);      // Update interactive objects
    updateCamera(delta);     // Smooth camera follow
    checkQuestProgress();    // Check if quest objectives met
    updateHud();             // Update UI displays
    drawMap();               // Draw minimap

    // Render the 3D scene
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

  // ============================================
  // PLAYER UPDATE - Handle movement and physics
  // ============================================
  function updatePlayer(delta) {
    // Get movement input from WASD keys (D-A for X, S-W for Z)
    const moveInput = new THREE.Vector3(
      (keys.d ? 1 : 0) - (keys.a ? 1 : 0),
      0,
      (keys.s ? 1 : 0) - (keys.w ? 1 : 0)
    );

    // Store previous position for collision detection
    const previous = game.player.position.clone();
    
    // Check if player is moving
    game.player.isMoving = moveInput.lengthSq() > 0;
    
    if (moveInput.lengthSq() > 0) {
      // Normalize input to prevent faster diagonal movement
      moveInput.normalize();
      
      // Get camera direction (yaw) for relative movement
      const yaw = game.cameraRig.yaw;
      
      // Calculate forward and right vectors based on camera direction
      const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const right = new THREE.Vector3(forward.z, 0, -forward.x);
      
      // Combine inputs with direction vectors
      const worldMove = new THREE.Vector3()
        .addScaledVector(right, moveInput.x)
        .addScaledVector(forward, moveInput.z)
        .normalize();

      // Calculate speed (faster when dashing)
      const speed = game.dashTimer > 0 ? game.player.speed * 2.8 : game.player.speed;
      game.player.isRunning = game.dashTimer > 0;
      
      // Apply movement to player position
      game.player.position.addScaledVector(worldMove, speed * delta);
      
      // Rotate player model to face movement direction
      game.player.mesh.rotation.y = Math.atan2(worldMove.x, worldMove.z);
    } else {
      game.player.isRunning = false;
    }

    // Apply gravity to vertical velocity
    game.player.velocity.y -= game.player.gravity * delta;
    game.player.position.y += game.player.velocity.y * delta;

    // Keep player above ground level
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

  // ============================================
  // PLAYER ANIMATION - Animate body parts for walking
  // ============================================
  function animatePlayerModel(delta) {
    // Get references to body parts
    const { torso, head, face, armLeft, armRight, legLeft, legRight } = game.player.model;
    if (!torso) return;  // Exit if player model not set up yet

    // Animation speed and stride depend on running state
    const speed = game.player.isRunning ? 11 : 7;
    const stride = game.player.isRunning ? 0.95 : 0.55;
    
    // Increment animation timer
    game.player.animationTime += delta * speed;

    // Calculate cycle (sine wave for arm/leg swing) and bounce (vertical bob)
    const cycle = game.player.isMoving ? Math.sin(game.player.animationTime) : 0;
    const bounce = game.player.isMoving ? Math.abs(Math.sin(game.player.animationTime)) * (game.player.isRunning ? 0.12 : 0.06) : 0;

    // Apply bounce to upper body (torso, head, face move up and down together)
    torso.position.y = 1.6 + bounce;
    head.position.y = 2.48 + bounce;
    face.position.y = 2.5 + bounce;

    // Swing arms in opposite directions
    armLeft.rotation.x = cycle * stride;
    armRight.rotation.x = -cycle * stride;
    
    // Move legs in opposite directions (opposite to arms)
    legLeft.rotation.x = -cycle * stride;
    legRight.rotation.x = cycle * stride;

    // Apply bounce to arms and legs
    armLeft.position.y = 1.65 + bounce;
    armRight.position.y = 1.65 + bounce;
    legLeft.position.y = 0.63 + bounce * 0.2;
    legRight.position.y = 0.63 + bounce * 0.2;
  }

  // ============================================
  // PLAYER COLLISION - Keep player within bounds
  // ============================================
  function constrainPlayer(previous) {
    // In town mode, keep player within circular boundary
    if (game.mode === "town") {
      const radius = 130;  // Maximum distance from center
      const planar = game.player.position.clone();
      planar.y = 0;  // Ignore vertical position
      
      // If player is outside the circle, push them back
      if (planar.length() > radius) {
        planar.setLength(radius);
        game.player.position.x = planar.x;
        game.player.position.z = planar.z;
      }
      return;
    }

    // In dungeon mode, check if tile is walkable
    const tileSize = game.world.tileSize;
    const offset = game.world.offset;
    const cellX = Math.round((game.player.position.x + offset) / tileSize);
    const cellZ = Math.round((game.player.position.z + offset) / tileSize);
    
    // If tile is not walkable (wall), revert to previous position
    if (!isWalkable(cellX, cellZ)) {
      game.player.position.copy(previous);
    }
  }

  // ============================================
  // CAMERA UPDATE - Smooth follow behind player
  // ============================================
  function updateCamera(delta) {
    const player = game.player.position;
    const yaw = game.cameraRig.yaw;      // Horizontal rotation
    const pitch = game.cameraRig.pitch;  // Vertical rotation

    // Calculate forward and side vectors based on camera direction
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const side = new THREE.Vector3(forward.z, 0, -forward.x);
    
    // Calculate desired camera position (behind and above player)
    const desired = player.clone()
      .addScaledVector(forward, 4.2)   // 4.2 units behind
      .addScaledVector(side, 2.2)       // 2.2 units to the side
      .add(new THREE.Vector3(0, 3.5 + pitch * 4, 0));  // 3.5+ units up

    // Smoothly interpolate camera position (lerp)
    camera.position.lerp(desired, 1 - Math.pow(0.00005, delta));
    
    // Make player face always face the camera
    game.player.sprite.lookAt(camera.position);
    
    // Point camera at player's head level
    camera.lookAt(player.clone().add(new THREE.Vector3(0, 1.8, 0)));
  }

  // ============================================
  // HUD UPDATE - Update all UI displays
  // ============================================
  function updateHud() {
    const totalSlashDamage = Math.round(game.player.damage * 1.85);
    ui.location.textContent = game.mode === "town" ? "Ancient Hub" : `Dungeon Floor ${game.dungeonLevel}`;
    ui.stats.textContent = `HP ${Math.ceil(game.player.hp)}/${game.player.maxHp} | DMG ${game.player.damage} | SPD ${game.player.speed.toFixed(1)} | LVL ${game.player.level}`;
    ui.resources.textContent = `Coins ${game.player.coins} | Potions ${game.player.potions} | Crit ${Math.round(game.player.critChance * 100)}% | Luck ${Math.round(game.player.luck * 100)}%`;
    ui.quest.textContent = game.quest ? `Quest: ${game.quest.text} (${game.quest.progress}/${game.quest.target})` : "Quest: explore and survive";
    ui.mapTitle.textContent = game.mode === "town" ? "Hub Map" : "Dungeon Map";
    ui.storeStatus.innerHTML = `Coins ${game.player.coins}. Buy potions and permanent upgrades here.`;
    ui.slashDamageText.textContent = `Total Slash Damage ${totalSlashDamage}`;
    if (game.mode === "town") {
      ui.townStatsPanel.classList.remove("hidden");
    } else {
      ui.townStatsPanel.classList.add("hidden");
    }
    
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

  // ============================================
  // DRAW MAP - Render the minimap
  // ============================================
  function drawMap() {
    const ctx = mapContext;
    const w = ui.mapCanvas.width;
    const h = ui.mapCanvas.height;
    
    // Clear and fill background
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#081018";
    ctx.fillRect(0, 0, w, h);

    // Draw town map (circular with portal and shop markers)
    if (game.mode === "town") {
      const center = w / 2;
      // Draw concentric circles for distance reference
      ctx.strokeStyle = "rgba(174, 201, 226, 0.12)";
      [50, 85, 130].forEach((r) => {
        ctx.beginPath();
        ctx.arc(center, center, r * 0.75, 0, Math.PI * 2);
        ctx.stroke();
      });
      // Draw portal (purple)
      drawDot(center, center, 8, "#b97cff");
      // Draw shop (cyan)
      drawDot(center - 64, center, 7, "#6ce0e9");
      // Draw player position (yellow)
      const px = center + game.player.position.x * 2.1;
      const pz = center + game.player.position.z * 2.1;
      drawDot(px, pz, 6, "#ffe3ac");
      return;
    }

    // Draw dungeon map (grid-based)
    const grid = game.world.grid;
    const cell = Math.max(2, Math.floor(w / grid.length));  // Calculate cell size
    const ox = Math.floor((w - grid.length * cell) / 2);    // Offset X
    const oy = Math.floor((h - grid.length * cell) / 2);    // Offset Y
    
    // Draw each tile (0 = floor, 1 = wall)
    for (let z = 0; z < grid.length; z += 1) {
      for (let x = 0; x < grid.length; x += 1) {
        ctx.fillStyle = grid[z][x] === 0 ? "#34424a" : "#101820";
        ctx.fillRect(ox + x * cell, oy + z * cell, cell, cell);
      }
    }

    // Draw chests (gold)
    game.chests.forEach((chest) => {
      if (!chest.opened) {
        const point = worldToMapCell(chest.mesh.position, cell, ox, oy);
        drawDot(point.x, point.y, Math.max(2, cell), "#f4bf5f");
      }
    });
    
    // Draw monsters (red for boss, gray for regular)
    game.monsters.forEach((monster) => {
      const point = worldToMapCell(monster.mesh.position, cell, ox, oy);
      drawDot(point.x, point.y, Math.max(2, cell), monster.type === "boss" ? "#ff0000" : "#7f989b");
    });
    
    // Draw exit portal (purple) if visible
    if (game.worldExit && game.worldExit.visible) {
      const point = worldToMapCell(game.worldExit.position, cell, ox, oy);
      drawDot(point.x, point.y, Math.max(2, cell), "#ca93ff");
    }
    
    // Draw player (yellow)
    const playerPoint = worldToMapCell(game.player.position, cell, ox, oy);
    drawDot(playerPoint.x, playerPoint.y, Math.max(2, cell), "#ffe3ac");
  }

  // Helper function to draw a dot on the map
  function drawDot(x, y, radius, color) {
    mapContext.fillStyle = color;
    mapContext.beginPath();
    mapContext.arc(x, y, radius, 0, Math.PI * 2);
    mapContext.fill();
  }

  // Convert 3D world position to 2D map position
  function worldToMapCell(position, cell, ox, oy) {
    const x = Math.round((position.x + game.world.offset) / game.world.tileSize);
    const z = Math.round((position.z + game.world.offset) / game.world.tileSize);
    return { x: ox + x * cell + cell / 2, y: oy + z * cell + cell / 2 };
  }

  // ============================================
  // ADD LOG - Add message to game log display
  // ============================================
  function addLog(text) {
    // Add new message to front of array
    game.logs.unshift(text);
    // Keep only last 8 messages
    game.logs = game.logs.slice(0, 8);
    // Update HTML display
    ui.log.innerHTML = game.logs.map((entry) => `<div>${entry}</div>`).join("");
  }

  // ============================================
  // CLEAR WORLD - Remove all objects when changing areas
  // ============================================
  function clearWorld() {
    // Remove all children from world group
    while (worldGroup.children.length > 0) {
      disposeTree(worldGroup.children[0]);
    }
    // Clear all game arrays
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

  // ============================================
  // BUILD TOWN - Create the starting hub area
  // ============================================
  function buildTown() {
    clearWorld();  // Remove all objects from previous area
    
    // Set game mode to town
    game.mode = "town";
    game.dungeonCleared = false;
    game.storeOpen = false;
    
    // Heal player when returning to town
    game.player.hp = game.player.maxHp;
    ui.storeModal.classList.add("hidden");
    
    // Show town-specific UI, hide dungeon UI
    ui.controlsPanel.classList.remove("hidden");
    ui.healthBarPanel.classList.add("hidden");
    ui.healthBarPanelTown.classList.remove("hidden");
    
    // Reset player position and camera
    game.player.position.set(0, 0.8, 32);
    game.cameraRig.yaw = Math.PI;
    game.player.mesh.position.copy(game.player.position);

    // Create circular town floor
    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(140, 160, 1.5, 64),
      new THREE.MeshStandardMaterial({ color: 0x263d35, roughness: 0.95 })
    );
    floor.receiveShadow = true;
    worldGroup.add(floor);

    // Create raised platform in center
    const centerDais = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 11, 1.8, 32),
      new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.88 })
    );
    centerDais.position.set(0, 0.9, 0);
    centerDais.castShadow = true;
    centerDais.receiveShadow = true;
    worldGroup.add(centerDais);

    // Create portal (dungeon entrance)
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

    // Build surrounding structures
    buildDungeonEntrance();
    buildShop();
    buildStatueRings();

    // Define interactive zones
    game.world = {
      storeZone: new THREE.Vector3(-32, 0.6, 0),
      portalZone: new THREE.Vector3(0, 0.6, 0)
    };

    // Set initial quest and show message
    setQuest(makeQuest("town"));
    addLog("The hub statues watch over the portal. Press E at the center to enter the dungeon.");
  }

  // ============================================
  // BUILD DUNGEON ENTRANCE - Archway leading to dungeon
  // ============================================
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

  // ============================================
  // ENTER DUNGEON - Transition from town to dungeon
  // ============================================
  function enterDungeon() {
    // Start transition effect
    game.transitionTimer = 1.2;
    ui.transitionFx.classList.remove("hidden");
    ui.transitionFx.classList.add("active");

    // Wait for transition effect, then generate dungeon
    window.setTimeout(() => {
      // Increment dungeon level
      game.dungeonLevel += 1;
      game.floorSeed += 17;  // Change seed for new dungeon layout
      game.mode = "dungeon";
      game.dungeonCleared = false;
      clearWorld();

      // Switch UI from town to dungeon mode
      ui.controlsPanel.classList.add("hidden");
      ui.healthBarPanel.classList.remove("hidden");
      ui.healthBarPanelTown.classList.add("hidden");

      // Generate dungeon using procedural generation
      const rng = mulberry32(game.floorSeed);  // Seeded random number generator
      closeStore();
      const size = 33 + game.dungeonLevel * 3;  // Dungeon gets bigger each level
      const grid = createGrid(size, size, 1);   // Create empty grid (all walls)
      const rooms = carveRooms(grid, rng, size); // Carve out rooms
      connectRooms(grid, rooms);                 // Connect rooms with corridors
      sprinkleTurns(grid, rng, size);            // Add random turns

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

  // ============================================
  // MONSTER UPDATE - AI and combat for enemies
  // ============================================
  function updateMonsters(delta) {
    const detectionRange = 9.0;   // How far monsters can see the player
    const attackRange = 2.0;      // How close monster must be to attack

    // Loop through all active monsters
    for (const monster of game.monsters) {
      // Update animation timer
      monster.anim += delta * monster.speed * 1.8;
      
      // Calculate distance and direction to player
      const toPlayer = new THREE.Vector3().subVectors(game.player.position, monster.mesh.position);
      toPlayer.y = 0;  // Ignore vertical difference
      const distance = toPlayer.length();
      const seesPlayer = distance <= detectionRange;  // Can monster see player?

      // If monster sees player and is not on top of them, move towards player
      if (seesPlayer && distance > 0.1) {
        moveMonsterTowards(monster, toPlayer, delta);
        monster.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);  // Face player
      }

      // Animate the monster
      animateMonster(monster);

      // Handle monster attacking player
      monster.hitCooldown -= delta;
      if (seesPlayer && distance < attackRange && monster.hitCooldown <= 0) {
        monster.hitCooldown = 0.95;  // Reset attack cooldown
        game.player.hp -= monster.damage;  // Deal damage to player
        addLog(`You were hit for ${Math.round(monster.damage)}.`);
        
        // Check if player died
        if (game.player.hp <= 0) {
          handleDefeat();
          break;
        }
      }
    }
  }

  // ============================================
  // MONSTER ANIMATION - Animate different enemy types
  // ============================================
  function animateMonster(monster) {
    // Slimes and bosses use a pulsing/squishing animation
    if (monster.type === "slime" || monster.type === "boss") {
      monster.visuals.root.scale.y = 0.92 + Math.abs(Math.sin(monster.anim)) * 0.18;
      monster.visuals.root.scale.x = 1.02 - Math.abs(Math.sin(monster.anim)) * 0.08;
      monster.visuals.root.scale.z = monster.visuals.root.scale.x;
      return;
    }

    // Other monsters use limb animation (walk cycle)
    const cycle = Math.sin(monster.anim);
    monster.visuals.legLeft.rotation.x = cycle * 0.6;
    monster.visuals.legRight.rotation.x = -cycle * 0.6;
    monster.visuals.armLeft.rotation.x = -cycle * 0.5;
    monster.visuals.armRight.rotation.x = cycle * 0.5;
  }

  // ============================================
  // PLAYER ATTACK - Attempt to attack nearest enemy
  // ============================================
  function tryAttack() {
    // Don't allow attack if still on cooldown
    if (game.attackTimer > 0) {
      return;
    }
    
    // Find closest monster within attack range
    const target = findClosestMonster(game.player.attackRange + 0.9);
    if (!target) {
      return;  // No valid target
    }

    // Set attack cooldown
    game.attackTimer = game.player.attackRate;
    
    // Calculate damage (check for critical hit)
    const critical = Math.random() < game.player.critChance;
    const damage = critical ? game.player.damage * 1.85 : game.player.damage;

    // Create visual slash effect (sword swing)
    const slash = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.12, 8, 24, Math.PI),
      new THREE.MeshStandardMaterial({ color: critical ? 0xffd76f : 0x9be6ff, emissive: critical ? 0xa86812 : 0x1e5f6c, transparent: true })
    );
    slash.rotation.z = Math.PI / 2;
    slash.position.copy(game.player.position).add(new THREE.Vector3(0, 1.4, 0));
    worldGroup.add(slash);
    game.attacks.push({ mesh: slash, life: 0.18 });  // Add to attacks list (will fade out)

    // Apply damage to target
    target.hp -= damage;
    addLog(`${critical ? "Critical hit" : "Hit"} for ${Math.round(damage)}.`);
    
    // Check if monster died
    if (target.hp <= 0) {
      killMonster(target);
    }
  }

  // ============================================
  // ATTACK EFFECTS UPDATE - Fade out slash visuals
  // ============================================
  function updateAttacks(delta) {
    // Filter out expired attacks and update remaining ones
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

  // ============================================
  // KILL MONSTER - Handle monster death
  // ============================================
  function killMonster(monster) {
    // Increment kill counter
    game.stats.slainMonsters += 1;
    
    // Award coins and XP
    game.player.coins += monster.coin;
    game.player.xp += 20 + monster.coin;
    
    // Check for level up
    maybeLevelUp();
    
    // Maybe drop a potion (based on luck)
    maybeDropPotion(monster.mesh.position);
    
    // Update quest progress
    incrementQuest("kill");

    // If boss, mark dungeon as cleared and show exit
    if (monster.type === "boss") {
      game.dungeonCleared = true;
      if (game.worldExit) {
        game.worldExit.visible = true;
      }
      addLog(`Boss defeated. +${monster.coin} coins. The exit portal is open.`);
    } else {
      addLog(`Monster defeated. +${monster.coin} coins.`);
    }

    // Remove monster from game
    game.monsters = game.monsters.filter((entry) => entry !== monster);
    disposeTree(monster.mesh);  // Clean up 3D objects
  }

  // ============================================
  // MAYBE DROP POTION - Random chance to drop health potion
  // ============================================
  function maybeDropPotion(position) {
    // 18% base chance + luck factor
    if (Math.random() > 0.18 + game.player.luck) {
      return;
    }
    // Create potion mesh
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.45, 4, 8), shared.potion);
    mesh.position.copy(position);
    mesh.position.y = 0.8;
    worldGroup.add(mesh);
    // Add to pickups list
    game.pickups.push({ type: "potion", amount: 1, mesh });
  }

  // ============================================
  // UPDATE PICKUPS - Handle item collection
  // ============================================
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

  // ============================================
  // UPDATE PROPS - Animate rotating objects (portal, props)
  // ============================================
  function updateProps(delta) {
    // Rotate portal
    if (game.portalMesh) {
      game.portalMesh.rotation.y += delta * 0.6;
    }
    // Rotate dungeon exit
    if (game.worldExit) {
      game.worldExit.rotation.y += delta * 0.8;
    }
    // Rotate decorative props
    game.props.forEach((prop) => {
      prop.rotation.y += delta * 0.2;
    });
  }

  // ============================================
  // DASH - Quick forward burst (Shift key)
  // ============================================
  function dash() {
    // Can't dash if on cooldown
    if (game.dashCooldown > 0) {
      return;
    }
    // Activate dash (increases speed in updatePlayer)
    game.dashTimer = 0.22;    // How long dash lasts
    game.dashCooldown = 1.7;  // Time before next dash
    addLog("Dash!");
  }

  // ============================================
  // JUMP - Make player jump
  // ============================================
  function jump() {
    // Don't allow jump if already jumping or in the air
    if (game.player.isJumping || game.player.position.y > game.player.groundLevel + 0.1) {
      return;
    }
    // Apply upward velocity
    game.player.velocity.y = game.player.jumpPower;
    game.player.isJumping = true;
  }

  // ============================================
  // DRINK POTION - Restore health
  // ============================================
  function drinkPotion() {
    // Can't drink if no potions or already at full health
    if (game.player.potions <= 0 || game.player.hp >= game.player.maxHp) {
      return;
    }
    // Use one potion and heal 45 HP (or to max)
    game.player.potions -= 1;
    game.player.hp = Math.min(game.player.maxHp, game.player.hp + 45);
    addLog("Potion consumed. Health restored.");
  }

  // ============================================
  // INTERACT - Handle E key for interacting with objects
  // ============================================
  function interact() {
    // Prevent rapid interaction (cooldown)
    if (game.interactionCooldown > 0) {
      return;
    }
    game.interactionCooldown = 0.25;

    // In town mode - check for portal or shop interaction
    if (game.mode === "town") {
      // Check if near portal (enter dungeon)
      if (game.player.position.distanceTo(game.world.portalZone) < 8) {
        enterDungeon();
        return;
      }
      // Check if near shop
      if (game.player.position.distanceTo(game.world.storeZone) < 5.6) {
        openStore();
      } else {
        addLog("Move into the blue ring to enter the shop.");
      }
      return;
    }

    // In dungeon mode - check for chests
    const chest = game.chests.find((entry) => !entry.opened && entry.mesh.position.distanceTo(game.player.position) < 2.2);
    if (chest) {
      openChest(chest);
      return;
    }

    // Check if near exit (after clearing dungeon)
    if (game.dungeonCleared && game.worldExit && game.worldExit.position.distanceTo(game.player.position) < 3.1) {
      completeFloor();
    }
  }

  // ============================================
  // OPEN STORE - Show the shop UI
  // ============================================
  function openStore() {
    game.storeOpen = true;
    game.paused = true;
    ui.storeModal.classList.remove("hidden");
    updatePauseMenu();
  }

  // ============================================
  // CLOSE STORE - Hide the shop UI
  // ============================================
  function closeStore() {
    game.storeOpen = false;
    game.paused = false;
    ui.storeModal.classList.add("hidden");
    updatePauseMenu();
  }

  // ============================================
  // OPEN CHEST - Collect rewards from chest
  // ============================================
  function openChest(chest) {
    chest.opened = true;
    chest.mesh.rotation.x = -0.35;  // Animate chest opening
    game.player.coins += chest.rewardCoins;
    game.player.potions += chest.rewardPotion;
    addLog(`Chest opened. +${chest.rewardCoins} coins${chest.rewardPotion ? " and a potion" : ""}.`);
    incrementQuest("collect");
  }

  // ============================================
  // COMPLETE FLOOR - Move to next dungeon level
  // ============================================
  function completeFloor() {
    addLog(`Floor ${game.dungeonLevel} cleared.`);
    incrementQuest("boss");
    showRewards();
  }

  // ============================================
  // SHOW REWARDS - Display upgrade choices after clearing floor
  // ============================================
  function showRewards() {
    game.paused = true;
    ui.rewardModal.classList.remove("hidden");
    ui.rewardChoices.innerHTML = "";

    // Define available rewards
    const rewards = [
      { label: "Sharpened Blade", detail: "+6 damage", apply: () => { game.player.damage += 6; } },
      { label: "Swift Boots", detail: "+0.9 speed", apply: () => { game.player.speed += 0.9; } },
      { label: "Greater Vitality", detail: "+30 max HP, heal 20", apply: () => { game.player.maxHp += 30; game.player.hp = Math.min(game.player.maxHp, game.player.hp + 20); } },
      { label: "Lucky Charm", detail: "+8% luck, +4% crit", apply: () => { game.player.luck += 0.08; game.player.critChance += 0.04; } }
    ];

    // Create buttons for each reward
    rewards.forEach((reward) => {
      const button = document.createElement("button");
      button.innerHTML = `${reward.label}<br><small>${reward.detail}</small>`;
      button.addEventListener("click", () => {
        reward.apply();  // Apply the reward
        ui.rewardModal.classList.add("hidden");
        game.paused = false;
        buildTown();     // Return to town
        addLog(`${reward.label} claimed.`);
      });
      ui.rewardChoices.appendChild(button);
    });
  }

  // ============================================
  // ATTEMPT PURCHASE - Buy items from the shop
  // ============================================
  function attemptPurchase(type) {
    // Must be in town and near shop
    if (game.mode !== "town" || game.player.position.distanceTo(game.world.storeZone) > 5.6) {
      addLog("Move into the blue store ring first.");
      return;
    }

    // Define available shop items
    const items = {
      potion: { cost: 20, apply: () => { game.player.potions += 1; addLog("Bought a potion."); } },
      power: { cost: 45, apply: () => { game.player.damage += 4; addLog("Bought a power-up. Damage increased."); } },
      vitality: { cost: 55, apply: () => { game.player.maxHp += 20; game.player.hp = Math.min(game.player.maxHp, game.player.hp + 20); addLog("Bought vitality. Max HP increased."); } }
    };

    const item = items[type];
    // Check if item exists and player can afford it
    if (!item || game.player.coins < item.cost) {
      addLog("Not enough coins.");
      return;
    }
    game.player.coins -= item.cost;
    item.apply();
  }

  // ============================================
  // HANDLE DEFEAT - Player died
  // ============================================
  function handleDefeat() {
    // Prevent multiple defeat triggers
    if (game.isGameOver) {
      return;
    }
    addLog("You lost the dungeon run. Click to continue.");
    
    // Set game over state
    game.isGameOver = true;
    game.paused = true;
    game.storeOpen = false;
    keys.mouse = false;
    game.player.hp = 0;
    
    // Release pointer lock
    if (document.exitPointerLock) {
      document.exitPointerLock();
    }
    
    // Show game over screen
    showGameOverScreen();
  }

  // ============================================
  // MAYBE LEVEL UP - Check and apply level ups
  // ============================================
  function maybeLevelUp() {
    // Calculate XP required for next level
    let required = game.player.level * 100;
    
    // Keep leveling up while enough XP
    while (game.player.xp >= required) {
      game.player.level += 1;
      game.player.xp -= required;
      
      // Award stat increases
      game.player.maxHp += 18;
      game.player.hp = Math.min(game.player.maxHp, game.player.hp + 20);
      game.player.damage += 4;
      
      addLog(`Level up! You are now level ${game.player.level}.`);
      required = game.player.level * 100;
    }
  }

  // ============================================
  // MAKE QUEST - Generate a new quest based on game mode
  // ============================================
  function makeQuest(mode) {
    // Town quest - enter the dungeon
    if (mode === "town") {
      return { kind: "travel", target: 1, progress: 0, text: "Step into the center portal and descend" };
    }
    // Dungeon quests - random selection
    const quests = [
      { kind: "kill", target: 4 + game.dungeonLevel, progress: 0, text: "Defeat monsters on this floor" },
      { kind: "collect", target: 2, progress: 0, text: "Loot treasure and collect potions" },
      { kind: "boss", target: 1, progress: 0, text: "Defeat the floor boss and escape alive" }
    ];
    return quests[Math.floor(Math.random() * quests.length)];
  }

  // ============================================
  // SET QUEST - Assign a quest to the player
  // ============================================
  function setQuest(quest) {
    game.quest = quest;
  }

  // ============================================
  // INCREMENT QUEST - Progress quest when objective completed
  // ============================================
  function incrementQuest(kind) {
    // Only increment if this quest tracks this kind of progress
    if (!game.quest || game.quest.kind !== kind) {
      return;
    }
    // Increment progress (capped at target)
    game.quest.progress = Math.min(game.quest.target, game.quest.progress + 1);
    // Check if quest is complete
    if (game.quest.progress >= game.quest.target) {
      rewardQuest();
    }
  }

  // ============================================
  // CHECK QUEST PROGRESS - Check for automatic progress
  // ============================================
  function checkQuestProgress() {
    // Check if player entered portal (town travel quest)
    if (game.mode === "town" && game.quest && game.quest.kind === "travel" && game.player.position.distanceTo(game.world.portalZone) < 8) {
      game.quest.progress = 1;
      rewardQuest();
    }
  }

  // ============================================
  // REWARD QUEST - Give rewards when quest completed
  // ============================================
  function rewardQuest() {
    addLog(`Quest completed: ${game.quest.text}. Reward +35 coins.`);
    game.player.coins += 35;
    // Generate new quest or clear if in town
    game.quest = game.mode === "town" ? null : makeQuest(game.mode);
  }

  // ============================================
  // IS WALKABLE - Check if a tile is walkable (not a wall)
  // ============================================
  function isWalkable(x, z) {
    const row = game.world.grid[z];
    return !!(row && row[x] === 0);  // 0 = floor (walkable), 1 = wall
  }

  // ============================================
  // CREATE GRID - Initialize empty dungeon grid
  // ============================================
  function createGrid(width, height, fillValue) {
    return Array.from({ length: height }, () => Array.from({ length: width }, () => fillValue));
  }

  // ============================================
  // CARVE ROOMS - Generate rooms in dungeon grid
  // ============================================
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

  function resetRunToClassSelection() {
    game.started = false;
    game.paused = false;
    game.storeOpen = false;
    game.dungeonLevel = 0;
    game.floorSeed = 2;
    game.dungeonCleared = false;
    game.transitionTimer = 0;
    game.interactionCooldown = 0;
    game.attackTimer = 0;
    game.dashTimer = 0;
    game.dashCooldown = 0;
    game.quest = null;
    game.stats.slainMonsters = 0;
    game.logs = [];
    game.player.maxHp = 100;
    game.player.hp = 100;
    game.player.damage = 18;
    game.player.speed = 6.6;
    game.player.coins = 0;
    game.player.potions = 2;
    game.player.critChance = 0.08;
    game.player.luck = 0.05;
    game.player.level = 1;
    game.player.xp = 0;
    game.player.velocity.set(0, 0, 0);
    game.player.isJumping = false;
    keys.mouse = false;
    if (document.exitPointerLock) {
      document.exitPointerLock();
    }
    ui.overlay.classList.remove("hidden");
    ui.storeModal.classList.add("hidden");
    ui.rewardModal.classList.add("hidden");
    ui.pauseMenu.classList.add("hidden");
    ui.log.innerHTML = "";
    buildTown();
    updateHud();
  }
})();
