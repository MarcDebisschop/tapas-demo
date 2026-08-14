# Werkprotocol Blok 2 — De poort

Blok 2 opent volgens sectie 10 van het bouwplan met één taak: **inventarisatie van
élk endpoint dat een afname of uitnodiging aanmaakt — uit de code, niet uit het
hoofd.** Dit document is die inventarisatie. Er is in deze ronde geen regel
productiecode gewijzigd.

**Afbakening.** Op verzoek beperkt tot vier instrumentfamilies: T4P Business,
T4Students, T4Teens en T4Kids. De overige families (T4Recruitment, Teamscan, T4O,
HDD, T4Sports, 2MINSCAN, Impact Roos, DriverScan, STM) komen in deze inventarisatie
alleen voor waar ze een schrijfweg met de vier delen.

## Nulmeting blok 2

| Meting | Waarde |
|---|---|
| HEAD | `b808577`, versie 2.7.0 |
| `npm test` | 167 bestanden, 1729 tests, groen |
| `npm run check` | 72 fouten, 14 bestanden |
| Gewijzigde bestaande bestanden | 7 (grens uit blok 1) |
| Rijen in `afnames` | 10 |
| Rijaantal per tabel | vastgelegd in `/tmp/blok2-rijbaseline.txt`, 67 tabellen |

De databankwacht is een rijaantal per tabel en géén controlesom over `data.db` —
zie de vierde vondst van blok 1: elke suite-run schrijft een regel in
`gdpr_audit_log`.

## Wat de vier families gemeen hebben

Alle vier staan in het register als `flowType: "individual"`:

| Familie | `instrumentId` | Registerregel |
|---|---|---|
| T4P Business Kompas | `t4p-business-kompas` | `server/data/instrument.json:2`, ingeschreven via `registry.ts:160` als `isDefault: true` |
| T4Teens | `t4teens` | `registry.ts:437` |
| T4Students | `t4students` | `registry.ts:491` |
| T4Kids | `t4kids` | `registry.ts:515` |

Dat is de bepalende vondst van deze inventarisatie: **de vier families hebben geen
eigen afnametabel en geen eigen aanmaakroute.** Ze delen één tabel `afnames` en
worden alleen door de kolom `instrument_id` van elkaar onderscheiden. Waar de
collaboratieve families (T4Recruitment, Teamscan, T4O) elk hun eigen
`maakSessie` en hun eigen route hebben, loopt alles van de vier over dezelfde drie
schrijfwegen. De poort heeft voor deze vier dus drie aangrijpingspunten, niet
twaalf.

## Een uitnodiging is geen aparte tabel

`afnames` draagt zelf `invite_token`, `bezits_token` en `uitgenodigd_at`. Een
uitnodiging is een rij in `afnames` met status `uitgenodigd` en een token. Er is
geen tabel `uitnodigingen`. Nagegaan door de schrijvers van `afnames.inviteToken`
te tellen: er zijn er precies drie, en één ervan
(`storage.ts:3375`) schrijft naar `sessie_deelnemers` en niet naar `afnames`. Voor
de vier families betekent dit dat "afname aanmaken" en "uitnodiging aanmaken"
hetzelfde schrijfpad zijn met een andere beginstatus.

## De drie schrijfwegen

| # | Route | Opslagfunctie | Bewaking | Beginstatus | Testdekking |
|---|---|---|---|---|---|
| 1 | `POST /api/afnames` (`server/routes/afnames.ts:119`) | `storage.createAfname` (`storage.ts:1917`) | **geen** — bewust publiek | `deel1` | 11 testbestanden raken dit pad |
| 2 | `POST /api/uitnodigingen` (`server/routes/afnames.ts:257`) | `storage.maakUitnodiging` (`storage.ts:1994`) | `vereisScope` | `uitgenodigd` | 4 testbestanden |
| 3 | `POST /api/admin/bulk-import/verwerk` (`server/bulk-import/routes.ts:389`) | `maakBulkUitnodiging` (`bulk-import/routes.ts:109`) | `vereisScope` | `uitgenodigd` | **0** |

Weg 1 heeft geen bewaking, en dat is gedocumenteerd bedoeld: de commentaarregel op
`routes/afnames.ts:125` zegt dat de deelnemersroutes geen sessie hebben. Een
deelnemer die zelf begint, is geen ingelogde gebruiker. Weg 3 valideert het
instrument tegen `getTemplate(instrumentId)` en ondersteunt volgens de
templatelijst `t4p-business-kompas`, `t4students`, `t4teens`, `t4kids`, `t4o`,
`hdd` en `impact-roos` — dus alle vier families uit deze afbakening.

## Vijf wegen die het níet zijn, en waarom dat nagegaan is

De vijf ruwe `INSERT INTO afnames`-opdrachten in `server/storage.ts` (r870, r972,
r1060, r1149, r1236) staan alle vijf in demoseeders: `seedShowcase` (r808),
`seedLuca` (r931), `seedTeens` (r1018), `seedLana` (r1107) en het
organisatieblok rond r1236. Geen ervan zit achter een route. Ze zijn hier
opgenomen omdat ze wél echte rijen in `afnames` schrijven en dus in een
rijaantalmeting opduiken. De poort hoeft ze niet te bewaken; een test die
rijaantallen vergelijkt moet ze wel kennen.

Verder nagegaan en leeg bevonden: `server/routes/vragenlijst-t4kids.ts`,
`server/routes/vragenlijst-t4teens.ts`, `server/prive-aankoop/routes.ts`,
`server/traject/routes.ts` en `server/toegang/routes.ts` bevatten geen enkele
aanroep van `createAfname`, `maakUitnodiging` of een eigen insert naar `afnames`.
De vragenlijstroutes vullen bestaande rijen; ze maken er geen.

## Het instrument-id: twee lagen die het niet eens zijn

Beide opslagfuncties schrijven `instrumentId: data.instrumentId ?? null`
(`storage.ts:1932+11` en `storage.ts:2019`). Beide routes geven echter
`data.instrumentId ?? standaardInstrumentId()` door
(`routes/afnames.ts:192` en `:288`). De `?? null` in de opslaglaag wordt vanuit
deze twee routes dus nooit bereikt.

Dat is geen verschil zonder gevolg. Het betekent dat de opslaglaag een rij zonder
instrument aanvaardt en dat alleen de routes dat verhinderen. Een vierde
schrijfweg die de opslagfunctie rechtstreeks aanroept — zoals een script of een
nieuwe route — schrijft `NULL` zonder dat iets protesteert. `maakBulkUitnodiging`
heeft dezelfde `?? null` op r141, en daar geeft de route op r523 het gevalideerde
id door.

**Feitelijke toestand van de databank:** alle 10 rijen in `afnames` hebben
`instrument_id` op `NULL`. Nagegaan met een groepering op de kolom. Oorzaak:
de demoseeders sommen hun kolommen expliciet op en `instrument_id` staat niet in
die lijst. `NULL` is dus een bestaande waarde in productie, en de poort moet
beslissen wat ze daarmee doet. Twee wegen, beide te verdedigen: `NULL` opvatten
als het standaardinstrument, of `NULL` weigeren. De eerste is stiller, de tweede
eerlijker. Dit is een beslissing voor de bouw, niet voor de inventarisatie.

## De afnemer is niet altijd te herkennen — dit is het kernprobleem

De poort moet vaststellen wie afneemt. De keten daarvoor is:

```
afnames.aangemaakt_door_beheerder_id
  → beheerders.id
  → bekwaamheid_geaccrediteerden.beheerder_id
  → bekwaamheid_licenties.geaccrediteerde_id + instrument_id
  → magAfnemen()
```

Die keten breekt op drie plaatsen, alle drie nagegaan in de code:

1. **Weg 1 levert geen afnemer.** `verzenderVanVerzoek`
   (`server/scope-guard.ts:81`) leest de beheerder uit de sessie. Op het
   deelnemerspad is er geen sessie, dus beide velden blijven `null`. De
   commentaarregel op `routes/afnames.ts:183` zegt dat ook zo. Een deelnemer die
   zelf start heeft geen afnemer — en dus geen licentie om tegen te toetsen.

2. **Een organisatiesessie levert geen persoon.** `bepaalScope`
   (`scope-guard.ts:100`) geeft `soort: "organisatie"` terug wanneer er een
   organisatiesessie is zonder beheerder-sessie (r118). `vereisScope` laat die
   door. `verzenderVanVerzoek` zet dan `aangemaaktDoorBeheerderId` op `null` en
   alleen `aangemaaktDoorOrganisatieId` op een waarde. Wegen 2 en 3 kunnen dus
   worden gebruikt zonder dat er één persoon aanwijsbaar is. Een organisatie is
   geen geaccrediteerde en kan geen licentie hebben.

3. **Geaccrediteerden zonder beheerdersaccount zijn onbereikbaar via deze keten.**
   `bekwaamheid_geaccrediteerden.beheerder_id` is nullable. De vulmigratie maakt
   rijen aan met alleen een `coach_register_id` voor wie geen account heeft. Die
   mensen kunnen ook geen verzoek doen, dus de poort raakt hen nooit — maar het
   omgekeerde geldt ook: hun licentiestatus heeft geen enkel effect op wat er in
   het platform gebeurt. In de huidige databank staan **2 beheerders**
   (`marc@tapascity.com`, `roald@tapascity.com`). De praktische reikwijdte van de
   poort is vandaag dus twee personen.

**Feitelijke toestand:** alle 10 rijen in `afnames` hebben zowel
`aangemaakt_door_beheerder_id` als `aangemaakt_door_organisatie_id` op `NULL`.

## Wat dit betekent voor het ontwerp van de poort

Drie vragen die vóór de eerste regel poortcode een antwoord nodig hebben. Geen van
de drie is met code op te lossen zonder een beslissing.

1. **Wat doet de poort op weg 1?** Een deelnemer die zelf een T4Students-afname
   start heeft geen afnemer. Drie mogelijkheden: de poort raakt weg 1 niet (dan is
   er een gat zo groot als het hele zelfstartpad), de poort eist dat een afname
   altijd aan een uitnodiging hangt (dan verandert het productgedrag), of het
   zelfstartpad wordt als niet-professioneel gebruik erkend en apart geregeld.
   Naar mijn oordeel is de derde de enige die zowel eerlijk als uitvoerbaar is,
   maar het is een productbeslissing.

2. **Wat doet de poort bij een organisatiesessie?** Zolang een organisatie
   uitnodigingen kan aanmaken zonder persoon, is de poort op dat pad een lege
   controle. Ofwel de organisatiesessie krijgt een verplichte persoonskeuze, ofwel
   de poort accepteert organisatiescope als "niet toetsbaar".

3. **Wat doet de poort met `instrument_id IS NULL`?** Er staan tien zulke rijen in
   productie.

## De drie beslissingen

De drie vragen hierboven zijn beslist. Vraag 1 door Marc, vraag 2 en 3 op grond van
de feiten in dit document. Elke beslissing staat in de code als een grond met een
naam, niet als een stilzwijgende gewoonte.

### 1. Het zelfstartpad valt buiten het licentiekader

Een deelnemer die zelf een afname start, doet dat niet beroepsmatig. Daar hoort geen
licentie bij en de poort weigert er dus nooit. Grond `zelfstart_buiten_licentiekader`,
de enige grond met `zouWeigeren: false` die ook in stand `handhaaf` nooit omslaat.
Wél gelogd, want het volume moet zichtbaar blijven: als over een jaar blijkt dat een
derde van alle afnames via dit pad loopt, is dat een productfeit dat je wil weten
voordat je erover beslist.

### 2. Een organisatiesessie zonder persoon zou weigeren

Grond `afnemer_niet_herleidbaar`, `zouWeigeren: true`.

Een licentie is er altijd één van een mens met een naam. Een licentiestelsel met een
open pad waarlangs een afname kan ontstaan zonder herleidbare persoon is geen stelsel
maar een formaliteit. `bepaalScope` laat dat pad vandaag open: een organisatiesessie
komt door `vereisScope` met `aangemaaktDoorBeheerderId: null`.

Dat pad nu dichtzetten zou het product breken voordat er één cijfer is. Daarom
weigert de poort hier niet — hij markeert. In stand `log` levert dat een teller op
zonder dat iemand hindert. De beslissing om werkelijk te handhaven hoort pas te
vallen wanneer die teller bekend is; dat is precies wat §10.1 van het bouwplan
voorschrijft.

### 3. Een leeg instrument wordt nooit stil aangevuld

Grond `instrument_onbekend`, `zouWeigeren: true`.

De verleiding is om `null` te lezen als "dan het standaardinstrument". Dat is de
verkeerde reflex: het verbergt een gegevensfout en maakt elke latere meting per
instrument onbetrouwbaar. Meten is waar deze hele module voor gebouwd wordt.

De tien `NULL`-rijen in de databank komen van de demo-seeders — die noemen hun
kolommen op en laten `instrument_id` weg. Ze worden nooit opnieuw beoordeeld. De
poort werkt op de schrijfweg, en **alle drie de schrijfwegen zetten een echt
instrument-id**. Een leeg instrument kan daar dus alleen opduiken via een vierde,
nieuwe weg die rechtstreeks de opslaglaag aanspreekt — en juist dan wil je het
hard horen in plaats van het weggewerkt zien.

**Correctie op een eerdere bevinding in dit dossier.** Er is eerder gemeld dat
`maakUitnodiging` `NULL` schrijft. Dat is onjuist. `POST /api/uitnodigingen`
(`routes/afnames.ts:288`) geeft `data.instrumentId ?? standaardInstrumentId()` door;
de bulkweg geeft het gevalideerde id door (`bulk-import/routes.ts:523`). De `?? null`
in de opslaglaag (`storage.ts:2019`) wordt vanaf deze routes nooit bereikt.

## De naam van de omgevingsvariabele — de code heeft voorrang

Bouwplan §7.4 noemt `TAPAS_POORT_BEKWAAMHEID` met `uit|log|aan` en terugval `uit`.
De code doet `BEKWAAMHEID_POORT` met `uit|log|handhaaf` en terugval `log`. De code
is gebouwd, getest en werkt; het bouwplan is een plan. **Het bouwplan wordt
gecorrigeerd, niet de code.** `handhaaf` is bovendien het betere woord dan `aan`,
omdat het zegt wat er gebeurt in plaats van dat er iets aanstaat.

## Wat er gebouwd is

| Bestand | Regels | Inhoud |
| --- | --- | --- |
| `server/bekwaamheid/poort.ts` | 232 | `beoordeelPoort()` — zuivere functie, geen databank, geen `Date.now()`, geen neveneffect |
| `server/bekwaamheid/poort-teksten.ts` | 254 | 8 weigerende en 4 niet-weigerende gronden, elk met tekst in vijf talen en een weg vooruit |
| `server/bekwaamheid/poort-platformdelen.ts` | 107 | de afbeelding van alle 16 registerinstrumenten op de 9 platformdelen |
| `tests/bekwaamheid-poort-matrix.test.ts` | 381 | 40 tests; 315 combinaties van status × afnemer × handeling × stand, plus dekkingscontroles |
| `tests/bekwaamheid-poort-nooit.test.ts` | 308 | 18 tests; de vier beloften van §7.3, elk in de zwaarste omstandigheid |

De poort is zuiver met opzet. Alles wat hij nodig heeft komt binnen als invoer:
licentie, registerstand, toegangsvlag, of er een bezwaar loopt, de peildatum, de
stand. Daardoor is elke combinatie te toetsen zonder databank en is de laag die
straks aan de routes hangt niet dezelfde laag die beslist.

## Twee bevindingen bij §7.1

**§7.1 stelt twee voorwaarden, niet één.** De toegangsvlag van het platformdeel
*en* de licentiestatus. `magAfnemen` doet alleen de tweede. De poort doet beide.

**De toegangsvlaggen waren decoratief.** `listAlleToegangen` en `zetToegang` worden
uitsluitend aangeroepen vanuit `server/toegang/routes.ts` — regel 124 leest de lijst
voor het beheerscherm, regel 189 zet een waarde. Geen enkel endpoint leest
`toegangen` om iets te weigeren. Het scherm `/admin/toegang` zette dus vinkjes die
niets deden. Dat is bevinding 3 waarvan §7.1 zegt dat de poort haar repareert, en
de poort doet dat nu: `platformdeelToegestaan === false` levert grond
`platformdeel_geblokkeerd`.

**Maar de reparatie reikt niet tot drie van de vier families.** Er zijn 9
platformdelen en 16 registerinstrumenten; slechts 6 instrumenten hangen aan een
platformdeel. Van de vier families in scope heeft **alleen T4P Business** er één
(`kompas`). **T4Students, T4Teens en T4Kids hebben geen platformdeel.** Voorwaarde 1
is voor drie van de vier dus niet toetsbaar — niet omdat de poort iets mist, maar
omdat de afbeelding leeg is. De poort geeft dat terug als `platformdeelLeemte: true`
in plaats van het te verzwijgen of als weigering te vermommen. Het aanvullen van de
afbeelding is een productbeslissing voor blok 3, niet iets om er stil bij te
verzinnen.

Bijkomend: het platformdeel `bekwaamheid` is aan **niemand** toegekend. Beide
beheerders hebben elk 8 toegangsrijen — 16 in totaal — en `bekwaamheid` zit bij
geen van beide. Het
beheerscherm van deze module is vandaag voor niemand open.

## Het adres hoort niet in de broncode

De volledige suite betrapte de eerste versie van `poort-teksten.ts`:
`tests/bekwaamheid-geen-namenlijst.test.ts` eist dat de hele map
`server/bekwaamheid/` vrij is van e-mailadressen, en er stond er één hard in.

Die wacht heeft gelijk en is niet verruimd. De teksten dragen nu de plaatshouder
`{contact}`, die `poorttekst()` vult uit `BEKWAAMHEID_CONTACT`. Is die niet gezet,
dan komt er geen half adres in de tekst maar een omschrijving: "de beheerder van je
organisatie". Zo blijft de belofte van §7.2 — nooit doodlopend — ook overeind
wanneer de omgevingsvariabele vergeten is.

Dit is de derde keer in dit dossier dat een bestaande wacht een nieuw bestand
tegenhield. Dat is de bedoeling van die wachten.

## De mutatieproef op de zuivere poort

Een groene test bewijst niets als hij ook groen blijft wanneer de code stuk is. Drie
mutaties, elk daarna byte-identiek teruggedraaid (`cmp` bevestigd):

| Mutatie | Gevolg |
| --- | --- |
| De bezwaartoets van vóór de licentietoets naar erachter verplaatst | 8 tests falen |
| `rapport_bekijken` binnen de poort gehaald | 5 tests falen |
| `zelfstart_buiten_licentiekader` naar de weigerende gronden verplaatst | 3 tests falen |

Alle drie de beloften bijten dus werkelijk. De eerste mutatie is de belangrijkste:
belofte 3 van §7.3 — nooit weigeren tijdens een lopend bezwaar — hangt volledig aan
de plaats van één `if`, en die plaats heeft nu een test.

## Slotmeting blok 2

| Meting | Nulmeting | Nu | Oordeel |
| --- | --- | --- | --- |
| `npm test` | 167 bestanden / 1729 tests groen | **171 bestanden / 1825 tests groen** | +4 bestanden, +96 tests, 0 falend |
| `npm run check` | 72 fouten | **72 fouten** | identiek op bestand, regel, kolom en foutcode |
| Gewijzigde bestaande bestanden | 7 | **9** | de verruimde grens exact opgebruikt |
| Verwijderde regels | 41 | **44** | drie regels, elk verantwoord (zie hieronder) |
| Tabellen met een ander rijaantal | — | **1** (`gdpr_audit_log` 9 → 15) | verklaard, zie hieronder |

**Over de typecontrole.** Het aantal is 72 en blijft 72, maar een letterlijke
regelvergelijking geeft drie afwijkingen. Die zijn nagegaan en het zijn dezelfde
drie fouten op dezelfde plaatsen: `server/routes-deelnemer.ts` op (150,28),
(150,63) en (152,37), met dezelfde foutcodes TS2339, TS2339 en TS2551 en dezelfde
ontbrekende eigenschappen. Wat verschilt is uitsluitend de volgorde waarin
TypeScript de velden van het afgeleide afnametype opsomt in de foutmelding. Na
normalisatie op bestand, regel, kolom en foutcode is de vergelijking letterlijk
leeg. Vandaar de kolomtekst: niet "diff leeg", maar "identiek op plaats en code".

**Over de drie verwijderde regels.** Alle drie in `server/routes/afnames.ts`, en
alle drie een gevolg van dezelfde ingreep: `...(await verzenderVanVerzoek(req))`
stond tweemaal inline in een objectliteraal, en de poort heeft diezelfde verzender
nodig vóór het object bestaat. De aanroep is één regel naar boven getild en
eenmaal in een variabele gezet; de twee inline-aanroepen verdwijnen daarmee. De
derde regel is een commentaarregel die is uitgebreid en dus geherschreven. Er is
geen gedragsregel weggehaald.

**Over de zes auditrijen.** Niet van de poort. Zes rijen
`prive_intake_anonimisering`, drie per volledige suite-run en er zijn twee runs
gedraaid sinds de baseline. Identiek aan rij 9 uit blok 1. Dat is de bekende
bevinding: `npm test` schrijft naar de echte `data.db` via
`ruimVerstrekenIntakesOp()` (`server/prive-aankoop/bewaartermijn.ts:60`,
aangeroepen uit `tests/gdpr-verbeteringen.test.ts:113`). Het aantal poortregels in
de echte databank is **nul** — nageteld met een aparte telling op
`actie LIKE 'bekwaamheid%'`. De overige 65 tabellen zijn tot op de rij onveranderd.

## De grens is verruimd naar 9 en exact opgebruikt

Marc heeft de grens van blok 1 verruimd van 7 naar 9 bestanden, met de opdracht de
poort op de drie schrijfwegen aan te sluiten. Beide bestanden zijn gebruikt en er
is geen derde bij nodig geweest:

| # | Bestand | Wat er is gewijzigd |
| --- | --- | --- |
| 8 | `server/routes/afnames.ts` | één import, twee poortblokken, één verzender omhooggetild |
| 9 | `server/bulk-import/routes.ts` | één import, één poortblok |

De teller staat daarmee op negen van negen. Elke verdere aansluiting — de
collaboratieve families, `/api/t4o/sessies`, de simulatiepagina — vraagt opnieuw
een beslissing.

## Waar de poort hangt, en waarom precies daar

**Weg 1, `POST /api/afnames`.** Ná de leeftijdspoort, vóór de saldo-check. De
volgorde is geen detail: wie geen licentie heeft hoort dat te horen en niet eerst
een creditsfout te zien die de echte reden verbergt. Op deze route levert de poort
vandaag vrijwel altijd `zelfstart_buiten_licentiekader` op — het deelnemerspad
heeft per definitie geen sessie — en die grond weigert nooit, ook niet in
`handhaaf`. De poort hangt er toch, om twee redenen: een beheerder die deze route
gebruikt hóórt getoetst te worden, en het volume van het zelfstartpad moet
meetbaar zijn voordat iemand erover beslist.

**Weg 2, `POST /api/uitnodigingen`.** Zelfde plaats, vóór de saldo-check. Deze
route heeft wél `vereisScope`, dus hier is de keten naar een licentie meestal rond
en doet de poort werkelijk haar werk. Er is een aparte test die vasthoudt dat een
weigering hier 403 geeft en níet 402: als de volgorde ooit omslaat, valt die test
om.

**Weg 3, `POST /api/admin/bulk-import/verwerk`.** Eén oordeel voor de hele import,
niet één per rij. Bij een bulkverzending is de licentievraag één vraag — mag deze
persoon dit instrument afnemen — en die verandert niet halverwege het bestand. Per
rij toetsen zou honderden identieke opzoekingen doen en, erger, honderden
identieke auditregels schrijven voor één handeling.

Die aanroep staat **ná** de T4O-aftakking en niet ervoor. T4O schrijft niet naar
`afnames` maar naar `t4o_sessies`; dat is een eigen schrijfweg die hierboven apart
is vastgelegd en in een latere ronde aan de beurt komt. Hem hier meenemen zou de
poort laten oordelen over een pad dat niet onderzocht is.

## De brug: de enige laag die een databank aanraakt

`server/bekwaamheid/poortbrug.ts` zet een verzoek om in de zes feiten die de
zuivere poort nodig heeft. Alles wat kan mislukken zit hier, en niets ervan zit in
`poort.ts`. Drie eigenschappen zijn met tests vastgezet:

1. **Stand `uit` zoekt niets op.** Getoetst met een databank die bij elke aanraking
   een fout gooit. Blijft de test groen, dan is er werkelijk niets opgevraagd.
2. **Een kapotte brug legt het platform niet plat.** Faalt de opzoeking, dan wordt
   dat luid gelogd en gaat het verzoek dóór — nooit een weigering op grond van een
   storing. Getoetst voor zowel een kapotte databank als een kapotte opslaglaag.
3. **De routes lezen `mag`, nooit `zouWeigeren`.** Dat is de valkuil van het hele
   ontwerp: wie `zouWeigeren` leest, weigert ook in stand `log` en breekt daarmee
   de nulmeting én het product. Een broncodetoets houdt dat op beide bestanden
   vast.

## De mutatieproef op de aansluiting

Vier mutaties, alle vier gedetecteerd, alle vier byte-identiek teruggedraaid en
met `cmp` nageteld.

| Mutatie | Gevolg |
| --- | --- |
| weigering op weg 1 uitgeschakeld | 2 tests falen |
| poort op weg 2 ná de saldo-check gezet | 4 tests falen |
| bulkpoort in de rijlus gezet | 1 test faalt |
| `!mag` vervangen door `zouWeigeren` | 1 test faalt |

**De proef vond ook een echte fout in de nieuwe testsuite zelf.** De toets die
vasthield dat de bulkpoort buiten de rijlus staat, gebruikte
`indexOf("for (const r of geldigeRijen")` — een lus die niet bestaat. `indexOf`
gaf −1, `slice(0, -1)` leverde bijna het hele bestand op, en de toets slaagde
zonder iets vast te houden. Dat is precies waarom een groene test geen bewijs is
en de mutatieproef geen formaliteit. De toets stelt nu eerst hard vast dat beide
ankers gevonden zijn en vergelijkt dan hun onderlinge plaats.

## Wat er níet is gedaan in deze ronde

- Geen wijziging aan de zuivere poort; die stond al en is niet aangeraakt
- Geen enkele verruiming van de grens op eigen initiatief; negen is de gegeven grens
  en negen is gebruikt
- Geen aansluiting op `POST /api/sessies`, `POST /api/t4o/sessies` en
  `POST /api/teamscan/sessies`. Die zijn gevonden, hebben géén enkele bewaking en
  nul testdekking, en horen bij de ronde waarin de collaboratieve families aan de
  beurt zijn. Ze meenemen zou de poort laten oordelen over paden die niet
  onderzocht zijn
- Geen `/beheer/poort/simulatie` en geen tweede kolom in `/admin/toegang`
- Geen aanvulling van de platformdeel-afbeelding voor T4Students, T4Teens en
  T4Kids. Daardoor blijft voorwaarde 1 van §7.1 voor drie van de vier families
  onmeetbaar; de poort geeft dat zichtbaar terug als `platformdeelLeemte` in plaats
  van het te verbergen
- De stand blijft `log`. Naar `handhaaf` mag pas ná de nulmeting én een
  aankondigingstermijn van twaalf maanden (§10.1). Er is in deze ronde niets
  gebouwd dat die orde kan omzeilen

## Blok 2 is hiermee gesloten

De poort bestaat, is getoetst, hangt op de drie schrijfwegen die de vier families
gebruiken, en weigert vandaag niemand omdat de stand `log` is. Wat hij wél doet is
tellen. Vanaf de eerste dag dat dit live staat, groeit er een bestand met
antwoorden op de enige vraag die blok 5 nodig heeft: hoe vaak zou deze poort
geweigerd hebben, en op welke grond. Zonder dat bestand is elke beslissing over
handhaven een gok.
