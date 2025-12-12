// ai-mode-block.js

// 1. HURTIGT TJEK: Er vi på Google?
// Hvis ikke, stopper vi straks for at spare ressourcer på alle andre sider.
(function preCheck() {
  const host = location.hostname;
  if (!host.includes("google")) return; // Stop her, hvis det ikke er Google
  
  // 2. TJEK KONFIGURATION: Er AI-blokering slået til?
  // Vi henter indstillingen fra Managed Storage. Standard er "enabled" hvis intet er sat.
  chrome.storage.managed.get(['aiBlockMode'], function(data) {
    const mode = data.aiBlockMode || 'enabled'; // Standard = aktiv
    
    if (mode === 'enabled') {
      // Kun hvis den er enabled, starter vi selve motoren
      initLetSpaer();
    } else {
      console.log("LetSpær: AI-blokering er deaktiveret via Admin Console.");
    }
  });
})();

// Denne funktion indeholder alt det "tunge" arbejde
function initLetSpaer() {
  console.log("LetSpær: Google Focus Mode starter...");

  const CONFIG = {
    aiSelectors: [
      'div.hdzaWe',
      'div[jsname="yDeuDf"]',
      'div[data-attrid="ai_overview"]',
      'div[aria-label="AI Overview"]',
      'div[aria-label="AI-oversigt"]',
      'a[href*="/search?"][role="button"]'
    ]
  };

  function hideElement(el) {
    if (!el || el.dataset.aiHidden === "1") return;
    el.style.setProperty("display", "none", "important");
    el.setAttribute("aria-hidden", "true");
    el.dataset.aiHidden = "1";
  }

  function isAiModeButton(el) {
    if (!el) return false;
    const text = (el.innerText || el.textContent || "").toLowerCase();
    const aria = (el.getAttribute("aria-label") || "").toLowerCase();
    
    const keywords = ["ai mode", "ai-tilstand", "ai overview", "ai-oversigt"];
    if (!keywords.some(k => text.includes(k) || aria.includes(k))) return false;

    try {
      const rect = el.getBoundingClientRect();
      if (rect.width > 400 || rect.height > 150) return false;
    } catch (e) {}
    return true;
  }

  function scanAndHide(scope) {
    scope = scope || document;
    
    CONFIG.aiSelectors.forEach(selector => {
      scope.querySelectorAll(selector).forEach(hideElement);
    });

    scope.querySelectorAll('button, a, div[role="button"]').forEach(btn => {
      if (isAiModeButton(btn)) hideElement(btn);
    });
  }

  function enforceWebResults() {
    if (!location.pathname.startsWith("/search")) return;

    const params = new URLSearchParams(window.location.search);
    if (params.has("q") && !params.has("udm")) {
      params.set("udm", "14");
      const newUrl = window.location.origin + window.location.pathname + "?" + params.toString();
      window.location.replace(newUrl);
    }
  }

  // Kør logikken
  enforceWebResults();

  const observer = new MutationObserver(() => {
    requestAnimationFrame(() => scanAndHide(document));
  });
  
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => scanAndHide(document));
  } else {
    scanAndHide(document);
  }
}
