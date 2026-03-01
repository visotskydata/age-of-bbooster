import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/shaders/FXAAShader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import * as CANNON from 'cannon-es';
import { dbSync, initRealtime, broadcastAttack, broadcastMobHit, broadcastPlayerHit, broadcastMove } from './core/db.js';

// ========== CONSTANTS ==========
const MAP = 3000;
const CAM_H = 350, CAM_DIST = 280;
const CLASS_SPEED = { warrior: 120, mage: 140, archer: 170 };
const CLASS_ATK_CD = { warrior: 450, mage: 900, archer: 650 };
const CLASS_DMG = { warrior: 20, mage: 28, archer: 16 };
const ARENA_MODE = true;
const PVP_MELEE_RANGE = 24;
const PVP_RANGED_RANGE = 14;
const PVP_RESPAWN_MS = 3500;
const PVP_RESPAWN_PROTECTION_MS = 2500;
const PVP_HIT_COOLDOWN_MS = 220;
const PVP_DMG_SCALE = 0.85;
const LOOK_SMOOTH_SPEED = 18;
const LOOK_SENSITIVITY = 0.0017;
const SYNC_INTERVAL_MS = 140;
const MOVE_BROADCAST_INTERVAL_MS = 55;
const REMOTE_POS_SMOOTH_SPEED = 10;
const REMOTE_ROT_SMOOTH_SPEED = 14;
const REMOTE_TELEPORT_DIST = 220;
const REMOTE_IDLE_SPEED = 25;
const REMOTE_PREDICT_MAX_SEC = 0.14;
const REMOTE_SPEED_FILTER = 10;
const TARGET_MODEL_HEIGHT = 20;
const CLASS_TINT_STRENGTH = 0.16;
const ARENA_CENTER = { x: 1500, z: 1500 };
const ARENA_DUST_RADIUS = 560;
const PLAYER_COLLIDER_RADIUS = 11;
const PLAYER_FOOT_CLEARANCE = 0.26;
const PREMIUM_MANIFEST_URL = 'assets/premium/manifest.json';
const CLASS_ACTIONS = {
    warrior: {
        melee: ['1h_melee_attack_slice_diagonal', '1h_melee_attack_chop', '1h_melee_attack_stab'],
    },
    mage: {
        cast: ['spellcast_shoot', 'spellcast_raise', 'spellcasting'],
    },
    archer: {
        cast: ['1h_ranged_shoot', '1h_ranged_shooting', 'throw'],
    },
};
const MODEL_SOURCES = {
    warrior: {
        urls: [
            'assets/models/warrior.glb',
            'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Soldier.glb',
            'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Xbot.glb',
        ],
    },
    mage: {
        urls: [
            'assets/models/mage.glb',
            'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Soldier.glb',
            'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Xbot.glb',
        ],
    },
    archer: {
        urls: [
            'assets/models/archer.glb',
            'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Soldier.glb',
            'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Xbot.glb',
        ],
    },
    skeleton: {
        urls: [
            'assets/models/skeleton.glb',
        ],
    },
};
const DEFAULT_MOB_MODEL_MAP = {
    skeleton: 'skeleton',
    darkmage: 'mage',
};
const ARENA_TEXTURES = {
    floorMap: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/hardwood2_diffuse.jpg',
    floorBump: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/hardwood2_bump.jpg',
    wallMap: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/brick_diffuse.jpg',
    wallBump: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/brick_bump.jpg',
    stoneMap: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/terrain/grasslight-big.jpg',
};
const ARENA_SPAWNS = [
    { x: ARENA_CENTER.x, z: ARENA_CENTER.z },
    { x: ARENA_CENTER.x - 150, z: ARENA_CENTER.z },
    { x: ARENA_CENTER.x + 150, z: ARENA_CENTER.z },
    { x: ARENA_CENTER.x, z: ARENA_CENTER.z - 150 },
    { x: ARENA_CENTER.x, z: ARENA_CENTER.z + 150 },
];
const ARENA_EXTRA_MOBS = [
    { id: 'arena_wolf_0', type: 'wolf', x: 980, z: 1460, hp: 45, atk: 13, spd: 70, xp: 28, range: 260 },
    { id: 'arena_wolf_1', type: 'wolf', x: 2050, z: 1480, hp: 45, atk: 13, spd: 70, xp: 28, range: 260 },
    { id: 'arena_skel_0', type: 'skeleton', x: 1520, z: 930, hp: 60, atk: 12, spd: 52, xp: 30, range: 240 },
    { id: 'arena_skel_1', type: 'skeleton', x: 1490, z: 2080, hp: 60, atk: 12, spd: 52, xp: 30, range: 240 },
    { id: 'arena_mage_0', type: 'darkmage', x: 1100, z: 2030, hp: 75, atk: 16, spd: 45, xp: 42, range: 280 },
    { id: 'arena_mage_1', type: 'darkmage', x: 1930, z: 980, hp: 75, atk: 16, spd: 45, xp: 42, range: 280 },
];

// ========== FIXED MOB POSITIONS ==========
const MOBS = [
    // Forest – Slimes
    ...[200, 200, 400, 180, 600, 350, 250, 500, 450, 650, 700, 500, 350, 800, 150, 700, 550, 150, 780, 300].reduce((a, v, i, arr) => { if (i % 2 === 0) a.push({ id: `slime_${i / 2}`, type: 'slime', x: arr[i], z: arr[i + 1], hp: 30, atk: 5, spd: 30, xp: 15, range: 150 }); return a; }, []),
    // Mountains – Skeletons
    ...[2200, 200, 2400, 350, 2600, 200, 2300, 500, 2500, 600, 2700, 400, 2800, 250, 2150, 650].reduce((a, v, i, arr) => { if (i % 2 === 0) a.push({ id: `skel_${i / 2}`, type: 'skeleton', x: arr[i], z: arr[i + 1], hp: 50, atk: 10, spd: 40, xp: 25, range: 200 }); return a; }, []),
    // Meadow – Wolves
    ...[200, 2200, 400, 2350, 600, 2500, 300, 2600, 500, 2750, 700, 2400, 150, 2500, 750, 2650].reduce((a, v, i, arr) => { if (i % 2 === 0) a.push({ id: `wolf_${i / 2}`, type: 'wolf', x: arr[i], z: arr[i + 1], hp: 35, atk: 12, spd: 60, xp: 20, range: 220 }); return a; }, []),
    // Lake – Dark Mages
    ...[2150, 2150, 2350, 2200, 2700, 2300, 2200, 2650, 2650, 2700].reduce((a, v, i, arr) => { if (i % 2 === 0) a.push({ id: `dmage_${i / 2}`, type: 'darkmage', x: arr[i], z: arr[i + 1], hp: 70, atk: 15, spd: 35, xp: 35, range: 250 }); return a; }, []),
    // Bosses
    { id: 'boss_dragon', type: 'dragon', x: 2500, z: 400, hp: 1000, atk: 30, spd: 50, xp: 500, range: 350, isBoss: true },
    { id: 'boss_kraken', type: 'kraken', x: 2500, z: 2500, hp: 800, atk: 25, spd: 30, xp: 400, range: 300, isBoss: true },
];

// ========== COLORS ==========
const ZONE_COLORS = { forest: 0x3d6b2e, mountains: 0x78706a, meadow: 0x7CB342, lake: 0x1565C0, village: 0x5a9e4b };
const MOB_COLORS = { slime: 0x4CAF50, skeleton: 0xE0E0E0, wolf: 0x757575, darkmage: 0x7B1FA2, dragon: 0xCC0000, kraken: 0x00838F };
const CLASS_COLORS = { warrior: 0xCC2222, mage: 0x2255CC, archer: 0x228B22 };

export class Game3D {
    constructor(container, user) {
        this.container = container;
        this.user = user;
        this.keys = {};
        this.mouse = new THREE.Vector2();
        this.mouseWorld = new THREE.Vector3();
        this.enemies = [];
        this.projectiles = [];
        this.others = {};
        this.remotePlayers = {};
        this.lastAtk = 0;
        this.lastSync = 0;
        this.respawnQ = [];
        this.combatMode = false;
        this.combatBlend = 0; // 0 = exploration, 1 = combat
        this.timeScale = 1.0;
        this.hitFreezeUntil = 0;
        this.lastSwingAngle = 0;
        this.ragdollParts = []; // Physics-driven debris from dead enemies
        this.mixers = []; // For animation mixers
        this.loadedModels = {}; // Cache of loaded model assets (GLTF/GLB/FBX)
        this.modelSources = JSON.parse(JSON.stringify(MODEL_SOURCES));
        this.classActions = JSON.parse(JSON.stringify(CLASS_ACTIONS));
        this.mobModelMap = { ...DEFAULT_MOB_MODEL_MAP };
        this.mobActionMap = {};
        this.premiumManifest = null;
        this.playerGroundOffset = 0;
        this.isDead = false;
        this.deadUntil = 0;
        this.spawnProtectedUntil = performance.now() + PVP_RESPAWN_PROTECTION_MS;
        this.remoteProtectedUntil = {};
        this.pvpLastHitSentAt = {};
        this.processedHitIds = new Set();
        this.processedHitOrder = [];
        this.syncInFlight = false;
        this.arenaTorches = [];
        this.arenaBanners = [];
        this.arenaColliders = [];
        this.mouseTurnDelta = 0;
        this.lookYaw = 0;
        this.lastMoveBroadcast = 0;
        this.localMoveSeq = 0;

        this._init();
        this._initPhysics();
        this._world();
        this._createParticles();
        this._createClouds();

        this._loadModels().then(() => {
            this._spawnPlayer();
            this._spawnEnemies();
            this._input();
            this._network();
            this._loop();
            console.log("Game started successfully!");
        }).catch(err => {
            console.error("Game Setup Error:", err);
            alert("Game Setup Error: " + err.message + "\n" + err.stack);
        });
    }

    async _loadModels() {
        const loaderUi = document.createElement('div');
        loaderUi.innerHTML = '<h2 style="color:white;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:\"Press Start 2P\", sans-serif;text-shadow: 2px 2px 0 #000;text-align:center;"><span style="font-size:32px">⚔️</span><br/><br/>LOADING 3D MODELS...</h2>';
        loaderUi.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(15,20,30,0.95);z-index:9999;transition: opacity 0.5s;';
        this.container.appendChild(loaderUi);

        await this._loadPremiumManifest();

        const gltfLoader = new GLTFLoader();
        const fbxLoader = new FBXLoader();
        for (const [cls, cfg] of Object.entries(this.modelSources)) {
            let asset = null;
            let loadedFromUrl = null;
            for (const url of cfg.urls) {
                try {
                    asset = await this._loadModelAsset(url, gltfLoader, fbxLoader);
                    loadedFromUrl = url;
                    break;
                } catch (err) {
                    console.warn(`Model source failed for ${cls}: ${url}`, err?.message || err);
                }
            }

            if (!asset?.scene) {
                console.error('Failed to load model for class:', cls);
                continue;
            }

            this.loadedModels[cls] = {
                asset,
                scale: this._computeModelScale(asset.scene, cfg.targetHeight || TARGET_MODEL_HEIGHT),
                yawOffset: typeof cfg.yawOffset === 'number'
                    ? cfg.yawOffset
                    : this._defaultModelYawOffset(cls, loadedFromUrl),
            };
        }

        loaderUi.style.opacity = '0';
        setTimeout(() => this.container.removeChild(loaderUi), 500);
    }

    _computeModelScale(scene, targetHeight = TARGET_MODEL_HEIGHT) {
        if (!scene) return 1;
        scene.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(scene);
        const h = Math.max(0.001, box.max.y - box.min.y);
        return targetHeight / h;
    }

    async _loadModelAsset(url, gltfLoader, fbxLoader) {
        const cleanUrl = String(url || '').split('?')[0].toLowerCase();
        if (cleanUrl.endsWith('.fbx')) {
            const scene = await fbxLoader.loadAsync(url);
            return {
                scene,
                animations: Array.isArray(scene?.animations) ? scene.animations : [],
            };
        }

        const gltf = await gltfLoader.loadAsync(url);
        return {
            scene: gltf.scene,
            animations: Array.isArray(gltf?.animations) ? gltf.animations : [],
        };
    }

    _defaultModelYawOffset(cls, loadedFromUrl) {
        const source = (loadedFromUrl || '').toLowerCase();
        // Keep default orientation unless explicitly configured per model.
        if (source.includes('xbot.glb') || source.includes('soldier.glb')) return 0;
        return 0;
    }

    async _loadPremiumManifest() {
        try {
            const response = await fetch(PREMIUM_MANIFEST_URL, { cache: 'no-store' });
            if (!response.ok) return;

            const manifest = await response.json();
            this.premiumManifest = manifest;

            if (manifest?.models && typeof manifest.models === 'object') {
                Object.entries(manifest.models).forEach(([key, cfg]) => {
                    if (!cfg || !Array.isArray(cfg.urls) || !cfg.urls.length) return;
                    const base = this.modelSources[key] || { urls: [] };
                    const mergedUrls = [...cfg.urls, ...(base.urls || [])].filter(Boolean);
                    const uniqueUrls = [...new Set(mergedUrls)];
                    this.modelSources[key] = {
                        ...base,
                        ...cfg,
                        urls: uniqueUrls,
                    };
                });
            }

            if (manifest?.classActions && typeof manifest.classActions === 'object') {
                Object.entries(manifest.classActions).forEach(([cls, cfg]) => {
                    if (!cfg || typeof cfg !== 'object') return;
                    const prev = this.classActions[cls] || {};
                    this.classActions[cls] = { ...prev, ...cfg };
                });
            }

            if (manifest?.mobModelMap && typeof manifest.mobModelMap === 'object') {
                this.mobModelMap = { ...this.mobModelMap, ...manifest.mobModelMap };
            }

            if (manifest?.mobActions && typeof manifest.mobActions === 'object') {
                this.mobActionMap = { ...manifest.mobActions };
            }
        } catch (err) {
            console.warn('Premium manifest is not available or invalid:', err?.message || err);
        }
    }

    // =================== ENGINE ===================
    _init() {
        const w = window.innerWidth || 1024;
        const h = window.innerHeight || 768;
        this.scene = new THREE.Scene();

        // Gradient sky
        const skyCanvas = document.createElement('canvas');
        skyCanvas.width = 1; skyCanvas.height = 256;
        const skyCtx = skyCanvas.getContext('2d');
        const grad = skyCtx.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, '#1a2a6c');
        grad.addColorStop(0.3, '#4a8ecc');
        grad.addColorStop(0.6, '#87CEEB');
        grad.addColorStop(0.85, '#b4e0fa');
        grad.addColorStop(1, '#e8d5a3');
        skyCtx.fillStyle = grad;
        skyCtx.fillRect(0, 0, 1, 256);
        const skyTex = new THREE.CanvasTexture(skyCanvas);
        skyTex.mapping = THREE.EquirectangularReflectionMapping;
        this.scene.background = skyTex;
        this.scene.fog = new THREE.FogExp2(0x9ec5e8, 0.00035);

        this.camera = new THREE.PerspectiveCamera(50, w / h, 1, 5000);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.physicallyCorrectLights = true;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        this.container.appendChild(this.renderer.domElement);

        // Post-processing
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.4, 0.6, 0.85);
        this.composer.addPass(bloom);
        const fxaa = new ShaderPass(FXAAShader);
        fxaa.material.uniforms['resolution'].value.set(1 / w, 1 / h);
        this.composer.addPass(fxaa);
        this.fxaaPass = fxaa;

        // Lights
        const amb = new THREE.AmbientLight(0x8899bb, 0.7);
        this.scene.add(amb);

        this.sun = new THREE.DirectionalLight(0xffeedd, 1.4);
        this.sun.position.set(500, 600, 300);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(2048, 2048);
        this.sun.shadow.camera.left = -800;
        this.sun.shadow.camera.right = 800;
        this.sun.shadow.camera.top = 800;
        this.sun.shadow.camera.bottom = -800;
        this.sun.shadow.camera.far = 2000;
        this.sun.shadow.bias = -0.001;
        this.scene.add(this.sun);
        this.scene.add(this.sun.target);

        // Hemisphere light for naturalistic sky
        this.scene.add(new THREE.HemisphereLight(0x88bbff, 0x445522, 0.5));

        // Rim light for contrast
        const rimLight = new THREE.DirectionalLight(0x88aaff, 0.3);
        rimLight.position.set(-300, 200, -400);
        this.scene.add(rimLight);

        this.clock = new THREE.Clock();
        this.raycaster = new THREE.Raycaster();
        this.shakeOffset = new THREE.Vector3();
        this.shakeIntensity = 0;

        window.addEventListener('resize', () => {
            const w = this.container.clientWidth, h = this.container.clientHeight;
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(w, h);
            this.composer.setSize(w, h);
            this.fxaaPass.material.uniforms['resolution'].value.set(1 / w, 1 / h);
        });
    }

    // =================== PHYSICS (Cannon.js) ===================
    _initPhysics() {
        this.physicsWorld = new CANNON.World({
            gravity: new CANNON.Vec3(0, -60, 0)
        });
        this.physicsWorld.broadphase = new CANNON.NaiveBroadphase();
        this.physicsWorld.solver.iterations = 5;
        this.physicsWorld.allowSleep = true;

        // Ground plane
        const groundBody = new CANNON.Body({
            mass: 0,
            shape: new CANNON.Plane(),
            material: new CANNON.Material({ friction: 0.5, restitution: 0.3 })
        });
        groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.physicsWorld.addBody(groundBody);

        // Physics material for ragdoll parts
        this.ragdollMaterial = new CANNON.Material({ friction: 0.4, restitution: 0.5 });
    }

    _createRagdoll(enemy, hitAngle, swingDir) {
        const pos = enemy.model.position.clone();
        const parts = [];
        const partDefs = [
            { name: 'torso', geo: new THREE.CylinderGeometry(3, 2.5, 8, 6), color: enemy.model.children[0]?.material?.color?.getHex() || 0x888888, mass: 5, size: [3, 4, 3], y: 8 },
            { name: 'head', geo: new THREE.SphereGeometry(2.5, 6, 6), color: 0xFFD5B0, mass: 2, size: [2.5], y: 16 },
            { name: 'arm_l', geo: new THREE.CylinderGeometry(1, 0.8, 6, 4), color: 0xFFD5B0, mass: 1, size: [1, 3, 1], y: 10 },
            { name: 'arm_r', geo: new THREE.CylinderGeometry(1, 0.8, 6, 4), color: 0xFFD5B0, mass: 1, size: [1, 3, 1], y: 10 },
            { name: 'leg_l', geo: new THREE.CylinderGeometry(1.1, 0.9, 7, 4), color: 0x3E2723, mass: 1.5, size: [1.1, 3.5, 1.1], y: 3 },
            { name: 'leg_r', geo: new THREE.CylinderGeometry(1.1, 0.9, 7, 4), color: 0x3E2723, mass: 1.5, size: [1.1, 3.5, 1.1], y: 3 },
        ];

        // Scale for bosses
        const scale = enemy.def.isBoss ? 2 : 1;

        // Hit impulse direction based on swing
        const impulseForce = enemy.def.isBoss ? 80 : 40;
        const upForce = swingDir === 'overhead' ? impulseForce * 1.5 : impulseForce * 0.5;

        partDefs.forEach((def, i) => {
            const mat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.7 });
            const mesh = new THREE.Mesh(def.geo, mat);
            mesh.scale.setScalar(scale);
            mesh.position.set(
                pos.x + (Math.random() - 0.5) * 3,
                def.y * scale,
                pos.z + (Math.random() - 0.5) * 3
            );
            mesh.castShadow = true;
            this.scene.add(mesh);

            // Cannon body
            let shape;
            if (def.name === 'head') {
                shape = new CANNON.Sphere(def.size[0] * scale);
            } else {
                shape = new CANNON.Box(new CANNON.Vec3(
                    (def.size[0] || 1) * scale,
                    (def.size[1] || 1) * scale,
                    (def.size[2] || 1) * scale
                ));
            }

            const body = new CANNON.Body({
                mass: def.mass,
                shape,
                material: this.ragdollMaterial,
                position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z),
                linearDamping: 0.3,
                angularDamping: 0.3
            });

            // Apply impulse from hit direction
            const spreadX = (Math.random() - 0.5) * 20;
            const spreadZ = (Math.random() - 0.5) * 20;
            body.applyImpulse(
                new CANNON.Vec3(
                    Math.sin(hitAngle) * impulseForce + spreadX,
                    upForce + Math.random() * 20,
                    Math.cos(hitAngle) * impulseForce + spreadZ
                )
            );
            // Random spin
            body.angularVelocity.set(
                (Math.random() - 0.5) * 15,
                (Math.random() - 0.5) * 15,
                (Math.random() - 0.5) * 15
            );

            this.physicsWorld.addBody(body);
            parts.push({ mesh, body, born: performance.now() });
        });

        this.ragdollParts.push(...parts);
    }

    _updatePhysics(dt) {
        // Step physics world
        this.physicsWorld.step(1 / 60, dt, 3);

        // Sync ragdoll meshes with physics bodies
        for (let i = this.ragdollParts.length - 1; i >= 0; i--) {
            const part = this.ragdollParts[i];
            const age = (performance.now() - part.born) / 1000;

            // Sync position and rotation
            part.mesh.position.copy(part.body.position);
            part.mesh.quaternion.copy(part.body.quaternion);

            // Fade out after 3 seconds
            if (age > 3) {
                part.mesh.material.transparent = true;
                part.mesh.material.opacity = Math.max(0, 1 - (age - 3) / 2);
            }

            // Remove after 5 seconds
            if (age > 5) {
                this.scene.remove(part.mesh);
                this.physicsWorld.removeBody(part.body);
                part.mesh.geometry.dispose();
                part.mesh.material.dispose();
                this.ragdollParts.splice(i, 1);
            }
        }
    }

    _getTerrainHeight(x, z) {
        let h = Math.sin(x * 0.008) * 3 + Math.cos(z * 0.008) * 3;
        if (x > 2000 && z < 900) h += Math.sin(x * 0.02) * 8 + Math.cos(z * 0.015) * 6; // mountains
        if (Math.hypot(x - 2500, z - 2500) < 350) h -= 3; // lake depression
        if (ARENA_MODE) {
            const d = Math.hypot(x - ARENA_CENTER.x, z - ARENA_CENTER.z);
            if (d < 640) {
                const t = 1 - d / 640;
                h = h * (1 - t) + (-0.4) * t;
            }
        }
        return h;
    }

    _getArenaFloorHeight(x, z) {
        if (!ARENA_MODE) return -Infinity;
        const d = Math.hypot(x - ARENA_CENTER.x, z - ARENA_CENTER.z);
        if (d <= 420) return 0.82;
        if (d <= 560) return 0.42;
        return -Infinity;
    }

    _resolveArenaCollision(x, z, radius = PLAYER_COLLIDER_RADIUS) {
        if (!this.arenaColliders?.length) return { x, z };
        let nx = x;
        let nz = z;

        for (let iter = 0; iter < 3; iter++) {
            for (const collider of this.arenaColliders) {
                const dx = nx - collider.x;
                const dz = nz - collider.z;
                const dist = Math.hypot(dx, dz) || 0.0001;
                const minDist = (collider.r || 0) + radius;
                if (dist >= minDist) continue;

                const push = minDist - dist + 0.001;
                nx += (dx / dist) * push;
                nz += (dz / dist) * push;
            }
        }

        return { x: nx, z: nz };
    }

    _addArenaCircleCollider(x, z, r) {
        this.arenaColliders.push({ x, z, r });
    }

    // =================== WORLD ===================
    _world() {
        this.arenaColliders = [];
        // Ground with vertex colors for zone blending
        const groundGeo = new THREE.PlaneGeometry(MAP, MAP, 128, 128);
        groundGeo.rotateX(-Math.PI / 2);
        const pos = groundGeo.attributes.position;
        const colors = new Float32Array(pos.count * 3);
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i) + MAP / 2, z = pos.getZ(i) + MAP / 2;
            // Height variation by zone
            let h = this._getTerrainHeight(x, z);
            pos.setY(i, h);
            // Vertex colors for zone blending
            let r = 0.30, g = 0.55, b = 0.25; // default green
            if (ARENA_MODE) {
                const d = Math.hypot(x - ARENA_CENTER.x, z - ARENA_CENTER.z);
                const t = Math.min(1, d / (MAP * 0.72));
                r = 0.53 * (1 - t) + 0.34 * t;
                g = 0.48 * (1 - t) + 0.33 * t;
                b = 0.41 * (1 - t) + 0.29 * t;
                const ring = Math.max(0, 1 - Math.abs(d - 470) / 180);
                r += ring * 0.05;
                g += ring * 0.045;
                b += ring * 0.03;
            } else {
                if (x < 900 && z < 900) { r = 0.18; g = 0.42; b = 0.13; } // forest - dark green
                else if (x > 2000 && z < 900) { r = 0.47; g = 0.44; b = 0.41; } // mountains - grey-brown
                else if (x < 900 && z > 2000) { r = 0.42; g = 0.68; b = 0.22; } // meadow - bright green
                else if (x > 1200 && x < 1800 && z > 1200 && z < 1800) { r = 0.35; g = 0.60; b = 0.30; } // village
                const d = Math.hypot(x - 2500, z - 2500);
                if (d < 400) { const t = Math.max(0, 1 - d / 400); r = r * (1 - t) + 0.15 * t; g = g * (1 - t) + 0.35 * t; b = b * (1 - t) + 0.45 * t; } // lake shore blend
            }
            colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
        }
        groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        groundGeo.computeVertexNormals();
        const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.0 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.position.set(MAP / 2, 0, MAP / 2);
        ground.receiveShadow = true;
        this.scene.add(ground);
        this.ground = ground;

        if (ARENA_MODE) {
            this._buildArena();
            this._buildArenaOutskirts();
            return;
        }

        // Water (lake) — animated
        const waterGeo = new THREE.CircleGeometry(250, 48);
        waterGeo.rotateX(-Math.PI / 2);
        const waterMat = new THREE.MeshPhysicalMaterial({
            color: 0x1976D2, transparent: true, opacity: 0.6,
            roughness: 0.1, metalness: 0.1, transmission: 0.5,
            thickness: 2, envMapIntensity: 1.5
        });
        const water = new THREE.Mesh(waterGeo, waterMat);
        water.position.set(2500, 0.5, 2500);
        water.receiveShadow = true;
        this.scene.add(water);
        this.water = water;

        // Paths
        this._path([900, 1500, 2100, 1500], 30, 0x8B7355);
        this._path([1500, 900, 1500, 2100], 30, 0x8B7355);
        this._path([1200, 1300, 800, 900, 500, 600], 20, 0x8B7355);
        this._path([1800, 1300, 2200, 800, 2500, 450], 20, 0x8B7355);
        this._path([1800, 1700, 2200, 2100, 2500, 2350], 20, 0x8B7355);
        this._path([1200, 1700, 800, 2100, 500, 2500], 20, 0x8B7355);

        // Trees
        this._scatterTrees(100, 850, 100, 850, 30, 0x2E7D32, 'pine');
        this._scatterTrees(2100, 2800, 150, 750, 12, 0x2E7D32, 'pine');
        this._scatterTrees(150, 800, 2150, 2800, 8, 0x558B2F, 'oak');
        // Village oaks
        [[1300, 1300], [1700, 1300], [1300, 1700], [1700, 1700], [1100, 1500], [1900, 1500]].forEach(([x, z]) => this._tree(x, z, 'oak', 0x4CAF50));

        // Rocks
        this._scatterRocks(2100, 2850, 120, 700, 18);
        this._scatterRocks(100, 800, 100, 800, 6);

        // Village buildings
        [[1350, 1420], [1650, 1420], [1350, 1600], [1650, 1600]].forEach(([x, z]) => this._building(x, z));

        // Well
        this._well(1500, 1500);

        // Village square
        const sq = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x8a8a7a, roughness: 0.9 }));
        sq.rotation.x = -Math.PI / 2; sq.position.set(1500, 0.3, 1500); sq.receiveShadow = true;
        this.scene.add(sq);
    }

    _buildArena() {
        const cx = ARENA_CENTER.x, cz = ARENA_CENTER.z;
        this.arenaTorches = [];
        this.arenaBanners = [];
        this.arenaColliders = [];
        const textureLoader = new THREE.TextureLoader();
        const anisotropy = this.renderer?.capabilities?.getMaxAnisotropy?.() || 1;
        const floorMap = this._loadTiledTexture(textureLoader, ARENA_TEXTURES.floorMap, 28, 28, true, anisotropy);
        const floorBump = this._loadTiledTexture(textureLoader, ARENA_TEXTURES.floorBump, 28, 28, false, anisotropy);
        const wallMap = this._loadTiledTexture(textureLoader, ARENA_TEXTURES.wallMap, 22, 2, true, anisotropy);
        const wallBump = this._loadTiledTexture(textureLoader, ARENA_TEXTURES.wallBump, 22, 2, false, anisotropy);
        const stoneMap = this._loadTiledTexture(textureLoader, ARENA_TEXTURES.stoneMap, 22, 22, true, anisotropy);

        // Raised stone base around arena
        const base = new THREE.Mesh(
            new THREE.CircleGeometry(560, 96),
            new THREE.MeshStandardMaterial({
                map: stoneMap,
                color: 0xc8c2b6,
                roughness: 0.92,
                metalness: 0.02,
            })
        );
        base.rotation.x = -Math.PI / 2;
        base.position.set(cx, 0.35, cz);
        base.receiveShadow = true;
        this.scene.add(base);

        // Arena floor
        const floor = new THREE.Mesh(
            new THREE.CircleGeometry(420, 96),
            new THREE.MeshStandardMaterial({
                map: floorMap,
                bumpMap: floorBump,
                bumpScale: 0.75,
                color: 0xbcb7ae,
                roughness: 0.78,
                metalness: 0.05,
            })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(cx, 0.75, cz);
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Concentric stepped stands (readability + silhouette from distance)
        for (let i = 0; i < 3; i++) {
            const innerR = 438 + i * 34;
            const outerR = innerR + 30;
            const y = 1.4 + i * 3.8;

            const stepTop = new THREE.Mesh(
                new THREE.RingGeometry(innerR, outerR, 72),
                new THREE.MeshStandardMaterial({
                    map: stoneMap,
                    color: 0xbdb6aa,
                    roughness: 0.9,
                    metalness: 0.03,
                    side: THREE.DoubleSide,
                })
            );
            stepTop.rotation.x = -Math.PI / 2;
            stepTop.position.set(cx, y, cz);
            stepTop.receiveShadow = true;
            this.scene.add(stepTop);

            const riser = new THREE.Mesh(
                new THREE.CylinderGeometry(outerR, outerR, 3.8, 72, 1, true),
                new THREE.MeshStandardMaterial({
                    map: wallMap,
                    bumpMap: wallBump,
                    bumpScale: 0.35,
                    color: 0xcfc8bc,
                    roughness: 0.9,
                    metalness: 0.03,
                    side: THREE.DoubleSide,
                })
            );
            riser.position.set(cx, y - 1.9, cz);
            riser.receiveShadow = true;
            this.scene.add(riser);
        }

        // Ring border
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(430, 8, 18, 96),
            new THREE.MeshStandardMaterial({ color: 0x5c5248, roughness: 0.86, metalness: 0.04 })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.set(cx, 1.6, cz);
        ring.receiveShadow = true;
        this.scene.add(ring);
        for (let i = 0; i < 40; i++) {
            const a = (i / 40) * Math.PI * 2;
            const gatePhase = Math.atan2(Math.sin(a * 2), Math.cos(a * 2));
            if (Math.abs(gatePhase) < 0.19) continue;
            this._addArenaCircleCollider(cx + Math.cos(a) * 430, cz + Math.sin(a) * 430, 13);
        }

        // Arena wall with gate openings to keep arena visually open.
        const wallSegmentMaterial = new THREE.MeshStandardMaterial({
            map: wallMap,
            bumpMap: wallBump,
            bumpScale: 0.7,
            color: 0xd1ccc2,
            roughness: 0.88,
            metalness: 0.03,
        });
        const wallRadius = 470;
        const segmentCount = 32;
        const gateHalfWidth = 0.20;

        for (let i = 0; i < segmentCount; i++) {
            const a = (i / segmentCount) * Math.PI * 2;
            const gatePhase = Math.atan2(Math.sin(a * 2), Math.cos(a * 2));
            if (Math.abs(gatePhase) < gateHalfWidth) continue;

            const seg = new THREE.Mesh(
                new THREE.BoxGeometry(52, 30, 10),
                wallSegmentMaterial
            );
            seg.position.set(cx + Math.cos(a) * wallRadius, 16, cz + Math.sin(a) * wallRadius);
            seg.rotation.y = -a;
            seg.castShadow = true;
            seg.receiveShadow = true;
            this.scene.add(seg);
            this._addArenaCircleCollider(seg.position.x, seg.position.z, 18);
        }

        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2;
            const gate = new THREE.Mesh(
                new THREE.BoxGeometry(108, 16, 8),
                new THREE.MeshStandardMaterial({ color: 0x978a79, roughness: 0.88, metalness: 0.04 })
            );
            gate.position.set(cx + Math.cos(a) * wallRadius, 34, cz + Math.sin(a) * wallRadius);
            gate.rotation.y = -a;
            gate.castShadow = true;
            gate.receiveShadow = true;
            this.scene.add(gate);
        }

        // Columns
        for (let i = 0; i < 20; i++) {
            const a = (i / 20) * Math.PI * 2;
            const gatePhase = Math.atan2(Math.sin(a * 2), Math.cos(a * 2));
            if (Math.abs(gatePhase) < 0.17) continue;
            const x = cx + Math.cos(a) * 452;
            const z = cz + Math.sin(a) * 452;
            const col = new THREE.Mesh(
                new THREE.CylinderGeometry(6, 7, 34, 10),
                new THREE.MeshStandardMaterial({
                    map: wallMap,
                    bumpMap: wallBump,
                    bumpScale: 0.45,
                    color: 0xe0dbd2,
                    roughness: 0.86,
                    metalness: 0.03,
                })
            );
            col.position.set(x, 17, z);
            col.castShadow = true;
            col.receiveShadow = true;
            this.scene.add(col);
            this._addArenaCircleCollider(x, z, 8);

            const cap = new THREE.Mesh(
                new THREE.CylinderGeometry(8.8, 8.8, 2.2, 12),
                new THREE.MeshStandardMaterial({ color: 0x989188, roughness: 0.86, metalness: 0.03 })
            );
            cap.position.set(x, 34.4, z);
            cap.castShadow = true;
            cap.receiveShadow = true;
            this.scene.add(cap);

            if (i % 2 === 0) {
                const banner = new THREE.Mesh(
                    new THREE.PlaneGeometry(18, 26),
                    new THREE.MeshStandardMaterial({
                        color: i % 4 === 0 ? 0xb73a3a : 0x2e4ea8,
                        roughness: 0.84,
                        metalness: 0.05,
                        side: THREE.DoubleSide,
                    })
                );
                banner.position.set(
                    cx + Math.cos(a) * 444,
                    23,
                    cz + Math.sin(a) * 444
                );
                banner.rotation.y = -a + Math.PI * 0.5;
                banner.castShadow = true;
                banner.userData.bannerPhase = Math.random() * Math.PI * 2;
                banner.userData.baseX = banner.position.x;
                banner.userData.baseY = banner.position.y;
                banner.userData.baseZ = banner.position.z;
                banner.userData.baseRotY = banner.rotation.y;
                this.scene.add(banner);
                this.arenaBanners.push(banner);
            }
        }

        // Center marking
        const crestOuter = new THREE.Mesh(
            new THREE.TorusGeometry(92, 2.6, 12, 72),
            new THREE.MeshStandardMaterial({
                color: 0xdcc08d,
                roughness: 0.55,
                metalness: 0.42,
                emissive: 0x2d1d08,
                emissiveIntensity: 0.2,
            })
        );
        crestOuter.rotation.x = Math.PI / 2;
        crestOuter.position.set(cx, 1.1, cz);
        this.scene.add(crestOuter);

        const crestCore = new THREE.Mesh(
            new THREE.CircleGeometry(74, 56),
            new THREE.MeshStandardMaterial({
                map: stoneMap,
                color: 0xae9e88,
                roughness: 0.9,
                metalness: 0.05,
            })
        );
        crestCore.rotation.x = -Math.PI / 2;
        crestCore.position.set(cx, 0.95, cz);
        crestCore.receiveShadow = true;
        this.scene.add(crestCore);

        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI;
            const line = new THREE.Mesh(
                new THREE.BoxGeometry(146, 0.45, 2.1),
                new THREE.MeshStandardMaterial({ color: 0x6f6253, roughness: 0.92, metalness: 0.03 })
            );
            line.position.set(cx, 1.12, cz);
            line.rotation.y = a;
            line.receiveShadow = true;
            this.scene.add(line);
        }

        // Torches with dynamic flicker
        for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            const x = cx + Math.cos(a) * 360;
            const z = cz + Math.sin(a) * 360;

            const pole = new THREE.Mesh(
                new THREE.CylinderGeometry(1.2, 1.2, 16, 8),
                new THREE.MeshStandardMaterial({ color: 0x4f4338, roughness: 0.72, metalness: 0.32 })
            );
            pole.position.set(x, 9, z);
            pole.castShadow = true;
            pole.receiveShadow = true;
            this.scene.add(pole);

            const bowl = new THREE.Mesh(
                new THREE.CylinderGeometry(3.2, 2.4, 1.8, 10),
                new THREE.MeshStandardMaterial({ color: 0x3b332b, roughness: 0.6, metalness: 0.45 })
            );
            bowl.position.set(x, 17.3, z);
            bowl.castShadow = true;
            this.scene.add(bowl);

            const flameMesh = new THREE.Mesh(
                new THREE.SphereGeometry(2.4, 7, 7),
                new THREE.MeshStandardMaterial({
                    color: 0xffc86f,
                    emissive: 0xff8f1f,
                    emissiveIntensity: 1.7,
                    roughness: 0.45,
                    metalness: 0.0,
                })
            );
            flameMesh.position.set(x, 20.4, z);
            this.scene.add(flameMesh);

            const flame = new THREE.PointLight(0xffb76a, 1.25, 160, 2);
            flame.position.set(x, 20.2, z);
            this.scene.add(flame);

            this.arenaTorches.push({
                light: flame,
                flame: flameMesh,
                phase: Math.random() * Math.PI * 2,
                baseIntensity: 1.25,
            });
            this._addArenaCircleCollider(x, z, 9);
        }
    }

    _buildArenaOutskirts() {
        this._path([ARENA_CENTER.x - 430, ARENA_CENTER.z, 260, ARENA_CENTER.z], 28, 0x8B7355);
        this._path([ARENA_CENTER.x + 430, ARENA_CENTER.z, 2740, ARENA_CENTER.z], 28, 0x8B7355);
        this._path([ARENA_CENTER.x, ARENA_CENTER.z - 430, ARENA_CENTER.x, 260], 28, 0x8B7355);
        this._path([ARENA_CENTER.x, ARENA_CENTER.z + 430, ARENA_CENTER.x, 2740], 28, 0x8B7355);

        this._zoneOverlay(500, 500, 700, 600, 0x2f632a, 0.14);
        this._zoneOverlay(2500, 500, 680, 560, 0x355c2d, 0.13);
        this._zoneOverlay(500, 2480, 720, 640, 0x467430, 0.12);
        this._zoneOverlay(2500, 2450, 700, 620, 0x3b6b31, 0.12);

        this._scatterTrees(120, 2860, 120, 2860, 230, 0x2f6f31, 'pine');
        this._scatterTrees(120, 2860, 120, 2860, 110, 0x4b8a39, 'oak');
        this._scatterRocks(120, 2860, 120, 2860, 95);

        [[420, 1460], [2580, 1520], [1500, 380], [1500, 2630], [760, 760], [2220, 2240]].forEach(([x, z]) => this._building(x, z));

        for (let i = 0; i < 34; i++) {
            const a = (i / 34) * Math.PI * 2;
            const r = 1320 + Math.random() * 260;
            const x = ARENA_CENTER.x + Math.cos(a) * r;
            const z = ARENA_CENTER.z + Math.sin(a) * r;
            const h = 80 + Math.random() * 170;
            const ridgeRadius = 80 + Math.random() * 110;
            const ridge = new THREE.Mesh(
                new THREE.ConeGeometry(ridgeRadius, h, 8),
                new THREE.MeshStandardMaterial({ color: 0x6d675f, roughness: 0.94, metalness: 0.02 })
            );
            const rx = Math.max(80, Math.min(MAP - 80, x));
            const rz = Math.max(80, Math.min(MAP - 80, z));
            ridge.position.set(rx, (h * 0.5) - 4, rz);
            ridge.castShadow = true;
            ridge.receiveShadow = true;
            this.scene.add(ridge);
            this._addArenaCircleCollider(rx, rz, ridgeRadius * 0.7);
        }
    }

    _loadTiledTexture(loader, url, repeatX, repeatY, srgb = true, anisotropy = 1) {
        const texture = loader.load(url);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(repeatX, repeatY);
        texture.anisotropy = anisotropy;
        if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    }

    _zoneOverlay(cx, cz, w, h, color, opacity) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.9 }));
        m.rotation.x = -Math.PI / 2; m.position.set(cx, 0.2, cz); this.scene.add(m);
    }

    _path(coords, width, color) {
        const points = [];
        for (let i = 0; i < coords.length; i += 2) points.push(new THREE.Vector3(coords[i], 0.3, coords[i + 1]));
        if (points.length < 2) return;
        for (let i = 0; i < points.length - 1; i++) {
            const a = points[i], b = points[i + 1];
            const len = a.distanceTo(b);
            const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
            const angle = Math.atan2(b.z - a.z, b.x - a.x);
            const m = new THREE.Mesh(new THREE.PlaneGeometry(len, width), new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 }));
            m.rotation.x = -Math.PI / 2; m.rotation.z = -angle;
            m.position.copy(mid); m.position.y = 0.25;
            this.scene.add(m);
        }
    }

    _tree(x, z, type, color) {
        const g = new THREE.Group();
        // Trunk
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(2, 3, 20, 6), new THREE.MeshStandardMaterial({ color: 0x5D4037, roughness: 0.9 }));
        trunk.position.y = 10; trunk.castShadow = true; g.add(trunk);

        if (type === 'pine') {
            for (let i = 0; i < 3; i++) {
                const r = 14 - i * 3, h = 12 - i * 2;
                const leaf = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
                leaf.position.y = 18 + i * 8; leaf.castShadow = true; g.add(leaf);
                leaf.userData.foliage = true;
            }
        } else {
            const crown = new THREE.Mesh(new THREE.SphereGeometry(16, 8, 6), new THREE.MeshStandardMaterial({ color, roughness: 0.75 }));
            crown.position.y = 32; crown.castShadow = true; g.add(crown);
            crown.userData.foliage = true;
        }
        g.position.set(x, 0, z);
        this.scene.add(g);
        this._addArenaCircleCollider(x, z, type === 'pine' ? 8 : 10);
    }

    _scatterTrees(xMin, xMax, zMin, zMax, count, color, type) {
        for (let i = 0; i < count; i++) {
            const x = xMin + Math.random() * (xMax - xMin);
            const z = zMin + Math.random() * (zMax - zMin);
            if (x > 1300 && x < 1700 && z > 1300 && z < 1700) continue;
            if (Math.hypot(x - 2500, z - 2500) < 280) continue;
            if (ARENA_MODE && Math.hypot(x - ARENA_CENTER.x, z - ARENA_CENTER.z) < 690) continue;
            this._tree(x, z, type, color);
        }
    }

    _scatterRocks(xMin, xMax, zMin, zMax, count) {
        for (let i = 0; i < count; i++) {
            const x = xMin + Math.random() * (xMax - xMin);
            const z = zMin + Math.random() * (zMax - zMin);
            if (ARENA_MODE && Math.hypot(x - ARENA_CENTER.x, z - ARENA_CENTER.z) < 690) continue;
            const s = 4 + Math.random() * 8;
            const rock = new THREE.Mesh(
                new THREE.DodecahedronGeometry(s, 0),
                new THREE.MeshStandardMaterial({ color: 0x757575, roughness: 0.75, metalness: 0.05 })
            );
            rock.position.set(x, s * 0.5, z);
            rock.rotation.set(Math.random(), Math.random(), Math.random());
            rock.castShadow = true;
            this.scene.add(rock);
            this._addArenaCircleCollider(x, z, Math.max(3, s * 0.75));
        }
    }

    _building(x, z) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(40, 25, 30), new THREE.MeshStandardMaterial({ color: 0x8D6E63, roughness: 0.85 }));
        body.position.y = 12.5; body.castShadow = true; g.add(body);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(30, 15, 4), new THREE.MeshStandardMaterial({ color: 0x5D4037, roughness: 0.9 }));
        roof.position.y = 32; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof);
        // Chimney
        const chimney = new THREE.Mesh(new THREE.BoxGeometry(4, 10, 4), new THREE.MeshStandardMaterial({ color: 0x757575, roughness: 0.8 }));
        chimney.position.set(10, 38, -5); chimney.castShadow = true; g.add(chimney);
        // Door
        const door = new THREE.Mesh(new THREE.PlaneGeometry(8, 14), new THREE.MeshStandardMaterial({ color: 0x4E342E, roughness: 0.95 }));
        door.position.set(0, 7, 15.1); g.add(door);
        // Door frame
        const frame = new THREE.Mesh(new THREE.BoxGeometry(10, 16, 1), new THREE.MeshStandardMaterial({ color: 0x3E2723, roughness: 0.9 }));
        frame.position.set(0, 8, 15.3); g.add(frame);
        // Windows with warm glow
        [-12, 12].forEach(ox => {
            const win = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshStandardMaterial({ color: 0xFFF9C4, emissive: 0xFFCC02, emissiveIntensity: 0.8 }));
            win.position.set(ox, 14, 15.1); g.add(win);
            // Window frame
            const wf = new THREE.Mesh(new THREE.BoxGeometry(7, 7, 0.5), new THREE.MeshStandardMaterial({ color: 0x5D4037, roughness: 0.9 }));
            wf.position.set(ox, 14, 15.2); g.add(wf);
        });
        g.position.set(x, 0, z);
        this.scene.add(g);
        this._addArenaCircleCollider(x, z, 24);
    }

    _well(x, z) {
        const base = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 10, 8), new THREE.MeshStandardMaterial({ color: 0x9E9E9E, roughness: 0.7, metalness: 0.1 }));
        base.position.set(x, 5, z); base.castShadow = true; this.scene.add(base);
        const water = new THREE.Mesh(new THREE.CircleGeometry(6, 8), new THREE.MeshStandardMaterial({ color: 0x1976D2, roughness: 0.1, metalness: 0.3 }));
        water.rotation.x = -Math.PI / 2; water.position.set(x, 10.1, z); this.scene.add(water);
        // Roof
        const roof = new THREE.Mesh(new THREE.ConeGeometry(10, 8, 4), new THREE.MeshStandardMaterial({ color: 0x5D4037, roughness: 0.85 }));
        roof.position.set(x, 18, z); roof.rotation.y = Math.PI / 4; this.scene.add(roof);
        // Posts
        [-6, 6].forEach(ox => {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 16, 4), new THREE.MeshStandardMaterial({ color: 0x5D4037 }));
            post.position.set(x + ox, 14, z); this.scene.add(post);
        });
        this._addArenaCircleCollider(x, z, 11);
    }

    // =================== CHARACTERS ===================
    _charModel(cls) {
        const g = new THREE.Group();
        const entry = this.loadedModels[cls] || this.loadedModels['warrior'];
        const asset = entry?.asset;

        if (asset?.scene) {
            // Clone so multiple players/enemies can share the same base mesh
            const model = SkeletonUtils.clone(asset.scene);
            const s = entry?.scale || 6;
            model.scale.set(s, s, s);
            if (entry?.yawOffset) model.rotation.y = entry.yawOffset;
            const classTint = new THREE.Color(CLASS_COLORS[cls] || 0xffffff);
            const stylizeMaterial = (material) => {
                if (!material) return material;
                const m = material.clone();
                m.roughness = Math.min(0.85, Math.max(0.25, m.roughness ?? 0.6));
                m.metalness = Math.min(0.18, Math.max(0.0, m.metalness ?? 0.02));
                m.envMapIntensity = 1.1;
                if (m.color) m.color.lerp(classTint, CLASS_TINT_STRENGTH);
                if (m.emissive) {
                    m.emissive.lerp(classTint, CLASS_TINT_STRENGTH * 0.35);
                    m.emissiveIntensity = Math.max(0.08, m.emissiveIntensity ?? 0);
                }
                return m;
            };

            // Setup shadows
            model.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) {
                        child.material = Array.isArray(child.material)
                            ? child.material.map(stylizeMaterial)
                            : stylizeMaterial(child.material);
                    }
                }
            });
            g.add(model);

            const mixer = new THREE.AnimationMixer(model);
            this.mixers.push(mixer);

            const animMap = {};
            const clips = Array.isArray(asset.animations) ? asset.animations : [];
            clips.forEach(a => { animMap[a.name.toLowerCase()] = a; });

            g.userData.mixer = mixer;
            g.userData.animations = animMap;
            g.userData.currentActionName = 'idle';

            // Play idle by default
            const idleAnim = animMap['idle'] || animMap['standing'] || clips[0];
            if (idleAnim) {
                const action = mixer.clipAction(idleAnim);
                action.play();
                g.userData.currentAction = action;
            }
        } else {
            // Fallback capsule if no GLB
            const capsule = new THREE.Mesh(new THREE.CapsuleGeometry(3, 10), new THREE.MeshStandardMaterial({ color: 0xFFFFFF }));
            capsule.position.y = 8;
            g.add(capsule);
        }

        // Shadow disc
        const shadow = new THREE.Mesh(
            new THREE.CircleGeometry(5, 8),
            new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2 })
        );
        shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.2; g.add(shadow);

        // Dummy references for existing logic
        g.userData.parts = { root: g };
        g.userData.swingState = { active: false, time: 0, direction: 'right', combo: 0 };

        return g;
    }

    _createHumanoidMobFromLoaded(modelKey, colorHex, scaleMult = 1, isBoss = false, mobType = null) {
        const entry = this.loadedModels[modelKey];
        const asset = entry?.asset;
        if (!asset?.scene) return null;

        const root = new THREE.Group();
        const model = SkeletonUtils.clone(asset.scene);
        const scale = (entry?.scale || 6) * scaleMult * (isBoss ? 1.28 : 1.0);
        model.scale.set(scale, scale, scale);
        if (entry?.yawOffset) model.rotation.y = entry.yawOffset;

        const tint = new THREE.Color(colorHex);
        model.traverse((node) => {
            if (!node.isMesh || !node.material) return;
            const apply = (material) => {
                const m = material.clone();
                if (m.color) m.color.lerp(tint, isBoss ? 0.28 : 0.2);
                m.roughness = Math.min(0.92, Math.max(0.22, m.roughness ?? 0.64));
                m.metalness = Math.min(0.25, Math.max(0.0, m.metalness ?? 0.05));
                if (m.emissive) {
                    m.emissive.lerp(tint, isBoss ? 0.24 : 0.12);
                    m.emissiveIntensity = Math.max(m.emissiveIntensity ?? 0, isBoss ? 0.22 : 0.1);
                }
                return m;
            };
            node.material = Array.isArray(node.material) ? node.material.map(apply) : apply(node.material);
            node.castShadow = true;
            node.receiveShadow = true;
            node.userData.bodyPart = node.userData.bodyPart || 'torso';
        });

        root.add(model);
        const mixer = new THREE.AnimationMixer(model);
        this.mixers.push(mixer);
        const animMap = {};
        const clips = Array.isArray(asset.animations) ? asset.animations : [];
        clips.forEach(a => { animMap[a.name.toLowerCase()] = a; });
        root.userData.mixer = mixer;
        root.userData.animations = animMap;
        root.userData.currentActionName = 'idle';
        root.userData.mobType = mobType || modelKey;

        const idle = animMap['idle'] || animMap['idle_combat'] || animMap['idle_b'] || clips[0];
        if (idle) {
            const action = mixer.clipAction(idle);
            action.play();
            root.userData.currentAction = action;
        }

        root.userData.parts = { torso: model };
        return root;
    }

    _mobModel(type, isBoss) {
        const mappedKey = this.mobModelMap[type];
        if (mappedKey) {
            const fromMap = this._createHumanoidMobFromLoaded(
                mappedKey,
                MOB_COLORS[type] || 0xffffff,
                type === 'darkmage' ? 0.98 : 1.0,
                isBoss,
                type
            );
            if (fromMap) return fromMap;
        }

        if (type === 'skeleton') {
            const skel = this._createHumanoidMobFromLoaded('skeleton', MOB_COLORS.skeleton, 1.0, isBoss, type);
            if (skel) return skel;
        }
        if (type === 'darkmage') {
            const mage = this._createHumanoidMobFromLoaded('mage', MOB_COLORS.darkmage, 0.98, isBoss, type);
            if (mage) return mage;
        }

        const g = new THREE.Group();
        const c = MOB_COLORS[type] || 0xFF00FF;
        const s = isBoss ? 2.5 : 1;
        const parts = {}; // Track body parts for dismemberment

        if (type === 'slime') {
            const body = new THREE.Mesh(new THREE.SphereGeometry(6 * s, 8, 6), new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity: 0.85 }));
            body.scale.y = 0.6; body.position.y = 4 * s; body.castShadow = true;
            body.userData.bodyPart = 'torso';
            g.add(body);
            parts.torso = body;
            // Eyes
            [-2 * s, 2 * s].forEach(ox => {
                const e = new THREE.Mesh(new THREE.SphereGeometry(1.2 * s, 4, 4), new THREE.MeshBasicMaterial({ color: 0x111111 }));
                e.position.set(ox, 5 * s, 4 * s); g.add(e);
            });
        } else if (type === 'skeleton') {
            // Torso
            const rib = new THREE.Mesh(new THREE.CylinderGeometry(2 * s, 1.5 * s, 12 * s, 6), new THREE.MeshStandardMaterial({ color: c }));
            rib.position.y = 6 * s; rib.castShadow = true;
            rib.userData.bodyPart = 'torso';
            g.add(rib);
            parts.torso = rib;
            // Head
            const skull = new THREE.Mesh(new THREE.SphereGeometry(3 * s, 6, 6), new THREE.MeshStandardMaterial({ color: 0xFAFAFA }));
            skull.position.y = 14 * s; skull.castShadow = true;
            skull.userData.bodyPart = 'head';
            g.add(skull);
            parts.head = skull;
            // Eyes
            [-1 * s, 1 * s].forEach(ox => {
                const e = new THREE.Mesh(new THREE.SphereGeometry(0.8 * s, 4, 4), new THREE.MeshBasicMaterial({ color: 0x111111 }));
                e.position.set(ox, 14.5 * s, 2 * s); g.add(e);
            });
            // Right arm (sword arm)
            const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.8 * s, 0.6 * s, 8 * s, 4), new THREE.MeshStandardMaterial({ color: c }));
            armR.position.set(3.5 * s, 8 * s, 0);
            armR.userData.bodyPart = 'arm_right';
            g.add(armR);
            parts.armRight = armR;
            // Left arm
            const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.8 * s, 0.6 * s, 8 * s, 4), new THREE.MeshStandardMaterial({ color: c }));
            armL.position.set(-3.5 * s, 8 * s, 0);
            armL.userData.bodyPart = 'arm_left';
            g.add(armL);
            parts.armLeft = armL;
            // Legs
            const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.7 * s, 0.5 * s, 6 * s, 4), new THREE.MeshStandardMaterial({ color: 0xBDBDBD }));
            legR.position.set(1.5 * s, -1 * s, 0);
            legR.userData.bodyPart = 'leg_right';
            g.add(legR);
            parts.legRight = legR;
            const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.7 * s, 0.5 * s, 6 * s, 4), new THREE.MeshStandardMaterial({ color: 0xBDBDBD }));
            legL.position.set(-1.5 * s, -1 * s, 0);
            legL.userData.bodyPart = 'leg_left';
            g.add(legL);
            parts.legLeft = legL;
            // Sword
            const sword = new THREE.Mesh(new THREE.BoxGeometry(0.8 * s, 10 * s, 0.4 * s), new THREE.MeshStandardMaterial({ color: 0x888888 }));
            sword.position.set(4 * s, 8 * s, 0); g.add(sword);
            parts.weapon = sword;
        } else if (type === 'wolf') {
            const body = new THREE.Mesh(new THREE.CapsuleGeometry(3 * s, 10 * s, 4, 8), new THREE.MeshStandardMaterial({ color: c }));
            body.rotation.z = Math.PI / 2; body.position.y = 5 * s; body.castShadow = true;
            body.userData.bodyPart = 'torso';
            g.add(body);
            parts.torso = body;
            const head = new THREE.Mesh(new THREE.SphereGeometry(3 * s, 6, 6), new THREE.MeshStandardMaterial({ color: 0x9E9E9E }));
            head.position.set(8 * s, 6 * s, 0);
            head.userData.bodyPart = 'head';
            g.add(head);
            parts.head = head;
            // Snout
            const snout = new THREE.Mesh(new THREE.ConeGeometry(1.5 * s, 4 * s, 4), new THREE.MeshStandardMaterial({ color: 0x8E8E8E }));
            snout.rotation.x = -Math.PI / 2; snout.position.set(11 * s, 5.5 * s, 0);
            g.add(snout);
            parts.snout = snout;
            // Eyes
            [-1 * s, 1 * s].forEach(ox => {
                const e = new THREE.Mesh(new THREE.SphereGeometry(0.6 * s, 4, 4), new THREE.MeshBasicMaterial({ color: 0xFF0000 }));
                e.position.set(9 * s, 7 * s, ox); g.add(e);
            });
            // Ears
            [-1.5 * s, 1.5 * s].forEach(oz => {
                const ear = new THREE.Mesh(new THREE.ConeGeometry(1 * s, 2.5 * s, 3), new THREE.MeshStandardMaterial({ color: 0x6E6E6E }));
                ear.position.set(7 * s, 9 * s, oz);
                g.add(ear);
            });
            // Legs (4)
            const legPositions = [
                { x: 4 * s, z: 2.5 * s, name: 'legFR' }, { x: 4 * s, z: -2.5 * s, name: 'legFL' },
                { x: -4 * s, z: 2.5 * s, name: 'legBR' }, { x: -4 * s, z: -2.5 * s, name: 'legBL' }
            ];
            legPositions.forEach(lp => {
                const leg = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.7 * s, 0.5 * s, 5 * s, 4),
                    new THREE.MeshStandardMaterial({ color: 0x6E6E6E })
                );
                leg.position.set(lp.x, 1.5 * s, lp.z);
                leg.castShadow = true;
                g.add(leg);
                parts[lp.name] = leg;
            });
            // Tail
            const tail = new THREE.Mesh(
                new THREE.CylinderGeometry(0.8 * s, 0.3 * s, 6 * s, 4),
                new THREE.MeshStandardMaterial({ color: 0x8E8E8E })
            );
            tail.position.set(-8 * s, 6 * s, 0);
            tail.rotation.z = -0.5;
            g.add(tail);
            parts.tail = tail;
        } else if (type === 'darkmage') {
            // Robe (torso)
            const robe = new THREE.Mesh(new THREE.ConeGeometry(5 * s, 16 * s, 6), new THREE.MeshStandardMaterial({ color: c }));
            robe.position.y = 8 * s; robe.castShadow = true;
            robe.userData.bodyPart = 'torso';
            g.add(robe);
            parts.torso = robe;
            // Head
            const head = new THREE.Mesh(new THREE.SphereGeometry(2.5 * s, 6, 6), new THREE.MeshStandardMaterial({ color: 0x4A148C }));
            head.position.y = 18 * s;
            head.userData.bodyPart = 'head';
            g.add(head);
            parts.head = head;
            // Staff arm
            const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.6 * s, 0.5 * s, 8 * s, 4), new THREE.MeshStandardMaterial({ color: 0x4A148C }));
            armR.position.set(4 * s, 12 * s, 0);
            armR.userData.bodyPart = 'arm_right';
            g.add(armR);
            parts.armRight = armR;
            // Orb
            const orb = new THREE.Mesh(new THREE.SphereGeometry(1.5 * s, 8, 8), new THREE.MeshStandardMaterial({ color: 0xE040FB, emissive: 0xE040FB, emissiveIntensity: 1 }));
            orb.position.set(5 * s, 16 * s, 0); g.add(orb);
            parts.weapon = orb;
        } else if (type === 'dragon') {
            const body = new THREE.Mesh(new THREE.CapsuleGeometry(8, 20, 4, 8), new THREE.MeshStandardMaterial({ color: c }));
            body.position.y = 15; body.castShadow = true;
            body.userData.bodyPart = 'torso';
            g.add(body);
            parts.torso = body;
            const head = new THREE.Mesh(new THREE.ConeGeometry(6, 12, 4), new THREE.MeshStandardMaterial({ color: 0xFF2200 }));
            head.rotation.x = Math.PI / 2; head.position.set(0, 20, 14);
            head.userData.bodyPart = 'head';
            g.add(head);
            parts.head = head;
            // Wings
            const wings = [];
            [-1, 1].forEach(side => {
                const wing = new THREE.Mesh(new THREE.PlaneGeometry(25, 15), new THREE.MeshStandardMaterial({ color: 0xFF4400, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
                wing.position.set(side * 18, 20, -5); wing.rotation.y = side * 0.3; g.add(wing);
                wings.push(wing);
            });
            parts.wings = wings;
            // Tail
            const tail = new THREE.Mesh(
                new THREE.CylinderGeometry(3, 0.5, 22, 6),
                new THREE.MeshStandardMaterial({ color: 0xAA0000 })
            );
            tail.position.set(0, 10, -18); tail.rotation.x = 0.7;
            g.add(tail);
            parts.tail = tail;
        } else if (type === 'kraken') {
            const body = new THREE.Mesh(new THREE.SphereGeometry(12, 8, 8), new THREE.MeshStandardMaterial({ color: c }));
            body.position.y = 12; body.castShadow = true;
            body.userData.bodyPart = 'torso';
            g.add(body);
            parts.torso = body;
            const tentacles = [];
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                const tent = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 0.5, 18, 6), new THREE.MeshStandardMaterial({ color: 0x00ACC1 }));
                tent.position.set(Math.cos(a) * 14, 4, Math.sin(a) * 14);
                tent.rotation.x = Math.cos(a) * 0.4; tent.rotation.z = Math.sin(a) * 0.4;
                tent.userData.bodyPart = 'arm_right';
                tent.userData.tentacleAngle = a;
                g.add(tent);
                tentacles.push(tent);
            }
            parts.tentacles = tentacles;
            // Eyes
            [-4, 4].forEach(ox => {
                const e = new THREE.Mesh(new THREE.SphereGeometry(2, 6, 6), new THREE.MeshBasicMaterial({ color: 0x76FF03 }));
                e.position.set(ox, 16, 10); g.add(e);
            });
        }

        // Shadow
        const sh = new THREE.Mesh(new THREE.CircleGeometry(6 * s, 8), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.2 }));
        sh.rotation.x = -Math.PI / 2; sh.position.y = 0.1; g.add(sh);
        sh.userData.ignoreGroundOffset = true;

        g.userData.parts = parts;
        return g;
    }

    // =================== PLAYER ===================
    _spawnPlayer() {
        const cls = this.user.class || 'warrior';
        this.playerModel = this._charModel(cls);
        this.playerGroundOffset = this._computeModelGroundOffset(this.playerModel);
        const startX = this.user.x || 1500;
        const startZ = this.user.y || 1500;
        this.playerModel.position.set(startX, this._getPlayerGroundTargetY(startX, startZ), startZ);
        this.scene.add(this.playerModel);
        this.playerSpeed = CLASS_SPEED[cls] || 140;
        this.lookYaw = this.playerModel.rotation.y;

        // HP bar (world-space)
        this.hpBar = this._createHPBar(36);
        this.playerModel.add(this.hpBar);
        this.hpBar.position.y = 22;

        // Name label (CSS2D alternative: create a div)
        this._createLabel(this.user.login, this.playerModel);
    }

    _computeModelGroundOffset(model) {
        model.updateMatrixWorld(true);
        let minY = Infinity;

        model.traverse((node) => {
            if (!node.isMesh || node.userData?.ignoreGroundOffset) return;
            if (!node.geometry) return;
            if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
            if (!node.geometry.boundingBox) return;

            const worldBox = node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld);
            minY = Math.min(minY, worldBox.min.y);
        });

        if (!Number.isFinite(minY)) return 0;
        // Lift model so the lowest point rests on the terrain surface.
        return Math.max(PLAYER_FOOT_CLEARANCE, -minY + PLAYER_FOOT_CLEARANCE);
    }

    _getPlayerGroundTargetY(x, z) {
        const terrainY = this._getTerrainHeight(x, z);
        const arenaY = this._getArenaFloorHeight(x, z);
        return Math.max(terrainY, arenaY) + (this.playerGroundOffset || 0);
    }

    _createHPBar(w) {
        const g = new THREE.Group();
        const bg = new THREE.Mesh(new THREE.PlaneGeometry(w, 2), new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide }));
        bg.rotation.x = -Math.PI / 4;
        g.add(bg);
        const fill = new THREE.Mesh(new THREE.PlaneGeometry(w, 2), new THREE.MeshBasicMaterial({ color: 0x4CAF50, side: THREE.DoubleSide }));
        fill.rotation.x = -Math.PI / 4; fill.position.z = -0.1;
        g.add(fill);
        g.fillMesh = fill;
        g.maxW = w;
        return g;
    }

    _createLabel(text, parent) {
        // Using a canvas texture for the name
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.font = 'bold 20px Inter, sans-serif';
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
        ctx.textAlign = 'center';
        ctx.strokeText(text, 128, 22); ctx.fillText(text, 128, 22);
        const tex = new THREE.CanvasTexture(canvas);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
        sprite.scale.set(30, 4, 1);
        sprite.position.y = 25;
        parent.add(sprite);
    }

    // =================== ENEMIES ===================
    _spawnEnemies() {
        const defs = ARENA_MODE ? [...MOBS, ...ARENA_EXTRA_MOBS] : MOBS;
        defs.forEach(def => this._spawnMob(def));
    }

    _spawnMob(def) {
        const model = this._mobModel(def.type, def.isBoss);
        model.userData.mobType = def.type;
        this._tuneMobAppearance(model, def.type, def.isBoss);
        if (!def.isBoss) {
            const jitter = 0.92 + Math.random() * 0.22;
            model.scale.multiplyScalar(jitter);
        }
        const groundOffset = this._computeModelGroundOffset(model);
        model.userData.groundOffset = groundOffset;
        model.position.set(def.x, Math.max(this._getTerrainHeight(def.x, def.z), this._getArenaFloorHeight(def.x, def.z)) + groundOffset, def.z);
        this.scene.add(model);

        const hp = this._createHPBar(def.isBoss ? 60 : 28);
        hp.position.y = def.isBoss ? 40 : 20;
        model.add(hp);
        this._createLabel(
            { slime: 'Слайм', skeleton: 'Скелет', wolf: 'Волк', darkmage: 'Тёмный маг', dragon: '🐉 ДРАКОН', kraken: '🐙 КРАКЕН' }[def.type] || def.type,
            model
        );

        this.enemies.push({
            model, def: { ...def }, hp: def.hp, maxHp: def.hp,
            alive: true, hpBar: hp, wanderT: 0, wanderA: Math.random() * Math.PI * 2, lastAtk: 0,
            // Animation state
            animPhase: Math.random() * Math.PI * 2, // Random offset so mobs aren't synchronized
            isChasing: false,
            attackAnim: 0, // 0 = not attacking, >0 = attack animation progress
            lastVx: 0, lastVz: 0, // Momentum tracking
            idleTimer: 0,
            specialAnimTimer: Math.random() * 5000, // For unique idle behaviors
        });
    }

    _tuneMobAppearance(model, type, isBoss) {
        const tint = new THREE.Color(MOB_COLORS[type] || 0xaaaaaa);
        model.traverse((node) => {
            if (!node.isMesh || !node.material) return;
            const apply = (material) => {
                const m = material.clone();
                if (m.color) m.color.lerp(tint, isBoss ? 0.24 : 0.15);
                m.roughness = Math.min(0.94, Math.max(0.25, m.roughness ?? 0.7));
                m.metalness = Math.min(0.22, Math.max(0.0, m.metalness ?? 0.04));
                if (m.emissive) {
                    m.emissive.lerp(tint, isBoss ? 0.2 : 0.08);
                    m.emissiveIntensity = Math.max(m.emissiveIntensity ?? 0, isBoss ? 0.22 : 0.08);
                }
                return m;
            };
            node.material = Array.isArray(node.material)
                ? node.material.map(apply)
                : apply(node.material);
            node.castShadow = true;
            node.receiveShadow = true;
        });
    }

    // =================== INPUT ===================
    _input() {
        document.addEventListener('keydown', e => { this.keys[e.code] = true; });
        document.addEventListener('keyup', e => { this.keys[e.code] = false; });

        // Mouse tracking for directional swings
        this.mouseVelocity = { x: 0, y: 0 };
        this.lastMousePos = { x: null, y: null };
        this.isBlocking = false;

        this.renderer.domElement.addEventListener('mousemove', e => {
            const rect = this.renderer.domElement.getBoundingClientRect();
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            const hasLast = this.lastMousePos.x !== null && this.lastMousePos.y !== null;
            const hasPointerDelta = Number.isFinite(e.movementX) && Number.isFinite(e.movementY);
            const dx = hasPointerDelta
                ? e.movementX
                : (hasLast ? (e.clientX - this.lastMousePos.x) : 0);
            const dy = hasPointerDelta
                ? e.movementY
                : (hasLast ? (e.clientY - this.lastMousePos.y) : 0);
            this.mouseVelocity.x = dx;
            this.mouseVelocity.y = dy;
            if (Math.abs(dx) > 0.0001) this.mouseTurnDelta += dx;
            this.lastMousePos.x = e.clientX;
            this.lastMousePos.y = e.clientY;
        });

        this.renderer.domElement.addEventListener('mousedown', e => {
            if (e.button === 0) this._attack();
            if (e.button === 2) this._startBlock();
            if (document.pointerLockElement !== this.renderer.domElement) {
                this.renderer.domElement.requestPointerLock?.();
            }
        });

        this.renderer.domElement.addEventListener('mouseup', e => {
            if (e.button === 2) this._endBlock();
        });

        this.renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

        document.addEventListener('keydown', e => {
            if (e.code === 'KeyE') this._interact();
        });

        this.renderer.domElement.style.cursor = 'crosshair';
    }

    // =================== COMBAT ===================
    _getSwingDirection() {
        const vx = this.mouseVelocity?.x || 0;
        const vy = this.mouseVelocity?.y || 0;
        const absX = Math.abs(vx), absY = Math.abs(vy);
        if (absX < 3 && absY < 3) return 'thrust'; // Small movement = thrust
        if (absY > absX && vy < 0) return 'overhead'; // Mouse up = overhead
        if (vx > 0) return 'right';
        return 'left';
    }

    _attack() {
        if (this.isDead) return;
        const now = performance.now();
        const cls = this.user.class || 'warrior';
        const cd = CLASS_ATK_CD[cls] || 600;
        if (now - this.lastAtk < cd) return;
        if (this.isBlocking) return;
        this.lastAtk = now;

        const pos = this.playerModel.position;
        const attackOrigin = pos.clone();
        const angle = this.playerModel.rotation.y;
        const baseDmg = (this.user.attack || 10) + (CLASS_DMG[cls] || 10);
        const swingDir = this._getSwingDirection();

        // Swing direction damage multipliers
        const dirMult = { overhead: 1.5, thrust: 1.3, right: 1.0, left: 1.0 };
        const dmg = Math.round(baseDmg * (dirMult[swingDir] || 1));

        // Combo tracking
        const state = this.playerModel.userData.swingState;
        if (now - (state.lastSwingTime || 0) < 1200) {
            state.combo = Math.min((state.combo || 0) + 1, 3);
        } else {
            state.combo = 0;
        }
        state.lastSwingTime = now;
        const comboDmg = Math.round(dmg * (1 + state.combo * 0.15));
        const classActionCfg = this.classActions[cls] || {};

        if (cls === 'warrior') {
            const oneShotMs = this._playOneShotAnim(this.playerModel, classActionCfg.melee || CLASS_ACTIONS.warrior.melee, { minLockMs: 220, lockMult: 0.6 });
            this._swingWeapon(swingDir);
            const impactDelay = oneShotMs > 0 ? Math.min(180, oneShotMs * 0.32) : 0;
            setTimeout(() => {
                if (this.isDead) return;
                this._melee(attackOrigin, angle, comboDmg, true, swingDir);
                this.shakeIntensity = 2;
                this.lastSwingAngle = angle;
            }, impactDelay);
        } else if (cls === 'archer') {
            const oneShotMs = this._playOneShotAnim(this.playerModel, classActionCfg.cast || CLASS_ACTIONS.archer.cast, { minLockMs: 190, lockMult: 0.52 });
            const castDelay = oneShotMs > 0 ? Math.min(240, oneShotMs * 0.45) : 100;
            setTimeout(() => {
                if (this.isDead) return;
                this._ranged(attackOrigin, angle, comboDmg, 0x8D6E63, 460, 2200, true);
            }, castDelay);
        } else {
            const oneShotMs = this._playOneShotAnim(this.playerModel, classActionCfg.cast || CLASS_ACTIONS.mage.cast, { minLockMs: 220, lockMult: 0.58 });
            const castDelay = oneShotMs > 0 ? Math.min(280, oneShotMs * 0.48) : 130;
            setTimeout(() => {
                if (this.isDead) return;
                this._ranged(attackOrigin, angle, comboDmg, 0xE040FB, 350, 2600, true);
            }, castDelay);
        }

        // Show combo indicator
        if (state.combo > 0) {
            this._floatDmg(pos, `${state.combo + 1}x COMBO!`, '#FFD700');
            // Slow-mo on max combo
            if (state.combo >= 3) this._triggerSlowMo(0.3, 0.2);
        }

        broadcastAttack({ playerId: this.user.id, cls, x: Math.round(pos.x), z: Math.round(pos.z), angle, swingDir });
    }

    _swingWeapon(direction) {
        const parts = this.playerModel.userData.parts;
        if (!parts) return;
        // For GLTF models, we'd typically animate bones directly or use a specific animation clip.
        // For now, this logic assumes a procedural model with a 'rightArmPivot'.
        // If using GLTF, this would be replaced by playing an attack animation.
        const pivot = parts.rightArmPivot; // This part might not exist on GLTF models
        const state = this.playerModel.userData.swingState;
        if (state.active) return;
        state.active = true;
        state.direction = direction;

        const startTime = performance.now();
        const duration = 250; // ms

        // Swing arc based on direction
        const arcs = {
            right: { startZ: -0.8, endZ: 1.2, startX: -0.3, endX: 0.3 },
            left: { startZ: 1.2, endZ: -0.8, startX: 0.3, endX: -0.3 },
            overhead: { startZ: -1.5, endZ: 0.8, startX: -1.5, endX: 0.8 }, // Adjusted for overhead
            thrust: { startZ: 0, endZ: 0, startX: -0.3, endX: 0.6 },
        };
        const arc = arcs[direction] || arcs.right;

        // Weapon trail
        this._createWeaponTrail(direction);

        // If pivot exists (for procedural models), animate it
        if (pivot) {
            const animate = () => {
                const elapsed = performance.now() - startTime;
                const t = Math.min(elapsed / duration, 1);
                // Easing: fast start, slow end
                const ease = 1 - Math.pow(1 - t, 3);

                pivot.rotation.z = arc.startZ + (arc.endZ - arc.startZ) * ease;
                pivot.rotation.x = arc.startX + (arc.endX - arc.startX) * ease;

                if (t < 1) {
                    requestAnimationFrame(animate);
                } else {
                    // Return to idle
                    const returnStart = performance.now();
                    const returnDur = 200;
                    const endZ = pivot.rotation.z, endX = pivot.rotation.x;
                    const returnAnim = () => {
                        const rt = Math.min((performance.now() - returnStart) / returnDur, 1);
                        pivot.rotation.z = endZ * (1 - rt);
                        pivot.rotation.x = endX * (1 - rt);
                        if (rt < 1) requestAnimationFrame(returnAnim);
                        else state.active = false;
                    };
                    returnAnim();
                }
            };
            animate();
        } else {
            // For GLTF models, just set state.active to false after duration
            setTimeout(() => { state.active = false; }, duration + 200);
        }
    }

    _createWeaponTrail(direction) {
        const trailGeo = new THREE.PlaneGeometry(2, 14);
        const trailMat = new THREE.MeshBasicMaterial({
            color: 0xFFFFFF, transparent: true, opacity: 0.6,
            side: THREE.DoubleSide, blending: THREE.AdditiveBlending
        });
        const trail = new THREE.Mesh(trailGeo, trailMat);
        const pos = this.playerModel.position;
        const angle = this.playerModel.rotation.y;

        trail.position.set(
            pos.x + Math.sin(angle) * 10,
            10,
            pos.z + Math.cos(angle) * 10
        );
        trail.rotation.y = angle;
        this.scene.add(trail);

        const start = performance.now();
        const animTrail = () => {
            const t = (performance.now() - start) / 300;
            if (t >= 1) { this.scene.remove(trail); return; }
            trail.material.opacity = 0.6 * (1 - t);
            trail.scale.x = 1 + t * 2;
            trail.scale.y = 1 - t * 0.3;
            requestAnimationFrame(animTrail);
        };
        animTrail();
    }

    _startBlock() {
        this.isBlocking = true;
        const parts = this.playerModel.userData.parts;
        if (!parts) return;
        // Raise left arm / shield (for procedural models)
        if (parts.leftArm) {
            parts.leftArm.rotation.z = -1.2;
            parts.leftArm.rotation.x = 0.5;
        }
    }

    _endBlock() {
        this.isBlocking = false;
        const parts = this.playerModel.userData.parts;
        if (!parts) return;
        // Return left arm (for procedural models)
        if (parts.leftArm) {
            parts.leftArm.rotation.z = 0.2;
            parts.leftArm.rotation.x = 0;
        }
    }

    _melee(pos, angle, dmg, isLocal, swingDir) {
        // Enhanced slash effect based on direction
        const colors = { right: 0xFFFFFF, left: 0xFFFFFF, overhead: 0xFFDD44, thrust: 0x44DDFF };
        const slashColor = colors[swingDir] || 0xFFFFFF;
        const arcAngle = swingDir === 'thrust' ? Math.PI * 0.3 : Math.PI * 0.6;

        const slash = new THREE.Mesh(
            new THREE.TorusGeometry(12, 1.5, 4, 12, arcAngle),
            new THREE.MeshBasicMaterial({ color: slashColor, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
        );
        slash.position.set(pos.x + Math.sin(angle) * 15, 8, pos.z + Math.cos(angle) * 15);
        slash.rotation.y = angle;
        if (swingDir === 'overhead') slash.rotation.x = Math.PI / 2;
        this.scene.add(slash);

        const start = performance.now();
        const anim = () => {
            const t = (performance.now() - start) / 300;
            if (t >= 1) { this.scene.remove(slash); return; }
            slash.scale.set(1 + t * 0.5, 1 + t * 0.5, 1 + t * 0.5);
            slash.material.opacity = 0.9 * (1 - t);
            if (swingDir !== 'thrust') slash.rotation.z += (swingDir === 'left' ? -0.15 : 0.15);
            requestAnimationFrame(anim);
        };
        anim();

        if (isLocal) {
            const sx = pos.x + Math.sin(angle) * 15;
            const sz = pos.z + Math.cos(angle) * 15;
            this.enemies.forEach(e => {
                if (!e.alive) return;
                const d = Math.hypot(e.model.position.x - sx, e.model.position.z - sz);
                const hitRange = e.def.isBoss ? 40 : 25;
                if (d < hitRange) {
                    // === Phase 4: Hit zone detection ===
                    const hitZone = this._getHitZone(swingDir, e);
                    const zoneMult = { head: 3.0, torso: 1.0, arm_right: 0.5, arm_left: 0.5, leg_right: 0.7, leg_left: 0.7 };
                    const zoneDmg = Math.round(dmg * (zoneMult[hitZone] || 1.0));

                    this._dmg(e, zoneDmg, angle, swingDir);

                    // Zone-specific feedback
                    const zoneColors = { head: '#FF2222', torso: '#FFD700', arm_right: '#FF8800', arm_left: '#FF8800', leg_right: '#FFAA44', leg_left: '#FFAA44' };
                    const zoneLabels = { head: '💀 HEADSHOT!', arm_right: '✂️ ARM!', arm_left: '✂️ ARM!', leg_right: '🦵 LEG!', leg_left: '🦵 LEG!' };
                    if (zoneLabels[hitZone]) {
                        this._floatDmg(e.model.position, zoneLabels[hitZone], zoneColors[hitZone] || '#FFFFFF');
                    }

                    // Headshot bonus effects
                    if (hitZone === 'head') {
                        this._triggerSlowMo(0.3, 0.1);
                        this._triggerHitFreeze(100);
                        this._triggerScreenFlash('#FF4444', 200);
                        this.shakeIntensity = 10;
                    } else {
                        this._triggerHitFreeze(60);
                        this._triggerScreenFlash('#FFFFFF', 100);
                        this.shakeIntensity = 5;
                    }
                    this.lastSwingAngle = angle;

                    // Physics-based knockback
                    const kbForce = swingDir === 'overhead' ? 8 : swingDir === 'thrust' ? 12 : 6;
                    e.model.position.x += Math.sin(angle) * kbForce;
                    e.model.position.z += Math.cos(angle) * kbForce;
                    // Stagger effect
                    e.lastAtk = performance.now() + 300;
                    // Hit impact
                    this._hitImpact(e.model.position, swingDir);

                    // === Dismemberment check ===
                    if (hitZone !== 'torso' && zoneDmg > e.maxHp * 0.2) {
                        this._dismemberPart(e, hitZone, angle, swingDir);
                    }

                    // Slow-mo on kills
                    if (e.hp <= 0 && (swingDir === 'overhead' || swingDir === 'thrust' || hitZone === 'head')) {
                        this._triggerSlowMo(0.4, 0.15);
                    }
                }
            });

            const forwardX = Math.sin(angle);
            const forwardZ = Math.cos(angle);
            Object.entries(this.others).forEach(([rawId, model]) => {
                const targetId = Number(rawId);
                const state = this.remotePlayers[targetId];
                if (!state || state.hp <= 0) return;

                const dx = model.position.x - sx;
                const dz = model.position.z - sz;
                const dist = Math.hypot(dx, dz);
                if (dist > PVP_MELEE_RANGE) return;

                const n = Math.max(0.001, Math.hypot(dx, dz));
                const dirDot = (dx / n) * forwardX + (dz / n) * forwardZ;
                if (dirDot < 0.2) return;

                const dmgAfterArmor = Math.max(1, Math.round(dmg - ((state.defense || 5) * 0.5)));
                this._emitPlayerHit(targetId, dmgAfterArmor, 'melee', model.position);
            });
        }
    }

    // === PHASE 4: Hit Zone Detection ===
    _getHitZone(swingDir, enemy) {
        // Determine hit zone based on swing direction
        const hasHead = enemy.model.userData.parts?.head;
        const hasArms = enemy.model.userData.parts?.armRight || enemy.model.userData.parts?.armLeft;
        const hasLegs = enemy.model.userData.parts?.legRight || enemy.model.userData.parts?.legLeft;

        if (swingDir === 'overhead') {
            // High attack — head or torso
            if (hasHead && !enemy._dismembered?.head) return Math.random() < 0.6 ? 'head' : 'torso';
            return 'torso';
        }
        if (swingDir === 'thrust') {
            // Forward — torso mainly
            return 'torso';
        }
        if (swingDir === 'right') {
            // Right swing hits left side of enemy
            const roll = Math.random();
            if (roll < 0.3 && hasArms && !enemy._dismembered?.arm_left) return 'arm_left';
            if (roll < 0.5 && hasLegs && !enemy._dismembered?.leg_left) return 'leg_left';
            return 'torso';
        }
        if (swingDir === 'left') {
            // Left swing hits right side
            const roll = Math.random();
            if (roll < 0.3 && hasArms && !enemy._dismembered?.arm_right) return 'arm_right';
            if (roll < 0.5 && hasLegs && !enemy._dismembered?.leg_right) return 'leg_right';
            return 'torso';
        }
        return 'torso';
    }

    // === PHASE 4: Dismemberment ===
    _dismemberPart(enemy, partName, hitAngle, swingDir) {
        if (!enemy._dismembered) enemy._dismembered = {};
        if (enemy._dismembered[partName]) return; // Already dismembered
        enemy._dismembered[partName] = true;

        const parts = enemy.model.userData.parts;
        if (!parts) return;

        // Find the mesh to detach
        let mesh = null;
        if (partName === 'head') mesh = parts.head;
        else if (partName === 'arm_right') mesh = parts.armRight;
        else if (partName === 'arm_left') mesh = parts.armLeft;
        else if (partName === 'leg_right') mesh = parts.legRight;
        else if (partName === 'leg_left') mesh = parts.legLeft;
        if (!mesh) return;

        // Get world position before removing
        const worldPos = new THREE.Vector3();
        mesh.getWorldPosition(worldPos);

        // Remove from enemy model
        enemy.model.remove(mesh);

        // Also remove weapon if arm is severed
        if ((partName === 'arm_right') && parts.weapon) {
            enemy.model.remove(parts.weapon);
        }

        // Create physics body for the flying part
        const color = mesh.material?.color?.getHex() || 0xFF0000;
        const flyMesh = new THREE.Mesh(mesh.geometry.clone(), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
        flyMesh.position.copy(worldPos);
        flyMesh.castShadow = true;
        this.scene.add(flyMesh);

        // Cannon body
        const shape = new CANNON.Sphere(2);
        const body = new CANNON.Body({
            mass: 1.5,
            shape,
            material: this.ragdollMaterial,
            position: new CANNON.Vec3(worldPos.x, worldPos.y, worldPos.z),
            linearDamping: 0.3,
            angularDamping: 0.4
        });

        // Impulse away from hit direction
        const force = 30;
        const upForce = swingDir === 'overhead' ? 40 : 15;
        body.applyImpulse(new CANNON.Vec3(
            Math.sin(hitAngle) * force + (Math.random() - 0.5) * 15,
            upForce + Math.random() * 10,
            Math.cos(hitAngle) * force + (Math.random() - 0.5) * 15
        ));
        body.angularVelocity.set(
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 20
        );

        this.physicsWorld.addBody(body);
        this.ragdollParts.push({ mesh: flyMesh, body, born: performance.now() });

        // Blood splatter particles
        this._bloodSplatter(worldPos, hitAngle);

        // Apply debuffs
        if (partName.startsWith('leg')) {
            enemy._legDebuff = performance.now() + 5000;
            this._floatDmg(enemy.model.position, '🐌 SLOW!', '#88CCFF');
        }
        if (partName.startsWith('arm')) {
            enemy._armDebuff = performance.now() + 5000;
            this._floatDmg(enemy.model.position, '💪 WEAK!', '#FF8844');
        }
        if (partName === 'head') {
            // Instant kill on decapitation
            this._floatDmg(enemy.model.position, '💀 DECAPITATED!', '#FF0000');
            enemy.hp = 0;
            this._killMob(enemy, true);
        }
    }

    _bloodSplatter(pos, angle) {
        const count = 12;
        for (let i = 0; i < count; i++) {
            const geo = new THREE.SphereGeometry(0.3 + Math.random() * 0.5, 4, 4);
            const mat = new THREE.MeshBasicMaterial({ color: 0xCC0000 });
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(pos);
            this.scene.add(p);

            const vx = Math.sin(angle) * 3 + (Math.random() - 0.5) * 5;
            const vy = 2 + Math.random() * 4;
            const vz = Math.cos(angle) * 3 + (Math.random() - 0.5) * 5;
            const start = performance.now();
            const life = 800 + Math.random() * 600;

            const anim = () => {
                const t = (performance.now() - start) / life;
                if (t >= 1) { this.scene.remove(p); p.geometry.dispose(); p.material.dispose(); return; }
                p.position.x += vx * 0.016;
                p.position.y += (vy - t * 12) * 0.016; // Gravity
                p.position.z += vz * 0.016;
                p.material.opacity = 1 - t;
                p.material.transparent = true;
                requestAnimationFrame(anim);
            };
            anim();
        }
    }

    _hitImpact(pos, swingDir) {
        const count = 8;
        const color = swingDir === 'overhead' ? 0xFFDD44 : 0xFF4400;
        for (let i = 0; i < count; i++) {
            const spark = new THREE.Mesh(
                new THREE.SphereGeometry(0.5, 4, 4),
                new THREE.MeshBasicMaterial({ color })
            );
            spark.position.copy(pos);
            spark.position.y = 5 + Math.random() * 10;
            this.scene.add(spark);
            const vx = (Math.random() - 0.5) * 3;
            const vy = Math.random() * 4;
            const vz = (Math.random() - 0.5) * 3;
            const born = performance.now();
            const animSpark = () => {
                const t = (performance.now() - born) / 400;
                if (t >= 1) { this.scene.remove(spark); return; }
                spark.position.x += vx;
                spark.position.y += vy - t * 8;
                spark.position.z += vz;
                spark.material.opacity = 1 - t;
                spark.scale.setScalar(1 - t * 0.5);
                requestAnimationFrame(animSpark);
            };
            animSpark();
        }
    }

    _ranged(pos, angle, dmg, color, speed, lifespan, isLocal) {
        const proj = new THREE.Group();
        const projectileType = color === 0xE040FB ? 'mage' : 'archer';

        if (projectileType === 'mage') {
            const core = new THREE.Mesh(
                new THREE.IcosahedronGeometry(1.2, 1),
                new THREE.MeshStandardMaterial({
                    color: 0xffb5ff,
                    emissive: 0x8f31d3,
                    emissiveIntensity: 1.7,
                    roughness: 0.2,
                    metalness: 0.08,
                })
            );
            const aura = new THREE.Mesh(
                new THREE.SphereGeometry(2.3, 12, 10),
                new THREE.MeshBasicMaterial({
                    color: 0xe040fb,
                    transparent: true,
                    opacity: 0.22,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                })
            );
            const ringA = new THREE.Mesh(
                new THREE.TorusGeometry(2.1, 0.18, 8, 28),
                new THREE.MeshBasicMaterial({ color: 0xf6d5ff, transparent: true, opacity: 0.5 })
            );
            ringA.rotation.x = Math.PI * 0.5;
            const ringB = ringA.clone();
            ringB.rotation.y = Math.PI * 0.5;
            ringB.material = ringA.material.clone();
            ringB.material.opacity = 0.35;
            proj.add(core, aura, ringA, ringB);
            proj.userData.ringA = ringA;
            proj.userData.ringB = ringB;
            proj.userData.pulse = Math.random() * Math.PI * 2;
        } else {
            const bolt = new THREE.Mesh(
                new THREE.CylinderGeometry(0.34, 0.48, 6.8, 8),
                new THREE.MeshStandardMaterial({
                    color: 0xd5c4a8,
                    roughness: 0.58,
                    metalness: 0.12,
                    emissive: 0x3c2618,
                    emissiveIntensity: 0.18,
                })
            );
            bolt.rotation.x = Math.PI * 0.5;
            const tip = new THREE.Mesh(
                new THREE.ConeGeometry(0.55, 1.7, 6),
                new THREE.MeshStandardMaterial({ color: 0xc1bdb4, roughness: 0.42, metalness: 0.55 })
            );
            tip.position.z = 3.8;
            tip.rotation.x = Math.PI * 0.5;
            proj.add(bolt, tip);
        }

        proj.position.set(pos.x + Math.sin(angle) * 10, 8, pos.z + Math.cos(angle) * 10);
        proj.rotation.y = angle;
        this.scene.add(proj);

        // Glow
        const glow = new THREE.PointLight(color, projectileType === 'mage' ? 2.2 : 1.2, projectileType === 'mage' ? 56 : 28);
        proj.add(glow);

        this.projectiles.push({
            mesh: proj, vx: Math.sin(angle) * speed, vz: Math.cos(angle) * speed,
            dmg, isLocal, born: performance.now(), life: lifespan, type: projectileType
        });
    }

    _emitPlayerHit(targetId, dmg, type, worldPos) {
        if (!targetId || targetId === this.user.id) return;
        const now = performance.now();
        if ((this.remoteProtectedUntil[targetId] || 0) > now) return;

        const lastSent = this.pvpLastHitSentAt[targetId] || 0;
        if (now - lastSent < PVP_HIT_COOLDOWN_MS) return;
        this.pvpLastHitSentAt[targetId] = now;

        const scaledDmg = dmg * PVP_DMG_SCALE;
        const safeDmg = Math.max(1, Math.round(scaledDmg));
        const hitId = `${this.user.id}:${targetId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

        // Local client-side feedback
        const targetModel = this.others[targetId];
        if (targetModel) {
            this._flashPlayerModel(targetModel);
            this._floatDmg(targetModel.position, safeDmg, '#FF6B6B');
        } else if (worldPos) {
            this._floatDmg(worldPos, safeDmg, '#FF6B6B');
        }

        const state = this.remotePlayers[targetId];
        if (state) state.hp = Math.max(0, (state.hp || state.max_hp || 100) - safeDmg);

        broadcastPlayerHit({
            attackerId: this.user.id,
            targetId,
            dmg: safeDmg,
            type,
            x: Math.round(worldPos?.x ?? 0),
            z: Math.round(worldPos?.z ?? 0),
            at: Date.now(),
            hitId,
        });
    }

    _onPlayerHit(payload) {
        if (!payload || typeof payload.targetId === 'undefined') return;
        if (payload.hitId && this.processedHitIds.has(payload.hitId)) return;
        if (payload.hitId) this._rememberProcessedHit(payload.hitId);

        const targetId = Number(payload.targetId);
        const dmg = Math.max(1, Math.round(payload.dmg || 0));
        if (dmg <= 0) return;

        if (targetId === this.user.id) {
            if (this.isDead) return;
            if (performance.now() < this.spawnProtectedUntil) return;
            this.user.hp = Math.max(0, (this.user.hp || 100) - dmg);
            this._floatDmg(this.playerModel.position, dmg, '#FF4B4B');
            this._triggerScreenFlash('#FF0000', 180);
            this._triggerHitFreeze(40);
            this.shakeIntensity = 4;
            if (window.updateHUD) window.updateHUD();
            if (this.user.hp <= 0) this._handleSelfDeath(payload.attackerId);
            return;
        }

        // Update visuals for spectators
        const model = this.others[targetId];
        if (model) {
            this._flashPlayerModel(model);
            this._floatDmg(model.position, dmg, '#FF7070');
        }
        const state = this.remotePlayers[targetId];
        if (state) state.hp = Math.max(0, (state.hp || state.max_hp || 100) - dmg);
    }

    _rememberProcessedHit(hitId) {
        this.processedHitIds.add(hitId);
        this.processedHitOrder.push(hitId);
        if (this.processedHitOrder.length > 512) {
            const oldId = this.processedHitOrder.shift();
            this.processedHitIds.delete(oldId);
        }
    }

    _flashPlayerModel(model) {
        if (!model) return;
        model.traverse((node) => {
            if (!node.isMesh || !node.material?.color) return;
            const original = node.material.color.getHex();
            node.material.color.setHex(0xFFFFFF);
            setTimeout(() => {
                if (node.material?.color) node.material.color.setHex(original);
            }, 90);
        });
    }

    _handleSelfDeath(attackerId) {
        this.isDead = true;
        this.deadUntil = performance.now() + PVP_RESPAWN_MS;
        this.user.hp = 0;
        if (window.updateHUD) window.updateHUD();
        this._showNotification(`💀 Тебя убил игрок #${attackerId || '?'}. Возрождение...`);
    }

    _respawnSelf() {
        const spawn = ARENA_SPAWNS[Math.floor(Math.random() * ARENA_SPAWNS.length)] || { x: 1500, z: 1500 };
        this.playerModel.position.x = spawn.x;
        this.playerModel.position.z = spawn.z;
        this.playerModel.position.y = this._getPlayerGroundTargetY(spawn.x, spawn.z);
        this.user.x = Math.round(spawn.x);
        this.user.y = Math.round(spawn.z);
        this.lookYaw = this.playerModel.rotation.y;
        this.user.hp = this.user.max_hp || 100;
        this.user.velocityY = 0;
        this.user.isJumping = false;
        this.isDead = false;
        this.deadUntil = 0;
        this.spawnProtectedUntil = performance.now() + PVP_RESPAWN_PROTECTION_MS;
        if (window.updateHUD) window.updateHUD();
        this._showNotification('⚔️ Возрождение. 2.5с неуязвимости.');
    }

    _dmg(enemy, amount, hitAngle, swingDir) {
        if (!enemy.alive) return;
        enemy.hp -= amount;
        enemy._lastHitAngle = hitAngle || 0;
        enemy._lastSwingDir = swingDir || 'right';
        this._flashMob(enemy);
        this._floatDmg(enemy.model.position, amount, '#FFD700');
        broadcastMobHit({ mobId: enemy.def.id, dmg: amount });
        if (enemy.hp <= 0) this._killMob(enemy, true);
    }

    _flashMob(e) {
        e.model.traverse(c => { if (c.isMesh && c.material) { const orig = c.material.color.getHex(); c.material.color.setHex(0xFFFFFF); setTimeout(() => c.material.color.setHex(orig), 100); } });
    }

    _killMob(enemy, isLocal) {
        enemy.alive = false;
        const pos = enemy.model.position.clone();

        // Spawn ragdoll with physics!
        this._createRagdoll(enemy, enemy._lastHitAngle || 0, enemy._lastSwingDir || 'right');

        // Remove original model immediately
        this.scene.remove(enemy.model);

        if (isLocal) {
            this.user.xp = (this.user.xp || 0) + enemy.def.xp;
            this._floatDmg(pos, enemy.def.xp, '#4FC3F7', 'XP');
            if (window.updateHUD) window.updateHUD();
            if (enemy.def.isBoss) this._showNotification(`🔥 Босс повержен! +${enemy.def.xp} XP`);
        }

        // Respawn
        setTimeout(() => {
            enemy.hp = enemy.maxHp;
            enemy.alive = true;
            enemy.model.scale.set(1, 1, 1);
            enemy.model.position.set(
                enemy.def.x,
                Math.max(this._getTerrainHeight(enemy.def.x, enemy.def.z), this._getArenaFloorHeight(enemy.def.x, enemy.def.z)) + (enemy.model.userData.groundOffset || 0),
                enemy.def.z
            );
            this.scene.add(enemy.model);
        }, enemy.def.isBoss ? 60000 : 15000);
    }

    _floatDmg(pos, amount, color, prefix = '') {
        const div = document.createElement('div');
        div.textContent = prefix ? `+${amount} ${prefix}` : `-${amount}`;
        div.style.cssText = `position:fixed;color:${color};font:bold 16px Inter;pointer-events:none;z-index:9999;text-shadow:0 0 4px #000;transition:all 1s;`;
        const screen = this._worldToScreen(pos);
        div.style.left = screen.x + 'px'; div.style.top = screen.y + 'px';
        document.body.appendChild(div);
        requestAnimationFrame(() => { div.style.top = (screen.y - 60) + 'px'; div.style.opacity = '0'; });
        setTimeout(() => div.remove(), 1000);
    }

    _worldToScreen(pos) {
        const v = pos.clone().project(this.camera);
        return { x: (v.x + 1) / 2 * this.renderer.domElement.clientWidth, y: (-v.y + 1) / 2 * this.renderer.domElement.clientHeight };
    }

    _lerpAngle(current, target, t) {
        const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
        return current + delta * Math.max(0, Math.min(1, t));
    }

    _setCharacterAnim(model, animName) {
        const ud = model?.userData;
        if (!ud?.mixer || !ud?.animations) return;

        let realAnimName = animName;
        if (animName === 'run') realAnimName = 'running_a';
        if (animName === 'walk') realAnimName = 'walking_a';
        if (animName === 'jump') realAnimName = 'jump_full_short';

        if (!ud.animations[realAnimName]) {
            for (const key in ud.animations) {
                if (key.includes(animName.replace('_', ''))) { realAnimName = key; break; }
            }
        }
        if (!ud.animations[realAnimName] || ud.currentActionName === realAnimName) return;

        const next = ud.mixer.clipAction(ud.animations[realAnimName]);
        next.reset();
        if (ud.currentAction) next.crossFadeFrom(ud.currentAction, 0.18, true);
        next.play();
        ud.currentAction = next;
        ud.currentActionName = realAnimName;
    }

    _findAnimKey(animations, candidates = []) {
        if (!animations) return null;
        for (const raw of candidates) {
            const key = String(raw || '').toLowerCase();
            if (animations[key]) return key;
        }
        for (const raw of candidates) {
            const key = String(raw || '').toLowerCase();
            const found = Object.keys(animations).find(k => k.includes(key));
            if (found) return found;
        }
        return null;
    }

    _playOneShotAnim(model, candidates, opts = {}) {
        const ud = model?.userData;
        if (!ud?.mixer || !ud?.animations) return 0;

        const key = this._findAnimKey(ud.animations, candidates);
        if (!key) return 0;
        const clip = ud.animations[key];
        if (!clip) return 0;

        const action = ud.mixer.clipAction(clip);
        action.reset();
        action.enabled = true;
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        if (ud.currentAction) action.crossFadeFrom(ud.currentAction, opts.fade ?? 0.12, true);
        action.play();
        ud.currentAction = action;
        ud.currentActionName = key;

        const now = performance.now();
        const durMs = Math.max(120, (clip.duration || 0.4) * 1000);
        ud.actionLockUntil = now + Math.max(opts.minLockMs || 160, durMs * (opts.lockMult || 0.65));
        return durMs;
    }

    _showNotification(text) {
        const div = document.createElement('div');
        div.textContent = text;
        div.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#FFD700;padding:12px 24px;border-radius:8px;font:bold 16px Inter;z-index:9999;transition:opacity 1s;';
        document.body.appendChild(div);
        setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 1000); }, 3000);
    }

    // Public API for UI systems (chat/emotes)
    showSpeechBubble(text) {
        this._showPlayerPopup(text, {
            color: '#FFFFFF',
            background: 'rgba(15, 20, 30, 0.86)',
            lifetime: 1400,
        });
    }

    // Public API for UI systems (chat/emotes)
    showEmote(emoteText) {
        this._showPlayerPopup(emoteText, {
            color: '#FFD700',
            background: 'rgba(0, 0, 0, 0.78)',
            lifetime: 1000,
        });
    }

    _showPlayerPopup(text, options = {}) {
        if (!this.playerModel || !text) return;

        const color = options.color || '#FFFFFF';
        const background = options.background || 'rgba(0,0,0,0.8)';
        const lifetime = options.lifetime || 1200;

        const worldPos = this.playerModel.position.clone();
        worldPos.y += 30;
        const screen = this._worldToScreen(worldPos);

        const div = document.createElement('div');
        div.textContent = String(text).slice(0, 120);
        div.style.cssText = [
            'position:fixed',
            `left:${screen.x}px`,
            `top:${screen.y}px`,
            'transform:translate(-50%,-50%)',
            `color:${color}`,
            `background:${background}`,
            'padding:6px 10px',
            'border-radius:10px',
            'font:600 13px Inter, sans-serif',
            'pointer-events:none',
            'z-index:9999',
            'text-shadow:0 1px 2px #000',
            'white-space:nowrap',
            'transition:transform 0.6s ease, opacity 0.6s ease',
        ].join(';');

        document.body.appendChild(div);
        requestAnimationFrame(() => {
            div.style.transform = 'translate(-50%,-120%)';
            div.style.opacity = '0';
        });

        setTimeout(() => div.remove(), lifetime);
    }

    // =================== INTERACT ===================
    _interact() {
        this._showNotification('⚔️ Арена открыта: PvP с игроками и PvE с мобами за пределами ринга.');
    }

    // =================== NETWORK ===================
    _network() {
        initRealtime(
            (payload) => {
                if (payload.playerId === this.user.id) return;
                if (payload.cls === 'warrior') this._melee({ x: payload.x, z: payload.z }, payload.angle, 0, false);
                else this._ranged({ x: payload.x, z: payload.z }, payload.angle, 0, payload.cls === 'archer' ? 0x8D6E63 : 0xE040FB, 400, 2000, false);
            },
            (payload) => {
                const e = this.enemies.find(e => e.def.id === payload.mobId);
                if (e && e.alive) { e.hp -= payload.dmg; this._flashMob(e); if (e.hp <= 0) this._killMob(e, false); }
            },
            (payload) => {
                this._onPlayerHit(payload);
            },
            (payload) => {
                this._onRemoteMove(payload);
            }
        );
    }

    _broadcastMovement(now) {
        if (!this.playerModel || this.isDead) return;
        if (now - this.lastMoveBroadcast < MOVE_BROADCAST_INTERVAL_MS) return;
        this.lastMoveBroadcast = now;
        this.localMoveSeq += 1;

        broadcastMove({
            id: this.user.id,
            login: this.user.login,
            class: this.user.class || 'warrior',
            hp: this.user.hp || 0,
            x: Math.round(this.playerModel.position.x * 10) / 10,
            z: Math.round(this.playerModel.position.z * 10) / 10,
            yaw: this.playerModel.rotation.y,
            at: Date.now(),
            seq: this.localMoveSeq,
        });
    }

    _ensureRemotePlayer(remote) {
        if (!remote || !remote.id) return;
        if (this.others[remote.id]) return;

        const m = this._charModel(remote.class || 'warrior');
        m.userData.groundOffset = this._computeModelGroundOffset(m);
        const x = remote.targetX ?? remote.lastServerX ?? ARENA_CENTER.x;
        const z = remote.targetZ ?? remote.lastServerZ ?? ARENA_CENTER.z;
        m.position.set(
            x,
            Math.max(this._getTerrainHeight(x, z), this._getArenaFloorHeight(x, z)) + (m.userData.groundOffset || 0),
            z
        );
        if (typeof remote.targetYaw === 'number') m.rotation.y = remote.targetYaw;
        this._createLabel(remote.login || `Player ${remote.id}`, m);
        this.scene.add(m);
        this.others[remote.id] = m;
    }

    _onRemoteMove(payload) {
        if (!payload) return;
        const id = Number(payload.id);
        if (!id || id === this.user.id) return;

        const now = performance.now();
        const remote = this.remotePlayers[id] || {};
        const nextSeq = Number(payload.seq || 0);
        if (nextSeq && remote.lastMoveSeq && nextSeq <= remote.lastMoveSeq) return;
        if (nextSeq) remote.lastMoveSeq = nextSeq;

        remote.id = id;
        remote.login = payload.login || remote.login;
        remote.class = payload.class || remote.class || 'warrior';
        remote.hp = typeof payload.hp === 'number' ? payload.hp : remote.hp;
        remote.max_hp = remote.max_hp || 100;
        remote.defense = remote.defense || 5;

        const px = Number(payload.x);
        const pz = Number(payload.z);
        if (Number.isFinite(px) && Number.isFinite(pz)) {
            if (typeof remote.targetX === 'number' && typeof remote.targetZ === 'number') {
                const dt = Math.max(0.016, (now - (remote.lastNetAt || now)) / 1000);
                remote.velX = (px - remote.targetX) / dt;
                remote.velZ = (pz - remote.targetZ) / dt;
            }
            remote.targetX = px;
            remote.targetZ = pz;
            remote.targetY = Math.max(this._getTerrainHeight(px, pz), this._getArenaFloorHeight(px, pz));
        }

        if (Number.isFinite(payload.yaw)) remote.targetYaw = payload.yaw;
        remote.lastNetAt = now;
        remote.lastMoveAt = now;
        this.remotePlayers[id] = remote;
        this._ensureRemotePlayer(remote);
    }

    async _sync() {
        if (this.syncInFlight) return;
        this.syncInFlight = true;
        this.user.x = Math.round(this.playerModel.position.x);
        this.user.y = Math.round(this.playerModel.position.z);
        try {
            const players = await dbSync(this.user);
            this._updateOthers(players);
            if (window.updateHUD) window.updateHUD();
        } finally {
            this.syncInFlight = false;
        }
    }

    _updateOthers(players) {
        const active = new Set();
        const now = performance.now();
        players.forEach(p => {
            if (p.id === this.user.id) return;
            active.add(p.id);
            const prev = this.remotePlayers[p.id];
            const remote = this.remotePlayers[p.id] || {};
            remote.id = p.id;
            remote.login = p.login;
            remote.class = p.class;
            remote.hp = p.hp;
            remote.max_hp = p.max_hp;
            remote.defense = p.defense;
            if (typeof remote.lastServerX === 'number' && typeof remote.lastServerZ === 'number' && typeof remote.lastServerAt === 'number') {
                const mdx = p.x - remote.lastServerX;
                const mdz = p.y - remote.lastServerZ;
                const dtSec = Math.max(0.016, (now - remote.lastServerAt) / 1000);
                remote.velX = mdx / dtSec;
                remote.velZ = mdz / dtSec;
                if (Math.hypot(mdx, mdz) > 0.8) remote.targetYaw = Math.atan2(mdx, mdz);
            }
            if ((now - (remote.lastMoveAt || 0)) > 260 || !Number.isFinite(remote.targetX) || !Number.isFinite(remote.targetZ)) {
                remote.targetX = p.x;
                remote.targetZ = p.y;
                remote.targetY = Math.max(this._getTerrainHeight(p.x, p.y), this._getArenaFloorHeight(p.x, p.y));
            }
            remote.lastServerX = p.x;
            remote.lastServerZ = p.y;
            remote.lastServerAt = now;
            this.remotePlayers[p.id] = remote;
            if (!prev) {
                this.remoteProtectedUntil[p.id] = performance.now() + 1000;
            } else if ((prev.hp || 0) <= 0 && (remote.hp || 0) > 0) {
                this.remoteProtectedUntil[p.id] = performance.now() + PVP_RESPAWN_PROTECTION_MS;
            }

            if (this.others[p.id]) {
                // Per-frame smoothing happens in _updateRemotePlayers().
            } else {
                const m = this._charModel(p.class || 'warrior');
                m.userData.groundOffset = this._computeModelGroundOffset(m);
                m.position.set(
                    p.x,
                    Math.max(this._getTerrainHeight(p.x, p.y), this._getArenaFloorHeight(p.x, p.y)) + (m.userData.groundOffset || 0),
                    p.y
                );
                if (typeof remote.targetYaw === 'number') m.rotation.y = remote.targetYaw;
                this._createLabel(p.login, m);
                this.scene.add(m);
                this.others[p.id] = m;
            }
        });
        Object.keys(this.others).forEach(id => {
            const rid = parseInt(id);
            const remote = this.remotePlayers[rid];
            const keepByRealtime = remote && (now - (remote.lastMoveAt || 0) < 2500);
            if (!active.has(rid) && !keepByRealtime) {
                this.scene.remove(this.others[id]);
                delete this.others[id];
                delete this.remotePlayers[id];
                delete this.remoteProtectedUntil[id];
                delete this.pvpLastHitSentAt[id];
            }
        });
    }

    _updateRemotePlayers(dt) {
        const posT = 1 - Math.exp(-REMOTE_POS_SMOOTH_SPEED * dt);
        const rotT = 1 - Math.exp(-REMOTE_ROT_SMOOTH_SPEED * dt);
        const now = performance.now();

        Object.entries(this.others).forEach(([rawId, model]) => {
            const id = Number(rawId);
            const remote = this.remotePlayers[id];
            if (!remote) return;

            let targetX = remote.targetX ?? model.position.x;
            let targetZ = remote.targetZ ?? model.position.z;
            const hasVelocity = Number.isFinite(remote.velX) && Number.isFinite(remote.velZ);
            if (hasVelocity && Number.isFinite(remote.lastNetAt)) {
                const predictSec = Math.min(REMOTE_PREDICT_MAX_SEC, Math.max(0, (now - remote.lastNetAt) / 1000));
                targetX += remote.velX * predictSec;
                targetZ += remote.velZ * predictSec;
            }
            const targetY = (remote.targetY ?? Math.max(this._getTerrainHeight(targetX, targetZ), this._getArenaFloorHeight(targetX, targetZ))) + (model.userData.groundOffset || 0);
            const dist = Math.hypot(targetX - model.position.x, targetZ - model.position.z);

            const prevX = model.position.x;
            const prevZ = model.position.z;

            if (dist > REMOTE_TELEPORT_DIST) {
                model.position.set(targetX, targetY, targetZ);
            } else {
                model.position.x += (targetX - model.position.x) * posT;
                model.position.z += (targetZ - model.position.z) * posT;
                model.position.y += (targetY - model.position.y) * posT;
            }

            if (typeof remote.targetYaw === 'number') {
                model.rotation.y = this._lerpAngle(model.rotation.y, remote.targetYaw, rotT);
            }

            const speed = Math.hypot(model.position.x - prevX, model.position.z - prevZ) / Math.max(dt, 1e-3);
            remote.filteredSpeed = (remote.filteredSpeed || 0) + (speed - (remote.filteredSpeed || 0)) * (1 - Math.exp(-REMOTE_SPEED_FILTER * dt));
            const anim = remote.filteredSpeed > (this.playerSpeed * 0.95)
                ? 'run'
                : remote.filteredSpeed > REMOTE_IDLE_SPEED
                    ? 'walk'
                    : 'idle';
            this._setCharacterAnim(model, anim);
        });
    }

    // =================== AMBIENT ===================
    _createParticles() {
        const count = ARENA_MODE ? 760 : 500;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            if (ARENA_MODE) {
                const a = Math.random() * Math.PI * 2;
                const r = Math.sqrt(Math.random()) * ARENA_DUST_RADIUS;
                positions[i * 3] = ARENA_CENTER.x + Math.cos(a) * r;
                positions[i * 3 + 1] = 4 + Math.random() * 100;
                positions[i * 3 + 2] = ARENA_CENTER.z + Math.sin(a) * r;
            } else {
                positions[i * 3] = Math.random() * MAP;
                positions[i * 3 + 1] = 5 + Math.random() * 80;
                positions[i * 3 + 2] = Math.random() * MAP;
            }
        }
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({
            color: ARENA_MODE ? 0xffdfb6 : 0xffffee,
            size: ARENA_MODE ? 1.1 : 1.5,
            transparent: true,
            opacity: ARENA_MODE ? 0.48 : 0.4,
            sizeAttenuation: true
        });
        this.particles = new THREE.Points(geo, mat);
        this.scene.add(this.particles);
    }

    _createClouds() {
        this.clouds = [];
        const cloudCanvas = document.createElement('canvas');
        cloudCanvas.width = 128; cloudCanvas.height = 64;
        const ctx = cloudCanvas.getContext('2d');
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.ellipse(64, 32, 55, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(45, 25, 30, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(80, 28, 35, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        const tex = new THREE.CanvasTexture(cloudCanvas);
        const cloudCount = ARENA_MODE ? 8 : 12;
        for (let i = 0; i < cloudCount; i++) {
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.3 + Math.random() * 0.2 }));
            const s = 150 + Math.random() * 200;
            sprite.scale.set(s, s * 0.4, 1);
            if (ARENA_MODE) {
                const a = (i / cloudCount) * Math.PI * 2;
                const r = 620 + Math.random() * 220;
                sprite.position.set(
                    ARENA_CENTER.x + Math.cos(a) * r,
                    250 + Math.random() * 120,
                    ARENA_CENTER.z + Math.sin(a) * r
                );
                sprite.userData.speed = 2 + Math.random() * 3;
            } else {
                sprite.position.set(Math.random() * MAP, 250 + Math.random() * 100, Math.random() * MAP);
                sprite.userData.speed = 3 + Math.random() * 5;
            }
            sprite.userData.phase = Math.random() * Math.PI * 2;
            this.scene.add(sprite);
            this.clouds.push(sprite);
        }
    }

    _updateAmbient(time, dt) {
        // Particle floating
        if (this.particles) {
            const positions = this.particles.geometry.attributes.position.array;
            for (let i = 0; i < positions.length; i += 3) {
                if (ARENA_MODE) {
                    positions[i + 1] += 0.03 + Math.sin(time * 0.0016 + i * 0.013) * 0.035;
                    positions[i] += Math.cos(time * 0.0009 + i * 0.02) * 0.06;
                    positions[i + 2] += Math.sin(time * 0.0011 + i * 0.017) * 0.05;

                    const dx = positions[i] - ARENA_CENTER.x;
                    const dz = positions[i + 2] - ARENA_CENTER.z;
                    if (positions[i + 1] > 105 || (dx * dx + dz * dz) > (ARENA_DUST_RADIUS * ARENA_DUST_RADIUS)) {
                        const a = Math.random() * Math.PI * 2;
                        const r = Math.sqrt(Math.random()) * ARENA_DUST_RADIUS;
                        positions[i] = ARENA_CENTER.x + Math.cos(a) * r;
                        positions[i + 1] = 4 + Math.random() * 8;
                        positions[i + 2] = ARENA_CENTER.z + Math.sin(a) * r;
                    }
                } else {
                    positions[i + 1] += Math.sin(time * 0.001 + positions[i]) * 0.05;
                    positions[i] += Math.cos(time * 0.0005 + positions[i + 2]) * 0.08;
                    if (positions[i + 1] > 90) positions[i + 1] = 5;
                    if (positions[i + 1] < 3) positions[i + 1] = 80;
                }
            }
            this.particles.geometry.attributes.position.needsUpdate = true;
        }

        // Cloud movement
        this.clouds.forEach(c => {
            if (ARENA_MODE) {
                const phase = c.userData.phase || 0;
                c.position.x += Math.cos(phase + time * 0.00008) * c.userData.speed * dt;
                c.position.z += Math.sin(phase + time * 0.00008) * c.userData.speed * dt;
            } else {
                c.position.x += c.userData.speed * dt;
                if (c.position.x > MAP + 200) c.position.x = -200;
            }
        });

        if (ARENA_MODE && this.arenaTorches.length) {
            this.arenaTorches.forEach((torch) => {
                const pulse = 0.88
                    + Math.sin(time * 0.010 + torch.phase) * 0.12
                    + Math.sin(time * 0.021 + torch.phase * 1.7) * 0.07;
                torch.light.intensity = torch.baseIntensity * pulse;
                torch.light.distance = 145 + pulse * 24;
                torch.flame.scale.setScalar(0.82 + pulse * 0.3);
                if (torch.flame.material) torch.flame.material.emissiveIntensity = 1.25 + pulse * 0.9;
            });
        }

        if (ARENA_MODE && this.arenaBanners.length) {
            this.arenaBanners.forEach((banner, index) => {
                const phase = banner.userData.bannerPhase || 0;
                banner.position.x = banner.userData.baseX + Math.sin(time * 0.0019 + phase) * 1.7;
                banner.position.y = banner.userData.baseY + Math.sin(time * 0.0024 + phase + index) * 0.45;
                banner.position.z = banner.userData.baseZ + Math.cos(time * 0.0017 + phase) * 1.4;
                banner.rotation.y = banner.userData.baseRotY + Math.sin(time * 0.0022 + phase) * 0.08;
                banner.rotation.z = Math.sin(time * 0.0031 + phase) * 0.16;
            });
        }

        // Water animation
        if (this.water) {
            const wPos = this.water.geometry.attributes.position;
            for (let i = 0; i < wPos.count; i++) {
                const x = wPos.getX(i), z = wPos.getZ(i);
                wPos.setY(i, Math.sin(time * 0.002 + x * 0.5) * 0.4 + Math.cos(time * 0.0015 + z * 0.3) * 0.3);
            }
            wPos.needsUpdate = true;
            this.water.geometry.computeVertexNormals();
        }

        // Tree sway — rotate foliage children
        this.scene.traverse(obj => {
            if (obj.userData && obj.userData.foliage) {
                obj.rotation.z = Math.sin(time * 0.001 + obj.position.y * 0.5) * 0.03;
                obj.rotation.x = Math.cos(time * 0.0012 + obj.position.y * 0.5) * 0.02;
            }
        });
    }

    // =================== GAME LOOP ===================
    _loop() {
        requestAnimationFrame(() => this._loop());
        const dt = Math.min(this.clock.getDelta(), 0.1) * this.timeScale;
        const time = performance.now();

        if (this.mixers) this.mixers.forEach(m => m.update(dt));

        if (this.hitFreezeUntil > time) return; // Keep rendering frozen frame
        if (this.timeScale < 1.0) this.timeScale = Math.min(1.0, this.timeScale + dt * 0.5);

        this._updatePlayer(dt);
        this._updateEnemyAI(dt);
        this._updateRemotePlayers(dt);
        this._updateProj(dt);
        this._updateAmbient(time, dt);
        this._updateCombatCamera(dt);
        this._updateScreenEffects();
        this._updatePhysics(dt);

        // Third-Person Over-the-Shoulder Camera logic
        if (this.playerModel) {
            // Target position: player's back
            const offset = new THREE.Vector3(0, 40, -100); // Back and up
            // Apply player's rotation to offset
            offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.playerModel.rotation.y);
            const targetCamPos = this.playerModel.position.clone().add(offset);

            // Smoothly move camera
            this.camera.position.lerp(targetCamPos, 0.1);

            // Look slightly ahead of player (at head height)
            const lookTarget = this.playerModel.position.clone().add(new THREE.Vector3(0, 15, 0));
            this.camera.lookAt(lookTarget);

            if (this.shakeIntensity > 0) {
                this.shakeOffset.set((Math.random() - 0.5) * this.shakeIntensity, (Math.random() - 0.5) * this.shakeIntensity, 0);
                this.camera.position.add(this.shakeOffset);
                this.shakeIntensity *= 0.85;
                if (this.shakeIntensity < 0.1) this.shakeIntensity = 0;
            }
        }

        this._broadcastMovement(time);
        if (time - this.lastSync > SYNC_INTERVAL_MS) { this.lastSync = time; this._sync(); }
        this.composer.render();
    }

    _updatePlayer(dt) {
        if (this.isDead) {
            this.playerModel.position.y = this._getPlayerGroundTargetY(this.playerModel.position.x, this.playerModel.position.z);
            if (performance.now() >= this.deadUntil) this._respawnSelf();
            return;
        }

        let isMoving = false;
        let forwardAxis = 0;
        let strafeAxis = 0;

        // Space to jump
        if (this.keys['Space'] && !this.user.isJumping) {
            this.user.isJumping = true;
            this.user.velocityY = 60; // Jump strength
        }

        if (this.keys['KeyW'] || this.keys['ArrowUp']) forwardAxis += 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) forwardAxis -= 1;
        // FPS strafe mapping: A = left, D = right.
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) strafeAxis -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) strafeAxis += 1;

        if (!Number.isFinite(this.lookYaw)) this.lookYaw = this.playerModel.rotation.y;
        if (Math.abs(this.mouseTurnDelta) > 0.0001) {
            const frameTurn = THREE.MathUtils.clamp(this.mouseTurnDelta, -120, 120);
            this.lookYaw += frameTurn * LOOK_SENSITIVITY;
            this.mouseTurnDelta = 0;
        }
        const turnT = 1 - Math.exp(-LOOK_SMOOTH_SPEED * dt);
        this.playerModel.rotation.y = this._lerpAngle(this.playerModel.rotation.y, this.lookYaw, turnT);

        let moveX = 0;
        let moveZ = 0;
        if (forwardAxis !== 0 || strafeAxis !== 0) {
            const rot = this.playerModel.rotation.y;
            const forwardX = Math.sin(rot);
            const forwardZ = Math.cos(rot);
            const rightX = Math.sin(rot + Math.PI * 0.5);
            const rightZ = Math.cos(rot + Math.PI * 0.5);

            moveX = (forwardX * forwardAxis) + (rightX * strafeAxis);
            moveZ = (forwardZ * forwardAxis) + (rightZ * strafeAxis);
            const len = Math.hypot(moveX, moveZ) || 1;
            moveX /= len;
            moveZ /= len;

            isMoving = true;
            const spd = this.playerSpeed * dt * (this.keys['ShiftLeft'] ? 1.5 : 1.0);
            const nextX = this.playerModel.position.x + moveX * spd;
            const nextZ = this.playerModel.position.z + moveZ * spd;
            const resolved = this._resolveArenaCollision(nextX, nextZ, PLAYER_COLLIDER_RADIUS);
            this.playerModel.position.x = resolved.x;
            this.playerModel.position.z = resolved.z;
        } else {
            const resolved = this._resolveArenaCollision(this.playerModel.position.x, this.playerModel.position.z, PLAYER_COLLIDER_RADIUS);
            this.playerModel.position.x = resolved.x;
            this.playerModel.position.z = resolved.z;
        }

        // Boundary constraints
        this.playerModel.position.x = Math.max(10, Math.min(MAP - 10, this.playerModel.position.x));
        this.playerModel.position.z = Math.max(10, Math.min(MAP - 10, this.playerModel.position.z));

        const groundHeight = this._getPlayerGroundTargetY(this.playerModel.position.x, this.playerModel.position.z);

        // Apply gravity and jumping
        if (this.user.isJumping) {
            this.playerModel.position.y += this.user.velocityY * dt;
            this.user.velocityY -= 180 * dt; // Gravity
            if (this.playerModel.position.y <= groundHeight) {
                this.playerModel.position.y = groundHeight;
                this.user.isJumping = false;
                this.user.velocityY = 0;
            }
        } else {
            this.playerModel.position.y = groundHeight;
        }

        // Momentum Feel (Optional scaling or bouncing)
        if (!this._playerMomentum) this._playerMomentum = 0;
        this._playerMomentum = isMoving ? Math.min(1.0, this._playerMomentum + dt * 3.0) : Math.max(0, this._playerMomentum - dt * 4.0);

        // Blending GLTF Animations
        const ud = this.playerModel.userData;
        if (ud.mixer && ud.animations) {
            const locked = (ud.actionLockUntil || 0) > performance.now();
            if (!locked) {
                let targetAnimName = 'idle';

                if (this.user.isJumping) {
                    targetAnimName = 'jump';
                } else if (isMoving) {
                    if (forwardAxis < -0.2) {
                        targetAnimName = 'walk';
                    } else {
                        targetAnimName = this.keys['ShiftLeft'] ? 'run' : 'walk';
                    }
                }
                this._setCharacterAnim(this.playerModel, targetAnimName);
            }
        }

        // HP bar
        const pct = (this.user.hp || 100) / (this.user.max_hp || 100);
        this.hpBar.fillMesh.scale.x = Math.max(0.01, pct);
        this.hpBar.fillMesh.position.x = -this.hpBar.maxW * (1 - pct) / 2;
        this.hpBar.fillMesh.material.color.setHex(pct > 0.5 ? 0x4CAF50 : pct > 0.25 ? 0xFFC107 : 0xFF4B4B);
    }

    _updateEnemyAI(dt) {
        const px = this.playerModel.position.x, pz = this.playerModel.position.z;
        const now = performance.now();

        this.enemies.forEach(e => {
            if (!e.alive) return;
            const ex = e.model.position.x, ez = e.model.position.z;
            const dist = Math.hypot(px - ex, pz - ez);
            const parts = e.model.userData.parts || {};
            const type = e.def.type;

            // Update animation phase
            e.animPhase += dt * 5;
            const t = e.animPhase;
            const prevChasing = e.isChasing;

            if (dist < e.def.range) {
                e.isChasing = true;
                // Chase (with leg debuff check)
                const a = Math.atan2(px - ex, pz - ez);
                const legSlow = (e._legDebuff && now < e._legDebuff) ? 0.3 : 1.0;
                const moveSpd = e.def.spd * dt * legSlow;
                e.model.position.x += Math.sin(a) * moveSpd;
                e.model.position.z += Math.cos(a) * moveSpd;
                e.model.rotation.y = a;

                // === CHASE ANIMATIONS PER MOB TYPE ===
                if (e.model.userData.mixer) {
                    this._playGLBAnim(e, 'run');
                } else {
                    this._animateMobChase(e, parts, type, t, dt, dist);
                }

                // Melee
                if (dist < (e.def.isBoss ? 40 : 20) && now - e.lastAtk > 1200) {
                    e.lastAtk = now;
                    e.attackAnim = 1.0; // Start attack animation
                    const armWeak = (e._armDebuff && now < e._armDebuff) ? 0.6 : 1.0;
                    let dmg = Math.max(1, Math.round((e.def.atk * armWeak) - (this.user.defense || 5)));
                    if (this.isBlocking) {
                        dmg = Math.round(dmg * 0.4);
                        this._floatDmg(this.playerModel.position, 'BLOCKED', '#44AAFF');
                        this.shakeIntensity = 1;
                        this._triggerScreenFlash('#4488FF', 100);
                    } else {
                        this.shakeIntensity = e.def.isBoss ? 8 : 4;
                        this._triggerScreenFlash('#FF0000', 200);
                        this._triggerHitFreeze(40);
                    }
                    this.user.hp = Math.max(0, (this.user.hp || 100) - dmg);
                    this._floatDmg(this.playerModel.position, dmg, '#FF4B4B');
                    if (window.updateHUD) window.updateHUD();
                    if (this.user.hp <= 0) {
                        this._triggerSlowMo(0.5, 0.1);
                        this._triggerScreenFlash('#FF0000', 500);
                        this.user.hp = this.user.max_hp || 100;
                        this.playerModel.position.set(1500, 0, 1500);
                        this._showNotification('💀 Ты погиб!');
                    }
                }
            } else {
                e.isChasing = false;
                // Wander
                e.wanderT -= dt * 1000;
                if (e.wanderT <= 0) { e.wanderT = 2000 + Math.random() * 3000; e.wanderA = Math.random() * Math.PI * 2; }
                const isWandering = Math.random() > 0.003;
                if (isWandering) {
                    e.model.position.x += Math.sin(e.wanderA) * e.def.spd * 0.3 * dt;
                    e.model.position.z += Math.cos(e.wanderA) * e.def.spd * 0.3 * dt;
                    e.model.rotation.y = e.wanderA;
                }

                // === IDLE ANIMATIONS PER MOB TYPE ===
                if (e.model.userData.mixer) {
                    this._playGLBAnim(e, isWandering ? 'walk' : 'idle');
                } else {
                    this._animateMobIdle(e, parts, type, t, dt, isWandering);
                }
            }

            // Attack animation decay
            if (e.attackAnim > 0) {
                if (e.model.userData.mixer && e.attackAnim === 1.0) {
                    // Start attack once
                    this._playGLBAnim(e, 'attack');
                    // Reset to idle after timeout (will be handled by state below if chasing)
                } else if (!e.model.userData.mixer) {
                    this._animateMobAttack(e, parts, type, e.attackAnim);
                }
                e.attackAnim = Math.max(0, e.attackAnim - dt * 4);
            }

            e.model.position.y = Math.max(
                this._getTerrainHeight(e.model.position.x, e.model.position.z),
                this._getArenaFloorHeight(e.model.position.x, e.model.position.z)
            ) + (e.model.userData.groundOffset || 0);

            // HP bar
            const pct = e.hp / e.maxHp;
            e.hpBar.fillMesh.scale.x = Math.max(0.01, pct);
            e.hpBar.fillMesh.position.x = -e.hpBar.maxW * (1 - pct) / 2;
            e.hpBar.fillMesh.material.color.setHex(pct > 0.5 ? 0x4CAF50 : pct > 0.25 ? 0xFFC107 : 0xFF4B4B);
        });
    }

    // Helper for GLTF mobs (Skeletons)
    _playGLBAnim(e, target) {
        const ud = e.model ? e.model.userData : e.userData;
        if (!ud || !ud.animations || !ud.mixer) return;

        // Don't interrupt attack until finished, unless it's over
        if (ud.currentActionName && ud.currentActionName.includes('attack') && target !== 'attack') {
            const action = ud.currentAction;
            // Check if attack is almost done (arbitrary 80% to crossfade smoothly)
            if (action.time < action.getClip().duration * 0.8) return;
        }

        const mobType = e?.def?.type || ud.mobType;
        const cfg = (mobType && this.mobActionMap[mobType]) ? this.mobActionMap[mobType] : null;
        let candidates = [];
        if (Array.isArray(cfg?.[target])) candidates = cfg[target];
        if (!candidates.length) {
            if (target === 'run') candidates = ['running_a', 'running_b', 'running_c'];
            else if (target === 'walk') candidates = ['walking_a', 'walking_b', 'walking_c'];
            else if (target === 'attack') candidates = ['1h_melee_attack_slice_diagonal', '1h_melee_attack_chop', 'spellcast_shoot'];
            else candidates = [target];
        }

        let realName = this._findAnimKey(ud.animations, candidates);
        if (!realName) realName = this._findAnimKey(ud.animations, [target, 'idle']);
        if (!realName) return;

        if (ud.currentActionName !== realName && ud.animations[realName]) {
            const action = ud.mixer.clipAction(ud.animations[realName]);
            if (ud.currentAction) {
                ud.currentAction.crossFadeTo(action, 0.2, true);
            }
            action.reset();
            action.play();
            ud.currentAction = action;
            ud.currentActionName = realName;
        }
    }

    // =================== MOB ANIMATIONS (Half Sword Style) ===================

    _animateMobIdle(e, parts, type, t, dt, isWandering) {
        const s = e.def.isBoss ? 2.5 : 1;

        switch (type) {
            case 'slime': {
                // Slime: rhythmic bouncing with squash & stretch
                const bounce = Math.sin(t * 1.5);
                const squash = 1 + bounce * 0.15;
                const stretch = 1 - bounce * 0.08;
                if (parts.torso) {
                    parts.torso.scale.y = 0.6 * stretch;
                    parts.torso.scale.x = squash;
                    parts.torso.scale.z = squash;
                }
                // Periodic hop
                const hopPhase = Math.sin(t * 1.5);
                e.model.position.y = Math.max(0, hopPhase) * 3 * s;
                // Wobble
                e.model.rotation.z = Math.sin(t * 0.8) * 0.06;
                e.model.rotation.x = Math.cos(t * 0.6) * 0.04;
                // Occasional bubble pop (subtle scale pulse)
                if (Math.sin(t * 3) > 0.95 && parts.torso) {
                    parts.torso.scale.setScalar(1.05);
                }
                break;
            }
            case 'skeleton': {
                // Skeleton: jittery, unsteady, bones rattling
                const jitter = () => (Math.random() - 0.5) * 0.03;
                // Head looks around nervously
                if (parts.head) {
                    parts.head.rotation.y = Math.sin(t * 0.7) * 0.4 + jitter();
                    parts.head.rotation.z = Math.sin(t * 1.1) * 0.08 + jitter();
                    // Jaw clatter
                    parts.head.position.y = 14 * s + Math.abs(Math.sin(t * 6)) * 0.3;
                }
                // Torso sways unsteadily
                if (parts.torso) {
                    parts.torso.rotation.z = Math.sin(t * 0.9) * 0.05 + jitter();
                    parts.torso.rotation.x = Math.cos(t * 0.7) * 0.03;
                }
                // Arms hang and sway loosely
                if (parts.armRight) {
                    parts.armRight.rotation.z = Math.sin(t * 1.3) * 0.15 + jitter();
                    parts.armRight.rotation.x = Math.cos(t * 0.8) * 0.1;
                }
                if (parts.armLeft) {
                    parts.armLeft.rotation.z = -Math.sin(t * 1.1) * 0.12 + jitter();
                }
                // Weapon sway
                if (parts.weapon) {
                    parts.weapon.rotation.z = Math.sin(t * 0.5) * 0.1;
                }
                // Legs shuffle
                if (parts.legRight) parts.legRight.rotation.x = Math.sin(t * 1.5) * 0.06;
                if (parts.legLeft) parts.legLeft.rotation.x = Math.sin(t * 1.5 + 1) * 0.06;
                // Subtle body bob
                e.model.position.y = Math.sin(t * 2) * 0.3;
                break;
            }
            case 'wolf': {
                // Wolf: sniffing, looking around, tail wag, paw scraping
                const breathe = Math.sin(t * 1.2);
                // Body breathing
                if (parts.torso) {
                    parts.torso.scale.x = 1 + breathe * 0.02;
                }
                // Head looks around (sniffing)
                if (parts.head) {
                    parts.head.rotation.y = Math.sin(t * 0.4) * 0.3;
                    parts.head.rotation.x = Math.sin(t * 0.8) * 0.1; // Nose up/down sniffing
                }
                // Snout twitches
                if (parts.snout) {
                    parts.snout.rotation.x = -Math.PI / 2 + Math.sin(t * 3) * 0.05;
                }
                // Tail slow wag
                if (parts.tail) {
                    parts.tail.rotation.y = Math.sin(t * 1.0) * 0.3;
                    parts.tail.rotation.x = Math.sin(t * 0.6) * 0.1;
                }
                // Legs slight shift weight
                if (parts.legFR) parts.legFR.rotation.x = Math.sin(t * 0.5) * 0.04;
                if (parts.legFL) parts.legFL.rotation.x = Math.sin(t * 0.5 + 0.5) * 0.04;
                if (parts.legBR) parts.legBR.rotation.x = Math.sin(t * 0.5 + 1) * 0.03;
                if (parts.legBL) parts.legBL.rotation.x = Math.sin(t * 0.5 + 1.5) * 0.03;
                // Subtle body sway
                e.model.position.y = Math.sin(t * 1.5) * 0.2;
                break;
            }
            case 'darkmage': {
                // Dark mage: levitating, robe swaying, orb orbiting
                // Levitation bob
                e.model.position.y = 3 + Math.sin(t * 0.8) * 2;
                // Robe sway
                if (parts.torso) {
                    parts.torso.rotation.z = Math.sin(t * 0.5) * 0.05;
                    parts.torso.rotation.y = Math.sin(t * 0.3) * 0.04;
                }
                // Head slow turn
                if (parts.head) {
                    parts.head.rotation.y = Math.sin(t * 0.4) * 0.2;
                }
                // Staff arm sways
                if (parts.armRight) {
                    parts.armRight.rotation.z = Math.sin(t * 0.6) * 0.1;
                    parts.armRight.rotation.x = Math.cos(t * 0.4) * 0.08;
                }
                // Orb orbit around mage
                if (parts.weapon) {
                    const orbRadius = 5 * s;
                    parts.weapon.position.x = Math.cos(t * 1.2) * orbRadius;
                    parts.weapon.position.z = Math.sin(t * 1.2) * orbRadius;
                    parts.weapon.position.y = 16 * s + Math.sin(t * 2) * 1.5;
                    // Orb glow pulse
                    if (parts.weapon.material) {
                        parts.weapon.material.emissiveIntensity = 0.7 + Math.sin(t * 3) * 0.3;
                    }
                }
                break;
            }
            case 'dragon': {
                // Dragon: wing flapping, head sway, tail swing, breathing
                // Wing flapping (slow, majestic)
                if (parts.wings) {
                    parts.wings.forEach((wing, i) => {
                        const side = i === 0 ? -1 : 1;
                        wing.rotation.z = Math.sin(t * 0.8) * 0.25 * side;
                        wing.rotation.x = Math.cos(t * 0.6) * 0.1;
                    });
                }
                // Head sway
                if (parts.head) {
                    parts.head.rotation.z = Math.sin(t * 0.5) * 0.08;
                    parts.head.position.y = 20 + Math.sin(t * 0.7) * 0.5;
                }
                // Tail swing
                if (parts.tail) {
                    parts.tail.rotation.y = Math.sin(t * 0.6) * 0.3;
                    parts.tail.rotation.z = Math.cos(t * 0.4) * 0.1;
                }
                // Body breathing
                if (parts.torso) {
                    parts.torso.scale.x = 1 + Math.sin(t * 1.0) * 0.02;
                    parts.torso.scale.z = 1 + Math.sin(t * 1.0) * 0.02;
                }
                // Hover bob
                e.model.position.y = 2 + Math.sin(t * 0.5) * 1.5;
                break;
            }
            case 'kraken': {
                // Kraken: tentacles wave in sine patterns, body pulses
                if (parts.tentacles) {
                    parts.tentacles.forEach((tent, i) => {
                        const a = tent.userData.tentacleAngle || (i / 8) * Math.PI * 2;
                        const phase = t + i * 0.8;
                        tent.rotation.x = Math.cos(a) * 0.4 + Math.sin(phase * 0.7) * 0.25;
                        tent.rotation.z = Math.sin(a) * 0.4 + Math.cos(phase * 0.5) * 0.2;
                        // Tentacle reach in/out
                        tent.position.y = 4 + Math.sin(phase * 0.9) * 1.5;
                    });
                }
                // Body pulse
                if (parts.torso) {
                    const pulse = 1 + Math.sin(t * 0.8) * 0.04;
                    parts.torso.scale.set(pulse, pulse * 0.95, pulse);
                }
                // Gentle bob
                e.model.position.y = Math.sin(t * 0.6) * 1;
                break;
            }
        }
    }

    _animateMobChase(e, parts, type, t, dt, dist) {
        const s = e.def.isBoss ? 2.5 : 1;

        switch (type) {
            case 'slime': {
                // Slime: aggressive bouncing — faster, higher, more squash
                const bounce = Math.sin(t * 3);
                if (parts.torso) {
                    parts.torso.scale.y = 0.6 * (1 - bounce * 0.2); // More extreme squash
                    parts.torso.scale.x = 1 + bounce * 0.15;
                    parts.torso.scale.z = 1 + bounce * 0.15;
                }
                // Higher jumps when chasing
                e.model.position.y = Math.max(0, Math.sin(t * 3)) * 6 * s;
                // Lean toward player
                e.model.rotation.x = 0.15;
                break;
            }
            case 'skeleton': {
                // Skeleton: aggressive run — arms flailing, head locked on player
                if (parts.head) {
                    parts.head.rotation.y = 0; // Lock onto player
                    parts.head.rotation.z = Math.sin(t * 5) * 0.04;
                }
                // Torso forward lean
                if (parts.torso) {
                    parts.torso.rotation.x = 0.15;
                    parts.torso.rotation.z = Math.sin(t * 3) * 0.06;
                }
                // Running legs
                if (parts.legRight) parts.legRight.rotation.x = Math.sin(t * 4) * 0.5;
                if (parts.legLeft) parts.legLeft.rotation.x = Math.sin(t * 4 + Math.PI) * 0.5;
                // Sword arm raised
                if (parts.armRight) {
                    parts.armRight.rotation.x = -0.5 + Math.sin(t * 2) * 0.2;
                    parts.armRight.rotation.z = 0.3;
                }
                if (parts.armLeft) {
                    parts.armLeft.rotation.x = Math.sin(t * 4 + Math.PI) * 0.3;
                }
                // Running bob
                e.model.position.y = Math.abs(Math.sin(t * 4)) * 1.5;
                break;
            }
            case 'wolf': {
                // Wolf: galloping with full leg cycle, body lunging forward
                const gallop = t * 3;
                // Four-leg gallop cycle
                if (parts.legFR) parts.legFR.rotation.x = Math.sin(gallop) * 0.7;
                if (parts.legFL) parts.legFL.rotation.x = Math.sin(gallop + 0.3) * 0.7;
                if (parts.legBR) parts.legBR.rotation.x = Math.sin(gallop + Math.PI) * 0.6;
                if (parts.legBL) parts.legBL.rotation.x = Math.sin(gallop + Math.PI + 0.3) * 0.6;
                // Body undulation
                if (parts.torso) {
                    parts.torso.rotation.x = Math.sin(gallop * 2) * 0.05; // Body flex
                }
                // Head locked on prey, slight bob
                if (parts.head) {
                    parts.head.rotation.y = 0;
                    parts.head.rotation.x = -0.1; // Head down, predatory
                    parts.head.position.y = 6 * s + Math.sin(gallop * 2) * 0.5;
                }
                // Tail straight back when running
                if (parts.tail) {
                    parts.tail.rotation.y = Math.sin(gallop) * 0.15;
                    parts.tail.rotation.z = -0.8; // Tail horizontal
                }
                // Galloping bob
                e.model.position.y = Math.abs(Math.sin(gallop)) * 2;
                break;
            }
            case 'darkmage': {
                // Dark mage: aggressive levitation, orb glowing bright, leaning forward
                e.model.position.y = 4 + Math.sin(t * 1.5) * 1.5;
                // Lean toward player
                if (parts.torso) {
                    parts.torso.rotation.x = 0.1;
                    parts.torso.rotation.z = Math.sin(t * 1) * 0.08;
                }
                // Staff arm raised threateningly
                if (parts.armRight) {
                    parts.armRight.rotation.x = -0.6 + Math.sin(t * 2) * 0.15;
                }
                // Orb circles faster and glows brighter
                if (parts.weapon) {
                    const orbRadius = 6 * s;
                    parts.weapon.position.x = Math.cos(t * 3) * orbRadius;
                    parts.weapon.position.z = Math.sin(t * 3) * orbRadius;
                    parts.weapon.position.y = 16 * s + Math.sin(t * 4) * 2;
                    if (parts.weapon.material) {
                        parts.weapon.material.emissiveIntensity = 1.2 + Math.sin(t * 5) * 0.5;
                    }
                }
                break;
            }
            case 'dragon': {
                // Dragon: aggressive wing flapping, head lunging
                if (parts.wings) {
                    parts.wings.forEach((wing, i) => {
                        const side = i === 0 ? -1 : 1;
                        wing.rotation.z = Math.sin(t * 2) * 0.4 * side; // Faster flapping
                    });
                }
                if (parts.head) {
                    parts.head.rotation.x = Math.PI / 2 - 0.2; // Head forward
                    if (dist < 60) parts.head.rotation.x = Math.PI / 2 + 0.3; // Lunge!
                }
                if (parts.tail) {
                    parts.tail.rotation.y = Math.sin(t * 1.5) * 0.5;
                }
                e.model.position.y = 3 + Math.sin(t * 1.2) * 2;
                break;
            }
            case 'kraken': {
                // Kraken: tentacles reaching forward aggressively
                if (parts.tentacles) {
                    parts.tentacles.forEach((tent, i) => {
                        const a = tent.userData.tentacleAngle || (i / 8) * Math.PI * 2;
                        const phase = t + i * 0.5;
                        // Reach forward toward player
                        tent.rotation.x = Math.cos(a) * 0.6 + Math.sin(phase * 1.5) * 0.4;
                        tent.rotation.z = Math.sin(a) * 0.6 + Math.cos(phase * 1.2) * 0.35;
                        tent.position.y = 3 + Math.sin(phase * 2) * 2;
                    });
                }
                if (parts.torso) {
                    parts.torso.scale.set(1.05, 0.95, 1.05); // Puffed up aggressive
                }
                e.model.position.y = Math.sin(t * 1.0) * 1.5;
                break;
            }
        }
    }

    _animateMobAttack(e, parts, type, progress) {
        // progress goes from 1.0 → 0.0
        const attackPower = Math.pow(progress, 0.5); // Fast start, slow end
        const s = e.def.isBoss ? 2.5 : 1;

        switch (type) {
            case 'slime': {
                // Slime: smash down — stretch up then squash flat
                if (parts.torso) {
                    if (progress > 0.6) {
                        // Wind up — stretch tall
                        parts.torso.scale.y = 0.6 + (1 - progress) * 0.8;
                        parts.torso.scale.x = 1 - (1 - progress) * 0.2;
                    } else {
                        // Smash down — squash flat
                        parts.torso.scale.y = 0.3 + progress * 0.3;
                        parts.torso.scale.x = 1.3 - progress * 0.15;
                    }
                }
                e.model.position.y = progress > 0.6 ? (1 - progress) * 15 : 0;
                break;
            }
            case 'skeleton': {
                // Skeleton: overhead sword slam
                if (parts.armRight) {
                    parts.armRight.rotation.x = -1.2 * attackPower;
                    parts.armRight.rotation.z = 0.5 * attackPower;
                }
                if (parts.weapon) {
                    parts.weapon.rotation.x = -0.5 * attackPower;
                }
                if (parts.torso) {
                    parts.torso.rotation.x = 0.2 * attackPower;
                }
                break;
            }
            case 'wolf': {
                // Wolf: lunge bite — whole body lunges forward
                const lunge = attackPower * 5;
                e.model.position.z += Math.cos(e.model.rotation.y) * lunge * 0.1;
                e.model.position.x += Math.sin(e.model.rotation.y) * lunge * 0.1;
                if (parts.head) {
                    parts.head.rotation.x = -0.3 * attackPower; // Snap jaws
                }
                if (parts.torso) {
                    parts.torso.rotation.x = 0.1 * attackPower;
                }
                break;
            }
            case 'darkmage': {
                // Dark mage: cast — arm thrust forward, orb flare
                if (parts.armRight) {
                    parts.armRight.rotation.x = -1.0 * attackPower;
                }
                if (parts.weapon && parts.weapon.material) {
                    parts.weapon.material.emissiveIntensity = 2.0 * attackPower;
                    const scale = 1 + attackPower * 0.5;
                    parts.weapon.scale.setScalar(scale);
                }
                break;
            }
            case 'dragon': {
                // Dragon: fire breath — head lunges forward
                if (parts.head) {
                    parts.head.position.z = 14 + attackPower * 8;
                    parts.head.rotation.x = Math.PI / 2 + attackPower * 0.4;
                }
                // Wings spread wide
                if (parts.wings) {
                    parts.wings.forEach((wing, i) => {
                        const side = i === 0 ? -1 : 1;
                        wing.rotation.z = -0.5 * side * attackPower;
                    });
                }
                break;
            }
            case 'kraken': {
                // Kraken: all tentacles slam down
                if (parts.tentacles) {
                    parts.tentacles.forEach(tent => {
                        tent.rotation.x += attackPower * 0.8;
                        tent.position.y = 4 - attackPower * 6;
                    });
                }
                break;
            }
        }
    }

    _updateProj(dt) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.mesh.position.x += p.vx * dt;
            p.mesh.position.z += p.vz * dt;
            if (p.type === 'mage') {
                const t = (performance.now() - p.born) * 0.001;
                if (p.mesh.userData.ringA) p.mesh.userData.ringA.rotation.z = t * 6;
                if (p.mesh.userData.ringB) p.mesh.userData.ringB.rotation.x = t * 5;
                const pulse = 0.9 + Math.sin(t * 10 + (p.mesh.userData.pulse || 0)) * 0.16;
                p.mesh.scale.setScalar(pulse);
            } else {
                p.mesh.rotation.y = Math.atan2(p.vx, p.vz);
            }

            // Hit check
            if (p.isLocal) {
                let consumed = false;

                for (const [rawId, model] of Object.entries(this.others)) {
                    const targetId = Number(rawId);
                    const state = this.remotePlayers[targetId];
                    if (!state || state.hp <= 0) continue;
                    if (Math.hypot(model.position.x - p.mesh.position.x, model.position.z - p.mesh.position.z) < PVP_RANGED_RANGE) {
                        const dmgAfterArmor = Math.max(1, Math.round((p.dmg || 1) - ((state.defense || 5) * 0.35)));
                        this._emitPlayerHit(targetId, dmgAfterArmor, 'ranged', model.position);
                        this.scene.remove(p.mesh);
                        this.projectiles.splice(i, 1);
                        consumed = true;
                        break;
                    }
                }
                if (consumed) continue;

                for (const e of this.enemies) {
                    if (!e.alive) continue;
                    if (Math.hypot(e.model.position.x - p.mesh.position.x, e.model.position.z - p.mesh.position.z) < (e.def.isBoss ? 30 : 15)) {
                        this._dmg(e, p.dmg);
                        this.scene.remove(p.mesh);
                        this.projectiles.splice(i, 1);
                        consumed = true;
                        break;
                    }
                }
                if (consumed) continue;
            }

            // Lifetime
            if (performance.now() - p.born > p.life) {
                this.scene.remove(p.mesh);
                this.projectiles.splice(i, 1);
            }
        }
    }

    _updateCombatCamera(dt) {
        const px = this.playerModel.position.x, pz = this.playerModel.position.z;
        let nearestDist = Infinity;

        Object.entries(this.others).forEach(([rawId, m]) => {
            const state = this.remotePlayers[Number(rawId)];
            if (state && state.hp <= 0) return;
            const d = Math.hypot(m.position.x - px, m.position.z - pz);
            if (d < nearestDist) nearestDist = d;
        });

        this.enemies.forEach(e => {
            if (!e.alive) return;
            const d = Math.hypot(e.model.position.x - px, e.model.position.z - pz);
            if (d < nearestDist) nearestDist = d;
        });

        const inCombat = nearestDist < 200;
        const targetBlend = inCombat ? 1 : 0;
        this.combatBlend += (targetBlend - this.combatBlend) * 0.03;
        this.combatMode = this.combatBlend > 0.1;
    }

    _updateCam() {
        const px = this.playerModel.position.x, pz = this.playerModel.position.z;
        const cb = this.combatBlend || 0;

        // Blend between exploration and combat camera
        const camH = CAM_H * (1 - cb * 0.4);     // Lower in combat
        const camDist = CAM_DIST * (1 - cb * 0.5); // Closer in combat
        const lookY = cb * 5;                       // Look slightly up in combat

        // Smooth follow
        this.camera.position.x += (px + this.shakeOffset.x - this.camera.position.x) * 0.08;
        this.camera.position.z += (pz + camDist + this.shakeOffset.z - this.camera.position.z) * 0.08;
        this.camera.position.y += (camH + this.shakeOffset.y - this.camera.position.y) * 0.08;
        this.camera.lookAt(px, lookY, pz);

        // FOV change in combat (subtle zoom)
        const targetFov = 60 - cb * 8;
        this.camera.fov += (targetFov - this.camera.fov) * 0.05;
        this.camera.updateProjectionMatrix();

        // Move sun with player
        this.sun.position.set(px + 300, 500, pz + 200);
        this.sun.target.position.set(px, 0, pz);
    }

    // =================== SCREEN EFFECTS ===================
    _triggerSlowMo(duration = 0.2, scale = 0.3) {
        this.timeScale = scale;
        // Auto-recover handled in _loop
    }

    _triggerHitFreeze(durationMs = 50) {
        this.hitFreezeUntil = performance.now() + durationMs;
    }

    _triggerScreenFlash(color = '#FFFFFF', duration = 150) {
        if (this._flashDiv) this._flashDiv.remove();
        const div = document.createElement('div');
        div.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: ${color}; opacity: 0.3; pointer-events: none; z-index: 9998;
            transition: opacity ${duration}ms ease-out;
        `;
        document.body.appendChild(div);
        this._flashDiv = div;
        requestAnimationFrame(() => { div.style.opacity = '0'; });
        setTimeout(() => div.remove(), duration + 50);
    }

    _updateScreenEffects() {
        // Low HP vignette
        const hpPct = (this.user.hp || 100) / (this.user.max_hp || 100);
        if (hpPct < 0.3) {
            if (!this._vignetteDiv) {
                const v = document.createElement('div');
                v.style.cssText = `
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    pointer-events: none; z-index: 9997;
                    box-shadow: inset 0 0 120px rgba(255,0,0,0.5);
                `;
                document.body.appendChild(v);
                this._vignetteDiv = v;
            }
            const pulse = 0.3 + Math.sin(performance.now() * 0.005) * 0.2;
            this._vignetteDiv.style.boxShadow = `inset 0 0 120px rgba(255,0,0,${pulse})`;
        } else if (this._vignetteDiv) {
            this._vignetteDiv.remove();
            this._vignetteDiv = null;
        }
    }
}
