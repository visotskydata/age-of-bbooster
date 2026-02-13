import { GameScene } from './scenes/GameScene.js';

// Конфигурация игры
const config = {
    type: Phaser.AUTO, // Автоматически выбрать WebGL или Canvas
    width: 800,       // Ширина окна игры
    height: 600,      // Высота окна игры
    parent: 'game-container', // Куда вставить игру в HTML
    physics: {
        default: 'arcade', // Простая физика (квадратные границы)
        arcade: {
            gravity: { y: 0 }, // Гравитации нет (вид сверху)
            debug: true        // Показывать рамки (для отладки)
        }
    },
    scene: [ GameScene ] // Список сцен
};

// Создаем игру
const game = new Phaser.Game(config);

console.log('Игра запущена!');
