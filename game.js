console.log("Osu!mania: Ultimate Edition Loaded Successfully!");

let score = 0;
let combo = 0;
let gameInterval;
let beatInterval;
let isPlaying = false;

// Базовые настройки скоростей (меняются селектором)
let noteSpeed = 6;      
let spawnRate = 450;    
let beatRate = 500; // Пульсация каждые 0.5 сек (под темп песни KIRA - VOICE)

const keys = ['d', 'f', 'j', 'k'];
let laneElements = [];
const music = document.getElementById('game-music');
const board = document.querySelector('.mania-board');
const avatar = document.querySelector('.osu-avatar');

// Состояние зажатых клавиш и длинных нот
let activeHoldNotes = [null, null, null, null];
let isKeyPressed = [false, false, false, false];

// Функция смены сложности
function changeDifficulty() {
    const diff = document.getElementById('diff').value;
    if (diff === 'easy') {
        noteSpeed = 4; 
        spawnRate = 650;
    } else if (diff === 'normal') {
        noteSpeed = 6; 
        spawnRate = 450;
    } else if (diff === 'hard') {
        noteSpeed = 9; 
        spawnRate = 280;
    }
    console.log(`Difficulty: ${diff} | Speed: ${noteSpeed} | Spawn Rate: ${spawnRate}`);
}

// Главная функция старта игры
function startManiaGame() {
    if (isPlaying) return;
    
    // Инициализируем дорожки
    laneElements = [
        document.getElementById('lane-0'),
        document.getElementById('lane-1'),
        document.getElementById('lane-2'),
        document.getElementById('lane-3')
    ];

    isPlaying = true;
    score = 0;
    combo = 0;
    updateUI();
    
    document.getElementById('start-game-btn').style.display = 'none';
    document.getElementById('diff').disabled = true; // Блокируем выбор во время игры

    // Принудительно применяем настройки сложности
    changeDifficulty();

    // Пытаемся запустить музыку
    if(music) {
        music.currentTime = 0;
        music.play().catch(e => console.log("Ждём локальный MP3 файл для музыки:", e));
    }

    // Эффект Beat Sync: качаем интерфейс в ритм вокалоидов
    beatInterval = setInterval(() => {
        if(board) {
            board.classList.remove('pulse');
            void board.offsetWidth; // Магия сброса анимации в браузере
            board.classList.add('pulse');
        }
        if(avatar) {
            avatar.classList.remove('pulse');
            void avatar.offsetWidth;
            avatar.classList.add('pulse');
        }
    }, beatRate);

    // Генератор нот (обычные + длинные холды)
    gameInterval = setInterval(() => {
        let randomLane = Math.floor(Math.random() * 4);
        let isHold = Math.random() > 0.75; // 25% шанс появления длинной ноты
        createNote(randomLane, isHold);
    }, spawnRate);
}

// Создание падающей ноты
function createNote(laneIndex, isHold) {
    if (!laneElements[laneIndex]) return;
    
    const note = document.createElement('div');
    note.classList.add('note');
    
    let noteHeight = 15;
    if (isHold) {
        note.classList.add('hold-note');
        noteHeight = 70; // Длина слайдера
        note.style.height = noteHeight + 'px';
    }
    
    note.style.top = `-${noteHeight}px`;
    laneElements[laneIndex].appendChild(note);

    let topPos = -noteHeight;
    const noteInterval = setInterval(() => {
        if (!isPlaying) {
            clearInterval(noteInterval);
            note.remove();
            return;
        }

        topPos += noteSpeed;
        note.style.top = topPos + 'px';

        // Начисляем тики очков, пока игрок держит клавишу
        if (isHold && activeHoldNotes[laneIndex] === note) {
            score += 2;
            updateUI();
        }

        // Если нота пролетела мимо зоны нажатия (Miss)
        if (topPos > 400) {
            clearInterval(noteInterval);
            if (activeHoldNotes[laneIndex] === note) activeHoldNotes[laneIndex] = null;
            note.remove();
            showRating('MISS', '#ff4444');
            combo = 0;
            updateUI();
        }
    }, 20);

    note.dataset.intervalId = noteInterval;
    note.dataset.isHold = isHold;
    note.dataset.height = noteHeight;
}

// Обработка нажатий на клавиши D, F, J, K
window.addEventListener('keydown', (e) => {
    if (!isPlaying) return;
    const keyIndex = keys.indexOf(e.key.toLowerCase());
    
    if (keyIndex !== -1 && !isKeyPressed[keyIndex]) {
        isKeyPressed[keyIndex] = true;
        
        const keyHint = document.getElementById(`key-${keyIndex}`);
        if (keyHint) keyHint.classList.add('active');

        const notesInLane = laneElements[keyIndex] ? laneElements[keyIndex].getElementsByClassName('note') : [];
        
        if (notesInLane.length > 0) {
            const targetNote = notesInLane[0];
            const noteTop = parseInt(targetNote.style.top);
            const isHold = targetNote.dataset.isHold === "true";
            const noteHeight = parseInt(targetNote.dataset.height);

            // Нижний край ноты, который должен коснуться хит-зоны
            const hitHitbox = noteTop + noteHeight;

            // Тайминг попадания (зона от 340px до 400px)
            if (hitHitbox >= 340 && hitHitbox <= 400) {
                createHitEffect(keyIndex); // Взрываем неоновую вспышку!

                if (isHold) {
                    activeHoldNotes[keyIndex] = targetNote;
                    score += 100;
                    combo++;
                    showRating('HOLD!', '#00ffcc');
                } else {
                    score += 300;
                    combo++;
                    showRating('300', '#ffcc00');
                    destroyNote(targetNote);
                }
                updateUI();
            }
        }
    }
});

// Обработка отпускания клавиш
window.addEventListener('keyup', (e) => {
    const keyIndex = keys.indexOf(e.key.toLowerCase());
    if (keyIndex !== -1) {
        isKeyPressed[keyIndex] = false;
        
        const keyHint = document.getElementById(`key-${keyIndex}`);
        if (keyHint) keyHint.classList.remove('active');

        // Если отпустил клавишу раньше, чем закончился слайдер
        if (activeHoldNotes[keyIndex]) {
            const note = activeHoldNotes[keyIndex];
            activeHoldNotes[keyIndex] = null;
            destroyNote(note);
            showRating('RELEASE!', '#b500ff');
        }
    }
});

// Создание визуального эффекта распада/взрыва ноты
function createHitEffect(laneIndex) {
    if (!laneElements[laneIndex]) return;

    const effect = document.createElement('div');
    effect.classList.add('hit-effect');
    effect.classList.add(`lane-${laneIndex}`); // Передаем индекс для цвета вспышки
    
    laneElements[laneIndex].appendChild(effect);

    setTimeout(() => {
        effect.remove();
    }, 200);
}

function destroyNote(note) {
    clearInterval(note.dataset.intervalId);
    note.remove();
    updateUI();
}

function updateUI() {
    document.getElementById('score').innerText = String(score).padStart(6, '0');
    document.getElementById('combo').innerText = combo;
}

function showRating(text, color) {
    const ratingEl = document.getElementById('hit-rating');
    if (!ratingEl) return;
    ratingEl.innerText = text;
    ratingEl.style.color = color;
    ratingEl.style.opacity = 1;
    
    setTimeout(() => { ratingEl.style.opacity = 0; }, 250);
}