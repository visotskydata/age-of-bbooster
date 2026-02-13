import { dbLogin, dbUpdateClass, dbSync } from './core/db.js';
import { showScreen, drawPlayers, drawClickMarker, log } from './ui/render.js';
import { GAME_SETTINGS } from './config.js';
import { initChat } from './systems/chat.js';

// Глобальное состояние
let currentUser = null;
let gameInterval = null;

// Делаем функцию доступной глобально
window.showScreen = showScreen;

// --- ФУНКЦИИ УПРАВЛЕНИЯ ---

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
            // ИСПРАВЛЕНО: было 'screen-class', стало 'class'
            showScreen('class'); 
        } else {
            startGame();
        }
    }
};

// 2. Выбор класса
window.selectClass = async function(cls) {
    if (!currentUser) return;
    
    await dbUpdateClass(currentUser.id, cls);
    currentUser.class = cls;
    startGame();
};

// 3. Выход
window.logout = function() {
    clearInterval(gameInterval);
    location.reload();
};

// 4. Движение
window.movePlayer = function(e) {
    if (!currentUser) return;
    
    const mapElement = document.getElementById('world-map');
    if (e.target !== mapElement && !e.target.classList.contains('tree')) return;

    const rect = mapElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    currentUser.x = Math.floor(x);
    currentUser.y = Math.floor(y);

    drawClickMarker(x, y);
    gameLoop(); 
};

// --- ИГРОВОЙ ЦИКЛ ---

function startGame() {
    // ИСПРАВЛЕНО: было 'screen-game', стало 'game'
    showScreen('game'); 

    // Теперь элементы существуют, можно к ним обращаться
    document.getElementById('player-name-display').innerText = `${currentUser.login}`;
    
    // Запускаем чат
    initChat(currentUser);

    log(`Добро пожаловать, ${currentUser.class}!`);

    if (gameInterval) clearInterval(gameInterval);
    gameInterval = setInterval(gameLoop, GAME_SETTINGS.updateInterval);
    gameLoop(); 
}

async function gameLoop() {
    if (!currentUser) return;

    const players = await dbSync(currentUser);
    drawPlayers(players, currentUser.id);
}

// Инициализация
console.log('Age of bbooster Heroes: Core loaded.');
showScreen('menu'); // Тут было правильно, поэтому меню работало
