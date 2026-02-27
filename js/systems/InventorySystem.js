// js/systems/InventorySystem.js
// Manages player inventory, item pickup, usage

import { ITEMS, LOOT_TABLES } from '../data/items.js';

export class InventorySystem {
    constructor(scene) {
        this.scene = scene;
        this.slots = []; // Array of { itemId, quantity }
        this.maxSlots = 20;
        this.lootSprites = [];
        this.load();
    }

    load() {
        try {
            const saved = localStorage.getItem('inventory');
            if (saved) this.slots = JSON.parse(saved);
        } catch (e) { /* ignore */ }
    }

    save() {
        localStorage.setItem('inventory', JSON.stringify(this.slots));
    }

    // ===========================
    // INVENTORY MANAGEMENT
    // ===========================
    addItem(itemId, qty = 1) {
        const itemDef = ITEMS[itemId];
        if (!itemDef) return false;

        // Try to stack
        if (itemDef.stackable) {
            const existing = this.slots.find(s => s.itemId === itemId);
            if (existing) {
                existing.quantity += qty;
                this.save();
                this.updateUI();
                return true;
            }
        }

        // New slot
        if (this.slots.length >= this.maxSlots) {
            this.showNotification('🎒 Инвентарь полон!');
            return false;
        }

        this.slots.push({ itemId, quantity: qty });
        this.save();
        this.updateUI();

        // Notify quest system
        if (this.scene.questSystem) {
            for (let i = 0; i < qty; i++) {
                this.scene.questSystem.onItemCollected(itemId);
            }
        }

        this.showNotification(`${itemDef.icon} +${qty} ${itemDef.name}`);
        return true;
    }

    removeItem(itemId, qty = 1) {
        const idx = this.slots.findIndex(s => s.itemId === itemId);
        if (idx === -1) return false;

        this.slots[idx].quantity -= qty;
        if (this.slots[idx].quantity <= 0) {
            this.slots.splice(idx, 1);
        }
        this.save();
        this.updateUI();
        return true;
    }

    hasItem(itemId, qty = 1) {
        const slot = this.slots.find(s => s.itemId === itemId);
        return slot && slot.quantity >= qty;
    }

    useItem(slotIndex) {
        if (slotIndex < 0 || slotIndex >= this.slots.length) return;
        const slot = this.slots[slotIndex];
        const item = ITEMS[slot.itemId];
        if (!item || !item.effect) return;

        const user = this.scene.currentUser;

        // Apply effects
        if (item.type === 'consumable') {
            if (item.effect.hp) {
                user.hp = Math.min((user.hp || 100) + item.effect.hp, user.max_hp || 100);
                this.showNotification(`${item.icon} +${item.effect.hp} HP`);
            }
            this.removeItem(slot.itemId, 1);
        } else {
            // Equipment — toggle equip (simple: just apply stats)
            if (item.effect.attack) user.attack = (user.attack || 10) + item.effect.attack;
            if (item.effect.defense) user.defense = (user.defense || 5) + item.effect.defense;
            if (item.effect.speed) user.speed = (user.speed || 200) + item.effect.speed;
            if (item.effect.max_hp) {
                user.max_hp = (user.max_hp || 100) + item.effect.max_hp;
                user.hp = Math.min((user.hp || 100) + item.effect.max_hp, user.max_hp);
            }
            this.showNotification(`${item.icon} ${item.name} экипирован!`);
            this.removeItem(slot.itemId, 1);
        }

        if (window.updateHUD) window.updateHUD();
        this.updateUI();
    }

    // ===========================
    // LOOT SPAWNING ON MAP
    // ===========================
    spawnLoot() {
        // Generate loot texture
        const g = this.scene.make.graphics({ add: false });
        g.fillStyle(0xFFD700, 0.9);
        g.fillCircle(8, 8, 7);
        g.fillStyle(0xFFF9C4, 0.6);
        g.fillCircle(6, 6, 3);
        g.lineStyle(1, 0xB8960F);
        g.strokeCircle(8, 8, 7);
        g.generateTexture('tex_loot', 16, 16);
        g.destroy();

        // Spawn loot items across zones
        const zones = [
            { name: 'forest', xMin: 100, xMax: 850, yMin: 100, yMax: 850 },
            { name: 'mountains', xMin: 2100, xMax: 2850, yMin: 120, yMax: 750 },
            { name: 'village', xMin: 1200, xMax: 1800, yMin: 1200, yMax: 1800 },
            { name: 'lake', xMin: 2200, xMax: 2800, yMin: 2200, yMax: 2800 },
            { name: 'meadow', xMin: 100, xMax: 800, yMin: 2100, yMax: 2800 },
        ];

        zones.forEach(zone => {
            const table = LOOT_TABLES[zone.name];
            if (!table) return;

            // 4-6 loot spots per zone
            const count = Phaser.Math.Between(4, 6);
            for (let i = 0; i < count; i++) {
                const x = Phaser.Math.Between(zone.xMin, zone.xMax);
                const y = Phaser.Math.Between(zone.yMin, zone.yMax);

                // Pick a random item from the loot table
                const roll = Math.random();
                let selectedItem = null;
                for (const entry of table) {
                    if (roll < entry.chance) {
                        selectedItem = entry.itemId;
                        break;
                    }
                }
                if (!selectedItem) selectedItem = table[0].itemId;

                const loot = this.scene.add.image(x, y, 'tex_loot');
                loot.setDepth(y - 1);
                loot.setInteractive({ useHandCursor: true });
                loot.itemId = selectedItem;
                loot.zone = zone.name;

                // Floating animation
                this.scene.tweens.add({
                    targets: loot,
                    y: y - 5,
                    duration: Phaser.Math.Between(1000, 1800),
                    yoyo: true, repeat: -1,
                    ease: 'Sine.easeInOut'
                });

                // Sparkle
                this.scene.tweens.add({
                    targets: loot,
                    alpha: { from: 0.7, to: 1 },
                    duration: 600,
                    yoyo: true, repeat: -1
                });

                // Click to pick up (if nearby)
                loot.on('pointerdown', () => {
                    const dist = Phaser.Math.Distance.Between(
                        this.scene.player.x, this.scene.player.y, loot.x, loot.y
                    );
                    if (dist < 60) {
                        this.pickupLoot(loot);
                    } else {
                        // Walk to it first
                        this.scene.moveTo(loot.x, loot.y);
                        this.pendingLoot = loot;
                    }
                });

                this.lootSprites.push(loot);
            }
        });
    }

    pickupLoot(lootSprite) {
        if (!lootSprite || !lootSprite.active) return;

        const item = ITEMS[lootSprite.itemId];
        if (!item) return;

        // Add to inventory
        if (this.addItem(lootSprite.itemId)) {
            // Pickup effect
            const txt = this.scene.add.text(lootSprite.x, lootSprite.y - 10, `${item.icon}`, {
                font: '24px Arial'
            }).setOrigin(0.5).setDepth(10000);

            this.scene.tweens.add({
                targets: txt,
                y: lootSprite.y - 50,
                alpha: { from: 1, to: 0 },
                duration: 1000,
                onComplete: () => txt.destroy()
            });

            lootSprite.destroy();
            this.lootSprites = this.lootSprites.filter(s => s !== lootSprite);

            // Track zone visit for explore quests
            if (lootSprite.zone && this.scene.questSystem) {
                this.scene.questSystem.onZoneVisited(lootSprite.zone);
            }
        }
    }

    // Check if player walked to pending loot
    checkPendingLoot(playerX, playerY) {
        if (!this.pendingLoot || !this.pendingLoot.active) {
            this.pendingLoot = null;
            return;
        }
        const dist = Phaser.Math.Distance.Between(playerX, playerY, this.pendingLoot.x, this.pendingLoot.y);
        if (dist < 60) {
            this.pickupLoot(this.pendingLoot);
            this.pendingLoot = null;
        }
    }

    // ===========================
    // INVENTORY UI
    // ===========================
    updateUI() {
        const grid = document.getElementById('inventory-grid');
        if (!grid) return;
        grid.innerHTML = '';

        for (let i = 0; i < this.maxSlots; i++) {
            const slot = document.createElement('div');
            slot.className = 'inv-slot';

            if (i < this.slots.length) {
                const s = this.slots[i];
                const item = ITEMS[s.itemId];
                if (item) {
                    slot.classList.add('filled');
                    slot.innerHTML = `<span style="font-size:22px">${item.icon}</span>`;
                    if (s.quantity > 1) {
                        slot.innerHTML += `<span style="position:absolute;bottom:2px;right:4px;font-size:9px;color:#FFD700;font-weight:bold">${s.quantity}</span>`;
                        slot.style.position = 'relative';
                    }
                    slot.title = `${item.name}\n${item.desc}`;
                    const idx = i;
                    slot.onclick = () => this.useItem(idx);
                }
            }

            grid.appendChild(slot);
        }
    }

    showNotification(text) {
        const notif = document.createElement('div');
        notif.style.cssText = `
            position: fixed; top: 120px; left: 50%; transform: translateX(-50%);
            background: rgba(0,0,0,0.8); border: 1px solid #4CAF50;
            border-radius: 8px; padding: 8px 18px; color: #4CAF50;
            font-family: 'Inter', sans-serif; font-size: 12px;
            z-index: 5000; backdrop-filter: blur(8px);
        `;
        notif.textContent = text;
        document.body.appendChild(notif);
        setTimeout(() => {
            notif.style.opacity = '0';
            notif.style.transition = 'opacity 0.4s';
            setTimeout(() => notif.remove(), 400);
        }, 2000);
    }
}
