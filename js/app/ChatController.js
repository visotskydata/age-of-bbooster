import { dbSendMessage, dbGetMessages } from '../core/db.js';
import { CHAT_REFRESH_INTERVAL_MS } from './constants.js';

export class ChatController {
    constructor(userState, gameRuntime) {
        this.userState = userState;
        this.gameRuntime = gameRuntime;
        this.intervalId = null;
    }

    init() {
        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('chat-send');
        if (!input || !sendBtn) return;

        input.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                void this.sendMessage(input);
            }
        });

        sendBtn.addEventListener('click', () => {
            void this.sendMessage(input);
        });

        void this.refresh();
        this.intervalId = window.setInterval(() => {
            void this.refresh();
        }, CHAT_REFRESH_INTERVAL_MS);
    }

    async sendMessage(input) {
        const user = this.userState.get();
        if (!user) return;

        const text = input.value.trim();
        if (!text) return;

        input.value = '';
        await dbSendMessage(user.login, text);
        this.gameRuntime.showSpeech(text);
        await this.refresh();
    }

    async refresh() {
        const box = document.getElementById('chat-messages');
        if (!box) return;

        const messages = await dbGetMessages();
        box.innerHTML = '';

        messages.forEach((message) => {
            const row = document.createElement('div');
            row.className = 'msg';

            const name = document.createElement('span');
            name.className = 'msg-name';
            name.textContent = `[${message.player_name}]: `;

            const text = document.createElement('span');
            text.className = 'msg-text';
            text.textContent = message.text;

            row.appendChild(name);
            row.appendChild(text);
            box.appendChild(row);
        });

        box.scrollTop = box.scrollHeight;
    }

    dispose() {
        if (this.intervalId !== null) {
            window.clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}
