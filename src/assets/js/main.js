document.addEventListener("DOMContentLoaded", function() {
    let game = new Game();
    window.game = game; // expose globally for SFX callbacks
    console.log("loaded!");
    game.start();

    // Toggle pause with 'P'
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            game.togglePause();
        }
    });
})

