console.log("Osu!mania: Multi-Layout & Mobile Touch Edition Loaded!");

let score = 0;
let combo = 0;
let maxCombo = 0;
let gameInterval;
let beatInterval;
let isPlaying = false;
let isPaused = false;

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

const keyCodes = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];
let laneElements = [];
const music = document.getElementById('game-music');
const board = document.querySelector('.mania-board');
const avatar = document.querySelector('.osu-avatar');

let activeHoldNotes = [null, null, null, null];
let isKeyPressed = [false, false, false, false];

let masterVolume = 1.0;
let effectsVolume = 1.0;
let audioOffset = 0; 

// Привязка событий после загрузки документа
document.addEventListener('DOMContentLoaded', () => {
    // Загрузка сохраненного рекорда
    updateHighScoreUI();

    document.getElementById('settings-toggle-btn').addEventListener('click', toggleSettings);
    document.getElementById('settings-close-x').addEventListener('click', toggleSettings);
    
    document.getElementById('volume-master').addEventListener('input', updateVolumeSettings);
    document.getElementById('volume-effects').addEventListener('input', updateVolumeSettings);
    document.getElementById('audio-offset').addEventListener('input', updateVolumeSettings);
    
    document.getElementById('diff').addEventListener('change', changeDifficulty);
    document.getElementById('start-game-btn').addEventListener('click', startManiaGame);
    document.getElementById('pause-game-btn').addEventListener('click', togglePauseGame);
    document.getElementById('reset-game-btn').addEventListener('click', resetManiaGame);
    document.getElementById('result-close-btn').addEventListener('click', closeResults);

    // Инициализация тач-событий для мобилок
    document.querySelectorAll('.key-hint').forEach(button => {
        const laneIndex = parseInt(button.getAttribute('data-lane'));

        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!isPlaying || isPaused) return;
            triggerLanePress(laneIndex);
        }, { passive: false });

        button.addEventListener('touchend', (e) => {
            e.preventDefault();
            triggerLaneRelease(laneIndex);
        }, { passive: false });
        
        button.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            triggerLaneRelease(laneIndex);
        }, { passive: false });
    });
});

function toggleSettings() {
    const sidebar = document.getElementById('settings-sidebar');
    if (sidebar) sidebar.classList.toggle('open');
}

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

function playSound(soundId) {
    const sound = document.getElementById(soundId);
    if (sound) {
        sound.currentTime = 0;
        sound.volume = effectsVolume;
        sound.play().catch(e => {});
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
        music.play().catch(e => {});
        music.onended = () => { endGameAndShowResults(); };
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
    if (audioCtx.state === 'suspended') audioCtx.resume();
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
        setTimeout(() => { note.remove(); }, 250);
        
        showRating('RELEASE!', '#b500ff');
        updateUI();
    }
}

window.addEventListener('keydown', (e) => {
    if (!isPlaying || isPaused) return;
    const keyIndex = keyCodes.indexOf(e.code);
    triggerLanePress(keyIndex);
});

window.addEventListener('keyup', (e) => {
    const keyIndex = keyCodes.indexOf(e.code);
    triggerLaneRelease(keyIndex);
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

    // Сохраняем личный рекорд при финише игры
    checkAndUpdateHighScore(score, maxCombo);

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
    if (canvasCtx) canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

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

// --- ЛОГИКА ТАБЛИЦЫ РЕКОРДОВ (LOCALSTORAGE) ---
function updateHighScoreUI() {
    const savedScore = localStorage.getItem("osu_best_score") || 0;
    const savedCombo = localStorage.getItem("osu_best_combo") || 0;
    
    const scoreElem = document.getElementById("best-score");
    const comboElem = document.getElementById("best-combo");
    
    if (scoreElem) scoreElem.textContent = savedScore;
    if (comboElem) comboElem.textContent = savedCombo;
}

function checkAndUpdateHighScore(currentScore, currentCombo) {
    const savedScore = parseInt(localStorage.getItem("osu_best_score") || 0);
    const savedCombo = parseInt(localStorage.getItem("osu_best_combo") || 0);

    if (currentScore > savedScore) {
        localStorage.setItem("osu_best_score", currentScore);
    }

    if (currentCombo > savedCombo) {
        localStorage.setItem("osu_best_combo", currentCombo);
    }

    updateHighScoreUI();
}

// --- ЛОГИКА ШТОРКИ ИГРЫ ---
const gameSidebar = document.getElementById('game-sidebar');
const gameToggleBtn = document.getElementById('game-toggle-btn');
const gameCloseX = document.getElementById('game-close-x');

// Открыть игру
gameToggleBtn.addEventListener('click', () => {
    gameSidebar.classList.add('open');
});

// Закрыть игру
gameCloseX.addEventListener('click', () => {
    gameSidebar.classList.remove('open');
});

// --- ЛОГИКА ИЗМЕНЕНИЯ РАЗМЕРА ИГРЫ (МАСШТАБИРОВАНИЕ) ---
const resizableGame = document.getElementById('resizable-game');
const sizeDecreaseBtn = document.getElementById('size-decrease-btn');
const sizeIncreaseBtn = document.getElementById('size-increase-btn');
const sizeResetBtn = document.getElementById('size-reset-btn');

// Текущий масштаб (1 = 100%)
let currentScale = parseFloat(localStorage.getItem('game-scale')) || 1.0;

// Функция применения размера
function applyGameScale(scale) {
    resizableGame.style.transform = `scale(${scale})`;
    sizeResetBtn.textContent = `${Math.round(scale * 100)}%`;
    localStorage.setItem('game-scale', scale);
}

// Применяем сохраненный масштаб при загрузке
applyGameScale(currentScale);

// Кнопка "+"
sizeIncreaseBtn.addEventListener('click', () => {
    if (currentScale < 1.5) { // Ограничим максимум до 150%, чтоб за экран не вылезало
        currentScale += 0.1;
        applyGameScale(currentScale);
    }
});

// Кнопка "-"
sizeDecreaseBtn.addEventListener('click', () => {
    if (currentScale > 0.7) { // Ограничим минимум до 70%
        currentScale -= 0.1;
        applyGameScale(currentScale);
    }
});

// Кнопка "Сброс"
sizeResetBtn.addEventListener('click', () => {
    currentScale = 1.0;
    applyGameScale(currentScale);
});

// Находим элементы управления фоном
const bgUploader = document.getElementById('bg-uploader');
const bgResetBtn = document.getElementById('bg-reset-btn');

// 1. Проверяем, сохранен ли фон в браузере с прошлого раза
const savedBg = localStorage.getItem('custom-background');
if (savedBg) {
    applyBackground(savedBg);
}

// Функция для накатывания фона на страницу
function applyBackground(base64Data) {
    document.body.style.backgroundImage = `url(${base64Data})`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundAttachment = 'fixed';
    document.body.style.backgroundRepeat = 'no-repeat';
}

// 2. Слушаем изменение инпута (когда пользователь выбрал файл)
if (bgUploader) {
    bgUploader.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            const base64Image = event.target.result;
            
            try {
                // Сохраняем строку в локальную память
                localStorage.setItem('custom-background', base64Image);
                // Применяем
                applyBackground(base64Image);
            } catch (error) {
                alert('Картинка весит слишком много! Попробуй сжать её или взять файл поменьше.');
            }
        };
        
        // Читаем файл как строку Base64
        reader.readAsDataURL(file);
    });
}

// 3. Сброс фона к дефолтному
if (bgResetBtn) {
    bgResetBtn.addEventListener('click', () => {
        localStorage.removeItem('custom-background');
        document.body.style.backgroundImage = 'none';
        document.body.style.backgroundColor = '#121014'; // Возвращаем твой цвет
        if (bgUploader) bgUploader.value = ''; // Сбрасываем имя файла в инпуте
    });
}
// --- DISCORD LANYARD INTEGRATION ---
const DISCORD_ID = "935086307401695293";

async function fetchDiscordStatus() {
    try {
        const response = await fetch(`https://api.lanyard.rest/v1/users/${DISCORD_ID}`);
        const data = await response.json();

        if (!data.success) return;

        const lanyard = data.data;
        const dot = document.getElementById('discord-dot');
        const customStatusElem = document.getElementById('discord-custom-status');
        const activityElem = document.getElementById('discord-activity');

        // 1. Обновляем индикатор сети
        dot.className = `status-dot ${lanyard.discord_status}`;

        // 2. Активность или кастомный статус
        if (lanyard.listening_to_spotify) {
            customStatusElem.innerText = `🎧 Слушает Spotify`;
            activityElem.innerText = `${lanyard.spotify.song} — ${lanyard.spotify.artist}`;
        } else if (lanyard.activities && lanyard.activities.length > 0) {
            // Берем первую активность (игру)
            const game = lanyard.activities.find(act => act.type === 0) || lanyard.activities[0];
            
            if (game.type === 4) { // Пользовательский статус
                customStatusElem.innerText = game.state || "В сети";
                activityElem.innerText = "";
            } else {
                customStatusElem.innerText = `🎮 Играет в ${game.name}`;
                activityElem.innerText = game.details || game.state || "";
            }
        } else {
            const statusMap = {
                online: "В сети",
                idle: "Неактивен",
                dnd: "Не беспокоить",
                offline: "Не в сети"
            };
            customStatusElem.innerText = statusMap[lanyard.discord_status] || "Оффлайн";
            activityElem.innerText = "";
        }
    } catch (err) {
        console.error("Ошибка загрузки Lanyard:", err);
    }
}

// Запрашиваем статус сразу при загрузке и обновляем каждые 15 секунд
document.addEventListener("DOMContentLoaded", () => {
    fetchDiscordStatus();
    setInterval(fetchDiscordStatus, 15000);
});
// --- ИНТЕРАКТИВНЫЕ ЧАСТИЦЫ НА ФОНЕ ---
(function initBackgroundParticles() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let particles = [];
    const particleCount = 60; // Количество частиц (можно увеличить или уменьшить)
    let mouse = { x: null, y: null, radius: 120 };

    // Отслеживаем движение мыши
    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });

    // Автоматический ресайз при изменении окна
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Класс отдельной частицы
    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2.5 + 1;
            this.baseX = this.x;
            this.baseY = this.y;
            this.speedX = (Math.random() - 0.5) * 0.6;
            this.speedY = (Math.random() - 0.5) * 0.6;
            // Палитра неоновых оттенков под стиль сайта
            const colors = ['#ff66aa', '#00ffcc', '#b500ff', '#ffcc00'];
            this.color = colors[Math.floor(Math.random() * colors.length)];
            this.alpha = Math.random() * 0.6 + 0.2;
        }

        draw() {
            ctx.save();
            ctx.globalAlpha = this.alpha;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color;
            ctx.fill();
            ctx.restore();
        }

        update() {
            // Движение частиц по умолчанию
            this.x += this.speedX;
            this.y += this.speedY;

            // Возврат в границы экрана
            if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
            if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;

            // Взаимодействие с курсором мыши (отталкивание)
            if (mouse.x !== null && mouse.y !== null) {
                let dx = mouse.x - this.x;
                let dy = mouse.y - this.y;
                let distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < mouse.radius) {
                    let force = (mouse.radius - distance) / mouse.radius;
                    let directionX = dx / distance;
                    let directionY = dy / distance;
                    this.x -= directionX * force * 3;
                    this.y -= directionY * force * 3;
                }
            }
        }
    }

    // Создаем частицы
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }

    // Главный цикл анимации
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        requestAnimationFrame(animate);
    }

    animate();
})();
// --- 2. ЛОГИКА КАСТОМНОГО КУРСОРA ---
(function initCustomCursor() {
    const cursor = document.getElementById('custom-cursor');
    if (!cursor) return;

    // Движение курсора за мышкой
    window.addEventListener('mousemove', (e) => {
        cursor.style.left = `${e.clientX}px`;
        cursor.style.top = `${e.clientY}px`;
    });

    // Увеличение курсора при наведении на кнопки, ссылки и инпуты
    const interactiveElements = document.querySelectorAll('a, button, input, select, .glowing-name');
    interactiveElements.forEach(el => {
        el.addEventListener('mouseenter', () => cursor.classList.add('hovered'));
        el.addEventListener('mouseleave', () => cursor.classList.remove('hovered'));
    });
})();

// --- 3. 3D TILT-ЭФФЕКТ ДЛЯ КАРТОЧКИ ПРОФИЛЯ ---
(function initCardTilt() {
    const card = document.querySelector('.profile-container');
    if (!card) return;

    window.addEventListener('mousemove', (e) => {
        // Вычисляем центр экрана
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        // Отклонение курсора от центра
        const mouseX = e.clientX - centerX;
        const mouseY = e.clientY - centerY;

        // Угол наклона (чем меньше делитель, тем сильнее наклон)
        const rotateX = (-mouseY / centerY) * 8; // макс. 8 градусов по X
        const rotateY = (mouseX / centerX) * 8;   // макс. 8 градусов по Y

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    // Возвращаем карточку в исходное положение, если мышка ушла с окна
    document.addEventListener('mouseleave', () => {
        card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg)`;
    });
})();