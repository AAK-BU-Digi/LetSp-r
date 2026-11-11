// background.js - Manifest V3

// Fælles logger (debugLogging) og matchlogik for undervisningstjenester
// – bruges også af content scripts
importScripts('debug.js', 'education-list.js');

const DEFAULT_UPDATE_INTERVAL_MS = 1800000; // 30 minutter default
const ALARM_NAME = 'letspaer_update_rules';
const JITTER_ALARM_NAME = 'letspaer_jittered_update';
const JITTER_MAX_MINUTES = 5;      // Spred opdateringer ud over op til 5 minutter efter opstart
const LATE_ALARM_THRESHOLD_MS = 2 * 60000;

// Faste ID-intervaller, så reglerne aldrig kolliderer
const RULE_ID_CSV_DOMAINS = 1;          // Én samlet regel for alle almindelige domæner
const RULE_ID_CSV_PATTERN_BASE = 1000;  // Wildcard- og sti-regler (én regel pr. linje)
const RULE_ID_AI_BASE = 900000;         // AI-regler

// Chrome tillader højst 5.000 dynamiske "usikre" regler (redirect m.fl.).
// Vi holder lidt luft til AI-reglerne.
const MAX_PATTERN_RULES = 4900;

let isUpdating = false;
let updatePending = false;

// =================================================
// KONFIGURATION
// =================================================

// Hent konfiguration fra Google Admin Console
async function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.managed.get(
      [
        'sheetMode',
        'dailyCsvUrl',
        'examCsvUrl',
        'blockedPageMode',
        'blockedPageUrl',
        'updateInterval',
        'aiBlockMode',
        'educationCsvUrl',
        'debugLogging'
      ],
      (data) => {
        if (chrome.runtime.lastError) {
          resolve({});
        } else {
          resolve(data || {});
        }
      }
    );
  });
}

function getIntervalMs(config) {
  const value = Number(config.updateInterval);
  return value > 0 ? value : DEFAULT_UPDATE_INTERVAL_MS;
}

function getRedirectBase(config) {
  if (config.blockedPageMode === 'external' && config.blockedPageUrl) {
    return config.blockedPageUrl;
  }
  return chrome.runtime.getURL('blocked.html');
}

function appendParams(baseUrl, params) {
  const query = new URLSearchParams(params).toString();
  if (!query) return baseUrl;
  return baseUrl + (baseUrl.includes('?') ? '&' : '?') + query;
}

// Kun værtsnavnet sendes videre til blokeringssiden – aldrig hele URL'en
// (den kan indeholde søgeord, tokens o.l.)
function hostnameOf(urlStr) {
  try {
    return new URL(urlStr).hostname;
  } catch (e) {
    return '';
  }
}

// =================================================
// CSV-PARSNING
// =================================================

// Returnerer første kolonne i en CSV-linje og respekterer anførselstegn,
// så "poki.com, crazygames.com" i én celle ikke bliver klippet over.
function firstCsvField(line) {
  if (!line.startsWith('"')) return line.split(',')[0];
  let out = '';
  for (let i = 1; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (line[i + 1] === '"') {
        out += '"';
        i++;
      } else {
        break;
      }
    } else {
      out += ch;
    }
  }
  return out;
}

// Oversætter én adresse til en blokeringsindgang.
// Understøttede formater:
//   spil.dk             -> spil.dk og alle subdomæner
//   *.spil.dk           -> det samme (|| dækker allerede subdomæner)
//   zalando.*           -> zalando.dk, zalando.de, zalando.co.uk osv. (+ subdomæner)
//   youtube.com/shorts  -> kun den sti
//   zalando.*/sale      -> stien på alle zalando-domæner
// Returnerer null for ugyldige linjer (fx overskrifter).
function parseEntry(raw) {
  let s = raw.replace(/["']/g, '').trim().toLowerCase();
  if (!s) return null;

  s = s.replace(/^https?:\/\//, '');
  s = s.replace(/^\*\./, '');
  s = s.replace(/^www\./, '');
  s = s.replace(/[?#].*$/, '');   // Forespørgsel og fragment giver ikke mening i en blokeringsregel
  s = s.replace(/\/+$/, '');

  let wildcardTld = false;
  let hostPart;
  let pathPart;

  const wildcardMatch = s.match(/^([^/]+?)\.\*(\/.*)?$/);
  if (wildcardMatch) {
    wildcardTld = true;
    hostPart = wildcardMatch[1];
    pathPart = wildcardMatch[2] || '';
  } else {
    const slash = s.indexOf('/');
    hostPart = slash === -1 ? s : s.slice(0, slash);
    pathPart = slash === -1 ? '' : s.slice(slash);
  }

  // Andre placeringer af * understøttes ikke
  if (!hostPart || hostPart.includes('*') || pathPart.includes('*')) return null;
  // Almindelige domæner skal indeholde et punktum (filtrerer fx overskriften "Adresse" fra)
  if (!wildcardTld && !hostPart.includes('.')) return null;

  let host;
  let path;
  try {
    // URL-objektet oversætter æ, ø og å til Punycode (xn--...), som Chrome kræver
    const urlObj = new URL('http://' + hostPart + pathPart);
    host = urlObj.hostname;
    path = urlObj.pathname !== '/' ? urlObj.pathname : '';
  } catch (e) {
    return null;
  }

  if (!/^[a-z0-9.-]+$/.test(host) || host.startsWith('.') || host.endsWith('.')) return null;

  return {
    host,
    path,
    wildcardTld,
    display: wildcardTld ? `${host}.*${path}` : host + path
  };
}

// Almindelige domæner (uden sti og wildcard) kan samles i én requestDomains-regel
function isPlainDomain(entry) {
  return !entry.wildcardTld && !entry.path;
}

// urlFilter til wildcard- og sti-adresser
function toUrlFilter(entry) {
  if (entry.wildcardTld) {
    return entry.path ? `||${entry.host}.*${entry.path}` : `||${entry.host}.`;
  }
  return `||${entry.host}${entry.path}`;
}

function parseCsv(text, label) {
  const entries = [];
  const seen = new Set();
  const skipped = [];

  for (const line of text.split(/\r?\n/)) {
    const cell = firstCsvField(line.trim());
    // En celle kan indeholde flere adresser adskilt af komma, semikolon eller mellemrum
    for (const raw of cell.split(/[\s,;]+/)) {
      if (!raw) continue;
      const entry = parseEntry(raw);
      if (!entry) {
        skipped.push(raw);
        continue;
      }
      const key = (entry.wildcardTld ? 'w:' : 'd:') + entry.host + entry.path;
      if (!seen.has(key)) {
        seen.add(key);
        entries.push(entry);
      }
    }
  }

  if (skipped.length > 0) {
    LetSpaerLog.log(`[LetSpær:BG] ${label}: Sprang ${skipped.length} linje(r) over, som ikke er gyldige adresser:`, skipped.slice(0, 20));
  }
  return entries;
}

// Henter CSV'en. Returnerer null ved fejl (så eksisterende regler bevares)
// og et tomt array, hvis listen faktisk er tom.
async function fetchCsvEntries(csvUrl, label) {
  if (!csvUrl) return [];
  try {
    // 'no-cache' tillader betingede forespørgsler (ETag/304), 'no-store' gør ikke
    const response = await fetch(csvUrl, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const text = await response.text();

    // Hvis arket er afpubliceret eller kræver login, svarer Google med en HTML-side
    if (contentType.includes('text/html') || text.trimStart().startsWith('<')) {
      throw new Error(`Svaret er HTML og ikke CSV (content-type: ${contentType || 'ukendt'})`);
    }

    return parseCsv(text, label);
  } catch (error) {
    LetSpaerLog.error(`[LetSpær:BG] ${label}: Kunne ikke hente CSV – beholder den eksisterende liste:`, error);
    return null;
  }
}

// =================================================
// REGELBYGNING
// =================================================

function buildCsvRules(entries, redirectBase, useRegexSubstitution = true) {
  const rules = [];

  // 1. Alle almindelige domæner samles i ÉN regel via requestDomains.
  //    requestDomains matcher domænet og alle subdomæner.
  const domains = [...new Set(entries.filter(isPlainDomain).map(e => e.host))];
  if (domains.length > 0) {
    const redirect = useRegexSubstitution
      // Hele URL'en erstattes, og værtsnavnet (\1) sendes med til blokeringssiden
      ? { regexSubstitution: appendParams(redirectBase, { reason: 'csv' }) + '&domain=\\1' }
      : { url: appendParams(redirectBase, { reason: 'csv' }) };

    const condition = {
      requestDomains: domains,
      resourceTypes: ['main_frame']
    };
    if (useRegexSubstitution) {
      condition.regexFilter = '^https?://([^/?#:]+).*$';
    }

    rules.push({
      id: RULE_ID_CSV_DOMAINS,
      priority: 1,
      action: { type: 'redirect', redirect },
      condition
    });
  }

  // 2. Wildcard- og sti-adresser kræver hver deres urlFilter-regel
  let patterns = entries.filter(e => !isPlainDomain(e));
  if (patterns.length > MAX_PATTERN_RULES) {
    LetSpaerLog.error(`[LetSpær:BG] For mange wildcard-/sti-adresser (${patterns.length}). Kun de første ${MAX_PATTERN_RULES} bruges.`);
    patterns = patterns.slice(0, MAX_PATTERN_RULES);
  }
  patterns.forEach((entry, index) => {
    rules.push({
      id: RULE_ID_CSV_PATTERN_BASE + index,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: { url: appendParams(redirectBase, { reason: 'csv', domain: entry.display }) }
      },
      condition: {
        urlFilter: toUrlFilter(entry),
        resourceTypes: ['main_frame']
      }
    });
  });

  return rules;
}

function buildAiRules() {
  const rules = [];

  // Bing/Ecosia: bloker AI-endepunkter, der indlæses inde i søgesiden
  const aiUrlPatterns = ['cpltsrchif=1', '/copilotsearch', 'FORM=DEEPSH'];
  aiUrlPatterns.forEach((pattern, idx) => {
    rules.push({
      id: RULE_ID_AI_BASE + idx,
      priority: 2,
      action: { type: 'block' },
      condition: {
        urlFilter: pattern,
        initiatorDomains: ['bing.com', 'ecosia.org'],
        resourceTypes: ['xmlhttprequest', 'sub_frame', 'other']
      }
    });
  });

  // Google: AI-tilstand (udm=50) omskrives til den almindelige "Web"-visning (udm=14)
  rules.push({
    id: RULE_ID_AI_BASE + 100,
    priority: 2,
    action: {
      type: 'redirect',
      redirect: {
        transform: {
          queryTransform: { addOrReplaceParams: [{ key: 'udm', value: '14' }] }
        }
      }
    },
    condition: {
      regexFilter: '^https?://www\\.google\\.[a-z.]+/search\\?(.*&)?udm=50(&.*)?$',
      resourceTypes: ['main_frame']
    }
  });

  return rules;
}

// =================================================
// OPDATERING AF REGLER
// =================================================

async function applyRules(removeRuleIds, addRules) {
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
}

async function doUpdate() {
  const config = await getConfig();
  const sheetMode = config.sheetMode === 'exam' ? 'exam' : 'daily';
  const csvUrl = sheetMode === 'exam' ? config.examCsvUrl : config.dailyCsvUrl;
  const aiBlockEnabled = config.aiBlockMode !== 'disabled'; // Aktiv som standard
  const redirectBase = getRedirectBase(config);

  LetSpaerLog.log(`[LetSpær:BG] Opdaterer regler. Tilstand: ${sheetMode}, URL: ${csvUrl || 'Ingen CSV URL angivet'}`);

  // Blokeringslisten og listen over undervisningstjenester hentes samtidig
  const [entries, educationEntries] = await Promise.all([
    fetchCsvEntries(csvUrl, 'Blokeringsliste'),
    fetchCsvEntries(config.educationCsvUrl, 'Undervisningstjenester')
  ]);

  // Undervisningstjenesterne gemmes lokalt, så content_analyzer.js kan læse dem.
  // Fejler hentningen (null), beholdes den gemte liste.
  if (educationEntries !== null) {
    const educationList = educationEntries.map(({ host, path, wildcardTld }) => ({ host, path, wildcardTld }));
    await chrome.storage.local.set({ educationList });
    LetSpaerLog.log(`[LetSpær:BG] Undervisningstjenester opdateret: ${educationList.length} adresser.`);
  }

  const aiRules = aiBlockEnabled ? buildAiRules() : [];
  const currentRules = await chrome.declarativeNetRequest.getDynamicRules();

  // Hentning fejlede: behold CSV-reglerne, men opdater stadig AI-reglerne
  if (entries === null) {
    const currentAiIds = currentRules.filter(r => r.id >= RULE_ID_AI_BASE).map(r => r.id);
    await applyRules(currentAiIds, aiRules);
    return;
  }

  const allIds = currentRules.map(r => r.id);
  let csvRules = buildCsvRules(entries, redirectBase, true);

  try {
    await applyRules(allIds, [...csvRules, ...aiRules]);
  } catch (err) {
    // Sikkerhedsnet: hvis Chrome afviser regexSubstitution, bruger vi en fast
    // omdirigering uden domænenavn i stedet for at stå uden blokering
    LetSpaerLog.warn('[LetSpær:BG] Regelopdatering fejlede – prøver igen uden domæne i omdirigeringen:', err);
    csvRules = buildCsvRules(entries, redirectBase, false);
    await applyRules(allIds, [...csvRules, ...aiRules]);
  }

  const domainCount = entries.filter(isPlainDomain).length;
  const patternCount = entries.length - domainCount;
  await chrome.storage.local.set({ lastUpdate: Date.now() });

  LetSpaerLog.log(`[LetSpær:BG] Dynamiske regler opdateret: ${domainCount} domæner og ${patternCount} wildcard-/sti-adresser blokeret (AI-filter: ${aiBlockEnabled ? 'Aktiv' : 'Deaktiveret'}).`);
}

// Kører én opdatering ad gangen. Kommer der en ny anmodning undervejs
// (fx en ændring i Admin-konsollen), køres der én gang mere bagefter.
async function updateRules() {
  if (isUpdating) {
    updatePending = true;
    return;
  }
  isUpdating = true;
  try {
    do {
      updatePending = false;
      try {
        await doUpdate();
      } catch (err) {
        LetSpaerLog.error('[LetSpær:BG] Fejl under opdatering af regler:', err);
      }
    } while (updatePending);
  } finally {
    isUpdating = false;
  }
}

// =================================================
// ALARMER (overlever at Service Workeren går i dvale)
// =================================================

// Opretter kun alarmen, hvis den mangler eller intervallet er ændret.
// Startpunktet er tilfældigt, så 30.000 enheder ikke henter samtidig.
async function ensureAlarm(config) {
  const cfg = config || await getConfig();
  const periodInMinutes = Math.max(1, Math.round(getIntervalMs(cfg) / 60000));
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (existing && existing.periodInMinutes === periodInMinutes) return;

  await chrome.alarms.create(ALARM_NAME, {
    periodInMinutes,
    delayInMinutes: 1 + Math.random() * periodInMinutes
  });
  LetSpaerLog.log(`[LetSpær:BG] Opsat opdaterings-alarm med interval på ${periodInMinutes} minutter.`);
}

// Planlægger én opdatering et tilfældigt tidspunkt inden for de næste minutter
function scheduleJitteredUpdate() {
  chrome.alarms.create(JITTER_ALARM_NAME, {
    delayInMinutes: 0.5 + Math.random() * JITTER_MAX_MINUTES
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    // En alarm, der er meget forsinket, betyder at enheden har sovet.
    // Når mange enheder vågner samtidig (fx kl. 8), spreder vi hentningen ud.
    if (Date.now() - alarm.scheduledTime > LATE_ALARM_THRESHOLD_MS) {
      LetSpaerLog.log('[LetSpær:BG] Forsinket alarm (enheden har sovet) – planlægger spredt opdatering.');
      scheduleJitteredUpdate();
      return;
    }
    updateRules();
  } else if (alarm.name === JITTER_ALARM_NAME) {
    updateRules();
  }
});

// Lyt efter live-ændringer i Google Admin Console
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'managed') {
    LetSpaerLog.log('[LetSpær:BG] Ændringer registreret i managed storage – opdaterer regler og alarm.');
    updateRules();
    ensureAlarm();
    updateActionPopup();
  }
});

// Ny installation eller ny version: opdater med det samme
// (regelformatet kan have ændret sig mellem versioner)
chrome.runtime.onInstalled.addListener(() => {
  LetSpaerLog.log('[LetSpær:BG] Extension installeret/opdateret.');
  updateRules();
  ensureAlarm();
  updateActionPopup();
});

// Browserstart: de dynamiske regler fra sidst er stadig aktive,
// så vi henter kun, hvis listen er forældet – og spreder hentningen ud.
chrome.runtime.onStartup.addListener(async () => {
  const config = await getConfig();
  await ensureAlarm(config);
  await updateActionPopup(config);
  const { lastUpdate = 0 } = await chrome.storage.local.get('lastUpdate');
  if (Date.now() - lastUpdate > getIntervalMs(config)) {
    LetSpaerLog.log('[LetSpær:BG] Browser startet – listen er forældet, planlægger spredt opdatering.');
    scheduleJitteredUpdate();
  }
});

// =================================================
// FEJLSØGNING: LetSpær-ikonet åbner kun en popup, når debugLogging er slået til
// =================================================
async function updateActionPopup(config) {
  const cfg = config || await getConfig();
  const debug = cfg.debugLogging === 'enabled';
  try {
    await chrome.action.setPopup({ popup: debug ? 'popup.html' : '' });
    await chrome.action.setTitle({ title: debug ? 'LetSpær – vis og send pointscore for denne side' : 'LetSpær' });
  } catch (e) {
    LetSpaerLog.error('[LetSpær:BG] Kunne ikke opdatere popup:', e);
  }
}

// Når Service Workeren vågner, sikrer vi kun at alarmen findes.
// Vi henter IKKE CSV'en her, da workeren vågner mange gange i løbet af dagen.
ensureAlarm();
updateActionPopup();

// =================================================
// UNDERVISNINGSTJENESTER (undtaget fra automatisk analyse)
// =================================================
// Matchlogikken ligger i education-list.js.
// Adresserne fra educationCsvUrl gemmes i chrome.storage.local ved hver opdatering.
async function getEducationList() {
  const { educationList = [] } = await chrome.storage.local.get('educationList');
  return educationList;
}

// Tjek om hovedfanen er en typisk gratishost/portal til indlejrede spil
function isGameHostingPlatform(urlStr) {
  if (!urlStr) return false;
  const hostingDomains = [
    'sites.google.com',
    'github.io',
    'netlify.app',
    'vercel.app',
    'pages.dev'
  ];
  try {
    const hostname = new URL(urlStr).hostname.toLowerCase();
    return hostingDomains.some(domain => hostname === domain || hostname.endsWith('.' + domain));
  } catch (e) {
    return false;
  }
}

// Hent korrekt blokeringsside (intern eller ekstern via Google Admin policy)
async function getBlockRedirectUrl(reason = '', domain = '', debugInfo = null) {
  let base = chrome.runtime.getURL('blocked.html');
  let debug = false;
  try {
    const config = await getConfig();
    base = getRedirectBase(config);
    debug = config.debugLogging === 'enabled';
  } catch (e) {}

  const params = {};
  if (reason) params.reason = reason;
  if (domain) params.domain = domain;

  // Ved fejlsøgning får blokeringssiden point, signaler og sti med,
  // så de kan sendes videre derfra. Uden fejlsøgning sendes kun årsag og domæne.
  if (debug && debugInfo) {
    if (typeof debugInfo.score === 'number') params.score = String(debugInfo.score);
    if (Array.isArray(debugInfo.signals)) params.signals = JSON.stringify(debugInfo.signals.slice(0, 30));
    if (debugInfo.page) params.page = debugInfo.page;
  }
  return appendParams(base, params);
}

async function handleViolation(message, sender) {
  const tabUrl = sender.tab?.url || sender.url || '';
  const frameUrl = sender.url || tabUrl;
  const tabHost = hostnameOf(tabUrl);
  const frameHost = hostnameOf(frameUrl) || tabHost;

  // Ignorer hvis fanen eller selve rammen (iframen) er en undervisningstjeneste.
  // Det dækker både en godkendt tjeneste indlejret på en anden side og
  // indhold indlejret på en godkendt side (fx en lærers Google Site).
  const educationList = await getEducationList();
  if (letspaerIsEducationService(tabUrl, educationList) || letspaerIsEducationService(frameUrl, educationList)) {
    LetSpaerLog.log(`[LetSpær:BG] Ignorerer overtrædelse på undervisningstjeneste: ${frameHost} (årsag: ${message.reason})`);
    return { action: 'ignore' };
  }

  const isSubFrame = typeof sender.frameId === 'number' && sender.frameId > 0;

  // Hvis spillet ligger i en iframe på en almindelig hjemmeside (ikke Google Sites/GitHub osv.),
  // beder vi content_analyzer.js om kun at blokere selve iframen i stedet for at lukke hele fanen
  if (isSubFrame && !isGameHostingPlatform(tabUrl)) {
    LetSpaerLog.log(`[LetSpær:BG] Isoleret iframe overtrædelse opdaget på ${tabHost} (Frame ID: ${sender.frameId}). Sender blockFrameOnly.`);
    const redirectUrl = await getBlockRedirectUrl('iframe_game', frameHost, message);

    // Ved fejlsøgning får fanens øverste ramme besked, så LetSpær-popuppen kan vise,
    // hvad der blev blokeret i iframen (den blokerede iframe kan ikke selv svare).
    if (LetSpaerLog.isEnabled() && sender.tab && sender.tab.id) {
      chrome.tabs.sendMessage(sender.tab.id, {
        action: 'letspaerFrameBlocked',
        page: message.page || frameHost,
        score: message.score,
        signals: message.signals
      }, { frameId: 0 }).catch(() => {});
    }
    return { action: 'blockFrameOnly', redirectUrl };
  }

  // Ellers blokerer vi hele fanen
  if (sender.tab && sender.tab.id) {
    LetSpaerLog.warn(`[LetSpær:BG] Blokerer hele fanen ${tabHost} (årsag: ${message.reason})`);
    const reasonCode = message.reason === 'game' ? 'heuristic_game' : message.reason;
    const redirectUrl = await getBlockRedirectUrl(reasonCode, tabHost, message);
    chrome.tabs.update(sender.tab.id, { url: redirectUrl });
  }
  return { action: 'tabBlocked' };
}

// =================================================
// LYTTER: Modtag spil-alarmer fra content_analyzer.js
// =================================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action !== 'violationDetected') return false;
  handleViolation(message, sender)
    .then(sendResponse)
    .catch((err) => {
      LetSpaerLog.error('[LetSpær:BG] Fejl ved håndtering af overtrædelse:', err);
      sendResponse({ action: 'ignore' });
    });
  return true; // Hold beskedkanalen åben til asynkront svar
});
