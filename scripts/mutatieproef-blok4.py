#!/usr/bin/env python3
"""Mutatieproef voor blok 4: de itembank en de kennischeck.

Verandert één kernregel per keer, draait de drie suites van blok 4 en eist dat
ze zakken. Een mutatie die groen blijft, betekent dat de tests die regel niet
vastleggen — dan is de test er wel, maar dekt hij het gedrag niet.

Bij blok 2 vond deze proef een echte fout in een nieuwe test. Ze is daarom geen
formaliteit.

Elke mutatie verandert werkelijk gedrag en niet alleen vorm: een drempel wordt
verschoven, een poort wordt opengezet, een noemer wordt anders gerekend. Elke
mutatie wordt byte-identiek teruggedraaid en met `cmp` gecontroleerd. Wanneer
een anker niet exact één keer voorkomt, wordt de mutatie niet uitgevoerd maar
als fout gemeld: een anker dat verschoven is, betekent dat deze proef niet meer
meet wat ze beweert te meten.
"""
import io
import shutil
import subprocess
import sys

SUITES = [
    "tests/bekwaamheid-itembank.test.ts",
    "tests/bekwaamheid-kennischeck.test.ts",
    "tests/bekwaamheid-items-opslag.test.ts",
]

ITEMBANK = "server/bekwaamheid/itembank.ts"
KENNISCHECK = "server/bekwaamheid/kennischeck.ts"
STORAGE = "server/bekwaamheid/storage.ts"

MUTATIES = [
    (
        "de weg van oefenen naar meten gaat open",
        ITEMBANK,
        '  oefenen: ["verbrand"],',
        '  oefenen: ["verbrand", "meten"],',
    ),
    (
        "een verbrand item mag weer meetitem worden",
        ITEMBANK,
        "  verbrand: [],",
        '  verbrand: ["meten", "oefenen"],',
    ),
    (
        "een oefenitem gaat als meetbaar tellen",
        ITEMBANK,
        '  return gebruik === "meten";',
        '  return gebruik !== "verbrand";',
    ),
    (
        "de ondergrens van de vraagtekst verdwijnt vrijwel",
        ITEMBANK,
        "export const STAM_MINIMUM = 20;",
        "export const STAM_MINIMUM = 1;",
    ),
    (
        "het aantal mogelijkheden wordt onbegrensd",
        ITEMBANK,
        "export const OPTIES_MAXIMUM = 6;",
        "export const OPTIES_MAXIMUM = 26;",
    ),
    (
        "een set met een onbeoordeeld open item heet toch volledig",
        KENNISCHECK,
        "  const volledig = wachtOp.length === 0;",
        "  const volledig = true;",
    ),
    (
        "er komt een halve score terwijl een mens nog moet kijken",
        KENNISCHECK,
        "  const ruweScore = volledig && meetbaar > 0 ? goed / meetbaar : null;",
        "  const ruweScore = meetbaar > 0 ? goed / meetbaar : null;",
    ),
    (
        "een gelijke stand levert alsnog één zwaartepunt op",
        KENNISCHECK,
        "  if (hoogste === 0 || kandidaten.length !== 1) {",
        "  if (hoogste === 0) {",
    ),
    (
        "een tekort per blok houdt de samenstelling niet meer tegen",
        KENNISCHECK,
        "  if (tekorten.length > 0) {",
        "  if (false) {",
    ),
    (
        "een tweede inlevering wordt aangenomen",
        STORAGE,
        "           WHERE id = ? AND antwoorden IS NULL`,",
        "           WHERE id = ?`,",
    ),
    (
        "de versie stijgt niet meer bij een inhoudelijke wijziging",
        STORAGE,
        "        inhoudelijk ? bestaand.versie + 1 : bestaand.versie,",
        "        bestaand.versie,",
    ),
    (
        "eerder geziene items worden bij een herkansing niet uitgesloten",
        STORAGE,
        "      const uitsluiten = itemsets.eerdereItemIds(ronde.geaccrediteerde_id, bewijsstukNummer);",
        "      const uitsluiten: number[] = [];",
    ),
]


def draai() -> bool:
    """True wanneer alle suites van blok 4 groen zijn."""
    r = subprocess.run(
        ["npx", "vitest", "run", *SUITES],
        capture_output=True,
        text=True,
    )
    return "failed" not in r.stdout.lower() and r.returncode == 0


def main() -> int:
    fouten = []
    for naam, pad, oud, nieuw in MUTATIES:
        rug = f"/tmp/mut4-{pad.replace('/', '_')}.rug"
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
