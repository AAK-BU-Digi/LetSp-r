// blocked.js – ligger i egen fil, da Manifest V3 ikke tillader inline scripts i extension-sider
(function() {
    const params = new URLSearchParams(window.location.search);
    const reason = params.get('reason');
    const domain = params.get('domain') || params.get('url') || '';

    const reasonContainer = document.getElementById('reasonContainer');
    const reasonText = document.getElementById('reasonText');

    let message = '';
    let consoleMsg = '';

    if (reason === 'csv' || reason === 'list') {
        const target = domain ? ` ("${domain}")` : '';
        message = `Blokeret pga. match på skolens centrale blokeringsliste (CSV)${target}.`;
        consoleMsg = `[LetSpær] Siden er blokeret pga. match på den centrale CSV-blokeringsliste${target}.`;
    } else if (reason === 'heuristic_game' || reason === 'game') {
        message = `Automatisk spil-detektion: Mistænkeligt spilindhold opdaget på siden.`;
        consoleMsg = `[LetSpær] Siden er blokeret af den heuristiske spil-scanner (score >= 5).`;
    } else if (reason === 'iframe_game') {
        message = `Spil-detektion i indlejret ramme (iframe).`;
        consoleMsg = `[LetSpær] Indlejret iframe blokeret pga. spilindhold.`;
    } else if (reason === 'ai') {
        message = `AI-tjeneste / AI-chat er spærret i skoletiden.`;
        consoleMsg = `[LetSpær] Siden er blokeret pga. AI-begrænsning.`;
    } else if (reason) {
        message = `Blokeringsregel udløst (${reason}).`;
        consoleMsg = `[LetSpær] Siden er blokeret. Årsag: ${reason}`;
    }

    if (message) {
        reasonText.textContent = message;
        reasonContainer.style.display = 'block';
    }

    if (consoleMsg) {
        LetSpaerLog.warn(consoleMsg);
    }
})();

// =================================================
// FEJLSØGNING: Point, signaler og "Send" (kun når debugLogging er slået til)
// =================================================
(async function debugPanel() {
    const debug = await LetSpaerLog.ready();
    if (!debug) return;

    const config = await new Promise((resolve) => {
        chrome.storage.managed.get(['sheetMode', 'reportFormUrl'], (data) => {
            resolve(chrome.runtime.lastError ? {} : (data || {}));
        });
    });

    const info = letspaerInfoFromBlockedUrl(window.location.href);
    info.version = chrome.runtime.getManifest().version;
    info.mode = { daily: 'daglig', exam: 'prøve' }[config.sheetMode] || 'daglig';
    const report = letspaerBuildReport(info);

    const panel = document.getElementById('debugPanel');
    const scoreEl = document.getElementById('debugScore');
    const signalsEl = document.getElementById('debugSignals');
    const sendEl = document.getElementById('debugSend');
    const copyEl = document.getElementById('debugCopy');
    const textEl = document.getElementById('debugText');
    const noteEl = document.getElementById('debugNote');

    scoreEl.textContent = typeof info.score === 'number'
        ? `${info.score} point (grænse ${LETSPAER_GAME_THRESHOLD})`
        : letspaerStatusText(info.status);
    (info.signals || []).forEach((signal) => {
        const li = document.createElement('li');
        li.textContent = signal;
        signalsEl.appendChild(li);
    });

    const formUrl = letspaerFormUrl(config.reportFormUrl, report.fields);
    if (formUrl) {
        sendEl.href = formUrl;
        sendEl.hidden = false;
    } else {
        copyEl.classList.add('primary');
    }

    // I en iframe kan udklipsholderen være spærret af den omgivende side.
    // Så vises teksten i stedet, så den kan markeres og kopieres manuelt.
    copyEl.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(report.text);
            copyEl.textContent = 'Kopieret';
        } catch (e) {
            textEl.value = report.text;
            textEl.hidden = false;
            textEl.select();
            copyEl.textContent = 'Markér og kopiér teksten';
        }
    });

    noteEl.textContent = 'Kun sidens adresse uden parametre, point og signaler sendes – intet om dig.';
    panel.hidden = false;
})();

