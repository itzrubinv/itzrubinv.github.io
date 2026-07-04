console.log("Osu!mania: Turbo Mode with Hold Notes!");

let score = 0;
let combo = 0;
let gameInterval;
let beatInterval;
let isPlaying = false;

// Базовые настройки скоростей под трек KIRA - VOICE
let noteSpeed = 6;      
let spawnRate = 450;    
let beatRate = 500; // Пульсация каждые 0.5 сек (в такт)

const keys = ['d', 'f', 'j', 'k'];
let laneElements = [];
const music = document.getElementById('game-music');
const board = document.querySelector('.mania-board');
const avatar = document.querySelector('.osu-avatar');

// Храним состояние зажатых клавиш и активных холд-нот
let activeHoldNotes = [null, null, null, null];
let isKeyPressed = [false, false, false, false];

function changeDifficulty() {
    const diff = document.getElementById('diff').value;
    if (diff === 'easy') {
        noteSpeed = 4; spawnRate = 650;
    } else if (diff === 'normal') {
        noteSpeed = 6; spawnRate = 450;
    } else if (diff === 'hard') {
        noteSpeed = 9; spawnRate = 280; // Настоящий хардкор
    }
}

function startManiaGame() {
    if (isPlaying) return;
    
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
    document.getElementById('diff').disabled = true;

    changeDifficulty();

    if(music) {
        music.currentTime = 0;
        music.play().catch(e => console.log("Audio play deferred", e));
    }

    // Визуальный Beat Sync (пульсация под трек)
    beatInterval = setInterval(() => {
        if(board) {
            board.classList.remove('pulse');
            void board.offsetWidth; // Триггер перезапуска анимации
            board.classList.add('pulse');
        }
        if(avatar) {
            avatar.classList.remove('pulse');
            void avatar.offsetWidth;
            avatar.classList.add('pulse');
        }
    }, beatRate);

    // Спавн нот (рандомим обычные ноты и длинные зажатия)
    gameInterval = setInterval(() => {
        let randomLane = Math.floor(Math.random() * 4);
        let isHold = Math.random() > 0.75; // 25% шанс, что полетит холд-нота
        createNote(randomLane, isHold);
    }, spawnRate);
}

function createNote(laneIndex, isHold) {
    if (!laneElements[laneIndex]) return;
    
    const note = document.createElement('div');
    note.classList.add('note');
    
    let noteHeight = 15;
    if (isHold) {
        note.classList.add('hold-note');
        noteHeight = 70; // Длинная полоска
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

        // Подсчёт тиков для зажатой длинной ноты
        if (isHold && activeHoldNotes[laneIndex] === note) {
            score += 2; // Капают очки, пока держишь
            updateUI();
        }

        // Если нота полностью ушла вниз (Miss)
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

            // Точка касания низа ноты с хит-зоной
            const hitHitbox = noteTop + noteHeight;

            if (hitHitbox >= 340 && hitHitbox <= 400) {
                if (isHold) {
                    // Зажимаем длинную ноту
                    activeHoldNotes[keyIndex] = targetNote;
                    score += 100;
                    combo++;
                    showRating('HOLD!', '#00ffcc');
                } else {
                    // Обычный идеальный клик
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

window.addEventListener('keyup', (e) => {
    const keyIndex = keys.indexOf(e.key.toLowerCase());
    if (keyIndex !== -1) {
        isKeyPressed[keyIndex] = false;
        const keyHint = document.getElementById(`key-${keyIndex}`);
        if (keyHint) keyHint.classList.remove('active');

        // Если игрок отпустил клавишу раньше времени на длинной ноте
        if (activeHoldNotes[keyIndex]) {
            const note = activeHoldNotes[keyIndex];
            activeHoldNotes[keyIndex] = null;
            destroyNote(note);
            showRating('RELEASE!', '#b500ff');
        }
    }
});

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