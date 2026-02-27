import { GameScene } from './scenes/GameScene.js';
import { dbLogin } from './core/db.js';

// Глобальная переменная для конфига игры
let game;

// 1. Обработка кнопки PLAY
document.getElementById('btn-login').addEventListener('click', async () => {
    const l = document.getElementById('login-input').value;
    const p = document.getElementById('pass-input').value;

    if (!l || !p) return alert("Введите данные!");

    // Стучимся в Supabase
    const result = await dbLogin(l, p);

    if (result.error) {
        alert("Ошибка: " + result.error.message);
    } else {
        // УСПЕХ!
        const user = result.user;
        console.log("Logged in as:", user.login);

        // 2. Скрываем HTML меню
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('game-container').style.display = 'block';

        // 3. Запускаем Phaser и передаем туда ЮЗЕРА
        launchGame(user);
    }
});

function launchGame(user) {
    const config = {
        type: Phaser.AUTO,
        width: window.innerWidth,  // На весь экран
        height: window.innerHeight,
        parent: 'game-container',
        physics: {
            default: 'arcade',
            arcade: { gravity: { y: 0 }, debug: false }
        },
        scene: [GameScene]
    };

    game = new Phaser.Game(config);

    // Передаем данные игрока в сцену через реестр (Registry) - это глобальная память Phaser
    game.registry.set('user', user);
}
