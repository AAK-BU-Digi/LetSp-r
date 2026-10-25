/**
 * LetSpær V3 Core Engine - AI Cleaner Module
 * Version 1.5 - Safe DOM Targeting & Managed Policy Support
 * Powered by NetShield Technology
 * Licensed under MIT License
 */

const NETSHIELD_CONFIG = {
  // Tekst vi leder efter på søgemaskiner for at skjule AI-knapper/faner
  buttonTexts: ['AI-tilstand', 'AI Mode', 'AI-Modus', 'KI-Modus', 'Chat'],
  overviewTexts: ['AI-oversigt', 'AI Overview', 'AI-Übersicht', 'KI-Übersicht']
};

function initAiBlocker() {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;

  const isGoogle = hostname.includes('google.');
  const isBing = hostname.includes('bing.');
  const isEcosia = hostname.includes('ecosia.');
  const isImageSearch = window.location.search.includes('tbm=isch');

  // --- A: GOOGLE LOGIK ---
  if (isGoogle && !isImageSearch) {
    const isOnSearchPage = pathname.includes('/search');

    if (!isOnSearchPage) {
      // Forsiden
      const hideFrontpageButton = () => {
        const spans = document.querySelectorAll('span');
        for (const span of spans) {
          if (NETSHIELD_CONFIG.buttonTexts.includes(span.textContent.trim())) {
            const btn = span.closest('button, a, div[role="button"]');
            if (btn && btn.style.display !== 'none') {
              btn.style.display = 'none';
              console.log('[LetSpær:AI] Skjulte AI-knap på Google forside:', span.textContent.trim());
            }
          }
        }
      };
      hideFrontpageButton();
      new MutationObserver(hideFrontpageButton).observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }

    if (isOnSearchPage) {
      // Søgesiden
      const hideAllAIElements = () => {
        // 1. Skjul "AI Overview" / "AI-oversigt" bokse sikkert uden at skjule hele søgeresultatet (#search / #rso)
        const headings = document.querySelectorAll('h1, h2, div[role="heading"], span');
        headings.forEach(el => {
          const text = el.textContent.trim();
          if (NETSHIELD_CONFIG.overviewTexts.includes(text)) {
            const container = el.closest('div[data-mcpr], div[jscontroller], div[data-hveid]');
            if (
              container &&
              !container.querySelector('#rso') &&
              !container.querySelector('#search') &&
              container.id !== 'rcnt' &&
              container.id !== 'center_col'
            ) {
              if (container.style.display !== 'none') {
                container.style.display = 'none';
                console.log('[LetSpær:AI] Skjulte Google AI Overview container for:', text);
              }
            }
          }
        });

        // 2. Skjul AI-knapper i topmenuen
        document.querySelectorAll('span, div[role="tab"]').forEach(el => {
          if (NETSHIELD_CONFIG.buttonTexts.includes(el.textContent.trim())) {
            const btn = el.closest('div[role="listitem"], a, div[role="tab"]');
            if (btn && btn.style.display !== 'none') {
              btn.style.display = 'none';
              console.log('[LetSpær:AI] Skjulte AI-knap i Google menu:', el.textContent.trim());
            }
          }
        });
      };

      hideAllAIElements();
      new MutationObserver(hideAllAIElements).observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }
  }

  // --- B: BING LOGIK ---
  if (isBing) {
    if (pathname.includes('/copilotsearch')) {
      const q = new URLSearchParams(window.location.search).get('q') || '';
      console.warn('[LetSpær:AI] Bing Copilot søgning detekteret – omdirigerer til standard søgning.');
      window.location.replace('https://www.bing.com/search?q=' + encodeURIComponent(q));
      return;
    }

    const hideBingAI = () => {
      document.querySelectorAll('a[href*="/copilotsearch"], #b-scopeListItem-conv').forEach(link => {
        const container = link.closest('li') || link;
        if (container.style.display !== 'none') {
          container.style.display = 'none';
          console.log('[LetSpær:AI] Skjulte Bing Copilot link.');
        }
      });
      document.querySelectorAll('.gs_main, #b_copilot_search_container').forEach(el => {
        if (el.style.display !== 'none') {
          el.style.display = 'none';
          console.log('[LetSpær:AI] Skjulte Bing Copilot container.');
        }
      });
      document.querySelectorAll('iframe').forEach(iframe => {
        if (iframe.src && iframe.src.includes('cpltsrchif=1')) {
          console.log('[LetSpær:AI] Fjernede Bing Copilot iframe.');
          iframe.remove();
        }
      });
    };

    hideBingAI();
    new MutationObserver(hideBingAI).observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  // --- C: ECOSIA LOGIK ---
  if (isEcosia) {
    // 1. HARD BLOCK: Hvis de prøver at gå ind på siden direkte
    if (pathname.includes('/ai-search') || pathname.includes('/chat')) {
      const q = new URLSearchParams(window.location.search).get('q') || '';
      console.warn('[LetSpær:AI] Ecosia AI-sti detekteret – omdirigerer til standard søgning.');
      window.location.replace('https://www.ecosia.org/search?q=' + encodeURIComponent(q));
      return;
    }

    // 2. Skjul knapperne
    const hideEcosiaAI = () => {
      const aiButtons = document.querySelectorAll('a[href*="/ai-search"], a[href*="/chat"]');
      for (const btn of aiButtons) {
        const container = btn.closest('li') || btn;
        if (container.style.display !== 'none') {
          container.style.display = 'none';
          console.log('[LetSpær:AI] Skjulte Ecosia AI knap.');
        }
      }

      const tabNavs = document.querySelectorAll('[data-test-id="tab-navigation-item"]');
      tabNavs.forEach(tab => {
        const text = (tab.textContent || '').trim();
        if (text.includes('Chat') || text.includes('AI')) {
          if (tab.style.display !== 'none') {
            tab.style.display = 'none';
            console.log('[LetSpær:AI] Skjulte Ecosia AI fanebjælke.');
          }
        }
      });
    };

    hideEcosiaAI();
    new MutationObserver(hideEcosiaAI).observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }
}

// Tjek i Google Admin Console om aiBlockMode er slået til (default: enabled)
if (chrome.storage && chrome.storage.managed) {
  chrome.storage.managed.get(['aiBlockMode'], (data) => {
    if (chrome.runtime.lastError || !data || data.aiBlockMode !== 'disabled') {
      initAiBlocker();
    }
  });
} else {
  initAiBlocker();
}