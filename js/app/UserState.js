import { CLASS_ICONS } from './constants.js';

export class UserState {
    constructor() {
        this.user = null;
    }

    set(user) {
        this.user = user ? { ...user } : null;
    }

    get() {
        return this.user;
    }

    require() {
        if (!this.user) {
            throw new Error('User is not initialized');
        }
        return this.user;
    }

    patch(partial) {
        if (!this.user) return;
        Object.assign(this.user, partial);
    }

    hudModel() {
        if (!this.user) {
            return {
                name: 'Player',
                classIcon: '❓',
                level: 1,
                hp: 100,
                maxHp: 100,
                hpPercent: 100,
            };
        }

        const hp = this.user.hp || 100;
        const maxHp = this.user.max_hp || 100;
        const level = this.user.level || 1;
        return {
            name: this.user.login || 'Player',
            classIcon: CLASS_ICONS[this.user.class] || '❓',
            level,
            hp,
            maxHp,
            hpPercent: Math.max(0, Math.min(100, (hp / maxHp) * 100)),
        };
    }
}
