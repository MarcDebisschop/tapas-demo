# Itembron T4P Business Kompas — kennischeck blok 4

Dit document is de **enige toegestane bron** voor de inhoud van de meetitems van
de kennischeck bij het T4P Business Kompas. Elke bewering in een item moet hier
letterlijk terug te vinden zijn, met het codepad erbij. Wat hier niet staat, mag
niet in een item als juist of onjuist worden voorgesteld.

De reden voor die strengheid: een kennischeck die iets als "fout" bestempelt wat
in de code anders werkt, meet niet de bekwaamheid van de kandidaat maar de
gissing van de itemschrijver. Bij een bezwaar is dat niet te verdedigen.

Alle regelverwijzingen gelden bij repo-HEAD `b808577`, versie 2.7.0.

---

## 1. Het instrument

Bron: `server/data/instrument.json`, ingeschreven via `server/registry.ts:160`
als `isDefault: true`.

| Feit | Waarde |
|---|---|
| `instrumentId` | `t4p-business-kompas` |
| Naam | T4P Business Kompas |
| Versie | 1.0.0 |
| Secties | 2 — `main` en `connection` |
| Blokken in `main` | 34 |
| Items in `main` | 136 |
| Type `main` | `forced-choice-with-energy` |
| Type `connection` | `numeric-scale`, 4 vragen |

Instructie bij `main`, woordelijk: "Kies per blok de meest en minst herkenbare
uitspraak; geef daarna energie (op itemniveau voor drivers, op blokniveau voor de
overige families)."

### 1.1 De drie families en hun constructen

| Familie | Aantal | Constructen | Energiemodus | Blokken |
|---|---|---|---|---|
| Drivers | 5 | Be Perfect, Be Strong, Hurry Up, Please Others, Try Hard | `item` | 10 |
| Talent-foci | 5 | Innovatie, Inter-relationeel, Operationeel, Strategie, TaPas-Beeld | `block` | 10 |
| Talent-versnellers | 6 | Analyse, Coaching, Constructief onderscheidend, Faciliteren, Impact, Resultaatgericht | `block` | 14 |

De energiemodus is bepalend: bij drivers wordt energie **per item** bevraagd
(alleen bij de gekozen meest en minst), bij de andere twee families **per blok**.

### 1.2 De sectie organisatieverbondenheid

Vier vragen op een schaal 0 tot 10, gekoppeld via `linkKey: "respondentCode"`:

| Id | Label |
|---|---|
| q1 | Psychologische verbondenheid |
| q2 | Billijkheid / verloning |
| q3 | Zelfinvestering |
| q4 | Organisatie-investering |

### 1.3 Antwoordschalen

Bron: `server/data/instrument.json` → `responseScales`.

| Schaal | Bereik |
|---|---|
| `energy` | ordinaal, −2 tot +2 |
| `connection0to10` | 0 tot 10 |
| `baselineEnergy0to10` | 0 tot 10 |

Labels van `energy`: −2 "Kost veel energie", −1 "Kost eerder energie", 0
"Neutraal", +1 "Geeft eerder energie", +2 (bovengrens).

---

## 2. De scoring

Bron: `server/scoring.ts` (340 regels).

### 2.1 Per construct — `aggregate`, r73-159

| Veld | Berekening | Regel |
|---|---|---|
| `shown` | aantal keren dat het construct in een blok voorkwam | r99 |
| `most` | aantal keren gekozen als meest herkenbaar | r101 |
| `least` | aantal keren gekozen als minst herkenbaar | r113 |
| `net` | **`most − least`** | r138 |
| `avgEnergy` | gemiddelde van de verzamelde energiewaarden, op 2 decimalen; **0 wanneer er geen zijn** | r140-142 |
| `energySource` | `"item"`, `"block"`, `"item+block"` of `"geen"` | r145 |

`net` is dus een **ipsatief** getal: het ontstaat uit een keuze binnen een blok.
Het zegt hoe constructen zich bij deze persoon onderling verhouden.

Let op de terugval op r140-142: geen energiewaarden geeft `avgEnergy = 0`, en
`0` is op de itemschaal (−2..+2) het label "Neutraal". Een niet-gemeten energie
en een neutraal gemeten energie leveden hier hetzelfde getal op.

### 2.2 Drivers — `driverRisk`, r166-174

1. Drivers sorteren op `net`, aflopend.
2. De **top 2** nemen.
3. `avg` = gemiddelde van de `avgEnergy` van die twee, op 2 decimalen.

| Label | Voorwaarde | Regel |
|---|---|---|
| `hoog` | `avg <= -1` | r172 |
| `matig` | `avg < 0 && avg > -1` | r171 |
| `laag` | in alle andere gevallen | r170 |

Bij `avg === 0` of hoger is het label dus `laag`.

### 2.3 Consistentie — `consistencyMetrics`, r182-221

`score = round(indexBase + driverPart + spreadPart)`, geklemd op 0 tot 100
(r216).

| Deel | Formule | Maximum | Regel |
|---|---|---|---|
| keuzeparen | `(choicePairs / 34) * 40` | 40 | r207 |
| energie aanwezig | `(energyPresence / 34) * 30` | 30 | r207 |
| `driverPart` | `(aligned / topDrivers.length) * 20` | 20 | r209 |
| `spreadPart` | `max(0, 10 − min(10, energySpread))` | 10 | r210 |

- `choicePairs` = blokken met zowel een most als een least (r184).
- `aligned` = van de **top 3** drivers op `net`, het aantal met `avgEnergy >= 0`
  (r201-205).
- `energySpread` = som van `|avgEnergy|` over **alle** drivers (r197-200).

| Label | Voorwaarde | Regel |
|---|---|---|
| `hoog` | `score >= 80` | r213 |
| `middelmatig` | `score >= 60` | r214 |
| `laag` | daaronder | r212 |

Merk op dat `spreadPart` **hoger** is bij een kleinere spreiding: wie op alle
drivers uitgesproken energie meldt, verliest punten op dit deel. Het is geen
maat voor de persoon maar voor de innerlijke samenhang van de antwoorden.

### 2.4 Het geheel — `buildMainScores`, r242-269

| Veld | Berekening | Regel |
|---|---|---|
| `completedScreens` | aantal ingevulde blokken | r248 |
| `totalScreens` | 34 | r260 |
| `totalChoices` | `completedScreens * 3` | r261 |
| `averageEnergy` | gemiddelde `avgEnergy` over **alle** constructen | r250-253 |
| `normalizedQuestionnaireEnergy` | `energieNaarTienschaal(averageEnergy)` | r255 |
| `energyDiscrepancy` | **`baseline − normalized`** | r256 |

`baseline` is de zelfgemelde beroepsenergie op de schaal 0-10
(`baselineEnergy0to10`). De discrepantie is dus positief wanneer iemand zichzelf
hoger inschat dan uit de vragenlijst volgt.

### 2.5 De energieschaal

Bron: `shared/energie-schaal.ts` — uitdrukkelijk "de enige bron van waarheid".

`energieNaarTienschaal(x)`: herschaling van −2..+2 naar 0..10, afgerond op 2
decimalen. **−2 wordt 0, 0 wordt 5, +2 wordt 10.** Dit is rekenkunde, geen
conventie.

De banden zijn dat wél:

| Band | Vanaf |
|---|---|
| `hoog` | 7,5 |
| `stevig` | 5 |
| `wisselend` | 3 |
| `kwetsbaar` | daaronder |

De driedeling `hoog` / `midden` / `laag` is een **samenvoeging** zonder eigen
getallen: `wisselend` en `kwetsbaar` worden samen `laag`.

`ENERGIE_TERUGVAL = 5` is de waarde bij ontbrekende meting, en woordelijk uit het
bestand: "CONVENTIE, GEEN METING. (...) een terugval op deze waarde betekent
niet dat er iets gemeten is."

**Woordelijk uit `shared/energie-schaal.ts`, over alle drie de bandgrenzen:**
"Alle grenzen hieronder zijn conventies van de ontwikkelaar. Ze zijn NIET
empirisch geijkt op een normgroep (...) Er bestaat geen onderzoek waaruit volgt
dat een 7,4 wezenlijk anders is dan een 7,6."

Dit is de reden dat vier plaatsen in het platform vroeger elk een andere
knipverdeling gebruikten (dashboard 7,5/6/4,5; rapport 7,5/5/3; T4Sports 7/4,5;
HDD 7,0/5,0) en dezelfde score dus per scherm een ander label kreeg.

### 2.6 Afnamekwaliteit

Bron: `server/afnamekwaliteit.ts`.

| Drempel | Waarde |
|---|---|
| `ITEM_TIJDSDREMPEL_MS` | 2000 |
| `AANDEEL_DREMPEL` | 0,15 |
| `MINIMUM_ITEMS_MET_TIJD` | 5 |

Woordelijk uit het bestand: "Uitdrukkelijk geen oordeel over de persoon: de
uitkomst is geen score, geen eigenschap en geen diagnose. Ze zegt alleen iets
over de manier waarop deze ene vragenlijst is ingevuld."

Onder 5 items met tijdgegevens wordt het aandeel wél berekend maar **nooit een
vlag gezet**. Afnames van voor de invoering van de tijdmeting leveren `null` op:
geen vlag, geen foutmelding.

De 15%-grens is bewust hoog: "liever geen melding dan een onterechte melding."
De 2 seconden komen uit de literatuur over onzorgvuldig invulgedrag.

---

## 3. Wat er aan onderzoek is, en wat niet

Bron: `shared/onderbouwing-t4professional.ts` — woordelijk afgewogen tekst, met
in het bestand de instructie die niet te wijzigen zonder dezelfde afweging.

### 3.1 Aanwezig

- Exploratieve factoranalyse op **1.858** T4Professional-profielen en **395**
  profielen van het sportinstrument, met de Universiteit Antwerpen (prof. dr.
  Guido Van Hal, prof. dr. Stefan Van Dongen).
- Factorladingen **driverschalen 0,90–0,97**; **energieschalen onder de
  talentversnellers 0,63–0,84**.
- Extractiemodel, fit-indices en volledige factormatrix zijn **niet
  gepubliceerd**; de analyse is **exploratief en niet extern gepubliceerd**.
- Externe inhoudsvalidatie door **vier onafhankelijke experts** (twee Vlaamse,
  twee Nederlandse) onder supervisie van prof. dr. Peter Theuns (VUB, Methoden
  in de Psychologie). Bevindingen **niet als afzonderlijk rapport gepubliceerd**.
- Statistische vormgeving nagekeken door sectorfonds **IVOC**.

### 3.2 Ontbreekt

- Geen betrouwbaarheidscoëfficiënt (Cronbachs alfa, McDonalds omega) berekend of
  gerapporteerd.
- Geen test-hertestonderzoek; stabiliteit over tijd niet gemeten.
- **Geen normgroep.** Interpretatiedrempels zijn vastgesteld op inhoudelijk
  oordeel, niet op een empirische verdeling in een referentiegroep.
- Samenhang met uitkomsten buiten het instrument (functioneren, welbevinden,
  verloop) niet onderzocht.

### 3.3 De claimgrens, woordelijk

"Een T4Professional-profiel is een gespreksinstrument. Het geeft inzichten,
aandachtspunten en richtingaanwijzers. Het is geen beslissingsinstrument en mag
niet als enige basis dienen voor beslissingen over aanwerving, selectie,
promotie of ontslag. Een resultaat is een momentopname op het ogenblik van
afname, geen vaststaand oordeel over iemands mogelijkheden."

---

## 4. Rechtsgrond en bewaring

| Tabel | Kolom | Standaardwaarde | Bron |
|---|---|---|---|
| `afnames` (deelnemer) | `rechtsgrond` | **`toestemming`** | `migrations/0000_beginstand.sql:12`, `shared/schema.ts:45` |
| `bekwaamheid_rondes` (geaccrediteerde) | `rechtsgrond` | **`overeenkomst`** | `migrations/0006_bekwaamheid.sql:157`, `server/bekwaamheid/schema.ts:581` |

Dat verschil is inhoudelijk. Een deelnemer vult vrijwillig in en kan zijn
toestemming intrekken; een geaccrediteerde legt een bekwaamheidsproef af binnen
een licentieovereenkomst. Wie de rechtsgronden verwisselt, belooft een
geaccrediteerde een intrekkingsrecht dat er niet is, of ontzegt een deelnemer een
recht dat hij wel heeft.

Het intrekken van toestemming moet gevolg hebben: `server/storage.ts:2943`,
woordelijk "Zonder rechtsgrond mag..." — de verwerking stopt.

Beide tabellen dragen ook `verwerkingsdoel` en `privacyverklaring_versie`.

---

## 5. De grens met de bestaande STM-vraagbank

`server/routes-stm.ts:61` bevat `VRAAGBANK`: **30 vragen**, 4 lagen, 5 thema's,
in het bestand aangeduid als "Demo-vraagbank". Ze wordt gebruikt door de
tussentijdse metingen (`VRAAGBANK.filter(v => v.laag === laag)` op r507).

**Geen van deze dertig vraagteksten mag als meetitem in de kennischeck komen.**
De geaccrediteerde heeft ze bij een tussentijdse meting gezien; als meetitem
zouden ze hoge scores opleveren zonder dat er iets gemeten is. Dat is dezelfde
regel als de poort `oefenen → meten` uit `server/bekwaamheid/itembank.ts`, hier
toegepast op bestaande inhoud.

De thematische overlap is werkelijk aanwezig en niet theoretisch. STM-vraag 13
("Een coach mag een TaPas-profiel gebruiken als basis voor een selectiebeslissing")
en STM-vraag 26 ("Een organisatie wil TaPas inzetten als selectie-instrument")
raken precies blok C. Nieuwe items over de claimgrens moeten dus een andere
invalshoek nemen dan die twee.

De volledige lijst van dertig staat in `/tmp/stm-vraagteksten.txt` en wordt in
de test opnieuw uit de brontekst gelezen, niet gekopieerd — een kopie zou
verouderen zodra iemand de STM-bank uitbreidt.

Let ook op het **verschil in sleutelvorm**: `StmVraag.correct_antwoord` is de
volledige antwoordtekst, terwijl de kennischeck de indexletter (A–F) gebruikt.
De twee vormen mogen niet door elkaar lopen.

---

## 6. De blokken van de kennischeck

Bron: draaiboek §4.3, vastgelegd in `server/bekwaamheid/schema.ts` als
`BLOKPLAN`.

| Blok | Naam | Items per afname | Waar de stof staat |
|---|---|---|---|
| A | Constructen | 10 | §1 hierboven |
| B | Scoring en rapportlogica | 6 | §2 hierboven |
| C | Grenzen | 8 | §3 hierboven |
| D | Interpretatiefouten herkennen | 8 | §2 en §3 samen |
| E | Ethiek, consent en GDPR | 8 | §4 hierboven |

C en E zijn samen 40% van de check, opzettelijk: de meeste schade komt niet van
iets niet weten, maar van iets beweren wat je niet mag beweren.

---

## 7. Hoeveel items de bank nodig heeft

Het draaiboek noemt 60 items per instrument in de bank en 40 in een afgenomen
versie. Onder de uitsluitingsregel van blok 4 — een herkansing sluit alle items
uit die deze persoon eerder zag — **is 60 niet genoeg voor twee volle rondes**.
Blok A vraagt 10 items per afname, dus 20 voor twee rondes; met 60 items
evenredig verdeeld komt blok A op 15.

De bank wordt daarom op **80 items** gezet: tweemaal het blokplan, dus A20, B12,
C16, D16, E16. Dat maakt de herkansing werkelijk uitvoerbaar in plaats van
alleen op papier. Het draaiboekgetal 60 is geen bovengrens maar een ondergrens;
80 haalt die ondergrens ruim.

Wie een derde ronde mogelijk wil maken, heeft 120 items nodig. Dat is nu niet
gebouwd en zou bij een derde ronde als tekort per blok gemeld worden, met de
bloknaam erbij — het faalt luid en niet stil.
