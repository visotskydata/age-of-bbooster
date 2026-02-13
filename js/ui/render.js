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
    if (!mapElement) return;

    // 1. Собираем список ID всех игроков, которые пришли с сервера
    const activeIds = new Set(players.map(p => p.id));

    // 2. Удаляем со страницы тех, кого больше нет в списке (кто вышел)
    const existingElements = document.querySelectorAll('.player-char');
    existingElements.forEach(el => {
        const id = parseInt(el.getAttribute('data-id'));
        if (!activeIds.has(id)) {
            el.remove();
        }
    });

    // 3. Рисуем или обновляем текущих
    players.forEach(p => {
        // Ищем, есть ли уже такой персонаж на карте
        let el = document.querySelector(`.player-char[data-id="${p.id}"]`);

        // Если нет — СОЗДАЕМ
        if (!el) {
            el = document.createElement('div');
            el.className = 'player-char';
            el.setAttribute('data-id', p.id); // Важная метка ID
            mapElement.appendChild(el);
            
            // Внутренности создаем один раз
            el.innerHTML = `
                <span class="player-name"></span><br>
                <span class="char-skin"></span>
            `;
        }

        // --- ОБНОВЛЯЕМ ДАННЫЕ (это происходит каждый кадр) ---
        
        // 1. Координаты (CSS Transition сделает это плавным)
        el.style.left = p.x + 'px';
        el.style.top = p.y + 'px';
        el.style.zIndex = Math.floor(p.y); // Чтобы тот кто ниже, перекрывал того кто выше

        // 2. Разворот спрайта (Если идем влево — зеркалим)
        // Мы храним прошлую координату X в атрибуте, чтобы сравнить
        const oldX = parseFloat(el.getAttribute('data-last-x')) || p.x;
        if (p.x < oldX) {
            el.classList.add('flipped'); // Лицом влево
        } else if (p.x > oldX) {
            el.classList.remove('flipped'); // Лицом вправо
        }
        el.setAttribute('data-last-x', p.x); // Запоминаем X для следующего раза

        // 3. Текст и Скин
        const isMe = p.id === currentUserId;
        const skin = SKINS[p.class] || SKINS['default'];
        const nameColor = isMe ? '#0f0' : '#fff';

        // Обновляем текст внутри спанов
        el.querySelector('.player-name').style.color = nameColor;
        el.querySelector('.player-name').innerText = p.login;
        el.querySelector('.char-skin').innerText = skin;
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
