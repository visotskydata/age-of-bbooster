import { dbSendMessage, dbGetMessages } from '../core/db.js';
import { CHAT_REFRESH_INTERVAL_MS } from './constants.js';

export class ChatController {
    constructor(userState, gameRuntime) {
        this.userState = userState;
        this.gameRuntime = gameRuntime;
        this.intervalId = null;
        this.lastSeenMessageTime = 0;
        this.boundGlobalKeydown = null;
        this.boundInputEnter = null;
        this.boundSendClick = null;
    }

    init() {
        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('chat-send');
        if (!input || !sendBtn) return;

        this.boundInputEnter = (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                void this.sendMessage(input);
            }
        };
        input.addEventListener('keydown', this.boundInputEnter);

        this.boundSendClick = () => {
            void this.sendMessage(input);
        };
        sendBtn.addEventListener('click', this.boundSendClick);

        this.boundGlobalKeydown = (event) => {
            const active = document.activeElement;
            const isTyping = active && (
                active.tagName === 'INPUT'
                || active.tagName === 'TEXTAREA'
                || active.isContentEditable
            );

            if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
                if (!isTyping) {
                    event.preventDefault();
                    this.openChat();
                }
                return;
            }

            if (event.key === 'Escape' && active?.id === 'chat-input') {
                event.preventDefault();
                active.blur();
            }
        };
        document.addEventListener('keydown', this.boundGlobalKeydown);

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
        this.showToast(user.login, text);
        this.lastSeenMessageTime = Math.max(this.lastSeenMessageTime || 0, Date.now());
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
        this.showToastsForNewMessages(messages);
    }

    openChat() {
        const panel = document.getElementById('chat-panel');
        const btn = document.getElementById('btn-chat');
        const input = document.getElementById('chat-input');
        if (!panel || !input) return;
        document.querySelectorAll('.hud-panel, .modal').forEach((node) => node.classList.add('hidden'));
        document.querySelectorAll('.action-btn').forEach((node) => node.classList.remove('active'));
        if (document.pointerLockElement) {
            document.exitPointerLock?.();
        }
        panel.classList.remove('hidden');
        if (btn) btn.classList.add('active');
        input.focus();
        input.select();
    }

    showToastsForNewMessages(messages) {
        if (!Array.isArray(messages) || messages.length === 0) return;
        const sorted = [...messages].sort((a, b) => {
            const at = new Date(a.created_at || 0).getTime();
            const bt = new Date(b.created_at || 0).getTime();
            return at - bt;
        });

        if (!this.lastSeenMessageTime) {
            const last = sorted[sorted.length - 1];
            this.lastSeenMessageTime = new Date(last.created_at || 0).getTime() || Date.now();
            return;
        }

        let maxSeen = this.lastSeenMessageTime;
        sorted.forEach((message) => {
            const ts = new Date(message.created_at || 0).getTime();
            if (!ts || ts <= this.lastSeenMessageTime) return;
            this.showToast(message.player_name || 'Player', message.text || '');
            if (ts > maxSeen) maxSeen = ts;
        });
        this.lastSeenMessageTime = maxSeen;
    }

    ensureToastStack() {
        let stack = document.getElementById('chat-toast-stack');
        if (stack) return stack;
        stack = document.createElement('div');
        stack.id = 'chat-toast-stack';
        document.body.appendChild(stack);
        return stack;
    }

    showToast(playerName, text) {
        if (!text) return;
        const stack = this.ensureToastStack();
        const toast = document.createElement('div');
        toast.className = 'chat-toast';
        const name = document.createElement('span');
        name.className = 'chat-toast-name';
        name.textContent = `[${playerName}] `;
        const body = document.createElement('span');
        body.className = 'chat-toast-text';
        body.textContent = text;
        toast.append(name, body);
        stack.appendChild(toast);

        // Keep stack short.
        const nodes = stack.querySelectorAll('.chat-toast');
        if (nodes.length > 6) nodes[0].remove();

        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3200);
    }

    dispose() {
        if (this.intervalId !== null) {
            window.clearInterval(this.intervalId);
            this.intervalId = null;
        }
        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('chat-send');
        if (input && this.boundInputEnter) {
            input.removeEventListener('keydown', this.boundInputEnter);
        }
        if (sendBtn && this.boundSendClick) {
            sendBtn.removeEventListener('click', this.boundSendClick);
        }
        if (this.boundGlobalKeydown) {
            document.removeEventListener('keydown', this.boundGlobalKeydown);
        }
        this.boundInputEnter = null;
        this.boundSendClick = null;
        this.boundGlobalKeydown = null;
    }
}
