import { dbSendEmote } from '../core/db.js';

export class EmoteController {
    constructor(userState, gameRuntime, hudController) {
        this.userState = userState;
        this.gameRuntime = gameRuntime;
        this.hudController = hudController;
    }

    init() {
        document.querySelectorAll('.emote-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                void this.sendEmote(btn);
            });
        });
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
