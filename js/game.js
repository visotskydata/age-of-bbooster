// --- НАСТРОЙКИ SUPABASE ---
const SUPABASE_URL = 'https://baxaxcsvbkgfuwysabrd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJheGF4Y3N2YmtnZnV3eXNhYnJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODMyNzgsImV4cCI6MjA4NjU1OTI3OH0.3RDpU3cG0R4kMqRtDJlZk5uhG2jwfCK1F-UprZ-aUkk';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Глобальные переменные ---
let currentUser = {
    login: null,
    class: null,
    x: 0,
    y: 0,
    id: null // ID записи в базе
};

let gameInterval = null;
const mapElement = document.getElementById('world-map');
const skins = { 'warrior': '⚔️', 'mage': '🧙‍♂️', 'archer': '🏹' };

// --- Управление экранами ---
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// --- Логин / Регистрация ---
async function tryLogin() {
    const l = document.getElementById('login-input').value;
    if (!l) return alert("Введите логин!");

    // 1. Проверяем, есть ли такой игрок
    const { data, error } = await db
        .from('players')
        .select('*')
        .eq('login', l)
        .single(); // Ищем одного

    if (data) {
        // Игрок найден, загружаем
        currentUser = data;
        if (!currentUser.class) {
            showScreen('screen-class');
        } else {
            startGame();
        }
    } else {
        // Игрока нет, создаем нового
        const newPlayer = {
            login: l,
            x: 180,
            y: 450,
            last_active: Date.now()
        };
        
        const { data: createdUser, error: insertError } = await db
            .from('players')
            .insert([newPlayer])
            .select()
            .single();

        if (insertError) {
            alert("Ошибка регистрации: " + insertError.message);
            return;
        }

        currentUser = createdUser;
        showScreen('screen-class');
    }
}

// --- Выбор класса ---
async function selectClass(cls) {
    currentUser.class = cls;
    
    // Обновляем класс в базе
    await db
        .from('players')
        .update({ class: cls })
        .eq('id', currentUser.id);

    startGame();
}

// --- Старт игры ---
function startGame() {
    showScreen('screen-game');
    document.getElementById('player-name-display').innerText = `${currentUser.login} (${currentUser.class || '?'})`;
    
    // Запускаем цикл (раз в секунду обновляем данные)
    gameInterval = setInterval(gameLoop, 1000);
    gameLoop();
}

function logout() {
    clearInterval(gameInterval);
    location.reload();
}

// --- Игровой цикл (Синхронизация) ---
async function gameLoop() {
    // 1. Отправляем свои координаты (Heartbeat)
    await db
        .from('players')
        .update({ 
            x: currentUser.x, 
            y: currentUser.y, 
            last_active: Date.now() 
        })
        .eq('id', currentUser.id);

    // 2. Скачиваем всех живых игроков (активны за последние 10 сек)
    const timeThreshold = Date.now() - 10000;
    
    const { data: players, error } = await db
        .from('players')
        .select('*')
        .gt('last_active', timeThreshold);

    if (players) {
        renderPlayers(players);
    }
}

// --- Движение (Клик) ---
function movePlayer(e) {
    if (e.target !== mapElement && !e.target.classList.contains('tree')) return;

    const rect = mapElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    currentUser.x = Math.floor(x);
    currentUser.y = Math.floor(y);

    // Маркер клика
    const clickMarker = document.createElement('div');
    clickMarker.style.position = 'absolute';
    clickMarker.style.left = x + 'px';
    clickMarker.style.top = y + 'px';
    clickMarker.innerText = '❌';
    clickMarker.style.fontSize = '10px';
    clickMarker.style.pointerEvents = 'none';
    mapElement.appendChild(clickMarker);
    setTimeout(() => clickMarker.remove(), 500);
    
    // Принудительно запускаем обновление, чтобы не ждать секунду
    gameLoop();
}

// --- Отрисовка ---
function renderPlayers(players) {
    const oldPlayers = document.querySelectorAll('.player-char');
    oldPlayers.forEach(p => p.remove());

    players.forEach(p => {
        const el = document.createElement('div');
        el.className = 'player-char';
        el.style.left = p.x + 'px';
        el.style.top = p.y + 'px';

        const isMe = p.login === currentUser.login;
        const skin = skins[p.class] || '❓';
        
        el.innerHTML = `<span class="player-name" style="${isMe ? 'color:#0f0' : 'color:#fff'}">${p.login}</span><br>${skin}`;
        el.style.zIndex = Math.floor(p.y);

        mapElement.appendChild(el);
    });
}