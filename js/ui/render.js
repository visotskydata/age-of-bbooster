import { SKINS } from '../config.js';
import { TEMPLATES } from './templates.js'; // Импортируем наши шаблоны

// Глобальные ссылки (будут обновляться при смене экрана)
let mapElement = null;
let consoleDiv = null;

// --- ГЛАВНАЯ ФУНКЦИЯ ПЕРЕКЛЮЧЕНИЯ ЭКРАНОВ ---
export function showScreen(screenName) {
    const container = document.getElementById('game-container');
    
    // 1. Очищаем контейнер (удаляем старый экран)
    container.innerHTML = '';

    // 2. Вставляем новый HTML из шаблона
    if (screenName === 'menu') {
        container.innerHTML = TEMPLATES.menu;
    } else if (screenName === 'login') {
        container.innerHTML = TEMPLATES.login;
    } else if (screenName === 'class') {
        container.innerHTML = TEMPLATES.classSelection;
    } else if (screenName === 'game') {
        container.innerHTML = TEMPLATES.game;
        
        // После отрисовки обновляем ссылки на элементы, так как они создались заново
        mapElement = document.getElementById('world-map');
        consoleDiv = document.getElementById('log-console');
    }
}

// ... Остальные функции (log, drawPlayers, drawClickMarker) остаются почти такими же ...

export function log(msg) {
    if (!consoleDiv) consoleDiv = document.getElementById('log-console');
    if (consoleDiv) {
        consoleDiv.innerHTML = `> ${msg}<br>` + consoleDiv.innerHTML;
    }
}

export function drawPlayers(players, currentUserId) {
    if (!mapElement) mapElement = document.getElementById('world-map');
    if (!mapElement) return; // Если мы не в игре, не рисуем

    const oldPlayers = document.querySelectorAll('.player-char');
    oldPlayers.forEach(p => p.remove());

    players.forEach(p => {
        const el = document.createElement('div');
        el.className = 'player-char';
        el.style.left = p.x + 'px';
        el.style.top = p.y + 'px';

        const isMe = p.id === currentUserId;
        const skin = SKINS[p.class] || SKINS['default'];
        const nameColor = isMe ? '#0f0' : '#fff';

        el.innerHTML = `
            <span class="player-name" style="color:${nameColor}">${p.login}</span><br>
            ${skin}
        `;
        
        el.style.zIndex = Math.floor(p.y);
        mapElement.appendChild(el);
    });
}

export function drawClickMarker(x, y) {
    if (!mapElement) return;
    const marker = document.createElement('div');
    marker.style.position = 'absolute';
    marker.style.left = x + 'px';
    marker.style.top = y + 'px';
    marker.innerText = '❌';
    marker.style.fontSize = '10px';
    marker.style.pointerEvents = 'none';
    mapElement.appendChild(marker);
    setTimeout(() => marker.remove(), 500);
}
