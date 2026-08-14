#!/usr/bin/env python3
"""Bouwt een leesbaar overzicht van de itembank uit het corpus.

Leest uitsluitend server/bekwaamheid/itemcorpus-t4p.json en schrijft
docs/ITEMBANK-T4P-OVERZICHT.md. Niets wordt met de hand overgetypt: een
overgetypt overzicht loopt uiteen met de bank en dan weet niemand meer welke van
de twee de vragen zijn.
"""
import difflib
import io
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

WORTEL = Path("/home/user/workspace/core")
BRON = WORTEL / "server/bekwaamheid/itemcorpus-t4p.json"
DOEL = WORTEL / "docs/ITEMBANK-T4P-OVERZICHT.md"

BLOKNAMEN = {
    "A": "Constructen",
    "B": "Scoring en rapportlogica",
    "C": "Grenzen",
    "D": "Interpretatiefouten herkennen",
    "E": "Ethiek, consent en GDPR",
}

# Uit BLOKPLAN en BLOKPLAN_VERKORT in server/bekwaamheid/schema.ts.
VOL = {"A": 10, "B": 6, "C": 8, "D": 8, "E": 8}
VERKORT = {"A": 5, "B": 3, "C": 4, "D": 4, "E": 4}

LETTERS = "ABCDEF"

items = json.load(io.open(BRON, encoding="utf-8"))
assert len(items) == 80, f"verwacht 80 items, gevonden {len(items)}"

# Op identiteit en niet op waarde: twee items met dezelfde inhoud zouden bij een
# zoektocht op waarde dezelfde index krijgen en dan komt het gebrek bij het
# verkeerde item te staan.
corpusindex_van = {id(x): i for i, x in enumerate(items)}
assert len(corpusindex_van) == len(items), "itemidentiteiten niet uniek"

per_blok = {b: [x for x in items if x["blok"] == b] for b in "ABCDE"}
soorten = Counter(x["soort"] for x in items)

# --- Twee gebreken in de afleiders, gemeten en niet geschat -------------------
#
# Beide zijn klassieke fouten bij het schrijven van meerkeuze-items en beide
# maken een item makkelijker dan het onderwerp is. Ze staan hier bij het item
# zelf, zodat de lezer niet hoeft te zoeken.
#
# 1. Verklappende stam: de sleutel deelt merkbaar meer woorden met de stam dan
#    elke afleider. De kandidaat kan de sleutel aanwijzen op woordvorm, zonder
#    het onderwerp te kennen.
# 2. Afleider is elders sleutel: dezelfde bewering staat bij een ander item als
#    juist antwoord. Wie dat andere item gezien heeft, weet dat deze bewering
#    waar is en kan hem hier wegstrepen om de verkeerde reden.

STOPWOORDEN = set(
    "de het een en of van in op bij is zijn wordt worden dat die dit deze niet"
    " geen te met voor als aan uit over per naar er wat welke wie hoe waarom mag"
    " moet kan hebben heeft".split()
)
DREMPEL_STAM = 0.15
DREMPEL_GELIJKENIS = 0.85


def inhoudswoorden(tekst):
    return {
        w
        for w in re.findall(r"[a-z0-9]+", tekst.lower())
        if w not in STOPWOORDEN and len(w) > 2
    }


keuze_items = [(i, x) for i, x in enumerate(items) if x["soort"] != "juistfout"]
sleutelteksten = {
    i: x["opties"][LETTERS.index(x["sleutel"])] for i, x in keuze_items
}

gebreken = defaultdict(list)
for i, item in keuze_items:
    stam = inhoudswoorden(item["stam"])
    sleutelindex = LETTERS.index(item["sleutel"])
    dekking = [
        len(stam & inhoudswoorden(o)) / max(1, len(inhoudswoorden(o)))
        for o in item["opties"]
    ]
    hoogste_afleider = max(v for j, v in enumerate(dekking) if j != sleutelindex)
    if dekking[sleutelindex] > hoogste_afleider + DREMPEL_STAM:
        gebreken[i].append(
            "de sleutel deelt merkbaar meer woorden met de stam dan elke afleider"
        )
    elders = []
    for j, optie in enumerate(item["opties"]):
        if j == sleutelindex:
            continue
        for k, sleuteltekst in sleutelteksten.items():
            if k == i:
                continue
            gelijk = difflib.SequenceMatcher(
                None, optie.lower(), sleuteltekst.lower()
            ).ratio()
            if gelijk >= DREMPEL_GELIJKENIS:
                elders.append(LETTERS[j])
                break
    if elders:
        gebreken[i].append(
            "afleider " + " en ".join(elders) + " staat elders in de bank als"
            " juist antwoord"
        )

geraakt_per_blok = Counter()
keuze_per_blok = Counter()
for i, item in keuze_items:
    keuze_per_blok[item["blok"]] += 1
    if gebreken[i]:
        geraakt_per_blok[item["blok"]] += 1

r = []
w = r.append

w("# Itembank T4P Business Kompas — kennischeck WETEN")
w("")
w("Tachtig meetitems, blok A tot E. Dit overzicht is **gegenereerd** uit")
w("`server/bekwaamheid/itemcorpus-t4p.json` met `scripts/maak-itemoverzicht.py`.")
w("Het is een leesdocument en geen bron: wie een item wil wijzigen, wijzigt de JSON")
w("en genereert opnieuw. Een met de hand bijgewerkt overzicht loopt uiteen met de")
w("bank, en dan weet niemand meer welke van de twee de vragen zijn.")
w("")
w("Het juiste antwoord is gemarkeerd met **→**. Bij juistfout-items staat de sleutel")
w("onder de stam.")
w("")
w("---")
w("")
w("## Waar dit voor bedoeld is")
w("")
w("Dit document dient de doorloop die nog moet gebeuren. Wat er nu vaststaat:")
w("elk item is herleidbaar naar een paragraaf van het brondossier, de bank haalt de")
w("formele eisen, en een tegenlezing heeft drie inhoudelijke fouten laten")
w("herstellen. Wat er **niet** vaststaat: dat dit de meest relevante tachtig vragen")
w("zijn. Die weging vraagt iemand die weet wat er in de praktijk misgaat.")
w("")
w(
    f"En er is een gebrek dat bij het lezen van dit overzicht boven kwam en dat de"
    f" formele tests niet zien: **{sum(geraakt_per_blok.values())} van de"
    f" {len(keuze_items)} keuze-items zijn makkelijker dan hun onderwerp**, doordat"
    " de afleiders niet werken. Zie de paragraaf hieronder. Bij elk getroffen item"
    " staat het erbij."
)
w("")
w("Voorstel bij het lezen: zet per item één van drie letters in de kantlijn.")
w("")
w("| Letter | Betekenis |")
w("| --- | --- |")
w("| **E** | Essentieel. Wie dit niet weet, hoort geen licentie te krijgen. |")
w("| **N** | Nuttig, maar niet beslissend. |")
w("| **O** | Overbodig, of te ver van de praktijk. |")
w("")
w("En daarnaast de vraag die dit overzicht niet kan stellen: **wat mist hier?**")
w("Elke vraag die uit die vraag komt, is relevanter dan een vraag die uit de code")
w("is afgeleid.")
w("")
w("---")
w("")
w("## Verdeling")
w("")
w("| Blok | Onderwerp | In de bank | Volle check | Verkorte check |")
w("| --- | --- | --- | --- | --- |")
for b in "ABCDE":
    w(f"| {b} | {BLOKNAMEN[b]} | {len(per_blok[b])} | {VOL[b]} | {VERKORT[b]} |")
w(f"| | **totaal** | **{len(items)}** | **40** | **20** |")
w("")
w(
    f"Naar soort: {soorten['scenario']} scenario, {soorten['meerkeuze']} meerkeuze, "
    f"{soorten['juistfout']} juistfout. Geen open items in deze eerste vulling."
)
w("")
w("De bank is ruimer dan de check omdat §4.3 twee equivalente versies vraagt voor")
w("herkansingen. Blok A vraagt tien items per check, dus twee versies zonder")
w("overlap vragen twintig blok-A-items.")
w("")
w("---")
w("")
w("## Het gebrek in de afleiders")
w("")
w("Een meerkeuze-item meet alleen iets als de verkeerde antwoorden geloofwaardig")
w("zijn voor wie het niet weet. Twee fouten daartegen zitten in deze bank, beide")
w("gemeten en niet geschat:")
w("")
w("1. **Verklappende stam.** De sleutel deelt merkbaar meer woorden met de vraag")
w("   dan elke afleider. De kandidaat kan het juiste antwoord aanwijzen op")
w("   woordvorm, zonder het onderwerp te kennen.")
w("2. **Afleider is elders sleutel.** Dezelfde bewering staat bij een ander item")
w("   als juist antwoord. Wie dat item gezien heeft, weet dat de bewering waar is")
w("   en streept hem hier weg om de verkeerde reden.")
w("")
w("| Blok | Keuze-items | Met gebrek |")
w("| --- | --- | --- |")
for b in "ABCDE":
    w(f"| {b} | {keuze_per_blok[b]} | {geraakt_per_blok[b]} |")
w(
    f"| **totaal** | **{len(keuze_items)}** |"
    f" **{sum(geraakt_per_blok.values())}** |"
)
w("")
w("De verdeling is het zorgelijke deel. Het gebrek zit vrijwel volledig in blok C,")
w("en blok C is juist het blok dat §4.3 met opzet zwaar heeft gewogen: daar zit de")
w("schade van iets beweren wat je niet mag beweren. Vier beweringen over wat er in")
w("het onderzoek ontbreekt — geen betrouwbaarheidscoëfficiënt, geen test-hertest,")
w("geen normgroep, de IVOC-toets — staan elk vijf keer in de bank, nu eens als")
w("juist antwoord en dan weer als afleider. Dat is precies het patroon dat een blok")
w("in schijn moeilijk en in werkelijkheid raadbaar maakt.")
w("")
w("De juistfout-items en de toelichtingen zijn hier niet bij betrokken; die staan.")
w("Het gebrek zit in de opties.")
w("")
w("---")
w("")

for b in "ABCDE":
    rijen = per_blok[b]
    ks = Counter(x["sleutel"] for x in rijen)
    ss = Counter(x["soort"] for x in rijen)
    w(f"## Blok {b} — {BLOKNAMEN[b]}")
    w("")
    w(
        f"{len(rijen)} items in de bank, {VOL[b]} in een volle check, "
        f"{VERKORT[b]} in een verkorte."
    )
    verdeling = ", ".join(f"{k}: {v}" for k, v in sorted(ks.items()))
    soortlijst = ", ".join(f"{v} {k}" for k, v in sorted(ss.items()))
    w("")
    w(f"Soorten: {soortlijst}. Sleutelverdeling: {verdeling}.")
    w("")

    if geraakt_per_blok[b]:
        w(
            f"Van deze {keuze_per_blok[b]} keuze-items hebben"
            f" {geraakt_per_blok[b]} een gebrek in de afleiders."
        )
        w("")

    for nr, item in enumerate(rijen, start=1):
        corpusindex = corpusindex_van[id(item)]
        w(f"### {b}{nr:02d}")
        w("")
        w(f"*{item['soort']} · bron: {item['bronVerwijzing']}*")
        w("")
        if gebreken.get(corpusindex):
            for regel in gebreken[corpusindex]:
                w(f"> **Gebrek:** {regel}.")
            w("")
        w(item["stam"])
        w("")

        if item["soort"] == "juistfout":
            w(f"→ **{item['sleutel']}**")
        else:
            sleutelindex = LETTERS.index(item["sleutel"])
            for i, optie in enumerate(item["opties"]):
                merk = "→ **" if i == sleutelindex else "&nbsp;&nbsp;&nbsp;"
                staart = "**" if i == sleutelindex else ""
                w(f"{merk}{LETTERS[i]}. {optie}{staart}")
        w("")
        w(f"**Bij juist:** {item['toelichtingGoed']}")
        w("")
        w(f"**Bij fout:** {item['toelichtingFout']}")
        w("")
        w("---")
        w("")

w("## Herkomst van de antwoorden")
w("")
w("De blokken A tot D verwijzen uitsluitend naar `docs/ITEMBRON-T4P-KENNISCHECK.md`,")
w("het brondossier dat rechtstreeks uit de code is geoogst: de instrumentdefinitie")
w("van het T4P Business Kompas, `server/scoring.ts`, `shared/energie-schaal.ts`,")
w("`shared/onderbouwing-t4professional.ts` en de rechtsgronden op `afnames` en")
w("`bekwaamheid_rondes`. Zes items in blok E verwijzen naar de AVG zelf, omdat de")
w("wet daar de maatstaf is en niet de code. Beide regels staan vast in")
w("`tests/bekwaamheid-itemcorpus.test.ts`.")
w("")
w("## Wat er nog niet onder ligt")
w("")
w("`p_waarde` en `discriminatie` zijn bij alle tachtig items leeg. Dat is met opzet:")
w("er zijn nul afnames. De analyselaag `server/bekwaamheid/itemanalyse.ts` kan die")
w("getallen berekenen maar zwijgt onder twintig afnames per item. Tot dat moment is")
w("van geen enkel item bekend of het te moeilijk is, te makkelijk, of omgekeerd")
w("werkt.")
w("")
w("De drempel van 60% uit §4.3 is een **conventie en geen ijking**: een")
w("Angoff-procedure staat permanent buiten bereik. Dat is dezelfde status als de")
w("energiebanden 7,5 / 5 / 3, waar `shared/energie-schaal.ts` woordelijk")
w('"CONVENTIE, GEEN IJKING" bij zet.')
w("")

tekst = "\n".join(r)
if not tekst.endswith("\n"):
    tekst += "\n"
io.open(DOEL, "w", encoding="utf-8").write(tekst)

print(f"geschreven: {DOEL}")
print(f"items: {len(items)}, regels: {len(tekst.splitlines())}")
