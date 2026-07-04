console.log("Osu!mania: Sync & Results Edition Loaded!");

let score = 0;
let combo = 0;
let maxCombo = 0;
let gameInterval;
let beatInterval;
let isPlaying = false;
let isPaused = false;

// Статистика для подсчета Accuracy
let totalNotesSpawned = 0;
let hitNotesCount = 0; 
let perfectHits = 0; // Нажатия на 300

// Настройки скоростей (привязаны к сетке BPM 120)
let noteSpeed = 6;      
let currentDiff = 'normal';

const keys = ['d', 'f', 'j', 'k'];
let laneElements = [];
const music = document.getElementById('game-music');
const board = document.querySelector('.mania-board');
const avatar = document.querySelector('.osu-avatar');

let activeHoldNotes = [null, null, null, null];
let isKeyPressed = [false, false, false, false];

function changeDifficulty() {
    if (isPlaying && !isPaused) return; 
    currentDiff = document.getElementById('diff').value;
    if (currentDiff === 'easy') noteSpeed = 4;
    if (currentDiff === 'normal') noteSpeed = 6;
    if (currentDiff === 'hard') noteSpeed = 9;
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
    maxCombo = 0;
    totalNotesSpawned = 0;
    hitNotesCount = 0;
    perfectHits = 0;
    
    updateUI();
    document.getElementById('result-screen').style.display = 'none';
    document.getElementById('start-game-btn').style.display = 'none';
    document.getElementById('pause-game-btn').style.display = 'inline-block';
    document.getElementById('reset-game-btn').style.display = 'inline-block';
    document.getElementById('diff').disabled = true;

    changeDifficulty();

    if(music) {
        music.currentTime = 0;
        music.play().catch(e => console.log("Audio play error"));
        
        // АВТОМАТИЧЕСКИЙ КОНЕЦ ИГРЫ ПРИ ЗАВЕРШЕНИИ ПЕСНИ
        music.onended = () => {
            endGameAndShowResults();
        };
    }

    // Синк пульсации: ровно 120 BPM (каждые 500мс)
    beatInterval = setInterval(() => {
        if (isPaused) return;
        [board, avatar].forEach(el => {
            if(el) {
                el.classList.remove('pulse');
                void el.offsetWidth;
                el.classList.add('pulse');
            }
        });
    }, 500);

    // Синк нот: генерируем паттерны строго по долям (250мс / 500мс)
    let intervalTime = currentDiff === 'hard' ? 250 : 500;
    gameInterval = setInterval(() => {
        if (isPaused) return;
        
        // В ритм-играх ноты идут не случайно каждую миллисекунду, а группами
        let randomLane = Math.floor(Math.random() * 4);
        let isHold = Math.random() > 0.80; // 20% шанс длинной ноты
        
        createNote(randomLane, isHold);
        totalNotesSpawned++;
    }, intervalTime);
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

// Обработка кликов
window.addEventListener('keydown', (e) => {
    if (!isPlaying || isPaused) return;
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
                hitNotesCount++;

                if (isHold) {
                    activeHoldNotes[keyIndex] = targetNote;
                    score += 100;
                    combo++;
                    showRating('HOLD!', '#00ffcc');
                } else {
                    perfectHits++;
                    score += 300;
                    combo++;
                    showRating('300', '#ffcc00');
                    destroyNote(targetNote);
                }
                if (combo > maxCombo) maxCombo = combo;
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

// ФУНКЦИЯ ЗАВЕРШЕНИЯ УРОВНЯ
function endGameAndShowResults() {
    isPlaying = false;
    clearInterval(gameInterval);
    clearInterval(beatInterval);

    // Считаем точность (Accuracy)
    let accuracy = 0;
    if (totalNotesSpawned > 0) {
        // Формула веса точности osu
        accuracy = Math.round(((perfectHits * 300 + (hitNotesCount - perfectHits) * 100) / (totalNotesSpawned * 300)) * 100);
    }
    if (accuracy > 100) accuracy = 100;
    if (accuracy < 0) accuracy = 0;

    // Высчитываем Ранг
    let rank = 'D';
    if (accuracy === 100) rank = 'SS';
    else if (accuracy >= 95) rank = 'S';
    else if (accuracy >= 85) rank = 'A';
    else if (accuracy >= 70) rank = 'B';
    else if (accuracy >= 50) rank = 'C';

    // Подставляем данные на экран результатов
    document.getElementById('res-score').innerText = String(score).padStart(6, '0');
    document.getElementById('res-combo').innerText = maxCombo;
    document.getElementById('res-acc').innerText = accuracy + '%';
    
    const rankEl = document.getElementById('res-rank');
    rankEl.innerText = rank;
    
    // Красим ранг в нужный цвет
    if (rank === 'SS' || rank === 'S') rankEl.style.color = '#ffcc00';
    else if (rank === 'A') rankEl.style.color = '#00ffcc';
    else if (rank === 'B' || rank === 'C') rankEl.style.color = '#ff66aa';
    else rankEl.style.color = '#ff4444';

    // Показываем окно результатов
    document.getElementById('result-screen').style.display = 'flex';
    
    // Чистим ноты
    document.querySelectorAll('.note').forEach(n => n.remove());
}

function closeResults() {
    document.getElementById('result-screen').style.display = 'none';
    resetManiaGame();
}

function togglePauseGame() {
    if (!isPlaying) return;
    const pauseBtn = document.getElementById('pause-game-btn');
    if (!isPaused) {
        isPaused = true;
        pauseBtn.innerText = "Resume";
        if (music) music.pause();
        showRating('PAUSED', '#ffffff');
    } else {
        isPaused = false;
        pauseBtn.innerText = "Pause";
        if (music) music.play().catch(e => {});
    }
}

function resetManiaGame() {
    isPlaying = false;
    isPaused = false;
    score = 0;
    combo = 0;
    maxCombo = 0;
    activeHoldNotes = [null, null, null, null];
    
    clearInterval(gameInterval);
    clearInterval(beatInterval);

    if (music) {
        music.pause();
        music.currentTime = 0;
    }

    document.querySelectorAll('.note').forEach(note => note.remove());
    document.getElementById('result-screen').style.display = 'none';
    document.getElementById('start-game-btn').style.display = 'inline-block';
    document.getElementById('pause-game-btn').style.display = 'none';
    document.getElementById('pause-game-btn').innerText = "Pause";
    document.getElementById('reset-game-btn').style.display = 'none';
    document.getElementById('diff').disabled = false;
    
    updateUI();
}

function createHitEffect(laneIndex) {
    if (!laneElements[laneIndex]) return;
    const effect = document.createElement('div');
    effect.classList.add('hit-effect', `lane-${laneIndex}`);
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