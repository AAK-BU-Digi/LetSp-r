// education-list.js – fælles for background.js (via importScripts) og content_analyzer.js
//
// Undervisningstjenester: tjenester, der er relevante i undervisningen og derfor
// undtages fra AL automatisk analyse (spil-detektion i dag, og fremtidige
// detektorer for fx webbutikker eller chatrouletter).
//
// Listen vedligeholdes udelukkende i CSV-filen i educationCsvUrl (se README).
// background.js henter den og gemmer den i chrome.storage.local under 'educationList'.
//
// Bemærk: Listen påvirker kun den automatiske analyse. Står en tjeneste både her
// og på blokeringslisten (dailyCsvUrl/examCsvUrl), bliver den blokeret.

const LETSPAER_TLD_PATTERN = /^(?:[a-z]{2,24}|xn--[a-z0-9-]+|(?:co|com|org|net|ac|edu|gov)\.[a-z]{2})$/;

// entry: { host, path, wildcardTld } – samme format som background.js gemmer
function letspaerMatchesEntry(hostname, pathname, entry) {
  let hostMatches = false;

  if (entry.wildcardTld) {
    const marker = entry.host + '.';
    let index = hostname.indexOf(marker);
    while (index !== -1) {
      const atLabelStart = index === 0 || hostname[index - 1] === '.';
      const rest = hostname.slice(index + marker.length);
      if (atLabelStart && LETSPAER_TLD_PATTERN.test(rest)) {
        hostMatches = true;
        break;
      }
      index = hostname.indexOf(marker, index + 1);
    }
  } else {
    hostMatches = hostname === entry.host || hostname.endsWith('.' + entry.host);
  }

  if (!hostMatches) return false;
  if (!entry.path) return true;

  // "/view/klasse7a" matcher "/view/klasse7a" og "/view/klasse7a/side", men ikke "/view/klasse7ab"
  return pathname === entry.path || pathname.startsWith(entry.path + '/');
}

function letspaerIsEducationService(urlStr, educationList) {
  let url;
  try {
    url = new URL(urlStr);
  } catch (e) {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname.toLowerCase().replace(/\/+$/, '') || '';

  return (educationList || []).some(entry => letspaerMatchesEntry(hostname, pathname, entry));
}
