/**
 * LetSpær V3 Core Engine - AI Cleaner Module (Split Logic Edition)
 * Powered by NetShield Technology
 * Source: https://github.com/math14f/NetShield
 * Licensed under MIT License
 */

// ================= KONFIGURATION =================
const NETSHIELD_CONFIG = {
    // Tilføj de tekster der står på selve knapperne her (alle sprog)
    buttonTexts: ['AI-tilstand', 'AI Mode', 'AI-Modus', 'KI-Modus'],
    
    // Tilføj de tekster der bruges i AI-oversigt boksen her
    overviewTexts: ['AI-oversigt', 'AI Overview', 'AI-Übersicht', 'KI-Übersicht']
};
// =================================================

// SIKKERHEDS-TJEK: Kør kun på Google
if (window.location.hostname.includes("google.")) {

    // VARIABEL til at tjekke, om vi er på forsiden eller ej
    const isOnSearchPage = window.location.pathname.includes('/search');

    // =======================================================
    // DEL 1: KODE TIL FORSIDEN (Lynhurtig, kun knap)
    // =======================================================
    if (!isOnSearchPage) {
        
        const hideFrontpageButton = () => {
            const spans = document.querySelectorAll('span');
            for (const span of spans) {
                // Tjekker om span-teksten findes i vores konfigurations-liste
                if (NETSHIELD_CONFIG.buttonTexts.includes(span.textContent.trim())) {
                    const buttonContainer = span.closest('button') || span.closest('a') || span.closest('div[role="button"]');
                    if (buttonContainer && buttonContainer.style.display !== 'none') {
                        buttonContainer.style.display = 'none';
                        console.log("LetSpær Core (NetShield): Forside knap fjernet (" + span.textContent + ")");
                    }
                }
            }
        };

        // Aggressiv kørsel for at fjerne "blink"
        hideFrontpageButton();
        setTimeout(hideFrontpageButton, 1);
        setTimeout(hideFrontpageButton, 50);

        // En simpel observer, der kun leder efter knappen
        const observer = new MutationObserver(hideFrontpageButton);
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    // =======================================================
    // DEL 2: KODE TIL SØGESIDEN (NetShield robuste fulde scanner)
    // =======================================================
    if (isOnSearchPage) {

        const hideAllAIElements = () => {
            // Scan efter AI-oversigten
            const allElements = document.querySelectorAll('div, span, h1');
            for (const element of allElements) {
                // Tjekker om elementet indeholder nogle af ordene fra overview-listen
                if (element.textContent && NETSHIELD_CONFIG.overviewTexts.some(text => element.textContent.includes(text))) {
                    const container = element.closest('div[jscontroller]');
                    if (container && container.style.display !== 'none') {
                        container.style.display = 'none';
                    }
                }
            }

            // Scan efter AI-tilstand (på søgesiden)
            const spans = document.querySelectorAll('span');
            for (const span of spans) {
                // Tjekker om span-teksten findes i vores konfigurations-liste
                if (NETSHIELD_CONFIG.buttonTexts.includes(span.textContent.trim())) {
                    const buttonContainer = span.closest('div[role="listitem"]');
                    if (buttonContainer && buttonContainer.style.display !== 'none') {
                        buttonContainer.style.display = 'none';
                    }
                }
            }
        };

        // Kør med det samme
        hideAllAIElements();

        // Start den fulde observer
        const observer = new MutationObserver(hideAllAIElements);
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }
}
