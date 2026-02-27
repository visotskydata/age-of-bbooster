// js/map/MapGenerator.js
// Procedural map with zones, paths, water, vegetation, structures

export class MapGenerator {
    constructor(scene) {
        this.scene = scene;
        this.W = 3000;
        this.H = 3000;
        this.obstacles = null;
    }

    generate() {
        this.obstacles = this.scene.physics.add.staticGroup();
        this._createTextures();
        this._buildGround();
        this._buildPaths();
        this._buildWater();
        this._placeObstacles();
        this._addDecorations();
        this._addEffects();
        return { obstacles: this.obstacles, worldW: this.W, worldH: this.H };
    }

    /* ===========================
       TEXTURE GENERATION
    =========================== */
    _createTextures() {
        const s = this.scene;
        let g;

        // --- GRASS ---
        g = s.make.graphics({ add: false });
        g.fillStyle(0x5a9e4b);
        g.fillRect(0, 0, 128, 128);
        for (let i = 0; i < 80; i++) {
            g.fillStyle([0x4e8e3f, 0x528f42, 0x5da84d, 0x478537][i % 4], 0.5);
            g.fillRect(Phaser.Math.Between(0, 124), Phaser.Math.Between(0, 124),
                Phaser.Math.Between(2, 5), Phaser.Math.Between(2, 5));
        }
        for (let i = 0; i < 15; i++) {
            g.fillStyle(0x6bb85a, 0.7);
            g.fillRect(Phaser.Math.Between(0, 126), Phaser.Math.Between(0, 126), 1, Phaser.Math.Between(3, 6));
        }
        g.generateTexture('tex_grass', 128, 128);
        g.destroy();

        // --- DARK GRASS (forest floor) ---
        g = s.make.graphics({ add: false });
        g.fillStyle(0x3d6b2e);
        g.fillRect(0, 0, 128, 128);
        for (let i = 0; i < 60; i++) {
            g.fillStyle([0x355e26, 0x2d5220, 0x3a6529, 0x305a22][i % 4], 0.5);
            g.fillRect(Phaser.Math.Between(0, 124), Phaser.Math.Between(0, 124),
                Phaser.Math.Between(2, 6), Phaser.Math.Between(2, 6));
        }
        g.generateTexture('tex_grass_dark', 128, 128);
        g.destroy();

        // --- STONE PATH ---
        g = s.make.graphics({ add: false });
        g.fillStyle(0x8a8a7a);
        g.fillRect(0, 0, 64, 64);
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                g.fillStyle([0x9e9e8e, 0x8a8a7a, 0x7a7a6a, 0xa0a090][(r + c) % 4]);
                const ox = r % 2 === 0 ? 0 : 8;
                g.fillRect(c * 16 + ox + 1, r * 16 + 1, 14, 14);
                g.fillStyle(0xb0b0a0, 0.3);
                g.fillRect(c * 16 + ox + 1, r * 16 + 1, 14, 2);
            }
        }
        g.generateTexture('tex_stone', 64, 64);
        g.destroy();

        // --- WATER ---
        g = s.make.graphics({ add: false });
        g.fillStyle(0x1565C0);
        g.fillRect(0, 0, 128, 128);
        for (let i = 0; i < 40; i++) {
            g.fillStyle([0x1976D2, 0x0D47A1, 0x1E88E5, 0x2196F3][i % 4], 0.4);
            g.fillRect(Phaser.Math.Between(0, 100), Phaser.Math.Between(0, 124),
                Phaser.Math.Between(10, 30), Phaser.Math.Between(2, 4));
        }
        for (let i = 0; i < 8; i++) {
            g.fillStyle(0x64B5F6, 0.3);
            g.fillRect(Phaser.Math.Between(0, 118), Phaser.Math.Between(0, 124), Phaser.Math.Between(5, 15), 1);
        }
        g.generateTexture('tex_water', 128, 128);
        g.destroy();

        // --- SAND ---
        g = s.make.graphics({ add: false });
        g.fillStyle(0xE8D5A3);
        g.fillRect(0, 0, 128, 128);
        for (let i = 0; i < 40; i++) {
            g.fillStyle(i % 2 ? 0xD4C193 : 0xF0DDB0, 0.4);
            g.fillRect(Phaser.Math.Between(0, 124), Phaser.Math.Between(0, 124),
                Phaser.Math.Between(2, 4), Phaser.Math.Between(2, 4));
        }
        g.generateTexture('tex_sand', 128, 128);
        g.destroy();

        // --- PINE TREE ---
        g = s.make.graphics({ add: false });
        g.fillStyle(0x5D4037); g.fillRect(21, 55, 8, 25);
        g.fillStyle(0x2E7D32); g.fillTriangle(25, 30, 5, 65, 45, 65);
        g.fillStyle(0x388E3C); g.fillTriangle(25, 18, 9, 48, 41, 48);
        g.fillStyle(0x43A047); g.fillTriangle(25, 5, 13, 32, 37, 32);
        g.fillStyle(0x66BB6A, 0.4); g.fillTriangle(25, 6, 15, 28, 25, 28);
        g.generateTexture('tex_pine', 50, 80);
        g.destroy();

        // --- OAK TREE ---
        g = s.make.graphics({ add: false });
        g.fillStyle(0x5D4037); g.fillRect(30, 55, 10, 35);
        g.fillStyle(0x2E7D32); g.fillCircle(37, 38, 28);
        g.fillStyle(0x4CAF50); g.fillCircle(35, 35, 26);
        g.fillStyle(0x66BB6A, 0.6); g.fillCircle(28, 28, 12);
        g.fillStyle(0x81C784, 0.5); g.fillCircle(42, 30, 10);
        g.generateTexture('tex_oak', 70, 90);
        g.destroy();

        // --- WILLOW TREE ---
        g = s.make.graphics({ add: false });
        g.fillStyle(0x6D4C41); g.fillRect(35, 40, 10, 60);
        g.fillStyle(0x558B2F); g.fillCircle(40, 35, 30);
        g.fillStyle(0x689F38, 0.7);
        for (let i = 0; i < 12; i++) g.fillRect(Phaser.Math.Between(15, 65), 35, 2, Phaser.Math.Between(20, 45));
        g.fillStyle(0x7CB342, 0.5); g.fillCircle(35, 28, 15);
        g.generateTexture('tex_willow', 80, 100);
        g.destroy();

        // --- BUSH ---
        g = s.make.graphics({ add: false });
        g.fillStyle(0x388E3C); g.fillCircle(20, 18, 14); g.fillCircle(10, 20, 10); g.fillCircle(30, 20, 10);
        g.fillStyle(0x4CAF50, 0.7); g.fillCircle(18, 14, 8); g.fillCircle(26, 16, 7);
        g.generateTexture('tex_bush', 40, 28);
        g.destroy();

        // --- LARGE ROCK ---
        g = s.make.graphics({ add: false });
        g.fillStyle(0x757575); g.fillRoundedRect(5, 8, 40, 28, 8);
        g.fillStyle(0x9E9E9E, 0.6); g.fillRoundedRect(8, 8, 30, 12, 6);
        g.fillStyle(0x546E7A, 0.5); g.fillRoundedRect(8, 24, 34, 10, 4);
        g.lineStyle(1, 0x616161, 0.5); g.lineBetween(15, 12, 20, 28); g.lineBetween(30, 10, 35, 25);
        g.generateTexture('tex_rock_lg', 50, 38);
        g.destroy();

        // --- SMALL ROCK ---
        g = s.make.graphics({ add: false });
        g.fillStyle(0x78909C); g.fillRoundedRect(4, 5, 20, 13, 5);
        g.fillStyle(0x90A4AE, 0.5); g.fillRoundedRect(6, 5, 14, 6, 3);
        g.generateTexture('tex_rock_sm', 28, 20);
        g.destroy();

        // --- SHADOW ---
        g = s.make.graphics({ add: false });
        g.fillStyle(0x000000, 0.25); g.fillEllipse(30, 8, 56, 14);
        g.generateTexture('tex_shadow', 60, 16);
        g.destroy();

        // --- FLOWERS ---
        [
            { k: 'tex_flower_r', p: 0xE53935, c: 0xFFEB3B },
            { k: 'tex_flower_y', p: 0xFDD835, c: 0x795548 },
            { k: 'tex_flower_p', p: 0xAB47BC, c: 0xFFEB3B },
            { k: 'tex_flower_w', p: 0xFFFFFF, c: 0xFFC107 },
        ].forEach(f => {
            g = s.make.graphics({ add: false });
            g.fillStyle(0x558B2F); g.fillRect(7, 8, 2, 8);
            g.fillStyle(f.p); g.fillCircle(8, 4, 4); g.fillCircle(4, 6, 3); g.fillCircle(12, 6, 3);
            g.fillStyle(f.c); g.fillCircle(8, 6, 2);
            g.generateTexture(f.k, 16, 16);
            g.destroy();
        });

        // --- TALL GRASS ---
        g = s.make.graphics({ add: false });
        for (let i = 0; i < 6; i++) {
            g.fillStyle([0x7CB342, 0x689F38, 0x558B2F, 0x8BC34A][i % 4]);
            g.fillRect(4 + i * 2, Phaser.Math.Between(2, 10), 2, Phaser.Math.Between(12, 22));
        }
        g.generateTexture('tex_tallgrass', 20, 28);
        g.destroy();

        // --- MUSHROOM ---
        g = s.make.graphics({ add: false });
        g.fillStyle(0xEFEBE9); g.fillRect(5, 8, 4, 8);
        g.fillStyle(0xC62828); g.fillCircle(7, 7, 7);
        g.fillStyle(0xFFFFFF); g.fillCircle(5, 5, 2); g.fillCircle(9, 4, 1.5);
        g.generateTexture('tex_mushroom', 14, 16);
        g.destroy();

        // --- HOUSE ---
        g = s.make.graphics({ add: false });
        g.fillStyle(0x8D6E63); g.fillRect(8, 30, 80, 48);
        g.lineStyle(1, 0x6D4C41, 0.4);
        for (let y = 35; y < 78; y += 8) g.lineBetween(8, y, 88, y);
        g.fillStyle(0x5D4037); g.fillTriangle(48, 5, 0, 35, 96, 35);
        g.fillStyle(0x6D4C41, 0.5); g.fillTriangle(48, 8, 10, 33, 48, 33);
        g.fillStyle(0x4E342E); g.fillRect(38, 48, 20, 30);
        g.fillStyle(0xFFC107); g.fillCircle(53, 63, 2);
        g.fillStyle(0xFFF9C4); g.fillRect(15, 42, 16, 14); g.fillRect(65, 42, 16, 14);
        g.lineStyle(2, 0x5D4037);
        g.lineBetween(23, 42, 23, 56); g.lineBetween(15, 49, 31, 49);
        g.lineBetween(73, 42, 73, 56); g.lineBetween(65, 49, 81, 49);
        g.generateTexture('tex_house', 96, 80);
        g.destroy();

        // --- WELL ---
        g = s.make.graphics({ add: false });
        g.fillStyle(0x757575); g.fillRoundedRect(4, 25, 40, 25, 5);
        g.fillStyle(0x9E9E9E, 0.4); g.fillRoundedRect(6, 25, 36, 10, 4);
        g.fillStyle(0x1A1A1A); g.fillEllipse(24, 32, 24, 10);
        g.fillStyle(0x5D4037); g.fillRect(8, 8, 4, 30); g.fillRect(36, 8, 4, 30); g.fillRect(8, 8, 32, 4);
        g.lineStyle(1, 0x8D6E63); g.lineBetween(24, 10, 24, 28);
        g.fillStyle(0x6D4C41); g.fillRect(20, 26, 8, 6);
        g.generateTexture('tex_well', 48, 52);
        g.destroy();

        // --- FENCE ---
        g = s.make.graphics({ add: false });
        g.fillStyle(0x795548); g.fillRect(2, 0, 5, 28); g.fillRect(41, 0, 5, 28);
        g.fillStyle(0x8D6E63); g.fillRect(0, 8, 48, 3); g.fillRect(0, 18, 48, 3);
        g.generateTexture('tex_fence', 48, 28);
        g.destroy();

        // --- CAMPFIRE ---
        g = s.make.graphics({ add: false });
        g.fillStyle(0x757575);
        g.fillCircle(6, 20, 4); g.fillCircle(14, 22, 5); g.fillCircle(22, 20, 4);
        g.fillStyle(0xFF6F00); g.fillTriangle(14, 4, 8, 18, 20, 18);
        g.fillStyle(0xFFCA28, 0.8); g.fillTriangle(14, 8, 10, 16, 18, 16);
        g.fillStyle(0xFFF9C4, 0.6); g.fillTriangle(14, 10, 12, 15, 16, 15);
        g.generateTexture('tex_campfire', 28, 28);
        g.destroy();

        // --- REED ---
        g = s.make.graphics({ add: false });
        g.fillStyle(0x6D8B22); g.fillRect(5, 6, 2, 26);
        g.fillStyle(0x8B7355); g.fillRoundedRect(3, 0, 6, 10, 3);
        g.generateTexture('tex_reed', 12, 32);
        g.destroy();

        // --- LILY PAD ---
        g = s.make.graphics({ add: false });
        g.fillStyle(0x2E7D32); g.fillEllipse(10, 6, 18, 10);
        g.fillStyle(0xF8BBD0); g.fillCircle(6, 4, 3);
        g.generateTexture('tex_lilypad', 20, 12);
        g.destroy();

        // --- PARTICLES ---
        g = s.make.graphics({ add: false });
        g.fillStyle(0x8BC34A, 0.8); g.fillEllipse(3, 3, 5, 3);
        g.generateTexture('tex_leaf', 6, 6);
        g.destroy();

        g = s.make.graphics({ add: false });
        g.fillStyle(0xFFFFFF, 0.9); g.fillCircle(2, 2, 2);
        g.generateTexture('tex_sparkle', 4, 4);
        g.destroy();
    }

    /* ===========================
       GROUND / TERRAIN
    =========================== */
    _buildGround() {
        const s = this.scene;
        const base = s.add.tileSprite(this.W / 2, this.H / 2, this.W, this.H, 'tex_grass');
        base.setDepth(-100);

        // Forest floor (NW)
        const forest = s.add.tileSprite(450, 450, 900, 900, 'tex_grass_dark');
        forest.setDepth(-99); forest.setAlpha(0.8);

        // Sand area near lake (SE)
        const sand = s.add.tileSprite(2450, 2450, 700, 600, 'tex_sand');
        sand.setDepth(-98); sand.setAlpha(0.7);

        // Rocky overlay (NE)
        const rock = s.add.graphics();
        rock.fillStyle(0x78706a, 0.3); rock.fillRoundedRect(2050, 100, 850, 750, 80);
        rock.setDepth(-97);

        // Meadow overlay (SW)
        const meadow = s.add.graphics();
        meadow.fillStyle(0x9CCC65, 0.2); meadow.fillRoundedRect(100, 2100, 800, 800, 100);
        meadow.setDepth(-97);

        // Village square (center)
        const square = s.add.tileSprite(1500, 1500, 250, 250, 'tex_stone');
        square.setDepth(-49); square.setAlpha(0.9);
    }

    /* ===========================
       PATHS
    =========================== */
    _buildPaths() {
        const pg = this.scene.add.graphics();
        pg.setDepth(-50);

        const draw = (pts, w, c) => {
            // Border
            pg.lineStyle(w + 6, 0x6D4C41, 0.15);
            pg.beginPath(); pg.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) pg.lineTo(pts[i].x, pts[i].y);
            pg.strokePath();
            // Main
            pg.lineStyle(w, c, 0.85);
            pg.beginPath(); pg.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) pg.lineTo(pts[i].x, pts[i].y);
            pg.strokePath();
        };

        const C = 0x8B7355;
        // Main cross through village
        draw([{x:900,y:1500},{x:2100,y:1500}], 42, C);
        draw([{x:1500,y:900},{x:1500,y:2100}], 42, C);
        // To forest (NW)
        draw([{x:1200,y:1300},{x:800,y:900},{x:500,y:600}], 30, C);
        // To mountains (NE)
        draw([{x:1800,y:1300},{x:2200,y:800},{x:2500,y:450}], 30, C);
        // To lake (SE)
        draw([{x:1800,y:1700},{x:2200,y:2100},{x:2500,y:2350}], 30, C);
        // To meadow (SW)
        draw([{x:1200,y:1700},{x:800,y:2100},{x:500,y:2500}], 30, C);
    }

    /* ===========================
       WATER (LAKE)
    =========================== */
    _buildWater() {
        const s = this.scene;
        const lx = 2500, ly = 2500;

        // Shore
        const shore = s.add.graphics();
        shore.fillStyle(0xE8D5A3, 0.5); shore.fillEllipse(lx, ly, 560, 460);
        shore.setDepth(-41);

        // Water
        const water = s.add.tileSprite(lx, ly, 480, 380, 'tex_water');
        water.setDepth(-40);
        s.tweens.add({ targets: water, tilePositionX: 128, tilePositionY: 64, duration: 8000, repeat: -1, ease: 'Sine.easeInOut' });

        // Lily pads
        [{x:lx-140,y:ly-90},{x:lx+100,y:ly-70},{x:lx-80,y:ly+50},{x:lx+160,y:ly+110}].forEach(p => {
            const l = s.add.image(p.x, p.y, 'tex_lilypad').setDepth(-39);
            s.tweens.add({ targets: l, y: p.y + 3, duration: Phaser.Math.Between(2000, 3500), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        });

        // Reeds
        [{x:lx-230,y:ly-140},{x:lx-250,y:ly-40},{x:lx-240,y:ly+80},{x:lx+230,y:ly-120},{x:lx+250,y:ly+60},{x:lx-80,y:ly+180},{x:lx+50,y:ly+190}]
        .forEach(p => {
            const r = s.add.image(p.x, p.y, 'tex_reed').setDepth(p.y);
            s.tweens.add({ targets: r, angle: { from: -5, to: 5 }, duration: Phaser.Math.Between(1500, 2500), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        });
    }

    /* ===========================
       OBSTACLES (with physics)
    =========================== */
    _placeObstacles() {
        this._placeTrees();
        this._placeRocks();
        this._placeBushes();
        this._placeStructures();
    }

    _addObstacle(x, y, tex, hitW, hitH) {
        const obs = this.obstacles.create(x, y, tex);
        obs.setDepth(y);
        obs.refreshBody();
        const w = obs.width, h = obs.height;
        obs.body.setSize(hitW || w * 0.4, hitH || h * 0.2);
        obs.body.setOffset((w - (hitW || w * 0.4)) / 2, h - (hitH || h * 0.2));
        // Shadow
        this.scene.add.image(x, y + h * 0.45, 'tex_shadow').setDepth(y - 1).setAlpha(0.3);
        return obs;
    }

    _placeTrees() {
        // FOREST (NW) — pine trees
        this._scatter(100, 850, 100, 850, 22, (x, y) => this._addObstacle(x, y, 'tex_pine', 20, 16));
        // FOREST — some oaks
        this._scatter(150, 800, 150, 800, 8, (x, y) => this._addObstacle(x, y, 'tex_oak', 20, 18));

        // MOUNTAINS (NE) — sparse pines
        this._scatter(2100, 2800, 150, 750, 10, (x, y) => this._addObstacle(x, y, 'tex_pine', 20, 16));

        // VILLAGE (center) — decorative oaks
        [
            {x:1300,y:1300},{x:1700,y:1300},{x:1300,y:1700},{x:1700,y:1700},
            {x:1100,y:1500},{x:1900,y:1500},{x:1500,y:1100},{x:1500,y:1900}
        ].forEach(p => this._addObstacle(p.x, p.y, 'tex_oak', 20, 18));

        // LAKE area — willows
        [{x:2250,y:2300},{x:2700,y:2350},{x:2350,y:2700},{x:2650,y:2650}]
        .forEach(p => this._addObstacle(p.x, p.y, 'tex_willow', 22, 20));

        // MEADOW (SW) — scattered oaks
        this._scatter(150, 800, 2150, 2800, 6, (x, y) => this._addObstacle(x, y, 'tex_oak', 20, 18));

        // Random pines across map (sparse)
        this._scatter(900, 2100, 200, 900, 5, (x, y) => this._addObstacle(x, y, 'tex_pine', 20, 16));
        this._scatter(900, 2100, 2100, 2800, 5, (x, y) => this._addObstacle(x, y, 'tex_pine', 20, 16));
    }

    _placeRocks() {
        // Mountains (NE) — lots of rocks
        this._scatter(2100, 2850, 120, 700, 15, (x, y) => this._addObstacle(x, y, 'tex_rock_lg', 30, 15));
        this._scatter(2100, 2850, 120, 700, 10, (x, y) => {
            const obs = this._addObstacle(x, y, 'tex_rock_sm', 16, 10);
            return obs;
        });

        // Forest (NW) — few rocks
        this._scatter(100, 800, 100, 800, 5, (x, y) => this._addObstacle(x, y, 'tex_rock_sm', 16, 10));

        // Random scattered
        this._scatter(200, 2800, 200, 2800, 8, (x, y) => this._addObstacle(x, y, 'tex_rock_lg', 30, 15));
    }

    _placeBushes() {
        // Forest edges
        this._scatter(700, 1000, 100, 900, 8, (x, y) => this._addObstacle(x, y, 'tex_bush', 24, 10));
        this._scatter(100, 900, 700, 1000, 8, (x, y) => this._addObstacle(x, y, 'tex_bush', 24, 10));
        // Village area
        this._scatter(1100, 1900, 1100, 1900, 6, (x, y) => this._addObstacle(x, y, 'tex_bush', 24, 10));
        // Meadow
        this._scatter(100, 800, 2100, 2800, 5, (x, y) => this._addObstacle(x, y, 'tex_bush', 24, 10));
    }

    _placeStructures() {
        // Village houses
        [{x:1350,y:1420},{x:1650,y:1420},{x:1350,y:1600},{x:1650,y:1600}]
        .forEach(p => this._addObstacle(p.x, p.y, 'tex_house', 70, 30));

        // Well in center
        this._addObstacle(1500, 1500, 'tex_well', 30, 20);

        // Campfire near well
        this.scene.add.image(1540, 1540, 'tex_campfire').setDepth(1541);

        // Fences around village
        for (let fx = 1100; fx <= 1850; fx += 50) {
            this._addObstacle(fx, 1200, 'tex_fence', 40, 8);
            this._addObstacle(fx, 1800, 'tex_fence', 40, 8);
        }
    }

    /* ===========================
       DECORATIONS (no physics)
    =========================== */
    _addDecorations() {
        const s = this.scene;
        const flowers = ['tex_flower_r', 'tex_flower_y', 'tex_flower_p', 'tex_flower_w'];

        // Meadow — dense flowers
        this._scatter(120, 780, 2120, 2780, 35, (x, y) => {
            s.add.image(x, y, Phaser.Utils.Array.GetRandom(flowers)).setDepth(y - 2);
        });

        // Forest — mushrooms
        this._scatter(120, 780, 120, 780, 12, (x, y) => {
            s.add.image(x, y, 'tex_mushroom').setDepth(y - 2);
        });

        // Tall grass everywhere
        this._scatter(100, 2900, 100, 2900, 40, (x, y) => {
            const tg = s.add.image(x, y, 'tex_tallgrass').setDepth(y - 2);
            s.tweens.add({ targets: tg, angle: { from: -3, to: 3 }, duration: Phaser.Math.Between(1800, 2800), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        });

        // Scattered flowers across the map
        this._scatter(100, 2900, 100, 2900, 25, (x, y) => {
            s.add.image(x, y, Phaser.Utils.Array.GetRandom(flowers)).setDepth(y - 2);
        });
    }

    /* ===========================
       PARTICLE EFFECTS
    =========================== */
    _addEffects() {
        const s = this.scene;

        // Falling leaves in forest area
        s.add.particles(450, 100, 'tex_leaf', {
            speed: { min: 10, max: 30 },
            angle: { min: 60, max: 120 },
            lifespan: 6000,
            frequency: 300,
            quantity: 1,
            scale: { start: 1, end: 0.5 },
            alpha: { start: 0.8, end: 0 },
            rotate: { min: 0, max: 360 },
            emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(0, 0, 800, 100) }
        }).setDepth(2000);

        // Sparkles on water
        s.add.particles(2500, 2500, 'tex_sparkle', {
            speed: { min: 5, max: 15 },
            lifespan: 2000,
            frequency: 500,
            quantity: 1,
            scale: { start: 1, end: 0 },
            alpha: { start: 0.9, end: 0 },
            emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-200, -160, 400, 320) }
        }).setDepth(2000);
    }

    /* ===========================
       HELPERS
    =========================== */
    _scatter(xMin, xMax, yMin, yMax, count, callback) {
        for (let i = 0; i < count; i++) {
            const x = Phaser.Math.Between(xMin, xMax);
            const y = Phaser.Math.Between(yMin, yMax);
            // Skip village center and lake center
            if (x > 1350 && x < 1650 && y > 1350 && y < 1650) continue;
            if (Math.hypot(x - 2500, y - 2500) < 250) continue;
            callback(x, y);
        }
    }
}
