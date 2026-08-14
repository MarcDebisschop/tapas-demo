#!/usr/bin/env python3
"""Schrijft het itemcorpus als TypeScript-bronbestand.

Het corpus wordt uit de JSON gegenereerd en niet met de hand getypt: zo kan de
inhoud niet stilletjes uiteenlopen met wat er gecontroleerd is. Wie een item wil
wijzigen, wijzigt de JSON en draait dit script opnieuw.
"""
import io
import json

BASIS = "/home/user/workspace"
UIT = f"{BASIS}/core/server/bekwaamheid/itemcorpus-t4p.ts"


def ts(waarde: str) -> str:
    """Zet een tekst om naar een TypeScript-letterlijke tekenreeks."""
    ontsnapt = waarde.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{ontsnapt}"'


def main() -> None:
    items = json.load(io.open(f"{BASIS}/itemcorpus-t4p.json", encoding="utf-8"))
    assert len(items) == 80, f"verwacht 80 items, gevonden {len(items)}"

    regels = [
        "// ---------------------------------------------------------------------------",
        "// Meetitems voor de kennischeck bij het T4P Business Kompas.",
        "//",
        "// Dit bestand is GEGENEREERD. Wijzig het niet met de hand: de inhoud komt uit",
        "// het gecontroleerde corpus en wordt door scripts/genereer-corpus-ts.py",
        "// opnieuw weggeschreven. Een handmatige wijziging hier verdwijnt bij de",
        "// volgende generatie en ontsnapt aan de controle die op het corpus draait.",
        "//",
        "// Elke bewering in een item staat in docs/ITEMBRON-T4P-KENNISCHECK.md, met het",
        "// codepad erbij. Dat is opzet: een kennischeck die iets fout rekent wat de code",
        "// anders doet, meet de gissing van de itemschrijver en niet de bekwaamheid van",
        "// de kandidaat. Bij een bezwaar is zo'n item niet te verdedigen.",
        "//",
        "// De stam van geen enkel item valt samen met de dertig vragen van de",
        "// tussentijdse metingen in server/routes-stm.ts. Die zijn oefenstof en zijn dus",
        "// bij de kandidaat bekend; als meetitem zouden ze een hoge score opleveren",
        "// zonder dat er iets gemeten is. tests/bekwaamheid-itemcorpus.test.ts houdt dat",
        "// tegen door beide bronnen te vergelijken.",
        "//",
        "// Deze laag is zuiver: geen opslag, geen netwerk, geen tijd, geen toeval.",
        "// ---------------------------------------------------------------------------",
        "",
        'import type { ItemInvoer } from "./itembank.js";',
        "",
        "/** Het instrument waar dit corpus bij hoort. */",
        'export const CORPUS_INSTRUMENT = "t4p-business-kompas";',
        "",
        "/**",
        " * De tachtig meetitems, tweemaal het blokplan van de kennischeck.",
        " *",
        " * Het draaiboek noemt zestig items per instrument. Onder de uitsluitingsregel",
        " * van de herkansing - een herkansing sluit alle items uit die deze persoon",
        " * eerder zag - is zestig niet genoeg voor twee volle rondes: blok A vraagt er",
        " * tien per afname en zou bij een evenredige verdeling over zestig items op",
        " * vijftien blijven steken. Tachtig maakt de tweede ronde werkelijk uitvoerbaar.",
        " */",
        "export const ITEMCORPUS_T4P: readonly ItemInvoer[] = [",
    ]

    for item in items:
        regels.append("  {")
        regels.append(f"    instrumentId: CORPUS_INSTRUMENT,")
        regels.append(f'    as: "weten",')
        regels.append(f"    blok: {ts(item['blok'])},")
        regels.append(f"    soort: {ts(item['soort'])},")
        regels.append(f"    stam: {ts(item['stam'])},")
        if item["opties"] is None:
            regels.append("    opties: null,")
        else:
            regels.append("    opties: [")
            for optie in item["opties"]:
                regels.append(f"      {ts(optie)},")
            regels.append("    ],")
        regels.append(f"    sleutel: {ts(item['sleutel'])},")
        regels.append(f"    toelichtingGoed: {ts(item['toelichtingGoed'])},")
        regels.append(f"    toelichtingFout: {ts(item['toelichtingFout'])},")
        regels.append(f'    gebruik: "meten",')
        regels.append(f"    bronVerwijzing: {ts(item['bronVerwijzing'])},")
        regels.append("  },")

    regels += [
        "];",
        "",
        "/** Het aantal items per kennischeckblok in dit corpus. */",
        "export function corpusdekking(): Record<string, number> {",
        "  const telling: Record<string, number> = {};",
        "  for (let i = 0; i < ITEMCORPUS_T4P.length; i += 1) {",
        "    const blok = ITEMCORPUS_T4P[i].blok ?? \"\";",
        "    telling[blok] = (telling[blok] ?? 0) + 1;",
        "  }",
        "  return telling;",
        "}",
        "",
    ]

    io.open(UIT, "w", encoding="utf-8").write("\n".join(regels))
    print(f"geschreven: {UIT}")
    print(f"items: {len(items)}, regels: {len(regels)}")


if __name__ == "__main__":
    main()
