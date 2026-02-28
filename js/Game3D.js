import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/shaders/FXAAShader.js';
import { dbSync, initRealtime, broadcastAttack, broadcastMobHit } from './core/db.js';

// ========== CONSTANTS ==========
const MAP = 3000;
const CAM_H = 350, CAM_DIST = 280;
const CLASS_SPEED = { warrior: 120, mage: 140, archer: 170 };
const CLASS_ATK_CD = { warrior: 450, mage: 900, archer: 650 };
const CLASS_DMG = { warrior: 20, mage: 28, archer: 16 };

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
        this.lastAtk = 0;
        this.lastSync = 0;
        this.respawnQ = [];

        this._init();
        this._world();
        this._createParticles();
        this._createClouds();
        this._spawnPlayer();
        this._spawnEnemies();
        this._input();
        this._network();
        this._loop();
    }

    // =================== ENGINE ===================
    _init() {
        const w = this.container.clientWidth, h = this.container.clientHeight;
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
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.3;
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

    // =================== WORLD ===================
    _world() {
        // Ground with vertex colors for zone blending
        const groundGeo = new THREE.PlaneGeometry(MAP, MAP, 128, 128);
        groundGeo.rotateX(-Math.PI / 2);
        const pos = groundGeo.attributes.position;
        const colors = new Float32Array(pos.count * 3);
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i) + MAP / 2, z = pos.getZ(i) + MAP / 2;
            // Height variation by zone
            let h = Math.sin(x * 0.008) * 3 + Math.cos(z * 0.008) * 3;
            if (x > 2000 && z < 900) h += Math.sin(x * 0.02) * 8 + Math.cos(z * 0.015) * 6; // mountains
            if (Math.hypot(x - 2500, z - 2500) < 350) h -= 3; // lake depression
            pos.setY(i, h);
            // Vertex colors for zone blending
            let r = 0.30, g = 0.55, b = 0.25; // default green
            if (x < 900 && z < 900) { r = 0.18; g = 0.42; b = 0.13; } // forest - dark green
            else if (x > 2000 && z < 900) { r = 0.47; g = 0.44; b = 0.41; } // mountains - grey-brown
            else if (x < 900 && z > 2000) { r = 0.42; g = 0.68; b = 0.22; } // meadow - bright green
            else if (x > 1200 && x < 1800 && z > 1200 && z < 1800) { r = 0.35; g = 0.60; b = 0.30; } // village
            const d = Math.hypot(x - 2500, z - 2500);
            if (d < 400) { const t = Math.max(0, 1 - d / 400); r = r * (1 - t) + 0.15 * t; g = g * (1 - t) + 0.35 * t; b = b * (1 - t) + 0.45 * t; } // lake shore blend
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
    }

    _scatterTrees(xMin, xMax, zMin, zMax, count, color, type) {
        for (let i = 0; i < count; i++) {
            const x = xMin + Math.random() * (xMax - xMin);
            const z = zMin + Math.random() * (zMax - zMin);
            if (x > 1300 && x < 1700 && z > 1300 && z < 1700) continue;
            if (Math.hypot(x - 2500, z - 2500) < 280) continue;
            this._tree(x, z, type, color);
        }
    }

    _scatterRocks(xMin, xMax, zMin, zMax, count) {
        for (let i = 0; i < count; i++) {
            const x = xMin + Math.random() * (xMax - xMin);
            const z = zMin + Math.random() * (zMax - zMin);
            const s = 4 + Math.random() * 8;
            const rock = new THREE.Mesh(
                new THREE.DodecahedronGeometry(s, 0),
                new THREE.MeshStandardMaterial({ color: 0x757575, roughness: 0.75, metalness: 0.05 })
            );
            rock.position.set(x, s * 0.5, z);
            rock.rotation.set(Math.random(), Math.random(), Math.random());
            rock.castShadow = true;
            this.scene.add(rock);
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
    }

    // =================== CHARACTERS ===================
    _charModel(cls) {
        const g = new THREE.Group();
        const clr = CLASS_COLORS[cls] || 0xFFFFFF;
        const skinColor = 0xFFD5B0;

        // === BODY PARTS (segmented for hit zones & dismemberment) ===

        // Torso
        const torso = new THREE.Mesh(
            new THREE.CylinderGeometry(4, 3.5, 10, 8),
            new THREE.MeshStandardMaterial({ color: clr, roughness: 0.7 })
        );
        torso.position.y = 8; torso.castShadow = true;
        torso.userData.bodyPart = 'torso';
        g.add(torso);

        // Head
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(3.2, 8, 6),
            new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.6 })
        );
        head.position.y = 16; head.castShadow = true;
        head.userData.bodyPart = 'head';
        g.add(head);

        // Eyes
        [-1.3, 1.3].forEach(ox => {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.5, 4, 4), new THREE.MeshBasicMaterial({ color: 0x111111 }));
            eye.position.set(ox, 16.2, 2.8);
            head.add(eye);
        });

        // Left Arm
        const leftArm = new THREE.Mesh(
            new THREE.CylinderGeometry(1.2, 1, 8, 6),
            new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.6 })
        );
        leftArm.position.set(-5.5, 9, 0);
        leftArm.rotation.z = 0.2;
        leftArm.castShadow = true;
        leftArm.userData.bodyPart = 'arm_left';
        g.add(leftArm);

        // Right Arm (weapon arm) — on a pivot for swing animation
        const rightArmPivot = new THREE.Group();
        rightArmPivot.position.set(5.5, 12, 0);
        rightArmPivot.userData.isWeaponArm = true;
        g.add(rightArmPivot);

        const rightArm = new THREE.Mesh(
            new THREE.CylinderGeometry(1.2, 1, 8, 6),
            new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.6 })
        );
        rightArm.position.y = -3;
        rightArm.castShadow = true;
        rightArm.userData.bodyPart = 'arm_right';
        rightArmPivot.add(rightArm);

        // Left Leg
        const leftLeg = new THREE.Mesh(
            new THREE.CylinderGeometry(1.3, 1.1, 8, 6),
            new THREE.MeshStandardMaterial({ color: 0x3E2723, roughness: 0.8 })
        );
        leftLeg.position.set(-2, 1.5, 0);
        leftLeg.castShadow = true;
        leftLeg.userData.bodyPart = 'leg_left';
        g.add(leftLeg);

        // Right Leg
        const rightLeg = new THREE.Mesh(
            new THREE.CylinderGeometry(1.3, 1.1, 8, 6),
            new THREE.MeshStandardMaterial({ color: 0x3E2723, roughness: 0.8 })
        );
        rightLeg.position.set(2, 1.5, 0);
        rightLeg.castShadow = true;
        rightLeg.userData.bodyPart = 'leg_right';
        g.add(rightLeg);

        // === CLASS-SPECIFIC EQUIPMENT ===
        if (cls === 'warrior') {
            // Helmet
            const helmet = new THREE.Mesh(
                new THREE.SphereGeometry(3.8, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
                new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.8, roughness: 0.3 })
            );
            helmet.position.y = 16.5; g.add(helmet);

            // Shield on left arm
            const shield = new THREE.Mesh(
                new THREE.BoxGeometry(1, 8, 6),
                new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.6, roughness: 0.4 })
            );
            shield.position.set(-7, 9, 0);
            shield.userData.bodyPart = 'shield';
            g.add(shield);

            // Sword on weapon arm pivot
            const sword = new THREE.Mesh(
                new THREE.BoxGeometry(0.8, 14, 0.4),
                new THREE.MeshStandardMaterial({ color: 0xCCCCCC, metalness: 0.9, roughness: 0.2 })
            );
            sword.position.y = -10;
            sword.userData.isWeapon = true;
            sword.userData.weaponType = 'sword';
            rightArmPivot.add(sword);

            // Sword guard
            const guard = new THREE.Mesh(
                new THREE.BoxGeometry(3, 0.6, 1.5),
                new THREE.MeshStandardMaterial({ color: 0x8D6E63, metalness: 0.5 })
            );
            guard.position.y = -3.5;
            rightArmPivot.add(guard);

        } else if (cls === 'mage') {
            // Hat
            const hat = new THREE.Mesh(
                new THREE.ConeGeometry(4.5, 10, 6),
                new THREE.MeshStandardMaterial({ color: 0x1A237E, roughness: 0.7 })
            );
            hat.position.y = 22; g.add(hat);

            // Staff on weapon arm
            const staff = new THREE.Mesh(
                new THREE.CylinderGeometry(0.5, 0.5, 24, 6),
                new THREE.MeshStandardMaterial({ color: 0x5D4037, roughness: 0.8 })
            );
            staff.position.y = -8;
            staff.userData.isWeapon = true;
            staff.userData.weaponType = 'staff';
            rightArmPivot.add(staff);

            // Orb on top of staff
            const orb = new THREE.Mesh(
                new THREE.SphereGeometry(2, 8, 8),
                new THREE.MeshStandardMaterial({ color: 0xE040FB, emissive: 0xE040FB, emissiveIntensity: 0.8 })
            );
            orb.position.y = -20;
            rightArmPivot.add(orb);

        } else {
            // Hood
            const hood = new THREE.Mesh(
                new THREE.ConeGeometry(4, 6, 6),
                new THREE.MeshStandardMaterial({ color: 0x2E7D32, roughness: 0.7 })
            );
            hood.position.y = 19; g.add(hood);

            // Bow on weapon arm
            const bow = new THREE.Mesh(
                new THREE.TorusGeometry(5, 0.4, 4, 8, Math.PI),
                new THREE.MeshStandardMaterial({ color: 0x6D4C41, roughness: 0.8 })
            );
            bow.position.y = -3;
            bow.rotation.z = Math.PI / 2;
            bow.userData.isWeapon = true;
            bow.userData.weaponType = 'bow';
            rightArmPivot.add(bow);

            // Quiver on back
            const quiver = new THREE.Mesh(
                new THREE.CylinderGeometry(1.5, 1.5, 10, 6),
                new THREE.MeshStandardMaterial({ color: 0x5D4037, roughness: 0.8 })
            );
            quiver.position.set(0, 10, -3); g.add(quiver);
        }

        // Shadow disc
        const shadow = new THREE.Mesh(
            new THREE.CircleGeometry(5, 8),
            new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2 })
        );
        shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.2; g.add(shadow);

        // Store refs for animation
        g.userData.parts = { torso, head, leftArm, rightArmPivot, leftLeg, rightLeg };
        g.userData.swingState = { active: false, time: 0, direction: 'right', combo: 0 };

        return g;
    }

    _mobModel(type, isBoss) {
        const g = new THREE.Group();
        const c = MOB_COLORS[type] || 0xFF00FF;
        const s = isBoss ? 2.5 : 1;

        if (type === 'slime') {
            const body = new THREE.Mesh(new THREE.SphereGeometry(6 * s, 8, 6), new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity: 0.85 }));
            body.scale.y = 0.6; body.position.y = 4 * s; body.castShadow = true; g.add(body);
            // Eyes
            [-2 * s, 2 * s].forEach(ox => {
                const e = new THREE.Mesh(new THREE.SphereGeometry(1.2 * s, 4, 4), new THREE.MeshBasicMaterial({ color: 0x111111 }));
                e.position.set(ox, 5 * s, 4 * s); g.add(e);
            });
        } else if (type === 'skeleton') {
            const rib = new THREE.Mesh(new THREE.CylinderGeometry(2 * s, 1.5 * s, 12 * s, 6), new THREE.MeshStandardMaterial({ color: c }));
            rib.position.y = 6 * s; rib.castShadow = true; g.add(rib);
            const skull = new THREE.Mesh(new THREE.SphereGeometry(3 * s, 6, 6), new THREE.MeshStandardMaterial({ color: 0xFAFAFA }));
            skull.position.y = 14 * s; skull.castShadow = true; g.add(skull);
            [-1 * s, 1 * s].forEach(ox => {
                const e = new THREE.Mesh(new THREE.SphereGeometry(0.8 * s, 4, 4), new THREE.MeshBasicMaterial({ color: 0x111111 }));
                e.position.set(ox, 14.5 * s, 2 * s); g.add(e);
            });
            const sword = new THREE.Mesh(new THREE.BoxGeometry(0.8 * s, 10 * s, 0.4 * s), new THREE.MeshStandardMaterial({ color: 0x888888 }));
            sword.position.set(4 * s, 8 * s, 0); g.add(sword);
        } else if (type === 'wolf') {
            const body = new THREE.Mesh(new THREE.CapsuleGeometry(3 * s, 10 * s, 4, 8), new THREE.MeshStandardMaterial({ color: c }));
            body.rotation.z = Math.PI / 2; body.position.y = 5 * s; body.castShadow = true; g.add(body);
            const head = new THREE.Mesh(new THREE.SphereGeometry(3 * s, 6, 6), new THREE.MeshStandardMaterial({ color: 0x9E9E9E }));
            head.position.set(8 * s, 6 * s, 0); g.add(head);
            [-1 * s, 1 * s].forEach(ox => {
                const e = new THREE.Mesh(new THREE.SphereGeometry(0.6 * s, 4, 4), new THREE.MeshBasicMaterial({ color: 0xFF0000 }));
                e.position.set(9 * s, 7 * s, ox); g.add(e);
            });
        } else if (type === 'darkmage') {
            const robe = new THREE.Mesh(new THREE.ConeGeometry(5 * s, 16 * s, 6), new THREE.MeshStandardMaterial({ color: c }));
            robe.position.y = 8 * s; robe.castShadow = true; g.add(robe);
            const head = new THREE.Mesh(new THREE.SphereGeometry(2.5 * s, 6, 6), new THREE.MeshStandardMaterial({ color: 0x4A148C }));
            head.position.y = 18 * s; g.add(head);
            const orb = new THREE.Mesh(new THREE.SphereGeometry(1.5 * s, 8, 8), new THREE.MeshStandardMaterial({ color: 0xE040FB, emissive: 0xE040FB, emissiveIntensity: 1 }));
            orb.position.set(5 * s, 16 * s, 0); g.add(orb);
        } else if (type === 'dragon') {
            const body = new THREE.Mesh(new THREE.CapsuleGeometry(8, 20, 4, 8), new THREE.MeshStandardMaterial({ color: c }));
            body.position.y = 15; body.castShadow = true; g.add(body);
            const head = new THREE.Mesh(new THREE.ConeGeometry(6, 12, 4), new THREE.MeshStandardMaterial({ color: 0xFF2200 }));
            head.rotation.x = Math.PI / 2; head.position.set(0, 20, 14); g.add(head);
            // Wings
            [-1, 1].forEach(side => {
                const wing = new THREE.Mesh(new THREE.PlaneGeometry(25, 15), new THREE.MeshStandardMaterial({ color: 0xFF4400, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
                wing.position.set(side * 18, 20, -5); wing.rotation.y = side * 0.3; g.add(wing);
            });
        } else if (type === 'kraken') {
            const body = new THREE.Mesh(new THREE.SphereGeometry(12, 8, 8), new THREE.MeshStandardMaterial({ color: c }));
            body.position.y = 12; body.castShadow = true; g.add(body);
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                const tent = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 0.5, 18, 6), new THREE.MeshStandardMaterial({ color: 0x00ACC1 }));
                tent.position.set(Math.cos(a) * 14, 4, Math.sin(a) * 14);
                tent.rotation.x = Math.cos(a) * 0.4; tent.rotation.z = Math.sin(a) * 0.4;
                g.add(tent);
            }
            // Eyes
            [-4, 4].forEach(ox => {
                const e = new THREE.Mesh(new THREE.SphereGeometry(2, 6, 6), new THREE.MeshBasicMaterial({ color: 0x76FF03 }));
                e.position.set(ox, 16, 10); g.add(e);
            });
        }

        // Shadow
        const sh = new THREE.Mesh(new THREE.CircleGeometry(6 * s, 8), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.2 }));
        sh.rotation.x = -Math.PI / 2; sh.position.y = 0.1; g.add(sh);
        return g;
    }

    // =================== PLAYER ===================
    _spawnPlayer() {
        const cls = this.user.class || 'warrior';
        this.playerModel = this._charModel(cls);
        this.playerModel.position.set(this.user.x || 1500, 0, this.user.y || 1500);
        this.scene.add(this.playerModel);
        this.playerSpeed = CLASS_SPEED[cls] || 140;

        // HP bar (world-space)
        this.hpBar = this._createHPBar(36);
        this.playerModel.add(this.hpBar);
        this.hpBar.position.y = 22;

        // Name label (CSS2D alternative: create a div)
        this._createLabel(this.user.login, this.playerModel);
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
        MOBS.forEach(def => this._spawnMob(def));
    }

    _spawnMob(def) {
        const model = this._mobModel(def.type, def.isBoss);
        model.position.set(def.x, 0, def.z);
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
            alive: true, hpBar: hp, wanderT: 0, wanderA: Math.random() * Math.PI * 2, lastAtk: 0
        });
    }

    // =================== INPUT ===================
    _input() {
        document.addEventListener('keydown', e => { this.keys[e.code] = true; });
        document.addEventListener('keyup', e => { this.keys[e.code] = false; });

        // Mouse tracking for directional swings
        this.mouseVelocity = { x: 0, y: 0 };
        this.lastMousePos = { x: 0, y: 0 };
        this.isBlocking = false;

        this.renderer.domElement.addEventListener('mousemove', e => {
            const rect = this.renderer.domElement.getBoundingClientRect();
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            // Track mouse velocity for swing direction
            this.mouseVelocity.x = e.clientX - this.lastMousePos.x;
            this.mouseVelocity.y = e.clientY - this.lastMousePos.y;
            this.lastMousePos.x = e.clientX;
            this.lastMousePos.y = e.clientY;
        });

        this.renderer.domElement.addEventListener('mousedown', e => {
            if (e.button === 0) this._attack();
            if (e.button === 2) this._startBlock();
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

    _getMouseWorldPos() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const target = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(plane, target);
        return target;
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
        const now = performance.now();
        const cls = this.user.class || 'warrior';
        const cd = CLASS_ATK_CD[cls] || 600;
        if (now - this.lastAtk < cd) return;
        if (this.isBlocking) return;
        this.lastAtk = now;

        const target = this._getMouseWorldPos();
        if (!target) return;
        const pos = this.playerModel.position;
        const angle = Math.atan2(target.x - pos.x, target.z - pos.z);
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

        if (cls === 'warrior') {
            this._swingWeapon(swingDir);
            this._melee(pos, angle, comboDmg, true, swingDir);
        } else if (cls === 'archer') {
            this._swingWeapon('thrust');
            this._ranged(pos, angle, comboDmg, 0x8D6E63, 400, 2000, true);
        } else {
            this._swingWeapon('thrust');
            this._ranged(pos, angle, comboDmg, 0xE040FB, 300, 2500, true);
        }

        // Show combo indicator
        if (state.combo > 0) {
            this._floatDmg(pos, `${state.combo + 1}x COMBO!`, '#FFD700');
        }

        broadcastAttack({ playerId: this.user.id, cls, x: Math.round(pos.x), z: Math.round(pos.z), angle, swingDir });
    }

    _swingWeapon(direction) {
        const parts = this.playerModel.userData.parts;
        if (!parts) return;
        const pivot = parts.rightArmPivot;
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
            overhead: { startZ: 0, endZ: 0, startX: -1.5, endX: 0.8 },
            thrust: { startZ: 0, endZ: 0, startX: -0.3, endX: 0.6 },
        };
        const arc = arcs[direction] || arcs.right;

        // Weapon trail
        this._createWeaponTrail(direction);

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
        // Raise left arm / shield
        parts.leftArm.rotation.z = -1.2;
        parts.leftArm.rotation.x = 0.5;
    }

    _endBlock() {
        this.isBlocking = false;
        const parts = this.playerModel.userData.parts;
        if (!parts) return;
        parts.leftArm.rotation.z = 0.2;
        parts.leftArm.rotation.x = 0;
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
                    this._dmg(e, dmg);
                    // Knockback
                    const kbForce = swingDir === 'overhead' ? 8 : swingDir === 'thrust' ? 12 : 6;
                    e.model.position.x += Math.sin(angle) * kbForce;
                    e.model.position.z += Math.cos(angle) * kbForce;
                    // Hit impact effect
                    this._hitImpact(e.model.position, swingDir);
                }
            });
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
        const geo = new THREE.SphereGeometry(1.5, 6, 6);
        const mat = new THREE.MeshBasicMaterial({ color });
        const proj = new THREE.Mesh(geo, mat);
        proj.position.set(pos.x + Math.sin(angle) * 10, 8, pos.z + Math.cos(angle) * 10);
        this.scene.add(proj);

        // Glow
        const glow = new THREE.PointLight(color, 2, 40);
        proj.add(glow);

        this.projectiles.push({
            mesh: proj, vx: Math.sin(angle) * speed, vz: Math.cos(angle) * speed,
            dmg, isLocal, born: performance.now(), life: lifespan
        });
    }

    _dmg(enemy, amount) {
        if (!enemy.alive) return;
        enemy.hp -= amount;
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
        const start = performance.now();
        const pos = enemy.model.position.clone();
        const anim = () => {
            const t = (performance.now() - start) / 500;
            if (t >= 1) { this.scene.remove(enemy.model); return; }
            enemy.model.scale.set(1 - t, 1 - t, 1 - t);
            enemy.model.position.y = -t * 5;
            requestAnimationFrame(anim);
        }; anim();

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
            enemy.model.position.set(enemy.def.x, 0, enemy.def.z);
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

    _showNotification(text) {
        const div = document.createElement('div');
        div.textContent = text;
        div.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#FFD700;padding:12px 24px;border-radius:8px;font:bold 16px Inter;z-index:9999;transition:opacity 1s;';
        document.body.appendChild(div);
        setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 1000); }, 3000);
    }

    // =================== INTERACT ===================
    _interact() {
        // Simple proximity notification for now
        const px = this.playerModel.position.x, pz = this.playerModel.position.z;
        // Check if near village center NPCs
        if (Math.hypot(px - 1500, pz - 1500) < 100) {
            this._showNotification('🏠 Добро пожаловать в деревню!');
        }
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
            }
        );
    }

    async _sync() {
        this.user.x = Math.round(this.playerModel.position.x);
        this.user.y = Math.round(this.playerModel.position.z);
        const players = await dbSync(this.user);
        this._updateOthers(players);
        if (window.updateHUD) window.updateHUD();
    }

    _updateOthers(players) {
        const active = new Set();
        players.forEach(p => {
            if (p.id === this.user.id) return;
            active.add(p.id);
            if (this.others[p.id]) {
                const m = this.others[p.id];
                m.position.x += (p.x - m.position.x) * 0.1;
                m.position.z += (p.y - m.position.z) * 0.1;
                const a = Math.atan2(p.x - m.position.x, p.y - m.position.z);
                if (Math.abs(a) > 0.01) m.rotation.y = a;
            } else {
                const m = this._charModel(p.class || 'warrior');
                m.position.set(p.x, 0, p.y);
                this._createLabel(p.login, m);
                this.scene.add(m);
                this.others[p.id] = m;
            }
        });
        Object.keys(this.others).forEach(id => {
            if (!active.has(parseInt(id))) { this.scene.remove(this.others[id]); delete this.others[id]; }
        });
    }

    // =================== AMBIENT ===================
    _createParticles() {
        const count = 500;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            positions[i * 3] = Math.random() * MAP;
            positions[i * 3 + 1] = 5 + Math.random() * 80;
            positions[i * 3 + 2] = Math.random() * MAP;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({ color: 0xffffee, size: 1.5, transparent: true, opacity: 0.4, sizeAttenuation: true });
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
        for (let i = 0; i < 12; i++) {
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.3 + Math.random() * 0.2 }));
            const s = 150 + Math.random() * 200;
            sprite.scale.set(s, s * 0.4, 1);
            sprite.position.set(Math.random() * MAP, 250 + Math.random() * 100, Math.random() * MAP);
            sprite.userData.speed = 3 + Math.random() * 5;
            this.scene.add(sprite);
            this.clouds.push(sprite);
        }
    }

    _updateAmbient(time, dt) {
        // Particle floating
        if (this.particles) {
            const positions = this.particles.geometry.attributes.position.array;
            for (let i = 0; i < positions.length; i += 3) {
                positions[i + 1] += Math.sin(time * 0.001 + positions[i]) * 0.05;
                positions[i] += Math.cos(time * 0.0005 + positions[i + 2]) * 0.08;
                if (positions[i + 1] > 90) positions[i + 1] = 5;
                if (positions[i + 1] < 3) positions[i + 1] = 80;
            }
            this.particles.geometry.attributes.position.needsUpdate = true;
        }

        // Cloud movement
        this.clouds.forEach(c => {
            c.position.x += c.userData.speed * dt;
            if (c.position.x > MAP + 200) c.position.x = -200;
        });

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

        // Camera shake decay
        if (this.shakeIntensity > 0) {
            this.shakeIntensity *= 0.9;
            if (this.shakeIntensity < 0.1) this.shakeIntensity = 0;
            this.shakeOffset.set(
                (Math.random() - 0.5) * this.shakeIntensity,
                (Math.random() - 0.5) * this.shakeIntensity * 0.5,
                (Math.random() - 0.5) * this.shakeIntensity
            );
        }
    }

    // =================== GAME LOOP ===================
    _loop() {
        requestAnimationFrame(() => this._loop());
        const dt = this.clock.getDelta();
        const time = performance.now();
        this._updatePlayer(dt);
        this._updateEnemyAI(dt);
        this._updateProj(dt);
        this._updateAmbient(time, dt);
        this._updateCam();

        // Sync every 500ms
        if (time - this.lastSync > 500) { this.lastSync = time; this._sync(); }

        this.composer.render();
    }

    _updatePlayer(dt) {
        let vx = 0, vz = 0;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) vx -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) vx += 1;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) vz -= 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) vz += 1;
        if (vx && vz) { vx *= 0.707; vz *= 0.707; }

        const spd = this.playerSpeed * dt;
        this.playerModel.position.x = Math.max(10, Math.min(MAP - 10, this.playerModel.position.x + vx * spd));
        this.playerModel.position.z = Math.max(10, Math.min(MAP - 10, this.playerModel.position.z + vz * spd));

        // Face mouse
        const target = this._getMouseWorldPos();
        if (target) {
            const a = Math.atan2(target.x - this.playerModel.position.x, target.z - this.playerModel.position.z);
            this.playerModel.rotation.y += (a - this.playerModel.rotation.y) * 0.15;
        }

        // Procedural walk animation
        const parts = this.playerModel.userData.parts;
        if (parts && (vx || vz)) {
            const t = performance.now() * 0.008;
            // Leg swing
            parts.leftLeg.rotation.x = Math.sin(t) * 0.5;
            parts.rightLeg.rotation.x = Math.sin(t + Math.PI) * 0.5;
            // Arm swing (only left, right is weapon)
            if (!this.isBlocking) {
                parts.leftArm.rotation.x = Math.sin(t + Math.PI) * 0.4;
            }
            // Body bob
            this.playerModel.position.y = Math.abs(Math.sin(t * 2)) * 0.8;
            // Slight torso lean
            parts.torso.rotation.x = 0.05;
        } else if (parts) {
            // Idle: return to rest + breathing
            const breath = Math.sin(performance.now() * 0.003) * 0.02;
            parts.leftLeg.rotation.x *= 0.85;
            parts.rightLeg.rotation.x *= 0.85;
            if (!this.isBlocking) parts.leftArm.rotation.x *= 0.85;
            parts.torso.rotation.x = breath;
            this.playerModel.position.y *= 0.9;
        }

        // HP bar
        const pct = (this.user.hp || 100) / (this.user.max_hp || 100);
        this.hpBar.fillMesh.scale.x = Math.max(0.01, pct);
        this.hpBar.fillMesh.position.x = -this.hpBar.maxW * (1 - pct) / 2;
        this.hpBar.fillMesh.material.color.setHex(pct > 0.5 ? 0x4CAF50 : pct > 0.25 ? 0xFFC107 : 0xFF4B4B);
    }

    _updateEnemyAI(dt) {
        const px = this.playerModel.position.x, pz = this.playerModel.position.z;
        this.enemies.forEach(e => {
            if (!e.alive) return;
            const ex = e.model.position.x, ez = e.model.position.z;
            const dist = Math.hypot(px - ex, pz - ez);

            if (dist < e.def.range) {
                // Chase
                const a = Math.atan2(px - ex, pz - ez);
                e.model.position.x += Math.sin(a) * e.def.spd * dt;
                e.model.position.z += Math.cos(a) * e.def.spd * dt;
                e.model.rotation.y = a;
                // Melee
                if (dist < (e.def.isBoss ? 40 : 20) && performance.now() - e.lastAtk > 1200) {
                    e.lastAtk = performance.now();
                    let dmg = Math.max(1, e.def.atk - (this.user.defense || 5));
                    // Block reduces damage
                    if (this.isBlocking) {
                        dmg = Math.round(dmg * 0.4);
                        this._floatDmg(this.playerModel.position, 'BLOCKED', '#44AAFF');
                        this.shakeIntensity = 1;
                    } else {
                        this.shakeIntensity = e.def.isBoss ? 8 : 4;
                    }
                    this.user.hp = Math.max(0, (this.user.hp || 100) - dmg);
                    this._floatDmg(this.playerModel.position, dmg, '#FF4B4B');
                    if (window.updateHUD) window.updateHUD();
                    if (this.user.hp <= 0) { this.user.hp = this.user.max_hp || 100; this.playerModel.position.set(1500, 0, 1500); this._showNotification('💀 Ты погиб!'); }
                }
            } else {
                // Wander
                e.wanderT -= dt * 1000;
                if (e.wanderT <= 0) { e.wanderT = 2000 + Math.random() * 3000; e.wanderA = Math.random() * Math.PI * 2; }
                if (Math.random() > 0.003) {
                    e.model.position.x += Math.sin(e.wanderA) * e.def.spd * 0.3 * dt;
                    e.model.position.z += Math.cos(e.wanderA) * e.def.spd * 0.3 * dt;
                    e.model.rotation.y = e.wanderA;
                }
            }

            // Breathing animation
            e.model.position.y = Math.sin(performance.now() * 0.003 + e.def.x) * 0.5;

            // HP bar
            const pct = e.hp / e.maxHp;
            e.hpBar.fillMesh.scale.x = Math.max(0.01, pct);
            e.hpBar.fillMesh.position.x = -e.hpBar.maxW * (1 - pct) / 2;
            e.hpBar.fillMesh.material.color.setHex(pct > 0.5 ? 0x4CAF50 : pct > 0.25 ? 0xFFC107 : 0xFF4B4B);
        });
    }

    _updateProj(dt) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.mesh.position.x += p.vx * dt;
            p.mesh.position.z += p.vz * dt;

            // Hit check
            if (p.isLocal) {
                for (const e of this.enemies) {
                    if (!e.alive) continue;
                    if (Math.hypot(e.model.position.x - p.mesh.position.x, e.model.position.z - p.mesh.position.z) < (e.def.isBoss ? 30 : 15)) {
                        this._dmg(e, p.dmg);
                        this.scene.remove(p.mesh);
                        this.projectiles.splice(i, 1);
                        break;
                    }
                }
            }

            // Lifetime
            if (performance.now() - p.born > p.life) {
                this.scene.remove(p.mesh);
                this.projectiles.splice(i, 1);
            }
        }
    }

    _updateCam() {
        const px = this.playerModel.position.x, pz = this.playerModel.position.z;
        // Smooth follow
        this.camera.position.x += (px + this.shakeOffset.x - this.camera.position.x) * 0.08;
        this.camera.position.z += (pz + CAM_DIST + this.shakeOffset.z - this.camera.position.z) * 0.08;
        this.camera.position.y += (CAM_H + this.shakeOffset.y - this.camera.position.y) * 0.08;
        this.camera.lookAt(px, 0, pz);

        // Move sun with player
        this.sun.position.set(px + 300, 500, pz + 200);
        this.sun.target.position.set(px, 0, pz);
    }
}
