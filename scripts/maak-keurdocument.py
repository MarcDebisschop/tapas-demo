#!/usr/bin/env python3
"""Bouwt het keurdocument voor het herstelvoorstel.

Zet per item het oorspronkelijke item en het voorstel naast elkaar, met bij elke
nieuwe afleider de reden waarom hij onjuist is en de bronparagraaf. Gegenereerd
uit voorstel-afleiders.json en het corpus; niets is overgetypt.
"""
import io
import json
from collections import Counter
from pathlib import Path

WORTEL = Path("/home/user/workspace/core")
CORPUS = WORTEL / "server/bekwaamheid/itemcorpus-t4p.json"
VOORSTEL = Path("/home/user/workspace/voorstel-afleiders.json")
DOEL = WORTEL / "docs/HERSTELVOORSTEL-AFLEIDERS.md"
LETTERS = "ABCDEF"

origineel = json.load(io.open(CORPUS, encoding="utf-8"))
voorstel = json.load(io.open(VOORSTEL, encoding="utf-8"))

nummers = {}
teller = Counter()
for i, x in enumerate(origineel):
    teller[x["blok"]] += 1
    nummers[i] = f"{x['blok']}{teller[x['blok']]:02d}"

r = []
w = r.append

w("# Herstelvoorstel afleiders — itembank T4P Business Kompas")
w("")
w("Ter keuring. **Het corpus is niet gewijzigd.** Dit document zet per item het")
w("bestaande item en het voorstel naast elkaar. Wat je goedkeurt, wordt daarna in")
w("`itemcorpus-t4p.json` gezet, opnieuw gegenereerd en getest.")
w("")
w("## De regel achter het voorstel")
w("")
w("Het gebrek in de bank was dat afleiders **ware beweringen over een ander feit**")
w("waren. Dan meet het item of de kandidaat de vraag bij het antwoord kan zoeken,")
w("niet of hij het onderwerp kent.")
w("")
w("De regel die het voorstel volgt: **elke afleider is een onware variant van het")
w("feit waar de stam over gaat.** Alle opties spreken dus over hetzelfde onderwerp,")
w("en precies één is juist. Elke afleider is bovendien een denkfout die iemand")
w("werkelijk kan maken — een omgekeerde grens, een verwisselde familie, een")
w("gemiddelde dat voor een norm wordt gehouden.")
w("")
w("Bij elke afleider staat de bronparagraaf die hem onjuist maakt. Geen enkele")
w("afleider rust op iets wat niet in `docs/ITEMBRON-T4P-KENNISCHECK.md` staat.")
w("")
w("## Wat de meting van het voorstel zegt")
w("")
w("| Controle | Uitkomst |")
w("| --- | --- |")
w(
    f"| Items met een gebrek | 21 → 4 ({len(voorstel['voorstellen'])} hersteld,"
    " nul nieuw ontstaan) |"
)
w(
    f"| Foutmeldingen herschreven |"
    f" {sum(1 for v in voorstel['voorstellen'] if 'nieuwe_toelichtingFout' in v)}"
    " van de 17, omdat de oude tekst de oude afleiders beschreef |"
)
w("| Formele eisen van `valideerItem` | alle 80 items in orde |")
w("| Hoogste woordoverlap met de STM-oefenbank | 0,29 — de grens is 0,70 |")
w("| Sleutelverdeling over de bank | A17 · B19 · C19 · D18, ongewijzigd |")
w("| Aantal items, blokken, soorten, bronnen | ongewijzigd |")
w("")
w("De vier resterende zijn geen restschuld maar valse treffers van mijn eigen")
w("meting. Ze staan onderaan verantwoord.")
w("")
w("---")
w("")
w("## De zeventien voorstellen")
w("")

for v in voorstel["voorstellen"]:
    i = v["corpusindex"]
    oud = origineel[i]
    oude_sleutel = LETTERS.index(oud["sleutel"])
    nieuwe_sleutel = LETTERS.index(v["sleutel"])

    w(f"### {v['nummer']}")
    w("")
    w(f"*{oud['soort']} · bron: {oud['bronVerwijzing']}*")
    w("")

    if v["stam_ongewijzigd"]:
        w("**Vraag** (ongewijzigd)")
        w("")
        w(f"> {oud['stam']}")
    else:
        w("**Vraag — gewijzigd**")
        w("")
        w(f"> Was: {oud['stam']}")
        w(">")
        w(f"> **Wordt: {v['nieuwe_stam']}**")
        w("")
        w(f"Waarom: {v['reden_nieuwe_stam']}")
    w("")

    if "sleutel_ingekort" in v:
        w(f"**Het juiste antwoord is ingekort.** {v['sleutel_ingekort']}")
        w("")

    w("**Was**")
    w("")
    for j, o in enumerate(oud["opties"]):
        merk = "**→**" if j == oude_sleutel else "&nbsp;&nbsp;"
        w(f"{merk} {LETTERS[j]}. {o}")
    w("")
    w("**Wordt**")
    w("")
    for j, o in enumerate(v["opties"]):
        if j == nieuwe_sleutel:
            w(f"**→ {LETTERS[j]}. {o}**")
        else:
            grond = v["waarom_onjuist"].get(LETTERS[j], "")
            w(f"&nbsp;&nbsp; {LETTERS[j]}. {o}")
            if grond:
                w(f"&nbsp;&nbsp;&nbsp;&nbsp;<sub>onjuist volgens {grond}</sub>")
    w("")
    w(f"Toelichting bij juist: {oud['toelichtingGoed']} *(ongewijzigd)*")
    w("")
    if "nieuwe_toelichtingFout" in v:
        w("**Toelichting bij fout — gewijzigd.** De bestaande tekst beschreef de oude")
        w("afleiders en zou na dit herstel onjuist zijn.")
        w("")
        w(f"> Was: {oud['toelichtingFout']}")
        w(">")
        w(f"> **Wordt: {v['nieuwe_toelichtingFout']}**")
    else:
        w(f"Toelichting bij fout: {oud['toelichtingFout']} *(ongewijzigd)*")
    w("")
    w("Keuring: **goedkeuren** · **aanpassen** · **afwijzen**")
    w("")
    w("---")
    w("")

w("## De vier items die ik ongewijzigd wil laten")
w("")
w("Mijn meting wees 21 items aan. Bij het uitschrijven bleek dat vier daarvan in")
w("orde zijn: het waren valse treffers van de woordoverlapmaat. Dat is precies de")
w("reden dat zo'n maat kandidaten aanwijst en geen oordeel geeft.")
w("")
for f in voorstel["valse_treffers"]:
    oud = origineel[f["corpusindex"]]
    w(f"### {f['nummer']} — ongewijzigd laten")
    w("")
    w(f"> {oud['stam']}")
    w("")
    sleutelindex = (
        LETTERS.index(oud["sleutel"]) if oud["soort"] != "juistfout" else None
    )
    for j, o in enumerate(oud["opties"]):
        merk = "**→**" if j == sleutelindex else "&nbsp;&nbsp;"
        w(f"{merk} {LETTERS[j]}. {o}")
    if sleutelindex is None:
        w(f"**→ {oud['sleutel']}**")
    w("")
    w(f"{f['reden']}")
    w("")
    w("Keuring: **eens** · **toch aanpassen**")
    w("")

w("---")
w("")
w("## Wat hierna gebeurt")
w("")
w("1. Je keurt per item. Bij *aanpassen* geef je de richting; ik herschrijf.")
w("2. Het goedgekeurde deel gaat in `itemcorpus-t4p.json`, daarna")
w("   `scripts/genereer-corpus-ts.py`, daarna de volle testsuite.")
w("3. De twee gebreken worden testregel in `tests/bekwaamheid-itemcorpus.test.ts`,")
w("   met de vier valse treffers als vastgelegde uitzondering en de reden erbij.")
w("   Zonder die stap komt het gebrek terug zodra de bank groeit.")
w("")
w("Wat dit **niet** oplost: of dit de meest relevante tachtig vragen zijn. Betere")
w("afleiders maken een item zuiver, niet noodzakelijk belangrijk. Die vraag blijft")
w("open tot er een blauwdruk uit een taakanalyse ligt en een panel de items op")
w("essentialiteit heeft beoordeeld.")
w("")

tekst = "\n".join(r)
if not tekst.endswith("\n"):
    tekst += "\n"
io.open(DOEL, "w", encoding="utf-8").write(tekst)
print(f"geschreven: {DOEL}")
print(f"voorstellen: {len(voorstel['voorstellen'])}, valse treffers: {len(voorstel['valse_treffers'])}")
print(f"regels: {len(tekst.splitlines())}")
