// js/scenes/GameScene.js

export class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    preload() {
        // Загружаем ассеты (картинки)
        this.load.image('hero', 'https://labs.phaser.io/assets/sprites/phaser-dude.png');
        this.load.image('tree', 'https://labs.phaser.io/assets/sprites/tree-european.png');
        this.load.image('grass', 'https://labs.phaser.io/assets/skies/sky4.png');
        this.load.image('target', 'https://labs.phaser.io/assets/sprites/apple.png'); // Маркер клика
    }

    create() {
        // 1. НАСТРОЙКА МИРА
        // Делаем мир большим (2000x2000 пикселей), хотя экран всего 800x600
        this.physics.world.setBounds(0, 0, 2000, 2000);

        // 2. ФОН
        // TilingSprite - это картинка, которая повторяется (как плитка)
        this.bg = this.add.tileSprite(1000, 1000, 2000, 2000, 'grass');

        // 3. ДЕКОРАЦИИ (Рандомные деревья)
        for (let i = 0; i < 20; i++) {
            const x = Phaser.Math.Between(50, 1950);
            const y = Phaser.Math.Between(50, 1950);
            const tree = this.add.image(x, y, 'tree');
            tree.setDepth(y); // Чем ниже дерево (больше Y), тем оно "ближе" к камере
        }

        // 4. ИГРОК
        this.player = this.physics.add.sprite(400, 300, 'hero');
        this.player.setCollideWorldBounds(true); // Не даем уйти за границы мира
        this.player.setDepth(1); // Игрок всегда поверх травы

        // 5. КАМЕРА
        this.cameras.main.setBounds(0, 0, 2000, 2000); // Камера не вылезает за мир
        this.cameras.main.startFollow(this.player, true, 0.05, 0.05); // Плавное слежение

        // 6. МАРКЕР ЦЕЛИ (куда кликнули)
        this.targetMarker = this.add.image(0, 0, 'target').setVisible(false).setAlpha(0.5);

        // 7. УПРАВЛЕНИЕ (КЛИК МЫШКИ)
        this.input.on('pointerdown', (pointer) => {
            // Получаем координаты в МИРЕ (а не на экране), так как камера двигается
            const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
            
            this.moveTo(worldPoint.x, worldPoint.y);
        });

        // Переменная, хранит цель движения
        this.target = new Phaser.Math.Vector2();
    }

    moveTo(x, y) {
        // Сохраняем цель
        this.target.x = x;
        this.target.y = y;

        // Показываем маркер
        this.targetMarker.setPosition(x, y).setVisible(true);

        // Говорим физике двигать тело к точке со скоростью 200
        this.physics.moveToObject(this.player, this.target, 200);
    }

    update() {
        // Этот код выполняется 60 раз в секунду

        // 1. Проверка расстояния до цели
        // Если мы двигаемся, проверяем, дошли ли мы?
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.target.x, this.target.y);

        // Если до цели меньше 4 пикселей - останавливаемся
        if (this.player.body.speed > 0) {
            if (distance < 4) {
                this.player.body.reset(this.target.x, this.target.y); // Стоп
                this.targetMarker.setVisible(false); // Скрываем маркер
            }
        }

        // 2. Сортировка по глубине (Z-index)
        // Чтобы герой заходил ЗА деревья, если он выше их, и ПЕРЕД ними, если ниже
        this.player.setDepth(this.player.y);
    }
}
