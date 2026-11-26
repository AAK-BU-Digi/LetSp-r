# Chrome Web Store – LetSpær

> Sidst opdateret: 2026-11-26 (version 1.11)
>
> Ét sted til alt, der skal udfyldes i Chrome Web Stores udviklerkonsol. Opdatér filen, når
> rettigheder, dataforbrug eller funktioner ændres. Filen kommer ikke med i pakken (se `package.sh`).
>
> Felter markeret **[engelsk]** indsættes på engelsk, da Chrome Web Stores gennemgang foregår på engelsk.
> Felter markeret **[bekræft]** skal udfyldes eller godkendes af jer.

## Butiksoplysninger

**Navn:** LetSpær
<!-- Skal matche "name" i manifest.json. -->

**Kort beskrivelse** (højst 132 tegn, samme som i manifest.json):
Blokerer forstyrrende sider, browserspil og AI-funktioner i søgemaskiner for elever. Styres af skolens it-administration.

**Detaljeret beskrivelse** (Chrome Web Store viser ikke markdown – brug linjeskift):

```
LetSpær hjælper elever med at holde fokus i undervisningen ved at blokere forstyrrende hjemmesider, browserspil og AI-funktioner i søgemaskiner.

Udvidelsen installeres og styres centralt af skolens it-administration via Google Admin-konsollen. Eleverne skal ikke gøre noget.

Funktioner:
Blokerer hjemmesider fra skolens blokeringsliste, som opdateres automatisk i løbet af dagen. Én adresse kan dække alle landeversioner af en side, fx alle Zalandos butikker.
Genkender automatisk sider med browserspil, også nye spilsider, som ikke står på nogen liste.
Fjerner AI-oversigter og AI-tilstand fra Google, Bing og Ecosia, så eleverne bruger den almindelige søgning.
Undtager tjenester, som skolen bruger i undervisningen, fra den automatiske spilgenkendelse.
Har en særlig prøvetilstand med sin egen blokeringsliste.

Når en side blokeres, ser eleven en side, der forklarer hvorfor.

Privatliv:
Sidernes indhold analyseres kun på elevens egen computer og sendes ingen steder hen. LetSpær gemmer ingen browserhistorik og indeholder ingen statistik eller sporing.

Spørgsmål om LetSpær stilles til skolens it-administration.
```

**Kategori:** Uddannelse (Education) **[bekræft]**

**Formål (Single purpose)** **[engelsk]:**
Helps students focus in class by blocking distracting websites, browser games and AI features in search engines, as configured by the school's IT administrator.

**Primært sprog:** Dansk

## Grafik

| Element | Størrelse | Status | Fil |
|---|---|---|---|
| Butiksikon | 128×128 PNG | ✅ Klar | `icons/icon-128.png` (96×96 motiv med 16 px margen) |
| Skærmbillede 1 | 1280×800 eller 640×400 | ⬜ Mangler | |
| Skærmbillede 2 | 1280×800 eller 640×400 | ⬜ Mangler | |
| Skærmbillede 3 | 1280×800 eller 640×400 | ⬜ Mangler | |
| Lille promoveringsflise (anbefalet) | 440×280 | ⬜ Mangler | |

### Forslag til skærmbilleder

1. Blokeringssiden med forklaringen på, hvorfor en side er blokeret.
2. En Google-søgning uden AI-oversigt.
3. LetSpær-ikonet med popuppen i fejlsøgningstilstand (kun hvis piloten nævnes i beskrivelsen).

Brug testsider, ikke rigtige elevers skærme, og undgå navne, e-mailadresser og faner, der afslører noget om en person.

## Begrundelse for rettigheder **[engelsk]**

| Rettighed | Type | Begrundelse |
|---|---|---|
| `storage` | permissions | Reads the configuration that the school's IT administrator sets in the Google Admin console (list addresses, blocking mode, update interval). Keeps the administrator's list of approved educational services on the device, so pages can be checked without a network request. No browsing data is stored. |
| `declarativeNetRequest` | permissions | Blocks websites on the school's block list by redirecting them to a page that explains why the site is blocked, and redirects Google's AI Mode to regular search results. The rules are rebuilt from the administrator's list at a configurable interval. |
| `alarms` | permissions | Refreshes the school's block list and list of approved educational services at the interval set by the administrator (default every 30 minutes), with a random delay so that thousands of school devices do not fetch the lists at the same moment. |
| `<all_urls>` | host_permissions | Students can open any website, so the extension needs access to all sites to: (1) redirect any site that appears on the administrator's block list, (2) analyse page content locally to recognise browser game sites, which are too numerous to maintain as a list, (3) hide AI features on search engine result pages, and (4) fetch the block list from the address the administrator configures in the Admin console. Page content is analysed only on the device and is never transmitted. |

**Fjernkode (remote code)** **[engelsk]:** No, I am not using remote code. All JavaScript is included in the package.

## Privatliv og dataforbrug

Svarene her skal stemme med privatlivspolitikken (`Privacy`) og med det, koden faktisk gør.

### Hvad koden gør med data (grundlag for svarene)

| Situation | Data | Forlader enheden? | Modtager |
|---|---|---|---|
| Hver side, eleven åbner | Adresse og sideindhold analyseres for spilsignaler | Nej | – |
| Lister hentes | Ingen brugerdata. Almindelig forespørgsel efter CSV-filer | Kun forespørgslen | Den adresse, administratoren angiver (i dag Google Sheets) |
| Side blokeres, ekstern blokeringsside (`blockedPageMode: external`) | Den blokerede sides værtsnavn | Ja | Skolens egen blokeringsside |
| Fejlmelding i pilot (`debugLogging: enabled`), når brugeren selv trykker "Send fejlmelding" | Sidens adresse uden parametre, status, point, signaler, version, tilstand, tidspunkt | Ja | Skolens Google Formular (`reportFormUrl`) |
| Gemt på enheden | Blokeringsregler, listen over undervisningstjenester, tidspunkt for sidste opdatering | Nej | – |

### Udfyldelse af formularen om dataforbrug

**Indsamler udvidelsen brugerdata?** Ja (se note)

| Datatype | Indsamles | Sendes fra enheden | Formål | Deles med tredjepart |
|---|---|---|---|---|
| Personligt identificerbare oplysninger | Nej | – | – | – |
| Helbredsoplysninger | Nej | – | – | – |
| Økonomiske oplysninger | Nej | – | – | – |
| Login-oplysninger | Nej | – | – | – |
| Personlig kommunikation | Nej | – | – | – |
| Placering | Nej | – | – | – |
| Webhistorik | Ja | Kun værtsnavn/adresse ved ekstern blokeringsside eller fejlmelding | Vise årsag til blokering; fejlsøgning | Nej |
| Brugeraktivitet | Nej | – | – | – |
| Webstedsindhold | Ja | Kun signaler i en fejlmelding, brugeren selv sender | Genkende spilsider; fejlsøgning | Nej |

**Note:** Det er ikke entydigt, om analyse, der *kun* foregår på enheden, tæller som "indsamling" i Chrome Web Stores forstand. Udkastet vælger den forsigtige løsning og angiver Webhistorik og Webstedsindhold. Det er bedre at angive for meget end at blive afvist for en uoverensstemmelse. **[bekræft]**

### Certificering
- [x] Data sælges ikke til tredjepart
- [x] Data bruges ikke til formål uden for udvidelsens kernefunktion
- [x] Data bruges ikke til kreditvurdering eller lån

## Privatlivspolitik

**URL:** **[bekræft]** Filen `Privacy` skal ligge på en offentlig adresse, fx GitHub Pages eller skolens hjemmeside. Chrome Web Store tjekker, at linket virker.

## Distribution

**Synlighed:** **[bekræft]**
- *Privat* – kun jeres eget Google Workspace-domæne kan installere den.
- *Ikke opført (Unlisted)* – kan installeres af alle med linket, fx andre kommuner, men vises ikke i søgninger.
- *Offentlig* – kan findes af alle.

Skal andre kommuner kunne installere selve udvidelsen og ikke kun bruge jeres lister, kræver det Ikke opført eller Offentlig.

## Udgiveroplysninger

**Udgiver:** Aarhus Kommune, Børn og Unge **[bekræft]**
**Kontakt-e-mail** (vises offentligt og skal overvåges): digitalisering@mbu.aarhus.dk
**Support:** https://github.com/AAK-BU-Digi/LetSp-r

## Versionshistorik

| Version | Dato | Ændringer | Status |
|---|---|---|---|
| 1.11 | **[bekræft]** | Adresser med ? eller # i listerne springes over i stedet for at blive gjort bredere. Ny politik refreshNow tvinger enhederne til at hente listerne. Politikændringer hentes spredt over 30–90 sekunder | Udkast |
| 1.10 | **[bekræft]** | Spil-detektionen genkender Minecraft (tvetydigt navn: titel med spilord eller domæne) og Eaglercraft. Tidligere projektnavn fjernet fra blokeringssiden og koden | Udkast |
| 1.9 | **[bekræft]** | Indeholder 1.8. Wildcards, samlet domæneregel (ingen grænse på 5.000), spredte opdateringer, undervisningstjenester fra CSV, fejlsøgning til pilot (`debugLogging`, `reportFormUrl`), `gameDetectionMode`, færre falske spilblokeringer, AI-tilstand omdirigeres, ikoner, kun værtsnavn til blokeringssiden | Publiceret til test **[bekræft]** |
| 1.7 | **[bekræft]** | | Publiceret |

## Noter til gennemgang

### Kendte forhold, en reviewer kan spørge til
- `<all_urls>` er nødvendig, fordi spilgenkendelsen skal kunne analysere ukendte sider. Begrundelsen ovenfor forklarer det.
- Udvidelsen er beregnet til tvungen installation via Google Admin-konsollen. Uden administratorkonfiguration (ingen CSV-adresser) blokerer den kun via spilgenkendelse og AI-filter.
- Popuppen på ikonet er kun aktiv, når administratoren slår `debugLogging` til.

### Afvisninger
| Dato | Årsag | Rettelse | Genindsendt |
|---|---|---|---|
