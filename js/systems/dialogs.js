// js/systems/dialogs.js
import { DIALOG_DATA } from '../data/dialogs.js'; // Импортируем данные

let currentNpcId = null;
let typeWriterInterval = null; // Храним интервал, чтобы можно было остановить

export function initDialogSystem() {
    window.startNpcDialog = startNpcDialog;
    window.closeDialog = closeDialog;
}

function startNpcDialog(npcId) {
    const npcData = DIALOG_DATA[npcId];
    if (!npcData) return;

    // 1. Получаем координаты героя
    const hero = window.currentUserGlobal; // Берем из main.js
    if (!hero) return;

    // 2. Считаем дистанцию (Формула: корень из (dx*dx + dy*dy))
    const dist = Math.hypot(hero.x - npcData.x, hero.y - npcData.y);

    // 3. Проверка дистанции (например, 70 пикселей - это радиус разговора)
    if (dist > 70) {
        // --- ГЕРОЙ ДАЛЕКО ---
        
        // Вычисляем точку, куда подойти (чуть правее или левее НПС)
        // Например, подходим на позицию x+40, y+40
        const targetX = npcData.x + 40; 
        const targetY = npcData.y + 40;

        // Вызываем движение (функция из main.js)
        window.movePlayerTo(targetX, targetY);

        // Ждем пока дойдет (500мс - время анимации transition в CSS + запас)
        setTimeout(() => {
            openDialogWindow(npcId);
        }, 600);
        
    } else {
        // --- ГЕРОЙ РЯДОМ ---
        openDialogWindow(npcId);
    }
}

function openDialogWindow(npcId) {
    currentNpcId = npcId;
    const npcData = DIALOG_DATA[npcId];

    document.getElementById('dialog-overlay').style.display = 'flex';
    document.getElementById('dialog-npc-name').innerText = npcData.name;
    
    showStep('start');
}

function showStep(stepId) {
    const npcData = DIALOG_DATA[currentNpcId];
    const step = npcData[stepId];
    const textEl = document.getElementById('dialog-text');
    const optionsDiv = document.getElementById('dialog-options');

    // Очистка
    textEl.innerText = ""; 
    optionsDiv.innerHTML = ''; 
    if (typeWriterInterval) clearInterval(typeWriterInterval);

    // Печатающая машинка (исправленная)
    let i = 0;
    // Используем textContent для надежности
    textEl.textContent = ""; 
    
    typeWriterInterval = setInterval(() => {
        // Добавляем букву
        textEl.textContent += step.text.charAt(i);
        i++;
        
        // Если текст кончился
        if (i >= step.text.length) {
            clearInterval(typeWriterInterval);
        }
    }, 30);

    // Рисуем кнопки
    step.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'dialog-btn';
        btn.innerText = `> ${opt.text}`;
        btn.onclick = () => showStep(opt.next);
        optionsDiv.appendChild(btn);
    });
}

function closeDialog() {
    document.getElementById('dialog-overlay').style.display = 'none';
    currentNpcId = null;
    if (typeWriterInterval) clearInterval(typeWriterInterval);
}
