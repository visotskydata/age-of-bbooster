import { UserState } from './UserState.js';
import { GameRuntime } from './GameRuntime.js';
import { HUDController } from './HUDController.js';
import { ChatController } from './ChatController.js';
import { EmoteController } from './EmoteController.js';
import { AuthController } from './AuthController.js';

export class GameApp {
    constructor() {
        this.userState = new UserState();
        this.hudController = new HUDController(this.userState);
        this.gameRuntime = new GameRuntime(
            document.getElementById('game-container'),
            this.userState,
        );
        this.chatController = new ChatController(this.userState, this.gameRuntime);
        this.emoteController = new EmoteController(this.userState, this.gameRuntime, this.hudController);
        this.authController = new AuthController(this.userState, {
            onClassSelectionRequired: () => this.showClassSelection(),
            onAuthenticated: () => this.startGame(),
        });
    }

    init() {
        this.authController.init();
        window.updateHUD = () => this.hudController.render();
        window.getCurrentUser = () => this.userState.get();
    }

    showClassSelection() {
        const classScreen = document.getElementById('class-screen');
        if (classScreen) classScreen.classList.add('active');
    }

    startGame() {
        const gameContainer = document.getElementById('game-container');
        const hud = document.getElementById('hud');

        if (gameContainer) gameContainer.style.display = 'block';
        if (hud) hud.classList.remove('hidden');

        this.hudController.init();
        this.chatController.dispose();
        this.chatController.init();
        this.emoteController.init();
        this.gameRuntime.start();
    }
}
