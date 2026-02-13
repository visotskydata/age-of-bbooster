// js/core/db.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';

// Инициализация
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Логин / Регистрация
export async function dbLogin(login, password) {
    // 1. Ищем игрока
    const { data: user, error } = await supabase
        .from('players')
        .select('*')
        .eq('login', login)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = не найдено
        return { error };
    }

    if (user) {
        // Игрок есть, проверяем пароль
        if (user.pass === password) {
            return { user };
        } else {
            return { error: { message: "Неверный пароль!" } };
        }
    } else {
        // Регистрация нового
        const newPlayer = {
            login: login,
            pass: password,
            x: 180,
            y: 450,
            last_active: Date.now()
        };
        const { data: createdUser, error: createError } = await supabase
            .from('players')
            .insert([newPlayer])
            .select()
            .single();
        
        return { user: createdUser, error: createError };
    }
}

// Обновление класса
export async function dbUpdateClass(id, className) {
    return await supabase
        .from('players')
        .update({ class: className })
        .eq('id', id);
}

// Синхронизация (отправляем себя, получаем других)
export async function dbSync(myUser) {
    // 1. Отправляем свои координаты
    if (myUser) {
        await supabase
            .from('players')
            .update({ 
                x: myUser.x, 
                y: myUser.y, 
                last_active: Date.now() 
            })
            .eq('id', myUser.id);
    }

    // 2. Получаем всех живых (кто был онлайн последние 10 сек)
    const timeThreshold = Date.now() - 10000;
    const { data: players } = await supabase
        .from('players')
        .select('*')
        .gt('last_active', timeThreshold);
        
    return players || [];
}
