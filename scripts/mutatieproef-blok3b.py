#!/usr/bin/env python3
"""Mutatieproef op de beslismachine en migratie 0007.

Elke mutatie raakt een regel waarvan de juistheid een uitspraak over iemands
bekwaamheid bepaalt. Blijft de suite groen na een mutatie, dan is dat een LEK: de
regel wordt niet gedekt.

Elke mutatie wordt na afloop byte-identiek teruggedraaid en dat wordt met cmp
gecontroleerd.
"""
import io
import os
import shutil
import subprocess
import sys
import tempfile

BESLIS = "server/bekwaamheid/beslisregels.ts"
MIGRATIE = "migrations/0007_beslisuitkomsten.sql"

MUTATIES = [
    (
        BESLIS,
        "twee assen onder de drempel geven nog opgeschort in plaats van vanaf twee",
        "if (assenOnderDrempel.length >= 2)",
        "if (assenOnderDrempel.length >= 3)",
    ),
    (
        BESLIS,
        "de aandachtszone wordt exclusief in plaats van inclusief",
        "} else if (score <= AANDACHTSZONE_BOVENGRENS) {",
        "} else if (score < AANDACHTSZONE_BOVENGRENS) {",
    ),
    (
        BESLIS,
        "de totaaldrempel wordt exclusief, dus exact 0,70 zakt",
        "const totaalHaalt = totaal >= normprofiel.drempelTotaal;",
        "const totaalHaalt = totaal > normprofiel.drempelTotaal;",
    ),
    (
        BESLIS,
        "de asdrempel wordt exclusief, dus exact 0,60 zakt",
        "const haalt = score >= drempel;",
        "const haalt = score > drempel;",
    ),
    (
        BESLIS,
        "de activiteitsroute gaat de uitkomst drukken",
        'activiteitsroute: activiteit.haalt ? "voldoende_activiteit" : "slapend",',
        'activiteitsroute: activiteit.haalt ? "voldoende_activiteit" : "slapend",\n    // MUTATIE',
    ),
    (
        BESLIS,
        "de leemte gaat voor op een as onder de drempel",
        'if (leemten.length) toegepasteRegels.push("administratieve_leemte");',
        'if (leemten.length) toegepasteRegels.unshift("administratieve_leemte");',
    ),
    (
        BESLIS,
        "een onvolledig dossier levert toch een voorstel",
        "if (!asscores.volledig || asscores.totaal === null) {",
        "if (false && (!asscores.volledig || asscores.totaal === null)) {",
    ),
    (
        MIGRATIE,
        "de oude waarde herkansing blijft toegestaan in de CHECK",
        "\"voorstel_uitkomst\" IN ('bekrachtigd', "
        "'bekrachtigd_met_aandachtspunt', 'voorwaardelijk', 'opgeschort', "
        "'beeindigd')",
        "\"voorstel_uitkomst\" IN ('bekrachtigd', "
        "'bekrachtigd_met_aandachtspunt', 'voorwaardelijk', 'opgeschort', "
        "'beeindigd', 'herkansing')",
    ),
    (
        MIGRATIE,
        "de unieke index wordt na de herbouw niet hersteld",
        "CREATE UNIQUE INDEX IF NOT EXISTS `uq_bekwaamheid_beslissing_ronde`",
        "CREATE INDEX IF NOT EXISTS `uq_bekwaamheid_beslissing_ronde`",
    ),
]

# De vijfde mutatie hierboven is een blinde: ze voegt alleen commentaar toe en de
# suite MOET groen blijven. Zonder zo'n blinde meet de proef niet of ze eigenlijk
# wel iets kan onderscheiden.
BLINDE = 4


def lees(pad):
    with io.open(pad, encoding="utf-8") as f:
        return f.read()


def schrijf(pad, inhoud):
    with io.open(pad, "w", encoding="utf-8") as f:
        f.write(inhoud)


def suite_groen():
    r = subprocess.run(
        ["npx", "vitest", "run",
         "tests/bekwaamheid-beslisregels.test.ts",
         "tests/bekwaamheid-normprofiel.test.ts",
         "tests/migratieloper.test.ts"],
        capture_output=True, text=True,
    )
    return r.returncode == 0


def main():
    bewaarmap = tempfile.mkdtemp()
    for pad in {m[0] for m in MUTATIES}:
        shutil.copy2(pad, os.path.join(bewaarmap, os.path.basename(pad)))

    lekken = []
    for i, (pad, wat, oud, nieuw) in enumerate(MUTATIES):
        bron = lees(pad)
        n = bron.count(oud)
        if n != 1:
            print(f"[{i + 1}] ANKER FOUT ({n}x): {wat}")
            lekken.append(f"anker: {wat}")
            continue

        schrijf(pad, bron.replace(oud, nieuw, 1))
        groen = suite_groen()
        schrijf(pad, bron)

        origineel = os.path.join(bewaarmap, os.path.basename(pad))
        if subprocess.run(["cmp", "-s", pad, origineel]).returncode != 0:
            print(f"[{i + 1}] NIET BYTE-IDENTIEK TERUGGEDRAAID: {pad}")
            lekken.append(f"terugdraai: {pad}")
            continue

        if i == BLINDE:
            if groen:
                print(f"[{i + 1}] BLINDE OK (suite bleef groen): {wat}")
            else:
                print(f"[{i + 1}] BLINDE ONVERWACHT ROOD: {wat}")
                lekken.append(f"blinde rood: {wat}")
        elif groen:
            print(f"[{i + 1}] LEK (suite bleef groen): {wat}")
            lekken.append(wat)
        else:
            print(f"[{i + 1}] BETRAPT: {wat}")

    print()
    if lekken:
        print(f"NIET GOED: {len(lekken)} bevinding(en)")
        for l in lekken:
            print(f"  - {l}")
        return 1
    print(f"ALLE {len(MUTATIES) - 1} MUTATIES BETRAPT, DE BLINDE BLEEF GROEN")
    return 0


if __name__ == "__main__":
    sys.exit(main())
