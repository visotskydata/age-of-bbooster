// В начале файла GameScene.js
export class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    // ... preload оставляем тот же ...
    preload() {
        this.load.image('hero', 'https://labs.phaser.io/assets/sprites/phaser-dude.png');
        this.load.image('tree', 'https://labs.phaser.io/assets/sprites/tree-european.png');
        this.load.image('grass', 'https://labs.phaser.io/assets/skies/sky4.png');
        this.load.image('target', 'https://labs.phaser.io/assets/sprites/apple.png');
    }

    create() {
        // 0. ПОЛУЧАЕМ ДАННЫЕ ЮЗЕРА
        const currentUser = this.registry.get('user'); // Достаем то, что положили в main.js

        // 1. МИР
        this.physics.world.setBounds(0, 0, 2000, 2000);
        this.add.tileSprite(1000, 1000, 2000, 2000, 'grass');

        // 2. ДЕРЕВЬЯ
        for (let i = 0; i < 20; i++) {
            const x = Phaser.Math.Between(50, 1950);
            const y = Phaser.Math.Between(50, 1950);
            const tree = this.add.image(x, y, 'tree').setDepth(y);
        }

        // 3. ИГРОК (Спавним на координатах из базы или дефолтных)
        const startX = currentUser.x || 400;
        const startY = currentUser.y || 300;
        
        this.player = this.physics.add.sprite(startX, startY, 'hero');
        this.player.setCollideWorldBounds(true);
        this.player.setDepth(startY);

        // --- ДОБАВЛЯЕМ НИКНЕЙМ ---
        this.nameText = this.add.text(startX, startY - 40, currentUser.login, {
            font: '14px Arial',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5); // Центрируем текст
        // -------------------------

        // 4. КАМЕРА
        this.cameras.main.startFollow(this.player, true, 0.05, 0.05);

        // 5. УПРАВЛЕНИЕ
        this.targetMarker = this.add.image(0, 0, 'target').setVisible(false).setAlpha(0.5);
        this.target = new Phaser.Math.Vector2();

        this.input.on('pointerdown', (pointer) => {
            const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
            this.moveTo(worldPoint.x, worldPoint.y);
        });
    }

    moveTo(x, y) {
        this.target.x = x;
        this.target.y = y;
        this.targetMarker.setPosition(x, y).setVisible(true);
        this.physics.moveToObject(this.player, this.target, 200);
    }

    update() {
        // Логика остановки
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.target.x, this.target.y);
        if (this.player.body.speed > 0) {
            if (distance < 4) {
                this.player.body.reset(this.target.x, this.target.y);
                this.targetMarker.setVisible(false);
            }
        }
        
        // Z-Index
        this.player.setDepth(this.player.y);
        
        // ДВИГАЕМ НИК ЗА ИГРОКОМ
        if (this.nameText) {
            this.nameText.x = this.player.x;
            this.nameText.y = this.player.y - 40;
            this.nameText.setDepth(this.player.y + 1); // Всегда поверх игрока
        }
    }
}
