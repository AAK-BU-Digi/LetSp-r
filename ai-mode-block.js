// ai-mode-block.js

// =============== SIKKERHEDS-VENTIL ===============
// Da manifestet nu siger <all_urls>, kører dette script på ALLE hjemmesider.
// Vi skal stoppe scriptet STRAKS, hvis vi ikke er på Google, for ikke at sløve andre sider.
(function failFast() {
  const host = location.hostname;
  // Tjekker om "google" indgår i domænet (f.eks. google.com, google.co.jp, google.dk)
  if (!host.includes("google")) return; // STOP HER
  
  // Hvis vi er her, er det en Google-side. Start "LetSpær" logikken.
  initLetSpaer();
})();

function initLetSpaer() {
  console.log("LetSpær: Google Focus Mode aktiveret på", location.hostname);

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
    // Hvis ingen nøgleord findes, er det ikke knappen
    if (!keywords.some(k => text.includes(k) || aria.includes(k))) return false;

    // Performance tjek: Er elementet for stort til at være en knap?
    try {
      const rect = el.getBoundingClientRect();
      if (rect.width > 400 || rect.height > 150) return false;
    } catch (e) {}

    return true;
  }

  function scanAndHide(scope) {
    scope = scope || document;
    
    // 1. Fjern kendte bokse
    CONFIG.aiSelectors.forEach(selector => {
      scope.querySelectorAll(selector).forEach(hideElement);
    });

    // 2. Fjern knapper baseret på tekst
    scope.querySelectorAll('button, a, div[role="button"]').forEach(btn => {
      if (isAiModeButton(btn)) hideElement(btn);
    });
  }

  function enforceWebResults() {
    // Kun relevant hvis vi er på /search url'en
    if (!location.pathname.startsWith("/search")) return;

    const params = new URLSearchParams(window.location.search);
    if (params.has("q") && !params.has("udm")) {
      params.set("udm", "14");
      const newUrl = window.location.origin + window.location.pathname + "?" + params.toString();
      window.location.replace(newUrl);
    }
  }

  // Kør logik
  enforceWebResults();

  // Overvåg ændringer (Google loader resultater dynamisk)
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
