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
  
  // Bestem hvor eleven skal sendes hen ved blokering
  let redirectUrl = chrome.runtime.getURL('blocked.html');
  if (config.blockedPageMode === 'external' && config.blockedPageUrl) {
    redirectUrl = config.blockedPageUrl;
  }

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
