function reportViolation(reason) {
    if (reason !== "game") return;
    try {
        document.dispatchEvent(new CustomEvent('NetShieldViolation', { detail: { reason: reason } }));
    } catch(e) {}
}

function runFastScanners() {
    if (window.netshieldHasBlocked) return; 

    let gameScore = 0;
    const pageTitle = (document.title || "").toLowerCase();
    const pageUrl = window.location.href.toLowerCase();
    const hostname = window.location.hostname.toLowerCase();
    const pageText = (document.body ? document.body.innerText.substring(0, 15000).toLowerCase() : "");
    const metaDesc = document.querySelector('meta[name="description"]')?.content?.toLowerCase() || "";
    const metaKeywords = document.querySelector('meta[name="keywords"]')?.content?.toLowerCase() || "";
    const allHTML = (document.documentElement?.innerHTML || "").substring(0, 30000).toLowerCase();

    const gameUrlKWs = ['unblocked games', 'games 66', 'games 77', 'games 99', 'io game', 'unblocked spil', 'gratis spil', 'free games', 'html5 game'];
    gameUrlKWs.forEach(kw => {
        if (pageUrl.includes(kw) || pageTitle.includes(kw)) gameScore += 3;
    });

    const gameNames = ['slope', 'retro bowl', '1v1.lol', 'drift hunters', 'cookie clicker', 'subway surfers', 'flappy bird', 'tetris', 'snake game', 'crossy road', '2048', 'run 3', 'fnaf', 'geometry dash', 'moto x3m', 'happy wheels', 'basketball stars', 'shell shockers', 'krunker'];
    gameNames.forEach(name => { if (pageTitle.includes(name)) gameScore += 3; });

    const hasCanvas = document.querySelector('canvas');
    const hasEmbed = document.querySelector('embed');
    const hasObject = document.querySelector('object');
    if (hasCanvas || hasEmbed || hasObject) gameScore += 3;

    if (hasCanvas) {
        try {
            const gl = hasCanvas.getContext('webgl') || hasCanvas.getContext('webgl2') || hasCanvas.getContext('experimental-webgl');
            if (gl) gameScore += 2;
        } catch(e) {}
    }

    if (window.unityInstance || document.getElementById('unity-canvas') || window.RufflePlayer || window.pico8_buttons || window.Phaser || window.PIXI || window.createjs || window.Howl || window.PlayCanvas) gameScore += 6;
    
    const scriptSrcs = Array.from(document.querySelectorAll('script[src]')).map(s => s.src.toLowerCase());
    const gameScripts = ['ruffle.js', 'unity.loader.js', 'unityweb', 'playcanvas', 'phaser.min.js', 'phaser.js', 'pixi.min.js', 'pixi.js', 'construct', 'gdjs', 'pico-8', 'emscripten', 'gamemaker', 'babylonjs', 'three.min.js'];
    gameScripts.forEach(gs => {
        if (scriptSrcs.some(src => src.includes(gs))) gameScore += 5;
    });

    const seoWords = ["friv", "unblocked games", "free online games", "play now for free", "addicting games", "io games", "best free games", "jogos", "y9 games", "y8 games", "spil gratis onlinespil", "play game online", "play free games", "browser games", "html5 games"];
    seoWords.forEach(word => { if (pageTitle.includes(word) || metaDesc.includes(word) || metaKeywords.includes(word)) gameScore += 10; });
    
    const behaviorWords = ['controls:', 'wasd', 'arrow keys', 'press spacebar', 'play fullscreen', 'click to play', 'tap to start', 'press enter to start', 'move with', 'left click to shoot'];
    behaviorWords.forEach(bw => { if (pageText.includes(bw)) gameScore += 2; });

    if (metaKeywords.includes("game") && metaKeywords.includes("play") && metaKeywords.includes("online")) gameScore += 5;

    if (hostname.endsWith('github.io') || hostname.endsWith('netlify.app') || hostname.endsWith('vercel.app') || hostname.endsWith('pages.dev')) {
        const deployGameKWs = ['game', 'play', 'unblocked', 'retro', 'emulator', 'arcade', 'nes', 'snes', 'gba'];
        deployGameKWs.forEach(kw => {
            if (pageTitle.includes(kw) || pageUrl.includes(kw)) gameScore += 3;
        });
    }

    let sitesScore = 0;
    if (hostname === 'sites.google.com') {
        if (document.querySelectorAll('iframe').length > 5) sitesScore += 5;
        if (pageTitle.includes('games') || pageTitle.includes('unblocked') || pageTitle.includes('proxy')) sitesScore += 3;
        const gameMenuKWs = ['gmes', 'g𝙖mes', 'unblocked', 'unblσcked', 'prσxy', 'prοxy', 'g4mes', 'gam3s', 'unblocke', 'pr0xy'];
        document.querySelectorAll('a').forEach(a => {
            const t = (a.textContent || "").toLowerCase();
            const href = (a.href || "").toLowerCase();
            gameMenuKWs.forEach(kw => { if (t.includes(kw) || href.includes(kw)) sitesScore += 4; });
        });
    }

    if (gameScore >= 5 || sitesScore >= 5) {
        window.netshieldHasBlocked = true;
        reportViolation("game");
    }
}

function startIframeMonitor() {
    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.nodeName === 'IFRAME') {
                    const src = (node.src || '').toLowerCase();
                    if (src === 'about:blank' || src === '' || src.includes('game') || src.includes('play')) {
                        setTimeout(runFastScanners, 1000);
                    }
                }
            }
        }
    });
    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    }
}

function isSafeSchoolSite() {
    const coreSchoolSites = [
        'aula.dk', 'lectio.dk',
        'drive.google.com', 'docs.google.com', 'slides.google.com', 'classroom.google.com',
        'matematikfessor.dk', 'nota.dk', 'grammatip.com', 'ordbogen.com',
        'skoletube.dk', 'gyldendal-uddannelse.dk', 'gyldendal.dk', 'clio.me', 'clioonline.dk', 'systime.dk',
        'accounts.google.com', 'testogprøver.dk', 'skoleporten.dk', 'minuddannelse.dk',
        'restudy.dk', 'sofaskolen.dk', 'emu.dk', 'skolon.com', 'alinea.dk',
        'meebook.com', 'easyiq.dk', 'unilogin.dk', 'mitid.dk',
        'forms.google.com', 'sheets.google.com', 'keep.google.com',
        'mail.google.com', 'meet.google.com', 'calendar.google.com',
        'kahoot.com', 'quizlet.com', 'geogebra.org', 'code.org',
        'wikipedia.org', 'dr.dk', 'denstoredanske.lex.dk', 'duda.dk'
    ];
    
    const h = window.location.hostname;
    if (coreSchoolSites.some(site => h.includes(site))) return true;
    
    if (document.referrer) {
        try {
            const refHost = new URL(document.referrer).hostname;
            if (coreSchoolSites.some(site => refHost.includes(site))) return true;
        } catch (e) {}
    }
    return false;
}

if (!isSafeSchoolSite()) {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            runFastScanners();
            startIframeMonitor();
        });
    } else {
        runFastScanners();
        startIframeMonitor();
    }
    
    window.addEventListener('load', () => {
        runFastScanners();
    });

    setTimeout(() => {
        runFastScanners();
    }, 3000);
    setTimeout(() => {
        runFastScanners();
    }, 7000);
}
