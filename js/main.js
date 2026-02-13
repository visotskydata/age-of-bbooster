// js/main.js
import { dbLogin, dbUpdateClass, dbSync } from './core/db.js';
import { showScreen, drawPlayers, drawClickMarker, log } from './ui/render.js';
import { GAME_SETTINGS } from './config.js';

// Глобальное состояние
let currentUser = null;
let gameInterval = null;

// --- ФУНКЦИИ УПРАВЛЕНИЯ (Привязываем к window для HTML кнопок) ---

// 1. Логин
window.tryLogin = async function() {
    const l = document.getElementById('login-input').value;
    const p = document.getElementById('pass-input').value;

    if (!l || !p) return alert("Введите данные!");

    const result = await dbLogin(l, p);

    if (result.error) {
        alert(result.error.message);
    } else {
        currentUser = result.user;
        if (!currentUser.class) {
            showScreen('screen-class');
        } else {
            startGame();
        }
    }
};

// 2. Выбор класса
window.selectClass = async function(cls) {
    if (!currentUser) return;
    
    await dbUpdateClass(currentUser.id, cls);
    currentUser.class = cls; // Обновляем локально
    startGame();
};

// 3. Выход
window.logout = function() {
    clearInterval(gameInterval);
    location.reload();
};

// 4. Движение (Клик по карте)
window.movePlayer = function(e) {
    if (!currentUser) return;
    
    const mapElement = document.getElementById('world-map');
    // Игнорируем клики не по карте (если попали на UI элемент внутри)
    if (e.target !== mapElement && !e.target.classList.contains('tree')) return;

    const rect = mapElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Обновляем локально мгновенно
    currentUser.x = Math.floor(x);
    currentUser.y = Math.floor(y);

    drawClickMarker(x, y);
    // Принудительно вызываем обновление, чтобы не ждать таймера
    gameLoop(); 
};

// --- ИГРОВОЙ ЦИКЛ ---

function startGame() {
    showScreen('screen-game');
    document.getElementById('player-name-display').innerText = `${currentUser.login}`;
    log(`Добро пожаловать, ${currentUser.class}!`);

    // Запускаем цикл
    if (gameInterval) clearInterval(gameInterval);
    gameInterval = setInterval(gameLoop, GAME_SETTINGS.updateInterval);
    gameLoop(); // Первый запуск сразу
}

async function gameLoop() {
    if (!currentUser) return;

    // Синхронизация с базой
    const players = await dbSync(currentUser);
    
    // Отрисовка
    drawPlayers(players, currentUser.id);
}

// Инициализация при загрузке страницы
console.log('Age of bbooster Heroes: Core loaded.');
showScreen('screen-menu'); // Показываем меню старта
