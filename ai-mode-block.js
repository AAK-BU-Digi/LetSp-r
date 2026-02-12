/**
 * LetSpær V3 Core Engine - AI Cleaner Module
 * Version 1.3 - Performance Optimization & Multi-Search Support
 * Powered by NetShield Technology
 * Source: https://github.com/math14f/NetShield
 * Licensed under MIT License
 */
// ================= KONFIGURATION =================
const NETSHIELD_CONFIG = {
    // Tekst vi leder efter på Google for at skjule knapper
    buttonTexts: ['AI-tilstand', 'AI Mode', 'AI-Modus', 'KI-Modus', 'Chat'],
    overviewTexts: ['AI-oversigt', 'AI Overview', 'AI-Übersicht', 'KI-Übersicht'],
    
    // Mønstre i URL'er vi vil dræbe (Network Block)
    // Har tilføjet ecosia AI stier herunder
    blockedUrlPatterns: [
        'cpltsrchif=1', 
        '/copilotsearch', 
        'FORM=DEEPSH', 
        '/ai-search', 
        '/chat'
    ] 
};

// =================================================
// MODUL 1: NETWORK INTERCEPTOR (Stopper data i baggrunden)
// =================================================

// 1. Blokér "fetch" anmodninger
const originalFetch = window.fetch;
window.fetch = async function(resource, config) {
    const url = (typeof resource === 'string') ? resource : (resource?.url || '');
    // Tjek om URL'en indeholder noget fra vores sorte liste
    if (NETSHIELD_CONFIG.blockedUrlPatterns.some(pattern => url.includes(pattern))) {
        console.log("LetSpær: Blokerede en AI-anmodning (Fetch):", url);
        return Promise.reject("Blocked by LetSpær");
    }
    return originalFetch.apply(this, arguments);
};

// 2. Blokér "XHR" anmodninger
const originalOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method, url) {
    if (typeof url === 'string' && NETSHIELD_CONFIG.blockedUrlPatterns.some(pattern => url.includes(pattern))) {
        console.log("LetSpær: Blokerede en AI-anmodning (XHR):", url);
        return originalOpen.apply(this, [method, "about:blank"]); 
    }
    return originalOpen.apply(this, arguments);
};

// =================================================
// MODUL 2: VISUAL CLEANER & URL GUARD
// =================================================

const hostname = window.location.hostname;
const pathname = window.location.pathname; // Hvilken under-side er vi på?

const isGoogle = hostname.includes("google.");
const isBing = hostname.includes("bing.");
const isEcosia = hostname.includes("ecosia.");
const isImageSearch = window.location.search.includes("tbm=isch");

// --- A: GOOGLE LOGIK ---
if (isGoogle && !isImageSearch) {
    const isOnSearchPage = pathname.includes('/search');

    if (!isOnSearchPage) { // Forsiden
        const hideFrontpageButton = () => {
            const spans = document.querySelectorAll('span');
            for (const span of spans) {
                if (NETSHIELD_CONFIG.buttonTexts.includes(span.textContent.trim())) {
                    const btn = span.closest('button, a, div[role="button"]');
                    if (btn) btn.style.display = 'none';
                }
            }
        };
        new MutationObserver(hideFrontpageButton).observe(document.documentElement, { childList: true, subtree: true });
    }

    if (isOnSearchPage) { // Søgesiden
        const hideAllAIElements = () => {
            // Skjul "AI Overview" bokse
            document.querySelectorAll('div[jscontroller]').forEach(container => {
                if (NETSHIELD_CONFIG.overviewTexts.some(text => container.textContent.includes(text))) {
                    container.style.display = 'none';
                }
            });
            // Skjul AI knapper i toppen
            document.querySelectorAll('span').forEach(span => {
                if (NETSHIELD_CONFIG.buttonTexts.includes(span.textContent.trim())) {
                    const btn = span.closest('div[role="listitem"]');
                    if (btn) btn.style.display = 'none';
                }
            });
        };
        new MutationObserver(hideAllAIElements).observe(document.documentElement, { childList: true, subtree: true });
    }
}

// --- B: BING LOGIK ---
if (isBing) {
    const hideBingAI = () => {
        document.querySelectorAll('a[href*="/copilotsearch"]').forEach(link => {
            const container = link.closest('li') || link;
            container.style.display = 'none';
        });
        document.querySelectorAll('.gs_main').forEach(el => el.style.display = 'none');
        document.querySelectorAll('iframe').forEach(iframe => {
            if (iframe.src && iframe.src.includes('cpltsrchif=1')) {
                iframe.remove();
            }
        });
    };

    hideBingAI();
    new MutationObserver(hideBingAI).observe(document.documentElement, { childList: true, subtree: true });
}

// --- C: ECOSIA LOGIK (OPDATERET) ---
if (isEcosia) {
    // 1. HARD BLOCK: Hvis de prøver at gå ind på siden direkte
    if (pathname.includes('/ai-search') || pathname.includes('/chat')) {
        // Send dem tilbage til en normal søgning eller forsiden
        window.location.replace("https://www.ecosia.org/search?q=" + (new URLSearchParams(window.location.search).get("q") || ""));
    }

    // 2. Skjul knapperne
    const hideEcosiaAI = () => {
        // Skjul links der peger på ai-search eller chat
        const aiButtons = document.querySelectorAll('a[href*="/ai-search"], a[href*="/chat"]');
        
        for (const btn of aiButtons) {
            const container = btn.closest('li') || btn;
            if (container.style.display !== 'none') {
                container.style.display = 'none';
            }
        }
        
        // Skjul evt. "Ecosia Chat" faner i toppen
        const tabNavs = document.querySelectorAll('[data-test-id="tab-navigation-item"]');
        tabNavs.forEach(tab => {
            if(tab.innerText.includes("Chat") || tab.innerText.includes("AI")) {
                tab.style.display = 'none';
            }
        });
    };

    hideEcosiaAI();
    new MutationObserver(hideEcosiaAI).observe(document.documentElement, { childList: true, subtree: true });
}
