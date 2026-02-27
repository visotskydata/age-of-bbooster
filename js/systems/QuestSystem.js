// js/systems/QuestSystem.js
// Quest tracking, progress, and rewards

import { QUEST_DATA } from '../data/dialogs.js';
import { ITEMS } from '../data/items.js';

export class QuestSystem {
    constructor(scene) {
        this.scene = scene;
        this.activeQuests = {};  // questId -> { ...questData, progress }
        this.completedQuests = new Set();
        this.load();
    }

    // Load from localStorage
    load() {
        try {
            const saved = localStorage.getItem('quests_active');
            if (saved) this.activeQuests = JSON.parse(saved);
            const done = localStorage.getItem('quests_done');
            if (done) this.completedQuests = new Set(JSON.parse(done));
        } catch (e) { /* ignore */ }
    }

    save() {
        localStorage.setItem('quests_active', JSON.stringify(this.activeQuests));
        localStorage.setItem('quests_done', JSON.stringify([...this.completedQuests]));
    }

    acceptQuest(questId) {
        if (this.activeQuests[questId] || this.completedQuests.has(questId)) return;

        const quest = QUEST_DATA[questId];
        if (!quest) return;

        this.activeQuests[questId] = {
            ...quest,
            progress: 0,
            accepted_at: Date.now()
        };

        this.save();
        this.showNotification(`📜 Новый квест: ${quest.name}`);
        this.updateQuestUI();
    }

    // Check if collecting an item progresses a quest
    onItemCollected(itemId) {
        Object.entries(this.activeQuests).forEach(([qId, q]) => {
            if (q.goal.type === 'collect' && q.goal.itemId === itemId) {
                q.progress = Math.min(q.progress + 1, q.goal.count);
                this.save();
                this.updateQuestUI();

                if (q.progress >= q.goal.count) {
                    this.completeQuest(qId);
                }
            }
        });
    }

    // Check zone exploration
    onZoneVisited(zone) {
        Object.entries(this.activeQuests).forEach(([qId, q]) => {
            if (q.goal.type === 'explore' && q.goal.zones) {
                if (!q.visitedZones) q.visitedZones = new Set();
                q.visitedZones.add(zone);
                q.progress = q.visitedZones.size;
                this.save();
                this.updateQuestUI();

                if (q.progress >= q.goal.zones.length) {
                    this.completeQuest(qId);
                }
            }
        });
    }

    completeQuest(questId) {
        const quest = this.activeQuests[questId];
        if (!quest) return;

        // Reward XP
        const user = this.scene.currentUser;
        if (quest.reward.xp) {
            user.xp = (user.xp || 0) + quest.reward.xp;
            this.checkLevelUp(user);
        }

        // Reward items
        if (quest.reward.items && this.scene.inventorySystem) {
            quest.reward.items.forEach(item => {
                for (let i = 0; i < (item.qty || 1); i++) {
                    this.scene.inventorySystem.addItem(item.id);
                }
            });
        }

        // Move to completed
        delete this.activeQuests[questId];
        this.completedQuests.add(questId);
        this.save();

        // Effects
        this.showNotification(`✅ Квест выполнен: ${quest.name}! +${quest.reward.xp} XP`);
        this.showCompletionEffect();
        this.updateQuestUI();
        if (window.updateHUD) window.updateHUD();
    }

    checkLevelUp(user) {
        const xpNeeded = (user.level || 1) * 100;
        if ((user.xp || 0) >= xpNeeded) {
            user.level = (user.level || 1) + 1;
            user.xp -= xpNeeded;
            user.max_hp = (user.max_hp || 100) + 10;
            user.hp = user.max_hp;
            user.attack = (user.attack || 10) + 2;
            user.defense = (user.defense || 5) + 1;
            this.showNotification(`🎉 Уровень ${user.level}! HP, атака и защита увеличены!`);
            this.showLevelUpEffect();
            if (window.updateHUD) window.updateHUD();
        }
    }

    showNotification(text) {
        // Create a floating notification on the HUD
        const notif = document.createElement('div');
        notif.style.cssText = `
            position: fixed; top: 80px; left: 50%; transform: translateX(-50%);
            background: rgba(0,0,0,0.85); border: 1px solid #FFD700;
            border-radius: 10px; padding: 12px 24px; color: #FFD700;
            font-family: 'Inter', sans-serif; font-size: 13px;
            z-index: 5000; animation: slideDown 0.3s ease-out;
            backdrop-filter: blur(10px);
        `;
        notif.textContent = text;
        document.body.appendChild(notif);

        setTimeout(() => {
            notif.style.opacity = '0';
            notif.style.transition = 'opacity 0.5s';
            setTimeout(() => notif.remove(), 500);
        }, 3000);
    }

    showCompletionEffect() {
        // Particle burst around player
        if (!this.scene.player) return;
        const emitter = this.scene.add.particles(this.scene.player.x, this.scene.player.y, 'tex_sparkle', {
            speed: { min: 50, max: 120 },
            lifespan: 1000,
            quantity: 20,
            scale: { start: 2, end: 0 },
            alpha: { start: 1, end: 0 },
            emitting: false
        });
        emitter.explode(20);
        this.scene.time.delayedCall(1500, () => emitter.destroy());
    }

    showLevelUpEffect() {
        if (!this.scene.player) return;
        const txt = this.scene.add.text(
            this.scene.player.x, this.scene.player.y - 60,
            '⬆️ LEVEL UP!', {
            font: 'bold 18px Inter', fill: '#FFD700',
            stroke: '#000', strokeThickness: 4
        }
        ).setOrigin(0.5).setDepth(10005);

        this.scene.tweens.add({
            targets: txt,
            y: this.scene.player.y - 120,
            alpha: { from: 1, to: 0 },
            scale: { from: 1, to: 2 },
            duration: 2000,
            onComplete: () => txt.destroy()
        });
    }

    updateQuestUI() {
        const list = document.getElementById('quest-list');
        if (!list) return;
        list.innerHTML = '';

        if (Object.keys(this.activeQuests).length === 0) {
            list.innerHTML = '<p style="color:#888;text-align:center;padding:20px;">Нет активных квестов.<br>Поговори с NPC!</p>';
            return;
        }

        Object.values(this.activeQuests).forEach(q => {
            const item = document.createElement('div');
            item.className = 'quest-item';
            const goalText = q.goal.type === 'collect'
                ? `${q.progress}/${q.goal.count}`
                : `${q.progress}/${q.goal.zones?.length || 0}`;
            item.innerHTML = `
                <h4>${q.icon} ${q.name}</h4>
                <p>${q.desc}</p>
                <p style="color:#4CAF50; margin-top:4px;">Прогресс: ${goalText}</p>
            `;
            list.appendChild(item);
        });
    }
}
