const INTERNAL_BLOCKED_PAGE = chrome.runtime.getURL('blocked.html');

let blockedSites = [];
let dailyCsvUrl = '';
let examCsvUrl = '';
let blockedPageMode = 'internal';
let blockedPageUrl = '';
let updateInterval = 1800000; // Standardinterval: 30 minutter

function fetchConfig() {
  chrome.storage.managed.get(
    ['dailyCsvUrl', 'examCsvUrl', 'blockedPageMode', 'blockedPageUrl', 'updateInterval'],
    function(data) {
      dailyCsvUrl = data.dailyCsvUrl || '';
      examCsvUrl = data.examCsvUrl || '';
      blockedPageMode = data.blockedPageMode || 'internal';
      blockedPageUrl = data.blockedPageUrl || '';
      updateInterval = data.updateInterval || 1800000;
      updateBlockedSites();
    }
  );
}

function fetchBlockedSites(csvUrl) {
  if (!csvUrl) {
    console.error('CSV-URL mangler.');
    return;
  }
  fetch(csvUrl)
    .then(response => response.text())
    .then(csv => {
      blockedSites = csv.split('\n').map(line => line.trim()).filter(line => line !== '');
    })
    .catch(error => console.error('Fejl ved hentning af websteder:', error));
}

function updateBlockedSites() {
  chrome.storage.managed.get('sheetMode', function(data) {
    const sheetMode = data.sheetMode || 'daily';
    if (sheetMode === 'exam') {
      fetchBlockedSites(examCsvUrl);
    } else {
      fetchBlockedSites(dailyCsvUrl);
    }
  });
}

fetchConfig();
setInterval(fetchConfig, updateInterval); // Brug konfigureret interval

chrome.webRequest.onBeforeRequest.addListener(function(details) {
  if (isBlocked(details.url)) {
    let redirectUrl = INTERNAL_BLOCKED_PAGE;
    if (blockedPageMode === 'external' && blockedPageUrl) {
      redirectUrl = blockedPageUrl;
    }
    return { redirectUrl: redirectUrl };
  }
  return { cancel: false };
}, { urls: ['<all_urls>'] }, ['blocking']);

function isBlocked(url) {
  for (let site of blockedSites) {
    // Erstat '*' med et regex-wildcard
    let regexSite = site.replace(/\*/g, '.*');
    let regex = new RegExp(regexSite);
    if (regex.test(url)) {
      return true;
    }
  }
  return false;
}