# Technische schuld TaPas CORE

Peildatum: 26-07-2026. Alle cijfers in dit document zijn op die dag gemeten met
de commando's die erbij staan. Wie het later leest: meet opnieuw voor je erop
vertrouwt.

Dit is geen wensenlijst. Het is een lijst van dingen die vandaag al geld of
risico kosten, met per punt een voorstel en de reden waarom het niet
onmiddellijk in deze pull request is opgelost.

## Samenvatting

| Onderwerp | Ernst | Zichtbaar voor de gebruiker |
|---|---|---|
| Magic-link-endpoints roepen niet-bestaande methodes aan | hoog | ja, de aanvraag faalt |
| Verkeerde veldnamen bij het bepalen van de skin | midden | ja, mogelijk verkeerde huisstijl |
| 73 typefouten als bekende schuld | midden | nee |
| `server/storage.ts` van 3.646 regels | midden | nee |
| Em-dashes in de vertaaltabel | laag | ja, in de teksten |
| Een technische fout die als 404 verschijnt | laag | ja, misleidende foutmelding |

## 1. TODO- en FIXME-markers: geen enkele

```
grep -rn "TODO\|FIXME" server client shared --include=*.ts --include=*.tsx
```

Geeft geen enkele treffer. Er is dus niets te trieren en niets op te ruimen.

Dat is een gunstige uitkomst maar geen bewijs van gezondheid: het betekent enkel
dat schuld hier niet als marker in de code staat. De punten hieronder zijn met
`tsc` en met lezen gevonden, niet met grep. Wie de staat van deze codebase wil
kennen, moet dus niet naar markers kijken.

## 2. Magic-link-endpoints roepen methodes aan die niet bestaan

Ernst: **hoog**. Dit is geen stijlkwestie maar een fout die de gebruiker raakt.

- `server/routes-deelnemer.ts:190` roept `storage.maakMagicLink(...)` aan.
- `server/routes-deelnemer.ts:211` roept `storage.wisselMagicLink(...)` aan.

Beide methodes bestaan niet. Nagegaan met
`grep -rn "maakMagicLink\|wisselMagicLink" server --include=*.ts`: enkel deze twee
aanroepen, geen enkele definitie. `tsc` meldt ze als TS2339 op
`DatabaseStorage`. Bij gebruik geeft dit een `TypeError`, dus een 500 op
`POST /api/deelnemers/magic` en op het inwisselen van de link.

Voorstel: eerst uitzoeken of deze route nog bedoeld is. Als ja, de twee methodes
implementeren met een test per pad (aanvragen, inwisselen, verlopen link,
tweemaal inwisselen). Als nee, de route verwijderen. Wat er nu staat is de
slechtste van de drie mogelijkheden: een route die belooft te werken en het niet
doet.

Niet hier opgelost omdat spoor 2b uitdrukkelijk geen gedrag mag wijzigen, en dit
is ofwel nieuwe functionaliteit ofwel het verwijderen van een endpoint. Beide
horen in een eigen pull request met eigen tests.

## 3. Verkeerde veldnamen bij het bepalen van de skin

Ernst: **midden**. `server/routes-deelnemer.ts:118-122` sorteert de afnames van
een deelnemer om de meest recente te vinden en leidt daaruit de skin af:

```ts
const meestRecent = afnames.sort(
  (a, b) => new Date(b.aangemaakt).getTime() - new Date(a.aangemaakt).getTime()
)[0];
const instrument = meestRecent?.instrument ?? "";
```

Het veld heet `createdAt` en niet `aangemaakt`, en `instrumentId` en niet
`instrument` (TS2339 en TS2551). Gevolg: `new Date(undefined)` levert een
ongeldige datum, de sortering is dus willekeurig, en `instrument` is altijd de
lege tekenreeks waardoor de skin altijd op de standaardwaarde valt.

Dit faalt stil. Er komt geen foutmelding; de deelnemer krijgt mogelijk de
verkeerde huisstijl te zien. Dat is precies het soort fout waar een typefout in
de baseline een echte bug verbergt.

Voorstel: de veldnamen rechtzetten en een test toevoegen die per instrument de
verwachte skin controleert. Bewust niet meegenomen in deze pull request: het
verandert zichtbaar gedrag en hoort dus met een eigen test en eigen
verantwoording.

## 4. Typefouten: 73 als bekende schuld

```
npx tsc --noEmit | grep -c "error TS"
```

Stand: **73**. Bij de aanvang van deze pull request was dat 77; vier zijn hier
opgelost. De regel uit het releasebeleid blijft: deze telling mag niet stijgen.

### Wat er in deze pull request wel is opgelost

Vier gevallen van hetzelfde soort, zonder enige gedragswijziging:

- `server/registry.ts:611`, `server/routes-coach-contact.ts:61`,
  `server/scoring.ts:123`: het doorlopen of uitspreiden van een `Map` of `Set`
  staat het tsconfig-doel niet toe (TS2802). Vervangen door `Array.from(...)`,
  wat exact dezelfde uitkomst geeft.
- `server/routes-coach-contact.ts:62`: een parameter zonder type (TS7006), nu
  `t: number`.

Deze vier zijn gekozen omdat de betekenis van de code aantoonbaar niet verandert.
Alle andere fouten zijn dat niet.

### Wat er blijft staan, per groep

Verdeling over de foutcodes:

| Code | Aantal | Aard |
|---|---|---|
| TS2345 | 29 | argument van het verkeerde type |
| TS2322 | 21 | toekenning van het verkeerde type |
| TS2538 | 12 | `undefined` als index gebruikt |
| TS2339 / TS2551 | 5 | eigenschap bestaat niet |
| TS1252 | 2 | functiedeclaratie in een blok, doel ES5 |
| TS2352 | 2 | onmogelijke `as`-conversie |
| TS2554 / TS7009 | 2 | `new` op iets dat geen constructor is |

Verdeling over de bestanden met de meeste fouten:

| Bestand | Aantal |
|---|---|
| `client/src/pages/admin-inzichten.tsx` | 14 |
| `client/src/pages/lounge.tsx` | 13 |
| `client/src/pages/studie.tsx` | 8 |
| `server/t4teens/scoring.ts` | 6 |
| `server/t4students/scoring.ts` | 6 |
| `server/gids-manager.ts` | 6 |
| `client/src/pages/admin-academy.tsx` | 6 |
| `server/routes-deelnemer.ts` | 5 |

Voorstel per groep:

- **De twaalf TS2538 in `t4teens/scoring.ts` en `t4students/scoring.ts`** zitten
  in de scoreberekening en gaan over een index die `undefined` kan zijn. Dat is
  geen typeprobleem maar een openstaande vraag: wat MOET er gebeuren als de index
  ontbreekt? Een `!` erbij zetten maakt de fout onzichtbaar zonder de vraag te
  beantwoorden, en dit is de code die scores oplevert. Eerst tests op deze
  functies, dan pas typen.
- **De 50 TS2345 en TS2322**, grotendeels in de admin-schermen, ontstaan waar
  API-antwoorden als `any` of als `Response` binnenkomen. De echte oplossing is
  gedeelde antwoordtypes tussen server en client, niet vijftig losse `as`-casts.
  Dat is een eigen ingreep met een eigen pull request.
- **De twee TS1252** (`client/src/pages/t4o-deelnemer.tsx:345`,
  `server/driverscan/rapport-pdf.ts:290`) lijken triviaal, maar een
  functiedeclaratie omzetten naar een `const`-pijlfunctie verandert het
  hijsgedrag. In code zonder test is dat geen veilige wijziging.
- **`server/index.ts:115`**: `secure: "auto"` wordt door de typedefinities van
  `express-session` niet aanvaard, terwijl de bibliotheek de waarde wel
  ondersteunt en het commentaar erboven uitlegt dat ze nodig is achter de
  HTTPS-proxy. Hier is de typedefinitie strenger dan de werkelijkheid. Niet
  aanraken: de cookie-instelling is kritiek voor de sandbox-hosting.

Waarom niet gewoon alles opruimen: een deel van deze bestanden heeft geen enkele
test. Typefouten repareren zonder vangnet is precies de ingreep waarbij gedrag
stil verandert. De baseline is er om de schuld te begrenzen, niet om ze te
verbergen.

## 5. Grote modules

`server/storage.ts` is met **3.646 regels** de grootste module. De ontvlechting
naar `server/repositories/` is begonnen en telt daar nu 2.143 regels over tien
bestanden.

De grootste bestanden op de peildatum:

| Bestand | Regels |
|---|---|
| `server/storage.ts` | 3.646 |
| `client/src/pages/dashboard.tsx` | 1.884 |
| `shared/i18n.ts` | 1.808 |
| `client/src/pages/admin-credits.tsx` | 1.664 |
| `server/chat-engine.ts` | 1.556 |
| `client/src/pages/lounge.tsx` | 1.306 |

`shared/i18n.ts` hoort in die lijst niet thuis als schuld: dat is een
vertaaltabel en die is nu eenmaal lang.

Voorstel: `server/storage.ts` cluster per cluster verder ontvlechten volgens het
patroon dat `server/repositories/` al gebruikt, met de publieke interface intact
via een re-export zodat aanroepers niet breken. Alleen clusters met testdekking,
en per stap de volledige suite. Wat in deze pull request is verplaatst staat in
de bijhorende commit; het vervolg blijft hier open staan.

De grote schermbestanden zijn een aparte kwestie. Ze combineren opvraging,
berekening en weergave, en het project heeft geen DOM-testomgeving waardoor ze
niet te testen zijn zonder eerst de logica eruit te halen. Voorstel: bij de
volgende inhoudelijke wijziging aan zo'n scherm de berekening naar een pure
functie in `shared/` tillen en daar testen. Niet als opruimactie op zich, want
een scherm herschrijven zonder test is een risico zonder opbrengst.

## 6. Em-dashes in de vertaaltabel

`shared/i18n.ts` bevat **160** em-dashes in de vertaalde teksten, gemeten met
`grep -c $'—' shared/i18n.ts`. Een voorbeeld is de sleutel
`iz_drempel_gehaald`, waar tussen "Drempel bereikt" en "in voorbereiding" een
em-dash staat in plaats van een koppelteken.

(De tekens zelf staan hier niet uitgeschreven, juist omdat de huisregel ze
verbiedt. Vandaar het escape in het grep-commando hierboven.)

De huisregel is een gewoon koppelteken. Deze teksten zijn echter productinhoud in
vijf talen en die aanpassen is een zichtbare wijziging aan wat de gebruiker leest.
Zoiets hoort niet mee te liften op een technische pull request.

Voorstel: in één aparte, goed benoemde commit alle em-dashes in de vertaaltabel
vervangen, met een controle in `tests/i18n-dekking.test.ts` die nieuwe em-dashes
tegenhoudt. Eerst laten bevestigen dat de teksten mogen wijzigen.

## 7. Een technische fout die als 404 verschijnt

`/api/gdpr/afnames/:id/export` vangt zijn eigen fouten op en antwoordt dan met
404. Gevolg: een echte storing is niet te onderscheiden van "deze afname bestaat
niet". Dat is bij het bouwen van de scope-isolatiematrix opgevallen, toen een
ontbrekende methode in een testdubbel als 404 terugkwam in plaats van als fout.

Voorstel: 404 enkel bij een afname die niet bestaat, 500 bij een fout, en de fout
loggen. Kleine wijziging, maar ze wijzigt wel een antwoordcode en hoort dus met
een eigen test.

## 8. Wat bewust geen schuld heet

- **Encryptie-at-rest staat uit.** Dat is geen vergetelheid maar een
  productiebeslissing. De hook is klaar, wordt op alle acht databank-handles
  aangeroepen en meldt bij elke start of ze actief is. Zie
  `server/db-encryptie.ts` en `GDPR-FIX6-encryptie-at-rest.md`.
- **CSP staat uit in `helmet`.** Bewust en gedocumenteerd op
  `server/index.ts:45`: een te strikte CSP zou de bestaande frontend breken.
  Liever geen CSP dan een brekende CSP. Wel een openstaande verbetering, geen
  fout.
- **Geen backfill van de verzender-kolommen op bestaande afnames.** Er is geen
  betrouwbare bron voor wie ze aanmaakte. Raden zou het spoor vervalsen.
