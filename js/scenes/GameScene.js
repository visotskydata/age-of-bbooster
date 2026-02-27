import { dbSync } from '../core/db.js';
import { MapGenerator } from '../map/MapGenerator.js';

export class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    preload() {
        // Спрайт героя
        this.load.spritesheet('hero',
            'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/dude.png',
            { frameWidth: 32, frameHeight: 48 }
        );
    }

    create() {
        this.currentUser = this.registry.get('user');
        this.otherPlayers = this.add.group();

        // 1. ГЕНЕРАЦИЯ КАРТЫ
        const mapGen = new MapGenerator(this);
        const { obstacles, worldW, worldH } = mapGen.generate();

        // 2. ГРАНИЦЫ МИРА
        this.physics.world.setBounds(0, 0, worldW, worldH);

        // 3. АНИМАЦИИ ГЕРОЯ
        if (!this.anims.exists('left')) {
            this.anims.create({ key: 'left', frames: this.anims.generateFrameNumbers('hero', { start: 0, end: 3 }), frameRate: 10, repeat: -1 });
        }
        if (!this.anims.exists('turn')) {
            this.anims.create({ key: 'turn', frames: [{ key: 'hero', frame: 4 }], frameRate: 20 });
        }
        if (!this.anims.exists('right')) {
            this.anims.create({ key: 'right', frames: this.anims.generateFrameNumbers('hero', { start: 5, end: 8 }), frameRate: 10, repeat: -1 });
        }

        // 4. ИГРОК (спавн в центре деревни если координаты дефолтные)
        const startX = this.currentUser.x || 1500;
        const startY = this.currentUser.y || 1500;

        this.player = this.physics.add.sprite(startX, startY, 'hero');
        this.player.setCollideWorldBounds(true);
        this.player.setDepth(startY);
        this.player.setScale(1.2); // Чуть крупнее

        // Коллизия с препятствиями
        this.physics.add.collider(this.player, obstacles);

        // Имя игрока
        this.nameText = this.add.text(startX, startY - 45, this.currentUser.login, {
            font: '14px Arial', fill: '#ffffff',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5);

        // 5. КАМЕРА
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setZoom(1.5); // Приближаем камеру для лучшей детализации
        this.cameras.main.setBounds(0, 0, worldW, worldH);

        // 6. УПРАВЛЕНИЕ (клик → moveTo)
        this.target = new Phaser.Math.Vector2(startX, startY);
        this.isMoving = false;

        // Маркер цели (зеленая пульсирующая точка)
        const markerGfx = this.make.graphics({ add: false });
        markerGfx.fillStyle(0x00FF00, 0.8);
        markerGfx.fillCircle(8, 8, 8);
        markerGfx.fillStyle(0xFFFFFF, 0.5);
        markerGfx.fillCircle(8, 8, 4);
        markerGfx.generateTexture('marker', 16, 16);
        markerGfx.destroy();

        this.targetMarker = this.add.image(0, 0, 'marker').setVisible(false).setDepth(9999).setAlpha(0.6);
        this.tweens.add({
            targets: this.targetMarker,
            scale: { from: 1, to: 0.5 },
            alpha: { from: 0.7, to: 0.3 },
            duration: 600,
            yoyo: true,
            repeat: -1
        });

        this.input.on('pointerdown', (pointer) => {
            const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
            this.moveTo(wp.x, wp.y);
        });

        // 7. МИНИ-КАРТА (маленькая камера в углу)
        const miniSize = 160;
        const miniCam = this.cameras.add(
            this.scale.width - miniSize - 10, 10,
            miniSize, miniSize
        );
        miniCam.setZoom(miniSize / worldW);
        miniCam.setScroll(0, 0);
        miniCam.scrollX = 0;
        miniCam.scrollY = 0;
        miniCam.setBounds(0, 0, worldW, worldH);
        miniCam.setBackgroundColor(0x1a1a1a);
        // Мини-карта не следит за игроком, показывает всю карту
        miniCam.centerOn(worldW / 2, worldH / 2);

        // 8. СИНХРОНИЗАЦИЯ
        this.time.addEvent({
            delay: 500,
            callback: this.syncNetwork,
            callbackScope: this,
            loop: true
        });
        this.syncNetwork();
    }

    moveTo(x, y) {
        this.target.x = x;
        this.target.y = y;
        this.isMoving = true;
        this.targetMarker.setPosition(x, y).setVisible(true);
        this.physics.moveToObject(this.player, this.target, 200);
        this.currentUser.x = Math.round(x);
        this.currentUser.y = Math.round(y);
    }

    async syncNetwork() {
        if (!this.player) return;
        this.currentUser.x = Math.round(this.player.x);
        this.currentUser.y = Math.round(this.player.y);
        const serverPlayers = await dbSync(this.currentUser);
        this.updateOtherPlayers(serverPlayers);
    }

    updateOtherPlayers(serverPlayers) {
        const activeIds = new Set();
        serverPlayers.forEach(pData => {
            if (pData.id === this.currentUser.id) return;
            activeIds.add(pData.id);

            let op = this.otherPlayers.getChildren().find(p => p.playerId === pData.id);

            if (op) {
                // Анимация
                if (op.x !== pData.x || op.y !== pData.y) {
                    if (pData.x < op.x) op.anims.play('left', true);
                    else if (pData.x > op.x) op.anims.play('right', true);
                } else {
                    op.anims.play('turn');
                }
                this.tweens.add({ targets: op, x: pData.x, y: pData.y, duration: 500, ease: 'Linear' });
                op.setDepth(pData.y);
            } else {
                // Новый игрок
                const ns = this.add.sprite(pData.x, pData.y, 'hero');
                ns.setTint(0xff6666);
                ns.setScale(1.2);
                ns.playerId = pData.id;
                ns.nameText = this.add.text(pData.x, pData.y - 45, pData.login, {
                    font: '14px Arial', fill: '#ffcccc',
                    stroke: '#000000', strokeThickness: 3
                }).setOrigin(0.5);
                this.otherPlayers.add(ns);
            }
        });

        this.otherPlayers.getChildren().forEach(child => {
            if (!activeIds.has(child.playerId)) {
                if (child.nameText) child.nameText.destroy();
                child.destroy();
            }
        });
    }

    update() {
        // Анимация и остановка игрока
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.target.x, this.target.y);

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
        }

        // Depth sorting
        this.player.setDepth(this.player.y);
        if (this.nameText) {
            this.nameText.setPosition(this.player.x, this.player.y - 45).setDepth(this.player.y + 1);
        }

        this.otherPlayers.getChildren().forEach(p => {
            if (p.nameText) p.nameText.setPosition(p.x, p.y - 45).setDepth(p.y + 1);
        });
    }
}
