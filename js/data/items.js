// js/data/items.js
// Все предметы в игре

export const ITEMS = {
    health_potion: {
        id: 'health_potion',
        name: 'Зелье HP',
        icon: '🧪',
        type: 'consumable',
        desc: 'Восстанавливает 30 HP',
        effect: { hp: 30 },
        stackable: true
    },
    big_health_potion: {
        id: 'big_health_potion',
        name: 'Большое зелье HP',
        icon: '⚗️',
        type: 'consumable',
        desc: 'Восстанавливает 60 HP',
        effect: { hp: 60 },
        stackable: true
    },
    iron_sword: {
        id: 'iron_sword',
        name: 'Железный меч',
        icon: '🗡️',
        type: 'weapon',
        desc: 'Атака +5',
        effect: { attack: 5 },
        stackable: false
    },
    magic_staff: {
        id: 'magic_staff',
        name: 'Магический посох',
        icon: '🪄',
        type: 'weapon',
        desc: 'Атака +8',
        effect: { attack: 8 },
        stackable: false
    },
    wooden_shield: {
        id: 'wooden_shield',
        name: 'Деревянный щит',
        icon: '🛡️',
        type: 'armor',
        desc: 'Защита +4',
        effect: { defense: 4 },
        stackable: false
    },
    speed_boots: {
        id: 'speed_boots',
        name: 'Сапоги скорости',
        icon: '👢',
        type: 'armor',
        desc: 'Скорость +30',
        effect: { speed: 30 },
        stackable: false
    },
    gold_ring: {
        id: 'gold_ring',
        name: 'Золотое кольцо',
        icon: '💍',
        type: 'accessory',
        desc: 'HP +15, Атака +2',
        effect: { max_hp: 15, attack: 2 },
        stackable: false
    },
    forest_gem: {
        id: 'forest_gem',
        name: 'Лесной самоцвет',
        icon: '💎',
        type: 'quest',
        desc: 'Блестящий камень из леса',
        stackable: true
    },
    old_key: {
        id: 'old_key',
        name: 'Старый ключ',
        icon: '🔑',
        type: 'quest',
        desc: 'Открывает что-то...',
        stackable: false
    },
    fish: {
        id: 'fish',
        name: 'Свежая рыба',
        icon: '🐟',
        type: 'quest',
        desc: 'Только что пойманная',
        stackable: true
    },
    mushroom_item: {
        id: 'mushroom_item',
        name: 'Грибочек',
        icon: '🍄',
        type: 'consumable',
        desc: 'Восстанавливает 10 HP',
        effect: { hp: 10 },
        stackable: true
    }
};

// Лут-таблицы для зон карты
export const LOOT_TABLES = {
    forest: [
        { itemId: 'health_potion', chance: 0.4 },
        { itemId: 'mushroom_item', chance: 0.5 },
        { itemId: 'forest_gem', chance: 0.15 },
        { itemId: 'wooden_shield', chance: 0.08 },
    ],
    mountains: [
        { itemId: 'health_potion', chance: 0.3 },
        { itemId: 'iron_sword', chance: 0.1 },
        { itemId: 'gold_ring', chance: 0.05 },
        { itemId: 'old_key', chance: 0.08 },
    ],
    village: [
        { itemId: 'health_potion', chance: 0.5 },
        { itemId: 'big_health_potion', chance: 0.15 },
    ],
    lake: [
        { itemId: 'fish', chance: 0.5 },
        { itemId: 'health_potion', chance: 0.3 },
        { itemId: 'speed_boots', chance: 0.06 },
    ],
    meadow: [
        { itemId: 'mushroom_item', chance: 0.4 },
        { itemId: 'health_potion', chance: 0.3 },
        { itemId: 'magic_staff', chance: 0.05 },
    ]
};
