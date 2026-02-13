import { dbSendMessage, dbGetMessages } from '../core/db.js';

let lastMsgId = 0; // Чтобы не перерисовывать то, что уже есть
let chatInterval = null;

export function initChat(currentUser) {
    const input = document.getElementById('chat-input');
    
    // Обработка Enter
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });

    // Делаем функцию доступной глобально для кнопки Send
    window.sendChatMessage = async function() {
        const text = input.value.trim();
        if (!text) return;

        input.value = ''; // Очистить поле
        // Отправляем в базу
        await dbSendMessage(currentUser.login, text);
        // Сразу обновляем чат, не дожидаясь таймера
        updateChat();
    };

    // Запускаем обновление чата раз в 2 секунды
    updateChat(); // Первый раз сразу
    chatInterval = setInterval(updateChat, 2000);
}

async function updateChat() {
    const messages = await dbGetMessages();
    const chatBox = document.getElementById('chat-messages');

    // Очищаем и рисуем заново (простой вариант)
    // В будущем можно оптимизировать и добавлять только новые
    chatBox.innerHTML = ''; 

    messages.forEach(msg => {
        const line = document.createElement('div');
        line.innerHTML = `<span class="msg-name">[${msg.player_name}]:</span> <span class="msg-text">${msg.text}</span>`;
        chatBox.appendChild(line);
    });

    // Авто-скролл вниз
    chatBox.scrollTop = chatBox.scrollHeight;
}
