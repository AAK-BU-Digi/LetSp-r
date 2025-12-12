/**
 * LetSpær V3 Core Engine - AI Cleaner Module (Split Logic Edition)
 * Powered by NetShield Technology
 * Source: https://github.com/math14f/NetShield
 * Licensed under MIT License
 */

// SIKKERHEDS-TJEK: Kør kun på Google
if (window.location.hostname.includes("google.")) {

    // VARIABEL til at tjekke, om vi er på forsiden eller ej
    const isOnSearchPage = window.location.pathname.includes('/search');

    // =======================================================
    // DEL 1: KODE TIL FORSIDEN (Lynhurtig, kun knap)
    // =======================================================
    if (!isOnSearchPage) {
        
        const hideFrontpageButton = () => {
            const spans = document.querySelectorAll('span'); // Hurtig søgning efter 'span'
            for (const span of spans) {
                if (span.textContent === 'AI-tilstand') {
                    const buttonContainer = span.closest('button') || span.closest('a') || span.closest('div[role="button"]');
                    if (buttonContainer && buttonContainer.style.display !== 'none') {
                        buttonContainer.style.display = 'none';
                        console.log("LetSpær Core (NetShield): Forside 'AI-tilstand' knap fjernet.");
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
                if (element.textContent && element.textContent.includes('AI-oversigt')) {
                    const container = element.closest('div[jscontroller]');
                    if (container && container.style.display !== 'none') {
                        container.style.display = 'none';
                    }
                }
            }

            // Scan efter AI-tilstand (på søgesiden)
            const spans = document.querySelectorAll('span');
            for (const span of spans) {
                if (span.textContent === 'AI-tilstand') {
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
