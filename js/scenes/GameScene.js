import { dbSync } from '../core/db.js';
import { MapGenerator } from '../map/MapGenerator.js';
import { NpcSystem } from '../systems/NpcSystem.js';
import { QuestSystem } from '../systems/QuestSystem.js';
import { InventorySystem } from '../systems/InventorySystem.js';
import { EnemySystem } from '../systems/EnemySystem.js';

const CLASS_TINTS = { warrior: 0xFFAAAA, mage: 0xAAAAFF, archer: 0xAAFFAA };
const CLASS_SPEED = { warrior: 180, mage: 200, archer: 240 };
const CLASS_ATK_CD = { warrior: 450, mage: 900, archer: 700 };
const CLASS_DMG = { warrior: 18, mage: 22, archer: 14 };

export class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    preload() {
        this.load.spritesheet('hero',
            'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/dude.png',
            { frameWidth: 32, frameHeight: 48 });
    }

    create() {
        this.currentUser = this.registry.get('user');
        this.otherPlayers = this.add.group();
        this.projectiles = this.physics.add.group();
        this.lastAttackTime = 0;

        // 1. MAP
        const mapGen = new MapGenerator(this);
        const { obstacles, worldW, worldH } = mapGen.generate();
        this.physics.world.setBounds(0, 0, worldW, worldH);

        // 2. TOP-DOWN PLAYER TEXTURES
        this._genPlayerTextures();
        this._genProjectileTextures();

        // 3. PLAYER
        const cls = this.currentUser.class || 'warrior';
        const startX = this.currentUser.x || 1500;
        const startY = this.currentUser.y || 1500;
        this.playerSpeed = CLASS_SPEED[cls] || 200;

        this.player = this.physics.add.sprite(startX, startY, `tex_player_${cls}`);
        this.player.setCollideWorldBounds(true);
        this.player.setDepth(startY);
        this.player.setScale(1.1);
        this.player.body.setCircle(13, 3, 3);
        this.physics.add.collider(this.player, obstacles);

        // Name + Level
        const icons = { warrior: '⚔️', mage: '🧙', archer: '🏹' };
        this.nameText = this.add.text(startX, startY - 28, `${icons[cls] || ''} ${this.currentUser.login}`, {
            font: '11px Inter, Arial', fill: '#fff', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5);
        this.levelBadge = this.add.text(startX, startY - 28, `Lv.${this.currentUser.level || 1}`, {
            font: '9px Inter', fill: '#FFD700', stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5);
        this.hpBarBg = this.add.graphics();
        this.hpBarFill = this.add.graphics();

        // 4. CAMERA
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setZoom(1.5);
        this.cameras.main.setBounds(0, 0, worldW, worldH);

        // 5. KEYBOARD (WASD + E for interact)
        this.keys = this.input.keyboard.addKeys({
            w: 'W', s: 'S', a: 'A', d: 'D', e: 'E',
            up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT'
        });
        // E to interact
        this.input.keyboard.on('keydown-E', () => this._interact());

        // 6. MOUSE — attack on click
        this.input.on('pointerdown', (pointer) => {
            if (pointer.leftButtonDown()) {
                this._attack(pointer);
            }
        });

        // 7. MINIMAP
        const ms = 150;
        const miniCam = this.cameras.add(this.scale.width - ms - 12, 12, ms, ms);
        miniCam.setZoom(ms / worldW);
        miniCam.setBounds(0, 0, worldW, worldH);
        miniCam.setBackgroundColor(0x0a0a1a);
        miniCam.centerOn(worldW / 2, worldH / 2);

        // 8. NPC SYSTEM
        this.npcSystem = new NpcSystem(this);
        this.npcSystem.create();

        // 9. QUEST SYSTEM
        this.questSystem = new QuestSystem(this);
        this.questSystem.updateQuestUI();

        // 10. INVENTORY + LOOT
        this.inventorySystem = new InventorySystem(this);
        this.inventorySystem.spawnLoot();
        this.inventorySystem.updateUI();

        // 11. ENEMY SYSTEM
        this.enemySystem = new EnemySystem(this);
        this.enemySystem.create();

        // Projectile-enemy overlap
        this.physics.add.overlap(this.projectiles, this.enemySystem.enemies, (proj, enemy) => {
            if (!enemy.alive) return;
            this.enemySystem.damage(enemy, proj.dmg || 10);
            // Hit effect
            if (this.textures.exists('tex_sparkle')) {
                const p = this.add.particles(proj.x, proj.y, 'tex_sparkle', {
                    speed: { min: 20, max: 60 }, lifespan: 300, quantity: 5,
                    scale: { start: 1, end: 0 }, emitting: false
                });
                p.explode(5); this.time.delayedCall(400, () => p.destroy());
            }
            proj.destroy();
        });

        // 12. DAY/NIGHT
        this.dayNight = this.add.graphics().setDepth(9998).setScrollFactor(0);
        this.dayTime = 0;

        // 13. ZONE TRACKING
        this.currentZone = 'village';
        this.visitedZones = new Set(['village']);

        // 14. SYNC
        this.time.addEvent({ delay: 500, callback: this.syncNetwork, callbackScope: this, loop: true });
        this.syncNetwork();

        // 15. Crosshair cursor
        this.input.setDefaultCursor('crosshair');
    }

    /* ===========================
       PLAYER TEXTURE GENERATION (top-down view)
    =========================== */
    _genPlayerTextures() {
        const classes = [
            { id: 'warrior', body: 0xFF6B6B, accent: 0xFF9999, weapon: 0xBDBDBD },
            { id: 'mage', body: 0x5C6BC0, accent: 0x7986CB, weapon: 0xE040FB },
            { id: 'archer', body: 0x66BB6A, accent: 0x81C784, weapon: 0x8D6E63 },
        ];

        classes.forEach(c => {
            const g = this.make.graphics({ add: false });
            // Shadow
            g.fillStyle(0x000000, 0.2); g.fillEllipse(16, 28, 22, 8);
            // Body circle
            g.fillStyle(c.body); g.fillCircle(16, 16, 13);
            // Inner face
            g.fillStyle(c.accent, 0.6); g.fillCircle(16, 13, 7);
            // Eyes
            g.fillStyle(0x000000); g.fillCircle(13, 13, 1.5); g.fillCircle(19, 13, 1.5);
            // Direction pointer (top)
            g.fillStyle(c.weapon, 0.9); g.fillTriangle(16, 0, 12, 7, 20, 7);
            g.generateTexture(`tex_player_${c.id}`, 32, 32);
            g.destroy();
        });

        // Other player (generic golden)
        const g = this.make.graphics({ add: false });
        g.fillStyle(0x000000, 0.2); g.fillEllipse(16, 28, 22, 8);
        g.fillStyle(0xFFB74D); g.fillCircle(16, 16, 13);
        g.fillStyle(0xFFCC80, 0.6); g.fillCircle(16, 13, 7);
        g.fillStyle(0x000000); g.fillCircle(13, 13, 1.5); g.fillCircle(19, 13, 1.5);
        g.fillStyle(0xFFD700, 0.9); g.fillTriangle(16, 0, 12, 7, 20, 7);
        g.generateTexture('tex_player_other', 32, 32);
        g.destroy();
    }

    _genProjectileTextures() {
        let g;
        // ARROW
        g = this.make.graphics({ add: false });
        g.fillStyle(0x795548); g.fillRect(0, 2, 14, 2);
        g.fillStyle(0xBDBDBD); g.fillTriangle(18, 3, 14, 0, 14, 6);
        g.fillStyle(0x5D4037); g.fillTriangle(0, 0, 4, 3, 0, 6);
        g.generateTexture('tex_arrow', 18, 6);
        g.destroy();

        // MAGIC BOLT
        g = this.make.graphics({ add: false });
        g.fillStyle(0x7C4DFF, 0.5); g.fillCircle(6, 6, 6);
        g.fillStyle(0xE040FB, 0.8); g.fillCircle(6, 6, 4);
        g.fillStyle(0xFFFFFF, 0.7); g.fillCircle(6, 6, 2);
        g.generateTexture('tex_magicbolt', 12, 12);
        g.destroy();

        // SWORD SLASH
        g = this.make.graphics({ add: false });
        g.lineStyle(5, 0xFFFFFF, 0.9);
        g.beginPath(); g.arc(16, 16, 14, -0.8, 0.8, false); g.strokePath();
        g.lineStyle(3, 0xFF6B6B, 0.6);
        g.beginPath(); g.arc(16, 16, 10, -0.6, 0.6, false); g.strokePath();
        g.generateTexture('tex_slash', 32, 32);
        g.destroy();
    }

    /* ===========================
       ATTACK
    =========================== */
    _attack(pointer) {
        const now = this.time.now;
        const cls = this.currentUser.class || 'warrior';
        const cd = CLASS_ATK_CD[cls] || 600;
        if (now - this.lastAttackTime < cd) return;
        this.lastAttackTime = now;

        const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, wp.x, wp.y);
        const baseDmg = (this.currentUser.attack || 10) + (CLASS_DMG[cls] || 10);

        if (cls === 'warrior') this._meleeAttack(angle, baseDmg);
        else if (cls === 'archer') this._rangedAttack(angle, baseDmg, 'tex_arrow', 380, 1500);
        else if (cls === 'mage') this._rangedAttack(angle, baseDmg, 'tex_magicbolt', 280, 2000);

        this.cameras.main.shake(40, 0.002);
    }

    _meleeAttack(angle, dmg) {
        const dist = 30;
        const sx = this.player.x + Math.cos(angle) * dist;
        const sy = this.player.y + Math.sin(angle) * dist;

        const slash = this.add.image(sx, sy, 'tex_slash');
        slash.setRotation(angle);
        slash.setDepth(10000);
        slash.setAlpha(0.9);
        this.tweens.add({
            targets: slash, alpha: 0, scale: 1.5, duration: 250,
            onComplete: () => slash.destroy()
        });

        // Check enemies in melee range
        this.enemySystem.enemies.getChildren().forEach(e => {
            if (!e.alive) return;
            const d = Phaser.Math.Distance.Between(sx, sy, e.x, e.y);
            if (d < 40) this.enemySystem.damage(e, dmg);
        });
    }

    _rangedAttack(angle, dmg, tex, speed, lifespan) {
        const ox = this.player.x + Math.cos(angle) * 20;
        const oy = this.player.y + Math.sin(angle) * 20;

        const proj = this.physics.add.sprite(ox, oy, tex);
        proj.setRotation(angle);
        proj.setDepth(9000);
        proj.setScale(1.2);
        proj.dmg = dmg;
        proj.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        this.projectiles.add(proj);

        // Trail effect
        if (tex === 'tex_magicbolt') {
            const trail = this.add.particles(ox, oy, 'tex_sparkle', {
                speed: 5, lifespan: 300, quantity: 1, frequency: 40,
                scale: { start: 0.8, end: 0 }, alpha: { start: 0.6, end: 0 },
                follow: proj
            });
            this.time.delayedCall(lifespan, () => trail.destroy());
        }

        this.time.delayedCall(lifespan, () => { if (proj.active) proj.destroy(); });
    }

    /* ===========================
       INTERACT (E key)
    =========================== */
    _interact() {
        const px = this.player.x, py = this.player.y;
        // NPC check
        if (this.npcSystem) {
            const { NPC_DATA } = this.npcSystem.constructor.prototype.constructor.length ? {} : {};
            // Just trigger nearest NPC
            Object.values(this.npcSystem.npcs).forEach(npc => {
                const d = Phaser.Math.Distance.Between(px, py, npc.data.x, npc.data.y);
                if (d < 80) this.npcSystem.openDialog(npc.data.id, 'start');
            });
        }
        // Loot check
        if (this.inventorySystem) {
            this.inventorySystem.lootSprites.forEach(loot => {
                if (!loot.active) return;
                const d = Phaser.Math.Distance.Between(px, py, loot.x, loot.y);
                if (d < 60) this.inventorySystem.pickupLoot(loot);
            });
        }
    }

    /* ===========================
       SPEECH / EMOTES
    =========================== */
    showSpeechBubble(text) {
        if (this.myBubble) this.myBubble.destroy();
        if (this.myBubbleText) this.myBubbleText.destroy();
        const bw = Math.min(text.length * 7 + 20, 200);
        const bg = this.add.graphics();
        bg.fillStyle(0xFFFFFF, 0.9).fillRoundedRect(-bw / 2, -20, bw, 24, 8).setDepth(10001);
        const txt = this.add.text(0, -8, text, { font: '10px Inter', fill: '#000', wordWrap: { width: 180 } }).setOrigin(0.5).setDepth(10002);
        this.myBubble = bg; this.myBubbleText = txt;
        this.time.delayedCall(4000, () => {
            if (this.myBubble) { this.myBubble.destroy(); this.myBubble = null; }
            if (this.myBubbleText) { this.myBubbleText.destroy(); this.myBubbleText = null; }
        });
    }

    showEmote(emoteText) {
        if (this.myEmote) this.myEmote.destroy();
        this.myEmote = this.add.text(this.player.x, this.player.y - 50, emoteText, { font: '32px Arial' })
            .setOrigin(0.5).setDepth(10003);
        this.tweens.add({
            targets: this.myEmote, y: this.player.y - 90,
            alpha: { from: 1, to: 0 }, scale: { from: 1, to: 1.5 }, duration: 2000,
            onComplete: () => { if (this.myEmote) { this.myEmote.destroy(); this.myEmote = null; } }
        });
        this.time.delayedCall(2500, () => { this.currentUser.emote = null; this.currentUser.emote_at = 0; });
    }

    /* ===========================
       ZONE
    =========================== */
    detectZone(x, y) {
        if (x < 1000 && y < 1000) return 'forest';
        if (x > 2000 && y < 1000) return 'mountains';
        if (x > 2000 && y > 2000) return 'lake';
        if (x < 1000 && y > 2000) return 'meadow';
        return 'village';
    }

    /* ===========================
       NETWORK
    =========================== */
    async syncNetwork() {
        if (!this.player) return;
        this.currentUser.x = Math.round(this.player.x);
        this.currentUser.y = Math.round(this.player.y);
        const players = await dbSync(this.currentUser);
        this._updateOthers(players);
        if (window.updateHUD) window.updateHUD();
    }

    _updateOthers(serverPlayers) {
        const activeIds = new Set();
        serverPlayers.forEach(p => {
            if (p.id === this.currentUser.id) return;
            activeIds.add(p.id);
            let op = this.otherPlayers.getChildren().find(c => c.playerId === p.id);
            if (op) {
                this.tweens.add({ targets: op, x: p.x, y: p.y, duration: 500, ease: 'Linear' });
                op.setDepth(p.y);
                // Estimate rotation from movement
                if (op.x !== p.x || op.y !== p.y) {
                    const a = Phaser.Math.Angle.Between(op.x, op.y, p.x, p.y);
                    op.setRotation(a + Math.PI / 2);
                }
                // Emotes
                if (p.emote && p.emote_at && Date.now() - p.emote_at < 3000 && !op._emoShown) {
                    op._emoShown = true;
                    const emo = this.add.text(p.x, p.y - 50, p.emote, { font: '28px Arial' }).setOrigin(0.5).setDepth(p.y + 100);
                    this.tweens.add({
                        targets: emo, y: p.y - 80, alpha: 0, duration: 2500,
                        onComplete: () => { emo.destroy(); op._emoShown = false; }
                    });
                }
            } else {
                const tex = `tex_player_${p.class || 'warrior'}`;
                const t = this.textures.exists(tex) ? tex : 'tex_player_other';
                const ns = this.add.sprite(p.x, p.y, t).setScale(1.1);
                ns.playerId = p.id; ns.playerLogin = p.login;
                const oi = { warrior: '⚔️', mage: '🧙', archer: '🏹' }[p.class] || '';
                ns.nameText = this.add.text(p.x, p.y - 28, `${oi} ${p.login}`, {
                    font: '11px Inter, Arial', fill: '#FFD700', stroke: '#000', strokeThickness: 3
                }).setOrigin(0.5);
                ns.lvlText = this.add.text(p.x, p.y - 28, `Lv.${p.level || 1}`, {
                    font: '9px Inter', fill: '#FFD700', stroke: '#000', strokeThickness: 2
                }).setOrigin(0.5);
                ns.setInteractive({ useHandCursor: true });
                this.otherPlayers.add(ns);
            }
        });
        this.otherPlayers.getChildren().forEach(c => {
            if (!activeIds.has(c.playerId)) {
                if (c.nameText) c.nameText.destroy();
                if (c.lvlText) c.lvlText.destroy();
                c.destroy();
            }
        });
    }

    /* ===========================
       UPDATE LOOP
    =========================== */
    update(time, delta) {
        const px = this.player.x, py = this.player.y;

        // --- WASD MOVEMENT ---
        let vx = 0, vy = 0;
        if (this.keys.a.isDown || this.keys.left.isDown) vx -= 1;
        if (this.keys.d.isDown || this.keys.right.isDown) vx += 1;
        if (this.keys.w.isDown || this.keys.up.isDown) vy -= 1;
        if (this.keys.s.isDown || this.keys.down.isDown) vy += 1;

        if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
        this.player.setVelocity(vx * this.playerSpeed, vy * this.playerSpeed);

        // Walking bobble
        if (vx !== 0 || vy !== 0) {
            this.player.setScale(1.1 + Math.sin(time * 0.012) * 0.04);
        } else {
            this.player.setScale(1.1);
        }

        // --- MOUSE ROTATION ---
        const pointer = this.input.activePointer;
        const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const angle = Phaser.Math.Angle.Between(px, py, wp.x, wp.y);
        // Smooth rotation
        const targetRot = angle + Math.PI / 2;
        this.player.rotation = Phaser.Math.Angle.RotateTo(this.player.rotation, targetRot, 0.15);

        // --- DEPTH ---
        this.player.setDepth(py);
        if (this.nameText) this.nameText.setPosition(px, py - 28).setDepth(py + 1);
        if (this.levelBadge) {
            const nw = this.nameText ? this.nameText.width / 2 + 16 : 40;
            this.levelBadge.setPosition(px + nw, py - 28).setDepth(py + 1);
        }
        this._drawHPBar(px, py - 20);

        // Bubble
        if (this.myBubble) this.myBubble.setPosition(px, py - 55);
        if (this.myBubbleText) this.myBubbleText.setPosition(px, py - 63);

        // --- OTHER PLAYERS ---
        this.otherPlayers.getChildren().forEach(p => {
            if (p.nameText) p.nameText.setPosition(p.x, p.y - 28).setDepth(p.y + 1);
            if (p.lvlText) {
                const nw = p.nameText ? p.nameText.width / 2 + 16 : 40;
                p.lvlText.setPosition(p.x + nw, p.y - 28).setDepth(p.y + 1);
            }
        });

        // --- NPC ---
        if (this.npcSystem) this.npcSystem.update(px, py);

        // --- ENEMIES ---
        if (this.enemySystem) this.enemySystem.update(time, delta, px, py);

        // --- INVENTORY pending loot ---
        if (this.inventorySystem) this.inventorySystem.checkPendingLoot(px, py);

        // --- ZONE TRACKING ---
        const zone = this.detectZone(px, py);
        if (zone !== this.currentZone) {
            this.currentZone = zone;
            if (!this.visitedZones.has(zone)) {
                this.visitedZones.add(zone);
                if (this.questSystem) this.questSystem.onZoneVisited(zone);
            }
        }

        // --- DAY/NIGHT ---
        this.dayTime = (this.dayTime + 0.0002) % 1;
        const nightAlpha = Math.sin(this.dayTime * Math.PI * 2) * 0.12;
        this.dayNight.clear();
        if (nightAlpha > 0) {
            this.dayNight.fillStyle(0x000033, nightAlpha);
            this.dayNight.fillRect(0, 0, this.scale.width, this.scale.height);
        }
    }

    _drawHPBar(x, y) {
        const hp = this.currentUser.hp || 100, maxHp = this.currentUser.max_hp || 100;
        const w = 36, h = 4, pct = hp / maxHp;
        this.hpBarBg.clear().fillStyle(0x000000, 0.5).fillRoundedRect(x - w / 2, y, w, h, 2).setDepth(this.player.y + 2);
        const c = pct > 0.5 ? 0x4CAF50 : pct > 0.25 ? 0xFFC107 : 0xFF4B4B;
        this.hpBarFill.clear().fillStyle(c, 0.9).fillRoundedRect(x - w / 2, y, w * pct, h, 2).setDepth(this.player.y + 3);
    }
}
