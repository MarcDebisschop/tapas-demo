# Release-overzicht — bekwaamheidsmodule

**Repo** `MarcDebisschop/tapas-demo` · **branch** `main` · **van** `b808577` **naar** `a27ddcc` · **gepusht** 14 augustus 2026, 18:04 CEST · **package.json** staat nog op `2.7.0`, er is geen tag geplaatst

**Totaal** 108 bestanden, 35.954 toevoegingen, 74 verwijderingen. Daarvan 93 nieuw en 15 gewijzigd.

---

## In één alinea

Deze release voegt de bekwaamheidsmodule toe: een register van geaccrediteerden, licenties met een cyclus van 24 maanden, een poort die het afnamerecht kan handhaven, een normprofiel met bevriesbare cesuur, en een meetlaag met itembank en betrouwbaarheidsschatting. Daarnaast zet ze drie bestaande schermen recht die iets over bekwaamheid leken te zeggen zonder dat er een bekwaamheidsbeslissing achter zat.

**Het gedrag van het platform verandert bij deze release niet.** De poort staat standaard op `log`: ze meet en registreert, ze weigert niets. Dat is een bewuste keuze — eerst zien wat een handhavende poort zou doen, dan beslissen.

---

## De vier commits

### 1 · `4951193` — Negeer Python-bytecode van de meetscripts

1 bestand, 4 regels. `__pycache__/` en `*.pyc` naar `.gitignore`. Afgeleide inhoud die bij elke uitvoering verandert.

### 2 · `b760203` — De serverlaag, de poort en de licentiecyclus

52 nieuwe bestanden, 10 gewijzigde. 22.955 toevoegingen, 44 verwijderingen. De kern van de release.

**Nieuw:** `server/bekwaamheid/` (25 bestanden), drie migraties, 22 testbestanden, twee eenmalige vulscripts.

| Onderdeel | Wat het doet |
|---|---|
| Register en licenties | Zeven statussen, waarvan vier afnamerecht geven. Cyclus 24 maanden, tussentijdse toets na 12 |
| De poort | Weigert op vier gronden: `geen_licentie`, `status_zonder_afnamerecht`, `nog_niet_geldig`, `verlopen` |
| Normprofiel | Weging, cesuur, onderbouwing van minstens 200 tekens, met bevriezing zodra er gemeten is |
| Meten | Itembank, itemanalyse, ICC(A,1) met interval volgens McGraw en Wong (1996) |
| Regiekamer en licentiebeeld | Twee leeswegen die niets schrijven, ook geen auditregel |

**Migraties**, die bij het opstarten automatisch draaien via `pasMigratiesToe` in `server/storage.ts`:

- `0006_bekwaamheid.sql` — 14 tabellen, strikt additief: alleen `CREATE TABLE` en `CREATE INDEX`
- `0007_beslisuitkomsten.sql` — `bekwaamheid_beslissingen_nieuw`
- `0008_itemblokken.sql` — `bekwaamheid_items_nieuw`

**Nieuwe eindpunten**, alle achter `vereisAdmin`:

```
GET   /api/bekwaamheid/regiekamer?peildatum=&instrument=
POST  /api/bekwaamheid/regiekamer/poortsimulatie
GET   /api/bekwaamheid/normprofiel
GET   /api/bekwaamheid/normprofiel/:id
POST  /api/bekwaamheid/normprofiel/:id/bevries
GET   /api/bekwaamheid/normprofiel-instrumenten
GET   /api/bekwaamheid/licentiebeeld?peildatum=
```

**De poort grijpt in op drie plaatsen** via `beoordeelSchrijfweg`: `server/routes/afnames.ts` (twee wegen), `server/bulk-import/routes.ts` (één) en de simulatie in de regiekamer.

**Twee reparaties aan bestaande code.** De teller in `routes-stm.ts` telde afgeronde oefensessies in plaats van afnames — iemand die veel oefende en niets afnam, lag op schema. Die leest nu `tellers.telAfnames`. En de migratieloper legt vast welke migraties gedraaid zijn, met een register dat overgeslagen migraties apart bijhoudt.

De tien gewijzigde bestaande bestanden: `drizzle.config.ts` · `server/audit-log.ts` · `server/bulk-import/routes.ts` · `server/db-encryptie.ts` · `server/migratieloper.ts` · `server/routes-stm.ts` · `server/routes.ts` · `server/routes/afnames.ts` · `shared/platformdelen.ts` · `tests/migratieloper.test.ts`.

### 3 · `6e62740` — De schermen, en drie die nu zeggen wat ze meten

6 nieuwe bestanden, 4 gewijzigde. 2.784 toevoegingen, 30 verwijderingen.

**Nieuw:** `/admin/bekwaamheid` (de regiekamer: rondes, agenda, overeenstemming tussen beoordelaars, poortsimulatie) en `/admin/bekwaamheid/normprofiel` (norm vaststellen en bevriezen), plus `client/src/components/bekwaamheid/`.

**Wat deze schermen niet doen.** Het normprofiel is de enige schrijfweg in de hele module: vier lees-eindpunten, en alle drie de schrijf-eindpunten gaan over het normprofiel. Er is geen scherm en geen eindpunt om een licentie uit te geven, een accreditatie vast te leggen, een ronde te openen, een score in te voeren of een beslissing vast te leggen. De regiekamer leest die tabellen; ze vult ze niet.

**Rechtgezet — dit is bouwplan §9.7:**

| Scherm | Wat er stond | Wat er nu staat |
|---|---|---|
| `/admin/toegang` | Schakelaars, geen verwijzing naar een licentie | Tweede kolom **Licentie** per module-rij, vijf standen in woorden |
| `/admin/stm` | Inschalingslabel dat als kwalificatie las | `/admin/oefenen`, titel **Oefenen**, afbakening bij module en uitkomst |
| `/admin/kwaliteit` | Kolom "Afnames" die oefensessies telde | Praktijkactiviteit benoemd, afnames en oefensessies gescheiden |

Het oude adres `/admin/stm` leidt om naar `/admin/oefenen`, zodat bestaande links blijven werken.

### 4 · `a27ddcc` — De protocollen, en de scripts waarmee ze gemeten zijn

35 nieuwe bestanden, 10.211 toevoegingen. Geen code die het platform uitvoert.

Vier werkprotocollen (blok 1 tot 4), de itembron van de kennischeck, het overzicht van de 80 items, het herstelvoorstel voor de afleiders, en 29 meetscripts.

De mutatieproef-scripts zijn het bewijs dat de tests werkelijk falen wanneer de berekening verandert. Zonder dat bewijs is een groene suite een bewering.

---

## Verificatie

| Controle | Uitkomst |
|---|---|
| Volledige suite op `a27ddcc` | **184 bestanden, 2.309 tests groen** (63,95 s) |
| Volledige suite op `b760203` alleen | **182 bestanden, 2.288 tests groen** (66,38 s) — de serverlaag staat op zichzelf |
| Typecontrole `npx tsc --noEmit` | 72 meldingen, **geen enkele** in een nieuw of gewijzigd bestand |
| Bundel `npx vite build` | slaagt in 20,24 s |
| Nieuwe tests | 24 testbestanden |

De 72 typemeldingen staan alle in bestanden die deze release niet aanraakt: `admin-inzichten.tsx` (14), `lounge.tsx` (13), `studie.tsx` (8), `t4teens/scoring.ts` (6), `t4students/scoring.ts` (6), `gids-manager.ts` (6), `admin-academy.tsx` (6) en zeven andere.

**Wat niet geverifieerd is:** commit 3 en 4 zijn niet los uitgechecked en getest. De eindstand en commit 2 wel.

---

## Bij het uitrollen

**De migraties draaien automatisch** bij het opstarten. Ze zijn additief: alleen nieuwe tabellen en indexen, geen `ALTER` en geen `DROP` op bestaande tabellen.

**De tabellen zijn leeg na de uitrol.** Alle 14 tabellen uit 0006 staan op nul rijen. Het licentiebeeld toont dan overal `buiten_het_register` en de regiekamer blijft leeg. Dat is correct, maar niet informatief. Om ze te vullen zijn er twee stappen, in deze volgorde:

```
node script/migreer-bekwaamheid.mjs            # droogloop: laat zien wat het zou doen
node script/migreer-bekwaamheid.mjs --schrijf  # vult het register: wie er is
node script/migreer-licenties.mjs              # droogloop
node script/migreer-licenties.mjs --schrijf    # zet elke actieve persoon op `overgangsperiode`
```

**Droogloop is de standaard.** Zonder `--schrijf` verandert geen van beide scripts iets. Twee beperkingen: de licentie wordt alleen aangemaakt voor `t4p-business-kompas`, en `bekwaamheid_accreditaties` wordt door geen enkel script gevuld — de docstring van het eerste script beweert van wel en die bewering is onjuist.

Twee stappen en niet één, omdat ze verschillende dingen doen. Het register beschrijft een feit dat al waar was. Een licentie is een uitspraak over wat iemand mag, en zo'n uitspraak hoort niet als bijwerking van een vulscript te ontstaan.

**De poortstand** komt uit `BEKWAAMHEID_POORT`, met drie waarden: `uit`, `log`, `handhaaf`. Een onbekende of ontbrekende waarde levert `log`. Zet die niet op `handhaaf` voordat de twee scripts gedraaid zijn en het licentiebeeld met echte data nagekeken is — zonder licentierijen weigert een handhavende poort iedereen.

---

## Wat er niet in zit

**`admin-coaches.tsx` en `coach-dashboard.tsx`** zijn niet aangeraakt. Bouwplan §9.7 noemt ze wel, maar ze vielen buiten de bestandsgrens van die ronde. De serverlaag ligt er klaar voor: hetzelfde eindpunt geeft per beheerder al alles wat die twee schermen nodig hebben.

**De vijftalige teksten van de licentiekolom** staan in `client/src/components/bekwaamheid/licentiekolom-teksten.ts` in plaats van in `shared/i18n.ts`, om binnen de bestandsgrens te blijven. Ze horen daarheen met prefix `lk_`. Een test bewaakt intussen dat elke sleutel in alle vijf talen bestaat en dat geen taal een sleutel heeft die het Nederlands niet kent.

**De cesuur van de oefenmodule** (0,85 / 0,70 / 0,55) is niet onderbouwd en de adaptieve selectie stuurt naar zwakke lagen. Deze release zet daar woorden om, geen scores. Dat zijn vragen over het instrument en die zijn hier niet stil beslecht.

**`EXTRA_PRACTITIONERS`** in `routes-stm.ts` is een hardgecodeerde array met 21 namen en e-mailadressen in een publieke repo — persoonsgegevens buiten de databank, en dus buiten de bewaartermijnjob, het auditlogboek en het recht op verwijdering. Dat stond al in `b808577` en is met deze release niet nieuw ontstaan, maar ook niet opgelost. Het is het zwaarste openstaande punt.

**Negen van de 29 meetscripts** bevatten absolute paden naar de werkmap waarin ze gedraaid zijn en zijn zo niet elders uit te voeren.

---

## Twee dingen over de vorm

**Vier commits en geen zeven.** Een commit per bouwblok was het plan, maar `routes.ts`, `App.tsx` en `routes-stm.ts` bevatten wijzigingen uit meerdere rondes door elkaar. Een blok-per-commit-indeling zou commits opleveren die niet bouwen, en dat is erger dan een grovere geschiedenis. De indeling server / client / documentatie is de fijnste die overeind blijft.

**Geen tag, geen versieverhoging.** `package.json` staat nog op `2.7.0`. Een module van deze omvang verdient `2.8.0` en een tag, maar dat is een beslissing over jouw versiebeleid en die heb ik niet zelf genomen.
