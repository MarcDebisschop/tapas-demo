# Werkprotocol Blok 1 — Bekwaamheidsmodule

Dit bestand houdt de nulmeting en de bewaakte grenzen bij van de bouw van blok 1.
Het is bewust in de repo geplaatst: wie later dit werk nakijkt, moet kunnen zien
waartegen is gemeten en welke afspraken zijn gemaakt.

## Nulmeting — gemeten vóór de eerste wijziging

| Meting | Waarde |
|---|---|
| Uitgangscommit | `b808577` — "Samenvoegen: het financiele luik is per organisatie afgeschermd" |
| Bestanden onder versiebeheer | 905 |
| `npm test` | **160 testbestanden, 1632 tests, alles groen**, ±58 s |
| `npm run check` (tsc) | **72 bestaande fouten in 14 bestanden**, exit 2 |
| Migraties aanwezig | `0000` t/m `0005` |
| Node | v20.20.1 |
| Vitest | v4.1.10 |

`npx vitest run <bestand>` werkt in deze opzet wel. Een eerdere notitie in dit
dossier beweerde het tegendeel; die notitie was onjuist en is nagegaan door het
commando uit te voeren.

De 72 typefouten bestonden vóór dit werk en staan in bestanden die blok 1 niet
raakt: `admin-inzichten.tsx` (14), `lounge.tsx` (13), `studie.tsx` (8),
`t4teens/scoring.ts` (6), `t4students/scoring.ts` (6), `gids-manager.ts` (6),
`admin-academy.tsx` (6), `routes-deelnemer.ts` (5), `t4sports-modules.tsx` (2),
`admin-coaches.tsx` (2), `scoring.ts` (1), `driverscan/rapport-pdf.ts` (1),
`t4o-deelnemer.tsx` (1), `academy.tsx` (1).

**Afspraak.** Blok 1 herstelt die fouten niet en voegt er geen toe. Na blok 1
moet `npm run check` exact dezelfde 72 fouten in dezelfde 14 bestanden geven, en
`npm test` moet 1632 bestaande tests groen houden plus de nieuwe tests.

### Eindmeting na blok 1 — 13-08-2026

| Meting | Nulmeting | Na blok 1 | Uitkomst |
|---|---|---|---|
| `npm test` | 160 bestanden, 1632 tests | 165 bestanden, 1704 tests, groen | +5 bestanden, +72 tests, alle nieuw |
| `npm run check` | 72 fouten, 14 bestanden | 72 fouten, 14 bestanden | alle 72 locaties en foutcodes letterlijk identiek |
| Verwijderde regels in bestaande bestanden | — | 41 | 27 de namenlijst, 6 de gerepareerde teller, 5 de aanroepen ervan, 1 een bijgewerkte commentaarregel |

Één afwijking om te melden: in drie van de 72 foutmeldingen
(`server/routes-deelnemer.ts` 150 en 152) staan de veldnamen van het weergegeven
deelnemertype in een andere volgorde dan in de nulmeting. Locatie, foutcode en
aantal velden zijn gelijk; alleen de eerste negen velden die `tsc` toont zijn
andere. Dat is een weergavevolgorde, geen nieuwe fout — vastgesteld door de 72
combinaties van bestand, regel, kolom en foutcode letterlijk te vergelijken.

### Sluiting van blok 1 — 13-08-2026, tweede ronde

De eindmeting hierboven is vastgesteld terwijl twee eisen uit de opleverpoort van
blok 1 nog niet gehaald waren (twee van de drie). Dat is bij nalezing van sectie 10 van het bouwplan
vastgesteld en niet weggewerkt. De twee eisen:

1. *"Een nieuwe test die aantoont dat het kwaliteitsdashboard nu échte afnames
   telt, met een testgeval waarin iemand veel oefent en niets afneemt."* Van de
   72 tests uit de eerste ronde raakte er geen enkele
   `berekenKwaliteitsStatus`. De kernreparatie van het blok stond onbewaakt.
2. *"Elke bestaande geaccrediteerde krijgt een licentierij op
   `overgangsperiode`"*, met een test dat geen enkele licentie iets blokkeert.
   `bekwaamheid_licenties` was leeg; die tweede test zou groen zijn geweest op
   een lege verzameling, wat niets bewijst.

| Meting | Na ronde 1 | Na sluiting |
|---|---|---|
| `npm test` | 165 bestanden, 1704 tests | 167 bestanden, 1729 tests, groen (59,8 s) |
| `npm run check` | 72 fouten, 14 bestanden | 72 fouten, 14 bestanden, regel voor regel identiek |
| Gewijzigde bestaande bestanden | 7 | 7 — onveranderd |
| Verwijderde regels in bestaande bestanden | 41 | 41 — onveranderd |

Deze ronde raakte **uitsluitend nieuwe bestanden**. De bewaakte grens is niet
verschoven, en dat is met `git diff --name-only` nagegaan en niet aangenomen.

**Nieuw in deze ronde**

| Bestand | Inhoud |
|---|---|
| `tests/bekwaamheid-teller-reparatie.test.ts` | 13 tests, in vier delen: de teller leest de juiste tabel, het dashboard levert die teller ook werkelijk uit, de scoreschaal-omrekening op beide schrijfwegen, en één vastgestelde consequentie |
| `script/migreer-licenties.mjs` | de overgangsperiode vastleggen; droogloop standaard, idempotent |
| `tests/bekwaamheid-licentiemigratie.test.ts` | 12 tests op een gevuld register van 23 rijen |

**Waarom de tellertest in twee lagen is opgezet.** `berekenKwaliteitsStatus`
(`server/routes-stm.ts:934`) en `practitionersZonderAccount` (r908) staan als
geneste functies binnen `registerStmRoutes` en zijn niet geëxporteerd. Ze naar een
eigen module tillen was de andere weg; die is niet gekozen. Deel A meet de teller
rechtstreeks op een proefdatabank in het geheugen, deel B roept
`GET /api/kwaliteit/dashboard` werkelijk aan over een luisterende server, in de
vorm van `tests/hdd-endpoint-poort.test.ts`. Geen van de twee lagen bewijst de
andere: een teller die de juiste tabel leest maar nooit wordt aangeroepen, en een
dashboard dat de teller aanroept die het verkeerde telt, zijn beide fout en
laten elk de andere test groen.

**De wachten zijn op bijten getest.** Groen is geen bewijs tot vaststaat dat rood
mogelijk is. Twee mutatieproeven, beide daarna byte-identiek teruggedraaid en met
`sha256sum` gecontroleerd:

| Mutatie | Uitkomst |
|---|---|
| `afnames_count` terug op `stmSessieOpslagen.historiek()` | de twee dashboardtests van deel B falen |
| de migratiestap schrijft `opgeschort` in plaats van `overgangsperiode` | drie licentietests falen, waaronder de poortuitspraak |

**Wat de licentietest anders meet dan de poorteis vroeg.** De eis luidt dat geen
enkele status iets blokkeert. Er wordt niet de statuslijst nagelopen maar
`magAfnemen()` bevraagd — de functie die de poort werkelijk gebruikt — en gemeten
wordt `zouWeigeren` en niet `toegestaan`. Op de huidige stand `log` staat
`toegestaan` altijd op waar; een test die daarop leunt blijft groen ook wanneer
elke licentie geweigerd zou worden. De stand `handhaaf` wordt expliciet
doorgerekend, want dat is de stand waar het bij uitrol om gaat.

### Drie vondsten uit deze ronde

1. **De docstring van `migreer-bekwaamheid.mjs` is onjuist.** Regel 7 zegt dat
   het script `bekwaamheid_accreditaties` vult. Dat doet het niet: er staat geen
   enkele `INSERT` naar die tabel in, en de opslaglaag heeft geen
   accreditatiefuncties. Die tabel is daarom geen bruikbare bron om licenties uit
   af te leiden, en dat is de reden dat de licentiestap één instrument gebruikt
   (`t4p-business-kompas`, het canonieke id uit `server/registry.ts:315`) in
   plaats van per behaalde accreditatie een licentie te maken. De docstring is
   niet gecorrigeerd: dat zou de teller van gewijzigde bestaande bestanden op
   acht brengen voor een commentaarregel. Het staat hier zodat het niet verdwijnt.

2. **`migreer-bekwaamheid.mjs` negeert `TAPAS_DB_PATH`.** Het kijkt naar
   `DATABASE_PAD` en `SQLITE_PAD`. Bij het opzetten van de droogloopproef is met
   `TAPAS_DB_PATH` een kopie aangewezen; het script schreef daardoor met
   `--schrijf` twee rijen naar de echte `data.db`. Vastgesteld met `sha256sum`
   vooraf, en teruggezet uit de kopie die vóór de ingreep was gemaakt — de
   controlesom na herstel is gelijk aan die van vóór
   (`ac73b0f4e97caa08…`), en `bekwaamheid_geaccrediteerden` staat weer op nul
   rijen. `migreer-licenties.mjs` gebruikt daarom letterlijk dezelfde padzoeker
   als het bestaande script. Aandachtspunt dat blijft staan: geen van beide
   scripts vraagt bevestiging voordat het met `--schrijf` naar het productiepad
   schrijft.

3. **De demoseed levert na de reparatie geen afnames op.** `seedDemoKwaliteit()`
   logt dat het "afname-sessies" seedt, maar de enige `INSERT` die oefendata
   aanmaakt gaat naar `stm_sessies` (`server/kwaliteit-storage.ts:339`); er is
   geen `INSERT INTO afnames`. Het dashboard telt nu wat het zegt te tellen, en
   daardoor staat in de publieke demo iedereen op nul afnames en dus op
   `achterstand_50`. Dat is geen fout in de teller maar een leeg geworden
   demobeeld. Vastgelegd in deel D van de tellertest, zodat het een besluit
   blijft en geen verrassing wordt.

### Vierde vondst: `npm test` schrijft naar de echte `data.db`

Bij de eindcontrole veranderde de controlesom van `data.db` tussen twee
commando's zonder dat er een migratiescript liep. Dat is niet weggeredeneerd maar
nagemeten: kopie genomen, `npm test` gedraaid, rijaantallen van alle tabellen in
kopie en origineel vergeleken.

Uitkomst: precies één tabel verschilt, `gdpr_audit_log`, met één rij erbij per
suite-run:

```
actie    prive_intake_anonimisering
detail   1 intake(s) gewist - bewaartermijn intake verstreken - automatisch
```

Oorzaak: `tests/gdpr-verbeteringen.test.ts:113` roept
`ruimVerstrekenIntakesOp()` uit `server/prive-aankoop/bewaartermijn.ts:60` aan.
Die functie gebruikt de standaard databankverbinding en dus het productiepad. Elke
suite-run anonimiseert daardoor een echte privé-intake waarvan de bewaartermijn
verstreken is, en schrijft een auditregel. Het gaat om anonimiseren, niet om
verwijderen: geen enkel rijaantal buiten `gdpr_audit_log` verandert.

Dit is **bestaand gedrag**, van vóór dit blok, en het is hier niet gerepareerd —
dat zou een achtste gewijzigd bestaand bestand betekenen. Wel is het gevolg voor
het protocol dat `sha256sum data.db` geen bruikbare wacht is zolang de suite
meedraait; de zinvolle meting is het rijaantal per tabel. De bekwaamheid-tabellen
blijven op nul, en dat is na elke run nagegaan.

### Een eerder gerapporteerde meting die hier niet reproduceerbaar is

In de eerste ronde is de droogloop van `migreer-bekwaamheid.mjs` gerapporteerd
als 23 rijen waarvan 21 zonder adres. Op de huidige `data.db` geeft dezelfde
droogloop **2 rijen**. De oorzaak is vastgesteld en niet vermoed: de tabel
`coach_register` bestaat in deze databank niet, en dat is de bron van de
eenentwintig namen. De eerdere meting is dus op een andere databankstaat gedaan
en geldt niet voor deze. De 23 rijen komen in
`tests/bekwaamheid-licentiemigratie.test.ts` nog wel voor, maar daar als
opgebouwd proefregister — de vorm die het script moet aankunnen, niet een
bewering over de productiedatabank.

## Bewaakte grens — welke bestaande bestanden mogen wijzigen

Blok 1 wijzigt precies **zeven** bestaande bestanden. Elke andere wijziging aan
een bestaand bestand is een protocolbreuk.

De grens stond bij het begin van het werk op vier. Ze is tweemaal verruimd, beide
keren omdat een bestaande test anders faalde — dat is de reden om de grens te
verleggen en niet om de test te omzeilen. Elke verruiming staat hieronder met
de test die ze noodzakelijk maakte.

| Bestand | Wat er verandert | Waarom het niet anders kan |
|---|---|---|
| `shared/platformdelen.ts` | één item toegevoegd aan `PLATFORMDELEN` | de registry is statisch; een nieuw platformdeel bestaat alleen als het hier staat |
| `server/routes-stm.ts` | `EXTRA_PRACTITIONERS` verwijderd, teller leest `afnames` | de twee bevindingen die blok 1 moet herstellen |
| `server/migratieloper.ts` | één regel in `REEDS_TOEGEPAST` voor `0006` | zonder deze regel draait de nieuwe migratie op een bestaande databank onnodig opnieuw |
| `server/audit-log.ts` | acht acties toegevoegd aan de toegelaten lijst | een auditactie die niet in de lijst staat, wordt geweigerd |
| `server/db-encryptie.ts` | `server/bekwaamheid/storage.ts` aan `GEKENDE_HANDLES` | **verruiming 1.** `tests/db-encryptie.test.ts` doorzoekt `server/**/*.ts` op elke plaats die zelf een databank opent, en eist dat die lijst exact klopt. De nieuwe opslaglaag opent er een, dus zonder deze regel faalt die test — terecht, want ze bewaakt dat elke handle door de encryptiehook gaat |
| `drizzle.config.ts` | `./server/bekwaamheid/schema.ts` toegevoegd | **verruiming 2.** `tests/schema-dekt-databank.test.ts` vergelijkt de tabellen in de databank met de tabellen in de schemabestanden uit deze configuratie. Zonder deze regel zijn de veertien nieuwe tabellen voor die test onbekend en faalt ze |
| `tests/migratieloper.test.ts` | `"0006_bekwaamheid"` aan de verwachte migratielijst | de test somt de verwachte migraties op; een nieuwe migratie hoort daar per definitie in |

Alles wat nieuw is, is nieuw: `server/bekwaamheid/`, `migrations/0006_*.sql`,
`script/migreer-bekwaamheid.mjs`, `tests/bekwaamheid-*.test.ts`.

### Migratie 0006 is ná de eerste verificatie nog gewijzigd

Dat hoort hier vermeld, want een migratie wijzigen nadat ze is nagekeken is
normaal niet toegestaan. Hier kon het wel: `0006` is nooit uitgerold. Ze staat
alleen in deze werkkopie, `migrations/meta/` kent haar niet, en geen enkele
databank heeft haar toegepast. Er bestaat dus geen omgeving die van de oude
versie afhangt. Was ze wel uitgerold, dan hoorde er een `0007` bij.

De vier wijzigingen kwamen uit het schrijven van de tests, niet uit een
interpretatie:

| Wijziging | Waarom |
|---|---|
| `uitkomst` van `NOT NULL` naar nullable | een toets wordt aangemaakt met de twee gemeten signalen erin en pas later door een mens vastgesteld. Met `NOT NULL` moest het systeem bij aanmaak al een uitkomst kiezen — precies de menselijke beslissing die het niet mag nemen |
| CHECK op `uitkomst` nu `IS NULL OR IN (...)` | gevolg van de vorige regel |
| nieuwe CHECK `bekwaamheid_toets_vaststelling_volledig` | `vastgesteld_op` en `uitkomst` moeten samen leeg of samen gevuld zijn; anders bestaat er een toets met een uitkomst die niemand heeft vastgesteld |
| twee bestaande CHECKs beginnen met `uitkomst IS NULL OR` | ze golden alleen na vaststelling en blokkeerden anders elke aanmaak |

## Wat blok 1 uitdrukkelijk niet doet

- geen poort (blok 2) — de tabellen bestaan, er wordt niets geweigerd
- geen enkel scherm
- geen wijziging aan het gedrag van de oefenmodule zelf
- geen uploadveld voor opnames, in geen enkele vorm

### Wat blok 1 wél heeft geraakt, tegen de oorspronkelijke afbakening in

De afbakening zei: geen aanraking van de dubbele scoringslogica in
`routes-stm.ts`, dat is blok 4. Tijdens de bouw bleek dat niet houdbaar, en de
afwijking staat hier omdat ze anders alleen in de code te vinden zou zijn.

Feit: `stm_sessies.score_totaal` bevat twee schalen door elkaar. De echte weg
(`routes-stm.ts:648`) schrijft `totaalCorrect / totaalVragen`, dus een breuk
tussen 0 en 1. `seedDemoKwaliteit()` (`server/kwaliteit-storage.ts:363`) schrijft
`62 + rnd() * 36`, dus een percentage. De sleutels van `scores_per_laag`
verschillen op dezelfde manier: `laag1`..`laag4` tegenover `"1"`..`"4"`.

De ondergrens voor het oefengemiddelde staat op 55 op de honderdschaal. Zonder
omrekening zou elke echte sessie onder die grens vallen en zou iedereen die de
oefenmodule eerlijk gebruikt een signaal krijgen. Dat is geen randgeval maar de
regel.

De wijziging is bewust zo klein mogelijk gehouden: er is niets aan de schrijfweg
veranderd en niets in `routes-stm.ts` aan de scoreberekening. De omrekening zit
uitsluitend in de leeslaag van de nieuwe module
(`naarHonderdschaal()` in `server/bekwaamheid/storage.ts`) en raakt geen enkele
bestaande lezer. Het opruimen van de schaal zelf blijft blok 4.

## De cyclus zoals ze in dit blok wordt vastgelegd

Twee jaar, met een tussentijdse toets na twaalf maanden. De toets kijkt naar
**twee** signalen:

1. minder dan drie voltooide afnames in de voorafgaande twaalf maanden;
2. nul afgeronde oefensessies, of een gemiddelde onder 55 op de honderdschaal.

Nul signalen geeft `geen_signaal`, één signaal geeft nooit meer dan een
`aandachtspunt`, twee signalen geven een `alert` met een verplicht coachingsplan.

Het coachingsplan is dus het **gevolg** van een alert en geen derde signaal. Een
eerdere versie van dit document sprak van drie signalen; dat was onjuist. Zou het
plan zelf meetellen, dan krijgt wie een plan heeft daardoor sneller opnieuw een
alert, en dan straft het systeem precies het gedrag dat de bedoeling was.

Een alert sluit nooit de poort en verandert nooit de licentiestatus. Dat is niet
alleen een afspraak: `zetAlert` heeft de kolom `status` niet in zijn UPDATE, en
`server/bekwaamheid/rechten.ts` kent het woord `alert` niet — beide bewaakt door
een test.
