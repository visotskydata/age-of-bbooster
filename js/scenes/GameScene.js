import { dbSync } from '../core/db.js';

export class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    preload() {
        // ИСПРАВЛЕНИЕ: Используем надежную ссылку с GitHub (raw), а не с labs.phaser.io
        this.load.spritesheet('hero', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/dude.png', { 
            frameWidth: 32, frameHeight: 48 
        });
        
        this.load.image('tree', 'https://labs.phaser.io/assets/sprites/tree-european.png');
        this.load.image('grass', 'https://labs.phaser.io/assets/skies/sky4.png');
        this.load.image('target', 'https://labs.phaser.io/assets/sprites/apple.png');
    }

    create() {
        this.currentUser = this.registry.get('user');
        this.otherPlayers = this.add.group(); 

        // 1. МИР
        this.physics.world.setBounds(0, 0, 2000, 2000);
        this.add.tileSprite(1000, 1000, 2000, 2000, 'grass');

        // --- 2. АНИМАЦИИ ---
        // Проверяем существование, чтобы не создавать дубли
        if (!this.anims.exists('left')) {
            this.anims.create({
                key: 'left',
                frames: this.anims.generateFrameNumbers('hero', { start: 0, end: 3 }),
                frameRate: 10,
                repeat: -1
            });
        }

        if (!this.anims.exists('turn')) {
            this.anims.create({
                key: 'turn',
                frames: [ { key: 'hero', frame: 4 } ],
                frameRate: 20
            });
        }

        if (!this.anims.exists('right')) {
            this.anims.create({
                key: 'right',
                frames: this.anims.generateFrameNumbers('hero', { start: 5, end: 8 }),
                frameRate: 10,
                repeat: -1
            });
        }

        // --- 3. ДЕРЕВЬЯ ---
        this.trees = this.physics.add.staticGroup();

        const treePositions = [
            {x: 200, y: 300}, {x: 500, y: 100}, {x: 800, y: 600},
            {x: 1200, y: 400}, {x: 1500, y: 800}, {x: 300, y: 1000},
            {x: 1000, y: 1200}, {x: 1800, y: 200}, {x: 600, y: 1500}
        ];

        treePositions.forEach(pos => {
            const tree = this.trees.create(pos.x, pos.y, 'tree');
            tree.setDepth(pos.y);
            
            // ВАЖНО: Сначала обновляем тело, чтобы Phaser понял размеры картинки
            tree.refreshBody();

            // 1. Делаем хитбокс маленьким (только ствол)
            // Например, 40% от ширины и 20% от высоты картинки
            const newWidth = tree.width * 0.4;
            const newHeight = tree.height * 0.2;

            tree.body.setSize(newWidth, newHeight);

            // 2. Сдвигаем хитбокс вниз по центру
            // Offset X = (ШиринаКартинки - ШиринаХитбокса) / 2
            // Offset Y = ВысотаКартинки - ВысотаХитбокса
            tree.body.setOffset(
                (tree.width - newWidth) / 2, 
                tree.height - newHeight
            );
        });

        // --- 4. НАШ ИГРОК ---
        const startX = this.currentUser.x || 400;
        const startY = this.currentUser.y || 300;
        
        this.player = this.physics.add.sprite(startX, startY, 'hero');
        this.player.setCollideWorldBounds(true);
        this.player.setDepth(startY);

        this.physics.add.collider(this.player, this.trees);

        this.nameText = this.add.text(startX, startY - 40, this.currentUser.login, {
            font: '14px Arial', fill: '#ffffff', stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5);

        // --- 5. КАМЕРА ---
        this.cameras.main.startFollow(this.player, true, 0.05, 0.05);

        // --- 6. УПРАВЛЕНИЕ ---
        this.targetMarker = this.add.image(0, 0, 'target').setVisible(false).setAlpha(0.5);
        this.target = new Phaser.Math.Vector2();

        this.input.on('pointerdown', (pointer) => {
            const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
            this.moveTo(worldPoint.x, worldPoint.y);
        });

        // СИНХРОНИЗАЦИЯ
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
        this.targetMarker.setPosition(x, y).setVisible(true);
        this.physics.moveToObject(this.player, this.target, 200);
        
        this.currentUser.x = x;
        this.currentUser.y = y;
    }

    async syncNetwork() {
        if (!this.player) return; // Защита если игрок не создан
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

            let otherPlayer = this.otherPlayers.getChildren().find(p => p.playerId === pData.id);

            if (otherPlayer) {
                // АНИМАЦИЯ
                if (otherPlayer.x !== pData.x || otherPlayer.y !== pData.y) {
                    if (pData.x < otherPlayer.x) otherPlayer.anims.play('left', true);
                    else if (pData.x > otherPlayer.x) otherPlayer.anims.play('right', true);
                } else {
                    otherPlayer.anims.play('turn');
                }

                this.tweens.add({
                    targets: otherPlayer,
                    x: pData.x, y: pData.y,
                    duration: 500, 
                    ease: 'Linear'
                });
                otherPlayer.setDepth(pData.y);

            } else {
                // СОЗДАНИЕ
                const newSprite = this.add.sprite(pData.x, pData.y, 'hero');
                newSprite.setTint(0xff0000); 
                newSprite.playerId = pData.id; 
                newSprite.nameText = this.add.text(pData.x, pData.y - 40, pData.login, {
                    font: '14px Arial', fill: '#ffcccc', stroke: '#000000', strokeThickness: 3
                }).setOrigin(0.5);
                this.otherPlayers.add(newSprite);
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
        // ОСТАНОВКА И АНИМАЦИЯ НАШЕГО ИГРОКА
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.target.x, this.target.y);
        
        if (this.player.body.speed > 0) {
            if (this.player.body.velocity.x < 0) {
                this.player.anims.play('left', true);
            } else if (this.player.body.velocity.x > 0) {
                this.player.anims.play('right', true);
            } else {
                this.player.anims.play('left', true); 
            }

            if (distance < 5) {
                this.player.body.reset(this.target.x, this.target.y);
                this.targetMarker.setVisible(false);
                this.player.anims.play('turn'); 
            }
        } else {
            this.player.anims.play('turn'); 
        }
        
        this.player.setDepth(this.player.y);
        if (this.nameText) {
            this.nameText.setPosition(this.player.x, this.player.y - 40).setDepth(this.player.y + 1);
        }

        this.otherPlayers.getChildren().forEach(p => {
            if (p.nameText) p.nameText.setPosition(p.x, p.y - 40).setDepth(p.y + 1);
        });
    }
}
