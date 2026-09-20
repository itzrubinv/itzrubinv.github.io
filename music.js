(function initMusicPlayer() {
    function setup() {
        const audio = document.getElementById('bg-audio');
        const widget = document.getElementById('music-widget');
        const text = widget ? widget.querySelector('.music-text') : null;

        if (!audio || !widget) return;

        audio.volume = 0.3; // Громкость 30%

        widget.addEventListener('click', async () => {
            if (audio.paused) {
                try {
                    await audio.play();
                    widget.classList.add('playing');
                    if (text) text.textContent = 'Music ON';
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