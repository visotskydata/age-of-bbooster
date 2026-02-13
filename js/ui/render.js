// js/ui/render.js
import { SKINS } from '../config.js';

const mapElement = document.getElementById('world-map');
const consoleDiv = document.getElementById('log-console');

// Переключение экранов
export function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// Лог в консоль игры
export function log(msg) {
    consoleDiv.innerHTML = `> ${msg}<br>` + consoleDiv.innerHTML;
}

// Отрисовка всех игроков
export function drawPlayers(players, currentUserId) {
    // Чистим старых игроков (сохраняя деревья!)
    // Ищем только элементы с классом .player-char
    const oldPlayers = document.querySelectorAll('.player-char');
    oldPlayers.forEach(p => p.remove());

    players.forEach(p => {
        const el = document.createElement('div');
        el.className = 'player-char';
        el.style.left = p.x + 'px';
        el.style.top = p.y + 'px';

        const isMe = p.id === currentUserId;
        const skin = SKINS[p.class] || SKINS['default'];
        
        // Цвет ника: зеленый для меня, белый для остальных
        const nameColor = isMe ? '#0f0' : '#fff';

        el.innerHTML = `
            <span class="player-name" style="color:${nameColor}">${p.login}</span><br>
            ${skin}
        `;
        
        el.style.zIndex = Math.floor(p.y);
        mapElement.appendChild(el);
    });
}

// Эффект клика (крестик)
export function drawClickMarker(x, y) {
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
