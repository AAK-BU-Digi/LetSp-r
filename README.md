LetSpær - Spærring af irrelevante sider i elevernes browser

Når din extension er blevet udgivet, skal du tildele den til brugerne i Googles Administraion. Du skal angive JSON-config som kan ses i eksemplet (example-json-adminmodul.json), se muligheder nedenfor.

  "sheetMode": "daily" eller "exam".  Der er fx. blokkeret for AI-værktøjer ifm. prøverne jf. BUVM.
  
  "dailyCsvUrl": Adressen til offentlig CSV-fil med adresser. 
  
  "examCsvUrl": Adressen til offentlig CSV-fil med adresser.
  
  "blockedPageMode": "internal" eller "external". Hvis du vil bruge den indbyggede kan du bruge den eller lave din egen - det er "internal". Du kan også pege på en offentlig hjemmeside, det er "external"

  "blockedPageUrl": Ved brug af External, angives adressen her.
  
  "updateInterval": Hvor ofte skal CSV-filerne hentes, i millisekunder: 300000 = 5 minutter, 600000 = 10 minutter, 1800000 = 30 minutter (standard). Med mange tusinde enheder bør intervallet ikke være for kort, da hver opdatering henter listerne fra Google Sheets.

  "aiBlockMode": Brug automatisk logik, som blokkerer for AI-tilstand på Googles søgemaskine.

  "educationCsvUrl": Adressen til offentlig CSV-fil med tjenester, som er relevante i undervisningen. Tjenesterne undtages fra al automatisk analyse – i dag spil-detektionen, og fremover også andre automatiske blokeringer (fx webbutikker eller chatrouletter). Listen hentes med samme interval som blokeringslisten. Den påvirker ikke blokeringslisten: står en tjeneste på begge lister, bliver den blokeret.

  Der er ingen indbygget liste i koden. Filen undervisningstjenester-start.csv indeholder de skoletjenester, som tidligere var indbygget, og kan indsættes direkte i jeres ark.

  "gameDetectionMode": "block" (standard), "log" eller "off". Styrer den automatiske spil-detektion:
    - "block" blokerer sider over grænsen (5 point).
    - "log" analyserer uden at blokere. Med debugLogging viser LetSpær-ikonet "Ville være blokeret", så en ny version af detektionen kan afprøves uden at forstyrre undervisningen.
    - "off" slår analysen helt fra. Bruges som nødbremse, hvis detektionen blokerer noget vigtigt; virker på få minutter uden ny version i Chrome Web Store.
  Blokeringslisten og AI-blokeringen påvirkes ikke af denne indstilling.

  "refreshNow": Nødknap. Når værdien ændres (fx til dags dato og klokkeslæt: "2026-11-26 09:15"), henter alle enheder listerne igen inden for 30–90 sekunder efter at have modtaget politikken, i stedet for at vente på updateInterval. Bruges fx når en fejl i blokeringslisten skal rettes hurtigt. Hvor hurtigt politikken når frem, afhænger af Chrome. Google opdaterer desuden selv publicerede ark med nogle minutters forsinkelse, så ret arket først og vent et par minutter, før refreshNow ændres.

  "debugLogging": "enabled" eller "disabled" (standard). Til pilotforløb. Når den er slået til:
    - LetSpær logger i Chromes konsol (ellers logges kun fejl).
    - Blokeringssiden viser point og signaler med knapperne "Send fejlmelding" og "Kopiér tekst".
    - Et klik på LetSpær-ikonet viser den aktuelle sides point og signaler, også når siden ikke er blokeret, og for blokerede iframes på siden. Fra popuppen kan de sendes med samme knapper.
  Slå den kun til for pilot-OU'en. Når den er slået fra, gør et klik på ikonet ingenting, og eleverne kan ikke se point eller signaler nogen steder.

  "reportFormUrl": Forudfyldt link til en Google Formular, som "Send fejlmelding" åbner. Bruges kun, når debugLogging er slået til. Uden den vises kun "Kopiér tekst".

Opsætning af fejlmeldingsformularen (reportFormUrl)

  Opret en Google Formular med fx felterne Domæne, Point og Detaljer (alle tekstfelter) samt et felt, hvor underviseren selv kan skrive, hvad de undrer sig over.
  Vælg "Hent forudfyldt link" i formularens menu, skriv en tilfældig værdi i de felter, LetSpær skal udfylde, og kopiér linket.
  Erstat værdierne i linket med pladsholdere, fx entry.111={domain}&entry.222={score}&entry.333={details}.

  Pladsholdere:
  {domain}   værtsnavn, fx poki.com
  {url}      værtsnavn og sti uden parametre, fx poki.com/da/g/slope
  {status}   fx "Blokeret af spil-detektionen" eller "Analyseret – ikke blokeret"
  {score}    point (tom ved blokeringslisten)
  {signals}  de matchede signaler, adskilt af semikolon
  {version}  LetSpærs versionsnummer
  {mode}     daglig eller prøve
  {time}     tidspunkt for fejlmeldingen
  {details}  hele fejlmeldingen som tekst, inkl. indlejrede rammer

  LetSpær gemmer intet om fejlmeldinger. Der sendes kun det, brugeren selv ser og vælger at sende: sidens adresse uden parametre, status, point og signaler. Intet om brugeren. Formularen kan begrænses til jeres domæne uden at indsamle e-mailadresser.

Format for adresser i CSV-filen

  Kun første kolonne læses. Øvrige kolonner (fx kommentarer) ignoreres, og linjer uden en gyldig adresse (fx en overskrift) springes over. En celle kan indeholde flere adresser adskilt af komma, semikolon eller mellemrum.

  spil.dk               Blokerer spil.dk og alle subdomæner (www.spil.dk, m.spil.dk osv.)
  *.spil.dk             Det samme som spil.dk
  zalando.*             Blokerer alle topdomæner: zalando.dk, zalando.de, zalando.co.uk osv.
  youtube.com/shorts    Blokerer kun den angivne sti
  temu.*/da             Blokerer stien på alle topdomæner

  http://, https:// og www. fjernes automatisk, og æ, ø og å i domæner oversættes automatisk. Blokeringen gælder både http og https. Stjerner andre steder (fx *spil*) understøttes ikke og springes over.

  Adresser med parametre (?…) eller fragment (#…) springes over og logges som fejl i service workerens konsol. En regel kan ikke matche parametre præcist, og at fjerne dem ville gøre reglen bredere end tiltænkt: google.com/search?udm=50 ville blive til google.com/search og blokere alle søgninger. Skriv domænet eller stien uden parametre. (Googles AI-tilstand, udm=50, håndteres i forvejen af aiBlockMode.)

  Fejler hentningen af CSV-filen, eller returnerer Google en HTML-side (fx fordi arket er afpubliceret), beholdes de eksisterende blokeringer. En tom liste fjerner alle CSV-blokeringer.

Særligt for undervisningstjenester (educationCsvUrl)

  Samme format som ovenfor. Sti-adresser er særligt nyttige til Google Sites, så man kan godkende én bestemt side uden at godkende alle Google Sites:

  sites.google.com/view/klasse7a-matematik

  En wildcard-adresse som scratch.* godkender kun rigtige topdomæner (scratch.dk, scratch.de, scratch.co.uk), ikke fx scratch.netlify.app, som enhver kan oprette.

  Undgå at tilføje hele hostingplatforme (sites.google.com, github.io, netlify.app, vercel.app, pages.dev), da det slår den automatiske analyse fra for alle sider på platformen.

  Undtagelsen gælder både når tjenesten åbnes direkte, når den er indlejret (iframe) på en anden side, og for alt der er indlejret på tjenesten.

  På en ny enhed gælder undtagelserne først, når listen er hentet første gang (normalt inden for få sekunder efter installation). Fejler hentningen senere, bruges den sidst hentede liste.

Udgivelse i Chrome Web Store

  Byg pakken med ./package.sh fra repoets rod (virker i Git Bash, macOS, Linux og Google Cloud Shell). Kun de filer, Chrome bruger, kommer med. Scriptet stopper, hvis manifest.json henviser til en fil, der mangler, og advarer, hvis der ligger kodefiler i repoet, som ikke er med i pakken. Nye filer skal tilføjes listen i scriptet.

  CHROMEWEBSTORE.md samler alt, der skal udfyldes i Chrome Web Stores udviklerkonsol: beskrivelser, formål, begrundelse for hver rettighed og svar om dataforbrug. Opdatér den sammen med privatlivspolitikken (Privacy), når rettigheder eller dataforbrug ændres.

