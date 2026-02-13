// js/data/dialogs.js

export const DIALOG_DATA = {
    'visotsky': {
        name: "Высоцкий",
        // Координаты НПС (чтобы знать, куда идти)
        x: 300,
        y: 100,
        // Сам диалог
        start: {
            text: "Привет, тварь! Хули ты хочешь?",
            options: [
                { text: "Иду садится на бутылку", next: "pass_by" },
                { text: "Хочу учиться сосать хуи", next: "teach_me" }
            ]
        },
        pass_by: {
            text: "Отлично, вот тебе бутылка.",
            options: [] // Конец
        },
        teach_me: {
            text: "Я могу тебе помочь. Сосание - сила!",
            options: []
        }
    }
    // Сюда можно добавлять других НПС
};
