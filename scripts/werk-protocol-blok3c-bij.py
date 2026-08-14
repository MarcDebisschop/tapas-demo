#!/usr/bin/env python3
"""
Ankergestuurde bijwerking van het werkprotocol voor blok 3, laag 3.

Waarom een script en geen tekstbewerking: het gereedschap valt op samengestelde
accenttekens in Nederlands proza. Een anker dat in het bestand exact één keer
voorkomt, plus een harde assertie, is hier de veiliger weg.
"""

import io
import os
import sys

WORTEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAD = os.path.join(WORTEL, "docs", "PROTOCOL-BLOK3-NORMPROFIEL.md")


def vervang_een(s: str, anker: str, nieuw: str, naam: str) -> str:
    n = s.count(anker)
    if n != 1:
        print(f"FOUT: anker '{naam}' komt {n}x voor, verwacht 1x")
        sys.exit(1)
    return s.replace(anker, nieuw, 1)


s = io.open(PAD, encoding="utf-8").read()

# --- 1. de kop -------------------------------------------------------------
s = vervang_een(
    s,
    "Bekwaamheidsmodule Tapas CORE \u00b7 laag 1 en laag 2 \u00b7 13 augustus 2026",
    "Bekwaamheidsmodule Tapas CORE \u00b7 laag 1, laag 2 en laag 3 \u00b7 13 augustus 2026",
    "kop",
)

s = vervang_een(
    s,
    """Blok 3 is bewust in twee lagen gesplitst en beide zijn nu af en gemeten. Laag 1
is de rekenkern: validatie van de cesuur, asscores en activiteit. Laag 2 is de
beslismachine `beslisregels.ts`, met de migratie die het beslisvocabulaire
gelijktrekt met het draaiboek. De keuze achter dat vocabulaire staat in sectie 6;
wat er nog open blijft, staat in sectie 12.""",
    """Blok 3 is bewust in drie lagen gesplitst en alle drie zijn nu af en gemeten.
Laag 1 is de rekenkern: validatie van de cesuur, asscores en activiteit. Laag 2 is
de beslismachine `beslisregels.ts`, met de migratie die het beslisvocabulaire
gelijktrekt met het draaiboek. Laag 3 is de weg naar buiten: de drie schrijfwegen
als webadres en scherm 9.5 erboven. De keuze achter het vocabulaire staat in
sectie 6; wat er nog open blijft, staat in sectie 12.""",
    "inleiding",
)

# --- 2. de bouwtabel -------------------------------------------------------
s = vervang_een(
    s,
    "| `scripts/mutatieproef-blok3b.py` | nieuw | meetgereedschap laag 2 |",
    """| `scripts/mutatieproef-blok3b.py` | nieuw | meetgereedschap laag 2 |
| `server/bekwaamheid/routes-normprofiel.ts` | nieuw | 335 regels — de drie schrijfwegen plus twee leeswegen |
| `client/src/pages/admin-bekwaamheid-normprofiel.tsx` | nieuw | 859 regels — scherm 9.5 |
| `tests/bekwaamheid-normprofiel-routes.test.ts` | nieuw | 41 tests door het echte webadres |
| `server/routes.ts` | bestaand bestand nr. 10 | +9 regels — registratie van de routes |
| `client/src/App.tsx` | bestaand bestand nr. 11 | +2 regels — import en route |
| `scripts/mutatieproef-blok3c.py` | nieuw | meetgereedschap laag 3 |""",
    "bouwtabel",
)

s = vervang_een(
    s,
    """De bestandsgrens van negen is **niet verschoven**. Alle drie de bestaande
bestanden in deze tabel stonden al in de negen; er is geen tiende bestaand
bestand aangeraakt. Nagemeten met `git status` v\u00f3\u00f3r en n\u00e1 het werk.""",
    """De bestandsgrens stond op negen voor laag 1 en laag 2 en is voor laag 3 door Marc
verruimd naar **elf**. De twee erbij zijn `server/routes.ts` en
`client/src/App.tsx`, en dat zijn precies de twee plaatsen waar een nieuwe route
en een nieuw scherm zich moeten aanmelden: zonder die twee regels bestaat het werk
wel, maar is het onbereikbaar. Er is geen twaalfde bestaand bestand aangeraakt.
Nagemeten met `git status` v\u00f3\u00f3r en n\u00e1 het werk; de uitkomst staat in sectie 10.""",
    "grens",
)

# --- 3. nieuwe sectie over laag 3, vlak voor sectie 10 ---------------------
s = vervang_een(
    s,
    "## 10. De metingen",
    """## 9bis. Laag 3 — de drie schrijfwegen en scherm 9.5

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
afgekeurd profiel \u00e9\u00e9n `Error` met alle bevindingen aan elkaar geplakt tot \u00e9\u00e9n
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

Het scherm rekent niet. Er staat geen enkele formule in: of een weging op \u00e9\u00e9n
sluit, of een onderbouwing lang genoeg is, of een drempel binnen bereik valt —
dat beslist de server, en het scherm toont wat er terugkomt. Een formulier dat
zelf meerekent, is een tweede cesuur die stilletjes van de eerste gaat afwijken.

Het maakt de read-only stand niet zelf op. Of iets bevroren is, volgt uit
`bevrorenOp` in het antwoord, niet uit een eigen vlag ernaast.

Het biedt geen weg terug — ook geen verborgene, want er is geen endpoint dat het
zou kunnen.

E\u00e9n kleine keuze verdient vermelding: wie op "nieuwe versie" klikt, krijgt de
waarden van de geldende norm mee, maar met de onderbouwing **leeg**. Wie de lat
verlegt, verantwoordt dat opnieuw en hergebruikt niet de motivering van de vorige
cesuur.

### 9bis.5 De mutatieproef op laag 3

Negen mutaties, waarvan \u00e9\u00e9n blinde. **8 op 8 betrapt, de blinde bleef groen.**

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
`Number`-omzetting vervangt door `parseInt`, want dan wordt `"1abc"` w\u00e9l `1` en
kan een verdwaald adres een echt profiel raken. Die versie wordt betrapt.

De tweede zat in het anker van de blinde: de melding `"Geen geldig
normprofiel-id."` staat tweemaal in het bestand, in de wijzigweg en in de
bevriesweg. Een anker dat tweemaal voorkomt maakt een mutatieproef onbetrouwbaar
zonder dat ze rood wordt. De proef weigert nu zulke ankers en meldt ze; de blinde
is verlegd naar `includes` versus `indexOf(...) !== -1`, semantisch identiek en
uniek in het bestand.

---

## 10. De metingen""",
    "sectie 9bis",
)

# --- 4. de metingentabel ---------------------------------------------------
s = vervang_een(
    s,
    """| Meting | Blok 2 | Laag 1 | Laag 2 |
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
aan de afgesproken grens.""",
    """| Meting | Blok 2 | Laag 1 | Laag 2 | Laag 3 |
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
zegt: het hele blok 3 heeft geen bestaande regel weggehaald.""",
    "metingentabel",
)

# --- 5. rijverschil laag 3 -------------------------------------------------
s = vervang_een(
    s,
    """**Nul** auditrijen met actie `bekwaamheid%`, en **nul** rijen in
`bekwaamheid_beslissingen`. De nieuwe code heeft niets inhoudelijks in de
productiedatabank geschreven.""",
    """**Nul** auditrijen met actie `bekwaamheid%`, en **nul** rijen in
`bekwaamheid_beslissingen`. De nieuwe code heeft niets inhoudelijks in de
productiedatabank geschreven.

Bij laag 3 was er nog **\u00e9\u00e9n** rijverschil over de hele databank: `gdpr_audit_log`
18 \u2192 19, weer die ene `prive_intake_anonimisering` per volle testrun. Alle veertien
`bekwaamheid%`-tabellen staan op nul, `migratie_register` bleef op 8, en er zijn
nul auditrijen met actie `bekwaamheid%`. De routetest draait op `:memory:` en heeft
de echte databank niet aangeraakt — de vier bevries- en wijzigtests op een bevroren
profiel evenmin.""",
    "rijverschil",
)

# --- 6. sectie 11 meetgereedschap -----------------------------------------
s = vervang_een(
    s,
    "## 11. Meetgereedschap",
    "## 11. Meetgereedschap",
    "sectie 11 kop",
)

# --- 7. sectie 12 herschrijven --------------------------------------------
oud12_start = s.index("## 12. Wat blok 3 niet afsluit")
s = (
    s[:oud12_start]
    + """## 12. Wat blok 3 niet afsluit

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
- geen tweede bekrachtiger in de werkstroom (de CHECK dwingt af d\u00e1t het er twee
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
"""
)

io.open(PAD, "w", encoding="utf-8").write(s)
print("OK — protocol bijgewerkt")
print("regels:", s.count("\n") + 1)
