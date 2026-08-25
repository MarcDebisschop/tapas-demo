# Changelog

Alle noemenswaardige wijzigingen aan TaPas CORE staan in dit bestand.

De opzet volgt [Keep a Changelog](https://keepachangelog.com/nl/1.1.0/) en de
versienummering volgt [semantische versionering](https://semver.org/lang/nl/).
Het beleid achter versienummers, releaseritme en de release-gate staat in
[docs/RELEASEBELEID.md](docs/RELEASEBELEID.md).

## Over het startpunt van deze changelog

Deze changelog begint bij versie 2.5.0. Dat vraagt om uitleg, want er is geen
oudere changelog om op voort te bouwen.

De feitelijke situatie in de repository op het moment van schrijven:

- `package.json` staat op `"version": "2.4.0"` en dat nummer staat er sinds de
  oudste zichtbare commit (`f761736`, 23-07-2026). Het is nooit verhoogd.
- Er bestaat geen enkele git-tag. Er is dus nooit een release formeel
  vastgelegd, ook 2.4.0 niet.

Daarom is 2.4.0 hieronder opgenomen als vertrekpunt en niet als release: het is
de staat van de code zoals die al bestond, zonder dat we kunnen nagaan wat er
precies in zat. Alles wat daarna is gebeurd - en dat is veel - staat onder
2.5.0. Een nieuw nummer bedenken dat de historie mooier voorstelt dan ze is,
zou de changelog onbetrouwbaar maken vanaf dag een.

Waarom 2.5.0 en niet 3.0.0: semantische versionering vraagt een hoofdversie bij
een breuk in de publieke interface. De enige echte gedragsbreuk is dat
`/api/organisatie/opvolging-per-instrument` de querywaarde `?organisatie_id=`
niet meer volgt. Die parameter was geen ondersteund contract maar een lek: elke
bezoeker kon er de cijfers van een willekeurige organisatie mee opvragen. Er
zijn geen externe afnemers van deze API. Zou die er wel zijn, dan was dit een
hoofdversie geweest.

## Over de versienummers 2.5.0 tot en met 2.7.0

Wie deze changelog naast de git-historie legt, vindt hier een gat. Het staat
beschreven omdat weten beter is dan vermoeden.

- Tot deze versie bestond er geen enkele git-tag. Het beleid vraagt een tag per
  versie; voor de oudere versies zijn die er niet. Achteraf een tag op een
  gekozen commit zetten zou een zekerheid suggereren die er niet is, dus dat is
  niet gedaan.
- `package.json` ging in commit `ad0a95a` in een stap van 2.4.0 naar 2.7.0, in
  dezelfde commit als een auditreeks. De nummers 2.5.0 en 2.6.0 zijn dus nooit
  als aparte versie in het pakket vastgelegd.
- De kop 2.5.0 hieronder is nooit getagd. Voor 2.6.0 en 2.7.0 bestaat in deze
  changelog geen kop. Wat die twee nummers inhielden staat enkel in
  `VERSION.md`, een ouder en apart bijgehouden overzicht dat niet aan de
  git-historie gekoppeld is. Die inhoud wordt hier niet overgenomen, omdat zij
  niet uit de historie na te gaan is.
- Vanaf deze versie lopen `package.json`, deze changelog en de git-tag samen.

## [Niet vrijgegeven]

### Herstel

- Op het blad "in energie blijven, kleur per kleur" van het energetisch
  teamprofiel scheidde een em-streepje de kleurnaam van haar kernwoorden
  ("Rood — richten en doorzetten"). Datzelfde blad gebruikt verder overal een
  middenpunt als scheiding, dus staat er nu ook hier een middenpunt. In de
  leeswijzer en in de inleiding van blad 06 van het individuele webrapport is
  het em-streepje vervangen door een komma; die twee teksten zijn in NL, FR en
  EN aangepast (`ui.leeswijzer.tekst`, `ui.h6.lead`). Nagekeken op de PDF's:
  het teamprofiel bevat in NL, FR en EN geen enkel em-streepje meer. De vooraf
  ontwikkelde profielrapporten onder `client/public/twominscan-rapporten/`
  bevatten er nog zeven per bestand; die bestanden zijn geen bron in deze
  repository en zijn niet aangeraakt.

- Het energetisch teamprofiel uit het platform gaf maar 5 bladen, terwijl het
  goedgekeurde rapport er 10 heeft. De platformpagina was los gebouwd van het
  prototype en miste de leeswijzer, de bladen met individuele energie, het blad
  "in energie blijven, kleur per kleur" en het blad over overleg en afspraken;
  de verantwoorde toepassing stond samengedrukt op het slotblad. De teksten van
  het goedgekeurde rapport staan nu in `client/src/temperamentenwiel/teamtekst.ts`
  en de bladstructuur zelf in `client/src/temperamentenwiel/bladen.ts`. Dat laatste
  bestand is de enige waarheid over welke bladen het rapport heeft en in welke
  orde; `client/src/pages/twominscan-teamwiel.tsx` bouwt het rapport nu uit die
  lijst op en nummert de bladen zelf, zodat een blad niet meer stil kan
  wegvallen. Op één blad individuele energie staan drie deelnemers, dus bij vijf
  deelnemers levert dat opnieuw 10 bladen. `tests/twominscan-teamrapport-bladen.test.ts`
  bewaakt de orde en het aantal. Nagekeken in NL, FR en EN: 10 bladen per taal,
  geen afgekapte tekst.
- Een bestand uploaden faalde met 413 Payload Too Large. Drie wegen sturen een
  bestand als base64 in het JSON-bericht, terwijl de server dat bericht nog las
  met de standaardgrens van Express van 100 kB: het kandidaatrapport bij
  T4Recruitment (ongeveer 1,3 MB), en de twee wegen van de bulk-import. Nieuw
  `server/bodygrens.ts` geeft enkel die wegen een ruime grens van 12 MB en zet
  de rest op een bescheiden 1 MB. De grens voor het hele platform verhogen zou
  ook de aanmeldweg berichten van vele megabytes laten aannemen, en dat is
  aanvalsoppervlak dat niemand nodig heeft.
- De dashboardfoto ging onverkleind naar de server. Een gsm-foto van enkele
  megabytes kwam daardoor niet door, en zou anders als data-URL in de databank
  belanden. De browser verkleint nu eerst tot 512 pixels
  (`client/src/lib/afbeelding.ts`), zoals de coachpagina al deed, en toont een
  melding wanneer dat niet lukt in plaats van stil te falen.

### Toegevoegd

- Het temperamentenwiel staat nu ook achteraan de gedownloade individuele
  2MINSCAN-PDF. De rapportpagina stuurt het wiel als afbeelding mee
  (`client/src/temperamentenwiel/naar-png.ts`) en nieuw
  `server/twominscan/wielbijlage.ts` zet daar met pdf-lib een laatste blad
  "jouw plaats op het temperamentenwiel" van, met wielpositie en sector. Lukt
  dat niet, dan komt de PDF gewoon zonder dat blad terug in plaats van te falen.
  Nagekeken op twee gedownloade rapporten: 16 bladen, juiste positie, geen
  afgekapte tekst.
- Bewaarde 2MINSCAN-afnames voor het teamwiel. Wie het eigen rapport ziet, kan
  het met één knop in de teamlijst zetten (`Bewaar voor teamrapport` op de
  printbalk van `client/src/pages/twominscan-rapport.tsx`). De teamwielpagina
  laadt die deelnemers daarna zelf in, in plaats van dat iemand 24 wielposities
  met de hand overtypt. Nieuw `server/twominscan/afname-opslag.ts` met POST
  `/api/twominscan/afname` (publiek, want de deelnemer beslist over de eigen
  afname), GET `/api/twominscan/afnames` en DELETE
  `/api/twominscan/afname/:id` (beide achter `vereisAdmin`, want dat is een
  lijst met namen). Bewaard wordt enkel wat een teamwiel nodig heeft: naam,
  rol, organisatie, EG-code, wielpositie, taal en datum. Niet bewaard: de
  gegeven antwoorden, de losse scores, de portretfoto of enige rapporttekst —
  een bewaarde rij kan het individuele rapport dus niet reconstrueren
  (dataminimalisatie, AVG art. 5.1.c). De tabel `twominscan_afnames` wordt lazy
  aangemaakt volgens het patroon dat hier al bestaat
  (`server/instrument-beschikbaarheid.ts`, `server/gids-manager.ts`), dus zonder
  Drizzle-schema en zonder migratie; `shared/schema.ts` en de bestaande tabellen
  blijven onaangeroerd. Let op: `tests/schema-dekt-databank.test.ts` faalt al
  vóór deze wijziging omdat zestien zulke lazy tabellen geen schemadefinitie
  hebben; deze tabel wordt daar de zeventiende naam in dezelfde, bestaande
  faalmelding. Dekking: `tests/twominscan-afname-opslag.test.ts`.
- Teamwielpagina in drie talen (Nederlands, Frans, Engels), met een taalkeuze in
  de balk. `client/src/temperamentenwiel/dynamiek.ts` haalt zijn teksten nu op
  via een optionele vertaler (`WielVertaler`) in plaats van ze hard in het
  Nederlands te bevatten; de rekenlogica van de teamdynamiek is niet gewijzigd,
  enkel de tekst is eruit gelicht. `client/src/twominscan/vertalingen.json` krijgt
  121 nieuwe sleutels per doeltaal voor `fr` en `en` (achteraan toegevoegd, de
  bestaande volgorde en de talen `es` en `ru` blijven zoals ze waren).
  `tests/twominscan-teamwiel-vertaling.test.ts` laat de bouw falen wanneer een
  sleutel in fr of en ontbreekt, wanneer een vertaling een accolade-plaatshouder
  laat vallen, of wanneer een brontekst talent-, potentieel-, competentie-,
  diagnose- of geschiktheidstaal binnenbrengt.
- Module Temperamentenwiel, als eerste stap van vier en nog niet aangesloten:
  `client/src/temperamentenwiel/` met de 24 posities van de speelmat
  (`posities.ts`), de renderer die het wiel tekent (`wiel.ts`), de
  teamdynamiek-analyse (`dynamiek.ts`), een dun React-omhulsel
  (`Temperamentenwiel.tsx`) en een README met de bronwaarheid. Geen bestaande
  pagina, route of component is gewijzigd: wie de map verwijdert, verandert niets
  aan het gedrag van het platform. De kleurvolgorde staat per positie vast zoals
  gemeten op de Speelmat Temperamenten version 1.0 (2022) — vier radiale banden
  per positie, geen vlakke kwadranten en geen gradiënten. De wielposities en
  MBTI-equivalenten volgen `client/src/twominscan/profielen.ts`, en
  `tests/temperamentenwiel-bronwaarheid.test.ts` laat de bouw falen wanneer een
  van beide alsnog zou schuiven. De twee eerder gemelde verschillen tussen mat en
  `profielen.ts` (wielpositie 128-148 en 35-55) staan gedocumenteerd in de README
  en zijn bewust niet aangepast: dat raakt de matching van de 2MINSCAN en hoort
  bij een eigen stap.
- Het 2MINSCAN-rapport krijgt een wielpagina, als tweede stap van vier. Na
  hoofdstuk 11 en voor de slotpagina toont `twominscan-rapport.tsx` het volledige
  temperamentenwiel met de eigen positie gemarkeerd, plus de wielpositie, de
  kleurvolgorde van die positie en de sector waarin ze valt. De pagina krijgt
  geen hoofdstuknummer en staat niet in de inhoudsopgave, zodat de bestaande
  nummering van twaalf hoofdstukken ongewijzigd blijft. De teksten staan in
  `vertalingen.json` onder `ui.h11wiel.*`, in de vier talen die het rapport al
  kende. De wielmodule uit stap 1 is hiervoor niet gewijzigd: de kleurvolgorde
  per positie blijft de gemeten bronwaarheid van de speelmat. Het wiel is
  ingesteld op een breedte die de pagina binnen één A4 houdt; bij een grotere maat
  liep de voetregel over naar een extra, nagenoeg lege pagina.
  `tests/temperamentenwiel-rapport.test.ts` legt vast dat de pagina bestaat, dat
  ze buiten de nummering blijft en dat alle vertaalsleutels in elke taal aanwezig
  zijn. De weg is nagelopen met vijf afnames van het fictieve bedrijf Newco: vijf
  keer de vragenlijst effectief ingevuld in de browser, vijf rapporten van zestien
  pagina's zonder overloop, en de vijf berekende wielposities samen op één
  teamwiel. Twee zaken zijn bewust nog niet gedaan en horen bij een volgende stap:
  het profieldocument achter "Download als PDF" komt van de server en bevat de
  wielpagina nog niet, en het teamwiel is nog niet in het platform aangesloten.
- Het teamwiel is aangesloten op het platform, als derde stap van vier. De nieuwe
  pagina `client/src/pages/twominscan-teamwiel.tsx` op route `/2minscan/teamwiel`
  heeft twee standen. In de samenstelstand vult de coach per deelnemer de naam,
  de rol en de wielpositie in zoals die uit de 2MINSCAN kwam; de wielpositie komt
  uit een keuzelijst met de 24 posities van de speelmat, zodat er geen positie kan
  worden ingetypt die niet bestaat. In de rapportstand volgen vijf pagina's: een
  cover met de organisatie, het volledige wiel met ieders initialen op zijn eigen
  positie, een deelnemerspagina met wielpositie, sector en de kleurvolgorde van
  die positie in bolletjes, de teamdynamiek uit `dynamiek.ts` met kerncijfers en
  inzichten, en een slotpagina met werkafspraken, de Jung-nuance en het
  TaPasCity-contact. Het wiel zelf is niet gewijzigd: elke positie houdt haar
  eigen gemeten kleurvolgorde.
- De initialenregel staat nu op één plaats, in `client/src/temperamentenwiel/`
  `initialen.ts`. Zowel het individuele rapport als het teamwiel gebruikt die
  regel, zodat dezelfde naam nooit twee verschillende initialen kan opleveren.
  Tussenvoegsels tellen niet mee: "Naima El Amrani" wordt NA en "Bram De Cock"
  wordt BC. Dat lost het punt op dat in het eerste Newco-verslag nog openstond.
- De organisatienaam staat nu in de 2MINSCAN. De afname vraagt ze als los,
  optioneel veld, ze reist mee in de rapportlink en ze staat op de cover van het
  individuele rapport en van het teamrapport. Is ze niet ingevuld, dan verschijnt
  er niets: geen leeg veld en geen streepje.
- Een portret kan bij een profiel horen, langs twee wegen en beide met de hand
  bevestigd. De deelnemer kan bij de afname zelf een foto kiezen; de browser
  verkleint die tot 256 pixels (`client/src/lib/afbeelding.ts`) en er staat bij
  waarvoor ze dient. Voor een team kan de coach één pagina opgeven die de
  organisatie zelf publiceerde, bijvoorbeeld de directiepagina, en per beeld
  aanwijzen wie het is. Nieuw `server/twominscan/organisatiefotos.ts` leest enkel
  die ene pagina: alleen https, geen tweede pagina erbij, zoekmachines, sociale
  netwerken en fotobanken worden geweigerd, robots.txt wordt gerespecteerd, ten
  hoogste twaalf beelden van elk ten hoogste 2 MB, en er wordt niets op de server
  bewaard. De bron blijft als host bij de foto in het rapport staan. Automatisch
  het web afzoeken naar een foto van iemand is bewust niet gebouwd: je kunt dan
  niet met zekerheid zeggen dat het de juiste persoon is en het beeld is meestal
  niet vrij van rechten. Ontbreekt een foto, dan is daar in de PDF niets van te
  zien: geen kader, geen icoon en geen melding. Heeft niemand in de groep een
  foto, dan verdwijnt de fotokolom volledig.
- Uitnodigen kan nu zelf een bericht versturen. Het uitnodigingsvenster heeft een
  adresveld en twee knoppen: "Alleen link aanmaken", de weg die er altijd was en
  volwaardig blijft, en "Aanmaken en versturen". Nieuw bestand
  `server/uitnodigingsmail.ts` bouwt de deelnemerslink en de leesbare
  instrumentnaam en boekt de stand op de afname. Zonder verzendweg staat de
  verstuurknop uit, met de reden erbij: een knop die niets kan bezorgen is erger
  dan geen knop.
- Leeftijdspoort bij het uitnodigen van minderjarigen, in het nieuwe
  `shared/uitnodigingsontvanger.ts`. Bij T4Kids en bij T4Teens onder 16 gaat de
  uitnodiging naar een ouder, voogd of begeleider; vanaf 16 mag de jongere zijn
  eigen adres houden. De grens volgt AVG art. 8 met de Belgische drempel, en de
  keuze om de zestien- en zeventienjarige zijn eigen bericht te laten krijgen is
  een keuze en geen vergetelheid: hem dat ontzeggen zou een eigen recht wegnemen.
  De server weigert een adres dat niet mag voor er een afname en dus een credit
  ontstaat.
- Verzendstand per rij in het beheeroverzicht: niets verstuurd, bericht
  verstuurd, gesimuleerd, of versturen mislukt. Nieuwe kolommen `mail_stand`,
  `mail_stand_at` en `mail_ontvanger_rol` op `afnames`; het overzicht geeft wel
  de stand en of er een adres bekend is, maar nooit het adres zelf.
- De belknop verstuurt een echte herinnering in plaats van enkel een datum te
  zetten. Eigen sjabloonsleutel `herinnering`, aanpasbaar in Mailbeheer, en de
  soort `herinnering` in `mail_verzendlog` (migratie
  `0010_herinnering_in_verzendlog.sql`). Zonder bekend adres of zonder
  verzendweg staat de knop uit met de reden in de tooltip.

### Gewijzigd

- De verzendmodule leest het antwoord van de mailserver in plaats van
  "verstuurd" te melden zodra nodemailer geen uitzondering gooit. Nieuw
  `server/bulk-import/smtp-antwoord.ts` beoordeelt `accepted`, `rejected` en
  `pending`: een adres dat de server weigerde of uitstelde is een fout. Dit was
  de kern van het probleem waarbij het overzicht "verstuurd" toonde bij
  berichten die nooit aankwamen.
- `VERSION.md` liep sinds 2.7.1 achter op `package.json`. Het overzicht noemt nu
  dezelfde versie, waarmee de twee toetsen op de versiehygiene weer slagen.

## [2.7.1] - 2026-08-23

### Gewijzigd

- T4Students Studiekompas: de driver Try Hard volgt nu de constructdefinitie van
  de opdrachtgever. Try Hard is niet "hard blijven proberen" maar iets
  uitzonderlijks willen doen voor een persoon naar wie de deelnemer opkijkt, die
  hem inspireert, en van wie hij weet dat die in hem gelooft. Alle drie de
  plaatsen waar het construct voor een deelnemer zichtbaar wordt zijn
  aangepast: het herkenningsitem D3 in `server/data/t4students.json` (Nederlands,
  Frans en Engels), de korte omschrijving naast de constructnaam in
  `server/data/t4students-omschrijvingen.json`, en de duidingstekst in
  `server/data/t4students-duidingsteksten.json`. Zonder de persoon in de tekst
  valt Try Hard samen met gewone inzet, die ook in Be Perfect, Hurry Up en de
  motivatiebron Verwachting zit. De duidingstekst benoemt nu ook de keerzijde:
  valt die persoon weg, dan valt de beweging weg. Gevolg voor de itemanalyse: D3
  is inhoudelijk gewijzigd en geldt daarmee als een nieuw item, dus antwoorden op
  de oude formulering mogen niet met de nieuwe worden samengenomen.
- T4Students Studiekompas: het rapport is eerlijk gemaakt over de basis onder
  zijn rangordes. Op een uitzondering na rust elk construct op een enkel
  herkenningsitem met vier antwoordmogelijkheden, terwijl de gelijkstandsmarge op
  0.3 staat. Een verschil van een stap op een enkele vraag levert daardoor een
  eigen groep op en werd tot een uitspraak over de student. De rangorde blijft,
  want zonder rangorde is het rapport als gespreksdocument onbruikbaar, maar de
  aandachtspuntenpagina zegt nu waarop een lijn rust en hoe groot een verschil
  moet zijn voor het iets betekent. De uitspraak over de laagste talentfocus is
  gebonden aan de momentopname in plaats van aan de persoon.
- `docs/ITEMONTWIKKELPLAN-T4STUDENTS.md`: de door de opdrachtgever herwerkte
  formuleringen van de kandidaat-items zijn overgenomen, met een nieuwe paragraaf
  4.4 die de constructdefinitie van Try Hard, het validiteitsargument en de
  gevolgen vastlegt. De taalkundige maten bij paragraaf 5.1 zijn opnieuw gemeten
  op de huidige tekst.

### Toegevoegd

- `tests/t4students-try-hard-relationeel.test.ts`: houdt de relationele figuur,
  het vertrouwen van die persoon en het uitzonderlijke vast in het item (drie
  talen), de omschrijving en de duidingstekst, zonder een letterlijke
  formulering vast te leggen.
- Dezelfde test leest nu ook de opmaakmeldingen van het hele voorbeeldrapport en
  zakt zodra een vaste regel breder wordt dan haar plaats. Die meldingen bestonden
  al maar werden door geen enkele test gelezen, waardoor een te lange omschrijving
  stil over de rand van haar kolom kon lopen.
- `tests/t4students-rangorde-eerlijk-over-een-item.test.ts`: houdt vast dat het
  rapport op de aandachtspuntenpagina zegt waarop zijn rangordes rusten, en dat
  het geen vaststaande uitspraak doet over een enkel construct. De test zakt
  zodra die uitleg verdwijnt of zodra de oude formulering terugkomt.

## [2.5.0] - 2026-07-26

Nog niet getagd. Deze versie wordt vrijgegeven zodra de bijhorende pull request
in `main` is samengevoegd.

### Beveiliging

- Organisatie-scoping doorgevoerd over de hele API (fase 1 tot en met 8). De
  organisatie wordt bepaald door de sessie en niet langer door de URL. Het
  onderzoek begon bij `/api/organisatie/opvolging-per-instrument`, dat de
  organisatie uit `?organisatie_id=` haalde en zo de cijfers van elke
  organisatie prijsgaf aan wie het nummer raadde.
- Authenticatie gedicht op endpoints die zonder controle bereikbaar waren
  (`server/routes/admin.ts`, `afnames.ts`, `financieel.ts`, `rapporten.ts`,
  `routes-stm.ts`).
- Scope-kern toegevoegd (`server/scope-guard.ts`): `bepaalScope`,
  `vereisScope` en `vereisPrior`. Prior wordt centraal beslist als de vlag
  `isPrior` EN de prior-organisatie; de vlag alleen is nergens meer de enige
  toets.
- `listAfnames` eist een scope en filtert in SQL. Scope "geen" faalt luid in
  plaats van stil een lege lijst terug te geven, want een lege lijst is niet van
  een fout te onderscheiden.
- Snelheidsbegrenzing uitgebreid naar `/api/organisatie/login`. Dat pad ontbrak
  in de lijst van de `authLimiter` (`server/index.ts`) en was dus het enige
  loginpad zonder rem op brute kracht.
- Organisatie-identiteit als harde koppeling: `beheerders.organisatieId` als
  foreign key naast het bestaande vrije-tekstveld, plus een eigen
  organisatie-login.
- Poort op de branding-velden: een logo-adres belandt in een `src`-attribuut,
  dus zijn enkel `https:`, `http:` en een pad binnen de site toegelaten.
  `javascript:` en `data:` worden geweigerd.

### Toegevoegd

- Organisatieportaal (`client/src/pages/organisatie-dashboard.tsx`) achter een
  eigen login: eigen deelnemers, eigen afnames, eigen opvolging.
- Organisatie-personalisatie: logo, achtergrondafbeelding, achtergrondkleur,
  quote en de organisatienaam in de header.
- Het Amelia-Earhart-watermerk verschijnt uitsluitend voor TaPasCity (prior).
  De beslissing valt in de pure functie `brandingBesluit` in
  `shared/branding.ts`, niet in een component: het is een merk- en
  identiteitsregel en geen stijlkeuze, en zo is ze toetsbaar en niet te
  omzeilen door een scherm te herschrijven.
- Elke nieuwe afname legt vast WIE haar aanmaakte, uit de sessie. Dat staat los
  van `organisatieId`, dat zegt wiens credits ze kost.
- Scope-isolatiematrix (`tests/fase8-scope-isolatie-matrix.test.ts`): twaalf
  endpoints maal vier kerngevallen, plus een dekkingscontrole die van elk
  endpoint in de omgezette routers een guard eist.
- Opvolging per instrument voor beheer en organisatie.
- GDPR-verharding: leeftijdspoort met ouderlijke toestemming, centrale
  admin-guard op alle `/api/gdpr`-routes, anonimisering via een gedeelde
  velddefinitie, automatische anonimisering na de bewaartermijn, een
  append-only audit-log, een pseudonimiseringspoort met doorgifteregister voor
  de AI-duiding, en de hook voor encryptie-at-rest.
- Deze changelog, `docs/RELEASEBELEID.md` en `docs/TECHNISCHE-SCHULD.md`.
- Encryptie-at-rest is auditbaar geworden. De hook wordt nu op alle acht
  databank-handles aangeroepen in plaats van op een deel ervan, en bij het
  opstarten meldt de app expliciet of encryptie ACTIEF is of als no-op draait.
  Dat laatste is de kern: de standaard `better-sqlite3` negeert `PRAGMA key`
  zonder te klagen, dus een gezette sleutel zonder cipher-driver is de
  gevaarlijkste toestand die er is. `actief` vraagt daarom sleutel EN
  cipher-driver. Een test houdt de lijst van acht handles gelijk aan wat er
  feitelijk in `server/` een databank opent, zodat een nieuwe handle die de hook
  vergeet de suite laat falen. Encryptie blijft uit; aanzetten is een
  productiebeslissing.
- `tests/i18n-dekking.test.ts`: bewaakt dat elke sleutel die de code opvraagt
  bestaat, dat elke taal dezelfde sleutelset heeft, en dat geen vertaling een
  accolade-plaatshouder laat vallen.

### Gerepareerd

- Het organisatieportaal crashte bij het openen: het dashboard las
  `opvolging.rijen` terwijl de server het veld `instrumenten` levert.
- Twee ontbrekende vertaalsleutels, `iz_drempel_stand` en
  `iz_drempel_beschikbaar_vanaf`. Het scherm met de onderzoeksdrempels toonde
  de kale sleutelnaam. De compiler kon dit niet vangen omdat dat scherm zijn
  vertaalfunctie als prop binnenkrijgt, getypeerd als `(s: string) => string`.
- `afnames.instrument_id` wordt bij aanmaak gevuld; bestaande rijen zijn
  aangevuld.

### Gewijzigd

- Het beheerscherm volgt de scope die `/api/admin/me` teruggeeft in plaats van
  zelf op `isPrior` te beslissen.
- De publieke startpagina toont geen organisatielijst meer. Die lijst was zelf
  het lek: ze gaf aan iedere bezoeker prijs welke organisaties klant zijn.
- `t4r-home.tsx` staat achter de CoachLoginGate.
- De billers- en organisaties-code is uit `server/storage.ts` gehaald en staat
  nu enkel nog in `server/repositories/`. De map bestond al, maar werd door
  niemand aangeroepen: het waren kopieen van de god-module, met alle kans op
  stil uiteenlopen. De klasse `DatabaseStorage` delegeert er nu echt naartoe en
  de kopie is verwijderd. De publieke interface is ongewijzigd, dus
  `import { storage } from "./storage"` blijft werken.
- Vier typefouten opgelost zonder gedragswijziging (`Array.from` in plaats van
  het uitspreiden van een `Map` of `Set`, en een ontbrekend parametertype). De
  telling gaat van 77 naar 73; de rest staat met reden in
  `docs/TECHNISCHE-SCHULD.md`.
- Alle migraties in deze versie zijn additief en idempotent, achter een
  `PRAGMA table_info`-bestaanscontrole. Geen enkele `DROP`, geen `NOT NULL` op
  een nieuwe kolom. Beide migraties zijn tweemaal gevalideerd op een kopie van
  `data.db`, met controle op rijaantallen en `integrity_check`.

## [2.4.0] - vertrekpunt

Geen release maar de staat van de code bij de oudste zichtbare commit
(`f761736`, 23-07-2026). Er is geen tag en geen changelog uit die tijd, dus is
dit geen volledige opsomming. Wat feitelijk in de code is terug te vinden:

- Wachtwoorden via `crypto.scrypt` met salt (`server/auth/wachtwoord.ts`).
- Sessies in een SQLite-store op dezelfde better-sqlite3-databank als de app,
  in plaats van de standaard MemoryStore, zodat sessies een herstart overleven.
- `helmet` als security-headers-laag. CSP staat bewust uit; een te strikte CSP
  zou de bestaande frontend breken.
- Snelheidsbegrenzing op de auth- en token-endpoints.
- Runtime-toggle tussen TaPas CORE en het volledige belevingsplatform, zonder
  hercompilatie.

[2.5.0]: https://github.com/MarcDebisschop/tapas-demo/commits/main
