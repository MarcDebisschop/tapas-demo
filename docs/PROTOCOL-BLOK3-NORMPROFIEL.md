# Werkprotocol Blok 3 — Het normprofiel

Bekwaamheidsmodule Tapas CORE · laag 1, laag 2 en laag 3 · 13 augustus 2026

Dit document legt vast wat er in blok 3 is gebouwd, welke keuzes daarbij zijn
gemaakt en waarop ze berusten. Het is geen samenvatting achteraf maar het
werkstuk zelf: bij een bezwaar tegen een beslissing moet hier na te lezen zijn
hoe de cijfers tot stand kwamen.

Blok 3 is bewust in drie lagen gesplitst en alle drie zijn nu af en gemeten.
Laag 1 is de rekenkern: validatie van de cesuur, asscores en activiteit. Laag 2 is
de beslismachine `beslisregels.ts`, met de migratie die het beslisvocabulaire
gelijktrekt met het draaiboek. Laag 3 is de weg naar buiten: de drie schrijfwegen
als webadres en scherm 9.5 erboven. De keuze achter het vocabulaire staat in
sectie 6; wat er nog open blijft, staat in sectie 12.

---

## 1. Wat er gebouwd is

| Bestand | Aard | Omvang |
|---|---|---|
| `server/bekwaamheid/normprofiel.ts` | nieuw | 294 regels — validatie van de cesuur + asscoreberekening |
| `server/bekwaamheid/activiteit.ts` | nieuw | 179 regels — bewijsstuk 5, telling en praktijkzorgsignaal |
| `server/bekwaamheid/storage.ts` | uitgebreid (nieuw bestand) | +339 regels — de naamruimte `normprofielen` met onomkeerbare bevriezing |
| `server/audit-log.ts` | bestaand bestand nr. 2 van 9 | +3 regels — drie auditacties |
| `tests/bekwaamheid-normprofiel.test.ts` | nieuw | 64 tests |
| `server/bekwaamheid/beslisregels.ts` | nieuw | 292 regels — de pure beslismachine |
| `server/bekwaamheid/schema.ts` | nieuw bestand | `BESLISUITKOMSTEN` gelijkgetrokken + `VOORSTELBARE_UITKOMSTEN` |
| `migrations/0007_beslisuitkomsten.sql` | nieuw | herbouwt `bekwaamheid_beslissingen` |
| `server/migratieloper.ts` | bestaand bestand nr. 5 van 9 | +8 regels — de toets op 0007 |
| `tests/migratieloper.test.ts` | bestaand bestand nr. 9 van 9 | +1 test op de eindtoestand na 0007 |
| `tests/bekwaamheid-beslisregels.test.ts` | nieuw | 58 tests |
| `scripts/rijtelling.py` | nieuw | meetgereedschap |
| `scripts/mutatieproef-blok3.py` | nieuw | meetgereedschap laag 1 |
| `scripts/proef-migratie-0007.py` | nieuw | meetgereedschap laag 2 |
| `scripts/mutatieproef-blok3b.py` | nieuw | meetgereedschap laag 2 |
| `server/bekwaamheid/routes-normprofiel.ts` | nieuw | 335 regels — de drie schrijfwegen plus twee leeswegen |
| `client/src/pages/admin-bekwaamheid-normprofiel.tsx` | nieuw | 859 regels — scherm 9.5 |
| `tests/bekwaamheid-normprofiel-routes.test.ts` | nieuw | 41 tests door het echte webadres |
| `server/routes.ts` | bestaand bestand nr. 10 | +9 regels — registratie van de routes |
| `client/src/App.tsx` | bestaand bestand nr. 11 | +2 regels — import en route |
| `scripts/mutatieproef-blok3c.py` | nieuw | meetgereedschap laag 3 |

De bestandsgrens stond op negen voor laag 1 en laag 2 en is voor laag 3 door Marc
verruimd naar **elf**. De twee erbij zijn `server/routes.ts` en
`client/src/App.tsx`, en dat zijn precies de twee plaatsen waar een nieuwe route
en een nieuw scherm zich moeten aanmelden: zonder die twee regels bestaat het werk
wel, maar is het onbereikbaar. Er is geen twaalfde bestaand bestand aangeraakt.
Nagemeten met `git status` vóór en ná het werk; de uitkomst staat in sectie 10.

---

## 2. De drie zuivere lagen

Het bouwplan eist voor `beslisregels.ts` een pure functie: "normprofiel +
asscores + activiteit in, voorstel + bindende regel uit. Geen database, geen
Express." Diezelfde eis is doorgetrokken naar de twee stappen die aan het
voorstel voorafgaan, om dezelfde reden: een cesuur waarvan de rekenwijze niet
exact reproduceerbaar is, is bij een bezwaar niet te verdedigen.

### 2.1 `valideerNormprofiel` — wat SQLite niet kan uitdrukken

De tabel heeft al drie CHECK-beperkingen: `versie >= 1`, `drempel_totaal` binnen
(0,1] en `length(onderbouwing) >= 200`. Wat een CHECK niet kan uitdrukken is de
eis die het zwaarst weegt: **dat de vier wegingen samen exact 1 vormen**.

Een weging die tot 0,95 optelt levert een totaalscore die stilzwijgend vijf
procent te laag is, en dat verschil zit precies in het gebied waar de cesuur van
0,70 ligt. Zo'n fout is met het oog niet te zien in een JSON-veld.

De validatie geeft **alle** bevindingen terug, niet alleen de eerste. Wie een
normprofiel invult, vult veertien velden in; die één voor één laten afkeuren
voegt niets aan de gegevenskwaliteit toe.

### 2.2 De tolerantie op de weging — een gemeten getal, geen aangenomen getal

`WEGING_TOLERANTIE = 1e-9`.

Bij het schrijven van deze module heb ik in een commentaar beweerd dat
0,20 + 0,30 + 0,30 + 0,20 in IEEE-754 niet exact 1 is. **Die bewering was
onjuist** en de test die ik erop bouwde, is meteen gesneuveld. Daarna heb ik het
gemeten over twaalf plausibele wegingen. Twee komen niet exact op 1 uit:

- 0,40 + 0,30 + 0,20 + 0,10 → 0,9999999999999999
- 0,15 + 0,15 + 0,35 + 0,35 → 0,9999999999999999

De weging uit het bouwplan komt wél exact op 1 uit. De tolerantie is dus nodig,
maar niet om de reden die ik eerst opschreef. Beide gemeten wegingen staan nu als
test in de suite. De bovengrens van 1e-9 volgt uit het kleinste betekenisvolle
verschil in een weging — 0,01 — dat zeven ordes groter is.

### 2.3 `berekenAsscores` — drie regels met elk een reden

1. **Status `nvt` telt niet mee, en telt ook niet als openstaand.** Een
   bewijsstuk dat niet van toepassing is verklaard, is geen leemte in het
   dossier. Zou het als openstaand tellen, dan werd een dossier met een terecht
   overgeslagen bewijsstuk nooit volledig.

2. **Meerdere bewijsstukken op één as worden ongewogen gemiddeld.** Het
   normprofiel weegt ássen, niet bewijsstukken. Er is in het draaiboek geen
   grondslag om binnen een as het ene bewijsstuk zwaarder te laten wegen; een
   verzonnen weging zou de cesuur onverdedigbaar maken.

3. **Het totaal is `null` zolang niet elke as een score heeft.** Een gewogen som
   over drie van de vier assen is geen onvolledig totaal maar een **verkeerd**
   totaal: het valt automatisch lager uit en zou iemand laten zakken op een
   meting die nog niet gedaan is. In de test staat het geval waarin drie assen op
   0,90 staan; een naïeve implementatie geeft dan 0,72 en dus vals "gehaald".

**De weging komt uit het normprofiel, niet uit het bewijsstuk.** Bouwplan §6.7
zegt dat de bewijsstukrij een eigen `weging` draagt, "overgenomen uit het
normprofiel, niet herberekend". Die kolom legt vast wat er gold. Zou de
berekening die kolom lezen, dan bepaalde een verkeerd overgenomen weging de
uitkomst en was het normprofiel niet meer de norm. Het type `BewijsstukScore`
heeft daarom geen wegingveld — de fout is niet te maken.

### 2.4 `berekenActiviteit` — bewijsstuk 5

Drie keuzes, elk vastgelegd in een test:

- **`voltooidOp`, niet de aanmaakdatum.** Anders haalt iemand de drempel door zes
  uitnodigingen te versturen die niemand invult. De test met zes onvoltooide
  afnames komt op 0 uit.
- **Beide vensterranden tellen mee.** Een afname die exact op de eerste dag van
  het venster is voltooid, valt erbinnen. De alternatieve keuze zou iemand op één
  dag laten struikelen zonder inhoudelijke reden.
- **De maandaftrek klemt de dag.** 31 maart minus één maand is in JavaScript
  3 maart, niet 28 februari. Bij een venster van 24 maanden speelt dat op
  29 februari — het soort fout dat pas in 2028 aan het licht komt en dan een
  bezwaar oplevert. `vensterBegin("2028-02-29", 24)` geeft `"2026-02-28"`.

**De module velt geen oordeel.** Draaiboek §5.2: "Onder de drempel is **geen
tekortkoming**: het is de trigger voor de route slapende licentie of reactivatie."
De uitkomst heet daarom `haalt` en niet `voldoet`. Een test controleert dat de
woorden "gezakt", "afgekeurd", "faalt" en "mislukt" nergens in het bestand
voorkomen.

### 2.5 Het praktijkzorgsignaal — de drempel van vier

`MINIMUM_AFNAMES_VOOR_SIGNAAL = 4`.

`afnamekwaliteit.ts` gebruikt zelf een ondergrens van vijf **items** binnen één
afname, met de reden: "Onder de vijf gemeten items is het aandeel te wankel om er
iets over te zeggen." Diezelfde logica geldt een laag hoger, maar met een andere
teller: hier gaat het om **afnames**, en de activiteitsdrempel is zes. Een
ondergrens van vijf of zes zou betekenen dat juist bij wie weinig afneemt nooit
een signaal kan ontstaan, terwijl daar de aanleiding tot kijken het grootst is.
Vier laat een signaal toe bij twee van de vier en houdt het tegen bij één van de
drie.

---

## 3. De bevriezing staat in de datalaag

Bouwplan: "Bevriezing wordt in de datalaag afgedwongen, niet in de UI: een update
op een rij met `bevrorenOp != null` gooit. Een nieuwe cesuur is een nieuwe
versie."

Waarom niet een knop die grijs wordt. Een bevroren cesuur is de enige reden
waarom een beslissing over iemands bekwaamheid achteraf te verdedigen is: ze
bewijst dat de lat er al lag voordat er gemeten werd. Een controle in de
gebruikersinterface bewijst dat niet, want ze is te omzeilen door een tweede
schrijfweg, een script of een latere route. Alleen een controle op de plek waar
de rij daadwerkelijk verandert, geldt voor alle schrijfwegen tegelijk.

Vier eigenschappen, elk met een test:

- **Er is geen manier om te ontdooien.** Geen `ontdooi`, geen `heropen`, geen
  `maakWijzigbaar`. Dat is geen vergetelheid: een cesuur die terug open kan, is
  geen cesuur. Een test controleert dat die namen niet bestaan.
- **Het versienummer wordt door de opslag bepaald, niet door de aanroeper.** Wie
  het nummer meegeeft, kan een bestaande versie overschrijven en daarmee de
  geschiedenis herschrijven.
- **`geldend()` geeft het hoogste BEVROREN nummer, niet het hoogste.** Een
  normprofiel dat nog niet bevroren is, is een concept. Zou deze functie het
  hoogste nummer geven, dan zou iemand die aan een nieuwe cesuur werkt onbedoeld
  de lopende rondes op een half ingevulde lat zetten.
- **Onleesbare JSON gooit bij het lezen.** Een normprofiel waarvan de weging niet
  te lezen is, mag geen beslissing raken. Zou het stil doorrekenen, dan zou
  `"0.2" * 0.3` een getal opleveren en niemand het merken.

---

## 4. De poort van blok 3 — de tabel met grensgevallen

De poort vraagt "een tabelgestuurde test met minstens twintig gevallen, inclusief
de gemene". Er staan **21 tabelgevallen** in (16 op de cesuur, 5 op de
activiteit), samen met 43 losse tests: **64 tests, alle groen**.

De vier gemene gevallen die de poort met naam noemt:

| Geval | Meting | Wat de beslisregel eruit moet halen |
|---|---|---|
| Totaal 0,703 met een as op 0,59 | totaal haalt, as haalt niet | de as bindt — moet zakken |
| Totaal 0,69, alle assen op 0,69 | totaal haalt niet, assen halen | het totaal bindt — moet zakken |
| Activiteit precies 6 | `haalt: true`, `tekort: 0` | mag door |
| Activiteit 5 | `haalt: false`, `tekort: 1` | slapend, niet gezakt |

Daarnaast: beide drempels inclusief getoetst (0,70 exact en 0,60 exact halen
wél), de aandachtszone tussen 0,60 en 0,65 met haar bovengrens, 0,5999 en 0,6999
net onder de drempels, twee en vier assen onder de drempel, en twee gevallen die
bewijzen dat de weging werkelijk wordt toegepast: dezelfde score van 0,61 op de
lichte as `weten` (0,20) geeft totaal 0,882, op de zware as `zien` (0,30) geeft
ze 0,848.

De test dat de machine `bekwaamheid_accreditaties.ingetrokkenOp` nooit schrijft,
staat er als bronbewijs: geen van beide nieuwe modules bevat het woord
"accreditatie", "ingetrokkenOp" of "ingetrokken_op".

---

## 5. De mutatieproef op laag 1

Zes mutaties, elk op een kernregel, elk apart gedraaid en byte-identiek
teruggedraaid met `cmp`-controle. **Zes op zes betrapt.**

| Mutatie | Suite |
|---|---|
| `aantal >= drempel` → `aantal > drempel` | zakt |
| Ondergrens van het venster exclusief maken | zakt |
| Tolerantie van 1e-9 naar 0,1 | zakt |
| Het totaal ook over een onvolledig dossier rekenen | zakt |
| De bevriezing een wijziging niet meer laten tegenhouden | zakt |
| Status `nvt` weer als openstaand tellen | zakt |

Bij blok 2 vond deze proef een echte fout in een van mijn eigen nieuwe tests. Ze
is daarom geen formaliteit.

---

## 6. Het beslisvocabulaire — beslist en vastgelegd

Laag 1 sloot met een open vraag: de code en het draaiboek benoemden
**verschillende uitkomsten**, zonder dat er ergens een reden voor was
opgeschreven.

| Draaiboek §5.3 | Code vóór 0007 | Code ná 0007 |
|---|---|---|
| Bekrachtigd | `bekrachtigd` | `bekrachtigd` |
| Bekrachtigd met aandachtspunt | `bekrachtigd_met_aandachtspunt` | `bekrachtigd_met_aandachtspunt` |
| Voorwaardelijk bekrachtigd | `voorwaardelijk` | `voorwaardelijk` |
| **Opgeschort** | **`herkansing`** | **`opgeschort`** |
| **Beîndigd** | **`niet_bekrachtigd`** | **`beeindigd`** |

Marc heeft de keuze aan mij overgelaten. Ik volg het draaiboek, om vier feitelijke
redenen:

1. `herkansing` staat al in `RONDESOORTEN` als **soort ronde**. Hetzelfde woord
   ook als beslisuitkomst gebruiken maakt van twee verschillende dingen één term.
2. `niet_bekrachtigd` komt in het draaiboek niet voor. Het draaiboek verbiedt
   uitdrukkelijk "gezakt", "afgekeurd" en "onvoldoende"; een term die de
   bekrachtiging letterlijk ontkent, ligt in datzelfde register.
3. `opgeschort` en `beeindigd` staan **al** in `LICENTIESTATUSSEN`. Na 0007 dragen
   beslissing en licentie hetzelfde woord, en hoeft er nergens hertaald te worden.
4. Alle veertien tabellen waren leeg. De correctie kostte nu niets; later kost ze
   een migratie plus alle beslissingen die er inmiddels onder genomen zijn.

**Terugdraaibaar.** Wie deze keuze wil herzien, hoeft drie dingen aan te raken:
`migrations/0007_beslisuitkomsten.sql`, de regel in `server/migratieloper.ts` en
`BESLISUITKOMSTEN` in `server/bekwaamheid/schema.ts`. De beslismachine zelf staat
er buiten: die kent alleen `VOORSTELBARE_UITKOMSTEN`.

---

## 7. De beslismachine

`server/bekwaamheid/beslisregels.ts` (292 regels) is één zuivere functie
`beoordeel(invoer)`. Ze kent geen databank, geen klok en geen verzoek.

De regels lopen van zwaar naar licht. De **eerste** die aanslaat is de bindende
regel, en die wordt bij naam in de uitkomst gemeld:

| # | Regel | Voorstel |
|---|---|---|
| 1 | twee of meer assen onder de drempel | `opgeschort` |
| 2 | precies één as onder de drempel | `voorwaardelijk` |
| 3 | totaal onder de drempel | `voorwaardelijk` |
| 4 | een as in de aandachtszone (drempel ≤ score ≤ 0,65) | `bekrachtigd_met_aandachtspunt` |
| 5 | administratieve leemte | `bekrachtigd_met_aandachtspunt` |
| 6 | niets van dit alles | `bekrachtigd` |

Drie harde grenzen, elk met een test die ze vasthoudt:

- **Ze stelt voor, ze beslist niet.** De uitkomst heet `Voorstel` en draagt de
  toegepaste regels mee, zodat een mens kan zien waarom.
- **Ze stelt nooit `beeindigd` voor.** Het retourtype is `VoorstelbareUitkomst`,
  de vier zonder `beeindigd`. Beîndiging vereist twee mislukte herkansingen,
  weigering of een integriteitsbreuk: menselijke feiten die niet in asscores
  zitten. De typecontrole maakt dit onmogelijk, niet de goede bedoeling.
- **Ze raakt de accreditatie niet aan.** Bronbewijs: geen van de modules bevat de
  woorden "accreditatie", "ingetrokkenOp" of "ingetrokken_op".

En één scheiding die het draaiboek uitdrukkelijk eist. De **activiteitsroute**
(`voldoende_activiteit` of `slapend`) is een **apart veld**, nooit een uitkomst.
Draaiboek r391, letterlijk: "Onder de drempel is geen tekortkoming: het is de
trigger voor de route slapende licentie of reactivatie." Een dossier dat nog niet
volledig is, levert `{uitkomst: null, onvolledig: [...]}` — nooit een lage
uitkomst.

`tests/bekwaamheid-beslisregels.test.ts`: 22 tabelgevallen plus losse tests,
**58 tests, alle groen**.

Twee tests keken aanvankelijk naar de broncode en sloegen aan op **mijn eigen
commentaar**: de modulekop citeert "gezakt, afgekeurd en onvoldoende" en noemt
`beeindigd` bij naam. Opgelost met een helper `codeZonderCommentaar()`, plus een
test die bewijst dat de aanname achter die helper klopt.

---

## 8. Migratie 0007 en haar proef

`migrations/0007_beslisuitkomsten.sql` herbouwt `bekwaamheid_beslissingen`: twaalf
kolommen in dezelfde orde, vijf CHECKs, de unieke index op `ronde_id`.

Ze **hertaalt oude waarden niet**. Een rij met `herkansing` laat de migratie
vallen. Dat is de bedoeling: stil hertalen zou een bestaande beslissing van
betekenis veranderen zonder dat iemand het ziet.

Twee dingen die tijdens het bouwen zijn rechtgezet:

**`PRAGMA foreign_keys` in een migratie doet niets.** `server/migratieloper.ts`
draait elke migratie binnen `db.transaction()`, en SQLite negeert die pragma in een
transactie. De twee regels zijn verwijderd en vervangen door een onderbouwing in
vier punten: (a) **niets** verwijst naar `bekwaamheid_beslissingen` — nul treffers
over alle migratiebestanden, alle vijftien vreemde sleutels in 0006 wijzen de
andere kant op; (b) de uitgaande sleutel naar `bekwaamheid_rondes` wordt identiek
herschreven; (c) de loper draait op `server/storage.ts:119`, vóór
`borgDatabankIntegriteit()` op `:1614` die `PRAGMA foreign_keys = ON` zet, dus
afdwinging staat tijdens de migratie uit; (d) alles zit in één transactie.

**De eerste proef meldde valse OK's.** Met sleutelafdwinging aan vielen de inserts
op de vreemde sleutel, dus "geweigerd" zei niets over de CHECK. De herschreven
proef eist dat de foutmelding de **naam van de beperking** bevat.
`scripts/proef-migratie-0007.py` draait nu de volledige keten — alle migraties tot
0006, dan een geaccrediteerde, een normprofiel en een ronde — en meldt **ALLES
GOED** op: de vijf nieuwe waarden aanvaard; `herkansing`, `niet_bekrachtigd`,
`gezakt`, `""` en `BEKRACHTIGD` geweigerd op de genoemde CHECK; de vier andere
CHECKs nog werkzaam; de unieke index en de uitgaande sleutel intact; twaalf
kolommen in dezelfde orde; een bestaande rij ongewijzigd na de herbouw; geen
werktabel achtergebleven; en een oude waarde die de migratie doet vallen.

De geaccrediteerde in die proef wordt met `coach_register_id` geïdentificeerd en
niet met een verzonnen e-mailadres. `tests/bekwaamheid-geen-namenlijst.test.ts`
verbiedt adressen in `server/bekwaamheid/`; hetzelfde beginsel geldt in een script.

---

## 9. De mutatieproef op laag 2

`scripts/mutatieproef-blok3b.py`: negen mutaties, elk apart gedraaid,
byte-identiek teruggedraaid met `cmp`-controle. **Acht op acht betrapt, de blinde
bleef groen.**

| Mutatie | Uitkomst |
|---|---|
| twee assen onder de drempel wordt drie | betrapt |
| de aandachtszone wordt exclusief | betrapt |
| de totaaldrempel wordt exclusief (0,70 exact zakt) | betrapt |
| de asdrempel wordt exclusief (0,60 exact zakt) | betrapt |
| *blinde: alleen commentaar toegevoegd* | *groen, zoals het moet* |
| de leemte gaat voor op een as onder de drempel | betrapt |
| een onvolledig dossier levert toch een voorstel | betrapt |
| `herkansing` blijft toegestaan in de CHECK | betrapt |
| de unieke index verliest haar UNIQUE | betrapt |

De proef bevat een **blinde**: een mutatie die alleen commentaar toevoegt en dus
groen móét blijven. Zonder zo'n blinde meet de proef niet of ze werkelijk kan
onderscheiden.

Twee mutaties vonden een echt gebrek, en dat is de opbrengst:

1. Het anker op de CHECK kwam **tweemaal** voor — de kolom `voorstel_uitkomst` en
   de kolom `definitieve_uitkomst`. Een mutatieproef die twee plaatsen tegelijk
   raakt, meet niet wat ze denkt te meten. Het anker is verscherpt.
2. **Een echt lek.** De lopertest toetste of de index met die naam bestáát. Een
   index die zijn UNIQUE verliest, houdt zijn naam. De test toetst nu via
   `PRAGMA index_list` op de vlag `unique = 1`, en betrapt de mutatie.

---

## 9bis. Laag 3 — de drie schrijfwegen en scherm 9.5

### 9bis.1 Wat er in de routes bewust niet staat

`server/bekwaamheid/routes-normprofiel.ts` voegt aan de drie schrijfwegen geen
enkele regel toe. Dat is opzet. De onwijzigbaarheid van een bevroren cesuur staat
in `storage.ts`, in de datalaag, en een route die daar zelf opnieuw op toetst
maakt een tweede waarheid. Twee waarheden over dezelfde vraag gaan uiteindelijk
verschillen, en dan is het toeval welke van de twee de gebruiker te zien krijgt.

| Route | Datalaag | Wat de route zelf doet |
|---|---|---|
| `POST /api/bekwaamheid/normprofiel` | `zetNeer` | het lichaam uitlezen, valideren voor de veldmeldingen, doorgeven |
| `PATCH /api/bekwaamheid/normprofiel/:id` | `wijzig` | alleen meegestuurde velden doorgeven |
| `POST /api/bekwaamheid/normprofiel/:id/bevries` | `bevries` | de bevestiging eisen, doorgeven |

De validatie is de ene uitzondering, en met reden. `zetNeer` gooit bij een
afgekeurd profiel één `Error` met alle bevindingen aan elkaar geplakt tot één
tekst. Een formulier met acht velden kan daar niets mee. De route roept daarom
`valideerNormprofiel` eerst zelf aan en geeft de bevindingen als lijst terug, met
per bevinding het veld erbij. Dat is geen tweede toets maar dezelfde zuivere
functie, en de opslag toetst er daarna nog een keer bovenop: zou de route de
validatie overslaan, dan weigert de laag eronder alsnog.

### 9bis.2 Waarom een bevroren profiel een 409 geeft en geen 400

400 zegt: uw verzoek is fout opgeschreven. Dat is het niet — het verzoek is
onberispelijk, maar de toestand van de bron laat het niet toe. Daar is 409
Conflict voor. Het scherm gebruikt het onderscheid: bij 422 zet het de bevindingen
bij de velden, bij 409 verdwijnt het formulier en komt de read-only weergave
ervoor, want dan is er intussen bevroren. Bij 404 gaat het over een profiel dat
niet bestaat. De mutatieproef breekt precies dit onderscheid en de suite betrapt
het (sectie 9bis.5).

### 9bis.3 Er is geen ontdooiweg, en dat is getoetst

Vier tests toetsen de afwezigheid van de weg zelf, niet alleen het gedrag van de
wegen die er zijn:

- `/ontdooi`, `/heropen` en `/ontbevries` bestaan niet en geven 404;
- `bevrorenOp: null` meesturen naar de wijzigweg zet `bevroren_op` niet terug;
- de broncode van het routebestand bevat de woorden niet — met het commentaar
  eerst weggestript, want dat legt juist uit dat de weg er niet is.

Die laatste test is bewust een bronteksttest. Een gedragsgetuige kan alleen
bewijzen dat een bestaande weg dicht is; ze kan niet bewijzen dat er geen weg is
die niemand nog heeft aangeroepen.

### 9bis.4 Scherm 9.5 — drie dingen die het niet doet

Het scherm rekent niet. Er staat geen enkele formule in: of een weging op één
sluit, of een onderbouwing lang genoeg is, of een drempel binnen bereik valt —
dat beslist de server, en het scherm toont wat er terugkomt. Een formulier dat
zelf meerekent, is een tweede cesuur die stilletjes van de eerste gaat afwijken.

Het maakt de read-only stand niet zelf op. Of iets bevroren is, volgt uit
`bevrorenOp` in het antwoord, niet uit een eigen vlag ernaast.

Het biedt geen weg terug — ook geen verborgene, want er is geen endpoint dat het
zou kunnen.

Eén kleine keuze verdient vermelding: wie op "nieuwe versie" klikt, krijgt de
waarden van de geldende norm mee, maar met de onderbouwing **leeg**. Wie de lat
verlegt, verantwoordt dat opnieuw en hergebruikt niet de motivering van de vorige
cesuur.

### 9bis.5 De mutatieproef op laag 3

Negen mutaties, waarvan één blinde. **8 op 8 betrapt, de blinde bleef groen.**

| Mutatie | Betrapt |
|---|---|
| bewaking valt weg op het neerleggen | ja |
| bewaking valt weg op het bevriezen | ja |
| een bevroren rij levert 400 in plaats van 409 | ja |
| de afkeuring wordt stil doorgelaten | ja |
| de bevestiging bij bevriezen wordt niet meer geeist | ja |
| het onbestaande profiel levert geen 404 | ja |
| de beheerder wordt niet meer vastgelegd bij het bevriezen | ja |
| een id met achtervoegsel wordt alsnog aanvaard | ja |
| BLINDE: dezelfde zoekopdracht, andere schrijfwijze | bleef groen, zoals het moet |

De proef legde twee eigen fouten bloot, en dat is precies waarvoor ze bestaat.

De eerste zat in de proef zelf. De mutatie op `idUitPad` verving
`/^[0-9]+$/` door `/^[0-9]/`, maar veranderde het gedrag niet: `Number("1abc")`
is `NaN` en de tweede toets `Number.isSafeInteger` vangt dat al op. Een mutatie
die niets verandert, kan niets betrappen. Herschreven tot een mutatie die de
`Number`-omzetting vervangt door `parseInt`, want dan wordt `"1abc"` wél `1` en
kan een verdwaald adres een echt profiel raken. Die versie wordt betrapt.

De tweede zat in het anker van de blinde: de melding `"Geen geldig
normprofiel-id."` staat tweemaal in het bestand, in de wijzigweg en in de
bevriesweg. Een anker dat tweemaal voorkomt maakt een mutatieproef onbetrouwbaar
zonder dat ze rood wordt. De proef weigert nu zulke ankers en meldt ze; de blinde
is verlegd naar `includes` versus `indexOf(...) !== -1`, semantisch identiek en
uniek in het bestand.

---

## 10. De metingen

| Meting | Blok 2 | Laag 1 | Laag 2 | Laag 3 |
|---|---|---|---|---|
| Testbestanden | 171 | 172 | 173 | **174** (+1: `bekwaamheid-normprofiel-routes.test.ts`) |
| Tests | 1825 | 1889 | 1948 | **1989** (+41, alle 41 nieuw) |
| Typefouten | 72 | 72 | 72 | **72**, identiek op bestand, regel, kolom en foutcode |
| Gewijzigde bestaande bestanden | 9 | 9 | 9 | **11**, de negen plus de twee toegestane |
| Verwijderde regels | 44 | 44 | 44 | **44**, geen enkele regel verwijderd |
| Tabellen | 66 | 66 | 66 | **66** |
| Migraties toegepast | 7 | 7 | 8 | **8**, ongewijzigd |
| Clientbouw | — | — | — | **slaagt** (`vite build`, 12,5 s) |
| Mutatieproef | — | 6/6 | 8/8 | **8/8, blinde groen** |

De elf gewijzigde bestanden zijn de negen van blok 2 en laag 1-2, plus de twee die
Marc voor laag 3 heeft toegestaan: `server/routes.ts` en `client/src/App.tsx`. In
beide gaat het om een import en een aanmelding, samen elf regels; er is geen
bestaande regel gewijzigd of verwijderd. Al het andere werk zit in nieuwe
bestanden, en die kosten niets aan de afgesproken grens.

Dat het aantal verwijderde regels op 44 blijft staan, is de meting die het meest
zegt: het hele blok 3 heeft geen bestaande regel weggehaald.

Twee rijverschillen in de echte databank, beide verklaard:

- `migratie_register` 7 → 8. Migratie 0007 is bij de testrun toegepast. Dat is de
  bedoelde uitwerking. De CHECK in `data.db` is nagemeten: `herkansing` staat er
  niet meer in, `opgeschort` en `beeindigd` wel, de unieke index staat er, geen
  werktabel achtergebleven, en de tabel is nog altijd leeg.
- `gdpr_audit_log` +1 per volle testrun. Bekende bevinding uit blok 1: `npm test`
  schrijft naar de echte `data.db` via `ruimVerstrekenIntakesOp()`
  (`server/prive-aankoop/bewaartermijn.ts:60`, aangeroepen uit
  `tests/gdpr-verbeteringen.test.ts:113`). Actie `prive_intake_anonimisering`,
  nagelezen op de laatste drie rijen.

**Nul** auditrijen met actie `bekwaamheid%`, en **nul** rijen in
`bekwaamheid_beslissingen`. De nieuwe code heeft niets inhoudelijks in de
productiedatabank geschreven.

Bij laag 3 was er nog **één** rijverschil over de hele databank: `gdpr_audit_log`
18 → 19, weer die ene `prive_intake_anonimisering` per volle testrun. Alle veertien
`bekwaamheid%`-tabellen staan op nul, `migratie_register` bleef op 8, en er zijn
nul auditrijen met actie `bekwaamheid%`. De routetest draait op `:memory:` en heeft
de echte databank niet aangeraakt — de vier bevries- en wijzigtests op een bevroren
profiel evenmin.

De ene gewijzigde rij is de bekende bevinding uit blok 1: `npm test` schrijft naar
de echte `data.db` via `ruimVerstrekenIntakesOp()`
(`server/prive-aankoop/bewaartermijn.ts:60`, aangeroepen uit
`tests/gdpr-verbeteringen.test.ts:113`). De rij heeft actie
`prive_intake_anonimisering`. Bij sluiting van blok 2 waren het drie rijen omdat
de suite drie keer liep; nu is het één omdat ze één keer liep.

**Nul** auditrijen met actie `bekwaamheid%` in de echte databank, en **nul** rijen
in `bekwaamheid_normprofielen`. De nieuwe code heeft niets in de productiedatabank
geschreven; alle opslagtests lopen op `:memory:`.

Voor de typecontrole geldt de normalisatie uit blok 2: de ruwe uitvoer moet eerst
door `grep "error TS"` en daarna door
`grep -oE "^[^ ]+\([0-9]+,[0-9]+\): error TS[0-9]+" | sort`. Zonder die tweede
stap verschijnen drie schijnbare verschillen in `server/routes-deelnemer.ts` die
alleen bestaan uit de volgorde waarin TypeScript de velden van een afgeleid type
opsomt. Bij deze meting is die val opnieuw opgetreden en met de normalisatie
weggewerkt.

---

## 11. Meetgereedschap

`scripts/rijtelling.py` bestaat omdat de vergelijking van rijaantallen tussen
blokken tweemaal is misgelopen op een verschil in uitvoervorm — één keer
`tabel aantal`, één keer `tabel|aantal`. Eén script betekent één vorm.

`scripts/mutatieproef-blok3.py` draait de zes mutaties, controleert dat elk anker
precies één keer voorkomt, draait de suite en draait de mutatie terug met een
`cmp`-controle. Een mutatie die groen blijft, wordt als LEK gemeld.

`scripts/proef-migratie-0007.py` draait migratie 0007 op wegwerpdatabanken en toetst
de eindtoestand in plaats van de tekst van de migratie. Ze eist bij elke weigering
de **naam van de beperking** in de foutmelding, omdat een weigering op een vreemde
sleutel er anders uitziet als een geslaagde toets.

`scripts/mutatieproef-blok3b.py` draait negen mutaties op de beslismachine en de
migratie, met één blinde als controle op de proef zelf.

`scripts/mutatieproef-blok3c.py` draait negen mutaties op de drie schrijfwegen, met
één blinde. Ze weigert nu ook een anker dat meer dan één keer in het bestand
voorkomt en meldt dat als probleem, in plaats van er stil aan voorbij te gaan: dat
was de tweede fout die deze proef in zichzelf blootlegde.

`scripts/zet-beslisuitkomsten.py`, `scripts/werk-protocol-blok3-bij.py` en
`scripts/werk-protocol-blok3c-bij.py` schrijven
`schema.ts` en dit document op ankers om. Ze bestaan omdat het `edit`-gereedschap
valt op samengestelde accenttekens, die in Nederlands commentaar overal staan.

---

## 12. Wat blok 3 niet afsluit

Scherm 9.5 staat er, met de drie schrijfwegen eronder. De norm is daarmee te
maken, bij te stellen en te bevriezen door een beheerder, en de historiek is na te
lezen. Wat blok 3 niet afsluit, is de kant van de beslissing.

De beslismachine rekent, maar er is nog niets dat haar aanroept. Dat is bewust:
`beoordeel()` heeft asscores en een activiteitstelling nodig, en die komen uit het
meten — de itembank, de kennischeck en bewijsstuk 5. Een route die de machine nu al
zou aanroepen, zou moeten rekenen op gegevens die nog niet bestaan.

Wat er dus nog niet is:

- geen route die `beoordeel()` aanroept en geen scherm dat het voorstel toont;
- geen opslag van beslissingen — de tabel bestaat, met de juiste CHECKs, en is leeg;
- geen tweede bekrachtiger in de werkstroom (de CHECK dwingt af dát het er twee
  moeten zijn, maar niets leidt ze door het proces);
- geen debrief en geen publicatie, al staat de ordening ervan al in de CHECK
  `publicatie_na_debrief`;
- geen van de vijf andere schermen uit sectie 9 van het bouwplan: 9.1 en 9.2 aan de
  coachzijde, 9.3 beoordelen, 9.4 de raad, 9.6 het overzicht.

Blok 4 — het meten — komt eerst. Dan pas blok 5.

Twee dingen die bij het afsluiten van dit blok open blijven staan en niet vergeten
mogen worden. De drie sessie-endpoints uit blok 2 hangen nog niet aan de poort
(`POST /api/sessies`, `POST /api/t4o/sessies`, `POST /api/teamscan/sessies`); dat is
een bewuste uitstel met een eigen inventarisatie. En voor T4Students, T4Teens en
T4Kids bestaat nog geen platformdeel-mapping, waardoor de poort er voor die drie
niets te toetsen heeft.
