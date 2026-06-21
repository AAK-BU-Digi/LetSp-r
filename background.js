// background.js - Manifest V3

let updateInterval = 1800000; // 30 minutter default
let timerId = null;

// Hent konfiguration fra Google Admin Console
async function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.managed.get(
      ['sheetMode', 'dailyCsvUrl', 'examCsvUrl', 'blockedPageMode', 'blockedPageUrl', 'updateInterval'],
      (data) => resolve(data)
    );
  });
}

// Hent CSV filen fra nettet
async function fetchBlockedSites(csvUrl) {
  if (!csvUrl) return [];
  try {
    const response = await fetch(csvUrl);
    const text = await response.text();
    // Konverter CSV tekst til array af domæner
    return text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  } catch (error) {
    console.error('LetSpær: Kunne ikke hente blokeringer:', error);
    return [];
  }
}

// Opdater browserens blokeringsregler
async function updateRules() {
  const config = await getConfig();
  
  updateInterval = config.updateInterval || 1800000;
  const sheetMode = config.sheetMode || 'daily';
  const csvUrl = (sheetMode === 'exam') ? config.examCsvUrl : config.dailyCsvUrl;
  
  const redirectUrl = chrome.runtime.getURL('blocked.html');

  const sites = await fetchBlockedSites(csvUrl);
  if (sites.length === 0) return;

  // Konverter domæner til Manifest V3 regler
  const newRules = sites.map((site, index) => {
    // Hvis CSV siger "facebook.com", laver vi det om til regex ".*facebook.com.*"
    // Vi fjerner evt. eksisterende * fra CSV for at undgå dobbelt wildcards
    const cleanSite = site.replace(/\*/g, ''); 
    const regexPattern = `.*${escapeRegex(cleanSite)}.*`;

    return {
      id: index + 1, // Regler skal have unikt ID
      priority: 1,
      action: {
        type: 'redirect',
        redirect: { url: redirectUrl }
      },
      condition: {
        regexFilter: regexPattern,
        resourceTypes: ['main_frame'] // Bloker kun selve sidevisningen
      }
    };
  });

  // 1. Hent eksisterende regler
  const currentRules = await chrome.declarativeNetRequest.getDynamicRules();
  const currentRuleIds = currentRules.map(rule => rule.id);

  // 2. Slet gamle og indsæt nye
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: currentRuleIds,
    addRules: newRules
  });

  console.log(`LetSpær: Opdateret. ${newRules.length} sider blokeret.`);
}

function escapeRegex(string) {
  return string.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

// Loop til løbende opdatering
function startLoop() {
  updateRules();
  if (timerId) clearInterval(timerId);
  timerId = setInterval(updateRules, updateInterval);
}

// Lyt efter live-ændringer i Admin Console
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'managed') {
    startLoop();
  }
});

// Start ved opstart
startLoop();

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
        'accounts.google.com', 'testogprøver.dk', 'skoleporten.dk', 'minuddannelse.dk',
        'restudy.dk', 'sofaskolen.dk', 'emu.dk', 'skolon.com', 'alinea.dk',
        'meebook.com', 'easyiq.dk', 'unilogin.dk', 'mitid.dk',
        'forms.google.com', 'sheets.google.com', 'keep.google.com',
        'mail.google.com', 'meet.google.com', 'calendar.google.com',
        'kahoot.com', 'quizlet.com', 'geogebra.org', 'code.org',
        'wikipedia.org', 'dr.dk', 'denstoredanske.lex.dk', 'duda.dk'
    ];
    try {
        const hostname = new URL(urlStr).hostname.toLowerCase();
        return coreSchoolSites.some(site => hostname.includes(site));
    } catch(e) {
        return false;
    }
}

// =================================================
// LYTTER: Modtag spil
// =================================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "violationDetected") {
    const tabUrl = sender.tab?.url || '';
    
    // Ignorer hvis eleven befinder sig på en godkendt skoleside
    if (isSafeSchoolUrl(tabUrl)) {
        console.log(` LetSpær: Ignorerer overtrædelse på hvidlistet URL: ${tabUrl} (Årsag: ${message.reason})`);
        return;
    }

    if (sender.tab && sender.tab.id) {
      console.log(` LetSpær: Blokerer ${sender.tab.url} (Årsag: ${message.reason})`);
      
      chrome.tabs.update(sender.tab.id, { url: chrome.runtime.getURL('blocked.html') });
    }
  }
});
