#!/usr/bin/env python3
"""Voegt herschreven foutmeldingen aan het voorstel toe.

De bestaande toelichtingFout van veel items beschrijft de oude afleiders
("de overige brongegevens gaan over IVOC, betrouwbaarheid en normgroep").
Zodra de afleiders veranderen, is die tekst onjuist. Hij wordt aan de kandidaat
getoond na een fout antwoord, dus hij moet de nieuwe denkfout benoemen.

Geen letters in de tekst: de volgorde van opties kan bij het samenstellen van een
kennischeck wijzigen.
"""
import io
import json

PAD = "/home/user/workspace/voorstel-afleiders.json"

NIEUW = {
    "A01": "De denkfouten zijn: drivers een blokmodus geven, of de energievraag"
    " uitbreiden naar alle uitspraken van het blok in plaats van alleen de twee"
    " gekozen uitspraken.",
    "A04": "De denkfouten zijn: de blokmodus van de talentfamilies op een driver"
    " toepassen, de energievraag naar alle uitspraken uitbreiden, of hem tot de"
    " meest herkenbare beperken. Het zijn beide gekozen uitspraken.",
    "A08": "De denkfout is de aantallen omdraaien of kruisen. Talent-foci hebben"
    " vijf constructen en tien blokken, Talent-versnellers zes en veertien.",
    "A17": "De denkfout is de reeks van de energieschalen onder de"
    " talentversnellers voor die van de driverschalen houden, of een reeks noemen"
    " die de bron niet rapporteert.",
    "C01": "De denkfouten zijn: de analyse confirmatorisch noemen, of haar als"
    " gepubliceerd voorstellen. Ze is exploratief en niet extern gepubliceerd.",
    "C02": "De denkfouten zijn: aannemen dat een co\u00ebffici\u00ebnt wel berekend maar niet"
    " gerapporteerd is, of een factorlading als betrouwbaarheidsmaat lezen. Een"
    " lading en een co\u00ebffici\u00ebnt zijn verschillende grootheden.",
    "C04": "De denkfouten zijn: een factoranalyse voor een stabiliteitsmeting"
    " houden, of een factorlading als bewijs van stabiliteit over tijd lezen. Er"
    " is geen test-hertestonderzoek.",
    "C06": "De denkfouten zijn: aannemen dat een deel van de technische"
    " verantwoording wel beschikbaar is, of haar bij de Universiteit Antwerpen of"
    " bij IVOC situeren. Alle drie de onderdelen zijn niet gepubliceerd.",
    "C07": "De denkfouten zijn: de bevindingen als gepubliceerd rapport"
    " voorstellen, de vier experts een verschillende rol toekennen, of de"
    " inhoudsvalidatie aan IVOC toeschrijven.",
    "C08": "De denkfout is IVOC een rol geven die de bron elders belegt: de"
    " factoranalyse liep met de Universiteit Antwerpen, de inhoudsvalidatie onder"
    " prof. dr. Peter Theuns, en een ijking op een normgroep bestaat niet.",
    "C09": "De denkfouten zijn: \u00e9\u00e9n van de drie uitkomsten als wel onderzocht"
    " voorstellen, of de factoranalyse of de expertvalidatie voor onderzoek naar"
    " uitkomsten buiten het instrument houden.",
    "C10": "De denkfouten zijn: een momentopname vaststaand maken door zorgvuldig"
    " invullen, door een tweede afname, of binnen een termijn. De claimgrens kent"
    " geen van die drie uitzonderingen.",
    "C11": "De denkfouten zijn: het profiel voor promotie w\u00e9l geschikt achten,"
    " denken dat toestemming de grens opheft, of de grens tot promotie beperken."
    " De claimgrens noemt aanwerving, selectie, promotie en ontslag samen.",
    "C15": "De denkfouten zijn: de twee aantallen omdraaien, de sportprofielen"
    " weglaten, of prof. dr. Peter Theuns bij de factoranalyse plaatsen. Hij"
    " superviseerde de externe inhoudsvalidatie.",
    "C16": "De denkfouten zijn: de twee reeksen verwisselen, aannemen dat voor de"
    " energieschalen niets gerapporteerd is, of beide reeksen gelijkstellen.",
}

voorstel = json.load(io.open(PAD, encoding="utf-8"))
gevonden = set()
for v in voorstel["voorstellen"]:
    if v["nummer"] in NIEUW:
        tekst = NIEUW[v["nummer"]]
        assert len(tekst) >= 20, v["nummer"]
        assert not any(f" {L}." in tekst for L in "ABCDEF"), (
            f"{v['nummer']}: verwijst naar een optieletter"
        )
        v["nieuwe_toelichtingFout"] = tekst
        gevonden.add(v["nummer"])

ontbreekt = set(NIEUW) - gevonden
assert not ontbreekt, f"nummers niet in het voorstel: {ontbreekt}"

json.dump(
    voorstel,
    io.open(PAD, "w", encoding="utf-8"),
    ensure_ascii=False,
    indent=2,
)
print(f"{len(gevonden)} foutmeldingen herschreven: {', '.join(sorted(gevonden))}")
behouden = [
    v["nummer"] for v in voorstel["voorstellen"] if "nieuwe_toelichtingFout" not in v
]
print(f"{len(behouden)} behouden omdat de bestaande tekst nog past: {', '.join(behouden)}")
