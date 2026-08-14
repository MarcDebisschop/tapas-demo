#!/usr/bin/env python3
"""Mutatieproef op de itemanalyse.

Dezelfde opzet als mutatieproef-blok4-corpus.py: één gebrek per keer aanbrengen
in server/bekwaamheid/itemanalyse.ts, controleren dat de test rood gaat, en het
bestand daarna met cmp verifieerbaar terugzetten.

De mutaties zijn de vergissingen die in psychometrische code werkelijk voorkomen
en die geen enkele foutmelding geven: de restscore vervangen door het totaal, de
grens van strikt naar inclusief laten glijden, een lege correlatie als nul
behandelen, en het minimum stil laten vallen.
"""
import shutil
import subprocess
import sys
from pathlib import Path

WORTEL = Path(__file__).resolve().parent.parent
DOEL = WORTEL / "server/bekwaamheid/itemanalyse.ts"
RUG = Path("/tmp/itemanalyse.ts.rug")
TEST = "tests/bekwaamheid-itemanalyse.test.ts"

MUTATIES = [
    (
        "het minimum wordt van 20 naar 5 verlaagd",
        "export const AFNAMEMINIMUM = 20;",
        "export const AFNAMEMINIMUM = 5;",
    ),
    (
        "de ondergrens schuift van .30 naar .20",
        "export const P_ONDERGRENS = 0.3;",
        "export const P_ONDERGRENS = 0.2;",
    ),
    (
        "de bovengrens schuift van .95 naar .99",
        "export const P_BOVENGRENS = 0.95;",
        "export const P_BOVENGRENS = 0.99;",
    ),
    (
        "de ondergrens wordt inclusief in plaats van strikt",
        "if (pWaarde < P_ONDERGRENS) {",
        "if (pWaarde <= P_ONDERGRENS) {",
    ),
    (
        "de bovengrens wordt inclusief in plaats van strikt",
        "} else if (pWaarde > P_BOVENGRENS) {",
        "} else if (pWaarde >= P_BOVENGRENS) {",
    ),
    (
        "de item-restcorrelatie wordt een itemtotaalcorrelatie",
        "restScores.push(goedPerAfname[i] - (isGoed ? 1 : 0));",
        "restScores.push(goedPerAfname[i]);",
    ),
    (
        "een niet te berekenen correlatie wordt nul",
        "  if (kwadA === 0 || kwadB === 0) return null;",
        "  if (kwadA === 0 || kwadB === 0) return 0;",
    ),
    (
        "de correlatiegrens wordt van negatief naar nul-of-lager",
        "} else if (discriminatie !== null && discriminatie < 0) {",
        "} else if (discriminatie !== null && discriminatie <= 0) {",
    ),
    (
        "uitgesloten items komen tóch in de noemer van p",
        'if (uitkomst === "uitgesloten" || uitkomst === "wacht_op_mens") {',
        'if (uitkomst === "wacht_op_mens") {',
    ),
    (
        "het minimum geldt niet meer per item",
        "if (aantalMeetbaar < minimum) {",
        "if (aantalMeetbaar < 0) {",
    ),
    (
        "dubbele afnames worden dubbel meegerekend",
        "    if (gezien.has(regel.itemsetId)) {",
        "    if (false) {",
    ),
    (
        "de items komen niet meer op oplopend id",
        "const ids = Array.from(idsSet).sort((a, b) => a - b);",
        "const ids = Array.from(idsSet).sort((a, b) => b - a);",
    ),
    (
        "een te makkelijk item wordt als houden gemeld",
        '      advies = "te_makkelijk";',
        '      advies = "houden";',
    ),
    (
        "de laag gaat de klok gebruiken",
        "export function analyseerItems(invoer: AnalyseInvoer): Analyseresultaat {",
        "export function analyseerItems(invoer: AnalyseInvoer): Analyseresultaat {\n  const nu = Date.now();",
    ),
    (
        "de laag sluit zelf items uit",
        "export function voorgesteldeUitsluitingen",
        "export const STIL = Math.random();\nexport function voorgesteldeUitsluitingen",
    ),
]


def draai_test() -> bool:
    uitkomst = subprocess.run(
        ["npx", "vitest", "run", TEST], cwd=WORTEL, capture_output=True, text=True
    )
    return uitkomst.returncode == 0


def main() -> int:
    shutil.copy(DOEL, RUG)
    origineel = DOEL.read_text(encoding="utf-8")

    print("Eerst de test op het ongewijzigde bestand.")
    if not draai_test():
        print("  Al rood zonder mutatie. Stop.")
        return 1
    print("  groen, zoals verwacht.\n")

    betrapt = 0
    gemist = []

    for naam, oud, nieuw in MUTATIES:
        aantal = origineel.count(oud)
        if aantal != 1:
            print(f"[!] {naam}: anker komt {aantal} keer voor, niet 1. Stop.")
            return 1

        gemuteerd = origineel.replace(oud, nieuw, 1)
        verwacht = len(origineel) - len(oud) + len(nieuw)
        if len(gemuteerd) != verwacht:
            print(f"[!] {naam}: onverwachte bestandslengte. Stop.")
            return 1

        DOEL.write_text(gemuteerd, encoding="utf-8")
        geslaagd = draai_test()

        shutil.copy(RUG, DOEL)
        if subprocess.run(["cmp", "-s", str(DOEL), str(RUG)]).returncode != 0:
            print(f"[!] {naam}: terugzetten mislukt. Stop onmiddellijk.")
            return 1

        if geslaagd:
            print(f"[GEMIST]  {naam}")
            gemist.append(naam)
        else:
            print(f"[betrapt] {naam}")
            betrapt += 1

    print()
    print(f"Betrapt: {betrapt} van {len(MUTATIES)}.")
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
