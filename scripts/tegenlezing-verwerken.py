#!/usr/bin/env python3
"""Verwerkt de drie bevindingen van de tegenlezing.

Elke bevinding is nagekeken tegen het brondossier en juist bevonden. De
correcties raken de sleutel niet: bij index 37 en 41 wordt een afleider
vervangen die in werkelijkheid ook juist was, en bij index 60 wordt de stam
herschreven omdat die niet paste bij de antwoordmogelijkheden.
"""
import io
import json

BASIS = "/home/user/workspace"

# index -> (blok, verwachte sleutel, wat er verandert)
CORRECTIES = [
    {
        "index": 37,
        "blok": "C",
        "sleutel": "D",
        "reden": (
            "Optie B was eveneens een geldige correctie op de bewering: de bron "
            "zegt zowel dat de analyse niet extern gepubliceerd is als dat de "
            "drie technische onderdelen niet gepubliceerd zijn. De vervanging is "
            "een ware uitspraak die geen correctie is op een bewering over "
            "publicatie."
        ),
        "optie_oud": "De analyse is exploratief en niet extern gepubliceerd.",
        "optie_nieuw": (
            "De factorladingen van de driverschalen liggen tussen 0,90 en 0,97."
        ),
    },
    {
        "index": 41,
        "blok": "C",
        "sleutel": "D",
        "reden": (
            "Optie C kwam ook uit de claimgrens en was dus even verdedigbaar. Ze "
            "antwoordt echter niet op het woord definitief. De vervanging is een "
            "onjuiste gedachte die juist wel over vaststaandheid gaat: de "
            "afnamekwaliteit is uitdrukkelijk geen oordeel over de persoon en "
            "maakt een resultaat niet vaststaand."
        ),
        "optie_oud": (
            "Een T4Professional-profiel is een gespreksinstrument. Het geeft "
            "inzichten, aandachtspunten en richtingaanwijzers."
        ),
        "optie_nieuw": (
            "De vragenlijst is zorgvuldig ingevuld, dus het resultaat mag als "
            "vaststaand gelden."
        ),
    },
    {
        "index": 60,
        "blok": "D",
        "sleutel": "B",
        "reden": (
            "De stam vroeg naar een foute interpretatie, terwijl de "
            "mogelijkheden beoordelingen van de conclusie van de manager zijn. "
            "Onder de oude stam was geen enkele mogelijkheid een antwoord op de "
            "vraag."
        ),
        "stam_oud": (
            "Een manager ziet één profiel en stelt dat dit definitief vastlegt "
            "welke mogelijkheden de deelnemer ook in de toekomst zal hebben. "
            "Welke interpretatie is volgens de claimgrens fout?"
        ),
        "stam_nieuw": (
            "Een manager ziet één profiel en stelt dat dit definitief vastlegt "
            "welke mogelijkheden de deelnemer ook in de toekomst zal hebben. "
            "Welke beoordeling van die conclusie volgt de claimgrens?"
        ),
    },
]


def main() -> None:
    pad = f"{BASIS}/itemcorpus-t4p.json"
    alles = json.load(io.open(pad, encoding="utf-8"))
    assert len(alles) == 80, f"verwacht 80 items, gevonden {len(alles)}"

    for correctie in CORRECTIES:
        item = alles[correctie["index"]]
        assert item["blok"] == correctie["blok"], (
            f"index {correctie['index']} zit in blok {item['blok']}, "
            f"verwacht {correctie['blok']}"
        )
        assert item["sleutel"] == correctie["sleutel"], (
            f"index {correctie['index']} heeft sleutel {item['sleutel']}, "
            f"verwacht {correctie['sleutel']}"
        )

        if "optie_oud" in correctie:
            opties = item["opties"]
            assert correctie["optie_oud"] in opties, (
                f"index {correctie['index']}: te vervangen optie niet gevonden"
            )
            plaats = opties.index(correctie["optie_oud"])
            sleutelplaats = "ABCDEF".index(item["sleutel"])
            assert plaats != sleutelplaats, (
                f"index {correctie['index']}: de vervanging zou het juiste "
                "antwoord raken"
            )
            opties[plaats] = correctie["optie_nieuw"]
            assert len(set(opties)) == len(opties), (
                f"index {correctie['index']}: de vervanging maakt een dubbele optie"
            )
            print(f"index {correctie['index']} ({item['blok']}): optie {'ABCDEF'[plaats]} vervangen")
        else:
            assert item["stam"] == correctie["stam_oud"], (
                f"index {correctie['index']}: de stam is niet de verwachte tekst"
            )
            item["stam"] = correctie["stam_nieuw"]
            print(f"index {correctie['index']} ({item['blok']}): stam herschreven")

    io.open(pad, "w", encoding="utf-8").write(
        json.dumps(alles, ensure_ascii=False, indent=1) + "\n"
    )

    # De blokbestanden meelopen, anders draait een hergeneratie de correctie terug.
    for blok in "ABCDE":
        blokpad = f"{BASIS}/items-{blok}.json"
        rijen = json.load(io.open(blokpad, encoding="utf-8"))
        geraakt = 0
        for rij in rijen:
            for correctie in CORRECTIES:
                if "optie_oud" in correctie and rij.get("opties"):
                    if correctie["optie_oud"] in rij["opties"]:
                        i = rij["opties"].index(correctie["optie_oud"])
                        rij["opties"][i] = correctie["optie_nieuw"]
                        geraakt += 1
                elif "stam_oud" in correctie and rij["stam"] == correctie["stam_oud"]:
                    rij["stam"] = correctie["stam_nieuw"]
                    geraakt += 1
        if geraakt:
            io.open(blokpad, "w", encoding="utf-8").write(
                json.dumps(rijen, ensure_ascii=False, indent=1) + "\n"
            )
            print(f"items-{blok}.json: {geraakt} correctie(s) doorgezet")

    print("\nAlle drie de bevindingen verwerkt.")


if __name__ == "__main__":
    main()
