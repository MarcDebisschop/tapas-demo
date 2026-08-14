#!/usr/bin/env python3
"""Mutatieproef voor blok 3.

Verandert één kernregel per keer, draait de suite en eist dat ze zakt. Een
mutatie die groen blijft, betekent dat de test die regel niet vastlegt.

Bij blok 2 vond deze proef een echte fout in een nieuwe test. Ze is daarom geen
formaliteit. Elke mutatie wordt byte-identiek teruggedraaid en met `cmp`
gecontroleerd.
"""
import io
import shutil
import subprocess
import sys

SUITE = "tests/bekwaamheid-normprofiel.test.ts"

MUTATIES = [
    (
        "activiteitsdrempel wordt exclusief",
        "server/bekwaamheid/activiteit.ts",
        "    haalt: aantal >= opties.drempel,",
        "    haalt: aantal > opties.drempel,",
    ),
    (
        "de ondergrens van het venster wordt exclusief",
        "server/bekwaamheid/activiteit.ts",
        "    return dag >= vensterVan && dag <= vensterTot;",
        "    return dag > vensterVan && dag <= vensterTot;",
    ),
    (
        "de wegingtolerantie wordt zo ruim dat invoerfouten doorglippen",
        "server/bekwaamheid/normprofiel.ts",
        "export const WEGING_TOLERANTIE = 1e-9;",
        "export const WEGING_TOLERANTIE = 0.1;",
    ),
    (
        "het totaal wordt ook gerekend over een onvolledig dossier",
        "server/bekwaamheid/normprofiel.ts",
        "  if (volledig) {\n    totaal = 0;",
        "  if (true) {\n    totaal = 0;",
    ),
    (
        "de bevriezing houdt een wijziging niet meer tegen",
        "server/bekwaamheid/storage.ts",
        "      if (bestaand.bevrorenOp) {\n        throw new Error(\n          `Normprofiel ${bestaand.instrumentId} versie ${bestaand.versie} is bevroren `",
        "      if (false) {\n        throw new Error(\n          `Normprofiel ${bestaand.instrumentId} versie ${bestaand.versie} is bevroren `",
    ),
    (
        "status nvt gaat weer als openstaand tellen",
        "server/bekwaamheid/normprofiel.ts",
        '    if (stuk.status === "nvt") continue;',
        '    if (stuk.status === "nvt" && false) continue;',
    ),
]


def draai() -> bool:
    """True wanneer de suite groen is."""
    r = subprocess.run(
        ["npx", "vitest", "run", SUITE],
        capture_output=True,
        text=True,
    )
    return "failed" not in r.stdout.lower() and r.returncode == 0


def main() -> int:
    fouten = []
    for naam, pad, oud, nieuw in MUTATIES:
        rug = f"/tmp/mut-{pad.replace('/', '_')}.rug"
        shutil.copy(pad, rug)
        with io.open(pad, encoding="utf-8") as f:
            bron = f.read()
        if bron.count(oud) != 1:
            print(f"OVERGESLAGEN  {naam}: anker komt {bron.count(oud)} keer voor")
            fouten.append(naam)
            continue
        with io.open(pad, "w", encoding="utf-8") as f:
            f.write(bron.replace(oud, nieuw, 1))

        groen = draai()

        shutil.copy(rug, pad)
        gelijk = subprocess.run(["cmp", "-s", pad, rug]).returncode == 0
        if not gelijk:
            print(f"ALARM  {naam}: terugdraaien mislukt")
            return 1

        if groen:
            print(f"LEK    {naam}: suite bleef groen - de test legt dit niet vast")
            fouten.append(naam)
        else:
            print(f"goed   {naam}: suite zakt zoals hij moet")

    print(f"\n{len(MUTATIES) - len(fouten)}/{len(MUTATIES)} mutaties betrapt")
    return 1 if fouten else 0


if __name__ == "__main__":
    sys.exit(main())
