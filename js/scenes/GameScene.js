// js/scenes/GameScene.js

export class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene'); // Имя сцены (ключ)
    }

    // 1. PRELOAD: Загрузка ресурсов (картинки, звуки)
    preload() {
        // Загружаем картинку для героя. 
        // ВАЖНО: У тебя должна быть картинка hero.png в папке assets/ или где-то еще.
        // Пока используем заглушку из интернета, чтобы точно заработало:
        this.load.image('hero', 'https://labs.phaser.io/assets/sprites/phaser-dude.png');
        this.load.image('tree', 'https://labs.phaser.io/assets/sprites/tree-european.png');
        this.load.image('grass', 'https://labs.phaser.io/assets/skies/sky4.png'); // Фон
    }

    // 2. CREATE: Создание объектов на сцене (выполняется 1 раз при старте)
    create() {
        // Добавляем фон (по центру)
        this.add.image(400, 300, 'grass').setScale(2);

        // Добавляем дерево
        this.add.image(200, 200, 'tree');

        // Добавляем героя
        // this.physics.add.sprite - создает спрайт с физикой
        this.player = this.physics.add.sprite(400, 300, 'hero');
        
        // Настроим камеру
        this.cameras.main.setBackgroundColor('#2d2d2d'); // Темно-серый фон
        
        // Вывод текста (вместо HTML)
        this.add.text(10, 10, 'Phaser Engine v3 Activated', { font: '16px Courier', fill: '#00ff00' });
    }

    // 3. UPDATE: Игровой цикл (выполняется 60 раз в секунду)
    update() {
        // Тут мы будем слушать кнопки и двигать героя
        // Пока просто заставим героя крутиться, чтобы видеть, что движок жив
        this.player.rotation += 0.01;
    }
}
