console.log("Osu!mania: Controls Edition Loaded!");

let score = 0;
let combo = 0;
let gameInterval;
let beatInterval;
let isPlaying = false;
let isPaused = false;

// Настройки скоростей
let noteSpeed = 6;      
let spawnRate = 450;    
let beatRate = 500; 

const keys = ['d', 'f', 'j', 'k'];
let laneElements = [];
const music = document.getElementById('game-music');
const board = document.querySelector('.mania-board');
const avatar = document.querySelector('.osu-avatar');

let activeHoldNotes = [null, null, null, null];
let isKeyPressed = [false, false, false, false];

function changeDifficulty() {
    // Меняем настройки только если игра не запущена
    if (isPlaying && !isPaused) return; 
    
    const diff = document.getElementById('diff').value;
    if (diff === 'easy') {
        noteSpeed = 4; spawnRate = 650;
    } else if (diff === 'normal') {
        noteSpeed = 6; spawnRate = 450;
    } else if (diff === 'hard') {
        noteSpeed = 9; spawnRate = 280;
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
    isPaused = false;
    score = 0;
    combo = 0;
    updateUI();
    
    // Управляем кнопками интерфейса
    document.getElementById('start-game-btn').style.display = 'none';
    document.getElementById('pause-game-btn').style.display = 'inline-block';
    document.getElementById('reset-game-btn').style.display = 'inline-block';
    document.getElementById('diff').disabled = true;

    changeDifficulty();

    if(music) {
        music.currentTime = 0;
        music.play().catch(e => console.log("Audio play deferred"));
    }

    // Пульсация интерфейса (Beat Sync)
    beatInterval = setInterval(() => {
        if (isPaused) return; // Не пульсируем на паузе
        if(board) {
            board.classList.remove('pulse');
            void board.offsetWidth;
            board.classList.add('pulse');
        }
        if(avatar) {
            avatar.classList.remove('pulse');
            void avatar.offsetWidth;
            avatar.classList.add('pulse');
        }
    }, beatRate);

    // Генератор нот
    runSpawner();
}

function runSpawner() {
    gameInterval = setInterval(() => {
        if (isPaused) return;
        let randomLane = Math.floor(Math.random() * 4);
        let isHold = Math.random() > 0.75;
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
        noteHeight = 70;
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

        // Если игра на паузе — ноты просто застывают на месте
        if (isPaused) return;

        topPos += noteSpeed;
        note.style.top = topPos + 'px';

        if (isHold && activeHoldNotes[laneIndex] === note) {
            score += 2;
            updateUI();
        }

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

// Поставить игру на ПАУЗУ
function togglePauseGame() {
    if (!isPlaying) return;

    const pauseBtn = document.getElementById('pause-game-btn');

    if (!isPaused) {
        // Включаем паузу
        isPaused = true;
        pauseBtn.innerText = "Resume";
        if (music) music.pause();
        showRating('PAUSED', '#ffffff');
    } else {
        // Снимаем с паузы
        isPaused = false;
        pauseBtn.innerText = "Pause";
        if (music) music.play().catch(e => {});
    }
}

// ПОЛНЫЙ СБРОС ИГРЫ (Остановка)
function resetManiaGame() {
    isPlaying = false;
    isPaused = false;
    score = 0;
    combo = 0;
    activeHoldNotes = [null, null, null, null];
    
    // Останавливаем все глобальные таймеры спавна и пульсации
    clearInterval(gameInterval);
    clearInterval(beatInterval);

    // Выключаем музыку
    if (music) {
        music.pause();
        music.currentTime = 0;
    }

    // Удаляем абсолютно все оставшиеся ноты с поля визуально
    const allNotes = document.querySelectorAll('.note');
    allNotes.forEach(note => note.remove());

    // Обновляем интерфейс кнопок в исходное состояние
    document.getElementById('start-game-btn').style.display = 'inline-block';
    document.getElementById('pause-game-btn').style.display = 'none';
    document.getElementById('pause-game-btn').innerText = "Pause";
    document.getElementById('reset-game-btn').style.display = 'none';
    document.getElementById('diff').disabled = false; // Снова разрешаем менять сложность!
    
    updateUI();
    showRating('RESET', '#ff66aa');
}

window.addEventListener('keydown', (e) => {
    if (!isPlaying || isPaused) return; // На паузе кнопки не нажимаются
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

            const hitHitbox = noteTop + noteHeight;

            if (hitHitbox >= 340 && hitHitbox <= 400) {
                createHitEffect(keyIndex);

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

window.addEventListener('keyup', (e) => {
    const keyIndex = keys.indexOf(e.key.toLowerCase());
    if (keyIndex !== -1) {
        isKeyPressed[keyIndex] = false;
        const keyHint = document.getElementById(`key-${keyIndex}`);
        if (keyHint) keyHint.classList.remove('active');

        if (activeHoldNotes[keyIndex]) {
            const note = activeHoldNotes[keyIndex];
            activeHoldNotes[keyIndex] = null;
            destroyNote(note);
            showRating('RELEASE!', '#b500ff');
        }
    }
});

function createHitEffect(laneIndex) {
    if (!laneElements[laneIndex]) return;
    const effect = document.createElement('div');
    effect.classList.add('hit-effect');
    effect.classList.add(`lane-${laneIndex}`);
    laneElements[laneIndex].appendChild(effect);
    setTimeout(() => { effect.remove(); }, 200);
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