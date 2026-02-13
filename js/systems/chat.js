import { dbSendMessage, dbGetMessages } from '../core/db.js';

let chatInterval = null;
let isExpanded = false;

export function initChat(currentUser) {
    // 1. Генерируем HTML прямо здесь (Архитектурное решение)
    const chatHTML = `
        <div id="chat-widget">
            <div id="chat-preview">Нажмите, чтобы открыть чат...</div>
            <div id="chat-messages"></div>
            <div id="chat-input-row">
                <input type="text" id="chat-input" placeholder="Сообщение..." maxlength="50">
                <button id="chat-send-btn">Send</button>
            </div>
        </div>
    `;

    // Вставляем чат внутрь игрового экрана
    document.getElementById('screen-game').insertAdjacentHTML('beforeend', chatHTML);

    // 2. Ссылки на элементы
    const widget = document.getElementById('chat-widget');
    const input = document.getElementById('chat-input');
    const btn = document.getElementById('chat-send-btn');
    const preview = document.getElementById('chat-preview');
    const messagesBox = document.getElementById('chat-messages');

    // 3. Логика разворачивания (Клик по виджету)
    preview.addEventListener('click', () => {
        isExpanded = true;
        widget.classList.add('expanded');
        setTimeout(() => input.focus(), 300); // Фокус после анимации
        scrollToBottom(); // Прокрутить вниз при открытии
    });

    // Сворачивание при клике вне чата
    document.addEventListener('click', (e) => {
        if (isExpanded && !widget.contains(e.target)) {
            isExpanded = false;
            widget.classList.remove('expanded');
        }
    });

    // 4. Отправка сообщений
    const sendMessage = async () => {
        const text = input.value.trim();
        if (!text) return;
        
        input.value = '';
        await dbSendMessage(currentUser.login, text);
        updateChat();
    };

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    btn.addEventListener('click', sendMessage);

    // 5. Запуск обновления
    updateChat();
    chatInterval = setInterval(updateChat, 2000);
}

async function updateChat() {
    const messages = await dbGetMessages();
    const chatBox = document.getElementById('chat-messages');
    const previewBox = document.getElementById('chat-preview');

    // Обновляем превью (последнее сообщение)
    if (messages.length > 0) {
        const last = messages[messages.length - 1];
        previewBox.innerText = `[${last.player_name}]: ${last.text}`;
        // Подсветка, если сообщение новое (опционально)
        previewBox.style.color = '#fff'; 
    }

    // Проверяем, нужно ли скроллить вниз ПОСЛЕ обновления
    // Условие: (Высота контента - Прокрутка - Видимая высота) < 50 пикселей
    // То есть, если мы находимся близко к низу, то скроллим. Если мы высоко (читаем историю) — не скроллим.
    const isAtBottom = (chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight) < 50;

    // Перерисовываем сообщения
    chatBox.innerHTML = ''; 
    messages.forEach(msg => {
        const line = document.createElement('div');
        line.innerHTML = `<span style="color:#ffd700; font-weight:bold;">[${msg.player_name}]:</span> <span style="color:#ccc;">${msg.text}</span>`;
        line.style.marginBottom = "4px";
        line.style.lineHeight = "1.2";
        chatBox.appendChild(line);
    });

    // Если были внизу — остаемся внизу
    if (isAtBottom && isExpanded) {
        scrollToBottom();
    }
}

function scrollToBottom() {
    const chatBox = document.getElementById('chat-messages');
    chatBox.scrollTop = chatBox.scrollHeight;
}
