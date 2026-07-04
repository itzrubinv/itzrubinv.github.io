console.log("Osu!mania script loaded successfully!");

let score = 0;
let combo = 0;
let gameInterval;
let noteSpeed = 4; 
let isPlaying = false;

const keys = ['d', 'f', 'j', 'k'];
let laneElements = [];

// Функция старта
function startManiaGame() {
    console.log("Start button clicked!");
    if (isPlaying) return;
    
    // Переопределим элементы тут, чтобы они точно нашлись в DOM
    laneElements = [
        document.getElementById('lane-0'),
        document.getElementById('lane-1'),
        document.getElementById('lane-2'),
        document.getElementById('lane-3')
    ];

    isPlaying = true;
    score = 0;
    combo = 0;
    document.getElementById('score').innerText = '000000';
    document.getElementById('combo').innerText = '0';
    document.getElementById('start-game-btn').style.display = 'none';

    gameInterval = setInterval(() => {
        let randomLane = Math.floor(Math.random() * 4);
        createNote(randomLane);
    }, 600);
}

function createNote(laneIndex) {
    if (!laneElements[laneIndex]) return;
    
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

        if (topPos > 360) {
            clearInterval(noteInterval);
            note.remove();
            showRating('MISS', '#ff4444');
            combo = 0;
            document.getElementById('combo').innerText = combo;
        }
    }, 20);

    note.dataset.intervalId = noteInterval;
}

window.addEventListener('keydown', (e) => {
    if (!isPlaying) return;
    const keyIndex = keys.indexOf(e.key.toLowerCase());
    
    if (keyIndex !== -1) {
        const keyHint = document.getElementById(`key-${keyIndex}`);
        if (keyHint) keyHint.classList.add('active');

        const notesInLane = laneElements[keyIndex] ? laneElements[keyIndex].getElementsByClassName('note') : [];
        if (notesInLane.length > 0) {
            const targetNote = notesInLane[0];
            const noteTop = parseInt(targetNote.style.top);

            if (noteTop >= 310 && noteTop <= 355) {
                score += 300;
                combo++;
                showRating('300', '#ffcc00');
                destroyNote(targetNote);
            } else if (noteTop >= 280 && noteTop < 310) {
                score += 100;
                combo++;
                showRating('100', '#00ffcc');
                destroyNote(targetNote);
            }
        }
    }
});

window.addEventListener('keyup', (e) => {
    const keyIndex = keys.indexOf(e.key.toLowerCase());
    if (keyIndex !== -1) {
        const keyHint = document.getElementById(`key-${keyIndex}`);
        if (keyHint) keyHint.classList.remove('active');
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
    if (!ratingEl) return;
    ratingEl.innerText = text;
    ratingEl.style.color = color;
    ratingEl.style.opacity = 1;
    
    setTimeout(() => {
        ratingEl.style.opacity = 0;
    }, 200);
}