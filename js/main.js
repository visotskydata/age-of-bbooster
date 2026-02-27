import { GameScene } from './scenes/GameScene.js';
import { dbLogin, dbSetClass, dbSendMessage, dbGetMessages, dbSendEmote } from './core/db.js';

let game;
let currentUser = null;

// ===========================
// 1. LOGIN
// ===========================
document.getElementById('btn-login').addEventListener('click', async () => {
    const l = document.getElementById('login-input').value.trim();
    const p = document.getElementById('pass-input').value.trim();
    if (!l || !p) return alert("Введите данные!");

    const btn = document.getElementById('btn-login');
    btn.querySelector('span').textContent = '...';
    btn.disabled = true;

    const result = await dbLogin(l, p);

    btn.querySelector('span').textContent = 'PLAY';
    btn.disabled = false;

    if (result.error) {
        alert("Ошибка: " + result.error.message);
        return;
    }

    currentUser = result.user;

    // Hide login
    document.getElementById('login-screen').classList.remove('active');

    if (!currentUser.class) {
        // First time — show class select
        document.getElementById('class-screen').classList.add('active');
    } else {
        startGame();
    }
});

// Enter key login
document.getElementById('pass-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-login').click();
});

// ===========================
// 2. CLASS SELECT
// ===========================
document.querySelectorAll('.class-card').forEach(card => {
    card.addEventListener('click', async () => {
        const cls = card.dataset.class;
        if (!cls || !currentUser) return;

        // Visual feedback
        document.querySelectorAll('.class-card').forEach(c => c.style.opacity = '0.4');
        card.style.opacity = '1';
        card.style.border = '2px solid var(--gold)';

        const { data, error } = await dbSetClass(currentUser.id, cls);
        if (error) {
            alert("Ошибка: " + error.message);
            return;
        }

        // Update local user with class defaults
        currentUser = data || { ...currentUser, class: cls };
        document.getElementById('class-screen').classList.remove('active');
        startGame();
    });
});

// ===========================
// 3. START GAME
// ===========================
function startGame() {
    document.getElementById('game-container').style.display = 'block';
    document.getElementById('hud').classList.remove('hidden');

    updateHUD();
    initChat();
    initEmotes();
    initHUDButtons();
    initModals();

    // Login particles
    createLoginParticles();

    const config = {
        type: Phaser.AUTO,
        width: window.innerWidth,
        height: window.innerHeight,
        parent: 'game-container',
        physics: {
            default: 'arcade',
            arcade: { gravity: { y: 0 }, debug: false }
        },
        scene: [GameScene],
        scale: {
            mode: Phaser.Scale.RESIZE,
            autoCenter: Phaser.Scale.CENTER_BOTH
        }
    };

    game = new Phaser.Game(config);
    game.registry.set('user', currentUser);
}

// ===========================
// HUD UPDATES
// ===========================
const CLASS_ICONS = { warrior: '⚔️', mage: '🧙‍♂️', archer: '🏹' };

function updateHUD() {
    if (!currentUser) return;
    document.getElementById('hud-name').textContent = currentUser.login;
    document.getElementById('hud-class-icon').textContent = CLASS_ICONS[currentUser.class] || '❓';
    document.getElementById('hud-level').textContent = `Lv.${currentUser.level || 1}`;

    const hp = currentUser.hp || 100;
    const maxHp = currentUser.max_hp || 100;
    const xp = currentUser.xp || 0;
    const xpNeeded = (currentUser.level || 1) * 100;

    document.getElementById('hp-fill').style.width = `${(hp / maxHp) * 100}%`;
    document.getElementById('hp-text').textContent = `${hp}/${maxHp}`;
    document.getElementById('xp-fill').style.width = `${(xp / xpNeeded) * 100}%`;
    document.getElementById('xp-text').textContent = `${xp}/${xpNeeded} XP`;
}

// Expose for game scene to call
window.updateHUD = updateHUD;
window.getCurrentUser = () => currentUser;

// ===========================
// CHAT
// ===========================
let chatInterval = null;

function initChat() {
    const panel = document.getElementById('chat-panel');
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');

    const send = async () => {
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        await dbSendMessage(currentUser.login, text);
        // Emit speech bubble in Phaser
        if (game && game.scene.getScene('GameScene')) {
            game.scene.getScene('GameScene').showSpeechBubble(text);
        }
        refreshChat();
    };

    input.addEventListener('keypress', e => { if (e.key === 'Enter') send(); });
    sendBtn.addEventListener('click', send);

    refreshChat();
    chatInterval = setInterval(refreshChat, 2500);
}

async function refreshChat() {
    const messages = await dbGetMessages();
    const box = document.getElementById('chat-messages');
    box.innerHTML = '';
    messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = 'msg';
        div.innerHTML = `<span class="msg-name">[${msg.player_name}]:</span> <span class="msg-text">${msg.text}</span>`;
        box.appendChild(div);
    });
    box.scrollTop = box.scrollHeight;
}

// ===========================
// EMOTES
// ===========================
function initEmotes() {
    document.querySelectorAll('.emote-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const emote = btn.dataset.emote;
            const emoteText = btn.textContent;
            currentUser.emote = emoteText;
            currentUser.emote_at = Date.now();
            await dbSendEmote(currentUser.id, emoteText);

            // Show in Phaser
            if (game && game.scene.getScene('GameScene')) {
                game.scene.getScene('GameScene').showEmote(emoteText);
            }

            // Close panel
            document.getElementById('emotes-panel').classList.add('hidden');
            document.getElementById('btn-emotes').classList.remove('active');
        });
    });
}

// ===========================
// HUD BUTTONS (toggle panels)
// ===========================
function initHUDButtons() {
    const toggles = {
        'btn-chat': 'chat-panel',
        'btn-emotes': 'emotes-panel',
        'btn-inventory': 'inventory-modal',
        'btn-stats': 'stats-modal',
        'btn-quests': 'quest-modal',
    };

    Object.entries(toggles).forEach(([btnId, panelId]) => {
        document.getElementById(btnId).addEventListener('click', () => {
            const panel = document.getElementById(panelId);
            const btn = document.getElementById(btnId);
            const isHidden = panel.classList.contains('hidden');

            // Close all panels first
            document.querySelectorAll('.hud-panel, .modal').forEach(p => p.classList.add('hidden'));
            document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('active'));

            if (isHidden) {
                panel.classList.remove('hidden');
                btn.classList.add('active');

                // Populate modals on open
                if (panelId === 'stats-modal') populateStats();
                if (panelId === 'inventory-modal') populateInventory();
            }
        });
    });
}

function populateStats() {
    const u = currentUser;
    document.getElementById('stats-content').innerHTML = `
        <div class="stats-row"><span class="stats-label">Класс</span><span class="stats-value">${CLASS_ICONS[u.class] || '❓'} ${u.class || 'Не выбран'}</span></div>
        <div class="stats-row"><span class="stats-label">Уровень</span><span class="stats-value">${u.level || 1}</span></div>
        <div class="stats-row"><span class="stats-label">❤️ HP</span><span class="stats-value">${u.hp || 100} / ${u.max_hp || 100}</span></div>
        <div class="stats-row"><span class="stats-label">⚔️ Атака</span><span class="stats-value">${u.attack || 10}</span></div>
        <div class="stats-row"><span class="stats-label">🛡️ Защита</span><span class="stats-value">${u.defense || 5}</span></div>
        <div class="stats-row"><span class="stats-label">👟 Скорость</span><span class="stats-value">${u.speed || 200}</span></div>
        <div class="stats-row"><span class="stats-label">⭐ Опыт</span><span class="stats-value">${u.xp || 0} / ${(u.level || 1) * 100}</span></div>
    `;
}

function populateInventory() {
    const grid = document.getElementById('inventory-grid');
    grid.innerHTML = '';
    for (let i = 0; i < 20; i++) {
        const slot = document.createElement('div');
        slot.className = 'inv-slot';
        grid.appendChild(slot);
    }
}

// ===========================
// MODALS (close buttons)
// ===========================
function initModals() {
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.dataset.close;
            document.getElementById(modalId).classList.add('hidden');
            document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('active'));
        });
    });

    // Click outside modal to close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
                document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('active'));
            }
        });
    });
}

// ===========================
// LOGIN PARTICLES (aesthetic)
// ===========================
function createLoginParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    for (let i = 0; i < 30; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random() * 100 + '%';
        p.style.animationDelay = Math.random() * 6 + 's';
        p.style.animationDuration = (4 + Math.random() * 4) + 's';
        container.appendChild(p);
    }
}

// Create particles on load
createLoginParticles();
