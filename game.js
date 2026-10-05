// --- 1. ФОНОВЫЕ ИЗОБРАЖЕНИЯ (ПОЛЬЗОВАТЕЛЬСКИЙ ФОН) ---
function applyBackground(base64Data) {
    document.body.style.backgroundImage = `url(${base64Data})`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundAttachment = 'fixed';
    document.body.style.backgroundRepeat = 'no-repeat';
}

// Загрузка сохраненного фона при старте
document.addEventListener('DOMContentLoaded', () => {
    const savedBg = localStorage.getItem('custom-background');
    if (savedBg) applyBackground(savedBg);
});

const bgUploader = document.getElementById('bg-uploader');
const bgResetBtn = document.getElementById('bg-reset');

if (bgUploader) {
    bgUploader.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            const base64Image = event.target.result;
            try {
                localStorage.setItem('custom-background', base64Image);
                applyBackground(base64Image);
            } catch (error) {
                alert('Картинка весит слишком много! Попробуй сжать её или взять файл поменьше.');
            }
        };
        reader.readAsDataURL(file);
    });
}

if (bgResetBtn) {
    bgResetBtn.addEventListener('click', () => {
        localStorage.removeItem('custom-background');
        document.body.style.backgroundImage = 'none';
        document.body.style.backgroundColor = '#121014';
        if (bgUploader) bgUploader.value = '';
    });
}

// --- 2. DISCORD LANYARD INTEGRATION ---
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

        if (dot) dot.className = `status-dot ${lanyard.discord_status}`;

        if (customStatusElem && activityElem) {
            if (lanyard.listening_to_spotify) {
                customStatusElem.innerText = "🎧 Слушает Spotify";
                activityElem.innerText = `\({lanyard.spotify.song} —\){lanyard.spotify.artist}`;
            } else if (lanyard.activities && lanyard.activities.length > 0) {
                const game = lanyard.activities.find(act => act.type === 0) || lanyard.activities[0];
                if (game.type === 4) {
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
        }
    } catch (err) {
        console.error("Ошибка загрузки Lanyard:", err);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    fetchDiscordStatus();
    setInterval(fetchDiscordStatus, 15000);
});

// --- 3. КАСТОМНЫЙ КУРСОР ---
(function initCustomCursor() {
    const cursor = document.getElementById('custom-cursor');
    if (!cursor) return;

    window.addEventListener('mousemove', (e) => {
        cursor.style.left = `${e.clientX}px`;
        cursor.style.top = `${e.clientY}px`;
    });

    const interactiveElements = document.querySelectorAll('a, button, input, select, .glowing-name');
    interactiveElements.forEach(el => {
        el.addEventListener('mouseenter', () => cursor.classList.add('hovered'));
        el.addEventListener('mouseleave', () => cursor.classList.remove('hovered'));
    });
})();

// --- 4. 3D TILT ЭФФЕКТ КАРТОЧКИ ---
(function initCardTilt() {
    const card = document.querySelector('.profile-container');
    const isDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!card || !isDesktop) return;

    window.addEventListener('mousemove', (e) => {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        const mouseX = e.clientX - centerX;
        const mouseY = e.clientY - centerY;

        const rotateX = (-mouseY / centerY) * 8;
        const rotateY = (mouseX / centerX) * 8;

        card.style.transform = `perspective(1000px) rotateX(\({rotateX}deg) rotateY(\){rotateY}deg)`;
    });

    document.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
    });
})();

// --- 5. УПРАВЛЕНИЕ ФОНОВОЙ МУЗЫКОЙ ---
(function initMusicPlayer() {
    function setup() {
        const audio = document.getElementById('bg-audio');
        const widget = document.getElementById('music-widget');
        const text = widget ? widget.querySelector('.music-text') : null;

        if (!audio || !widget) return;

        audio.volume = 0.3;

        widget.addEventListener('click', async () => {
            if (audio.paused) {
                try {
                    await audio.play();
                    widget.classList.add('playing');
                    if (text) text.textContent = 'Music ON';
                    console.log("Музыка успешно заиграла!");
                } catch (err) {
                    console.error("Ошибка при воспроизведении:", err);
                    if (text) text.textContent = 'Error';
                }
            } else {
                audio.pause();
                widget.classList.remove('playing');
                if (text) text.textContent = 'Music OFF';
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setup);
    } else {
        setup();
    }
})();