#!/usr/bin/env python3
"""Mutatieproef op de corpustest.

Een test die altijd groen is, bewijst niets. Deze proef brengt één voor één een
gebrek in het corpus aan en controleert dat tests/bekwaamheid-itemcorpus.test.ts
daarop rood gaat. Na elke mutatie wordt het bestand teruggezet en met cmp
nagekeken dat het werkelijk weer gelijk is aan de rug.

Elke mutatie staat voor een gebrek dat een mens werkelijk kan maken: een sleutel
verkeerd zetten, een item schrappen, een oefenvraag overnemen, een item op de
verkeerde as hangen.
"""
import shutil
import subprocess
import sys
from pathlib import Path

WORTEL = Path(__file__).resolve().parent.parent
DOEL = WORTEL / "server/bekwaamheid/itemcorpus-t4p.ts"
RUG = Path("/tmp/itemcorpus-t4p.ts.rug")
TEST = "tests/bekwaamheid-itemcorpus.test.ts"

# (naam, oud, nieuw) of (naam, oud, nieuw, voorkomen).
#
# Zonder vierde waarde moet het anker exact één keer voorkomen. Met een vierde
# waarde wordt dat voorkomen gemuteerd, geteld vanaf 1. Dat is nodig waar een
# gebrek juist in een veld zit dat elk item heeft: `as`, `gebruik` en
# `bronVerwijzing` staan tachtig keer in het bestand, en een langer anker zou
# breken zodra de tekst van één item verandert.
MUTATIES = [
    (
        "sleutel wijst naar de verkeerde mogelijkheid",
        'stam: "Welke reeks bevat uitsluitend constructen uit de familie Talent-foci van het T4P Business Kompas?",',
        'stam: "Te kort.",',
    ),
    (
        "een item is op de verkeerde as gehangen",
        'as: "weten",',
        'as: "zien",',
        30,
    ),
    (
        "een meetitem is als oefenitem gemarkeerd",
        'gebruik: "meten",',
        'gebruik: "oefenen",',
        44,
    ),
    (
        "een blokletter is verkeerd ingevuld",
        'blok: "E",\n    soort: "juistfout",',
        'blok: "D",\n    soort: "juistfout",',
    ),
    (
        "een toelichting is uitgekleed",
        'toelichtingGoed: "De familie Talent-foci bestaat uit vijf constructen: Innovatie, Inter-relationeel, Operationeel, Strategie en TaPas-Beeld. Ze worden bevraagd met energie op blokniveau.",',
        'toelichtingGoed: "Klopt.",',
    ),
    (
        "een vraag uit de oefenbank is overgenomen",
        'stam: "Hurry Up en Faciliteren zijn beide constructen binnen de familie Drivers.",',
        'stam: "Hoeveel TaPas-foci heeft een standaard T4P Business Kompas-profiel?",',
    ),
    (
        "een verzamelmogelijkheid is als antwoord toegevoegd",
        '"Analyse, Coaching, Faciliteren, Impact, Resultaatgericht.",',
        '"Alle bovenstaande mogelijkheden zijn juist.",',
    ),
    (
        "een bronverwijzing ontbreekt",
        'bronVerwijzing: "ITEMBRON §2.2",',
        'bronVerwijzing: "uit het hoofd",',
        1,
    ),
    (
        "een blok D-item wordt met de wet onderbouwd in plaats van met de code",
        'bronVerwijzing: "ITEMBRON §2.1 en §3.2",',
        'bronVerwijzing: "AVG: doelbinding",',
    ),
    (
        "de laag haalt de databank binnen",
        'import type { ItemInvoer } from "./itembank.js";',
        'import type { ItemInvoer } from "./itembank.js";\nimport Database from "better-sqlite3";',
    ),
    (
        "de laag gaat toeval gebruiken",
        "export const CORPUS_INSTRUMENT",
        "export const KEUZE = Math.random();\nexport const CORPUS_INSTRUMENT",
    ),
    (
        "het bestand verzwijgt dat het gegenereerd is",
        "// Dit bestand is GEGENEREERD. Wijzig het niet met de hand",
        "// Dit bestand is met de hand geschreven. Wijzig het vrij",
    ),
]


def draai_test() -> bool:
    """Waar wanneer de test slaagt."""
    uitkomst = subprocess.run(
        ["npx", "vitest", "run", TEST],
        cwd=WORTEL,
        capture_output=True,
        text=True,
    )
    return uitkomst.returncode == 0


def main() -> int:
    shutil.copy(DOEL, RUG)
    origineel = DOEL.read_text(encoding="utf-8")

    print("Eerst de test op het ongewijzigde bestand.")
    if not draai_test():
        print("  De test is al rood zonder mutatie. Stop.")
        return 1
    print("  groen, zoals verwacht.\n")

    betrapt = 0
    gemist = []
    overgeslagen = []

    for mutatie in MUTATIES:
        naam, oud, nieuw = mutatie[0], mutatie[1], mutatie[2]
        voorkomen = mutatie[3] if len(mutatie) > 3 else None
        aantal = origineel.count(oud)

        if voorkomen is None:
            if aantal != 1:
                print(f"[?] {naam}")
                print(f"    anker komt {aantal} keer voor, niet 1. Overgeslagen.")
                overgeslagen.append(naam)
                continue
            gemuteerd = origineel.replace(oud, nieuw, 1)
        else:
            if aantal < voorkomen:
                print(f"[?] {naam}")
                print(f"    anker komt {aantal} keer voor; voorkomen {voorkomen} "
                      "bestaat niet. Overgeslagen.")
                overgeslagen.append(naam)
                continue
            # Tot en met het gevraagde voorkomen splitsen, daar vervangen, en de
            # rest onaangeroerd weer aanplakken.
            delen = origineel.split(oud)
            gemuteerd = (
                oud.join(delen[:voorkomen]) + nieuw + oud.join(delen[voorkomen:])
            )
            # Twee controles, want een fout hier maakt de hele proef waardeloos:
            # ze zou een gebrek melden dat niet is aangebracht, of een gemis
            # melden terwijl de test wel zou hebben gewerkt.
            if gemuteerd.count(oud) != aantal - 1:
                print(
                    f"[!] {naam}: na de mutatie komt het anker "
                    f"{gemuteerd.count(oud)} keer voor in plaats van {aantal - 1}. Stop."
                )
                return 1
            verwacht = len(origineel) - len(oud) + len(nieuw)
            if len(gemuteerd) != verwacht:
                print(
                    f"[!] {naam}: het bestand is {len(gemuteerd)} tekens lang "
                    f"in plaats van {verwacht}. Stop."
                )
                return 1

        if gemuteerd == origineel:
            print(f"[!] {naam}: de mutatie veranderde niets. Stop.")
            return 1

        DOEL.write_text(gemuteerd, encoding="utf-8")
        geslaagd = draai_test()

        shutil.copy(RUG, DOEL)
        gelijk = subprocess.run(["cmp", "-s", str(DOEL), str(RUG)]).returncode == 0
        if not gelijk:
            print(f"[!] {naam}: terugzetten mislukt. Stop onmiddellijk.")
            return 1

        if geslaagd:
            print(f"[GEMIST]  {naam}")
            gemist.append(naam)
        else:
            print(f"[betrapt] {naam}")
            betrapt += 1

    print()
    print(f"Betrapt: {betrapt} van {len(MUTATIES) - len(overgeslagen)} uitgevoerde mutaties.")
    if overgeslagen:
        print(f"Overgeslagen: {len(overgeslagen)} - {', '.join(overgeslagen)}")
    if gemist:
        print("Niet betrapt:")
        for naam in gemist:
            print(f"  - {naam}")
        return 1

    laatste = subprocess.run(["cmp", "-s", str(DOEL), str(RUG)]).returncode == 0
    print(f"Bestand gelijk aan de rug: {'ja' if laatste else 'NEE'}")
    return 0 if laatste else 1


if __name__ == "__main__":
    sys.exit(main())
