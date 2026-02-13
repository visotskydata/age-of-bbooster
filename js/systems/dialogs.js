// js/systems/dialogs.js

// База данных всех диалогов в игре
const DIALOG_DATA = {
    'visotsky': {
        name: "Высоцкий Александр",
        // 'start' - это всегда начало разговора
        start: {
            text: "Привет, путник! Хули ты хочешь?",
            options: [
                { text: "Прохожу мимо", next: "pass_by" },
                { text: "Хочу сосать хуи", next: "teach_me" }
            ]
        },
        // Ветки ответов
        pass_by: {
            text: "Отлично, удачи тебе в пути.",
            options: [] // Пустой массив = нет вариантов (конец ветки)
        },
        teach_me: {
            text: "Я могу тебе помочь. Знание - сила!",
            options: []
        }
    }
};

let currentNpcId = null;

export function initDialogSystem() {
    // Делаем функции доступными глобально для HTML
    window.startNpcDialog = startNpcDialog;
    window.closeDialog = closeDialog;
    window.dialogOptionClick = dialogOptionClick;
}

// Запуск диалога (вызывается при клике на НПС)
function startNpcDialog(npcId) {
    const npcData = DIALOG_DATA[npcId];
    if (!npcData) return;

    currentNpcId = npcId;
    
    // Показываем окно
    document.getElementById('dialog-overlay').style.display = 'flex';
    document.getElementById('dialog-npc-name').innerText = npcData.name;
    
    // Загружаем стартовую ветку
    showStep('start');
}

// Показать конкретный шаг разговора
function showStep(stepId) {
    const npcData = DIALOG_DATA[currentNpcId];
    const step = npcData[stepId];

    // 1. Текст НПС
    const textEl = document.getElementById('dialog-text');
    textEl.innerText = ""; 
    
    // Эффект печатающей машинки (для красоты)
    let i = 0;
    const typeWriter = setInterval(() => {
        textEl.innerText += step.text.charAt(i);
        i++;
        if (i > step.text.length) clearInterval(typeWriter);
    }, 30);
    // (Если не хочешь анимацию, просто напиши: textEl.innerText = step.text;)

    // 2. Кнопки ответов
    const optionsDiv = document.getElementById('dialog-options');
    optionsDiv.innerHTML = ''; // Очистить старые кнопки

    step.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'dialog-btn';
        btn.innerText = `> ${opt.text}`;
        // При клике загружаем следующий шаг (next)
        btn.onclick = () => showStep(opt.next);
        optionsDiv.appendChild(btn);
    });
}

function closeDialog() {
    document.getElementById('dialog-overlay').style.display = 'none';
    currentNpcId = null;
}
