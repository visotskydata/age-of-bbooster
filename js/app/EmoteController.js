import { dbSendEmote } from '../core/db.js';

export class EmoteController {
    constructor(userState, gameRuntime, hudController) {
        this.userState = userState;
        this.gameRuntime = gameRuntime;
        this.hudController = hudController;
        this.boundKeydown = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        this.initialized = true;
        document.querySelectorAll('.emote-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                void this.sendEmote(btn);
            });
        });

        this.boundKeydown = (event) => {
            const active = document.activeElement;
            const isTyping = active && (
                active.tagName === 'INPUT'
                || active.tagName === 'TEXTAREA'
                || active.isContentEditable
            );
            if (isTyping) return;

            const panel = document.getElementById('emotes-panel');
            if (!panel) return;

            if (event.code === 'KeyB') {
                event.preventDefault();
                const isHidden = panel.classList.contains('hidden');
                if (isHidden) {
                    this.hudController.closeAllPanels();
                    if (document.pointerLockElement) {
                        document.exitPointerLock?.();
                    }
                    panel.classList.remove('hidden');
                    document.getElementById('btn-emotes')?.classList.add('active');
                } else {
                    panel.classList.add('hidden');
                    this.hudController.clearActiveButtons();
                }
                return;
            }

            if (event.key === 'Escape' && !panel.classList.contains('hidden')) {
                event.preventDefault();
                panel.classList.add('hidden');
                this.hudController.clearActiveButtons();
                return;
            }

            if (panel.classList.contains('hidden')) return;
            if (!event.code.startsWith('Digit')) return;

            const index = Number(event.code.replace('Digit', '')) - 1;
            if (Number.isNaN(index) || index < 0) return;
            const buttons = Array.from(document.querySelectorAll('.emote-btn'));
            const target = buttons[index];
            if (!target) return;
            event.preventDefault();
            void this.sendEmote(target);
        };
        document.addEventListener('keydown', this.boundKeydown);
    }

    async sendEmote(button) {
        const user = this.userState.get();
        if (!user) return;

        const emoteText = (button.textContent || '').trim();
        if (!emoteText) return;

        const timestamp = Date.now();
        this.userState.patch({ emote: emoteText, emote_at: timestamp });

        await dbSendEmote(user.id, emoteText);
        this.gameRuntime.showEmote(emoteText);

        const emotesPanel = document.getElementById('emotes-panel');
        if (emotesPanel) emotesPanel.classList.add('hidden');

        this.hudController.clearActiveButtons();
    }
}
