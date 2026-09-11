# Bouwrapport — Kwaliteit & Evaluaties, fase 1: de organisatie-evaluatie

**Datum** 11 september 2026 · **Repo** `MarcDebisschop/tapas-demo` op `bc83f6e` (basis van branch `kwaliteit-evaluaties/organisatie-evaluatie`) · **Node** v20.20.1 · **Vitest** v4.1.10

---

## 1. Wat er gevraagd werd, en wat er nu staat

De volledige bouwspecificatie (`Tapascity_Kwaliteit_Evaluaties_Complete_Bouwspecificatie.docx`) beschrijft een module in drie fasen: de organisatie-evaluatie, de anonieme deelnemerscampagne met coach-zelfevaluatie, en de scoring/signalering/kwaliteitscasedashboard-laag daarbovenop. In overleg is bewust een andere volgorde gekozen dan de nummering van de spec zelf: **eerst organisatie, en niets ernaast**, zodat één volledige, geteste keten — uitnodigen, invullen, indienen, scoren, signaleren — er staat voordat de campagne en de coach-laag erbovenop komen.

Wat er na deze ronde staat: een beheerder kan vanuit een sessie een organisatiecontact uitnodigen, het contact vult de evaluatie in via een tokengebonden link zonder aanmelding, kan tussentijds bewaren, dient in, en de indiening levert meteen een gewogen score per domein plus — waar van toepassing — een signaal. Alles zit al in de bestaande app: geen los prototype, geen aparte databank, geen eigen inlogscherm.

De spec zelf bevat de governanceregel die de rest van dit rapport spiegelt: *"TaPasCity maakt kwaliteit zichtbaar, ontwikkeling mogelijk en opvolging aantoonbaar"* — en de meta-regel dat taal en gebruiksgemak vaak verfijnd mogen worden, maar meetinhoud alleen bewust, traceerbaar en versioneerbaar. Die tweede regel is de reden dat elke vraagcode, elk gewicht en elke drempel in deze ronde letterlijk uit de spec is overgenomen, niet herwerkt.

---

## 2. Het tabelvoorvoegsel: `evaluatie_`, niet `kwaliteit_`

De spec noemt de module "Kwaliteit & Evaluaties", maar de bestaande STM-module in dit platform gebruikt al het voorvoegsel `kwaliteit_` voor haar eigen tabellen (`kwaliteit_normen` en verwante). Een nieuwe module die dezelfde naamruimte claimt, zou vroeg of laat een tabel dubbel benoemen of, erger, een bestaande tabel per ongeluk hergebruiken voor een ander gegeven. Daarom is gekozen voor `evaluatie_` als voorvoegsel voor alle zeven nieuwe tabellen:

```
evaluatie_organisatie_contacten
evaluatie_coaches
evaluatie_sessies
evaluatie_uitnodigingen
evaluatie_organisatie_evaluaties
evaluatie_antwoorden
evaluatie_signalen
```

Dat is bewust een andere keuze dan de letterlijke moduletitel, en staat hier vastgelegd zodat een latere fase (deelnemerscampagne, coach-zelfevaluatie) dezelfde naamruimte gebruikt in plaats van er een derde naast te zetten.

---

## 3. Het zelfstandige-modulepatroon, en de valkuil die het blootlegde

Dit platform bouwt elke nieuwe module zelfstandig op: een eigen map onder `server/<module>/`, een eigen `storage.ts` met een eigen databankhandvat, en tabellen die inline met `CREATE TABLE IF NOT EXISTS` worden aangemaakt zodra de module voor het eerst geladen wordt. Dat patroon is hier gevolgd — `server/kwaliteit-evaluaties/storage.ts` doet precies dat voor de zeven tabellen hierboven.

Dat patroon alleen is voor dit project echter niet voldoende. `tests/migraties-aanwezig.test.ts` doorzoekt alle `server/**/schema.ts`-bestanden op `sqliteTable(...)`-aanroepen en eist dat elke gevonden tabelnaam ook voorkomt in een `CREATE TABLE`-statement in een bestand onder `migrations/`. Dat is de bewaking tegen een tabel die alleen in de broncode van de applicatie bestaat en nergens gedocumenteerd staat als onderdeel van de databankgeschiedenis. Een tweede, omgekeerde toets (`tests/schema-dekt-databank.test.ts`) controleert het spiegelbeeld: elke tabel die daadwerkelijk in de databank staat, moet ook een `sqliteTable`-definitie hebben in een van de bestanden die `drizzle.config.ts` opsomt. Beide toetsen faalden meteen na het schrijven van `storage.ts` en `schema.ts`, wat de tweede helft van het patroon blootlegde: **een module heeft zowel de inline aanmaak in `storage.ts` áls een handgeschreven, gespiegelde migratie nodig, en haar `schema.ts` moet in `drizzle.config.ts`'s schema-lijst staan.**

Voor de migratie was de voor de hand liggende weg — `npx drizzle-kit generate` — een valkuil. `migrations/meta/_journal.json` in deze repository loopt alleen tot migratie 0005; de migraties 0006 tot en met 0010 zijn al met de hand geschreven en buiten drizzle-kit om toegevoegd. `drizzle-kit generate` berekent haar diff vanaf die verouderde snapshot en genereerde bij een eerste, later teruggedraaide poging een bestand van 465 regels dat bestaande tabellen als `mail_verzendlog` opnieuw probeerde aan te maken. Dat is verwijderd (`rm -f` op het gegenereerde bestand en de bijhorende snapshot) en `drizzle.config.ts` is teruggezet naar zijn oude staat voordat de juiste weg is gevolgd: een handgeschreven migratie naar het voorbeeld van `migrations/0006_bekwaamheid.sql` en `migrations/0009_mailverzendlog.sql` (backtick-aanhalingstekens, `--> statement-breakpoint` als scheiding tussen statements, `IF NOT EXISTS` overal, en een Nederlandstalige verantwoording bovenaan). Het resultaat is `migrations/0011_kwaliteit_evaluaties_organisatie.sql`, met het volgnummer bepaald door de bestaande bestanden in `migrations/` te tellen, niet door drizzle-kit's eigen boekhouding.

Deze migratie is getest tegen de echte migratieloper (`server/migratieloper.ts`) op een lege tijdelijke databank: alle zeven tabellen ontstaan correct en in de juiste volgorde. Omdat het bestand strikt additief is — alleen `CREATE TABLE` en `CREATE INDEX`, allemaal met `IF NOT EXISTS` — is er, naar het voorbeeld van de migraties 0006 en 0009, ook een toets toegevoegd aan `REEDS_TOEGEPAST` in `server/migratieloper.ts`, zodat een databank van vóór dit register de migratie correct als "al aanwezig" herkent in plaats van haar een tweede keer uit te voeren. `drizzle.config.ts` is uiteindelijk wél aangepast — met alleen het toevoegen van `./server/kwaliteit-evaluaties/schema.ts` aan de schema-lijst, zonder `generate` opnieuw te draaien.

---

## 4. Datamodel en rekenkern

`vragen.ts` legt de inhoud van de spec vast: zes rubrieken (A–F) met vraagcodes, een deel verplicht en een deel optioneel, en vijf beoordelingsdomeinen — passend, professioneel, activerend, toepasbaar, duurzaam — elk met een eigen gewicht (`ORG_EVAL_DOMEIN_GEWICHT`: 0,2 / 0,25 / 0,2 / 0,25 / 0,1). `scoring.ts` berekent op basis daarvan een gewogen totaalscore en een score per domein (`berekenOrganisatieScores`), en toetst die aan drie drempels uit de spec: een kwaliteitsnorm van 8,0 op het totaal, een minimum van 7,0 per domein, en een kritieke ondergrens van 6,0 — een enkel domein daaronder is voldoende voor een signaal, ook als het totaal de norm haalt. `bepaalAutomatischSignaal` past die drempels toe en levert een reden plus de betrokken domeinen, onafhankelijk van een eventueel signaal dat het contact zelf meldt door een antwoord als "ernstig" te markeren — beide kunnen naast elkaar bestaan voor dezelfde evaluatie, en beide worden apart weggeschreven in `evaluatie_signalen`.

`storage.ts` bewaart het onderscheid tussen een concept en een ingediende evaluatie expliciet: `vindOfMaakConceptEvaluatie` en `bewaarConcept` laten tussentijds opslaan toe zonder dat er al iets telt, en pas `diendeEvaluatieIn` berekent de score, legt die vast, en maakt eventuele signalen aan. Een tweede aanroep van indienen op dezelfde evaluatie herberekent niets en levert dezelfde `scoreTotaal` en hetzelfde `ingediendOp` terug (`alReedsIngediend: true`) — de spec vraagt nergens om een evaluatie na indienen nog te kunnen wijzigen, en dat is hier dus bewust dichtgezet in plaats van stilzwijgend toegelaten.

---

## 5. Routes, rechten en audit

Het token zelf is de enige toegangscontrole voor het contact: `maakUitnodiging` genereert een token dat 21 dagen geldig is (`UITNODIGING_GELDIG_DAGEN`), en `vindUitnodiging` geeft een expliciet `{ok:false, reden}` terug bij een onbekend, ongeldig of verlopen token in plaats van een generieke fout — de publieke pagina kan zo een precieze melding tonen zonder zelf iets over de databank te hoeven weten. Een ingetrokken uitnodiging (`trekUitnodigingIn`) sluit de link af zonder de al ingevulde antwoorden te verwijderen.

Aan de beheerderskant lopen de nieuwe routes achter dezelfde bewakers als de rest van het platform: `vereisAdmin` en `adminIdVanSessie(req)` uit `server/admin-guard.ts`. Vier nieuwe audit-acties zijn toegevoegd aan `AUDIT_ACTIES` in `server/audit-log.ts` — `evaluatie_organisatie_uitnodiging_verstuurd`, `evaluatie_organisatie_uitnodiging_ingetrokken`, `evaluatie_organisatie_evaluatie_ingediend`, `evaluatie_organisatie_signaal_aangemaakt` — zodat elke stap in de keten, van versturen tot signaal, dezelfde spoorbaarheid krijgt als de rest van de applicatie.

Naast de letterlijke lijst van eindpunten uit spec-§16 zijn enkele beheerdersgemakseindpunten toegevoegd onder `/api/admin/kwaliteit-evaluaties/...` en `/api/admin/quality/...` — lijsten van sessies, contacten en ingediende evaluaties ten behoeve van het beheerdersscherm. Die zijn functioneel, niet inhoudelijk: ze voegen geen nieuwe meetregel toe, ze ontsluiten enkel wat `storage.ts` al bijhoudt. Het beheerdersscherm hergebruikt bovendien de bestaande, scope-bewaakte `/api/organisaties`-route voor de organisatiekeuze in plaats van een eigen lijst te bouwen.

Mail loopt via de generieke `verstuurBericht(...)` in `server/bulk-import/mailer.ts`, hetzelfde pad als de rest van het platform.

---

## 6. Schermen

`client/src/pages/evaluatie-organisatie.tsx` is het publieke tokenformulier voor het contact: het toont de sessie- en organisatienaam, de vragen per rubriek, laat tussentijds bewaren toe, en meldt duidelijk wanneer een token ongeldig, verlopen of ingetrokken is of wanneer de evaluatie al werd ingediend. Dit scherm is visueel doorlopen op de volledige token-tot-indienen-keten en toonde geen opmaakproblemen.

`client/src/pages/admin-kwaliteit-evaluaties.tsx` is het beheerdersoverzicht: sessie kiezen, contact uitnodigen, status van uitnodigingen en ingediende evaluaties met hun score bekijken. Dit scherm volgt dezelfde opbouw en componenten als de bestaande beheerderspagina's en is niet apart pixel-voor-pixel nagekeken; het is functioneel gecontroleerd via de API-laag eronder.

Beide schermen zijn ontsloten via `client/src/App.tsx` (routes) en `client/src/pages/admin.tsx` (navigatie-item).

---

## 7. Getest

`tests/kwaliteit-evaluaties-organisatie.test.ts` (14 toetsen, allemaal slagend) dekt: tabelaanmaak en de afwezigheid van naamsbotsing met het `kwaliteit_`-voorvoegsel, tokenvalidatie (geldig, ongeldig, misvormd), dat een token pas als gebruikt telt bij indienen en niet al bij het ophalen van het concept, de verplichte-vragencontrole per rubriek, de volledige gewogen scoreberekening (met een uitgerekend controlegetal), dat scoring tekstantwoorden en onbekende vraagcodes negeert, de drie signaleringsgevallen van `bepaalAutomatischSignaal` (geen signaal, lage totaalscore, één kritiek domein), idempotentie bij dubbel indienen, onwijzigbaarheid van het concept na indienen, de gecombineerde signalen (zelf gemeld "ernstig" én automatisch "automatisch_laag") met hun eigen `wilContact`-gegeven, en het bestaan van de vier nieuwe audit-acties in het register.

Na het toevoegen van de migratie en haar `REEDS_TOEGEPAST`-toets zijn ook `tests/migratieloper.test.ts`, `tests/migratieloper-wedloop.test.ts`, `tests/migraties-aanwezig.test.ts` en `tests/schema-dekt-databank.test.ts` aangepast waar ze een vaste lijst van bekende migraties of tabellen bijhielden, en lopen groen. De volledige suite: **241/241 testbestanden, 3159/3159 toetsen, allemaal slagend.** `npm run check` (tsc) toont 64 foutmeldingen, stuk voor stuk in bestanden die deze ronde niet heeft aangeraakt — dezelfde 64 als de basislijn vóór dit werk; geen enkele fout raakt `server/kwaliteit-evaluaties/`, `evaluatie-organisatie.tsx` of `admin-kwaliteit-evaluaties.tsx`.

---

## 8. Wat bewust nog niet gebouwd is

Deze ronde bouwt uitsluitend de organisatie-evaluatie. Nog uitdrukkelijk uitgesteld naar de volgende fase(n), per de spec zelf:

- de anonieme deelnemerscampagne (QR-code / korte link) — spec §8;
- de coach-zelfevaluatie — spec §9;
- de vragenbibliotheek met versiebeheer — spec §10;
- het kwaliteitscasedashboard;
- fijnmazige RBAC-rollen specifiek voor deze module (voorlopig loopt alles achter de bestaande `vereisAdmin`-bewaking).

Geen van deze onderdelen is aangeraakt of voorbereid met stub-code; ze staan open voor de volgende bouwronde.

---

## 9. Branch en volgende stap

Alle werk staat op `kwaliteit-evaluaties/organisatie-evaluatie`, vanaf `bc83f6e` (main). Er is niet naar `main` gemerged — dat gebeurt pas na goedkeuring. Voorstel voor de volgende fase: de deelnemerscampagne en de coach-zelfevaluatie (spec §8/§9), voortbouwend op dezelfde `evaluatie_`-naamruimte en hetzelfde token- en scoringspatroon.
