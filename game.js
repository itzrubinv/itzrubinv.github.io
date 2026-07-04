console.log("Osu!mania: Multi-Layout & Mobile Touch Edition Loaded!");

let score = 0;
let combo = 0;
let maxCombo = 0;
let gameInterval;
let beatInterval;
let isPlaying = false;
let isPaused = false;

// Переменные для Web Audio API спектра
let audioCtx;
let analyser;
let source;
let canvas, canvasCtx;
let animationFrameId;

let totalNotesSpawned = 0;
let hitNotesCount = 0; 
let perfectHits = 0; 

let noteSpeed = 6;      
let currentDiff = 'normal';

// Использование e.code вместо e.key решает проблему с любыми раскладками клавиатуры
const keyCodes = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];
let laneElements = [];
const music = document.getElementById('game-music');
const board = document.querySelector('.mania-board');
const avatar = document.querySelector('.osu-avatar');

let activeHoldNotes = [null, null, null, null];
let isKeyPressed = [false, false, false, false];

// НАСТРОЙКИ ЗВУКА И ТАЙМИНГОВ
let masterVolume = 1.0;
let effectsVolume = 1.0;
let audioOffset = 0; 

// Переключение видимости панели настроек
function toggleSettings() {
    const sidebar = document.getElementById('settings-sidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
}

// Обновление значений громкости и офсета
function updateVolumeSettings() {
    const masterSlider = document.getElementById('volume-master');
    const effectsSlider = document.getElementById('volume-effects');
    const offsetSlider = document.getElementById('audio-offset');

    if (masterSlider) {
        masterVolume = masterSlider.value / 100;
        document.getElementById('val-volume-master').innerText = masterSlider.value + '%';
        if (music) music.volume = masterVolume;
    }
    
    if (effectsSlider) {
        effectsVolume = effectsSlider.value / 100;
        document.getElementById('val-volume-effects').innerText = effectsSlider.value + '%';
    }

    if (offsetSlider) {
        audioOffset = parseInt(offsetSlider.value);
        document.getElementById('val-audio-offset').innerText = (audioOffset > 0 ? '+' : '') + audioOffset + ' ms';
    }
}

// Воспроизведение звуков
function playSound(soundId) {
    const sound = document.getElementById(soundId);
    if (sound) {
        sound.currentTime = 0;
        sound.volume = effectsVolume;
        sound.play().catch(e => console.log("Sound play prevented by browser policy"));
    }
}

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
        music.volume = masterVolume;
        initVisualizer();
        music.play().catch(e => console.log("Audio play deferred setup"));
        
        music.onended = () => {
            endGameAndShowResults();
        };
    }

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

    let intervalTime = currentDiff === 'hard' ? 250 : 500;
    gameInterval = setInterval(() => {
        if (isPaused) return;
        let randomLane = Math.floor(Math.random() * 4);
        let isHold = Math.random() > 0.80;
        createNote(randomLane, isHold);
        totalNotesSpawned++;
    }, intervalTime);
}

// ИНИЦИАЛИЗАЦИЯ И ОТРИСОВКА ЭКВАЛАЙЗЕРА
function initVisualizer() {
    canvas = document.getElementById('visualizer-canvas');
    if (!canvas) return;
    canvasCtx = canvas.getContext('2d');

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        source = audioCtx.createMediaElementSource(music);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
    }

    analyser.fftSize = 64; 
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
        if (!isPlaying) return;
        animationFrameId = requestAnimationFrame(draw);
        if (isPaused) return;

        analyser.getByteFrequencyData(dataArray);
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 1.4;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i] * 1.2; 

            let gradient = canvasCtx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
            gradient.addColorStop(0, '#4a152d'); 
            gradient.addColorStop(1, '#23003b'); 

            canvasCtx.fillStyle = gradient;
            canvasCtx.fillRect(x, canvas.height - barHeight, barWidth - 3, barHeight);
            x += barWidth;
        }
    }

    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    draw();
}

function createNote(laneIndex, isHold) {
    if (!laneElements[laneIndex]) return;
    
    const note = document.createElement('div');
    note.classList.add('note');
    
    let noteHeight = 30; 
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
            playSound('miss-sound');
            combo = 0;
            updateUI();
        }
    }, 20);

    note.dataset.intervalId = noteInterval;
    note.dataset.isHold = isHold;
    note.dataset.height = noteHeight;
}

// Единая логика для обработки нажатия (клавиатура или тач)
function triggerLanePress(keyIndex) {
    if (keyIndex === -1 || isKeyPressed[keyIndex]) return;
    isKeyPressed[keyIndex] = true;

    const keyHint = document.getElementById(`key-${keyIndex}`);
    if (keyHint) keyHint.classList.add('active');

    const notesInLane = laneElements[keyIndex] ? laneElements[keyIndex].getElementsByClassName('note') : [];
    if (notesInLane.length > 0) {
        const targetNote = notesInLane[0];
        
        if (targetNote.classList.contains('fade-out-hold')) return;

        const noteTop = parseInt(targetNote.style.top);
        const isHold = targetNote.dataset.isHold === "true";
        const noteHeight = parseInt(targetNote.dataset.height);
        const hitHitbox = noteTop + noteHeight;

        let adjustedHitbox = hitHitbox + (audioOffset / 20);

        // Хитбокс немного расширен для удобства тач-ввода (330-410 вместо 340-400)
        if (adjustedHitbox >= 330 && adjustedHitbox <= 410) {
            createHitEffect(keyIndex);
            hitNotesCount++;

            if (isHold) {
                activeHoldNotes[keyIndex] = targetNote;
                score += 100;
                combo++;
                showRating('HOLD!', '#00ffcc');
                playSound('hit-sound');
            } else {
                perfectHits++;
                score += 300;
                combo++;
                showRating('300', '#ffcc00');
                playSound('hit-sound');
                destroyNote(targetNote);
            }
            if (combo > maxCombo) maxCombo = combo;
            updateUI();
        }
    }
}

// Единая логика для обработки отпускания (клавиатура или тач)
function triggerLaneRelease(keyIndex) {
    if (keyIndex === -1) return;
    isKeyPressed[keyIndex] = false;

    const keyHint = document.getElementById(`key-${keyIndex}`);
    if (keyHint) keyHint.classList.remove('active');

    if (activeHoldNotes[keyIndex]) {
        const note = activeHoldNotes[keyIndex];
        activeHoldNotes[keyIndex] = null;
        
        clearInterval(note.dataset.intervalId);
        note.classList.add('fade-out-hold');
        createHitEffect(keyIndex); 
        playSound('hit-sound');   
        
        setTimeout(() => {
            note.remove();
        }, 250);
        
        showRating('RELEASE!', '#b500ff');
        updateUI();
    }
}

// --- СЛУШАТЕЛИ КЛАВИАТУРЫ ---
window.addEventListener('keydown', (e) => {
    if (!isPlaying || isPaused) return;
    const keyIndex = keyCodes.indexOf(e.code); // Проверка физического кода клавиши
    triggerLanePress(keyIndex);
});

window.addEventListener('keyup', (e) => {
    const keyIndex = keyCodes.indexOf(e.code);
    triggerLaneRelease(keyIndex);
});

// --- СЛУШАТЕЛИ ТАЧ-ИНТЕРФЕЙСА (МОБИЛКИ) ---
document.querySelectorAll('.key-hint').forEach(button => {
    const laneIndex = parseInt(button.getAttribute('data-lane'));

    // Обработка касания экрана пальцем
    button.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Предотвращаем симуляцию клика мышкой и зум
        if (!isPlaying || isPaused) return;
        triggerLanePress(laneIndex);
    }, { passive: false });

    // Обработка отпускания пальца
    button.addEventListener('touchend', (e) => {
        e.preventDefault();
        triggerLaneRelease(laneIndex);
    }, { passive: false });
    
    button.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        triggerLaneRelease(laneIndex);
    }, { passive: false });
});

function endGameAndShowResults() {
    isPlaying = false;
    clearInterval(gameInterval);
    clearInterval(beatInterval);
    cancelAnimationFrame(animationFrameId);

    let accuracy = 0;
    if (totalNotesSpawned > 0) {
        accuracy = Math.round(((perfectHits * 300 + (hitNotesCount - perfectHits) * 100) / (totalNotesSpawned * 300)) * 100);
    }
    if (accuracy > 100) accuracy = 100;
    if (accuracy < 0) accuracy = 0;

    let rank = 'D';
    if (accuracy === 100) rank = 'SS';
    else if (accuracy >= 95) rank = 'S';
    else if (accuracy >= 85) rank = 'A';
    else if (accuracy >= 70) rank = 'B';
    else if (accuracy >= 50) rank = 'C';

    document.getElementById('res-score').innerText = String(score).padStart(6, '0');
    document.getElementById('res-combo').innerText = maxCombo;
    document.getElementById('res-acc').innerText = accuracy + '%';
    
    const rankEl = document.getElementById('res-rank');
    rankEl.innerText = rank;
    
    if (rank === 'SS' || rank === 'S') rankEl.style.color = '#ffcc00';
    else if (rank === 'A') rankEl.style.color = '#00ffcc';
    else if (rank === 'B' || rank === 'C') rankEl.style.color = '#ff66aa';
    else rankEl.style.color = '#ff4444';

    document.getElementById('result-screen').style.display = 'flex';
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
    isKeyPressed = [false, false, false, false];
    
    clearInterval(gameInterval);
    clearInterval(beatInterval);
    cancelAnimationFrame(animationFrameId);

    if (music) {
        music.pause();
        music.currentTime = 0;
    }

    if (canvasCtx) {
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    }

    const flashOverlay = document.getElementById('combo-flash-overlay');
    if (flashOverlay) flashOverlay.className = 'combo-flash-overlay';

    document.querySelectorAll('.note').forEach(note => note.remove());
    document.querySelectorAll('.key-hint').forEach(kh => kh.classList.remove('active'));
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

    const flashOverlay = document.getElementById('combo-flash-overlay');
    if (flashOverlay) {
        flashOverlay.className = 'combo-flash-overlay';

        if (combo === 10) {
            void flashOverlay.offsetWidth; 
            flashOverlay.classList.add('flash-combo-10');
        } else if (combo === 50) {
            void flashOverlay.offsetWidth;
            flashOverlay.classList.add('flash-combo-50');
        } else if (combo === 100 || combo === 200 || combo === 300) {
            void flashOverlay.offsetWidth;
            flashOverlay.classList.add('flash-combo-100');
        }
    }
}

function showRating(text, color) {
    const ratingEl = document.getElementById('hit-rating');
    if (!ratingEl) return;
    ratingEl.innerText = text;
    ratingEl.style.color = color;
    ratingEl.style.opacity = 1;
    setTimeout(() => { ratingEl.style.opacity = 0; }, 250);
}