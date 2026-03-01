import { dbLogin, dbSetClass } from '../core/db.js';

export class AuthController {
    constructor(userState, handlers) {
        this.userState = userState;
        this.handlers = handlers;
    }

    init() {
        const loginBtn = document.getElementById('btn-login');
        const passwordInput = document.getElementById('pass-input');

        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                void this.handleLogin(loginBtn);
            });
        }

        if (passwordInput) {
            passwordInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') loginBtn?.click();
            });
        }

        document.querySelectorAll('.class-card').forEach((card) => {
            card.addEventListener('click', () => {
                void this.handleClassSelect(card);
            });
        });
    }

    async handleLogin(button) {
        const login = (document.getElementById('login-input')?.value || '').trim();
        const password = (document.getElementById('pass-input')?.value || '').trim();

        if (!login || !password) {
            alert('Введите данные!');
            return;
        }

        const textSpan = button.querySelector('span');
        if (textSpan) textSpan.textContent = '...';
        button.disabled = true;

        const result = await dbLogin(login, password);

        if (textSpan) textSpan.textContent = 'PLAY';
        button.disabled = false;

        if (result.error) {
            alert(`Ошибка: ${result.error.message}`);
            return;
        }

        this.userState.set(result.user);

        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) loginScreen.classList.remove('active');

        const user = this.userState.require();
        if (!user.class) {
            this.handlers.onClassSelectionRequired?.();
            return;
        }

        this.handlers.onAuthenticated?.();
    }

    async handleClassSelect(cardElement) {
        const user = this.userState.get();
        if (!user) return;

        const selectedClass = cardElement.dataset.class;
        if (!selectedClass) return;

        document.querySelectorAll('.class-card').forEach((card) => {
            card.style.opacity = '0.4';
            card.style.border = '';
        });

        cardElement.style.opacity = '1';
        cardElement.style.border = '2px solid var(--gold)';

        const { data, error } = await dbSetClass(user.id, selectedClass);
        if (error) {
            alert(`Ошибка: ${error.message}`);
            return;
        }

        this.userState.set(data || { ...user, class: selectedClass });

        const classScreen = document.getElementById('class-screen');
        if (classScreen) classScreen.classList.remove('active');

        this.handlers.onAuthenticated?.();
    }
}
