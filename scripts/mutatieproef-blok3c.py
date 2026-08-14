#!/usr/bin/env python3
"""
Mutatieproef op de drie schrijfwegen van het normprofiel (blok 3c).

Een test die groen staat bewijst nog niet dat ze iets bewaakt. Deze proef breekt
de code op negen manieren die er in productie echt in kunnen sluipen, en eist dat
de testsuite elke breuk betrapt. De negende mutatie is een BLINDE: een wijziging
die het gedrag niet verandert. Als die ook rood wordt, is de test te streng en
meet ze iets anders dan bedoeld.

Draaien:  python3 scripts/mutatieproef-blok3c.py
"""

import io
import os
import subprocess
import sys

WORTEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROUTES = os.path.join(WORTEL, "server", "bekwaamheid", "routes-normprofiel.ts")
TEST = "tests/bekwaamheid-normprofiel-routes.test.ts"

# (naam, anker, vervanging, verwacht_rood)
MUTATIES = [
    (
        "bewaking valt weg op het neerleggen",
        'app.post("/api/bekwaamheid/normprofiel", vereisAdmin,',
        'app.post("/api/bekwaamheid/normprofiel", (_q, _s, n) => n(),',
        True,
    ),
    (
        "bewaking valt weg op het bevriezen",
        'app.post("/api/bekwaamheid/normprofiel/:id/bevries", vereisAdmin,',
        'app.post("/api/bekwaamheid/normprofiel/:id/bevries", (_q, _s, n) => n(),',
        True,
    ),
    (
        "een bevroren rij levert 400 in plaats van 409",
        "const BEVROREN_STATUS = 409;",
        "const BEVROREN_STATUS = 400;",
        True,
    ),
    (
        "de afkeuring wordt stil doorgelaten",
        "    if (bevindingen.length) {\n      res.status(AFGEKEURD_STATUS).json({",
        "    if (false && bevindingen.length) {\n      res.status(AFGEKEURD_STATUS).json({",
        True,
    ),
    (
        "de bevestiging bij bevriezen wordt niet meer geeist",
        "if (body.bevestigd !== true) {",
        "if (false) {",
        True,
    ),
    (
        "het onbestaande profiel levert geen 404",
        "  if (gaatOverOnbekend(bericht)) {\n    res.status(404)",
        "  if (false) {\n    res.status(404)",
        True,
    ),
    (
        "de beheerder wordt niet meer vastgelegd bij het bevriezen",
        "opslag.normprofielen.bevries(id, adminIdVanSessie(req))",
        "opslag.normprofielen.bevries(id, null)",
        True,
    ),
    (
        "een id met achtervoegsel wordt alsnog aanvaard",
        'if (!/^[0-9]+$/.test(ruw)) return null;\n  const id = Number(ruw);',
        "const id = parseInt(ruw, 10);",
        True,
    ),
    # --- de blinde --------------------------------------------------------
    # Semantisch identiek: `includes` en `indexOf(...) !== -1` doen hetzelfde.
    # Wordt deze rood, dan toetst de suite de vorm van de code in plaats van
    # het gedrag, en zegt de rest van deze proef minder dan ze lijkt.
    (
        "BLINDE: dezelfde zoekopdracht, andere schrijfwijze",
        'return bericht.includes("bevroren");',
        'return bericht.indexOf("bevroren") !== -1;',
        False,
    ),
]


def draai_test() -> bool:
    """True wanneer de testsuite groen is."""
    uit = subprocess.run(
        ["npx", "vitest", "run", TEST],
        cwd=WORTEL,
        capture_output=True,
        text=True,
    )
    return uit.returncode == 0


def main() -> int:
    origineel = io.open(ROUTES, encoding="utf-8").read()

    print("Nulmeting: de suite moet groen zijn zonder mutatie.")
    if not draai_test():
        print("  MISLUKT — de suite is niet groen. De proef zegt niets.")
        return 1
    print("  groen.\n")

    betrapt = 0
    te_betrappen = sum(1 for m in MUTATIES if m[3])
    fouten = []

    for naam, anker, vervanging, verwacht_rood in MUTATIES:
        if anker not in origineel:
            fouten.append(f"anker niet gevonden: {naam}")
            print(f"[?] {naam}\n    ANKER NIET GEVONDEN")
            continue
        if origineel.count(anker) != 1:
            fouten.append(f"anker {origineel.count(anker)}x aanwezig: {naam}")
            print(f"[?] {naam}\n    ANKER {origineel.count(anker)}x AANWEZIG")
            continue

        gemuteerd = origineel.replace(anker, vervanging, 1)
        io.open(ROUTES, "w", encoding="utf-8").write(gemuteerd)
        try:
            groen = draai_test()
        finally:
            io.open(ROUTES, "w", encoding="utf-8").write(origineel)

        rood = not groen
        if verwacht_rood:
            if rood:
                betrapt += 1
                print(f"[v] betrapt: {naam}")
            else:
                fouten.append(f"NIET betrapt: {naam}")
                print(f"[X] NIET BETRAPT: {naam}")
        else:
            if rood:
                fouten.append(f"blinde werd rood: {naam}")
                print(f"[X] BLINDE WERD ROOD: {naam}")
            else:
                print(f"[v] blinde bleef groen: {naam}")

    print(f"\nBetrapt: {betrapt}/{te_betrappen}")
    if fouten:
        print("PROBLEMEN:")
        for f in fouten:
            print(f"  - {f}")
        return 1
    print("ALLES GOED — elke breuk betrapt, de blinde bleef groen.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
