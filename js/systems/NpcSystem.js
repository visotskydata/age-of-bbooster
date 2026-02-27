// js/systems/NpcSystem.js
// Renders NPCs in Phaser, handles interaction and dialog

import { NPC_DATA } from '../data/dialogs.js';

export class NpcSystem {
    constructor(scene) {
        this.scene = scene;
        this.npcs = {};
        this.interactionRange = 80;
        this.activeNpc = null;
        this.typewriterTimer = null;
    }

    create() {
        // Generate NPC texture (simple colored body)
        const g = this.scene.make.graphics({ add: false });
        // Body
        g.fillStyle(0xFFFFFF); g.fillRect(8, 12, 16, 24);
        // Head
        g.fillCircle(16, 10, 8);
        // Eyes
        g.fillStyle(0x000000); g.fillCircle(13, 9, 1.5); g.fillCircle(19, 9, 1.5);
        g.generateTexture('tex_npc', 32, 38);
        g.destroy();

        // Quest marker "!"
        const qg = this.scene.make.graphics({ add: false });
        qg.fillStyle(0xFFD700);
        qg.fillCircle(8, 14, 4);
        qg.fillStyle(0x000000);
        qg.fillRect(7, 8, 3, 6);
        qg.fillRect(7, 15, 3, 2);
        qg.generateTexture('tex_quest_mark', 16, 20);
        qg.destroy();

        // Place all NPCs
        Object.values(NPC_DATA).forEach(npc => {
            const sprite = this.scene.add.sprite(npc.x, npc.y, 'tex_npc');
            sprite.setTint(npc.tint || 0xFFFFFF);
            sprite.setScale(1.3);
            sprite.setDepth(npc.y);
            sprite.setInteractive({ useHandCursor: true });

            // Name label
            const label = this.scene.add.text(npc.x, npc.y - 35, `${npc.icon} ${npc.name}`, {
                font: '11px Inter, Arial',
                fill: '#FFD700',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5).setDepth(npc.y + 1);

            // Quest marker (floating "!")
            const marker = this.scene.add.image(npc.x, npc.y - 50, 'tex_quest_mark');
            marker.setDepth(npc.y + 2);
            this.scene.tweens.add({
                targets: marker,
                y: npc.y - 55,
                duration: 800,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            // Click handler
            sprite.on('pointerdown', () => {
                this.interactWith(npc.id);
            });

            this.npcs[npc.id] = { sprite, label, marker, data: npc };
        });

        // Setup dialog modal handlers
        this.setupDialogUI();
    }

    // Check proximity and show interaction hint
    update(playerX, playerY) {
        Object.values(this.npcs).forEach(npc => {
            const dist = Phaser.Math.Distance.Between(playerX, playerY, npc.data.x, npc.data.y);
            // Glow effect when near
            if (dist < this.interactionRange) {
                npc.sprite.setAlpha(1);
                npc.label.setAlpha(1);
            } else {
                npc.sprite.setAlpha(0.85);
                npc.label.setAlpha(0.7);
            }
        });
    }

    interactWith(npcId) {
        const npc = this.npcs[npcId];
        if (!npc) return;

        const player = this.scene.player;
        const dist = Phaser.Math.Distance.Between(
            player.x, player.y, npc.data.x, npc.data.y
        );

        if (dist > this.interactionRange) {
            // Walk to NPC first, then interact
            this.scene.moveTo(npc.data.x + 40, npc.data.y + 40);
            // Queue interaction after arrival
            this.pendingInteraction = npcId;
            return;
        }

        this.openDialog(npcId, 'start');
    }

    // Called from GameScene update when player stops moving
    checkPendingInteraction(playerX, playerY) {
        if (!this.pendingInteraction) return;
        const npc = this.npcs[this.pendingInteraction];
        if (!npc) { this.pendingInteraction = null; return; }

        const dist = Phaser.Math.Distance.Between(playerX, playerY, npc.data.x, npc.data.y);
        if (dist <= this.interactionRange) {
            const id = this.pendingInteraction;
            this.pendingInteraction = null;
            this.openDialog(id, 'start');
        }
    }

    // ===========================
    // DIALOG SYSTEM
    // ===========================
    openDialog(npcId, stepId) {
        this.activeNpc = npcId;
        const npc = NPC_DATA[npcId];
        if (!npc || !npc.dialog[stepId]) return;

        const step = npc.dialog[stepId];
        const modal = document.getElementById('dialog-modal');
        const nameEl = document.getElementById('dialog-npc-name');
        const textEl = document.getElementById('dialog-text');
        const optionsEl = document.getElementById('dialog-options');

        modal.classList.remove('hidden');
        nameEl.textContent = `${npc.icon} ${npc.name}`;
        textEl.textContent = '';
        optionsEl.innerHTML = '';

        // Typewriter effect
        if (this.typewriterTimer) clearInterval(this.typewriterTimer);
        let i = 0;
        this.typewriterTimer = setInterval(() => {
            textEl.textContent += step.text.charAt(i);
            i++;
            if (i >= step.text.length) {
                clearInterval(this.typewriterTimer);
                this.typewriterTimer = null;
                // Show options after text completes
                this.showOptions(npcId, step);
            }
        }, 25);

        // Click to skip typewriter
        textEl.onclick = () => {
            if (this.typewriterTimer) {
                clearInterval(this.typewriterTimer);
                this.typewriterTimer = null;
                textEl.textContent = step.text;
                this.showOptions(npcId, step);
            }
        };
    }

    showOptions(npcId, step) {
        const optionsEl = document.getElementById('dialog-options');
        optionsEl.innerHTML = '';

        if (step.options.length === 0) {
            // Close button only
            const btn = document.createElement('button');
            btn.textContent = '✕ Закрыть';
            btn.onclick = () => this.closeDialog();
            optionsEl.appendChild(btn);
            return;
        }

        step.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.textContent = `▸ ${opt.text}`;
            btn.onclick = () => {
                // Handle action
                if (opt.action) {
                    this.handleAction(opt.action);
                }
                if (opt.next) {
                    this.openDialog(npcId, opt.next);
                } else {
                    this.closeDialog();
                }
            };
            optionsEl.appendChild(btn);
        });
    }

    handleAction(action) {
        if (!action) return;
        switch (action.type) {
            case 'give_quest':
                if (this.scene.questSystem) {
                    this.scene.questSystem.acceptQuest(action.questId);
                }
                break;
            case 'open_shop':
                // TODO: shop system
                break;
        }
    }

    closeDialog() {
        document.getElementById('dialog-modal').classList.add('hidden');
        if (this.typewriterTimer) {
            clearInterval(this.typewriterTimer);
            this.typewriterTimer = null;
        }
        this.activeNpc = null;
    }

    setupDialogUI() {
        // Close button
        const closeBtn = document.querySelector('[data-close="dialog-modal"]');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeDialog());
        }
    }
}
