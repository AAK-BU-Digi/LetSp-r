// popup.js – LetSpær-popup til pilotforløb (kun aktiv når debugLogging = "enabled").
// Spørger fanens rammer direkte om deres seneste resultat. Intet gemmes.

const MODE_TEXT = { daily: 'daglig', exam: 'prøve' };

function getManaged(keys) {
  return new Promise((resolve) => {
    chrome.storage.managed.get(keys, (data) => {
      resolve(chrome.runtime.lastError ? {} : (data || {}));
    });
  });
}

// Åbner én forbindelse til alle rammer i fanen og samler svarene
function collectFrames(tabId, timeoutMs = 600) {
  return new Promise((resolve) => {
    const results = [];
    let done = false;
    let port;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { port && port.disconnect(); } catch (e) {}
      resolve(results);
    };
    const timer = setTimeout(finish, timeoutMs);
    try {
      port = chrome.tabs.connect(tabId, { name: 'letspaer-diagnostics' });
    } catch (e) {
      finish();
      return;
    }
    port.onMessage.addListener((msg) => results.push(msg));
    port.onDisconnect.addListener(() => {
      void chrome.runtime.lastError; // Ingen modtagere: siden kører ikke LetSpær
      finish();
    });
  });
}

function isBlockedPageUrl(url, config) {
  if (!url) return false;
  if (url.startsWith(chrome.runtime.getURL('blocked.html'))) return true;
  if (config.blockedPageMode === 'external' && config.blockedPageUrl) {
    return url.startsWith(config.blockedPageUrl.split('?')[0]);
  }
  return false;
}

// Samler rammernes svar til ét overblik
function infoFromFrames(frames, tabUrl) {
  const top = frames.find(f => f.isTop);
  const interesting = frames.filter(f =>
    !f.isTop && ((typeof f.score === 'number' && f.score > 0) || /^(blocked|ignored)/.test(f.status))
  );
  // Blokerede iframes kan ikke selv svare; den øverste ramme kender dem
  const blocked = (top && Array.isArray(top.blockedFrames)) ? top.blockedFrames : [];
  interesting.push(...blocked);

  const info = {
    page: top ? top.page : letspaerSafePageUrl(tabUrl),
    status: top ? top.status : 'unavailable',
    score: top ? top.score : undefined,
    signals: top ? top.signals : [],
    frames: interesting.map(f => ({ page: f.page, status: f.status, score: f.score, signals: f.signals })),
    hiddenFrames: frames.filter(f => !f.isTop).length - interesting.length
  };
  return info;
}

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function render(info, report, config) {
  document.getElementById('page').textContent = info.page || 'Ukendt side';

  const statusEl = document.getElementById('status');
  statusEl.textContent = letspaerStatusText(info.status);
  if (/^blocked/.test(info.status)) statusEl.className = 'over';
  else if (/education/.test(info.status)) statusEl.className = 'ok';

  // Pointbjælke med markering ved grænsen
  if (typeof info.score === 'number') {
    const gauge = document.getElementById('gauge');
    const scaleMax = Math.max(LETSPAER_GAME_THRESHOLD * 2, info.score);
    gauge.hidden = false;
    if (info.score >= LETSPAER_GAME_THRESHOLD) gauge.classList.add('over');
    document.getElementById('score').textContent = info.score;
    document.getElementById('scoreLabel').textContent = `point, grænse ${LETSPAER_GAME_THRESHOLD}`;
    document.getElementById('fill').style.width = `${(info.score / scaleMax) * 100}%`;
    document.getElementById('limit').style.left = `${(LETSPAER_GAME_THRESHOLD / scaleMax) * 100}%`;
  }

  const signalsEl = document.getElementById('signals');
  if (info.signals && info.signals.length) {
    signalsEl.appendChild(el('h2', 'Signaler'));
    const ul = el('ul');
    info.signals.forEach(s => ul.appendChild(el('li', s)));
    signalsEl.appendChild(ul);
  } else if (typeof info.score === 'number') {
    signalsEl.appendChild(el('p', 'Ingen spilsignaler fundet.', 'muted'));
  }

  if (info.frames && info.frames.length) {
    const details = el('details');
    // Er en iframe blokeret, er det sandsynligvis den, brugeren undrer sig over
    details.open = info.frames.some(f => /^blocked/.test(f.status));
    details.appendChild(el('summary', `Indlejrede rammer med fund (${info.frames.length})`));
    info.frames.forEach(f => {
      const box = el('div', undefined, 'frame');
      const score = typeof f.score === 'number' ? `, ${f.score} point` : '';
      box.appendChild(el('p', f.page, 'addr'));
      box.appendChild(el('p', letspaerStatusText(f.status) + score, 'muted'));
      if (f.signals && f.signals.length) {
        const ul = el('ul');
        f.signals.forEach(s => ul.appendChild(el('li', s)));
        box.appendChild(ul);
      }
      details.appendChild(box);
    });
    document.getElementById('frames').appendChild(details);
  }

  // Kan siden ikke analyseres, er der intet at sende
  if (info.status === 'unavailable') {
    document.getElementById('note').textContent = info.note || 'LetSpær analyserer kun almindelige hjemmesider.';
    return;
  }

  // Knapper
  const send = document.getElementById('send');
  const copy = document.getElementById('copy');
  const formUrl = letspaerFormUrl(config.reportFormUrl, report.fields);
  copy.hidden = false;
  if (formUrl) {
    send.hidden = false;
    send.addEventListener('click', () => {
      chrome.tabs.create({ url: formUrl });
      window.close();
    });
  } else {
    copy.classList.add('primary');
  }
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(report.text);
      copy.textContent = 'Kopieret';
    } catch (e) {
      copy.textContent = 'Kunne ikke kopiere';
    }
  });

  document.getElementById('note').textContent = (formUrl
    ? 'Formularen åbner udfyldt med det, du ser her. Skriv gerne, hvad du undrer dig over, før du sender. '
    : 'Indsæt teksten i en mail til den pilotansvarlige. ')
    + 'Kun sidens adresse uden parametre, point og signaler sendes – intet om dig.';
}

(async function init() {
  const debug = await LetSpaerLog.ready();
  if (!debug) {
    document.getElementById('page').textContent = 'Fejlsøgning er ikke slået til.';
    return;
  }

  const config = await getManaged(['sheetMode', 'blockedPageMode', 'blockedPageUrl', 'reportFormUrl']);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabUrl = tab && tab.url;

  let info;
  if (isBlockedPageUrl(tabUrl, config)) {
    info = letspaerInfoFromBlockedUrl(tabUrl);
  } else if (tab && tab.id !== undefined && /^https?:/.test(tabUrl || 'http:')) {
    const frames = await collectFrames(tab.id);
    info = infoFromFrames(frames, tabUrl);
    if (!frames.length) {
      info.status = 'unavailable';
      info.note = 'Genindlæs siden og prøv igen. Er det en blokeringsside, så brug knappen på selve siden.';
    }
  } else {
    info = { page: letspaerSafePageUrl(tabUrl || ''), status: 'unavailable', signals: [] };
  }

  info.version = chrome.runtime.getManifest().version;
  info.mode = MODE_TEXT[config.sheetMode] || MODE_TEXT.daily;

  const report = letspaerBuildReport(info);
  render(info, report, config);
})();
