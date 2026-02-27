import { dbSync } from '../core/db.js';
import { MapGenerator } from '../map/MapGenerator.js';
import { NpcSystem } from '../systems/NpcSystem.js';
import { QuestSystem } from '../systems/QuestSystem.js';
import { InventorySystem } from '../systems/InventorySystem.js';

const CLASS_TINTS = { warrior: 0xFFAAAA, mage: 0xAAAAFF, archer: 0xAAFFAA };
const CLASS_SPEED = { warrior: 180, mage: 200, archer: 240 };

export class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    preload() {
        this.load.spritesheet('hero',
            'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/dude.png',
            { frameWidth: 32, frameHeight: 48 }
        );
    }

    create() {
        this.currentUser = this.registry.get('user');
        this.otherPlayers = this.add.group();

        // 1. MAP
        const mapGen = new MapGenerator(this);
        const { obstacles, worldW, worldH } = mapGen.generate();
        this.physics.world.setBounds(0, 0, worldW, worldH);

        // 2. ANIMATIONS
        if (!this.anims.exists('left'))
            this.anims.create({ key: 'left', frames: this.anims.generateFrameNumbers('hero', { start: 0, end: 3 }), frameRate: 10, repeat: -1 });
        if (!this.anims.exists('turn'))
            this.anims.create({ key: 'turn', frames: [{ key: 'hero', frame: 4 }], frameRate: 20 });
        if (!this.anims.exists('right'))
            this.anims.create({ key: 'right', frames: this.anims.generateFrameNumbers('hero', { start: 5, end: 8 }), frameRate: 10, repeat: -1 });

        // 3. PLAYER
        const startX = this.currentUser.x || 1500;
        const startY = this.currentUser.y || 1500;
        this.playerSpeed = CLASS_SPEED[this.currentUser.class] || 200;

        this.player = this.physics.add.sprite(startX, startY, 'hero');
        this.player.setCollideWorldBounds(true);
        this.player.setDepth(startY);
        this.player.setScale(1.3);
        const tint = CLASS_TINTS[this.currentUser.class];
        if (tint) this.player.setTint(tint);
        this.physics.add.collider(this.player, obstacles);

        // Name
        const icons = { warrior: '⚔️', mage: '🧙', archer: '🏹' };
        const icon = icons[this.currentUser.class] || '';
        this.nameText = this.add.text(startX, startY - 50, `${icon} ${this.currentUser.login}`, {
            font: '12px Inter, Arial', fill: '#ffffff', stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5);
        this.levelBadge = this.add.text(startX, startY - 50, `Lv.${this.currentUser.level || 1}`, {
            font: '9px Inter', fill: '#FFD700', stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5);
        this.hpBarBg = this.add.graphics();
        this.hpBarFill = this.add.graphics();

        // 4. CAMERA
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setZoom(1.5);
        this.cameras.main.setBounds(0, 0, worldW, worldH);

        // 5. CONTROLS
        this.target = new Phaser.Math.Vector2(startX, startY);
        this.isMoving = false;

        const mg = this.make.graphics({ add: false });
        mg.fillStyle(0x00FF00, 0.8); mg.fillCircle(8, 8, 8);
        mg.fillStyle(0xFFFFFF, 0.5); mg.fillCircle(8, 8, 4);
        mg.generateTexture('marker', 16, 16); mg.destroy();

        this.targetMarker = this.add.image(0, 0, 'marker').setVisible(false).setDepth(9999).setAlpha(0.6);
        this.tweens.add({ targets: this.targetMarker, scale: { from: 1, to: 0.5 }, alpha: { from: 0.7, to: 0.3 }, duration: 600, yoyo: true, repeat: -1 });

        this.input.on('pointerdown', (pointer) => {
            const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
            const clicked = this.getClickedPlayer(wp.x, wp.y);
            if (clicked) { this.showPlayerInteraction(clicked); return; }
            document.getElementById('player-interact')?.classList.add('hidden');
            this.moveTo(wp.x, wp.y);
        });

        // 6. MINIMAP
        const ms = 150;
        const miniCam = this.cameras.add(this.scale.width - ms - 12, 12, ms, ms);
        miniCam.setZoom(ms / worldW);
        miniCam.setBounds(0, 0, worldW, worldH);
        miniCam.setBackgroundColor(0x0a0a1a);
        miniCam.centerOn(worldW / 2, worldH / 2);

        // 7. NPC SYSTEM
        this.npcSystem = new NpcSystem(this);
        this.npcSystem.create();

        // 8. QUEST SYSTEM
        this.questSystem = new QuestSystem(this);
        this.questSystem.updateQuestUI();

        // 9. INVENTORY SYSTEM + LOOT
        this.inventorySystem = new InventorySystem(this);
        this.inventorySystem.spawnLoot();
        this.inventorySystem.updateUI();

        // 10. DAY/NIGHT CYCLE
        this.dayNight = this.add.graphics();
        this.dayNight.setDepth(9998);
        this.dayNight.setScrollFactor(0);
        this.dayTime = 0;

        // 11. ZONE TRACKING (for explore quests)
        this.currentZone = 'village';
        this.visitedZones = new Set(['village']);

        // 12. SYNC
        this.time.addEvent({ delay: 500, callback: this.syncNetwork, callbackScope: this, loop: true });
        this.syncNetwork();
    }

    moveTo(x, y) {
        this.target.set(x, y);
        this.isMoving = true;
        this.targetMarker.setPosition(x, y).setVisible(true);
        this.physics.moveToObject(this.player, this.target, this.playerSpeed);
        this.currentUser.x = Math.round(x);
        this.currentUser.y = Math.round(y);
    }

    // ===========================
    // SPEECH BUBBLE
    // ===========================
    showSpeechBubble(text) {
        if (this.myBubble) this.myBubble.destroy();
        if (this.myBubbleText) this.myBubbleText.destroy();

        const bw = Math.min(text.length * 7 + 20, 200);
        const bg = this.add.graphics();
        bg.fillStyle(0xFFFFFF, 0.9).fillRoundedRect(-bw / 2, -20, bw, 24, 8);
        bg.setDepth(10001);
        const txt = this.add.text(0, -8, text, {
            font: '10px Inter', fill: '#000', wordWrap: { width: 180 }
        }).setOrigin(0.5).setDepth(10002);

        this.myBubble = bg; this.myBubbleText = txt;
        this.time.delayedCall(4000, () => {
            if (this.myBubble) { this.myBubble.destroy(); this.myBubble = null; }
            if (this.myBubbleText) { this.myBubbleText.destroy(); this.myBubbleText = null; }
        });
    }

    // ===========================
    // EMOTE
    // ===========================
    showEmote(emoteText) {
        if (this.myEmote) this.myEmote.destroy();
        this.myEmote = this.add.text(this.player.x, this.player.y - 70, emoteText, { font: '32px Arial' })
            .setOrigin(0.5).setDepth(10003);
        this.tweens.add({
            targets: this.myEmote, y: this.player.y - 110,
            alpha: { from: 1, to: 0 }, scale: { from: 1, to: 1.5 },
            duration: 2000,
            onComplete: () => { if (this.myEmote) { this.myEmote.destroy(); this.myEmote = null; } }
        });
        this.time.delayedCall(2500, () => { this.currentUser.emote = null; this.currentUser.emote_at = 0; });
    }

    // ===========================
    // PLAYER INTERACTION
    // ===========================
    getClickedPlayer(wx, wy) {
        for (const p of this.otherPlayers.getChildren()) {
            if (Phaser.Math.Distance.Between(wx, wy, p.x, p.y) < 30) return p;
        }
        return null;
    }

    showPlayerInteraction(sprite) {
        const panel = document.getElementById('player-interact');
        if (!panel) return;
        document.getElementById('interact-name').textContent = sprite.playerLogin || 'Player';
        panel.classList.remove('hidden');
        this.selectedPlayer = sprite;
    }

    // ===========================
    // ZONE DETECTION
    // ===========================
    detectZone(x, y) {
        if (x < 1000 && y < 1000) return 'forest';
        if (x > 2000 && y < 1000) return 'mountains';
        if (x > 2000 && y > 2000) return 'lake';
        if (x < 1000 && y > 2000) return 'meadow';
        return 'village';
    }

    // ===========================
    // NETWORK
    // ===========================
    async syncNetwork() {
        if (!this.player) return;
        this.currentUser.x = Math.round(this.player.x);
        this.currentUser.y = Math.round(this.player.y);
        const serverPlayers = await dbSync(this.currentUser);
        this.updateOtherPlayers(serverPlayers);
        if (window.updateHUD) window.updateHUD();
    }

    updateOtherPlayers(serverPlayers) {
        const activeIds = new Set();
        serverPlayers.forEach(pData => {
            if (pData.id === this.currentUser.id) return;
            activeIds.add(pData.id);
            let op = this.otherPlayers.getChildren().find(p => p.playerId === pData.id);
            if (op) {
                if (op.x !== pData.x || op.y !== pData.y) {
                    if (pData.x < op.x) op.anims.play('left', true);
                    else op.anims.play('right', true);
                } else op.anims.play('turn');
                this.tweens.add({ targets: op, x: pData.x, y: pData.y, duration: 500, ease: 'Linear' });
                op.setDepth(pData.y);

                // Other player emotes
                if (pData.emote && pData.emote_at && Date.now() - pData.emote_at < 3000) {
                    if (!op._emoteShown) {
                        op._emoteShown = true;
                        const emo = this.add.text(pData.x, pData.y - 70, pData.emote, { font: '28px Arial' })
                            .setOrigin(0.5).setDepth(pData.y + 100);
                        this.tweens.add({
                            targets: emo, y: pData.y - 100, alpha: { from: 1, to: 0 }, duration: 2500,
                            onComplete: () => { emo.destroy(); op._emoteShown = false; }
                        });
                    }
                }
            } else {
                const ns = this.add.sprite(pData.x, pData.y, 'hero').setScale(1.3);
                const t = CLASS_TINTS[pData.class]; if (t) ns.setTint(t);
                ns.playerId = pData.id; ns.playerLogin = pData.login; ns.playerClass = pData.class;
                const oi = { warrior: '⚔️', mage: '🧙', archer: '🏹' }[pData.class] || '';
                ns.nameText = this.add.text(pData.x, pData.y - 50, `${oi} ${pData.login}`, {
                    font: '12px Inter, Arial', fill: '#FFD700', stroke: '#000', strokeThickness: 3
                }).setOrigin(0.5);
                ns.lvlText = this.add.text(pData.x, pData.y - 50, `Lv.${pData.level || 1}`, {
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

    // ===========================
    // UPDATE
    // ===========================
    update(time) {
        const px = this.player.x, py = this.player.y;
        const dist = Phaser.Math.Distance.Between(px, py, this.target.x, this.target.y);

        if (this.player.body.speed > 0) {
            if (this.player.body.velocity.x < 0) this.player.anims.play('left', true);
            else if (this.player.body.velocity.x > 0) this.player.anims.play('right', true);
            else this.player.anims.play('left', true);
            if (dist < 8) {
                this.player.body.reset(this.target.x, this.target.y);
                this.targetMarker.setVisible(false);
                this.player.anims.play('turn');
                this.isMoving = false;
            }
        } else {
            this.player.anims.play('turn');
            // Check pending interactions when stopped
            if (this.npcSystem) this.npcSystem.checkPendingInteraction(px, py);
            if (this.inventorySystem) this.inventorySystem.checkPendingLoot(px, py);
        }

        // Depth + labels
        this.player.setDepth(py);
        if (this.nameText) this.nameText.setPosition(px, py - 50).setDepth(py + 1);
        if (this.levelBadge) {
            const nw = this.nameText ? this.nameText.width / 2 + 16 : 40;
            this.levelBadge.setPosition(px + nw, py - 50).setDepth(py + 1);
        }
        this.drawHPBar(px, py - 38);
        if (this.myBubble) this.myBubble.setPosition(px, py - 75);
        if (this.myBubbleText) this.myBubbleText.setPosition(px, py - 83);

        // Other players
        this.otherPlayers.getChildren().forEach(p => {
            if (p.nameText) p.nameText.setPosition(p.x, p.y - 50).setDepth(p.y + 1);
            if (p.lvlText) {
                const nw = p.nameText ? p.nameText.width / 2 + 16 : 40;
                p.lvlText.setPosition(p.x + nw, p.y - 50).setDepth(p.y + 1);
            }
        });

        // NPC proximity
        if (this.npcSystem) this.npcSystem.update(px, py);

        // Zone tracking
        const zone = this.detectZone(px, py);
        if (zone !== this.currentZone) {
            this.currentZone = zone;
            if (!this.visitedZones.has(zone)) {
                this.visitedZones.add(zone);
                if (this.questSystem) this.questSystem.onZoneVisited(zone);
            }
        }

        // Day/night cycle (subtle)
        this.dayTime = (this.dayTime + 0.0002) % 1;
        const nightAlpha = Math.sin(this.dayTime * Math.PI * 2) * 0.15;
        if (nightAlpha > 0) {
            this.dayNight.clear();
            this.dayNight.fillStyle(0x000033, nightAlpha);
            this.dayNight.fillRect(0, 0, this.scale.width, this.scale.height);
        } else {
            this.dayNight.clear();
        }
    }

    drawHPBar(x, y) {
        const hp = this.currentUser.hp || 100;
        const maxHp = this.currentUser.max_hp || 100;
        const w = 40, h = 4, pct = hp / maxHp;
        this.hpBarBg.clear().fillStyle(0x000000, 0.5).fillRoundedRect(x - w / 2, y, w, h, 2).setDepth(this.player.y + 2);
        const color = pct > 0.5 ? 0x4CAF50 : pct > 0.25 ? 0xFFC107 : 0xFF4B4B;
        this.hpBarFill.clear().fillStyle(color, 0.9).fillRoundedRect(x - w / 2, y, w * pct, h, 2).setDepth(this.player.y + 3);
    }
}
