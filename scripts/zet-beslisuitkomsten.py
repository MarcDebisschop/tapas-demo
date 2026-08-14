#!/usr/bin/env python3
"""Trekt BESLISUITKOMSTEN in schema.ts gelijk met draaiboek 5.3.

Zie migrations/0007_beslisuitkomsten.sql voor de volledige onderbouwing.
"""
import io
import sys

PAD = "server/bekwaamheid/schema.ts"

OUD = '''/** Uitkomsten van een beslissing. */
export const BESLISUITKOMSTEN = [
  "bekrachtigd",
  "bekrachtigd_met_aandachtspunt",
  "voorwaardelijk",
  "herkansing",
  "niet_bekrachtigd",
] as const;
export type Beslisuitkomst = (typeof BESLISUITKOMSTEN)[number];'''

NIEUW = '''/**
 * Uitkomsten van een beslissing, letterlijk de vijf uit draaiboek 5.3.
 *
 * Deze lijst luidde eerder ...'voorwaardelijk', 'herkansing',
 * 'niet_bekrachtigd'. Voor die afwijking van het draaiboek stond nergens een
 * reden opgeschreven. Ze is gecorrigeerd in migratie 0007, om drie feitelijke
 * redenen:
 *
 *   1. 'herkansing' staat al in RONDESOORTEN als soort ronde. Hetzelfde woord
 *      ook als uitkomst gebruiken maakt van twee verschillende dingen een term,
 *      en juist bij een bezwaar moet ondubbelzinnig zijn wat er besloten is en
 *      wat er daarna is georganiseerd.
 *   2. 'niet_bekrachtigd' komt in het draaiboek niet voor. Het draaiboek
 *      verbiedt de woorden gezakt, afgekeurd en onvoldoende; een term die de
 *      bekrachtiging letterlijk ontkent, ligt in datzelfde register.
 *   3. 'opgeschort' en 'beeindigd' staan al in LICENTIESTATUSSEN. Een uitkomst
 *      en de licentiestatus die eruit volgt, dragen nu dezelfde naam.
 */
export const BESLISUITKOMSTEN = [
  "bekrachtigd",
  "bekrachtigd_met_aandachtspunt",
  "voorwaardelijk",
  "opgeschort",
  "beeindigd",
] as const;
export type Beslisuitkomst = (typeof BESLISUITKOMSTEN)[number];

/**
 * De uitkomsten die de machine mag voorstellen.
 *
 * 'beeindigd' ontbreekt, en dat is de kern van blok 3. Beeindiging vereist twee
 * mislukte herkansingen, weigering of een integriteitsbreuk: menselijke feiten
 * die niet in asscores zitten en die een rekenkern dus niet kan vaststellen. Ze
 * staat wel in BESLISUITKOMSTEN, want een mens moet haar definitief kunnen
 * vaststellen. Dat de machine haar nooit voorstelt, wordt afgedwongen in
 * beslisregels.ts en vastgelegd in een eigen test.
 */
export const VOORSTELBARE_UITKOMSTEN = [
  "bekrachtigd",
  "bekrachtigd_met_aandachtspunt",
  "voorwaardelijk",
  "opgeschort",
] as const;
export type VoorstelbareUitkomst = (typeof VOORSTELBARE_UITKOMSTEN)[number];'''


def main() -> int:
    with io.open(PAD, encoding="utf-8") as f:
        bron = f.read()
    if bron.count(OUD) != 1:
        print(f"FOUT: anker komt {bron.count(OUD)} keer voor, verwacht 1")
        return 1
    with io.open(PAD, "w", encoding="utf-8") as f:
        f.write(bron.replace(OUD, NIEUW, 1))
    print("BESLISUITKOMSTEN gelijkgetrokken")
    return 0


if __name__ == "__main__":
    sys.exit(main())
