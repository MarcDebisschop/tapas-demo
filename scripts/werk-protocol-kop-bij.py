#!/usr/bin/env python3
"""Werkt de kop en de bestandentabel van het blok-3-protocol bij naar laag 2."""
import io
import sys

PAD = "docs/PROTOCOL-BLOK3-NORMPROFIEL.md"
with io.open(PAD, encoding="utf-8") as f:
    tekst = f.read()

V = [
    (
        "Bekwaamheidsmodule Tapas CORE \u00b7 laag 1 van 2 \u00b7 13 augustus 2026",
        "Bekwaamheidsmodule Tapas CORE \u00b7 laag 1 en laag 2 \u00b7 13 augustus 2026",
    ),
    (
        "Blok 3 is bewust in twee lagen gesplitst. Laag 1 \u2014 de rekenkern \u2014 is af en\n"
        "gemeten. Laag 2 \u2014 de beslismachine `beslisregels.ts` \u2014 staat stil op \u00e9\u00e9n\n"
        "openstaande vraag over het beslisvocabulaire. Die vraag staat in sectie 6.",
        "Blok 3 is bewust in twee lagen gesplitst en beide zijn nu af en gemeten. Laag 1\n"
        "is de rekenkern: validatie van de cesuur, asscores en activiteit. Laag 2 is de\n"
        "beslismachine `beslisregels.ts`, met de migratie die het beslisvocabulaire\n"
        "gelijktrekt met het draaiboek. De keuze achter dat vocabulaire staat in sectie 6;\n"
        "wat er nog open blijft, staat in sectie 12.",
    ),
    (
        "| `tests/bekwaamheid-normprofiel.test.ts` | nieuw | 64 tests |\n"
        "| `scripts/rijtelling.py` | nieuw | meetgereedschap |\n"
        "| `scripts/mutatieproef-blok3.py` | nieuw | meetgereedschap |",
        "| `tests/bekwaamheid-normprofiel.test.ts` | nieuw | 64 tests |\n"
        "| `server/bekwaamheid/beslisregels.ts` | nieuw | 292 regels \u2014 de pure beslismachine |\n"
        "| `server/bekwaamheid/schema.ts` | nieuw bestand | `BESLISUITKOMSTEN` gelijkgetrokken + `VOORSTELBARE_UITKOMSTEN` |\n"
        "| `migrations/0007_beslisuitkomsten.sql` | nieuw | herbouwt `bekwaamheid_beslissingen` |\n"
        "| `server/migratieloper.ts` | bestaand bestand nr. 5 van 9 | +8 regels \u2014 de toets op 0007 |\n"
        "| `tests/migratieloper.test.ts` | bestaand bestand nr. 9 van 9 | +1 test op de eindtoestand na 0007 |\n"
        "| `tests/bekwaamheid-beslisregels.test.ts` | nieuw | 58 tests |\n"
        "| `scripts/rijtelling.py` | nieuw | meetgereedschap |\n"
        "| `scripts/mutatieproef-blok3.py` | nieuw | meetgereedschap laag 1 |\n"
        "| `scripts/proef-migratie-0007.py` | nieuw | meetgereedschap laag 2 |\n"
        "| `scripts/mutatieproef-blok3b.py` | nieuw | meetgereedschap laag 2 |",
    ),
    (
        "De bestandsgrens van negen is **niet verschoven**. `server/audit-log.ts` stond al\n"
        "in de negen sinds blok 2; er is geen tiende bestaand bestand aangeraakt.",
        "De bestandsgrens van negen is **niet verschoven**. Alle drie de bestaande\n"
        "bestanden in deze tabel stonden al in de negen; er is geen tiende bestaand\n"
        "bestand aangeraakt. Nagemeten met `git status` v\u00f3\u00f3r en n\u00e1 het werk.",
    ),
]

SLOT = """
---

## 12. Wat blok 3 niet afsluit

De beslismachine rekent, maar er is nog niets dat haar aanroept. Dat is bewust:
scherm 9.5 en de bijbehorende route zouden bestaande bestanden raken die niet in de
negen staan, en de grens is een afspraak, geen richtlijn. De vraag hoort bij Marc.

Wat er dus nog niet is:

- geen route die `beoordeel()` aanroept en geen scherm dat het voorstel toont;
- geen opslag van beslissingen \u2014 de tabel bestaat, met de juiste CHECK, en is leeg;
- geen tweede bekrachtiger in de werkstroom (de CHECK dwingt af d\u00e1t het er twee
  moeten zijn, maar niets leidt ze door het proces);
- geen debrief en geen publicatie, al staat de ordening ervan al in de CHECK
  `publicatie_na_debrief`.

Dat is blok 5. Blok 4 \u2014 het meten \u2014 komt eerst.
"""

for oud, nieuw in V:
    n = tekst.count(oud)
    if n != 1:
        sys.exit(f"ANKER {n}x, verwacht 1: {oud[:60]!r}")
    tekst = tekst.replace(oud, nieuw, 1)

with io.open(PAD, "w", encoding="utf-8") as f:
    f.write(tekst.rstrip("\n") + "\n" + SLOT)
print("kop bijgewerkt")
