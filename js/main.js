// js/main.js
import { db } from './core/db.js';
import { initUI } from './ui/render.js';
// В будущем импортируем чат, бой и т.д.

console.log('Игра запускается...');

// Глобальное состояние игры
window.gameState = {
    currentUser: null,
    players: []
};

// Функция старта
async function initGame() {
    initUI(); // Рисуем интерфейс
    console.log('Системы готовы');
}

// Запуск
initGame();
