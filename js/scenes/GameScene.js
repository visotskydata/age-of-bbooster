import { dbSync } from '../core/db.js'; // <--- 1. Импортируем синхронизацию

export class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    preload() {
        this.load.image('hero', 'https://labs.phaser.io/assets/sprites/phaser-dude.png');
        this.load.image('tree', 'https://labs.phaser.io/assets/sprites/tree-european.png');
        this.load.image('grass', 'https://labs.phaser.io/assets/skies/sky4.png');
        this.load.image('target', 'https://labs.phaser.io/assets/sprites/apple.png');
    }

    create() {
        // --- 0. ДАННЫЕ ИГРОКА ---
        this.currentUser = this.registry.get('user');
        
        // Группа для хранения спрайтов ДРУГИХ игроков
        this.otherPlayers = this.add.group(); 

        // --- 1. МИР ---
        this.physics.world.setBounds(0, 0, 2000, 2000);
        this.add.tileSprite(1000, 1000, 2000, 2000, 'grass');

        // --- 2. ДЕРЕВЬЯ (ФИКСИРОВАННЫЕ) ---
        // Чтобы у всех карта была одинаковой, координаты должны быть жестко заданы
        const treePositions = [
            {x: 200, y: 300}, {x: 500, y: 100}, {x: 800, y: 600},
            {x: 1200, y: 400}, {x: 1500, y: 800}, {x: 300, y: 1000},
            {x: 1000, y: 1200}, {x: 1800, y: 200}, {x: 600, y: 1500}
        ];

        treePositions.forEach(pos => {
            const tree = this.add.image(pos.x, pos.y, 'tree');
            tree.setDepth(pos.y); // Сортировка по глубине
        });

        // --- 3. НАШ ИГРОК ---
        const startX = this.currentUser.x || 400;
        const startY = this.currentUser.y || 300;
        
        this.player = this.physics.add.sprite(startX, startY, 'hero');
        this.player.setCollideWorldBounds(true);
        this.player.setDepth(startY);

        // Никнейм
        this.nameText = this.add.text(startX, startY - 40, this.currentUser.login, {
            font: '14px Arial', fill: '#ffffff', stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5);

        // --- 4. КАМЕРА ---
        this.cameras.main.startFollow(this.player, true, 0.05, 0.05);

        // --- 5. УПРАВЛЕНИЕ ---
        this.targetMarker = this.add.image(0, 0, 'target').setVisible(false).setAlpha(0.5);
        this.target = new Phaser.Math.Vector2();

        this.input.on('pointerdown', (pointer) => {
            const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
            this.moveTo(worldPoint.x, worldPoint.y);
        });

        // --- 6. ЗАПУСК СЕТЕВОГО ЦИКЛА ---
        // Запускаем синхронизацию каждые 1000 мс (1 секунда)
        this.time.addEvent({
            delay: 1000,
            callback: this.syncNetwork,
            callbackScope: this,
            loop: true
        });
        
        // Запускаем первый раз сразу
        this.syncNetwork();
    }

    moveTo(x, y) {
        this.target.x = x;
        this.target.y = y;
        this.targetMarker.setPosition(x, y).setVisible(true);
        this.physics.moveToObject(this.player, this.target, 200);
        
        // Обновляем координаты в локальном объекте сразу
        this.currentUser.x = x;
        this.currentUser.y = y;
    }

    // --- ФУНКЦИЯ СЕТЕВОЙ СИНХРОНИЗАЦИИ ---
    async syncNetwork() {
        if (!this.player) return;

        // 1. Обновляем свои координаты в объекте перед отправкой
        // (Phaser меняет this.player.x, но нам надо обновить this.currentUser для отправки)
        this.currentUser.x = Math.round(this.player.x);
        this.currentUser.y = Math.round(this.player.y);

        // 2. Отправляем в Supabase и получаем список других
        const serverPlayers = await dbSync(this.currentUser);

        // 3. Рисуем других игроков
        this.updateOtherPlayers(serverPlayers);
    }

    updateOtherPlayers(serverPlayers) {
        const activeIds = new Set();

        serverPlayers.forEach(pData => {
            if (pData.id === this.currentUser.id) return;
            
            activeIds.add(pData.id);

            let otherPlayer = this.otherPlayers.getChildren().find(p => p.playerId === pData.id);

            if (otherPlayer) {
                // --- ОБНОВЛЕНИЕ (ПЛАВНОЕ) ---
                
                // 1. Разворот спрайта (Флип)
                // Если новая координата левее текущей - зеркалим
                if (pData.x < otherPlayer.x) {
                    otherPlayer.setFlipX(true);
                } else if (pData.x > otherPlayer.x) {
                    otherPlayer.setFlipX(false);
                }

                // 2. Плавное движение (Tween)
                // Мы останавливаем предыдущую анимацию, если она была, и запускаем новую
                this.tweens.add({
                    targets: otherPlayer,
                    x: pData.x,
                    y: pData.y,
                    duration: 1000, // Длительность равна интервалу обновления (1 сек)
                    ease: 'Linear'  // Равномерная скорость
                });

                // Z-index обновляем сразу
                otherPlayer.setDepth(pData.y);
                
                // ВАЖНО: Мы НЕ двигаем текст здесь, мы будем двигать его в update(),
                // чтобы он приклеился к плавно едущему игроку.

            } else {
                // --- СОЗДАНИЕ ---
                const newSprite = this.add.sprite(pData.x, pData.y, 'hero');
                newSprite.setTint(0xff0000); 
                newSprite.playerId = pData.id; 
                
                const newText = this.add.text(pData.x, pData.y - 40, pData.login, {
                    font: '14px Arial', fill: '#ffcccc', stroke: '#000000', strokeThickness: 3
                }).setOrigin(0.5);
                
                newSprite.nameText = newText;
                this.otherPlayers.add(newSprite);
            }
        });

        // --- УДАЛЕНИЕ ---
        this.otherPlayers.getChildren().forEach(child => {
            if (!activeIds.has(child.playerId)) {
                child.nameText.destroy(); 
                child.destroy();          
            }
        });
    }

        // --- УДАЛЕНИЕ ---
        // Удаляем тех, кого нет в списке с сервера (кто вышел)
        this.otherPlayers.getChildren().forEach(child => {
            if (!activeIds.has(child.playerId)) {
                child.nameText.destroy(); // Удаляем ник
                child.destroy();          // Удаляем спрайт
            }
        });
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
        
        // Z-Index и текст
        this.player.setDepth(this.player.y);
        if (this.nameText) {
            this.nameText.x = this.player.x;
            this.nameText.y = this.player.y - 40;
            this.nameText.setDepth(this.player.y + 1);
        }
    }
}
