# Vervolgplan — de bekwaamheidsmodule afwerken

Opgesteld 14 augustus 2026 · gemeten op `main`, commit `a27ddcc`

---

## De kern in één beeld

Het gat zit niet waar het lijkt. De rekenkernen en de opslaglaag zijn grotendeels af; wat ontbreekt is de laag ertussen — het eindpunt en het scherm.

`server/bekwaamheid/storage.ts` is 2.108 regels en bevat negen groepen: register, licenties, tellers, agenda, toetsen, plannen, normprofielen, items, itemsets. Daarin staan **ongeveer achttien schrijffuncties die gebouwd en getest zijn maar vanaf geen enkel eindpunt bereikbaar**: `register.zetNeer`, `register.zetInactief`, `licenties.naBekrachtiging`, `licenties.zetAlert`, `agenda.zetNeer`, `agenda.handelAf`, `toetsen.bereidVoor`, `toetsen.stelVast`, `toetsen.publiceer`, `toetsen.legGesprekVast`, `plannen.stelOp`, `plannen.legAkkoordVast`, `plannen.sluitAf`, `items.zetNeer`, `items.wijzig`, `itemsets.stelSamen`, `itemsets.leverIn`, `itemsets.keurNa`.

Alleen de drie normprofielfuncties hebben een eindpunt gekregen.

Het scherpste voorbeeld: **`beslisregels.ts` is 291 regels beslismotor met een eigen testbestand, en wordt buiten die tests door geen enkel bestand geïmporteerd.** De motor die bepaalt of iemand bekrachtigd wordt, is af en hangt nergens aan vast.

### Per tabel gemeten

| Tabel | Opslag | Eindpunt | Scherm |
|---|---|---|---|
| `normprofielen` | ✅ 3 schrijfacties | ✅ | ✅ |
| `geaccrediteerden` | ✅ 3 | ❌ | ❌ |
| `licenties` | ✅ 3 | ❌ | ❌ |
| `items` | ✅ 4 | ❌ | ❌ |
| `tussentijdse_toetsen` | ✅ 5 | ❌ | ❌ |
| `coachingsplannen` | ✅ 3 | ❌ | ❌ |
| `itemsets` | ✅ 2 | ❌ | ❌ |
| `agenda` | ✅ 1 | ❌ | ❌ |
| `rondes` | ⚠️ alleen lezen | ❌ | ❌ |
| `accreditaties` | ❌ niets | ❌ | ❌ |
| `bewijsstukken` | ❌ niets | ❌ | ❌ |
| `scores` | ❌ niets | ❌ | ❌ |
| `beslissingen` | ❌ niets | ❌ | ❌ |
| `bezwaren` | ❌ niets | ❌ | ❌ |

Dat splitst het werk in twee soorten. **Acht tabellen missen alleen een eindpunt en een scherm** — daar is de opslaglaag al geschreven én getest. **Zes tabellen missen alles**, inclusief de opslaglaag. De eerste soort is een fractie van het werk van de tweede.

Daarom volgt hieronder een volgorde die de goedkope leveringen vooraan zet, met één uitzondering: levering 1 is niet de goedkoopste maar wel de eerste die de module bruikbaar maakt.

---

## Levering 1 · Licenties en register bestuurbaar maken

**Waarom eerst.** Zonder dit kan niemand een licentie uitgeven en blijft de poort permanent op `log`. De hele module hangt hierop.

**Server.** Zes eindpunten, alle op bestaande opslagfuncties:

```
GET    /api/bekwaamheid/register                lijst met filter op actief
POST   /api/bekwaamheid/register                register.zetNeer
POST   /api/bekwaamheid/register/:id/inactief   register.zetInactief
GET    /api/bekwaamheid/licenties/:persoonId    licenties.vanPersoon
POST   /api/bekwaamheid/licenties               licenties.naBekrachtiging
PATCH  /api/bekwaamheid/licenties/:id/alert     licenties.zetAlert
```

**Client.** Eén nieuw scherm `/admin/bekwaamheid/register`: lijst met zoekveld en filter op stand, detailpaneel per persoon met de licenties eronder, en het formulier om een licentie neer te leggen. Vanuit `/admin/toegang` een doorklik vanaf de licentiekolom naar de juiste persoon.

**Bewaken.** `zetInactief` vraagt een reden en die moet in het auditspoor komen. Een licentie neerleggen zonder geldende norm voor dat instrument hoort geweigerd te worden — anders ontstaat er een bekrachtiging waar geen cesuur tegenover staat.

**Nieuwe tabellen:** geen. **Migratie:** geen.

**Omvang:** ongeveer 4 nieuwe bestanden, 2 gewijzigde (`routes.ts`, `App.tsx`).

---

## Levering 2 · De coachlaag afmaken

**Waarom hier.** Dit is het restant van §9.7 waarvoor de serverlaag al klaarligt. Het is de goedkoopste levering in het plan.

`admin-coaches.tsx` en `coach-dashboard.tsx` zijn bij de vorige ronde niet aangeraakt omdat ze buiten de bestandsgrens vielen. Het eindpunt `/api/bekwaamheid/licentiebeeld` geeft per beheerder al precies wat ze nodig hebben; `LicentieKolom.tsx` is al geschreven en hoeft alleen hergebruikt.

**Server:** niets nieuws.

**Client:** dezelfde licentiekolom in beide schermen, met dezelfde vijf standen en dezelfde woorden.

**Meenemen:** hier hoort de verhuizing van `licentiekolom-teksten.ts` naar `shared/i18n.ts` met prefix `lk_`. De bestandsgrens die dat vorige keer blokkeerde geldt nu niet meer, en de bestaande test op vijftalige volledigheid dekt de verhuizing af.

**Omvang:** 2 gewijzigde schermen, 1 verhuisd bestand, 1 gewijzigde `shared/i18n.ts`.

---

## Levering 3 · De itembank beheerbaar maken

**Waarom hier.** `items.zetNeer` en `items.wijzig` zijn geschreven en getest, en de regiekamer toont al p-waarden en item-restcorrelaties. Alleen: er is geen manier om een item toe te voegen of te herzien.

**Server.** Vier eindpunten:

```
GET    /api/bekwaamheid/items?instrument=&blok=   items.lijst
POST   /api/bekwaamheid/items                     items.zetNeer
PATCH  /api/bekwaamheid/items/:id                 items.wijzig
GET    /api/bekwaamheid/items/dekking/:instrument items.dekking
```

**Client.** Scherm `/admin/bekwaamheid/items`: lijst per blok, dekkingsoverzicht bovenaan, een bewerkformulier, en per item de p-waarde en de item-restcorrelatie uit de itemanalyse ernaast.

**De aanleiding om dit niet uit te stellen.** Het herstelvoorstel voor de afleiders ligt er (blok A: 5 van 17, blok C: 12), en 44 van de 73 bestaande gesloten items hebben een lengte-aanwijzing — het juiste antwoord is stelselmatig het langste. Zolang er geen beheerscherm is, moet elke correctie via een script of een migratie. Met dit scherm wordt het herstel gewoon werk in de applicatie, met auditspoor.

**Omvang:** ongeveer 3 nieuwe bestanden, 2 gewijzigde.

---

## Levering 4 · Rondes en bewijsstukken

**Hier begint het dure deel.** Vanaf nu ontbreekt ook de opslaglaag.

**Nieuw in `storage.ts`:** een groep `rondes` (openen, fase verzetten, sluiten) en een groep `bewijsstukken` (neerleggen, inleveren, intrekken). De regiekamer leest beide tabellen al met platte SQL in `routes-regiekamer.ts`; die leeswegen blijven zoals ze zijn.

**Bewaken.** De elf fasen uit `RONDEFASEN` moeten een gecontroleerde overgang krijgen: niet elke fase mag naar elke fase. Leg die overgangstabel expliciet vast in code en test hem uitputtend, want dit is de ruggengraat van de cyclus. Een fase die stilletjes terugspringt, maakt de agenda onbetrouwbaar.

**Server:** ongeveer zes eindpunten. **Client:** het rondescherm, of een uitbreiding van de regiekamer met een handelingslaag.

**Omvang:** ongeveer 6 nieuwe bestanden. Dit is de grootste enkele levering.

---

## Levering 5 · Scores en de beoordelaarsweg

**Nieuw in `storage.ts`:** een groep `scores` (invoeren, herzien, kalibratie markeren).

**Server:** eindpunten om per bewijsstuk een score in te voeren en te herzien.

**Client:** een beoordelaarsscherm. Dit is het enige scherm in het plan dat níet voor een Admin Beheerder is maar voor een beoordelaar, met een eigen rechtenvraag: een beoordelaar mag alleen de bewijsstukken zien die aan hem zijn toegewezen.

**Wat er direct gaat werken.** De ICC-berekening met interval draait al en de kaart in de regiekamer staat er al. Zodra hier scores in gaan, vult die kaart zich vanzelf. Ook `Nog niet volledig beoordeeld` gaat dan werken.

**Bewaken.** De ICC vraagt minstens 3 dossiers en 2 beoordelaars voordat er iets te lezen valt, en de norm ligt op 0,75. Toon het interval en niet alleen de puntschatting — bij weinig dossiers is `onbeslist` het eerlijke antwoord en dat moet het scherm ook zeggen.

**Omvang:** ongeveer 5 nieuwe bestanden.

---

## Levering 6 · Beslissingen — de motor aansluiten

**Dit is het sluitstuk.** Hier komt `beslisregels.ts` eindelijk aan het werk.

**Nieuw in `storage.ts`:** een groep `beslissingen` (vaststellen, debriefen, publiceren).

**Server.** Twee wegen, en het onderscheid is wezenlijk:

```
POST /api/bekwaamheid/beslissingen/voorstel     beoordeel() — rekent, bewaart niets
POST /api/bekwaamheid/beslissingen              vastleggen, met het voorstel erbij
```

De eerste weg geeft het voorstel van de motor zonder iets vast te leggen, net zoals de poortsimulatie dat doet. De tweede legt de beslissing vast.

**De regel die u hier moet zetten.** Leg in de tabel zowel het voorstel van de motor vast als de uiteindelijke beslissing. Wijken die af, dan is een schriftelijke motivering verplicht. Dat is wat een beslissing verdedigbaar maakt: niet dat de motor gelijk kreeg, maar dat na te lezen is wanneer een mens ervan afweek en waarom. Zonder die regel is de motor decoratie.

**Termijnen.** Debrief binnen 10 werkdagen, publicatie binnen 3 werkdagen. `feestdagen.ts` rekent werkdagen al correct, inclusief de paasberekening. De kaart `Kwaliteit van het proces` in de regiekamer meet die termijnen al.

**Omvang:** ongeveer 5 nieuwe bestanden.

---

## Levering 7 · Bezwaar, toetsen en plannen

Drie kleinere stukken die de cyclus sluiten.

**Bezwaren** — nieuwe opslaggroep, twee eindpunten (indienen, uitspraak), termijn 30 kalenderdagen. De regiekamer leest de tabel al.

**Tussentijdse toetsen** — de opslag is compleet (`bereidVoor`, `stelVast`, `publiceer`, `legGesprekVast`) en de rekenkern `berekenTussentijdseToets` is aangesloten. Alleen eindpunten en een scherm ontbreken. Dit is de evaluatie na 12 maanden die je zelf hebt gevraagd, met de twee signalen `afnames_onder_drempel` en `oefening_zwak_of_afwezig` en de alertvermelding.

**Coachingsplannen** — opslag compleet (`stelOp`, `legAkkoordVast`, `sluitAf`), evaluatie na 6 maanden. Alleen eindpunten en scherm.

**Omvang:** ongeveer 6 nieuwe bestanden voor de drie samen. Goedkoper dan het lijkt, omdat twee van de drie opslaglagen al klaar zijn.

---

## Levering 8 · Accreditaties, of de bewuste keuze om ze te laten

`bekwaamheid_accreditaties` is de enige tabel die door niets wordt aangeraakt: geen opslag, geen script, geen scherm. De docstring van `migreer-bekwaamheid.mjs` beweert dat het script hem vult; dat is onjuist en het staat zo in de code van het tweede script opgetekend.

Er zijn twee eerlijke uitwegen en de derde — laten staan zoals nu — is de slechtste.

**Wel bouwen** als het historische feit "deze persoon heeft in 2019 dit behaald" apart moet blijven van "deze persoon mag vandaag afnemen". Dat is een echt onderscheid: een accreditatie vervalt niet, een licentie wel.

**Schrappen** als dat onderscheid in de praktijk niet gemaakt wordt. Dan verdwijnt de tabel in een migratie en wordt de onjuiste docstring gecorrigeerd.

Wat er niet moet gebeuren, is een lege tabel laten staan met een docstring die zegt dat hij gevuld wordt. Dat is precies het soort stille onwaarheid dat over twee jaar iemand op het verkeerde been zet.

**Dit is een inhoudelijke keuze en geen bouwbeslissing.** Ik leg hem bij jou.

---

## Twee dingen die parallel horen te lopen

**De schermen nakijken met echte gegevens.** Alle veertien tabellen stonden bij oplevering op nul rijen; geen enkel scherm van de module is ooit met gevulde tabellen gezien. Doe dit direct na levering 1, want dan is er voor het eerst iets te zien. Wacht er niet mee tot het einde: een fout in het licentiebeeld die je in augustus vindt is goedkoper dan dezelfde fout in december, bovenop zes leveringen die erop voortbouwen.

**`EXTRA_PRACTITIONERS` opruimen.** In `routes-stm.ts:329` staat een array met 21 namen en e-mailadressen, hard in een publieke repo. Die mensen staan buiten de databank en dus buiten de bewaartermijnjob, het auditlogboek en het recht op verwijdering. Dit staat los van de bekwaamheidsmodule en is er niet door ontstaan, maar het is het zwaarste openstaande punt in dit dossier en het wordt niet kleiner door te wachten. Het hoort niet achteraan in de rij.

---

## Volgorde en afhankelijkheden

```
1 Licenties en register ──┬── 4 Rondes ── 5 Scores ── 6 Beslissingen ── 7 Bezwaar
                          │                                    │
2 Coachlaag ──────────────┘                          7 Toetsen en plannen
3 Itembank ───────────────────────────── (voedt 5)
```

Levering 1 is de enige harde voorwaarde voor de rest. Levering 2 en 3 kunnen daarnaast, in willekeurige volgorde. Vanaf 4 is de keten strikt: zonder rondes geen bewijsstukken, zonder scores geen beslissing, zonder beslissing geen bezwaar.

Levering 7 (toetsen en plannen) kan eerder als je de evaluatie na 12 maanden snel nodig hebt — de opslaglaag ligt klaar en er is geen afhankelijkheid van rondes.

---

## Werkafspraken per levering

Deze zijn niet onderhandelbaar en volgen het protocol dat deze ronde ook gold:

- **Volledige testsuite groen** vóór elke commit. Vertrekpunt: 184 bestanden, 2.309 tests
- **`npx tsc --noEmit`** mag geen nieuwe melding opleveren in een aangeraakt bestand. De 72 bestaande meldingen staan buiten deze module en blijven zoals ze zijn
- **`npx vite build`** slaagt
- **Een bestandsgrens per levering, vooraf afgesproken.** Dat werkte deze ronde: 14 gewijzigde bestaande bestanden, gehaald en gehaald gebleven
- **Alleen wijzigen waar strikt nodig.** Niets aanraken dat buiten de levering valt
- **Wanneer een test de code tegenspreekt, wordt de code onderzocht en niet de test aangepast** — tenzij feitelijk blijkt dat de test de verkeerde verwachting had. Deze ronde gebeurde dat één keer en het was de test
- **Elke levering eindigt met een bouwrapport** in dezelfde vorm als die van 9.6 en 9.7
- **Mutatieproef bij elke nieuwe rekenkern.** Wijzig de berekening bewust en toon dat de tests vallen. Een groene suite die niet kan falen, bewijst niets

---

## Wat ik niet weet

Ik heb geen zicht op je tijdpad, wie er meebouwt en wanneer de eerste echte hercertificering moet draaien. Die drie bepalen of dit plan in deze volgorde moet, of dat er stukken naar voren moeten.

De volgorde hierboven is geoptimaliseerd op één ding: **zo snel mogelijk een module die werkelijk gebruikt kan worden**, en niet op het zo snel mogelijk vullen van alle veertien tabellen. Als je een andere prioriteit hebt — bijvoorbeeld eerst een volledig auditspoor voor een externe toetsing — dan verandert de volgorde.
