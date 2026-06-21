// Filnavn: content_analyzer.js
// NetShield v3.8 - Isolated World Message Receiver
// Copyright (c) 2026 Mathias Harald Andersen MIT

console.log("NetShield [Isolated World]: Indlæser content_analyzer.js...");

// Modtag besked fra Main World  og videresend til background.js
document.addEventListener('NetShieldViolation', (e) => {
    const reason = e.detail ? e.detail.reason : 'unknown';
    console.log(" NetShield [Isolated World]: Modtog violation-event fra Main World. Årsag:", reason);
    try {
        console.log("NetShield [Isolated World]: Sender 'violationDetected' til background.js...");
        chrome.runtime.sendMessage({ action: "violationDetected", reason: reason });
    } catch(err) {
        console.error("NetShield [Isolated World]: Fejl ved afsendelse af besked til background.js:", err.message);
    }
});
