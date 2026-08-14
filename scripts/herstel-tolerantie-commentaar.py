#!/usr/bin/env python3
"""Herstelt het commentaar bij WEGING_TOLERANTIE in normprofiel.ts.

Het oorspronkelijke commentaar beweerde dat 0,2 + 0,3 + 0,3 + 0,2 in IEEE-754
niet exact 1 is. Dat is onjuist: die som is wel exact 1. Gemeten over twaalf
plausibele wegingen zijn 0,4+0,3+0,2+0,1 en 0,15+0,15+0,35+0,35 de twee die
0.9999999999999999 geven. Het commentaar noemt nu het gemeten voorbeeld.
"""
import io
import sys

PAD = "server/bekwaamheid/normprofiel.ts"

OUD = """/**
 * De tolerantie op de som van de wegingen.
 *
 * Niet nul, want 0,20 + 0,30 + 0,30 + 0,20 is in IEEE-754 niet exact 1: de som
 * is 0,9999999999999999. Een eis van exacte gelijkheid zou dus juist het
 * voorbeeld uit het bouwplan afkeuren. Niet ruimer dan 1e-9, want alles daarboven
 * laat werkelijke invoerfouten door: het kleinste betekenisvolle verschil in een
 * weging is 0,01 en dat is zeven ordes groter.
 */"""

NIEUW = """/**
 * De tolerantie op de som van de wegingen.
 *
 * Niet nul, want in IEEE-754 telt niet elke geldige weging exact tot 1 op.
 * Gemeten over twaalf plausibele wegingen zijn er twee die 0,9999999999999999
 * geven: 0,40 + 0,30 + 0,20 + 0,10 en 0,15 + 0,15 + 0,35 + 0,35. De weging uit
 * het bouwplan (0,20 + 0,30 + 0,30 + 0,20) komt wel exact op 1 uit, dus dat is
 * niet het voorbeeld dat de tolerantie rechtvaardigt. Een eis van exacte
 * gelijkheid zou die twee even geldige wegingen afkeuren.
 *
 * Niet ruimer dan 1e-9, want alles daarboven laat werkelijke invoerfouten door:
 * het kleinste betekenisvolle verschil in een weging is 0,01 en dat is zeven
 * ordes groter dan de tolerantie.
 */"""


def main() -> int:
    with io.open(PAD, encoding="utf-8") as f:
        bron = f.read()
    if bron.count(OUD) != 1:
        print(f"FOUT: anker komt {bron.count(OUD)} keer voor, verwacht 1")
        return 1
    with io.open(PAD, "w", encoding="utf-8") as f:
        f.write(bron.replace(OUD, NIEUW, 1))
    print("commentaar hersteld")
    return 0


if __name__ == "__main__":
    sys.exit(main())
