let score = 0;
let combo = 0;
let gameInterval;
let noteSpeed = 4; // Скорость падения нот
let isPlaying = false;

const keys = ['d', 'f', 'j', 'k'];
const laneElements = [
    document.getElementById('lane-0'),
    document.getElementById('lane-1'),
    document.getElementById('lane-2'),
    document.getElementById('lane-3')
];

function startManiaGame() {
    if (isPlaying) return;
    isPlaying = true;
    score = 0;
    combo = 0;
    document.getElementById('score').innerText = '000000';
    document.getElementById('combo').innerText = '0';
    document.getElementById('start-game-btn').style.display = 'none';

    // Спавним ноты каждые 600 миллисекунд
    gameInterval = setInterval(() => {
        let randomLane = Math.floor(Math.random() * 4);
        createNote(randomLane);
    }, 600);
}

function createNote(laneIndex) {
    const note = document.createElement('div');
    note.classList.add('note');
    note.style.top = '0px';
    laneElements[laneIndex].appendChild(note);

    let topPos = 0;
    const noteInterval = setInterval(() => {
        if (!isPlaying) {
            clearInterval(noteInterval);
            note.remove();
            return;
        }

        topPos += noteSpeed;
        note.style.top = topPos + 'px';

        // Если нота улетела за нижний край (Miss)
        if (topPos > 360) {
            clearInterval(noteInterval);
            note.remove();
            showRating('MISS', '#ff4444');
            combo = 0;
            document.getElementById('combo').innerText = combo;
        }
    }, 20);

    // Привязываем интервал к самой ноте, чтобы удалить при нажатии
    note.dataset.intervalId = noteInterval;
}

// Отслеживание нажатий клавиатуры
window.addEventListener('keydown', (e) => {
    if (!isPlaying) return;
    const keyIndex = keys.indexOf(e.key.toLowerCase());
    
    if (keyIndex !== -1) {
        // Подсвечиваем клавишу визуально
        const keyHint = document.getElementById(`key-${keyIndex}`);
        keyHint.classList.add('active');

        // Ищем самую нижнюю ноту на этой дорожке
        const notesInLane = laneElements[keyIndex].getElementsByClassName('note');
        if (notesInLane.length > 0) {
            const targetNote = notesInLane[0];
            const noteTop = parseInt(targetNote.style.top);

            // Проверка попадания в тайминг (зона от 310px до 355px)
            if (noteTop >= 310 && noteTop <= 355) {
                // Идеально (300)
                score += 200;
                combo++;
                showRating('200', '#ffcc00');
                destroyNote(targetNote);
            } else if (noteTop >= 280 && noteTop < 310) {
                // Чуть раньше/позже (100)
                score += 52;
                combo++;
                showRating('200', '#00ffcc');
                destroyNote(targetNote);
            }
        }
    }
});

// Гасим подсветку при отпускании клавиши
window.addEventListener('keyup', (e) => {
    const keyIndex = keys.indexOf(e.key.toLowerCase());
    if (keyIndex !== -1) {
        document.getElementById(`key-${keyIndex}`).classList.remove('active');
    }
});

function destroyNote(note) {
    clearInterval(note.dataset.intervalId);
    note.remove();
    document.getElementById('score').innerText = String(score).padStart(6, '0');
    document.getElementById('combo').innerText = combo;
}

function showRating(text, color) {
    const ratingEl = document.getElementById('hit-rating');
    ratingEl.innerText = text;
    ratingEl.style.color = color;
    ratingEl.style.opacity = 1;
    
    // Скрываем надпись через 200мс
    setTimeout(() => {
        ratingEl.style.opacity = 0;
    }, 200);
}