// js/systems/EnemySystem.js
// Enemy spawning, AI, combat, death, respawn, Bosses, and Multiplayer Sync

import { broadcastMobHit } from '../core/db.js';

export class EnemySystem {
    constructor(scene) {
        this.scene = scene;
        this.enemies = scene.physics.add.group();
        this.respawnQueue = [];
        this.networkHits = [];
    }

    create() {
        this._genTextures();
        this._spawnAll();
    }

    _genTextures() {
        const s = this.scene;
        let g;

        // Create glowing neon textures
        const makeNeon = (key, color, shapeFn, w, h) => {
            g = s.make.graphics({ add: false });
            // core glow
            g.lineStyle(6, color, 0.3); shapeFn(g);
            g.lineStyle(3, color, 0.8); shapeFn(g);
            g.lineStyle(1, 0xFFFFFF, 1.0); shapeFn(g);
            g.generateTexture(key, w, h);
            g.destroy();
        };

        makeNeon('tex_slime', 0x00FF00, (g) => {
            g.beginPath(); g.arc(16, 16, 12, 0, Math.PI * 2); g.strokePath();
        }, 32, 32);

        makeNeon('tex_skeleton', 0xEEEEEE, (g) => {
            g.strokeRect(8, 8, 16, 16);
            g.beginPath(); g.moveTo(8, 8); g.lineTo(24, 24); g.strokePath();
        }, 32, 32);

        makeNeon('tex_wolf', 0xFF5252, (g) => {
            g.beginPath(); g.moveTo(16, 4); g.lineTo(28, 28); g.lineTo(4, 28); g.closePath(); g.strokePath();
        }, 32, 32);

        makeNeon('tex_darkmage', 0xAA00FF, (g) => {
            g.beginPath(); g.moveTo(16, 4); g.lineTo(24, 16); g.lineTo(16, 28); g.lineTo(8, 16); g.closePath(); g.strokePath();
        }, 32, 32);

        // DRAGON BOSS
        makeNeon('tex_dragon', 0xFF0000, (g) => {
            g.strokeRect(10, 10, 44, 44);
            g.beginPath(); g.arc(32, 32, 16, 0, Math.PI * 2); g.strokePath();
            g.strokeRect(4, 4, 12, 12); g.strokeRect(48, 4, 12, 12);
        }, 64, 64);

        // KRAKEN BOSS
        makeNeon('tex_kraken', 0x00BFFF, (g) => {
            g.beginPath(); g.arc(32, 32, 20, 0, Math.PI * 2); g.strokePath();
            // tentacles
            for (let i = 0; i < 8; i++) {
                let a = (i / 8) * Math.PI * 2;
                g.beginPath(); g.moveTo(32 + Math.cos(a) * 20, 32 + Math.sin(a) * 20);
                g.lineTo(32 + Math.cos(a) * 30, 32 + Math.sin(a) * 30); g.strokePath();
            }
        }, 64, 64);

        g = s.make.graphics({ add: false });
        g.fillStyle(0xAA00FF, 0.8); g.fillCircle(4, 4, 4);
        g.fillStyle(0xFFFFFF); g.fillCircle(4, 4, 2);
        g.generateTexture('tex_enemy_bolt', 8, 8);
        g.destroy();
    }

    _spawnAll() {
        
        const defs = [
            { type: 'slime', tex: 'tex_slime', zone: { minX: 120, maxX: 830, minY: 120, maxY: 830 }, count: 10, hp: 30, atk: 5, spd: 45, xp: 15, range: 200 },
            { type: 'skeleton', tex: 'tex_skeleton', zone: { minX: 2120, maxX: 2830, minY: 140, maxY: 730 }, count: 8, hp: 50, atk: 10, spd: 65, xp: 25, range: 250 },
            { type: 'wolf', tex: 'tex_wolf', zone: { minX: 120, maxX: 780, minY: 2120, maxY: 2780 }, count: 8, hp: 35, atk: 12, spd: 95, xp: 20, range: 300 },
            { type: 'darkmage', tex: 'tex_darkmage', zone: { minX: 2100, maxX: 2700, minY: 2100, maxY: 2700 }, count: 5, hp: 70, atk: 15, spd: 50, xp: 35, range: 280 },
        ];

        // Spawn standard mobs
        defs.forEach(d => {
            for (let i = 0; i < d.count; i++) {
                this._spawn({ ...d, id: `mob_${d.type}_${i}` });
            }
        });

        // Spawn Bosses
        this._spawn({
            id: 'boss_dragon', type: 'dragon', tex: 'tex_dragon',
            x: 2500, y: 400, hp: 1000, atk: 30, spd: 80, xp: 500, range: 400, isBoss: true
        });

        this._spawn({
            id: 'boss_kraken', type: 'kraken', tex: 'tex_kraken',
            x: 2500, y: 2500, hp: 800, atk: 25, spd: 40, xp: 400, range: 350, isBoss: true
        });
    }

    _spawn(def) {
        
        let x = def.x;
        let y = def.y;
        if (x === undefined) {
            x = Phaser.Math.Between(def.zone.minX, def.zone.maxX);
            y = Phaser.Math.Between(def.zone.minY, def.zone.maxY);
            if (def.type === 'darkmage' && Math.hypot(x - 2500, y - 2500) < 250) return; // keep out of lake center
        }

        const e = this.scene.physics.add.sprite(x, y, def.tex);
        e.setDepth(y).setScale(def.isBoss ? 1.5 : 1.2).setCollideWorldBounds(true);
        e.body.setCircle(def.isBoss ? 24 : 12);

        Object.assign(e, {
            mobId: def.id, enemyType: def.type,
            maxHp: def.hp, hp: def.hp, atkPow: def.atk, moveSpd: def.spd, xpVal: def.xp, detectRange: def.range,
            alive: true, def, wanderTimer: 0,
            wanderAngle: Math.random() * Math.PI * 2, lastAtk: 0, isBoss: def.isBoss
        });

        e.hpBg = this.scene.add.graphics();
        e.hpFill = this.scene.add.graphics();
        this.enemies.add(e);
    }

    // Called when another player hits a mob
    applyNetworkHit(mobId, dmg) {
        const enemy = this.enemies.getChildren().find(e => e.mobId === mobId);
        if (enemy && enemy.alive) {
            enemy.hp -= dmg;
            this._floatText(enemy.x, enemy.y - 18, `-${dmg}`, '#FFAAFF');
            if (enemy.hp <= 0) this._kill(enemy, false); // false = not local kill so no XP
            else {
                enemy.setTint(0xFF0000);
                this.scene.time.delayedCall(100, () => { if (enemy.active) enemy.clearTint(); });
            }
        }
    }

    update(time, delta, px, py) {
        this.enemies.getChildren().forEach(e => {
            if (!e.alive || !e.active) return;

            const dist = Phaser.Math.Distance.Between(px, py, e.x, e.y);

            if (dist < e.detectRange) {
                // CHASE
                const a = Phaser.Math.Angle.Between(e.x, e.y, px, py);
                e.setVelocity(Math.cos(a) * e.moveSpd, Math.sin(a) * e.moveSpd);
                e.setRotation(a + Math.PI / 2);

                // Melee attack
                if (dist < (e.isBoss ? 60 : 36) && time - e.lastAtk > (e.isBoss ? 800 : 1200)) {
                    e.lastAtk = time;
                    this._hurtPlayer(e);
                }
                // Ranged attack (Dark Mage & Kraken)
                if ((e.enemyType === 'darkmage' || e.enemyType === 'kraken') && dist > 80 && dist < 300 && time - e.lastAtk > 1800) {
                    e.lastAtk = time;
                    this._shootAtPlayer(e, px, py);
                }
            } else {
                // WANDER
                e.wanderTimer -= delta;
                if (e.wanderTimer <= 0) {
                    e.wanderTimer = Phaser.Math.Between(2000, 5000);
                    e.wanderAngle = Math.random() * Math.PI * 2;
                    if (Math.random() < 0.25) { e.setVelocity(0, 0); return; }
                }
                e.setVelocity(Math.cos(e.wanderAngle) * e.moveSpd * 0.35, Math.sin(e.wanderAngle) * e.moveSpd * 0.35);
                e.setRotation(e.wanderAngle + Math.PI / 2);
            }

            e.setDepth(e.y);
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
        bolt.setRotation(a);

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

        // Broadcast hit!
        broadcastMobHit({ mobId: enemy.mobId, dmg: amount });

        if (enemy.hp <= 0) this._kill(enemy, true);
    }

    _kill(enemy, isLocalKiller) {
        enemy.alive = false;
        enemy.setVelocity(0, 0);

        this.scene.tweens.add({
            targets: enemy, alpha: 0, scale: 0.2, duration: 400,
            onComplete: () => {
                enemy.hpBg.clear(); enemy.hpFill.clear();
                enemy.setActive(false).setVisible(false);
                enemy.body.enable = false;
            }
        });

        // XP & Loot only if local player killed it (prevent double XP, though could be shared)
        if (isLocalKiller) {
            const u = this.scene.currentUser;
            u.xp = (u.xp || 0) + enemy.xpVal;
            if (this.scene.questSystem) this.scene.questSystem.checkLevelUp(u);
            if (window.updateHUD) window.updateHUD();
            this._floatText(enemy.x, enemy.y - 25, `+${enemy.xpVal} XP`, '#4FC3F7');

            if (enemy.isBoss) {
                this.scene.questSystem?.showNotification(`🔥 Босс повержен! Огромная награда! +${enemy.xpVal}XP`);
            }

            // Loot
            if (this.scene.inventorySystem && (Math.random() < 0.4 || enemy.isBoss)) {
                for (let i = 0; i < (enemy.isBoss ? 5 : 1); i++) {
                    const drops = ['health_potion', 'big_health_potion', 'mushroom_item', 'gold_ring', 'iron_sword'];
                    this.scene.inventorySystem.addItem(drops[Math.floor(Math.random() * drops.length)]);
                }
            }
        }

        // Particle burst
        if (this.scene.textures.exists('tex_sparkle')) {
            const p = this.scene.add.particles(enemy.x, enemy.y, 'tex_sparkle', {
                speed: { min: 40, max: 150 }, lifespan: 800, quantity: enemy.isBoss ? 40 : 15,
                scale: { start: enemy.isBoss ? 3 : 1.5, end: 0 }, alpha: { start: 1, end: 0 }, emitting: false,
                blendMode: 'ADD'
            });
            p.explode(enemy.isBoss ? 40 : 15); this.scene.time.delayedCall(1000, () => p.destroy());
        }

        // Queue respawn
        this.respawnQueue.push({ def: enemy.def, time: this.scene.time.now + (enemy.isBoss ? 60000 : 15000) });
    }

    _processRespawns(time) {
        const ready = this.respawnQueue.filter(r => time >= r.time);
        ready.forEach(r => this._spawn(r.def));
        this.respawnQueue = this.respawnQueue.filter(r => time < r.time);
    }

    _drawHP(e) {
        const w = e.isBoss ? 60 : 24, h = e.isBoss ? 6 : 3;
        const x = e.x - w / 2, y = e.y - (e.isBoss ? 45 : 20), pct = e.hp / e.maxHp;
        e.hpBg.clear().fillStyle(0x000000, 0.6).fillRect(x, y, w, h).setDepth(e.y + 1);
        const c = pct > 0.5 ? 0x00FF00 : pct > 0.25 ? 0xFFFF00 : 0xFF0000;
        e.hpFill.clear().fillStyle(c).fillRect(x, y, w * pct, h).setDepth(e.y + 2);
    }

    _floatText(x, y, text, color) {
        const t = this.scene.add.text(x, y, text, {
            font: 'bold 15px Inter', fill: color, stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(10000);
        this.scene.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 1000, onComplete: () => t.destroy() });
    }
}
