// debug.js – fælles logger for background.js, content scripts, popup og blokeringsside.
//
// Al almindelig logning er slået FRA, medmindre politikken debugLogging = "enabled".
// Fejl (LetSpaerLog.error) logges altid, så driftsproblemer stadig kan findes.
//
// Logbeskeder, der skrives før indstillingen er læst, holdes i en kort kø i
// hukommelsen og skrives ud eller kasseres, når indstillingen kendes. Intet gemmes.

const LetSpaerLog = (() => {
  let enabled = false;
  let known = false;
  let queue = [];
  const MAX_QUEUE = 50;

  function emit(level, args) {
    if (known) {
      if (enabled) console[level](...args);
    } else if (queue.length < MAX_QUEUE) {
      queue.push([level, args]);
    }
  }

  function setEnabled(value) {
    enabled = value === true;
    known = true;
    if (enabled) queue.forEach(([level, args]) => console[level](...args));
    queue = [];
  }

  function readPolicy() {
    try {
      chrome.storage.managed.get('debugLogging', (data) => {
        setEnabled(!chrome.runtime.lastError && !!data && data.debugLogging === 'enabled');
      });
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'managed' && changes.debugLogging) {
          setEnabled(changes.debugLogging.newValue === 'enabled');
        }
      });
    } catch (e) {
      setEnabled(false);
    }
  }

  readPolicy();

  return {
    log: (...args) => emit('log', args),
    warn: (...args) => emit('warn', args),
    error: (...args) => console.error(...args),
    isEnabled: () => enabled,
    // Venter på at indstillingen er læst (bruges af popup og blokeringsside)
    ready: () => new Promise((resolve) => {
      const check = () => (known ? resolve(enabled) : setTimeout(check, 20));
      check();
    })
  };
})();
