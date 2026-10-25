// Filnavn: content_analyzer.js
// Kører i ISOLATED world - beskyttet mod manipulation fra hjemmesiden

let hasBlocked = false;
let detectedPureGameEngine = false;
let detectedMediaLib = false;

// Lyt efter signaler fra content_analyzer_main.js (kun opgradering til true er mulig)
document.addEventListener('NetShieldMainProbe', (e) => {
  if (e.detail?.hasPureGameEngine) detectedPureGameEngine = true;
  if (e.detail?.hasMediaLib) detectedMediaLib = true;
  runFastScanners();
});

function reportViolation(reason) {
  if (reason !== 'game' || hasBlocked) return;
  hasBlocked = true;
  try {
    chrome.runtime.sendMessage(
      { action: 'violationDetected', reason: reason },
      (response) => {
        if (chrome.runtime.lastError) return;
        // Hvis dette er en iframe på en almindelig side, erstatter vi kun selve iframen
        if (response && response.action === 'blockFrameOnly' && response.redirectUrl) {
          console.warn('[LetSpær:Content] Modtog blockFrameOnly fra background.js – omdirigerer denne iframe til blocked.html');
          window.location.replace(response.redirectUrl);
        }
      }
    );
  } catch (err) {
    console.error('[LetSpær:Content] Fejl ved afsendelse af besked til background.js:', err.message);
  }
}

// Hjælpefunktion til at matche hele ord (forhindrer at fx "friv" matcher "frivillig" eller "nes" matcher "business")
function containsWholeWord(text, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  return regex.test(text);
}

function runFastScanners() {
  if (hasBlocked) return;

  // Undgå unødig kørsel på godkendte skolesider
  if (isSafeSchoolSite()) return;

  // Ignorer små iframes (fx standard bannerreklamer på nyhedssider), så de ikke udløser falske alarmer
  if (window !== window.top) {
    if (window.innerWidth > 0 && window.innerHeight > 0 && (window.innerWidth < 320 || window.innerHeight < 240)) {
      console.log(`[LetSpær:Content] Spring over lille iframe (${window.innerWidth}x${window.innerHeight})`);
      return;
    }
  }

  let gameScore = 0;
  const gameMatches = [];
  const pageTitle = (document.title || '').toLowerCase();
  const pageUrl = window.location.href.toLowerCase();
  const hostname = window.location.hostname.toLowerCase();
  const pageText = (document.body ? document.body.innerText.substring(0, 15000).toLowerCase() : '');
  const metaDesc = document.querySelector('meta[name="description"]')?.content?.toLowerCase() || '';
  const metaKeywords = document.querySelector('meta[name="keywords"]')?.content?.toLowerCase() || '';

  const gameUrlKWs = ['unblocked games', 'games 66', 'games 77', 'games 99', 'io game', 'unblocked spil', 'gratis spil', 'free games', 'html5 game'];
  gameUrlKWs.forEach(kw => {
    if (pageUrl.includes(kw) || pageTitle.includes(kw)) {
      gameScore += 3;
      gameMatches.push(`Spil-URL/Titel nøgleord: "${kw}" (+3)`);
    }
  });

  const gameNames = ['slope', 'retro bowl', '1v1.lol', 'drift hunters', 'cookie clicker', 'subway surfers', 'flappy bird', 'tetris', 'snake game', 'crossy road', '2048', 'run 3', 'fnaf', 'geometry dash', 'moto x3m', 'happy wheels', 'basketball stars', 'shell shockers', 'krunker'];
  gameNames.forEach(name => {
    if (containsWholeWord(pageTitle, name)) {
      gameScore += 3;
      gameMatches.push(`Spilnavn i titel: "${name}" (+3)`);
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
  const pureGameScripts = ['ruffle.js', 'unity.loader.js', 'unityweb', 'playcanvas', 'phaser.min.js', 'phaser.js', 'construct', 'gdjs', 'pico-8', 'gamemaker'];
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
  const seoPhrases = ['unblocked games', 'free online games', 'play now for free', 'addicting games', 'io games', 'best free games', 'jogos', 'y9 games', 'y8 games', 'spil gratis onlinespil', 'play game online', 'play free games', 'browser games', 'html5 games'];
  seoPhrases.forEach(phrase => {
    if (pageTitle.includes(phrase) || metaDesc.includes(phrase) || metaKeywords.includes(phrase)) {
      gameScore += 10;
      gameMatches.push(`SEO spilfrase: "${phrase}" (+10)`);
    }
  });

  // "friv" tjekkes som helt ord
  if (containsWholeWord(pageTitle, 'friv') || containsWholeWord(metaDesc, 'friv') || containsWholeWord(metaKeywords, 'friv')) {
    gameScore += 10;
    gameMatches.push('Friv nøgleord opdaget (+10)');
  }

  const behaviorWords = ['controls:', 'wasd', 'arrow keys', 'press spacebar', 'play fullscreen', 'click to play', 'tap to start', 'press enter to start', 'move with', 'left click to shoot'];
  behaviorWords.forEach(bw => {
    if (pageText.includes(bw)) {
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

  if (finalScore > 0) {
    console.log(`[LetSpær:Content] Scanner kørte for ${window.location.pathname}. Samlet score: ${finalScore} (Grænse: 5). Detaljer:`, allMatches);
  }

  if (finalScore >= 5) {
    console.warn(`[LetSpær:Content] Blokeringsgrænse nået (Score: ${finalScore} >= 5)! Rapporterer overtrædelse.`);
    reportViolation('game');
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
    'accounts.google.com', 'testogprøver.dk', 'xn--testogprver-mgb.dk', 'skoleporten.dk', 'minuddannelse.dk',
    'restudy.dk', 'sofaskolen.dk', 'emu.dk', 'skolon.com', 'alinea.dk',
    'meebook.com', 'easyiq.dk', 'unilogin.dk', 'mitid.dk',
    'forms.google.com', 'sheets.google.com', 'keep.google.com',
    'mail.google.com', 'meet.google.com', 'calendar.google.com',
    'kahoot.com', 'quizlet.com', 'geogebra.org', 'code.org',
    'wikipedia.org', 'dr.dk', 'denstoredanske.lex.dk', 'duda.dk'
  ];

  try {
    const h = window.location.hostname.toLowerCase();
    return coreSchoolSites.some(site => h === site || h.endsWith('.' + site));
  } catch (e) {
    return false;
  }
}

if (!isSafeSchoolSite()) {
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