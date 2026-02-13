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

    const hero = window.currentUserGlobal;
    if (!hero) return;

    // Считаем дистанцию
    const dist = Math.hypot(hero.x - npcData.x, hero.y - npcData.y);

    if (dist > 70) {
        // --- ГЕРОЙ ДАЛЕКО ---
        const targetX = npcData.x + 40; 
        const targetY = npcData.y + 40;

        // 1. Находим DOM-элемент нашего героя
        const heroEl = document.querySelector(`.player-char[data-id="${hero.id}"]`);

        // 2. Вешаем слушатель: "Когда закончишь двигаться..."
        if (heroEl) {
            // Очищаем старые слушатели (на всякий случай)
            const onArrival = () => {
                openDialogWindow(npcId);
                heroEl.removeEventListener('transitionend', onArrival); // Убираем за собой
            };

            // { once: true } значит сработает один раз и удалится
            heroEl.addEventListener('transitionend', onArrival, { once: true });
        }

        // 3. Запускаем движение
        window.movePlayerTo(targetX, targetY);
        
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
