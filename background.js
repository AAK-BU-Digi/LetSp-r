// background.js - Manifest V3

const DEFAULT_UPDATE_INTERVAL_MS = 1800000; // 30 minutter default
const ALARM_NAME = 'letspaer_update_rules';
let isUpdating = false;

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
        'aiBlockMode'
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

// Hent og rens CSV-filen fra nettet (inkl. automatisk Punycode-konvertering af æ, ø og å)
async function fetchBlockedSites(csvUrl) {
  if (!csvUrl) return [];
  try {
    const response = await fetch(csvUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();

    // Konverter CSV-tekst til et rent array af unikke ASCII-domæner/stier
    const cleaned = text
      .split(/\r?\n/)
      .map(line => line.split(',')[0]) // Tag kun første kolonne, hvis der er flere
      .map(line => line.replace(/["'*]/g, '').trim().toLowerCase()) // Fjern anførselstegn og *
      .map(line => line.replace(/^https?:\/\//i, '')) // Fjern http:// og https://
      .map(line => line.replace(/^www\./i, '')) // Fjern www. så || matcher både med og uden www
      .map(line => line.replace(/\/+$/, '')) // Fjern evt. afsluttende skråstreg
      .filter(line => line.length > 0 && line.includes('.') && !line.includes(' '))
      .map(line => {
        try {
          // Oversætter automatisk æ, ø, å i domæner til ASCII Punycode (xn--...), som Chrome kræver
          const urlObj = new URL('http://' + line);
          const path = (urlObj.pathname && urlObj.pathname !== '/') ? urlObj.pathname : '';
          return urlObj.hostname + path;
        } catch (e) {
          return '';
        }
      })
      .filter(line => line.length > 0 && /^[\x00-\x7F]+$/.test(line)); // Sikrer kun gyldige ASCII-tegn

    return [...new Set(cleaned)];
  } catch (error) {
    console.error('LetSpær: Kunne ikke hente blokeringer:', error);
    return [];
  }
}

// Opdater browserens blokeringsregler
async function updateRules() {
  if (isUpdating) return;
  isUpdating = true;

  try {
    const config = await getConfig();
    const sheetMode = config.sheetMode || 'daily';
    const csvUrl = (sheetMode === 'exam') ? config.examCsvUrl : config.dailyCsvUrl;
    const aiBlockEnabled = config.aiBlockMode !== 'disabled'; // Aktiv som standard

    // Bestem hvor eleven skal sendes hen ved blokering
    let redirectUrl = chrome.runtime.getURL('blocked.html');
    if (config.blockedPageMode === 'external' && config.blockedPageUrl) {
      redirectUrl = config.blockedPageUrl;
    }

    const sites = await fetchBlockedSites(csvUrl);
    const newRules = [];

    // 1. Konverter CSV-domæner til Manifest V3 urlFilter-regler
    sites.forEach((cleanSite, index) => {
      // Hvis indgangen kun er et domæne (uden '/'), bruger vi '^' som separator i slutningen,
      // så fx "||spil.dk^" blokerer spil.dk og subdomæner, men ikke "eksempel-spil.dk"
      const filterPattern = cleanSite.includes('/')
        ? `||${cleanSite}`
        : `||${cleanSite}^`;

      newRules.push({
        id: index + 1,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: { url: redirectUrl }
        },
        condition: {
          urlFilter: filterPattern,
          resourceTypes: ['main_frame']
        }
      });
    });

    // 2. Tilføj netværksblokering af AI-endepunkter på søgemaskiner, hvis aiBlockMode er aktiv
    if (aiBlockEnabled) {
      const aiUrlPatterns = [
        'cpltsrchif=1',
        '/copilotsearch',
        'FORM=DEEPSH'
      ];
      const baseAiRuleId = 25000;

      aiUrlPatterns.forEach((pattern, idx) => {
        newRules.push({
          id: baseAiRuleId + idx,
          priority: 2,
          action: { type: 'block' },
          condition: {
            urlFilter: pattern,
            initiatorDomains: ['bing.com', 'ecosia.org'],
            resourceTypes: ['xmlhttprequest', 'sub_frame', 'other']
          }
        });
      });
    }

    // Opdater kun hvis vi enten har hentet CSV-regler eller ikke har nogen CSV-URL sat
    if (sites.length > 0 || !csvUrl) {
      const currentRules = await chrome.declarativeNetRequest.getDynamicRules();
      const currentRuleIds = currentRules.map(rule => rule.id);

      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: currentRuleIds,
        addRules: newRules
      });

      console.log(`LetSpær: Opdateret. ${sites.length} domæner blokeret (AI-filter: ${aiBlockEnabled ? 'til' : 'fra'}).`);
    }
  } catch (err) {
    console.error('LetSpær: Fejl under opdatering af regler:', err);
  } finally {
    isUpdating = false;
  }
}

// Opsæt periodisk alarm (overlever at Service Workeren går i dvale)
async function setupAlarm() {
  const config = await getConfig();
  const intervalMs = config.updateInterval || DEFAULT_UPDATE_INTERVAL_MS;
  const periodInMinutes = Math.max(1, Math.round(intervalMs / 60000));

  await chrome.alarms.clear(ALARM_NAME);
  chrome.alarms.create(ALARM_NAME, { periodInMinutes });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    updateRules();
  }
});

// Lyt efter live-ændringer i Google Admin Console
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'managed') {
    updateRules();
    setupAlarm();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  updateRules();
  setupAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  updateRules();
  setupAlarm();
});

// Kør en opdatering når Service Workeren indlæses
updateRules();
setupAlarm();

// =================================================
// SIKKERHEDSNET: Godkendte skolesider
// =================================================
function isSafeSchoolUrl(urlStr) {
  if (!urlStr) return false;
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
    const hostname = new URL(urlStr).hostname.toLowerCase();
    return coreSchoolSites.some(site => hostname === site || hostname.endsWith('.' + site));
  } catch (e) {
    return false;
  }
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
async function getBlockRedirectUrl() {
  try {
    const config = await getConfig();
    if (config.blockedPageMode === 'external' && config.blockedPageUrl) {
      return config.blockedPageUrl;
    }
  } catch (e) {}
  return chrome.runtime.getURL('blocked.html');
}

// =================================================
// LYTTER: Modtag spil-alarmer fra content_analyzer.js
// =================================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'violationDetected') {
    const tabUrl = sender.tab?.url || sender.url || '';

    // Ignorer hvis eleven befinder sig på en godkendt skoleside
    if (isSafeSchoolUrl(tabUrl)) {
      console.log(`LetSpær: Ignorerer overtrædelse på hvidlistet URL: ${tabUrl} (årsag: ${message.reason})`);
      sendResponse({ action: 'ignore' });
      return true;
    }

    const isSubFrame = typeof sender.frameId === 'number' && sender.frameId > 0;

    // Hvis spillet ligger i en iframe på en almindelig hjemmeside (ikke Google Sites/GitHub osv.),
    // beder vi content_analyzer.js om kun at blokere selve iframen i stedet for at lukke hele fanen
    if (isSubFrame && !isGameHostingPlatform(tabUrl)) {
      getBlockRedirectUrl().then((redirectUrl) => {
        sendResponse({ action: 'blockFrameOnly', redirectUrl });
      });
      return true; // Hold beskedkanalen åben til asynkront svar
    }

    // Ellers blokerer vi hele fanen
    if (sender.tab && sender.tab.id) {
      console.log(`LetSpær: Blokerer fane ${tabUrl} (årsag: ${message.reason})`);
      getBlockRedirectUrl().then((redirectUrl) => {
        chrome.tabs.update(sender.tab.id, { url: redirectUrl });
      });
    }
    sendResponse({ action: 'tabBlocked' });
    return true;
  }
});
