// =============== CONFIG & SIKKERHED ===============
const CONFIG = {
  // Vi tillader scriptet at køre, men tjekker en ekstra gang for en sikkerheds skyld
  allowedHosts: ["google.com", "google.dk", "www.google.com", "www.google.dk"],
  // CSS-selektorer til AI-indhold (opdateret liste)
  aiSelectors: [
    'div.hdzaWe',
    'div[jsname="yDeuDf"]',
    'div[data-attrid="ai_overview"]',
    'div[aria-label="AI Overview"]',
    'div[aria-label="AI-oversigt"]',
    'a[href*="/search?"][role="button"]' // Generisk AI-knap fangst
  ]
};

// Ekstra sikkerhed: Stop omgående hvis vi ikke er på Google
// (Selvom manifestet styrer det, er dette en god "fail-safe")
(function safetyCheck() {
  const host = location.hostname;
  const isGoogle = host.includes("google.") || host.endsWith("google.com") || host.endsWith("google.dk");
  if (!isGoogle) return; // Stop scriptet her
})();

console.log("LetSpær: Google Focus Mode aktiveret");

// =============== HJÆLPERE ===============

function hideElement(el) {
  if (!el || el.dataset.aiHidden === "1") return;
  
  // Brug CSS classes til at skjule hvis muligt (hurtigere end inline styles)
  el.style.setProperty("display", "none", "important");
  el.setAttribute("aria-hidden", "true");
  el.dataset.aiHidden = "1";
}

function isAiModeButton(el) {
  if (!el) return false;
  
  // Hurtigt tjek: Har elementet relevant tekst?
  const text = (el.innerText || el.textContent || "").toLowerCase();
  const aria = (el.getAttribute("aria-label") || "").toLowerCase();
  
  const keywords = ["ai mode", "ai-tilstand", "ai overview", "ai-oversigt"];
  const matchesText = keywords.some(k => text.includes(k) || aria.includes(k));

  if (!matchesText) return false;

  // Tungt tjek: Kun hvis teksten matcher, måler vi størrelsen (Performance fix)
  try {
    const rect = el.getBoundingClientRect();
    // AI-knapper er små. Hvis elementet er stort (som selve søgeboksen), er det en falsk positiv.
    if (rect.width > 400 || rect.height > 150) return false;
  } catch (e) {
    // Ignorer fejl ved måling
  }

  return true;
}

// =============== HOVEDFUNKTIONER ===============

function scanAndHide(root) {
  const scope = root || document;

  // 1. Skjul baseret på kendte selektorer (Hurtigst)
  CONFIG.aiSelectors.forEach(selector => {
    const els = scope.querySelectorAll(selector);
    els.forEach(hideElement);
  });

  // 2. Skjul knapper baseret på tekst (Fallback)
  const buttons = scope.querySelectorAll('button, a, div[role="button"]');
  buttons.forEach(btn => {
    if (isAiModeButton(btn)) hideElement(btn);
  });
}

function enforceWebResults() {
  // Kun på søgeresultat-sider
  if (!location.pathname.startsWith("/search")) return;
  
  const params = new URLSearchParams(window.location.search);
  
  // Hvis vi søger ("q") og IKKE har "udm" sat
  if (params.has("q") && !params.has("udm")) {
    params.set("udm", "14"); // 14 = "Web" tab (ingen AI)
    
    const newUrl = window.location.origin + window.location.pathname + "?" + params.toString();
    window.location.replace(newUrl); // Replace undgår at "Back"-knappen fejler
  }
}

// =============== OVERVÅGNING (OBSERVER) ===============

let timeoutId = null;

function setupObserver() {
  const observer = new MutationObserver((mutations) => {
    // Performance: Vent til browseren har en pause (debounce)
    if (timeoutId) return;
    
    timeoutId = requestAnimationFrame(() => {
      scanAndHide(document);
      timeoutId = null;
    });
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

// =============== INIT ===============

(function init() {
  // 1. Tving URL parameter straks
  enforceWebResults();

  // 2. Kør første scan
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => scanAndHide(document));
  } else {
    scanAndHide(document);
  }

  // 3. Start overvågning af dynamisk indhold
  setupObserver();
  
  // 4. Blokér klik på evt. synlige AI-knapper (som sidste skanse)
  window.addEventListener("click", (e) => {
    const target = e.target.closest('button, a, [role="button"]');
    if (target && isAiModeButton(target)) {
      e.preventDefault();
      e.stopPropagation();
      hideElement(target);
    }
  }, true);
  
})();