import { Game3D } from '../Game3D.js';

export class GameRuntime {
    constructor(container, userState) {
        this.container = container;
        this.userState = userState;
        this.game = null;
    }

    start() {
        if (this.game) return;
        const user = this.userState.require();
        this.game = new Game3D(this.container, user);
    }

    showSpeech(text) {
        if (!this.game || !text) return;
        if (typeof this.game.showSpeechBubble === 'function') {
            this.game.showSpeechBubble(text);
        }
    }

    showEmote(emoteText) {
        if (!this.game || !emoteText) return;
        if (typeof this.game.showEmote === 'function') {
            this.game.showEmote(emoteText);
        }
    }
}
