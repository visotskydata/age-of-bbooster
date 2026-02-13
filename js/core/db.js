// js/core/db.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';

// Создаем клиент
export const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// Функция логина (пример, перенесем логику сюда)
export async function loginUser(login, password) {
    const { data, error } = await db
        .from('players')
        .select('*')
        .eq('login', login)
        .single();
    
    // Тут будет логика проверки пароля
    return { data, error };
}
