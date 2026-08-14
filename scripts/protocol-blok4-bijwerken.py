#!/usr/bin/env python3
"""Werkt PROTOCOL-BLOK4-METEN.md bij met de itembank en de itemanalyse.

Ankergestuurd met assert op elk anker, want een stille mislukking hier laat een
protocol achter dat iets anders beweert dan de code doet.
"""
import io
from pathlib import Path

PAD = Path("/home/user/workspace/core/docs/PROTOCOL-BLOK4-METEN.md")
tekst = io.open(PAD, encoding="utf-8").read()
oorspronkelijk = tekst

# ---------------------------------------------------------------------------
# 1. Twee open punten sluiten in §8
# ---------------------------------------------------------------------------
OUD_OPEN = """- **De itembank vullen.** Bouwplan §1075: minimaal 40 meetitems per instrument
  voordat blok 4 als afgerond mag gelden. §1107: begin met één instrument, het
  **T4P Business Kompas**.
- **Itemanalyse na 20 afnames.** De velden `p_waarde` en `discriminatie` staan er
  en de uitsluiting werkt; de berekening zelf niet."""

NIEUW_OPEN = """- **De itembank vullen voor de overige instrumenten.** Voor het T4P Business
  Kompas staan er tachtig meetitems; zie §10. Bouwplan §1107 zegt: begin met één
  instrument. De overige instrumenten hebben nog geen item."""

assert tekst.count(OUD_OPEN) == 1, "anker §8 niet gevonden"
tekst = tekst.replace(OUD_OPEN, NIEUW_OPEN)

# ---------------------------------------------------------------------------
# 2. Twee nieuwe hoofdstukken vóór §9 Vervolg
# ---------------------------------------------------------------------------
ANKER_VERVOLG = """---

## 9. Vervolg"""

NIEUW = """---

## 10. De itembank voor het T4P Business Kompas

### 10.1 Wat er staat

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

### 10.2 De bron is één document en niets anders

Elk item verwijst in `bronVerwijzing` naar een paragraaf van
`docs/ITEMBRON-T4P-KENNISCHECK.md`. Dat document is geoogst uit de code:
`shared/instruments/t4p-business-kompas`, `server/scoring.ts`,
`shared/energie-schaal.ts`, `shared/onderbouwing-t4professional.ts` en de
rechtsgronden op `afnames` en `bekwaamheid_rondes`.

Waarom die tussenstap er is: een item dat op een herinnering rust, veroudert
zonder dat iemand het merkt. Een item dat naar een paragraaf verwijst die zelf
naar een regel code verwijst, gaat mee met de code of valt op.

### 10.3 Twee spanningen met het draaiboek, uitdrukkelijk niet stil opgelost

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

### 10.4 Wat er aan de items is gedaan voordat ze in de code kwamen

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

## 11. De itemanalyse

### 11.1 Wat de laag doet

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

### 11.2 Vijf keuzes bij het rekenen

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

### 11.3 De laag sluit niets uit

`analyseerItems` levert per item een advies — `houden`, `te_moeilijk`,
`te_makkelijk`, `keert_om` of `te_weinig_afnames` — met een `grond` in gewone
taal die klaar is om te tonen. `voorgesteldeUitsluitingen` levert de ids waarvoor
de analyse grond ziet.

Dat is een voorstel en geen handeling. Wie het overneemt, zet de ids in
`uitsluiten` bij `keurKennischeckNa` en schrijft er een reden bij. Een laag die
zelf items uit de meting gooit, doet een psychometrische ingreep zonder dat
iemand ervoor tekent. `te_weinig_afnames` is uitdrukkelijk géén uitsluitgrond:
dat is een bevinding over de hoeveelheid gegevens en niet over het item.

### 11.4 De proeven

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

## 9. Vervolg"""

assert tekst.count(ANKER_VERVOLG) == 1, "anker §9 niet gevonden"
tekst = tekst.replace(ANKER_VERVOLG, NIEUW)

# ---------------------------------------------------------------------------
# 3. §2 aanvullen met de twee nieuwe lagen
# ---------------------------------------------------------------------------
assert tekst != oorspronkelijk
io.open(PAD, "w", encoding="utf-8").write(tekst)
print(f"bijgewerkt: {PAD}")
print(f"regels: {len(tekst.splitlines())} (was {len(oorspronkelijk.splitlines())})")
