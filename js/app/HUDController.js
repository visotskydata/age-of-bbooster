import { CLASS_ICONS } from './constants.js';

export class HUDController {
    constructor(userState) {
        this.userState = userState;
        this.bindings = [
            { btnId: 'btn-chat', panelId: 'chat-panel' },
            { btnId: 'btn-emotes', panelId: 'emotes-panel' },
            { btnId: 'btn-stats', panelId: 'stats-modal' },
        ];
    }

    init() {
        this.bindPanelToggles();
        this.bindModalCloseButtons();
        this.render();
    }

    render() {
        const model = this.userState.hudModel();

        this.setText('hud-name', model.name);
        this.setText('hud-class-icon', model.classIcon);
        this.setText('hud-level', `Lv.${model.level}`);
        this.setText('hp-text', `${model.hp}/${model.maxHp}`);
        this.setWidth('hp-fill', model.hpPercent);
    }

    bindPanelToggles() {
        this.bindings.forEach(({ btnId, panelId }) => {
            const btn = document.getElementById(btnId);
            const panel = document.getElementById(panelId);
            if (!btn || !panel) return;

            btn.addEventListener('click', () => {
                const shouldOpen = panel.classList.contains('hidden');
                this.closeAllPanels();

                if (!shouldOpen) return;
                panel.classList.remove('hidden');
                btn.classList.add('active');

                if (panelId === 'stats-modal') this.populateStats();
            });
        });
    }

    bindModalCloseButtons() {
        document.querySelectorAll('.close-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const modalId = btn.dataset.close;
                const modal = modalId ? document.getElementById(modalId) : null;
                if (modal) modal.classList.add('hidden');
                this.clearActiveButtons();
            });
        });

        document.querySelectorAll('.modal').forEach((modal) => {
            modal.addEventListener('click', (event) => {
                if (event.target !== modal) return;
                modal.classList.add('hidden');
                this.clearActiveButtons();
            });
        });
    }

    closeAllPanels() {
        document.querySelectorAll('.hud-panel, .modal').forEach((panel) => panel.classList.add('hidden'));
        this.clearActiveButtons();
    }

    clearActiveButtons() {
        document.querySelectorAll('.action-btn').forEach((button) => button.classList.remove('active'));
    }

    populateStats() {
        const user = this.userState.get();
        const container = document.getElementById('stats-content');
        if (!container || !user) return;
        const level = user.level || 1;
        const xp = user.xp || 0;
        const xpToNext = 130 + Math.round((Math.max(1, level) - 1) * 70);
        const abilityState = level >= 3 ? 'RMB-способность открыта' : 'Откроется на 3 уровне';

        container.innerHTML = `
            <div class="stats-row"><span class="stats-label">Класс</span><span class="stats-value">${CLASS_ICONS[user.class] || '❓'} ${user.class || 'Не выбран'}</span></div>
            <div class="stats-row"><span class="stats-label">Уровень</span><span class="stats-value">${level}</span></div>
            <div class="stats-row"><span class="stats-label">⭐ XP</span><span class="stats-value">${xp} / ${xpToNext}</span></div>
            <div class="stats-row"><span class="stats-label">❤️ HP</span><span class="stats-value">${user.hp || 100} / ${user.max_hp || 100}</span></div>
            <div class="stats-row"><span class="stats-label">⚔️ Атака</span><span class="stats-value">${user.attack || 10}</span></div>
            <div class="stats-row"><span class="stats-label">🛡️ Защита</span><span class="stats-value">${user.defense || 5}</span></div>
            <div class="stats-row"><span class="stats-label">👟 Скорость</span><span class="stats-value">${user.speed || 200}</span></div>
            <div class="stats-row"><span class="stats-label">✨ Способность</span><span class="stats-value">${abilityState}</span></div>
        `;
    }

    setText(id, text) {
        const element = document.getElementById(id);
        if (element) element.textContent = text;
    }

    setWidth(id, percent) {
        const element = document.getElementById(id);
        if (element) element.style.width = `${percent}%`;
    }
}
