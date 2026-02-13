// js/ui/templates.js

export const TEMPLATES = {
    // 1. Главное меню
    menu: `
        <div id="screen-menu" class="screen active">
            <h1 class="logo">Age of<br><span>bbooster</span><br>Heroes</h1>
            <button onclick="showScreen('login')">НАЧАТЬ ИГРУ</button>
        </div>
    `,

    // 2. Логин
    login: `
        <div id="screen-login" class="screen active">
            <h2>АВТОРИЗАЦИЯ</h2>
            <input type="text" id="login-input" placeholder="Логин">
            <input type="password" id="pass-input" placeholder="Пароль">
            <button onclick="tryLogin()">ВОЙТИ / СОЗДАТЬ</button>
            <p class="info">Если аккаунта нет, он создастся сам.</p>
            <button class="btn-small" onclick="showScreen('menu')">Назад</button>
        </div>
    `,

    // 3. Выбор класса
    classSelection: `
        <div id="screen-class" class="screen active">
            <h2>ВЫБЕРИ ГЕРОЯ</h2>
            <div class="classes-row">
                <div class="class-card" onclick="selectClass('warrior')">
                    <div class="icon">⚔️</div><div>Воин</div>
                </div>
                <div class="class-card" onclick="selectClass('mage')">
                    <div class="icon">🧙‍♂️</div><div>Маг</div>
                </div>
                <div class="class-card" onclick="selectClass('archer')">
                    <div class="icon">🏹</div><div>Лучник</div>
                </div>
            </div>
        </div>
    `,

    // 4. Игровой мир (Каркас)
    game: `
        <div id="screen-game" class="screen active">
            <div id="ui-top">
                <span id="player-name-display">Загрузка...</span>
                <button onclick="logout()" class="btn-micro">Выход</button>
            </div>
            
            <div id="world-map" onclick="movePlayer(event)">
                <div class="tree" style="top:50px; left:50px;">🌲</div>
                <div class="tree" style="top:200px; left:250px;">🌲</div>
                <div class="tree" style="top:350px; left:100px;">🌳</div>
            </div>

            <div id="log-console">Добро пожаловать в мир bbooster...</div>
        </div>
    `
};
