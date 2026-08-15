# Bouwrapport — de bekwaamheidsmodule afgewerkt

Vier commits, van `a27ddcc` naar `c24d7c1`, alle vier op `origin/main`. Dit rapport
volgt de vorm van de bouwrapporten 9.6 en 9.7: eerst wat er gebouwd is, dan de
keuzes waar iemand het anders had kunnen doen, dan wat er gemeten is, en tot slot
wat er blijft openstaan.

---

## Wat er nu staat

De module had voor deze afwerking een schema en een rekenkern, en verder niets.
Veertien tabellen bestonden, zes daarvan zonder opslaglaag; de eindpunten waren er
niet; er was geen scherm. Na deze vier commits is elke laag aanwezig en met de
laag eronder verbonden.

| Commit | Levering | Omvang |
| --- | --- | --- |
| `68db23b` | Opslaglaag blok 3 en 4 | 5 bestanden, 2 398 regels bij |
| `5a3e6b2` | De eindpunten, met dossiertoets | 10 bestanden, 2 811 bij, 1 af |
| `fca3d23` | De zes schermen | 8 bestanden, 4 352 regels bij |
| `c24d7c1` | De coachlaag en de woordenlijst | 7 bestanden, 545 bij, 136 af |

Zes tabellen kregen een opslaglaag: rondes, bewijsstukken, scores, beslissingen,
bezwaren en accreditaties. De fasenloop van een ronde staat in
`server/bekwaamheid/rondeloop.ts` met elf fasen en een vaste tabel van toegestane
overgangen; er is geen tweede plaats waar die overgangen worden nagelezen.

De eindpunten staan in vijf routebestanden onder `server/bekwaamheid/`, alle achter
`vereisAdmin`, alle met prefix `/api/bekwaamheid`. Zes schermen sluiten erop aan,
geregistreerd in `client/src/App.tsx` vóór `/admin/bekwaamheid` en vóór
`/admin/:id` — anders vangt een van die twee het pad weg.

De coachlaag sluit het laatste restant van §9.7 af: de licentiekolom staat nu ook
op `/admin/coaches` en als kaart op `/coach/dashboard`, met dezelfde vijf standen
en dezelfde woorden als op `/admin/toegang`.

---

## De keuzes

### Geen tweede rekenplaats in de browser

Geen van de zes schermen rekent iets na dat de server al rekent. De asscores, het
voorstel, de dekking, de nakijkuitslag en de toetsberekening komen als gegeven
binnen en worden getoond zoals ze aankwamen.

De reden is niet zuinigheid. Een tweede rekenplaats levert na de eerste wijziging
aan de kant van de server twee uitslagen op, en dan is bij een bezwaar niet meer
te zeggen welke van de twee gold. Een dossier waarin twee getallen staan die
allebei uit het systeem komen, is geen dossier.

### Geen voorgevulde beslissing

De keuzevelden bij een beslissing en bij een vaststelling van een toets staan leeg.
Ze worden niet voorgevuld met wat de motor voorstelde, ook al is dat voorstel
zichtbaar op hetzelfde scherm.

Wie een voorgevulde keuze ziet, bevestigt haar. Dan is de menselijke beslissing een
formaliteit en had de motor net zo goed zelf kunnen beslissen — en dat is precies
wat de module niet doet.

### Eén lijst met regels, op de server

De toegestane fase-overgangen, de itemgebruik-overgangen en de weigeringsgronden
staan op de server. De schermen bieden de handeling aan en tonen de weigering
woordelijk zoals ze aankwam. Eén uitzondering: de overgang van `oefenen` naar
`meten` wordt niet aangeboden, omdat die overgang niet bestaat.

### De verhuizing zonder inhoudelijke wijziging

De zeventien teksten van de licentiekolom zijn naar `shared/i18n.ts` verhuisd met
het prefix `lk_`, woordelijk. Geen vertaling is bij de verhuizing herschreven. Was
er ook maar één zin veranderd, dan viel bij een verschil tussen voor en na niet
meer te zeggen of het aan de verhuizing lag.

Het oude bestand blijft bestaan als dunne laag over de woordenlijst. De drie
namen die het exporteert, worden door drie andere bestanden aangesproken; ze laten
staan als afgeleide houdt de verhuizing bij precies één inhoudelijke wijziging in
plaats van vier.

---

## Waar het bouwplan niet klopte

Het plan schatte de coachlaag als "de goedkoopste levering", met **Server: niets
nieuws**. Dat bleek op twee punten onjuist. Beide zijn alleen in de code te zien en
niet in het plan.

**`leesLicentiebeeld` sleutelde uitsluitend op `beheerderId`** en sloeg elke
registerrij zonder beheerder-id over. De rijen op `/admin/coaches` zijn
coachregisterrijen met een eigen id, en het register koppelt daar met
`coach_register_id`. Een coach zonder beheerderrij — wat het register uitdrukkelijk
toelaat, de CHECK vraagt om e-mail óf beheerder-id óf coachregister-id — kwam
helemaal niet in het antwoord voor.

**Het eindpunt hangt achter `vereisAdmin`.** Een practitionersessie is geen
adminsessie, dus `/coach/dashboard` kon de leesweg niet gebruiken.

Opgelost zonder tweede rekenkern, want dat was de reden dat deze leesweg één
eindpunt is. Het antwoord kreeg naast `perBeheerder` een tweede sleutel `perCoach`,
gevuld in dezelfde lus met hetzelfde beeldobject — één berekening, twee sleutels.
Daarnaast één nieuw eindpunt, `GET /api/coach/licentiebeeld`, dat uitsluitend het
eigen beeld geeft. Het beheerder-id komt uit de sessie; er is geen id in de URL, en
dat is de hele beveiliging.

Een detail dat bij het toetsen bovenkwam: de sleutelcontrole gebruikt `== null` en
niet `=== null`. Een aanroeper die het coachveld weglaat, moet hetzelfde behandeld
worden als een die er `null` in zet. Met de strikte vergelijking verscheen de
sleutel `"undefined"` in de afbeelding.

---

## Wat er niet meer in staat

`EXTRA_PRACTITIONERS` in `server/routes-stm.ts` is weg. Waar de constante stond,
staat nu een kop die de drie feiten vastlegt: de eenentwintig namen stonden al in
`coach_register`, negentien van de eenentwintig adressen bestonden niet, en de
ids 1001 tot 1021 zijn wél behouden omdat `kwaliteit_normen`, overrides en
verstuurde alerteringen eraan vasthangen.

`practitionersZonderAccount()` leest nu het register. De toets
`tests/bekwaamheid-geen-namenlijst.test.ts` (7 toetsen) bewaakt dat de constante
niet terugkomt.

---

## Wat er gemeten is

**Toetsen.** 187 bestanden, 2 423 toetsen, alle groen, 66,52 s. Voor de laatste
levering waren dat 2 413 toetsen; de tien nieuwe zitten in
`tests/bekwaamheid-licentiebeeld-route.test.ts`, dat daarmee op 24 komt. De
dossiertoets `tests/bekwaamheid-routes-dossier.test.ts` staat op 50 van 50.

**Typecontrole.** `tsc --noEmit` geeft 72 meldingen. Dat is exact de bestaande
verdeling en exact hetzelfde aantal als vóór deze vier commits: admin-inzichten 14,
lounge 13, studie 8, t4teens/scoring 6, t4students/scoring 6, gids-manager 6,
admin-academy 6, routes-deelnemer 5, t4sports-modules 2, admin-coaches 2, scoring 1,
driverscan/rapport-pdf 1, t4o-deelnemer 1, academy 1. Geen enkele melding staat in
een bestand dat deze vier commits aanraken. De twee in `admin-coaches.tsx` staan op
regel 106 en stonden er al.

**Bundel.** `vite build` sluit met 3 031 getransformeerde modules.

---

## Wat blijft openstaan

Dit zijn bevindingen uit het bouwen, geen taken die stilzwijgend zijn overgeslagen.
Ze staan hier omdat ze anders verdwijnen.

**Geen enkele van de veertien `bekwaamheid%`-tabellen bevat een rij.** De schermen
zijn dus nooit met echte gegevens bekeken. Wat hier getoetst is, is het gedrag van
de lagen; hoe een register met tweehonderd personen of een ronde met vijf
bewijsstukken eruitziet, is niet nagekeken. Dat is de eerstvolgende stap die geen
code vraagt maar wel gegevens.

**Herbeslissing na een gegrond bezwaar is onmogelijk.** `UNIQUE(ronde_id)` op de
beslissingstabel plus de dubbelcheck in `beslissingen.legVast` sluiten een tweede
beslissing op dezelfde ronde uit. De fasenloop laat `bezwaar → in_beoordeling` wel
toe, dus de weg terug bestaat op papier en loopt vast op de tabel. Dit is een echte
leemte in de cyclus en geen bouwrest.

**`itemsets.keurNa` laat geen auditspoor achter** en **`plannen.stelOp` toetst de
signalen niet.** Twee plaatsen waar een handeling wel iets vastlegt maar niet
vertelt wie of waarom.

**De cesuur van de oefenmodule (0,85 / 0,70 / 0,55) is niet onderbouwd.** De
grenzen staan in de code en werken; er is geen document dat zegt waar ze vandaan
komen.

**De docstring van `script/migreer-bekwaamheid.mjs` beweert dat het accreditaties
vult.** Dat doet het niet. **`script/add_marc_showcase.ts` heeft een hardgecodeerd
token.** Negen van de negenentwintig meetscripts gebruiken absolute paden.

---

*Alle regelaantallen, toetsuitslagen en meldingsverdelingen in dit rapport komen uit
`git show --stat`, `npx vitest run` en `npx tsc --noEmit` op commit `c24d7c1`.*
