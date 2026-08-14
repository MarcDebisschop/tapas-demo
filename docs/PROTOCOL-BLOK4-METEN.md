# Werkprotocol Blok 4 — Meten: de itembank en de kennischeck

Status: **gesloten voor de laag itembank + kennischeck**. Bewijsstuk 5 en de
schermen 9.1/9.2 zijn in dit blok niet aangeraakt en staan open.

Dit document beschrijft wat er gebouwd is, welke keuzes eronder liggen en met
welke reden, en welke grenzen bewust niet zijn overgestoken. Het is bedoeld voor
wie na ons aan deze code werkt, en voor wie bij een bezwaar moet kunnen
navertellen hoe een score tot stand kwam.

---

## 1. Wat blok 4 moet leveren

Draaiboek §4.3 schrijft de kennischeck voor: 40 items, online, 45 minuten, open
boek, as WETEN, weging 20% van het totaal, drempel 60%. De blokverdeling is
vastgelegd op A10 / B6 / C8 / D8 / E8.

| Blok | Naam | Items |
|---|---|---|
| A | Constructen | 10 |
| B | Scoring en rapportlogica | 6 |
| C | Grenzen | 8 |
| D | Interpretatiefouten herkennen | 8 |
| E | Ethiek, consent en GDPR | 8 |

Blok C en E zijn samen 40% van de check. Dat is opzettelijk: de meeste schade in
dit vak komt niet van iets niet weten, maar van iets beweren wat je niet mag
beweren.

De bank houdt 60 items per instrument aan, waarvan 40 in een afgenomen versie
terechtkomen. Voor herkansingen eist het draaiboek twee equivalente versies.

---

## 2. Wat er gebouwd is

| Pad | Aard | Regels |
|---|---|---|
| `migrations/0008_itemblokken.sql` | nieuw | 121 |
| `server/bekwaamheid/itembank.ts` | nieuw — zuivere laag | 478 |
| `server/bekwaamheid/kennischeck.ts` | nieuw — zuivere laag | 471 |
| `server/bekwaamheid/storage.ts` | uitgebreid met `items` en `itemsets` | 2109 |
| `server/audit-log.ts` | vijf nieuwe acties | 168 |
| `tests/bekwaamheid-itembank.test.ts` | nieuw | 421 |
| `tests/bekwaamheid-kennischeck.test.ts` | nieuw | 570 |
| `tests/bekwaamheid-items-opslag.test.ts` | nieuw | 730 |
| `scripts/mutatieproef-blok4.py` | nieuw | 152 |

De twee zuivere lagen kennen de databank niet. Een bronteksttest weigert
`better-sqlite3`, `express`, `drizzle`, `./storage`, `db.prepare`, `fetch(`,
`new Date`, `Date.now` en `Math.random` in die bestanden. De reden is niet
netheid: een scoringsregel die aan een databankverbinding of aan de klok hangt,
is niet te herbouwen bij een bezwaar over een afname van achttien maanden terug.

### Vijf nieuwe auditacties

`bekwaamheid_item_neergezet` · `bekwaamheid_item_gewijzigd` ·
`bekwaamheid_item_gebruik_gewijzigd` · `bekwaamheid_itemset_samengesteld` ·
`bekwaamheid_itemset_ingeleverd`

Een gebruikswijziging staat los van een inhoudelijke wijziging, omdat bij een
bezwaar over een itemset de eerste vraag altijd is wanneer welk item van status
wisselde — en die vraag mag niet ondersneeuwen in een reeks spelfoutherstellen.

---

## 3. De acht keuzes en hun onderbouwing

### 3.1 Het blok staat in de tabel, niet alleen in een document

Migratie 0008 voegt de kolom `blok` toe aan `bekwaamheid_items`, met twee
CHECK-beperkingen: `blok IN ('A'..'E')` en `blok IS NULL OR "as" = 'weten'`.

De blokverdeling A10/B6/C8/D8/E8 met C+E op 40% is een inhoudelijke eis. Een eis
die alleen in een draaiboek staat, sneuvelt onder tijdsdruk: wie op vrijdag
veertig items moet samenstellen en er acht voor blok C mist, vult aan uit blok A
en niemand ziet het. Staat de eis in de tabel en in de samenstellingslaag, dan
kan dat niet — de samenstelling weigert en noemt het tekort.

De tweede CHECK bestaat omdat een blok alleen betekenis heeft binnen de as WETEN.
Een blok op een item van de as ZORGEN zou stilzwijgend meelopen in een
kennischeck waar het niet hoort.

### 3.2 Open items zijn toegestaan, en de score blijft leeg tot een mens keek

Nakijken levert een gedeeltelijke automatische score plus een lijst items die op
een beoordelaar wachten. Zolang die lijst niet leeg is, is `ruweScore` **`null`**
en niet een tussenstand.

Dit is de kern van `kennischeck.ts`. Een halve score is gevaarlijker dan geen
score: dat getal gaat rechtstreeks naar de asberekening en van daar naar het
totaal, en niets in die keten weet nog dat er items ontbraken. `null` dwingt de
aanroeper te wachten; het bewijsstuk blijft daarmee op openstaand.

### 3.3 De sleutel is de indexletter, niet de antwoordtekst

Bij scenario- en meerkeuze-items is de sleutel `A` tot `F`. Dat sluit aan bij de
draaiboekvoorbeelden ("Sleutel: C") en is ondubbelzinnig. Met de volledige
antwoordtekst als sleutel zou een spelfoutherstel in een optie de sleutel breken
en zou een reeds afgenomen item stil verkeerd gaan rekenen.

### 3.4 Een onbeantwoord item is fout; de noemer krimpt niet

De check is open boek zonder tijdsdruk per item. Zou een onbeantwoord item uit
de noemer verdwijnen, dan wordt overslaan een strategie: wie twijfelt, slaat over
en verhoogt daarmee zijn percentage.

### 3.5 Een uitgesloten item verdwijnt uit de noemer en telt niet als fout

Uitsluiting is de uitkomst van itemanalyse: p < .30 of > .95, of een negatieve
item-restcorrelatie. Dat is een fout van de itemschrijver en niet van de
kandidaat. Als fout meerekenen straft de verkeerde persoon.

Een set waarin élk item is uitgesloten levert `ruweScore = null` op. Delen door
nul zou `Infinity` of `NaN` geven en dat glipt door een reeks berekeningen heen
tot het ergens als score op een scherm staat.

### 3.6 Een gedeeltelijke set wordt geweigerd, met het tekort per blok benoemd

Bij tekort is `gelukt` onwaar, is `itemIds` leeg, en staat er per blok wat
gevraagd en beschikbaar was, inclusief de leesbare bloknaam. De drempel van 60%
is vastgesteld op de verdeling van veertig; een set van 31 items meet iets anders
dan waarvoor die drempel is bepaald.

Een tekort dat je niet kan benoemen, wordt niet gedicht.

### 3.7 Herkansing werkt door uitsluiting, niet door twee vaste versies

`eerdereItemIds(geaccrediteerdeId, bewijsstukNummer)` haalt alle items op die
deze persoon in eerdere rondes werkelijk zag, over alle rondes. Die worden
uitgesloten bij de nieuwe samenstelling.

Dit is strenger dan twee equivalente versies en werkt ook bij een derde ronde.
Met twee vaste versies krijgt wie voor de derde keer opkomt de items van ronde
één opnieuw. De uitsluiting hoort bij de kandidaat en niet bij het instrument:
zou ze over alle personen lopen, dan raakt de bank na een paar rondes leeg.

### 3.8 Onder de drempel: één blok als zwaartepunt, geen subscores

Draaiboek §4.3 verbiedt subscores per blok voor wie onder de drempel blijft. Blok
B heeft zes items; een percentage op zes items is niet betrouwbaar genoeg om aan
iemand voor te leggen.

`zwaartepuntBlok` geeft daarom één blok met zijn leesbare naam, of `null` bij een
gelijke stand tussen blokken. Geen getal.

---

## 4. De poort

Drie weigeringen staan in de **opslaglaag** en niet alleen in een route, omdat
een migratiescript of een tweede route langs een routecontrole kan.

### 4.1 Een oefenitem wordt nooit een meetitem

De overgangstabel is:

```
oefenen  → verbrand
meten    → oefenen, verbrand
verbrand → (niets)
```

Een oefenitem is inhoudelijk bekend bij wie de oefenset heeft gezien. Als
meetitem zou het hoge scores opleveren zonder dat er iets gemeten is.

`verbrand` is een eindpunt. Verbrand betekent: dit item is publiek geworden, en
dat is niet ongedaan te maken. Wie een verbrand item weer wil gebruiken, schrijft
een nieuw item.

Nieuwe items komen standaard op `oefenen` binnen. Wie een meetitem wil, moet dat
expliciet zeggen — precies één handeling extra, op de plaats waar de beslissing
hoort te vallen.

### 4.2 Een tweede inlevering wordt geweigerd

`leverIn` doet `UPDATE ... WHERE id = ? AND antwoorden IS NULL` en gooit wanneer
`changes === 0`. De weigering zit in de WHERE en niet in een voorafgaande
leesactie, zodat twee gelijktijdige inleveringen niet beide kunnen slagen.

Zonder die weigering kan een kandidaat na het zien van zijn score opnieuw
inleveren, en dan meet de check niet meer wat iemand wist maar hoe vaak hij het
probeerde.

### 4.3 De itemset draagt geen persoonsgegevens

Een test zoekt de payload van de itemset én van het nakijkresultaat af op naam,
e-mail, losse voornaam, losse achternaam en initialen van de kandidaat, en faalt
als er iets in zit. Een naam die er nu insluipt, staat straks in een logregel,
een foutmelding of een uitvoerbestand.

### 4.4 Ook in de tabel

Een tweede samenstelling voor hetzelfde bewijsstuk is onmogelijk door
`UNIQUE (ronde_id, bewijsstuk_nummer)`. Opnieuw samenstellen zou betekenen dat
een kandidaat die de eerste set al zag een nieuwe krijgt — en dan is de eerste
set uitgelekt zonder dat iemand het weet.

---

## 5. Herbouwbaarheid

De samenstelling gebruikt geen `Math.random` maar een schikker met een zaad
(mulberry32). Het zaad staat in de auditregel, samen met het aantal items. Met de
bank en het zaad is een set exact te herbouwen. Zonder het zaad in het logboek
is die herbouw bij een bezwaar niet meer te doen.

Nakijken schrijft niets weg en logt niets. Nakijken en vaststellen mogen niet
dezelfde handeling worden: dan is er geen moment meer waarop een beoordelaar naar
een open item kan kijken vóór er een uitkomst ligt.

De volgorde van `perItem` is gelijk aan de bewaarde `itemIds`, zodat de uitkomst
naast de itemset te leggen is. De databankvolgorde is een andere dan de volgorde
waarin de kandidaat de items zag.

---

## 6. Wat bewust niet getoetst wordt

`valideerItem` toetst de vorm: lengte van stam en toelichtingen, aantal
mogelijkheden, geldigheid van de sleutel, de sleutelvorm per itemsoort. Vier
dingen zijn met opzet **niet** geautomatiseerd, met de reden in het commentaar
bij de code:

- **Strikvragen** — niet af te leiden uit de tekst.
- **Dubbele ontkenningen** — een woordenlijst zou zowel te veel goede items
  afkeuren als de echte gevallen missen.
- **Koppeling aan één gedragsindicator** — een inhoudelijk oordeel.
- **Discriminatie op leesvaardigheid** — vraagt een oordeel over de doelgroep.

Deze vier blijven bij de tegenlezer (draaiboek stap 1.4). Een automatische
controle die ze zou nábootsen, geeft de valse zekerheid dat het tegenlezen
overgeslagen kan worden.

---

## 7. De proeven

### 7.1 Nulmeting en sluitmeting

| Maat | Nulmeting | Sluitmeting |
|---|---|---|
| Gewijzigde bestaande bestanden | 11 | **11** |
| Geschrapte regels | 44 | **44** |
| Typefouten (genormaliseerd) | 72 | **72, identieke lijst** |
| Testbestanden / tests | 174 / 1989 | **177 / 2111, alles groen** |
| Tabellen | 66 | 66 |

De bestandsgrens van elf is niet verruimd. `server/bekwaamheid/itembank.ts`,
`kennischeck.ts`, `storage.ts` en `schema.ts` zijn nieuwe bestanden en tellen
niet mee. Een scherm of route voor blok 4 zou verruiming vragen; dat is een vraag
en geen aanname.

Rijverschillen, beide verklaard:

- `migratie_register` **+1** — migratie 0008 is toegepast.
- `gdpr_audit_log` **+1 per volle testrun** — `ruimVerstrekenIntakesOp()` in
  `server/prive-aankoop/bewaartermijn.ts:60`, aangeroepen uit
  `tests/gdpr-verbeteringen.test.ts:113`, actie `prive_intake_anonimisering`.

`bekwaamheid_items` staat op **0**. Dat is het hoofdrisico van bouwplan §1073:
"de itembank blijft leeg". De machine is er; de items nog niet.

**Bij het normaliseren van de typefoutenlijst moeten beide zijden identiek
behandeld worden:** eerst `grep "error TS"`, dan
`grep -oE "^[^ ]+\([0-9]+,[0-9]+\): error TS[0-9]+" | sort`. Zonder die tweede
stap verschijnen drie schijnverschillen in `server/routes-deelnemer.ts`.

### 7.2 Mutatieproef

`python3 scripts/mutatieproef-blok4.py` — **12/12 mutaties betrapt**. Elke
mutatie verandert werkelijk gedrag en niet alleen vorm; elke mutatie wordt
byte-identiek teruggedraaid en met `cmp` gecontroleerd. Een anker dat niet exact
één keer voorkomt, wordt als fout gemeld en niet uitgevoerd.

| Mutatie | Betrapt |
|---|---|
| de weg van oefenen naar meten gaat open | ja |
| een verbrand item mag weer meetitem worden | ja |
| een oefenitem gaat als meetbaar tellen | ja |
| de ondergrens van de vraagtekst verdwijnt vrijwel | ja |
| het aantal mogelijkheden wordt onbegrensd | ja |
| een set met een onbeoordeeld open item heet toch volledig | ja |
| er komt een halve score terwijl een mens nog moet kijken | ja |
| een gelijke stand levert alsnog één zwaartepunt op | ja |
| een tekort per blok houdt de samenstelling niet meer tegen | ja |
| een tweede inlevering wordt aangenomen | ja |
| de versie stijgt niet meer bij een inhoudelijke wijziging | ja |
| eerder geziene items worden bij een herkansing niet uitgesloten | ja |

---

## 8. Wat open blijft

Binnen blok 4, nog niet aangeraakt:

- **Bewijsstuk 5** en de bijhorende route.
- **Scherm 9.1** `/coach/bekwaamheid` en **9.2**
  `/coach/bekwaamheid/ronde/:id` — de afnameweg voor de kandidaat. Vraagt
  verruiming van de bestandsgrens.
- **De itembank vullen voor de overige instrumenten.** Voor het T4P Business
  Kompas staan er tachtig meetitems; zie §9. Bouwplan §1107 zegt: begin met één
  instrument. De overige instrumenten hebben nog geen item.

Permanent buiten bereik, met reden: opnames van feedbackgesprekken (in geen
vorm, geen uploadveld), een Angoff-invoermodule, inhoudelijke
bezwaarbehandeling, en de menselijke beslissing zelf.

---

## 9. De itembank voor het T4P Business Kompas

### 9.1 Wat er staat

Tachtig meetitems op de as WETEN, verdeeld over de vijf blokken:

| Blok | Naam | In de bank | Volle check | Verkorte check |
| --- | --- | --- | --- | --- |
| A | Constructen | 20 | 10 | 5 |
| B | Scoring en rapportlogica | 12 | 6 | 3 |
| C | Grenzen | 16 | 8 | 4 |
| D | Interpretatiefouten herkennen | 16 | 8 | 4 |
| E | Ethiek, consent en GDPR | 16 | 8 | 4 |
| | **totaal** | **80** | **40** | **20** |

Naar soort: 42 scenario, 31 meerkeuze, 7 juistfout. Geen open items in deze
eerste vulling; de laag ondersteunt ze wel.

De items staan in `server/bekwaamheid/itemcorpus-t4p.ts`. Dat bestand is
**gegenereerd** uit `itemcorpus-t4p.json` met `scripts/genereer-corpus-ts.py` en
wordt niet met de hand gewijzigd.

### 9.2 De twee toegestane bronnen

Elk item draagt in `bronVerwijzing` een van twee toegestane bronnen, en niet meer
dan die twee. De blokken A tot D verwijzen **uitsluitend** naar een paragraaf van
`docs/ITEMBRON-T4P-KENNISCHECK.md`: die vier blokken beschrijven hoe dit platform
werkt, en een wetsverwijzing daar zou betekenen dat het item iets toetst wat niet
uit de code volgt. Zes items in blok E verwijzen naar de AVG zelf, omdat de wet
voor de algemene beginselen daar de maatstaf is en niet de code. Beide regels
staan vast in `tests/bekwaamheid-itemcorpus.test.ts`.

Het brondossier is geoogst uit de code:
`shared/instruments/t4p-business-kompas`, `server/scoring.ts`,
`shared/energie-schaal.ts`, `shared/onderbouwing-t4professional.ts` en de
rechtsgronden op `afnames` en `bekwaamheid_rondes`.

Waarom die tussenstap er is: een item dat op een herinnering rust, veroudert
zonder dat iemand het merkt. Een item dat naar een paragraaf verwijst die zelf
naar een regel code verwijst, gaat mee met de code of valt op.

### 9.3 Twee spanningen met het draaiboek, uitdrukkelijk niet stil opgelost

**Tachtig items waar het draaiboek zestig zegt.** Draaiboek §4.3 vraagt zestig
items per instrument en twee equivalente versies voor herkansingen. Die twee
eisen gaan bij zestig niet samen. Blok A vraagt tien items per check; twee
versies zonder overlap vragen dus twintig blok-A-items, en het volle blokplan
vraagt tweemaal veertig. Zestig items leveren geen tweede volle ronde onder de
uitsluitingsregel van §4. Tachtig is het kleinste aantal dat beide eisen haalt.
Het draaiboek is hier niet gevolgd maar overtroffen; dat is een wijziging van
een vastgelegd getal en hoort als zodanig te worden vastgesteld.

**De dertig oefenvragen uit de STM blijven buiten de bank.** `server/routes-stm.ts`
bevat een vraagbank van dertig vragen die de geaccrediteerde als oefenstof
krijgt. De stof overlapt werkelijk: STM-vraag 13 en 26 gaan over TaPas als
selectie-instrument, en dat is blok C. Geen van die dertig is meetitem geworden.
De grond is de eigen poortregel uit `itembank.ts`: `oefenen → meten` is geen
toegestane overgang, want een item dat als oefening is gezien, levert bij meting
een hoge score zonder iets te meten. `tests/bekwaamheid-itemcorpus.test.ts` leest
de dertig vraagteksten **uit de brontekst** — niet uit een kopie, want een kopie
veroudert — en weigert bij een woordoverlap van 0,70 of meer.

### 9.4 Wat er aan de items is gedaan voordat ze in de code kwamen

Vier ingrepen, elk met een grond die in `scripts/corrigeer-items.py` en
`scripts/tegenlezing-verwerken.py` staat:

1. **Eén spiegelitem vervangen.** Twee blok-A-items gingen beide over
   factorladingen; samen in één check geven ze elkaar het antwoord. Het
   vervangende item toetst de vijf Talent-foci — een echt gat, want blok A heet
   Constructen en toetste die namen nergens.
2. **Twee juistfout-items omgekeerd.** Alle vier de juistfout-items van blok A
   hadden sleutel "juist". Wie overal "juist" antwoordde, kreeg ze gratis.
3. **De antwoordvolgorde deterministisch herschikt.** 68 items herschikt; vijf
   items met getalopties ongemoeid, want daar is oplopende orde de leesbare orde
   en de kandidaat moet toch rekenen. De sleutelverdeling is nu A17 B19 C19 D18,
   met juist 3 en onjuist 4, en per blok vlak.
4. **Drie bevindingen uit de tegenlezing verwerkt.** Draaiboek stap 1.4 eist
   tegenlezing door een ander. Blok A, B en E leverden nul bevindingen. Twee
   blok-C-items hadden een tweede juist antwoord onder de afleiders; bij één
   blok-D-item vroeg de stam iets anders dan de opties beantwoordden.

Eén absurde afleider is eerder al weggehaald: "Alleen de kleur van het rapport
bepaalt of de AVG van toepassing is". Een afleider die niemand kiest, verkort de
vraag van vier mogelijkheden naar drie.

---

## 10. De itemanalyse

### 10.1 Wat de laag doet

`server/bekwaamheid/itemanalyse.ts` rekent over een reeks afnames per item twee
maten uit: de p-waarde en de item-restcorrelatie. De laag raakt geen databank,
geen Express, geen klok en geen toeval aan — dezelfde eis als bij `itembank.ts`,
`kennischeck.ts`, `normprofiel.ts` en `beslisregels.ts`, en om dezelfde reden:
bij een bezwaar moet de uitkomst uit de invoer volgen en nergens anders uit.

| Grens | Waarde | Herkomst |
| --- | --- | --- |
| `AFNAMEMINIMUM` | 20 | Draaiboek §4.3: itemanalyse na 20 afnames |
| `P_ONDERGRENS` | 0,30 | Protocol §4: p < .30 is uitsluitgrond |
| `P_BOVENGRENS` | 0,95 | Protocol §4: p > .95 is uitsluitgrond |

### 10.2 Vijf keuzes bij het rekenen

**De correlatie is item-rest en niet item-totaal.** Een item correleert altijd
met een totaal waarin het zelf zit; bij veertig items helpt die vertekening
juist de zwakste items er nog net door. Het draaiboek zegt daarom
"item-restcorrelatie". Het verschil is niet cosmetisch: een omgekeerd werkend
item wordt met item-totaal minder makkelijk opgemerkt. De mutatieproef betrapt
deze verwisseling.

**Het minimum geldt ook per item, niet alleen per check.** Bij twee equivalente
versies komt elk item in ongeveer de helft van de afnames voor. Twintig afnames
kunnen dus tien meetbare waarnemingen per item betekenen. De grens geldt daarom
per item; dat een tweede versie langer duurt, is geen reden om de grens te
verlagen.

**De noemer van p is het aantal meetbare afnames.** Een item dat bij het
nakijken al buiten de meting bleef — uitgesloten of nog wachtend op een mens —
hoort niet in die noemer. Dat is dezelfde regel als bij het nakijken zelf. Twee
lagen die hier verschillend rekenen, geven twee getallen die beide "p" heten.

**Een correlatie die niet te berekenen is, blijft leeg.** Bij een item dat
iedereen goed heeft, is de noemer nul. Nul teruggeven zou "geen samenhang"
beweren waar "niet te bepalen" hoort te staan, en die twee leiden tot een ander
besluit. `redenGeenDiscriminatie` zegt in gewone taal waarom het veld leeg is.

**De grenzen zijn strikt, zoals ze in het draaiboek staan.** Een item met p
precies 0,30 haalt de grens en blijft dus staan. Wie de grens als "≤" leest,
sluit items uit die het draaiboek wil houden, en het verschil is in de uitkomst
niet zichtbaar. Hetzelfde geldt voor de correlatie: het draaiboek zegt
"negatieve item-restcorrelatie", en nul is niet negatief.

### 10.3 De laag sluit niets uit

`analyseerItems` levert per item een advies — `houden`, `te_moeilijk`,
`te_makkelijk`, `keert_om` of `te_weinig_afnames` — met een `grond` in gewone
taal die klaar is om te tonen. `voorgesteldeUitsluitingen` levert de ids waarvoor
de analyse grond ziet.

Dat is een voorstel en geen handeling. Wie het overneemt, zet de ids in
`uitsluiten` bij `keurKennischeckNa` en schrijft er een reden bij. Een laag die
zelf items uit de meting gooit, doet een psychometrische ingreep zonder dat
iemand ervoor tekent. `te_weinig_afnames` is uitdrukkelijk géén uitsluitgrond:
dat is een bevinding over de hoeveelheid gegevens en niet over het item.

### 10.4 De proeven

| Proef | Uitkomst |
| --- | --- |
| `tests/bekwaamheid-itemcorpus.test.ts` | 27 tests groen |
| `tests/bekwaamheid-itemanalyse.test.ts` | 38 tests groen |
| Verwachtingen onafhankelijk nagerekend | 8 gevallen, buiten de TS-code om |
| `scripts/mutatieproef-blok4-corpus.py` | 12 van 12 betrapt |
| `scripts/mutatieproef-blok4-itemanalyse.py` | 15 van 15 betrapt |

De verwachte p-waarden en correlaties in de test zijn met de hand nagerekend en
daarna onafhankelijk gecontroleerd met een tweede berekening buiten de
TypeScript-code om. Een test die de eigen implementatie napraat, bewijst niets.

Beide mutatieproeven zetten het bestand na elke mutatie terug en controleren met
`cmp` dat het werkelijk gelijk is aan de rug. De proef op de itemanalyse bevat
de vergissingen die in psychometrische code voorkomen zonder één foutmelding te
geven: rest vervangen door totaal, een strikte grens die inclusief wordt, een
lege correlatie die nul wordt, en een minimum dat stil wegvalt.

---

## 11. Vervolg

Blok 5 — Beoordelen. Daar komt de weg samen: `keurNa` levert een
`ruweScore` die op een bewijsstuk terechtkomt, en de asberekening en de drempels
uit blok 3 doen de rest. De poort op de beoordelaarsroute
(`/beoordeel/bewijsstuk/:id`, geen persoonsgegevens in de payload) hoort daar.
