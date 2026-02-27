// js/systems/EnemySystem.js
// Enemy spawning with FIXED positions for multiplayer sync, AI, combat, bosses

import { broadcastMobHit } from '../core/db.js';

// ========================================
// FIXED MOB POSITIONS — same for all players!
// ========================================
const MOB_DEFS = [
    // FOREST — Slimes
    { id: 'slime_0', type: 'slime', x: 200, y: 200, hp: 30, atk: 5, spd: 45, xp: 15, range: 200 },
    { id: 'slime_1', type: 'slime', x: 400, y: 180, hp: 30, atk: 5, spd: 45, xp: 15, range: 200 },
    { id: 'slime_2', type: 'slime', x: 600, y: 350, hp: 30, atk: 5, spd: 45, xp: 15, range: 200 },
    { id: 'slime_3', type: 'slime', x: 250, y: 500, hp: 30, atk: 5, spd: 45, xp: 15, range: 200 },
    { id: 'slime_4', type: 'slime', x: 450, y: 650, hp: 30, atk: 5, spd: 45, xp: 15, range: 200 },
    { id: 'slime_5', type: 'slime', x: 700, y: 500, hp: 30, atk: 5, spd: 45, xp: 15, range: 200 },
    { id: 'slime_6', type: 'slime', x: 350, y: 800, hp: 30, atk: 5, spd: 45, xp: 15, range: 200 },
    { id: 'slime_7', type: 'slime', x: 150, y: 700, hp: 30, atk: 5, spd: 45, xp: 15, range: 200 },
    { id: 'slime_8', type: 'slime', x: 550, y: 150, hp: 30, atk: 5, spd: 45, xp: 15, range: 200 },
    { id: 'slime_9', type: 'slime', x: 780, y: 300, hp: 30, atk: 5, spd: 45, xp: 15, range: 200 },

    // MOUNTAINS — Skeletons
    { id: 'skel_0', type: 'skeleton', x: 2200, y: 200, hp: 50, atk: 10, spd: 65, xp: 25, range: 250 },
    { id: 'skel_1', type: 'skeleton', x: 2400, y: 350, hp: 50, atk: 10, spd: 65, xp: 25, range: 250 },
    { id: 'skel_2', type: 'skeleton', x: 2600, y: 200, hp: 50, atk: 10, spd: 65, xp: 25, range: 250 },
    { id: 'skel_3', type: 'skeleton', x: 2300, y: 500, hp: 50, atk: 10, spd: 65, xp: 25, range: 250 },
    { id: 'skel_4', type: 'skeleton', x: 2500, y: 600, hp: 50, atk: 10, spd: 65, xp: 25, range: 250 },
    { id: 'skel_5', type: 'skeleton', x: 2700, y: 400, hp: 50, atk: 10, spd: 65, xp: 25, range: 250 },
    { id: 'skel_6', type: 'skeleton', x: 2800, y: 250, hp: 50, atk: 10, spd: 65, xp: 25, range: 250 },
    { id: 'skel_7', type: 'skeleton', x: 2150, y: 650, hp: 50, atk: 10, spd: 65, xp: 25, range: 250 },

    // MEADOW — Wolves
    { id: 'wolf_0', type: 'wolf', x: 200, y: 2200, hp: 35, atk: 12, spd: 95, xp: 20, range: 300 },
    { id: 'wolf_1', type: 'wolf', x: 400, y: 2350, hp: 35, atk: 12, spd: 95, xp: 20, range: 300 },
    { id: 'wolf_2', type: 'wolf', x: 600, y: 2500, hp: 35, atk: 12, spd: 95, xp: 20, range: 300 },
    { id: 'wolf_3', type: 'wolf', x: 300, y: 2600, hp: 35, atk: 12, spd: 95, xp: 20, range: 300 },
    { id: 'wolf_4', type: 'wolf', x: 500, y: 2750, hp: 35, atk: 12, spd: 95, xp: 20, range: 300 },
    { id: 'wolf_5', type: 'wolf', x: 700, y: 2400, hp: 35, atk: 12, spd: 95, xp: 20, range: 300 },
    { id: 'wolf_6', type: 'wolf', x: 150, y: 2500, hp: 35, atk: 12, spd: 95, xp: 20, range: 300 },
    { id: 'wolf_7', type: 'wolf', x: 750, y: 2650, hp: 35, atk: 12, spd: 95, xp: 20, range: 300 },

    // LAKE — Dark Mages
    { id: 'dmage_0', type: 'darkmage', x: 2150, y: 2150, hp: 70, atk: 15, spd: 50, xp: 35, range: 280 },
    { id: 'dmage_1', type: 'darkmage', x: 2350, y: 2200, hp: 70, atk: 15, spd: 50, xp: 35, range: 280 },
    { id: 'dmage_2', type: 'darkmage', x: 2700, y: 2300, hp: 70, atk: 15, spd: 50, xp: 35, range: 280 },
    { id: 'dmage_3', type: 'darkmage', x: 2200, y: 2650, hp: 70, atk: 15, spd: 50, xp: 35, range: 280 },
    { id: 'dmage_4', type: 'darkmage', x: 2650, y: 2700, hp: 70, atk: 15, spd: 50, xp: 35, range: 280 },
];

// BOSSES
const BOSS_DEFS = [
    { id: 'boss_dragon', type: 'dragon', x: 2500, y: 400, hp: 1000, atk: 30, spd: 80, xp: 500, range: 400, isBoss: true },
    { id: 'boss_kraken', type: 'kraken', x: 2500, y: 2500, hp: 800, atk: 25, spd: 40, xp: 400, range: 350, isBoss: true },
];

// Sprite frame map (which frame in the spritesheet is which enemy)
const ENEMY_FRAMES = {
    slime: { tex: 'enemies', frame: 0 },
    skeleton: { tex: 'enemies', frame: 1 },
    wolf: { tex: 'enemies', frame: 2 },
    darkmage: { tex: 'enemies', frame: 3 },
    dragon: { tex: 'bosses', frame: 0 },
    kraken: { tex: 'bosses', frame: 1 },
};

export class EnemySystem {
    constructor(scene) {
        this.scene = scene;
        this.enemies = scene.physics.add.group();
        this.respawnQueue = [];
    }

    create() {
        this._genFallbackTextures();
        // Spawn all mobs at fixed positions
        MOB_DEFS.forEach(def => this._spawn(def));
        BOSS_DEFS.forEach(def => this._spawn(def));
    }

    _genFallbackTextures() {
        const s = this.scene;
        // Generate enemy bolt projectile
        const g = s.make.graphics({ add: false });
        g.fillStyle(0xAA00FF, 0.8); g.fillCircle(4, 4, 4);
        g.fillStyle(0xFFFFFF); g.fillCircle(4, 4, 2);
        g.generateTexture('tex_enemy_bolt', 8, 8);
        g.destroy();
    }

    _spawn(def) {
        const info = ENEMY_FRAMES[def.type];
        let e;

        if (info && this.scene.textures.exists(info.tex)) {
            e = this.scene.physics.add.sprite(def.x, def.y, info.tex, info.frame);
        } else {
            // Fallback: simple colored circle
            const colors = { slime: 0x4CAF50, skeleton: 0xBDBDBD, wolf: 0x757575, darkmage: 0x7B1FA2, dragon: 0xFF0000, kraken: 0x00BCD4 };
            const key = `tex_fb_${def.type}`;
            if (!this.scene.textures.exists(key)) {
                const g = this.scene.make.graphics({ add: false });
                g.fillStyle(colors[def.type] || 0xFF00FF);
                g.fillCircle(16, 16, def.isBoss ? 24 : 14);
                g.generateTexture(key, def.isBoss ? 48 : 32, def.isBoss ? 48 : 32);
                g.destroy();
            }
            e = this.scene.physics.add.sprite(def.x, def.y, key);
        }

        const scale = def.isBoss ? 0.15 : 0.08;
        e.setDepth(def.y).setScale(scale).setCollideWorldBounds(true);
        e.body.setCircle(def.isBoss ? 20 : 12);

        // Name label
        const names = { slime: '🟢 Слайм', skeleton: '💀 Скелет', wolf: '🐺 Волк', darkmage: '🟣 Тёмный маг', dragon: '🐉 ДРАКОН', kraken: '🐙 КРАКЕН' };
        e.nameLabel = this.scene.add.text(def.x, def.y - (def.isBoss ? 50 : 25), names[def.type] || def.type, {
            font: def.isBoss ? 'bold 12px Inter' : '9px Inter',
            fill: def.isBoss ? '#FF4444' : '#FFFFFF',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(def.y + 1);

        Object.assign(e, {
            mobId: def.id, enemyType: def.type,
            maxHp: def.hp, hp: def.hp, atkPow: def.atk, moveSpd: def.spd,
            xpVal: def.xp, detectRange: def.range,
            alive: true, def: { ...def },
            wanderTimer: 0, wanderAngle: Math.random() * Math.PI * 2, lastAtk: 0,
            isBoss: def.isBoss || false
        });

        // Breathing animation for enemies
        this.scene.tweens.add({
            targets: e, scaleX: scale * 1.08, scaleY: scale * 0.92,
            duration: 800 + Math.random() * 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });

        e.hpBg = this.scene.add.graphics();
        e.hpFill = this.scene.add.graphics();
        this.enemies.add(e);
    }

    // Network hit from another player
    applyNetworkHit(mobId, dmg) {
        const enemy = this.enemies.getChildren().find(e => e.mobId === mobId);
        if (enemy && enemy.alive) {
            enemy.hp -= dmg;
            this._floatText(enemy.x, enemy.y - 18, `-${dmg}`, '#FFAAFF');
            enemy.setTint(0xFF0000);
            this.scene.time.delayedCall(100, () => { if (enemy.active) enemy.clearTint(); });
            if (enemy.hp <= 0) this._kill(enemy, false);
        }
    }

    update(time, delta, px, py) {
        this.enemies.getChildren().forEach(e => {
            if (!e.alive || !e.active) return;

            const dist = Phaser.Math.Distance.Between(px, py, e.x, e.y);

            if (dist < e.detectRange) {
                const a = Phaser.Math.Angle.Between(e.x, e.y, px, py);
                e.setVelocity(Math.cos(a) * e.moveSpd, Math.sin(a) * e.moveSpd);

                if (dist < (e.isBoss ? 60 : 36) && time - e.lastAtk > (e.isBoss ? 800 : 1200)) {
                    e.lastAtk = time;
                    this._hurtPlayer(e);
                }
                if ((e.enemyType === 'darkmage' || e.enemyType === 'kraken') && dist > 80 && dist < 300 && time - e.lastAtk > 1800) {
                    e.lastAtk = time;
                    this._shootAtPlayer(e, px, py);
                }
            } else {
                e.wanderTimer -= delta;
                if (e.wanderTimer <= 0) {
                    e.wanderTimer = Phaser.Math.Between(2000, 5000);
                    e.wanderAngle = Math.random() * Math.PI * 2;
                    if (Math.random() < 0.25) { e.setVelocity(0, 0); return; }
                }
                e.setVelocity(
                    Math.cos(e.wanderAngle) * e.moveSpd * 0.35,
                    Math.sin(e.wanderAngle) * e.moveSpd * 0.35
                );
            }

            e.setDepth(e.y);
            if (e.nameLabel) e.nameLabel.setPosition(e.x, e.y - (e.isBoss ? 50 : 25)).setDepth(e.y + 1);
            this._drawHP(e);
        });

        this._processRespawns(time);
    }

    _hurtPlayer(e) {
        const u = this.scene.currentUser;
        const dmg = Math.max(1, e.atkPow - (u.defense || 5));
        u.hp = Math.max(0, (u.hp || 100) - dmg);

        this.scene.cameras.main.shake(100, 0.006);
        this.scene.player.setTint(0xFF0000);
        this.scene.time.delayedCall(150, () => {
            if (this.scene.player.active) this.scene.player.clearTint();
        });

        this._floatText(this.scene.player.x, this.scene.player.y - 25, `-${dmg}`, '#FF4B4B');
        if (window.updateHUD) window.updateHUD();
        if (u.hp <= 0) this._playerDie();
    }

    _shootAtPlayer(e, px, py) {
        const bolt = this.scene.physics.add.sprite(e.x, e.y, 'tex_enemy_bolt');
        bolt.setDepth(9000).setScale(e.isBoss ? 2 : 1);
        bolt.damage = Math.max(1, e.atkPow - 3);
        const a = Phaser.Math.Angle.Between(e.x, e.y, px, py);
        bolt.setVelocity(Math.cos(a) * (e.isBoss ? 240 : 160), Math.sin(a) * (e.isBoss ? 240 : 160));

        this.scene.physics.add.overlap(bolt, this.scene.player, () => {
            const u = this.scene.currentUser;
            u.hp = Math.max(0, (u.hp || 100) - bolt.damage);
            this.scene.cameras.main.shake(80, 0.005);
            this._floatText(this.scene.player.x, this.scene.player.y - 25, `-${bolt.damage}`, '#E040FB');
            bolt.destroy();
            if (window.updateHUD) window.updateHUD();
            if (u.hp <= 0) this._playerDie();
        });

        this.scene.time.delayedCall(3000, () => { if (bolt.active) bolt.destroy(); });
    }

    _playerDie() {
        const u = this.scene.currentUser;
        u.hp = u.max_hp || 100;
        this.scene.player.setPosition(1500, 1500);
        this.scene.questSystem?.showNotification('💀 Ты погиб! Возрождение в деревне.');
        if (window.updateHUD) window.updateHUD();
    }

    // Local player hits enemy
    damage(enemy, amount) {
        if (!enemy.alive) return;
        enemy.hp -= amount;
        enemy.setTint(0xFFFFFF);
        this.scene.time.delayedCall(100, () => { if (enemy.active) enemy.clearTint(); });
        this._floatText(enemy.x, enemy.y - 18, `-${amount}`, '#FFD700');

        // Broadcast hit to other players
        broadcastMobHit({ mobId: enemy.mobId, dmg: amount });

        if (enemy.hp <= 0) this._kill(enemy, true);
    }

    _kill(enemy, isLocalKiller) {
        enemy.alive = false;
        enemy.setVelocity(0, 0);

        this.scene.tweens.add({
            targets: enemy, alpha: 0, scale: 0.02, duration: 500,
            onComplete: () => {
                enemy.hpBg.clear(); enemy.hpFill.clear();
                if (enemy.nameLabel) enemy.nameLabel.setVisible(false);
                enemy.setActive(false).setVisible(false);
                enemy.body.enable = false;
            }
        });

        if (isLocalKiller) {
            const u = this.scene.currentUser;
            u.xp = (u.xp || 0) + enemy.xpVal;
            if (this.scene.questSystem) this.scene.questSystem.checkLevelUp(u);
            if (window.updateHUD) window.updateHUD();
            this._floatText(enemy.x, enemy.y - 25, `+${enemy.xpVal} XP`, '#4FC3F7');

            if (enemy.isBoss) {
                this.scene.questSystem?.showNotification(`🔥 Босс повержен! +${enemy.xpVal} XP`);
            }

            // Loot
            if (this.scene.inventorySystem && (Math.random() < 0.4 || enemy.isBoss)) {
                const drops = ['health_potion', 'big_health_potion', 'mushroom_item', 'gold_ring', 'iron_sword'];
                const count = enemy.isBoss ? 5 : 1;
                for (let i = 0; i < count; i++) {
                    this.scene.inventorySystem.addItem(drops[Math.floor(Math.random() * drops.length)]);
                }
            }
        }

        // Particles
        if (this.scene.textures.exists('tex_sparkle')) {
            const p = this.scene.add.particles(enemy.x, enemy.y, 'tex_sparkle', {
                speed: { min: 40, max: 150 }, lifespan: 800,
                quantity: enemy.isBoss ? 35 : 15,
                scale: { start: enemy.isBoss ? 3 : 1.5, end: 0 },
                alpha: { start: 1, end: 0 }, emitting: false
            });
            p.explode(enemy.isBoss ? 35 : 15);
            this.scene.time.delayedCall(1000, () => p.destroy());
        }

        // Respawn — same fixed position from def
        this.respawnQueue.push({ def: enemy.def, time: this.scene.time.now + (enemy.isBoss ? 60000 : 15000) });
    }

    _processRespawns(time) {
        const ready = this.respawnQueue.filter(r => time >= r.time);
        ready.forEach(r => this._spawn(r.def));
        this.respawnQueue = this.respawnQueue.filter(r => time < r.time);
    }

    _drawHP(e) {
        const w = e.isBoss ? 60 : 28, h = e.isBoss ? 6 : 3;
        const x = e.x - w / 2, y = e.y - (e.isBoss ? 40 : 18), pct = e.hp / e.maxHp;
        e.hpBg.clear().fillStyle(0x000000, 0.6).fillRect(x, y, w, h).setDepth(e.y + 1);
        const c = pct > 0.5 ? 0x4CAF50 : pct > 0.25 ? 0xFFC107 : 0xFF4B4B;
        e.hpFill.clear().fillStyle(c).fillRect(x, y, w * pct, h).setDepth(e.y + 2);
    }

    _floatText(x, y, text, color) {
        const t = this.scene.add.text(x, y, text, {
            font: 'bold 14px Inter', fill: color, stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(10000);
        this.scene.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 1000, onComplete: () => t.destroy() });
    }
}
