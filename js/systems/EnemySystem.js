// js/systems/EnemySystem.js
// Enemy spawning, AI (wander + chase), combat, death, respawn

export class EnemySystem {
    constructor(scene) {
        this.scene = scene;
        this.enemies = scene.physics.add.group();
        this.respawnQueue = [];
    }

    create() {
        this._genTextures();
        this._spawnAll();
    }

    _genTextures() {
        const s = this.scene;
        let g;

        // SLIME
        g = s.make.graphics({ add: false });
        g.fillStyle(0x4CAF50); g.fillCircle(12, 14, 11);
        g.fillStyle(0x66BB6A, 0.6); g.fillCircle(10, 10, 5);
        g.fillStyle(0x000000); g.fillCircle(8, 12, 2); g.fillCircle(16, 12, 2);
        g.fillStyle(0x2E7D32, 0.4); g.fillEllipse(12, 22, 20, 6);
        g.generateTexture('tex_slime', 24, 26);
        g.destroy();

        // SKELETON
        g = s.make.graphics({ add: false });
        g.fillStyle(0xBDBDBD); g.fillCircle(14, 14, 12);
        g.fillStyle(0xEEEEEE, 0.5); g.fillCircle(14, 11, 6);
        g.fillStyle(0x1A1A1A); g.fillCircle(10, 12, 3); g.fillCircle(18, 12, 3);
        g.fillStyle(0x333333); g.fillRect(10, 18, 8, 2);
        g.generateTexture('tex_skeleton', 28, 28);
        g.destroy();

        // WOLF
        g = s.make.graphics({ add: false });
        g.fillStyle(0x616161); g.fillEllipse(16, 14, 28, 18);
        g.fillStyle(0x9E9E9E, 0.5); g.fillEllipse(16, 10, 14, 10);
        g.fillStyle(0xEF5350); g.fillCircle(12, 12, 2.5); g.fillCircle(20, 12, 2.5);
        g.fillTriangle(10, 4, 8, 10, 12, 10);
        g.fillTriangle(22, 4, 20, 10, 24, 10);
        g.generateTexture('tex_wolf', 32, 26);
        g.destroy();

        // DARK MAGE
        g = s.make.graphics({ add: false });
        g.fillStyle(0x4A148C); g.fillCircle(14, 14, 13);
        g.fillStyle(0x7B1FA2, 0.5); g.fillCircle(14, 10, 7);
        g.fillStyle(0xE040FB); g.fillCircle(10, 12, 2.5); g.fillCircle(18, 12, 2.5);
        g.fillStyle(0xEA80FC, 0.4); g.fillTriangle(14, 0, 10, 8, 18, 8);
        g.generateTexture('tex_darkmage', 28, 28);
        g.destroy();

        // ENEMY PROJECTILE
        g = s.make.graphics({ add: false });
        g.fillStyle(0x9C27B0, 0.7); g.fillCircle(4, 4, 4);
        g.fillStyle(0xE040FB); g.fillCircle(4, 4, 2);
        g.generateTexture('tex_enemy_bolt', 8, 8);
        g.destroy();
    }

    _spawnAll() {
        const defs = [
            { type: 'slime', tex: 'tex_slime', zone: { xMin: 120, xMax: 830, yMin: 120, yMax: 830 }, count: 8, hp: 30, atk: 5, spd: 45, xp: 15, range: 200 },
            { type: 'skeleton', tex: 'tex_skeleton', zone: { xMin: 2120, xMax: 2830, yMin: 140, yMax: 730 }, count: 6, hp: 50, atk: 10, spd: 65, xp: 25, range: 250 },
            { type: 'wolf', tex: 'tex_wolf', zone: { xMin: 120, xMax: 780, yMin: 2120, yMax: 2780 }, count: 7, hp: 35, atk: 12, spd: 95, xp: 20, range: 300 },
            { type: 'darkmage', tex: 'tex_darkmage', zone: { xMin: 2100, xMax: 2700, yMin: 2100, yMax: 2700 }, count: 5, hp: 70, atk: 15, spd: 50, xp: 35, range: 280 },
        ];
        defs.forEach(d => { for (let i = 0; i < d.count; i++) this._spawn(d); });
    }

    _spawn(def) {
        const x = Phaser.Math.Between(def.zone.xMin, def.zone.xMax);
        const y = Phaser.Math.Between(def.zone.yMin, def.zone.yMax);
        // Avoid lake center
        if (def.type === 'darkmage' && Math.hypot(x - 2500, y - 2500) < 250) return;

        const e = this.scene.physics.add.sprite(x, y, def.tex);
        e.setDepth(y).setScale(1.2).setCollideWorldBounds(true);
        e.body.setCircle(12, (e.width * e.scaleX) / 2 - 12, (e.height * e.scaleY) / 2 - 12);

        Object.assign(e, {
            enemyType: def.type, maxHp: def.hp, hp: def.hp, atkPow: def.atk,
            moveSpd: def.spd, xpVal: def.xp, detectRange: def.range,
            alive: true, def, wanderTimer: 0,
            wanderAngle: Math.random() * Math.PI * 2, lastAtk: 0
        });

        e.hpBg = this.scene.add.graphics();
        e.hpFill = this.scene.add.graphics();
        this.enemies.add(e);
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
                if (dist < 32 && time - e.lastAtk > 1200) {
                    e.lastAtk = time;
                    this._hurtPlayer(e);
                }
                // Dark mage ranged attack
                if (e.enemyType === 'darkmage' && dist > 60 && dist < 200 && time - e.lastAtk > 2000) {
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
                e.setVelocity(
                    Math.cos(e.wanderAngle) * e.moveSpd * 0.35,
                    Math.sin(e.wanderAngle) * e.moveSpd * 0.35
                );
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

        this.scene.cameras.main.shake(80, 0.005);
        this.scene.player.setTint(0xFF0000);
        this.scene.time.delayedCall(150, () => {
            const ct = { warrior: 0xFFAAAA, mage: 0xAAAAFF, archer: 0xAAFFAA }[u.class];
            if (this.scene.player.active) this.scene.player.setTint(ct || 0xFFFFFF);
        });

        this._floatText(this.scene.player.x, this.scene.player.y - 25, `-${dmg}`, '#FF4B4B');
        if (window.updateHUD) window.updateHUD();

        if (u.hp <= 0) {
            u.hp = u.max_hp || 100;
            this.scene.player.setPosition(1500, 1500);
            this.scene.questSystem?.showNotification('💀 Ты погиб! Возрождение в деревне.');
            if (window.updateHUD) window.updateHUD();
        }
    }

    _shootAtPlayer(e, px, py) {
        const bolt = this.scene.physics.add.sprite(e.x, e.y, 'tex_enemy_bolt');
        bolt.setDepth(9000);
        bolt.damage = Math.max(1, e.atkPow - 3);
        const a = Phaser.Math.Angle.Between(e.x, e.y, px, py);
        bolt.setVelocity(Math.cos(a) * 160, Math.sin(a) * 160);
        bolt.setRotation(a);

        this.scene.physics.add.overlap(bolt, this.scene.player, () => {
            const u = this.scene.currentUser;
            u.hp = Math.max(0, (u.hp || 100) - bolt.damage);
            this.scene.cameras.main.shake(60, 0.004);
            this._floatText(this.scene.player.x, this.scene.player.y - 25, `-${bolt.damage}`, '#E040FB');
            bolt.destroy();
            if (window.updateHUD) window.updateHUD();
            if (u.hp <= 0) {
                u.hp = u.max_hp || 100;
                this.scene.player.setPosition(1500, 1500);
            }
        });

        this.scene.time.delayedCall(3000, () => { if (bolt.active) bolt.destroy(); });
    }

    damage(enemy, amount) {
        if (!enemy.alive) return;
        enemy.hp -= amount;
        enemy.setTint(0xFFFFFF);
        this.scene.time.delayedCall(100, () => { if (enemy.active) enemy.clearTint(); });
        this._floatText(enemy.x, enemy.y - 18, `-${amount}`, '#FFD700');

        if (enemy.hp <= 0) this._kill(enemy);
    }

    _kill(enemy) {
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

        // XP
        const u = this.scene.currentUser;
        u.xp = (u.xp || 0) + enemy.xpVal;
        if (this.scene.questSystem) this.scene.questSystem.checkLevelUp(u);
        if (window.updateHUD) window.updateHUD();
        this._floatText(enemy.x, enemy.y - 25, `+${enemy.xpVal} XP`, '#4FC3F7');

        // Particle burst
        if (this.scene.textures.exists('tex_sparkle')) {
            const p = this.scene.add.particles(enemy.x, enemy.y, 'tex_sparkle', {
                speed: { min: 40, max: 100 }, lifespan: 600, quantity: 12,
                scale: { start: 1.5, end: 0 }, alpha: { start: 1, end: 0 }, emitting: false
            });
            p.explode(12); this.scene.time.delayedCall(800, () => p.destroy());
        }

        // Random loot
        if (Math.random() < 0.35 && this.scene.inventorySystem) {
            const drops = ['health_potion', 'mushroom_item', 'health_potion'];
            this.scene.inventorySystem.addItem(drops[Math.floor(Math.random() * drops.length)]);
        }

        // Queue respawn
        this.respawnQueue.push({ def: enemy.def, time: this.scene.time.now + 15000 });
    }

    _processRespawns(time) {
        const ready = this.respawnQueue.filter(r => time >= r.time);
        ready.forEach(r => this._spawn(r.def));
        this.respawnQueue = this.respawnQueue.filter(r => time < r.time);
    }

    _drawHP(e) {
        const w = 24, h = 3, x = e.x - w / 2, y = e.y - 20, pct = e.hp / e.maxHp;
        e.hpBg.clear().fillStyle(0x000000, 0.6).fillRect(x, y, w, h).setDepth(e.y + 1);
        const c = pct > 0.5 ? 0x4CAF50 : pct > 0.25 ? 0xFFC107 : 0xFF4B4B;
        e.hpFill.clear().fillStyle(c).fillRect(x, y, w * pct, h).setDepth(e.y + 2);
    }

    _floatText(x, y, text, color) {
        const t = this.scene.add.text(x, y, text, {
            font: 'bold 13px Inter', fill: color, stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(10000);
        this.scene.tweens.add({ targets: t, y: y - 35, alpha: 0, duration: 900, onComplete: () => t.destroy() });
    }
}
