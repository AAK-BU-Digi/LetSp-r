// Filnavn: content_analyzer.js
// Kører i ISOLATED world - beskyttet mod manipulation fra hjemmesiden
// letspaerIsEducationService kommer fra education-list.js og LetSpaerLog fra debug.js,
// som begge indlæses før denne fil.

const GAME_THRESHOLD = 5;

let hasBlocked = false;
let scannerEnabled = false; // Sættes først, når listen over undervisningstjenester er tjekket
let scanningStarted = false;
let isEducationService = false;
// gameDetectionMode fra Admin-konsollen: 'block' (standard), 'log' (analyser uden at blokere) eller 'off'
let detectionMode = 'block';
let detectedPureGameEngine = false;
let detectedMediaLib = false;

// Seneste resultat for denne ramme. Ligger kun i hukommelsen og gemmes ingen steder;
// det udleveres kun til LetSpær-popuppen, når debugLogging er slået til.
let diagnostics = { status: 'pending', score: undefined, signals: [] };

function safePageUrl() {
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    return location.hostname + (location.pathname === '/' ? '' : location.pathname);
  }
  return location.protocol.replace(':', '');
}

// Lyt efter signaler fra content_analyzer_main.js (kun opgradering til true er mulig)
document.addEventListener('NetShieldMainProbe', (e) => {
  if (e.detail?.hasPureGameEngine) detectedPureGameEngine = true;
  if (e.detail?.hasMediaLib) detectedMediaLib = true;
  if (scannerEnabled) runFastScanners();
});

function reportViolation(reason, score, signals) {
  if (reason !== 'game' || hasBlocked) return;
  hasBlocked = true;
  try {
    chrome.runtime.sendMessage(
      { action: 'violationDetected', reason, score, signals, page: safePageUrl() },
      (response) => {
        if (chrome.runtime.lastError) return;
        // Undtaget fordi fanen eller rammen er en undervisningstjeneste
        if (response && response.action === 'ignore') {
          diagnostics.status = 'ignored_education';
        }
        // Hvis dette er en iframe på en almindelig side, erstatter vi kun selve iframen
        if (response && response.action === 'blockFrameOnly' && response.redirectUrl) {
          LetSpaerLog.warn('[LetSpær:Content] Modtog blockFrameOnly fra background.js – omdirigerer denne iframe til blocked.html');
          window.location.replace(response.redirectUrl);
        }
      }
    );
  } catch (err) {
    LetSpaerLog.error('[LetSpær:Content] Fejl ved afsendelse af besked til background.js:', err.message);
  }
}

// Matcher kun hele ord/fraser, så fx "friv" ikke matcher "frivillig" og "io games" ikke matcher "studio games".
// Bruger Unicode-bogstaver (æ, ø, å tæller som bogstaver) og virker også for termer med tegnsætning ("1v1.lol").
const termRegexCache = new Map();
function containsWholeWord(text, term) {
  if (!text) return false;
  let regex = termRegexCache.get(term);
  if (!regex) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    regex = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu');
    termRegexCache.set(term, regex);
  }
  return regex.test(text);
}

// URL'en gøres læsbar som tekst, så "unblocked-games-66" kan matche "unblocked games 66"
function urlAsText(url) {
  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch (e) {}
  return decoded.toLowerCase().replace(/[-_+./?=&#:]+/g, ' ');
}

function runFastScanners() {
  if (!scannerEnabled || hasBlocked) return;

  // Ignorer små iframes (fx standard bannerreklamer på nyhedssider), så de ikke udløser falske alarmer
  if (window !== window.top) {
    if (window.innerWidth > 0 && window.innerHeight > 0 && (window.innerWidth < 320 || window.innerHeight < 240)) {
      LetSpaerLog.log(`[LetSpær:Content] Spring over lille iframe (${window.innerWidth}x${window.innerHeight})`);
      diagnostics = { status: 'small_iframe', score: undefined, signals: [] };
      return;
    }
  }

  let gameScore = 0;
  const gameMatches = [];
  const pageTitle = (document.title || '').toLowerCase();
  const pageUrl = window.location.href.toLowerCase();
  const urlText = urlAsText(window.location.href);
  const hostname = window.location.hostname.toLowerCase();
  const pageText = (document.body ? document.body.innerText.substring(0, 15000).toLowerCase() : '');
  const metaDesc = document.querySelector('meta[name="description"]')?.content?.toLowerCase() || '';
  const metaKeywords = document.querySelector('meta[name="keywords"]')?.content?.toLowerCase() || '';

  const gameUrlKWs = ['unblocked games', 'games 66', 'games 77', 'games 99', 'io game', 'unblocked spil', 'gratis spil', 'free games', 'html5 game'];
  gameUrlKWs.forEach(kw => {
    if (containsWholeWord(urlText, kw) || containsWholeWord(pageTitle, kw)) {
      gameScore += 3;
      gameMatches.push(`Spil-URL/Titel nøgleord: "${kw}" (+3)`);
    }
  });

  // Entydige spilnavne: tæller i titel, sti og domæne
  const gameNames = ['retro bowl', '1v1.lol', 'drift hunters', 'cookie clicker', 'subway surfers', 'flappy bird', 'crossy road', 'fnaf', 'geometry dash', 'moto x3m', 'happy wheels', 'basketball stars', 'shell shockers', 'krunker'];
  // Tvetydige navne, der også er almindelige ord eller undervisningsemner ("slope" i matematik,
  // "snake game" i programmering): tæller kun i titlen, hvis titlen også indeholder et spilord,
  // og ellers kun i domænet – aldrig alene i stien
  const ambiguousGameNames = ['slope', 'tetris', 'snake game', '2048', 'run 3'];
  const gameWords = ['game', 'games', 'spil', 'play', 'unblocked'];

  gameNames.forEach(name => {
    const cleanName = name.replace(/\s+/g, '');
    if (containsWholeWord(pageTitle, name)) {
      gameScore += 4;
      gameMatches.push(`Spilnavn i titel: "${name}" (+4)`);
    } else if (pageUrl.includes(cleanName) || containsWholeWord(urlText, name)) {
      gameScore += 3;
      gameMatches.push(`Spilnavn i URL/domæne: "${name}" (+3)`);
    }
  });
  ambiguousGameNames.forEach(name => {
    const cleanName = name.replace(/\s+/g, '');
    // Spilordet skal stå uden for selve navnet ("snake game" tæller ikke som spilord i sig selv)
    const titleWithoutName = pageTitle.split(name).join(' ');
    const titleHasGameWord = gameWords.some(w => containsWholeWord(titleWithoutName, w));
    if (titleHasGameWord && containsWholeWord(pageTitle, name)) {
      gameScore += 4;
      gameMatches.push(`Spilnavn i titel sammen med spilord: "${name}" (+4)`);
    } else if (hostname.includes(cleanName)) {
      gameScore += 3;
      gameMatches.push(`Spilnavn i domæne: "${name}" (+3)`);
    }
  });

  // HTML5 / Canvas elementer (1 point for tilstedeværelse)
  const hasCanvas = document.querySelector('canvas');
  const hasEmbed = document.querySelector('embed');
  const hasObject = document.querySelector('object');
  if (hasCanvas || hasEmbed || hasObject) {
    gameScore += 1;
    gameMatches.push('HTML5 Interaktivt element (canvas/embed/object) til stede (+1)');
  }

  // Globale spil-engines detekteret via MAIN world eller DOM
  if (detectedPureGameEngine || document.getElementById('unity-canvas')) {
    gameScore += 6;
    gameMatches.push('Spilmotor opdaget via Window/DOM (+6)');
  } else if (detectedMediaLib) {
    gameScore += 2;
    gameMatches.push('Medie-/grafikbibliotek opdaget (+2)');
  }

  const scriptSrcs = Array.from(document.querySelectorAll('script[src]')).map(s => s.src.toLowerCase());

  // Rene spil-engines i script-tags (+5 point)
  const pureGameScripts = ['ruffle.js', 'unity.loader.js', 'unityweb', 'playcanvas', 'phaser.min.js', 'phaser.js', 'c2runtime', 'c3runtime', 'gdjs', 'pico-8', 'gamemaker'];
  pureGameScripts.forEach(gs => {
    if (scriptSrcs.some(src => src.includes(gs))) {
      gameScore += 5;
      gameMatches.push(`Spilmotor script-tag: "${gs}" (+5)`);
    }
  });

  // Generelle 3D-/grafikbiblioteker (+2 point)
  const generalGraphicsScripts = ['pixi.min.js', 'pixi.js', 'emscripten', 'babylonjs', 'three.min.js'];
  generalGraphicsScripts.forEach(gs => {
    if (scriptSrcs.some(src => src.includes(gs))) {
      gameScore += 2;
      gameMatches.push(`Grafikbibliotek script-tag: "${gs}" (+2)`);
    }
  });

  // SEO-fraser (+10 point)
  const seoPhrases = ['unblocked games', 'free online games', 'play now for free', 'addicting games', 'io games', 'best free games', 'y9 games', 'y8 games', 'spil gratis onlinespil', 'play game online', 'play free games', 'browser games', 'html5 games'];
  seoPhrases.forEach(phrase => {
    if (containsWholeWord(pageTitle, phrase) || containsWholeWord(metaDesc, phrase) || containsWholeWord(metaKeywords, phrase)) {
      gameScore += 10;
      gameMatches.push(`SEO spilfrase: "${phrase}" (+10)`);
    }
  });

  // "friv" tjekkes som helt ord
  if (containsWholeWord(pageTitle, 'friv') || containsWholeWord(metaDesc, 'friv') || containsWholeWord(metaKeywords, 'friv')) {
    gameScore += 10;
    gameMatches.push('Friv nøgleord opdaget (+10)');
  }

  // Kun fraser, der næsten kun bruges i spil. "controls:", "arrow keys" og "move with" er fjernet,
  // da de også står i almindelige vejledninger og simuleringer. Højst +4 i alt.
  const behaviorWords = ['wasd', 'press spacebar', 'play fullscreen', 'click to play', 'tap to start', 'press enter to start', 'left click to shoot'];
  let behaviorPoints = 0;
  behaviorWords.forEach(bw => {
    if (behaviorPoints < 4 && containsWholeWord(pageText, bw)) {
      behaviorPoints += 2;
      gameScore += 2;
      gameMatches.push(`Styringsinstruks opdaget i tekst: "${bw}" (+2)`);
    }
  });

  if (containsWholeWord(metaKeywords, 'game') && containsWholeWord(metaKeywords, 'play') && containsWholeWord(metaKeywords, 'online')) {
    gameScore += 5;
    gameMatches.push('Spil-kombination i meta keywords (+5)');
  }

  if (hostname.endsWith('github.io') || hostname.endsWith('netlify.app') || hostname.endsWith('vercel.app') || hostname.endsWith('pages.dev')) {
    const deployGameKWs = ['game', 'games', 'play', 'unblocked', 'retro', 'emulator', 'arcade', 'nes', 'snes', 'gba'];
    deployGameKWs.forEach(kw => {
      if (containsWholeWord(pageTitle, kw) || containsWholeWord(pageUrl, kw)) {
        gameScore += 3;
        gameMatches.push(`Hosting-platform spilord: "${kw}" (+3)`);
      }
    });
  }

  let sitesScore = 0;
  const sitesMatches = [];
  if (hostname === 'sites.google.com') {
    if (document.querySelectorAll('iframe').length > 5) {
      sitesScore += 3;
      sitesMatches.push('Google Sites: Mere end 5 iframes (+3)');
    }
    if (pageTitle.includes('games') || pageTitle.includes('unblocked') || pageTitle.includes('proxy')) {
      sitesScore += 3;
      sitesMatches.push('Google Sites: Spilord i titel (+3)');
    }
    const gameMenuKWs = ['gmes', 'g mes', 'unblocked', 'unbl cked', 'pr xy', 'g4mes', 'gam3s', 'unblocke', 'pr0xy'];
    const matchedMenuKWs = new Set();
    document.querySelectorAll('a').forEach(a => {
      const t = (a.textContent || '').toLowerCase();
      const href = (a.href || '').toLowerCase();
      gameMenuKWs.forEach(kw => {
        if (t.includes(kw) || href.includes(kw)) {
          matchedMenuKWs.add(kw);
        }
      });
    });
    matchedMenuKWs.forEach(kw => {
      sitesScore += 4;
      sitesMatches.push(`Google Sites: Menu spilord/sløret ord: "${kw}" (+4)`);
    });
  }

  const finalScore = Math.max(gameScore, sitesScore);
  const allMatches = [...gameMatches, ...sitesMatches];

  diagnostics = {
    status: finalScore >= GAME_THRESHOLD ? 'blocked_game' : 'scanned',
    score: finalScore,
    signals: allMatches
  };

  if (finalScore > 0) {
    LetSpaerLog.log(`[LetSpær:Content] Scanner kørte for ${window.location.pathname}. Samlet score: ${finalScore} (Grænse: ${GAME_THRESHOLD}). Detaljer:`, allMatches);
  }

  if (finalScore >= GAME_THRESHOLD) {
    if (detectionMode === 'block') {
      LetSpaerLog.warn(`[LetSpær:Content] Blokeringsgrænse nået (Score: ${finalScore} >= ${GAME_THRESHOLD})! Rapporterer overtrædelse.`);
      reportViolation('game', finalScore, allMatches);
    } else {
      // Logtilstand: siden ville være blevet blokeret, men får lov at køre
      diagnostics.status = 'would_block';
      LetSpaerLog.warn(`[LetSpær:Content] Logtilstand: siden ville være blokeret (Score: ${finalScore} >= ${GAME_THRESHOLD}).`);
    }
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

function startScanning() {
  scannerEnabled = true;
  if (scanningStarted) {
    runFastScanners();
    return;
  }
  scanningStarted = true;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
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

function normalizeMode(value) {
  return value === 'log' || value === 'off' ? value : 'block';
}

function applyDetectionMode(mode) {
  detectionMode = normalizeMode(mode);
  if (isEducationService) return;
  if (detectionMode === 'off') {
    scannerEnabled = false;
    if (!hasBlocked) diagnostics = { status: 'detection_off', score: undefined, signals: [] };
    LetSpaerLog.log('[LetSpær:Content] Spil-detektion er slået fra (gameDetectionMode = off).');
  } else {
    startScanning();
  }
}

// Undervisningstjenester (educationCsvUrl) undtages fra al automatisk analyse.
// Derefter afgør gameDetectionMode, om der analyseres, og om der blokeres.
Promise.all([
  new Promise((resolve) => chrome.storage.local.get('educationList', (data) => {
    resolve((!chrome.runtime.lastError && data && Array.isArray(data.educationList)) ? data.educationList : []);
  })),
  new Promise((resolve) => chrome.storage.managed.get('gameDetectionMode', (data) => {
    resolve(!chrome.runtime.lastError && data ? data.gameDetectionMode : undefined);
  }))
]).then(([educationList, mode]) => {
  if (letspaerIsEducationService(window.location.href, educationList)) {
    isEducationService = true;
    LetSpaerLog.log('[LetSpær:Content] Siden er en undervisningstjeneste – automatisk analyse springes over.');
    diagnostics = { status: 'education', score: undefined, signals: [] };
    return;
  }
  applyDetectionMode(mode);
});

// Ændres gameDetectionMode i Admin-konsollen, slår det igennem på åbne sider
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'managed' && changes.gameDetectionMode) {
    applyDetectionMode(changes.gameDetectionMode.newValue);
  }
});

// =================================================
// FEJLSØGNING: Svar LetSpær-popuppen (kun når debugLogging er slået til)
// =================================================

// Iframes på denne side, der er blevet blokeret (kun i hukommelsen, kun i øverste ramme)
let blockedFrames = [];
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.action !== 'letspaerFrameBlocked') return;
  if (window !== window.top || !LetSpaerLog.isEnabled()) return;
  blockedFrames.push({ page: msg.page, status: 'blocked_iframe', score: msg.score, signals: msg.signals || [] });
  if (blockedFrames.length > 10) blockedFrames.shift();
});

// Popuppen åbner en forbindelse til alle rammer i fanen. Hver ramme svarer med
// sit eget resultat. Der analyseres igen lige inden, så pointene er aktuelle.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'letspaer-diagnostics') return;
  if (!LetSpaerLog.isEnabled()) return;

  if (scannerEnabled && !hasBlocked) runFastScanners();

  port.postMessage({
    page: safePageUrl(),
    isTop: window === window.top,
    status: diagnostics.status,
    score: diagnostics.score,
    signals: diagnostics.signals,
    blockedFrames: window === window.top ? blockedFrames : []
  });
});

