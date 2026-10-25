// Filnavn: content_analyzer_main.js
// Kører i MAIN world - aflæser kun globale window-variabler fra spil-engines

function checkMainWorldGlobals() {
    try {
        const hasPureGameEngine = Boolean(
            window.unityInstance ||
            window.RufflePlayer ||
            window.pico8_buttons ||
            window.Phaser ||
            window.PlayCanvas
        );

        // Generelle grafik-/lydbiblioteker tæller lavere, da de også bruges i reklamer og undervisning
        const hasMediaLib = Boolean(
            window.PIXI ||
            window.createjs ||
            window.Howl
        );

        if (hasPureGameEngine || hasMediaLib) {
            console.log('[LetSpær:MainWorld] Opdagede globale biblioteker i window:', {
                pureGameEngine: hasPureGameEngine,
                mediaLib: hasMediaLib
            });
            document.dispatchEvent(new CustomEvent('NetShieldMainProbe', {
                detail: {
                    hasPureGameEngine: hasPureGameEngine,
                    hasMediaLib: hasMediaLib
                }
            }));
        }
    } catch (e) {}
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkMainWorldGlobals);
} else {
    checkMainWorldGlobals();
}

window.addEventListener('load', checkMainWorldGlobals);
setTimeout(checkMainWorldGlobals, 3000);
setTimeout(checkMainWorldGlobals, 7000);