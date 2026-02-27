// js/core/db.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ===========================
// CLASS DEFAULTS
// ===========================
const CLASS_DEFAULTS = {
    warrior: { max_hp: 120, hp: 120, attack: 15, defense: 10, speed: 180 },
    mage: { max_hp: 90, hp: 90, attack: 18, defense: 5, speed: 200 },
    archer: { max_hp: 100, hp: 100, attack: 12, defense: 7, speed: 240 },
};

// ===========================
// AUTH: LOGIN / REGISTER
// ===========================
export async function dbLogin(login, password) {
    const { data: user, error } = await supabase
        .from('players')
        .select('*')
        .eq('login', login)
        .single();

    if (error && error.code !== 'PGRST116') return { error };

    if (user) {
        if (user.pass === password) return { user };
        return { error: { message: "Неверный пароль!" } };
    }

    // Register new player (no class yet — will be set on class select screen)
    const newPlayer = {
        login, pass: password,
        x: 1500, y: 1500,
        class: null,
        level: 1, xp: 0,
        hp: 100, max_hp: 100,
        attack: 10, defense: 5, speed: 200,
        emote: null, emote_at: 0,
        last_active: Date.now()
    };

    const { data: created, error: err } = await supabase
        .from('players').insert([newPlayer]).select().single();
    return { user: created, error: err };
}

// ===========================
// CLASS SELECTION
// ===========================
export async function dbSetClass(id, className) {
    const defaults = CLASS_DEFAULTS[className] || CLASS_DEFAULTS.warrior;
    return await supabase
        .from('players')
        .update({ class: className, ...defaults })
        .eq('id', id)
        .select()
        .single();
}

// ===========================
// SYNC (send self, get others)
// ===========================
export async function dbSync(myUser) {
    if (myUser) {
        await supabase.from('players').update({
            x: myUser.x,
            y: myUser.y,
            hp: myUser.hp,
            xp: myUser.xp,
            level: myUser.level,
            emote: myUser.emote || null,
            emote_at: myUser.emote_at || 0,
            last_active: Date.now()
        }).eq('id', myUser.id);
    }

    const threshold = Date.now() - 10000;
    const { data: players } = await supabase
        .from('players')
        .select('*')
        .gt('last_active', threshold);

    return players || [];
}

// ===========================
// CHAT
// ===========================
export async function dbSendMessage(name, text) {
    await supabase.from('messages').insert([{ player_name: name, text }]);
}

export async function dbGetMessages() {
    const { data } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
    return data ? data.reverse() : [];
}

// ===========================
// EMOTE (quick sync via player record)
// ===========================
export async function dbSendEmote(id, emote) {
    await supabase.from('players').update({
        emote, emote_at: Date.now()
    }).eq('id', id);
}

// ===========================
// UPDATE STATS (after level-up, duel, etc)
// ===========================
export async function dbUpdateStats(id, stats) {
    return await supabase.from('players').update(stats).eq('id', id);
}

// ===========================
// REALTIME (Broadcast for active combat)
// ===========================
export const gameChannel = supabase.channel('room-1', {
    config: {
        broadcast: { ack: false, self: false },
    },
});

export function initRealtime(onAttack, onMobHit) {
    gameChannel
        .on('broadcast', { event: 'attack' }, (payload) => {
            if (onAttack) onAttack(payload.payload);
        })
        .on('broadcast', { event: 'mob_hit' }, (payload) => {
            if (onMobHit) onMobHit(payload.payload);
        })
        .subscribe();
}

export function broadcastAttack(attackData) {
    gameChannel.send({
        type: 'broadcast',
        event: 'attack',
        payload: attackData
    });
}

export function broadcastMobHit(hitData) {
    gameChannel.send({
        type: 'broadcast',
        event: 'mob_hit',
        payload: hitData
    });
}
