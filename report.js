// report.js – bygger fejlmeldinger til en pilot (bruges af popup.js og blocked.js).
// Der indgår kun: sidens adresse uden parametre, status, point og signaler,
// version og tilstand. Intet om brugeren.

const LETSPAER_GAME_THRESHOLD = 5;

const LETSPAER_STATUS_TEXT = {
  blocked_list: 'Blokeret af blokeringslisten',
  blocked_game: 'Blokeret af spil-detektionen',
  blocked_iframe: 'Indlejret indhold blokeret af spil-detektionen',
  scanned: 'Analyseret – ikke blokeret',
  ignored_education: 'Over grænsen, men undtaget som undervisningstjeneste',
  education: 'Undervisningstjeneste – analyseres ikke',
  small_iframe: 'Lille ramme – analyseres ikke',
  pending: 'Ikke analyseret endnu',
  unavailable: 'LetSpær analyserer ikke denne side'
};

// Kun værtsnavn og sti – aldrig forespørgsel (?…) eller fragment (#…)
function letspaerSafePageUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return url.protocol.replace(':', '');
    return url.hostname + (url.pathname === '/' ? '' : url.pathname);
  } catch (e) {
    return '';
  }
}

function letspaerStatusText(status) {
  return LETSPAER_STATUS_TEXT[status] || status || 'Ukendt';
}

// info: { page, status, score, signals, frames: [{ page, status, score, signals }], version, mode }
function letspaerBuildReport(info) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const time = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const signals = info.signals || [];
  const hasScore = typeof info.score === 'number';
  const domain = (info.page || '').split('/')[0];

  const lines = [
    'LetSpær fejlmelding',
    `Tidspunkt: ${time}`,
    `Version: ${info.version || '?'} (tilstand: ${info.mode || '?'})`,
    `Side: ${info.page || '?'}`,
    `Status: ${letspaerStatusText(info.status)}`
  ];
  if (hasScore) lines.push(`Point: ${info.score} (grænse ${LETSPAER_GAME_THRESHOLD})`);
  if (signals.length) {
    lines.push('', 'Signaler:');
    signals.forEach(s => lines.push(`- ${s}`));
  }

  const frames = info.frames || [];
  if (frames.length) {
    lines.push('', 'Indlejrede rammer:');
    frames.forEach(f => {
      lines.push(`- ${f.page}: ${letspaerStatusText(f.status)}${typeof f.score === 'number' ? `, ${f.score} point` : ''}`);
      (f.signals || []).forEach(s => lines.push(`    - ${s}`));
    });
  }
  if (info.hiddenFrames) {
    lines.push(`(${info.hiddenFrames} rammer uden fund er udeladt)`);
  }

  const text = lines.join('\n');
  return {
    text,
    fields: {
      domain,
      url: info.page || '',
      status: letspaerStatusText(info.status),
      score: hasScore ? String(info.score) : '',
      signals: signals.join('; '),
      version: info.version || '',
      mode: info.mode || '',
      time,
      details: text.length > 1500 ? text.slice(0, 1500) + '\n[forkortet]' : text
    }
  };
}

// Udfylder pladsholdere som {domain} og {details} i et forudfyldt Google Formular-link
function letspaerFormUrl(template, fields) {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(fields, key) ? encodeURIComponent(fields[key]) : match
  );
}

// Fortolker en blokeringsside-URL (intern eller ekstern) til rapport-info
function letspaerInfoFromBlockedUrl(urlStr) {
  const params = new URL(urlStr).searchParams;
  const reason = params.get('reason') || '';
  const statusByReason = {
    csv: 'blocked_list',
    list: 'blocked_list',
    heuristic_game: 'blocked_game',
    game: 'blocked_game',
    iframe_game: 'blocked_iframe'
  };
  let signals = [];
  try {
    signals = JSON.parse(params.get('signals') || '[]');
  } catch (e) {}
  const score = params.has('score') ? Number(params.get('score')) : undefined;
  return {
    page: params.get('page') || params.get('domain') || '',
    status: statusByReason[reason] || reason,
    score: Number.isFinite(score) ? score : undefined,
    signals: Array.isArray(signals) ? signals : []
  };
}
