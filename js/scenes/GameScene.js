import { dbSync, initRealtime, broadcastAttack } from '../core/db.js';
import { MapGenerator } from '../map/MapGenerator.js';
import { NpcSystem } from '../systems/NpcSystem.js';
import { QuestSystem } from '../systems/QuestSystem.js';
import { InventorySystem } from '../systems/InventorySystem.js';
import { EnemySystem } from '../systems/EnemySystem.js';

const CLASS_TINTS = { warrior: 0xFF6B6B, mage: 0x5C6BC0, archer: 0x66BB6A };
const CLASS_SPEED = { warrior: 180, mage: 200, archer: 240 };
const CLASS_ATK_CD = { warrior: 450, mage: 900, archer: 700 };
const CLASS_DMG = { warrior: 18, mage: 22, archer: 14 };

export class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    create() {
        // Init deterministic random for synced maps and mob spawns
        this.rnd.init(['age-of-bbooster-seed-1']);

        this.currentUser = this.registry.get('user');
        this.otherPlayers = this.add.group();
        this.projectiles = this.physics.add.group();
        this.lastAttackTime = 0;

        // 1. MAP
        const mapGen = new MapGenerator(this);
        const { obstacles, worldW, worldH } = mapGen.generate();
        this.physics.world.setBounds(0, 0, worldW, worldH);

        // 2. TEXTURES (Neon & Bloom ready)
        this._genPlayerTextures();
        this._genProjectileTextures();

        // 3. PLAYER
        const cls = this.currentUser.class || 'warrior';
        const startX = this.currentUser.x || 1500;
        const startY = this.currentUser.y || 1500;
        this.playerSpeed = CLASS_SPEED[cls] || 200;

        this.player = this.physics.add.sprite(startX, startY, `tex_player_${cls}`);
        this.player.setCollideWorldBounds(true).setDepth(startY).setScale(1.2);
        this.player.body.setCircle(13, 3, 3);
        this.physics.add.collider(this.player, obstacles);

        // UI
        const icons = { warrior: '⚔️', mage: '🧙', archer: '🏹' };
        this.nameText = this.add.text(startX, startY - 28, `${icons[cls] || ''} ${this.currentUser.login}`, {
            font: '11px Inter, Arial', fill: '#fff', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5);
        this.levelBadge = this.add.text(startX, startY - 28, `Lv.${this.currentUser.level || 1}`, {
            font: '9px Inter', fill: '#FFD700', stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5);
        this.hpBarBg = this.add.graphics();
        this.hpBarFill = this.add.graphics();

        // 4. CAMERA & POST PROCESSING
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setZoom(1.5).setBounds(0, 0, worldW, worldH);

        // Add beautiful bloom effect
        if (this.cameras.main.postFX) {
            this.cameras.main.postFX.addBloom(0xffffff, 0.8, 0.8, 1, 1.2);
        }

        // 5. INPUTS
        this.keys = this.input.keyboard.addKeys({ w: 'W', s: 'S', a: 'A', d: 'D', e: 'E', up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT' });
        this.input.keyboard.on('keydown-E', () => this._interact());
        this.input.on('pointerdown', (pointer) => {
            if (pointer.leftButtonDown()) this._attack(pointer);
        });

        // 6. MINIMAP
        const ms = 150, miniCam = this.cameras.add(this.scale.width - ms - 12, 12, ms, ms);
        miniCam.setZoom(ms / worldW).setBounds(0, 0, worldW, worldH);
        miniCam.setBackgroundColor(0x0a0a1a).centerOn(worldW / 2, worldH / 2);

        // 7. SYSTEMS
        this.npcSystem = new NpcSystem(this); this.npcSystem.create();
        this.questSystem = new QuestSystem(this); this.questSystem.updateQuestUI();
        this.inventorySystem = new InventorySystem(this); this.inventorySystem.spawnLoot(); this.inventorySystem.updateUI();
        this.enemySystem = new EnemySystem(this); this.enemySystem.create();

        // 8. COMBAT COLLISIONS
        this.physics.add.overlap(this.projectiles, this.enemySystem.enemies, (proj, enemy) => {
            if (!enemy.alive) return;
            // Only deal damage if it's MY projectile (my ID)
            if (proj.ownerId === this.currentUser.id) {
                this.enemySystem.damage(enemy, proj.dmg || 10);
            }
            if (this.textures.exists('tex_sparkle')) {
                const p = this.add.particles(proj.x, proj.y, 'tex_sparkle', {
                    speed: { min: 40, max: 100 }, lifespan: 400, quantity: 8, scale: { start: 1, end: 0 }, emitting: false, blendMode: 'ADD'
                }); p.explode(8); this.time.delayedCall(500, () => p.destroy());
            }
            proj.destroy();
        });

        // 9. ENV & NETWORK
        this.dayNight = this.add.graphics().setDepth(9998).setScrollFactor(0);
        this.dayTime = 0;
        this.visitedZones = new Set(['village']);
        this.currentZone = 'village';

        this.time.addEvent({ delay: 500, callback: this.syncState, callbackScope: this, loop: true });
        this.syncState();

        // INITIALIZE SUPABASE REALTIME MULTIPLAYER EVENTS
        initRealtime(
            // On Attack Broadcast received from other player
            (payload) => {
                if (payload.playerId === this.currentUser.id) return; // Ignore own echoes
                this._showNetworkAttack(payload);
            },
            // On Mob Hit Broadcast
            (payload) => {
                this.enemySystem.applyNetworkHit(payload.mobId, payload.dmg);
            }
        );

        this.input.setDefaultCursor('crosshair');
    }

    _genPlayerTextures() {
        const classes = [
            { id: 'warrior', col: 0xFF0000 },
            { id: 'mage', col: 0x0088FF },
            { id: 'archer', col: 0x00FF00 },
        ];
        classes.forEach(c => {
            const g = this.make.graphics({ add: false });
            // Glow and neon style
            g.lineStyle(4, c.col, 0.4); g.strokeCircle(16, 16, 12);
            g.lineStyle(2, c.col, 0.8); g.strokeCircle(16, 16, 12);
            g.fillStyle(0xFFFFFF); g.fillCircle(16, 16, 6);
            g.lineStyle(2, 0xFFFFFF); g.beginPath(); g.moveTo(16, 16); g.lineTo(26, 16); g.strokePath();
            g.generateTexture(`tex_player_${c.id}`, 32, 32); g.destroy();
        });
        const g = this.make.graphics({ add: false });
        g.lineStyle(2, 0xFFFF00).strokeCircle(16, 16, 12).fillStyle(0xFFFFFF).fillCircle(16, 16, 6);
        g.generateTexture('tex_player_other', 32, 32); g.destroy();
    }

    _genProjectileTextures() {
        let g = this.make.graphics({ add: false });
        g.lineStyle(3, 0x00FF00, 0.8).beginPath().moveTo(0, 3).lineTo(18, 3).strokePath();
        g.fillStyle(0xFFFFFF).fillTriangle(18, 3, 14, 0, 14, 6);
        g.generateTexture('tex_arrow', 18, 6); g.destroy();

        g = this.make.graphics({ add: false });
        g.fillStyle(0x0088FF, 0.8).fillCircle(6, 6, 6).fillStyle(0xFFFFFF).fillCircle(6, 6, 3);
        g.generateTexture('tex_magicbolt', 12, 12); g.destroy();

        g = this.make.graphics({ add: false });
        g.lineStyle(6, 0xFF0000, 0.7).beginPath().arc(16, 16, 14, -0.8, 0.8, false).strokePath();
        g.lineStyle(2, 0xFFFFFF).beginPath().arc(16, 16, 14, -0.8, 0.8, false).strokePath();
        g.generateTexture('tex_slash', 32, 32); g.destroy();
    }

    _attack(pointer) {
        const now = this.time.now;
        const cls = this.currentUser.class || 'warrior';
        const cd = CLASS_ATK_CD[cls] || 600;
        if (now - this.lastAttackTime < cd) return;
        this.lastAttackTime = now;

        const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, wp.x, wp.y);
        const baseDmg = (this.currentUser.attack || 10) + (CLASS_DMG[cls] || 10);

        if (cls === 'warrior') this._meleeAttack(this.player.x, this.player.y, angle, baseDmg, true);
        else if (cls === 'archer') this._rangedAttack(this.player.x, this.player.y, angle, baseDmg, 'tex_arrow', 600, 2000, true);
        else if (cls === 'mage') this._rangedAttack(this.player.x, this.player.y, angle, baseDmg, 'tex_magicbolt', 400, 2500, true);

        this.cameras.main.shake(40, 0.002);

        // Broadcast attack to other players instantly
        broadcastAttack({
            playerId: this.currentUser.id,
            cls: cls,
            x: Math.round(this.player.x),
            y: Math.round(this.player.y),
            angle: angle
        });
    }

    _showNetworkAttack(data) {
        // Run attack animation for other players locally
        if (data.cls === 'warrior') this._meleeAttack(data.x, data.y, data.angle, 0, false);
        else if (data.cls === 'archer') this._rangedAttack(data.x, data.y, data.angle, 0, 'tex_arrow', 600, 2000, false);
        else if (data.cls === 'mage') this._rangedAttack(data.x, data.y, data.angle, 0, 'tex_magicbolt', 400, 2500, false);
    }

    _meleeAttack(px, py, angle, dmg, isLocal) {
        const sx = px + Math.cos(angle) * 30, sy = py + Math.sin(angle) * 30;
        const slash = this.add.image(sx, sy, 'tex_slash').setRotation(angle).setDepth(10000);
        this.tweens.add({ targets: slash, alpha: 0, scale: 1.5, duration: 250, onComplete: () => slash.destroy() });

        if (isLocal) {
            this.enemySystem.enemies.getChildren().forEach(e => {
                if (!e.alive) return;
                if (Phaser.Math.Distance.Between(sx, sy, e.x, e.y) < (e.isBoss ? 50 : 35)) {
                    this.enemySystem.damage(e, dmg);
                }
            });
        }
    }

    _rangedAttack(px, py, angle, dmg, tex, speed, lifespan, isLocal) {
        const ox = px + Math.cos(angle) * 20, oy = py + Math.sin(angle) * 20;
        const proj = this.physics.add.sprite(ox, oy, tex).setRotation(angle).setDepth(9000).setScale(1.2);
        proj.ownerId = isLocal ? this.currentUser.id : 'other';
        proj.dmg = dmg;
        proj.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        this.projectiles.add(proj);

        if (tex === 'tex_magicbolt') {
            const trail = this.add.particles(ox, oy, 'tex_sparkle', {
                speed: 5, lifespan: 300, quantity: 1, frequency: 40, scale: { start: 0.8, end: 0 },
                alpha: { start: 0.6, end: 0 }, follow: proj, blendMode: 'ADD'
            });
            this.time.delayedCall(lifespan, () => trail.destroy());
        }
        this.time.delayedCall(lifespan, () => { if (proj.active) proj.destroy(); });
    }

    _interact() {
        const px = this.player.x, py = this.player.y;
        if (this.npcSystem) {
            Object.values(this.npcSystem.npcs).forEach(npc => {
                if (Phaser.Math.Distance.Between(px, py, npc.data.x, npc.data.y) < 80) this.npcSystem.openDialog(npc.data.id, 'start');
            });
        }
        if (this.inventorySystem) {
            this.inventorySystem.lootSprites.forEach(loot => {
                if (loot.active && Phaser.Math.Distance.Between(px, py, loot.x, loot.y) < 60) this.inventorySystem.pickupLoot(loot);
            });
        }
    }

    showSpeechBubble(text) {
        if (this.myBubble) this.myBubble.destroy();
        if (this.myBubbleText) this.myBubbleText.destroy();
        const bw = Math.min(text.length * 7 + 20, 200), bg = this.add.graphics().fillStyle(0xFFFFFF, 0.9).fillRoundedRect(-bw / 2, -20, bw, 24, 8).setDepth(10001);
        const txt = this.add.text(0, -8, text, { font: '10px Inter', fill: '#000', wordWrap: { width: 180 } }).setOrigin(0.5).setDepth(10002);
        this.myBubble = bg; this.myBubbleText = txt;
        this.time.delayedCall(4000, () => { if (this.myBubble) this.myBubble.destroy(); if (this.myBubbleText) this.myBubbleText.destroy(); });
    }

    showEmote(emote) {
        if (this.myEmote) this.myEmote.destroy();
        this.myEmote = this.add.text(this.player.x, this.player.y - 50, emote, { font: '32px Arial' }).setOrigin(0.5).setDepth(10003);
        this.tweens.add({ targets: this.myEmote, y: this.player.y - 90, alpha: 0, scale: 1.5, duration: 2000, onComplete: () => { if (this.myEmote) this.myEmote.destroy(); } });
        this.time.delayedCall(2500, () => { this.currentUser.emote = null; this.currentUser.emote_at = 0; });
    }

    async syncState() {
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
                if (op.x !== p.x || op.y !== p.y) op.setRotation(Phaser.Math.Angle.Between(op.x, op.y, p.x, p.y) + Math.PI / 2);
                if (p.emote && p.emote_at && Date.now() - p.emote_at < 3000 && !op._emoShown) {
                    op._emoShown = true;
                    const emo = this.add.text(p.x, p.y - 50, p.emote, { font: '28px Arial' }).setOrigin(0.5).setDepth(p.y + 100);
                    this.tweens.add({ targets: emo, y: p.y - 80, alpha: 0, duration: 2500, onComplete: () => { emo.destroy(); op._emoShown = false; } });
                }
            } else {
                const tex = `tex_player_${p.class || 'warrior'}`;
                const t = this.textures.exists(tex) ? tex : 'tex_player_other';
                const ns = this.add.sprite(p.x, p.y, t).setScale(1.2).setInteractive({ useHandCursor: true });
                ns.playerId = p.id; ns.playerLogin = p.login;
                ns.nameText = this.add.text(p.x, p.y - 28, `${{ warrior: '⚔️', mage: '🧙', archer: '🏹' }[p.class] || ''} ${p.login}`, { font: '11px Inter, Arial', fill: '#FFD700', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
                ns.lvlText = this.add.text(p.x, p.y - 28, `Lv.${p.level || 1}`, { font: '9px Inter', fill: '#FFD700', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5);
                this.otherPlayers.add(ns);
            }
        });
        this.otherPlayers.getChildren().forEach(c => {
            if (!activeIds.has(c.playerId)) { if (c.nameText) c.nameText.destroy(); if (c.lvlText) c.lvlText.destroy(); c.destroy(); }
        });
    }

    update(time, delta) {
        const px = this.player.x, py = this.player.y;

        let vx = 0, vy = 0;
        if (this.keys.a.isDown || this.keys.left.isDown) vx -= 1;
        if (this.keys.d.isDown || this.keys.right.isDown) vx += 1;
        if (this.keys.w.isDown || this.keys.up.isDown) vy -= 1;
        if (this.keys.s.isDown || this.keys.down.isDown) vy += 1;

        if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
        this.player.setVelocity(vx * this.playerSpeed, vy * this.playerSpeed);

        const targetRot = Phaser.Math.Angle.Between(px, py, this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y).x, this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y).y) + Math.PI / 2;
        this.player.rotation = Phaser.Math.Angle.RotateTo(this.player.rotation, targetRot, 0.2);

        this.player.setDepth(py);
        if (this.nameText) this.nameText.setPosition(px, py - 28).setDepth(py + 1);
        if (this.levelBadge) this.levelBadge.setPosition(px + (this.nameText ? this.nameText.width / 2 + 16 : 40), py - 28).setDepth(py + 1);
        this._drawHPBar(px, py - 20);
        if (this.myBubble) { this.myBubble.setPosition(px, py - 55); this.myBubbleText.setPosition(px, py - 63); }

        this.otherPlayers.getChildren().forEach(p => {
            if (p.nameText) p.nameText.setPosition(p.x, p.y - 28).setDepth(p.y + 1);
            if (p.lvlText) p.lvlText.setPosition(p.x + (p.nameText ? p.nameText.width / 2 + 16 : 40), p.y - 28).setDepth(p.y + 1);
        });

        if (this.npcSystem) this.npcSystem.update(px, py);
        if (this.enemySystem) this.enemySystem.update(time, delta, px, py);
        if (this.inventorySystem) this.inventorySystem.checkPendingLoot(px, py);

        const z = x => x < 1000 && py < 1000 ? 'forest' : x > 2000 && py < 1000 ? 'mountains' : x > 2000 && py > 2000 ? 'lake' : x < 1000 && py > 2000 ? 'meadow' : 'village';
        const zone = z(px);
        if (zone !== this.currentZone) {
            this.currentZone = zone;
            if (!this.visitedZones.has(zone)) { this.visitedZones.add(zone); if (this.questSystem) this.questSystem.onZoneVisited(zone); }
        }

        this.dayTime = (this.dayTime + 0.0002) % 1;
        const nt = Math.sin(this.dayTime * Math.PI * 2) * 0.12;
        this.dayNight.clear(); if (nt > 0) this.dayNight.fillStyle(0x00001a, nt).fillRect(0, 0, this.scale.width, this.scale.height);
    }

    _drawHPBar(x, y) {
        const hp = this.currentUser.hp || 100, maxHp = this.currentUser.max_hp || 100, w = 36, h = 4, pct = hp / maxHp;
        this.hpBarBg.clear().fillStyle(0x000000, 0.5).fillRoundedRect(x - w / 2, y, w, h, 2).setDepth(this.player.y + 2);
        this.hpBarFill.clear().fillStyle(pct > 0.5 ? 0x00FF00 : pct > 0.25 ? 0xFFFF00 : 0xFF0000, 0.9).fillRoundedRect(x - w / 2, y, w * pct, h, 2).setDepth(this.player.y + 3);
    }
}
