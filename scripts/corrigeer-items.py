#!/usr/bin/env python3
"""Corrigeert de itembestanden en bouwt het volledige corpus.

Drie ingrepen, elk om een vastgestelde reden:

1. A[17] wordt vervangen. Het item was de spiegel van A[16]: samen in een afname
   geven de twee elkaar het antwoord. Het nieuwe item vult een werkelijk gat,
   want blok A heet Constructen maar toetste de namen van de vijf talent-foci
   nergens.

2. A[6] en A[11] worden omgekeerd naar een onjuiste bewering. Alle vier de
   juist-onjuist-items van blok A hadden de sleutel "juist"; wie overal "juist"
   antwoordt kreeg ze gratis.

3. De antwoordmogelijkheden worden deterministisch herschikt zodat de sleutel
   gelijkmatig over de posities valt. Items waarvan alle mogelijkheden een getal
   zijn blijven ongemoeid: daar is de oplopende orde de leesbare orde, en de
   kandidaat moet toch rekenen voordat de positie iets zegt.
"""
import io
import json
import re
from collections import Counter

BASIS = "/home/user/workspace"
LETTERS = "ABCDEF"

NIEUW_A17 = {
    "blok": "A",
    "soort": "meerkeuze",
    "stam": (
        "Welke reeks bevat uitsluitend constructen uit de familie Talent-foci "
        "van het T4P Business Kompas?"
    ),
    "opties": [
        "Innovatie, Inter-relationeel, Operationeel, Strategie, TaPas-Beeld.",
        "Analyse, Coaching, Faciliteren, Impact, Resultaatgericht.",
        "Be Perfect, Be Strong, Hurry Up, Please Others, Try Hard.",
        "Innovatie, Strategie, Impact, Analyse, TaPas-Beeld.",
    ],
    "sleutel": "A",
    "toelichtingGoed": (
        "De familie Talent-foci bestaat uit vijf constructen: Innovatie, "
        "Inter-relationeel, Operationeel, Strategie en TaPas-Beeld. Ze worden "
        "bevraagd met energie op blokniveau."
    ),
    "toelichtingFout": (
        "De denkfout is de drie families door elkaar halen. Analyse, Coaching, "
        "Faciliteren, Impact en Resultaatgericht zijn talent-versnellers; Be "
        "Perfect en de andere vier zijn drivers. Een reeks die foci en "
        "versnellers mengt, zoals Innovatie samen met Impact en Analyse, hoort "
        "bij geen van de families."
    ),
    "bronVerwijzing": "ITEMBRON §1.1",
}

OMKERINGEN = {
    ("A", 6): {
        "stam": (
            "Hurry Up en Faciliteren zijn beide constructen binnen de familie "
            "Drivers."
        ),
        "sleutel": "onjuist",
        "toelichtingGoed": (
            "Dit is onjuist. Hurry Up is een driver, maar Faciliteren hoort bij "
            "de talent-versnellers. De vijf drivers zijn Be Perfect, Be Strong, "
            "Hurry Up, Please Others en Try Hard."
        ),
        "toelichtingFout": (
            "De denkfout is aannemen dat een werkwoordachtige naam een driver "
            "aanduidt. De familie is niet aan de vorm van de naam te zien; ze "
            "volgt uit de indeling van het instrument, en die bepaalt ook of "
            "energie per item of per blok wordt bevraagd."
        ),
    },
    ("A", 11): {
        "stam": (
            "De schaal energy en de schaal baselineEnergy0to10 hebben hetzelfde "
            "bereik."
        ),
        "sleutel": "onjuist",
        "toelichtingGoed": (
            "Dit is onjuist. De schaal energy loopt van −2 tot +2, terwijl "
            "baselineEnergy0to10 van 0 tot 10 loopt. Juist daarom is er een "
            "herschaling nodig voordat de twee met elkaar vergeleken kunnen "
            "worden."
        ),
        "toelichtingFout": (
            "De denkfout is de twee energiematen als één schaal behandelen "
            "omdat ze beide over energie gaan. Wie ze verwisselt, telt een "
            "waarde van −2 en een waarde van 0 als hetzelfde, terwijl −2 na "
            "herschaling juist de ondergrens 0 oplevert."
        ),
    },
}


def is_getal(tekst: str) -> bool:
    """Waar wanneer de hele mogelijkheid één getal is, met of zonder teken."""
    schoon = tekst.strip().rstrip(".").replace("\u2212", "-").replace(",", ".")
    return bool(re.fullmatch(r"[+-]?\d+(\.\d+)?", schoon))


def main() -> None:
    blokken = {}
    for blok in "ABCDE":
        pad = f"{BASIS}/items-{blok}.json"
        blokken[blok] = json.load(io.open(pad, encoding="utf-8"))

    # --- ingreep 1 --------------------------------------------------------
    oud = blokken["A"][17]["stam"]
    assert "energieschalen onder de talentversnellers" in oud, (
        f"A[17] is niet het verwachte item, maar: {oud!r}"
    )
    blokken["A"][17] = NIEUW_A17
    print(f"A[17] vervangen. Oud: {oud[:70]}...")

    # --- ingreep 2 --------------------------------------------------------
    for (blok, index), wijziging in OMKERINGEN.items():
        item = blokken[blok][index]
        assert item["soort"] == "juistfout", f"{blok}[{index}] is geen juistfout"
        assert item["sleutel"] == "juist", (
            f"{blok}[{index}] heeft al sleutel {item['sleutel']}"
        )
        item.update(wijziging)
        print(f"{blok}[{index}] omgekeerd naar onjuist.")

    # --- ingreep 3 --------------------------------------------------------
    teller = 0
    ongemoeid = 0
    for blok in "ABCDE":
        for index, item in enumerate(blokken[blok]):
            if item["soort"] == "juistfout":
                continue
            opties = item["opties"]
            if all(is_getal(o) for o in opties):
                ongemoeid += 1
                continue
            aantal = len(opties)
            huidig = LETTERS.index(item["sleutel"])
            doel = teller % aantal
            teller += 1
            if huidig == doel:
                continue
            juist = opties[huidig]
            rest = [o for i, o in enumerate(opties) if i != huidig]
            nieuw = rest[:doel] + [juist] + rest[doel:]
            assert len(nieuw) == aantal, f"{blok}[{index}] optieverlies"
            assert nieuw[doel] == juist, f"{blok}[{index}] sleutel verschoven"
            assert sorted(nieuw) == sorted(opties), f"{blok}[{index}] inhoud gewijzigd"
            item["opties"] = nieuw
            item["sleutel"] = LETTERS[doel]

    print(f"\nHerschikt: {teller} items. Ongemoeid gelaten (getalopties): {ongemoeid}.")

    # --- wegschrijven -----------------------------------------------------
    alles = []
    for blok in "ABCDE":
        pad = f"{BASIS}/items-{blok}.json"
        io.open(pad, "w", encoding="utf-8").write(
            json.dumps(blokken[blok], ensure_ascii=False, indent=1) + "\n"
        )
        alles.extend(blokken[blok])
    io.open(f"{BASIS}/itemcorpus-t4p.json", "w", encoding="utf-8").write(
        json.dumps(alles, ensure_ascii=False, indent=1) + "\n"
    )

    print(f"\nTotaal: {len(alles)} items.")
    print("Per blok:", dict(Counter(x["blok"] for x in alles)))
    print("Sleutelverdeling:", dict(Counter(x["sleutel"] for x in alles)))
    print("Soorten:", dict(Counter(x["soort"] for x in alles)))


if __name__ == "__main__":
    main()
