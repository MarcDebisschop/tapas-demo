#!/usr/bin/env python3
"""Werkt docs/PROTOCOL-BLOK3-NORMPROFIEL.md bij voor laag 2.

Met de hand via `edit` gaat dit niet: het document staat vol samengestelde
accenttekens (Beëindigd, wél) waar dat gereedschap op valt. Vandaar een script met
ankers die letterlijk in het bestand voorkomen.
"""
import io
import sys

PAD = "docs/PROTOCOL-BLOK3-NORMPROFIEL.md"

with io.open(PAD, encoding="utf-8") as f:
    tekst = f.read()

vervangingen = []

# --- 1. Het verzonnen getal ---------------------------------------------------
# 0,748 stond nergens in een bron. Ik had het zelf geschreven. Nagerekend met de
# weging 20/30/30/20 geeft [0,59 0,80 0,80 0,80] exact 0,758 en niet 0,748. Het
# bouwplan (r898) schrijft "totaal net boven 0,70 met een as op 0,59"; de test
# gebruikt daarom [0,59 0,70 0,75 0,75] met totaal 0,703.
vervangingen.append((
    "| Totaal 0,748 met een as op 0,59 | totaal haalt, as haalt niet |"
    " de as bindt \u2014 moet zakken |",
    "| Totaal 0,703 met een as op 0,59 | totaal haalt, as haalt niet |"
    " de as bindt \u2014 moet zakken |",
))

# --- 2. Kop van de oude mutatieproef -----------------------------------------
vervangingen.append((
    "## 5. De mutatieproef\n",
    "## 5. De mutatieproef op laag 1\n",
))

# --- 3. Sectie 6 helemaal vervangen ------------------------------------------
oud_zes_begin = "## 6. Openstaand: het beslisvocabulaire"
oud_zes_eind = "## 7. De metingen"
i = tekst.index(oud_zes_begin)
j = tekst.index(oud_zes_eind)

NIEUW = """## 6. Het beslisvocabulaire \u2014 beslist en vastgelegd

Laag 1 sloot met een open vraag: de code en het draaiboek benoemden
**verschillende uitkomsten**, zonder dat er ergens een reden voor was
opgeschreven.

| Draaiboek \u00a75.3 | Code v\u00f3\u00f3r 0007 | Code n\u00e1 0007 |
|---|---|---|
| Bekrachtigd | `bekrachtigd` | `bekrachtigd` |
| Bekrachtigd met aandachtspunt | `bekrachtigd_met_aandachtspunt` | `bekrachtigd_met_aandachtspunt` |
| Voorwaardelijk bekrachtigd | `voorwaardelijk` | `voorwaardelijk` |
| **Opgeschort** | **`herkansing`** | **`opgeschort`** |
| **Be\u00eendigd** | **`niet_bekrachtigd`** | **`beeindigd`** |

Marc heeft de keuze aan mij overgelaten. Ik volg het draaiboek, om vier feitelijke
redenen:

1. `herkansing` staat al in `RONDESOORTEN` als **soort ronde**. Hetzelfde woord
   ook als beslisuitkomst gebruiken maakt van twee verschillende dingen \u00e9\u00e9n term.
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

`server/bekwaamheid/beslisregels.ts` (292 regels) is \u00e9\u00e9n zuivere functie
`beoordeel(invoer)`. Ze kent geen databank, geen klok en geen verzoek.

De regels lopen van zwaar naar licht. De **eerste** die aanslaat is de bindende
regel, en die wordt bij naam in de uitkomst gemeld:

| # | Regel | Voorstel |
|---|---|---|
| 1 | twee of meer assen onder de drempel | `opgeschort` |
| 2 | precies \u00e9\u00e9n as onder de drempel | `voorwaardelijk` |
| 3 | totaal onder de drempel | `voorwaardelijk` |
| 4 | een as in de aandachtszone (drempel \u2264 score \u2264 0,65) | `bekrachtigd_met_aandachtspunt` |
| 5 | administratieve leemte | `bekrachtigd_met_aandachtspunt` |
| 6 | niets van dit alles | `bekrachtigd` |

Drie harde grenzen, elk met een test die ze vasthoudt:

- **Ze stelt voor, ze beslist niet.** De uitkomst heet `Voorstel` en draagt de
  toegepaste regels mee, zodat een mens kan zien waarom.
- **Ze stelt nooit `beeindigd` voor.** Het retourtype is `VoorstelbareUitkomst`,
  de vier zonder `beeindigd`. Be\u00eendiging vereist twee mislukte herkansingen,
  weigering of een integriteitsbreuk: menselijke feiten die niet in asscores
  zitten. De typecontrole maakt dit onmogelijk, niet de goede bedoeling.
- **Ze raakt de accreditatie niet aan.** Bronbewijs: geen van de modules bevat de
  woorden "accreditatie", "ingetrokkenOp" of "ingetrokken_op".

En \u00e9\u00e9n scheiding die het draaiboek uitdrukkelijk eist. De **activiteitsroute**
(`voldoende_activiteit` of `slapend`) is een **apart veld**, nooit een uitkomst.
Draaiboek r391, letterlijk: "Onder de drempel is geen tekortkoming: het is de
trigger voor de route slapende licentie of reactivatie." Een dossier dat nog niet
volledig is, levert `{uitkomst: null, onvolledig: [...]}` \u2014 nooit een lage
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
vier punten: (a) **niets** verwijst naar `bekwaamheid_beslissingen` \u2014 nul treffers
over alle migratiebestanden, alle vijftien vreemde sleutels in 0006 wijzen de
andere kant op; (b) de uitgaande sleutel naar `bekwaamheid_rondes` wordt identiek
herschreven; (c) de loper draait op `server/storage.ts:119`, v\u00f3\u00f3r
`borgDatabankIntegriteit()` op `:1614` die `PRAGMA foreign_keys = ON` zet, dus
afdwinging staat tijdens de migratie uit; (d) alles zit in \u00e9\u00e9n transactie.

**De eerste proef meldde valse OK's.** Met sleutelafdwinging aan vielen de inserts
op de vreemde sleutel, dus "geweigerd" zei niets over de CHECK. De herschreven
proef eist dat de foutmelding de **naam van de beperking** bevat.
`scripts/proef-migratie-0007.py` draait nu de volledige keten \u2014 alle migraties tot
0006, dan een geaccrediteerde, een normprofiel en een ronde \u2014 en meldt **ALLES
GOED** op: de vijf nieuwe waarden aanvaard; `herkansing`, `niet_bekrachtigd`,
`gezakt`, `""` en `BEKRACHTIGD` geweigerd op de genoemde CHECK; de vier andere
CHECKs nog werkzaam; de unieke index en de uitgaande sleutel intact; twaalf
kolommen in dezelfde orde; een bestaande rij ongewijzigd na de herbouw; geen
werktabel achtergebleven; en een oude waarde die de migratie doet vallen.

De geaccrediteerde in die proef wordt met `coach_register_id` ge\u00efdentificeerd en
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
groen m\u00f3\u00e9t blijven. Zonder zo'n blinde meet de proef niet of ze werkelijk kan
onderscheiden.

Twee mutaties vonden een echt gebrek, en dat is de opbrengst:

1. Het anker op de CHECK kwam **tweemaal** voor \u2014 de kolom `voorstel_uitkomst` en
   de kolom `definitieve_uitkomst`. Een mutatieproef die twee plaatsen tegelijk
   raakt, meet niet wat ze denkt te meten. Het anker is verscherpt.
2. **Een echt lek.** De lopertest toetste of de index met die naam best\u00e1\u00e1t. Een
   index die zijn UNIQUE verliest, houdt zijn naam. De test toetst nu via
   `PRAGMA index_list` op de vlag `unique = 1`, en betrapt de mutatie.

---

"""

tekst = tekst[:i] + NIEUW + tekst[j:]

# --- 4. De metingen ----------------------------------------------------------
vervangingen.append(("## 7. De metingen", "## 10. De metingen"))
vervangingen.append(("## 8. Nieuw meetgereedschap", "## 11. Meetgereedschap"))

METING_OUD = """| Meting | Bij sluiting blok 2 | Nu | Verschil |
|---|---|---|---|
| Testbestanden | 171 | 172 | +1 (`bekwaamheid-normprofiel.test.ts`) |
| Tests | 1825 | 1889 | +64, alle groen |
| Typefouten | 72 | 72 | identiek op bestand, regel, kolom en foutcode |
| Gewijzigde bestaande bestanden | 9 | 9 | geen enkel nieuw bestand aangeraakt |
| Verwijderde regels | 44 | 44 | geen enkele regel verwijderd |
| Tabellen | 66 | 66 | \u2014 |
| Gewijzigde rijaantallen | 1 | 1 | `gdpr_audit_log` 15 \u2192 16 |"""

METING_NIEUW = """| Meting | Blok 2 | Laag 1 | Laag 2 |
|---|---|---|---|
| Testbestanden | 171 | 172 | **173** (+1: `bekwaamheid-beslisregels.test.ts`) |
| Tests | 1825 | 1889 | **1948** (+59: 58 nieuwe plus \u00e9\u00e9n in de lopertest) |
| Typefouten | 72 | 72 | **72**, identiek op bestand, regel, kolom en foutcode |
| Gewijzigde bestaande bestanden | 9 | 9 | **9**, dezelfde negen |
| Verwijderde regels | 44 | 44 | **44**, geen enkele regel verwijderd |
| Tabellen | 66 | 66 | **66** |
| Migraties toegepast | 7 | 7 | **8** (0007 is gelopen) |

De negen gewijzigde bestanden zijn ongewijzigd dezelfde negen; laag 2 raakte er
twee van (`server/migratieloper.ts`, `tests/migratieloper.test.ts`) en die stonden
al op de lijst. Al het andere werk zit in nieuwe bestanden, en die kosten niets
aan de afgesproken grens.

Twee rijverschillen in de echte databank, beide verklaard:

- `migratie_register` 7 \u2192 8. Migratie 0007 is bij de testrun toegepast. Dat is de
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
productiedatabank geschreven."""

vervangingen.append((METING_OUD, METING_NIEUW))

GEREEDSCHAP_TOEVOEGING = """
`scripts/proef-migratie-0007.py` draait migratie 0007 op wegwerpdatabanken en toetst
de eindtoestand in plaats van de tekst van de migratie. Ze eist bij elke weigering
de **naam van de beperking** in de foutmelding, omdat een weigering op een vreemde
sleutel er anders uitziet als een geslaagde toets.

`scripts/mutatieproef-blok3b.py` draait negen mutaties op de beslismachine en de
migratie, met \u00e9\u00e9n blinde als controle op de proef zelf.

`scripts/zet-beslisuitkomsten.py` en `scripts/werk-protocol-blok3-bij.py` schrijven
`schema.ts` en dit document op ankers om. Ze bestaan omdat het `edit`-gereedschap
valt op samengestelde accenttekens, die in Nederlands commentaar overal staan.
"""

with io.open(PAD, "w", encoding="utf-8") as f:
    for oud, nieuw in vervangingen:
        n = tekst.count(oud)
        if n != 1:
            sys.exit(f"ANKER {n}x gevonden, verwacht 1: {oud[:70]!r}")
        tekst = tekst.replace(oud, nieuw, 1)
    f.write(tekst.rstrip("\n") + "\n" + GEREEDSCHAP_TOEVOEGING)

print("bijgewerkt")
