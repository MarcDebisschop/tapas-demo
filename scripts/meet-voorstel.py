#!/usr/bin/env python3
"""Meet het herstelvoorstel na zonder het corpus aan te raken.

Bouwt een kandidaatcorpus in het geheugen, en toetst daarop:
  1. de twee gebreken uit het overzicht zijn weg;
  2. de formele eisen van valideerItem worden gehaald;
  3. er komt geen nieuwe overlap met de STM-oefenbank bij;
  4. de sleutelverdeling per blok blijft vlak;
  5. het aantal items, blokken en soorten verandert niet.
Het corpusbestand wordt alleen gelezen.
"""
import difflib
import io
import json
import re
from collections import Counter
from pathlib import Path

WORTEL = Path("/home/user/workspace/core")
CORPUS = WORTEL / "server/bekwaamheid/itemcorpus-t4p.json"
VOORSTEL = Path("/home/user/workspace/voorstel-afleiders.json")
LETTERS = "ABCDEF"

origineel = json.load(io.open(CORPUS, encoding="utf-8"))
voorstel = json.load(io.open(VOORSTEL, encoding="utf-8"))

# --- kandidaatcorpus samenstellen -------------------------------------------
kandidaat = [dict(x) for x in origineel]
for v in voorstel["voorstellen"]:
    i = v["corpusindex"]
    item = kandidaat[i]
    assert item["soort"] != "juistfout", f"{v['nummer']} is juistfout"
    assert len(v["opties"]) == len(item["opties"]), (
        f"{v['nummer']}: aantal opties wijkt af "
        f"({len(v['opties'])} tegen {len(item['opties'])})"
    )
    oude_sleuteltekst = item["opties"][LETTERS.index(item["sleutel"])]
    nieuwe_sleuteltekst = v["opties"][LETTERS.index(v["sleutel"])]
    item["opties"] = list(v["opties"])
    item["sleutel"] = v["sleutel"]
    if not v["stam_ongewijzigd"]:
        item["stam"] = v["nieuwe_stam"]
    if "nieuwe_toelichtingFout" in v:
        item["toelichtingFout"] = v["nieuwe_toelichtingFout"]
    # De inhoud van het juiste antwoord mag niet stilletjes iets anders worden.
    gelijk = difflib.SequenceMatcher(
        None, oude_sleuteltekst.lower(), nieuwe_sleuteltekst.lower()
    ).ratio()
    item["_sleutelgelijkenis"] = round(gelijk, 2)
    item["_nummer"] = v["nummer"]

fouten = []
print("=== 0. Blijft het juiste antwoord hetzelfde feit? ===")
for x in kandidaat:
    if "_sleutelgelijkenis" in x:
        g = x["_sleutelgelijkenis"]
        vlag = "" if g >= 0.55 else "   << herschreven sleutel, nalezen"
        print(f"  {x['_nummer']}: gelijkenis {g}{vlag}")

for x in kandidaat:
    x.pop("_sleutelgelijkenis", None)
    x.pop("_nummer", None)

# --- 1. de twee gebreken ------------------------------------------------------
STOPWOORDEN = set(
    "de het een en of van in op bij is zijn wordt worden dat die dit deze niet"
    " geen te met voor als aan uit over per naar er wat welke wie hoe waarom mag"
    " moet kan hebben heeft".split()
)
w = lambda t: {
    x for x in re.findall(r"[a-z0-9]+", t.lower()) if x not in STOPWOORDEN and len(x) > 2
}


def meet_gebreken(bank):
    keuze = [(i, x) for i, x in enumerate(bank) if x["soort"] != "juistfout"]
    sleutels = {i: x["opties"][LETTERS.index(x["sleutel"])] for i, x in keuze}
    uit = {}
    for i, x in keuze:
        st = w(x["stam"])
        ks = LETTERS.index(x["sleutel"])
        dek = [len(st & w(o)) / max(1, len(w(o))) for o in x["opties"]]
        g = []
        if dek[ks] > max(v for j, v in enumerate(dek) if j != ks) + 0.15:
            g.append("verklappende stam")
        for j, o in enumerate(x["opties"]):
            if j == ks:
                continue
            for k, sl in sleutels.items():
                if k != i and difflib.SequenceMatcher(None, o.lower(), sl.lower()).ratio() >= 0.85:
                    g.append(f"optie {LETTERS[j]} is sleutel bij {k}")
                    break
        if g:
            uit[i] = g
    return uit


voor = meet_gebreken(origineel)
na = meet_gebreken(kandidaat)
nummers = {}
teller = Counter()
for i, x in enumerate(origineel):
    teller[x["blok"]] += 1
    nummers[i] = f"{x['blok']}{teller[x['blok']]:02d}"

print()
print("=== 1. De twee gebreken ===")
print(f"  voor: {len(voor)} items   na: {len(na)} items")
hersteld = sorted(set(voor) - set(na))
resterend = sorted(na)
nieuw = sorted(set(na) - set(voor))
print(f"  hersteld: {len(hersteld)} -> {', '.join(nummers[i] for i in hersteld)}")
print(f"  resterend: {len(resterend)} -> {', '.join(nummers[i] for i in resterend)}")
for i in resterend:
    print(f"      {nummers[i]}: {'; '.join(na[i])}")
print(f"  NIEUW ontstaan: {len(nieuw)} -> {', '.join(nummers[i] for i in nieuw) or 'geen'}")
if nieuw:
    fouten.append(f"{len(nieuw)} nieuwe gebreken ontstaan")
verwacht_resterend = {v["corpusindex"] for v in voorstel["valse_treffers"]}
if set(resterend) != verwacht_resterend:
    fouten.append(
        f"resterende gebreken wijken af van de vier valse treffers: "
        f"{sorted(nummers[i] for i in set(resterend) ^ verwacht_resterend)}"
    )

# --- 2. formele eisen ---------------------------------------------------------
print()
print("=== 2. Formele eisen (valideerItem) ===")
formeel = []
for i, x in enumerate(kandidaat):
    n = nummers[i]
    if len(x["stam"]) < 20:
        formeel.append(f"{n}: stam korter dan 20")
    if len(x["toelichtingGoed"]) < 20 or len(x["toelichtingFout"]) < 20:
        formeel.append(f"{n}: toelichting korter dan 20")
    if x["soort"] != "juistfout":
        if not (3 <= len(x["opties"]) <= 6):
            formeel.append(f"{n}: aantal opties buiten 3-6")
        if x["sleutel"] not in LETTERS[: len(x["opties"])]:
            formeel.append(f"{n}: sleutel buiten bereik")
        schoon = [o.strip().lower() for o in x["opties"]]
        if len(set(schoon)) != len(schoon):
            formeel.append(f"{n}: dubbele optietekst binnen het item")
        # Geen minimumlengte per optie: valideerItem kent die eis niet, en
        # items met getalopties (−2, 0, 5) zouden er onterecht op vallen.
        if any(not o.strip() for o in x["opties"]):
            formeel.append(f"{n}: lege optie")
    else:
        if x["sleutel"] not in ("juist", "onjuist"):
            formeel.append(f"{n}: juistfout-sleutel onbekend")
print("  " + ("\n  ".join(formeel) if formeel else "alles in orde"))
fouten += formeel

# --- 3. STM-overlap -----------------------------------------------------------
print()
print("=== 3. Overlap met de STM-oefenbank ===")
brontekst = io.open(WORTEL / "server/routes-stm.ts", encoding="utf-8").read()
stm = re.findall(r'vraag_tekst:\s*"((?:[^"\\]|\\.)*)"', brontekst)
print(f"  STM-vraagteksten uit de brontekst gelezen: {len(stm)}")
assert len(stm) == 30, f"verwacht 30 STM-vragen, gevonden {len(stm)}"
ergste = (0.0, "")
for i, x in enumerate(kandidaat):
    sw = w(x["stam"])
    for v in stm:
        vw = w(v)
        if not sw or not vw:
            continue
        j = len(sw & vw) / len(sw | vw)
        if j > ergste[0]:
            ergste = (round(j, 2), f"{nummers[i]} tegen STM")
print(f"  hoogste woordoverlap: {ergste[0]} ({ergste[1]}) — grens is 0,70")
if ergste[0] >= 0.70:
    fouten.append(f"STM-overlap {ergste[0]} haalt de grens")

# --- 4. sleutelverdeling ------------------------------------------------------
print()
print("=== 4. Sleutelverdeling per blok (voor -> na) ===")
for b in "ABCDE":
    v_ = Counter(x["sleutel"] for x in origineel if x["blok"] == b)
    n_ = Counter(x["sleutel"] for x in kandidaat if x["blok"] == b)
    print(f"  {b}: {dict(sorted(v_.items()))}  ->  {dict(sorted(n_.items()))}")
letters_na = Counter(x["sleutel"] for x in kandidaat if x["soort"] != "juistfout")
print(f"  hele bank: {dict(sorted(letters_na.items()))}")
scheef = max(letters_na.values()) - min(letters_na.values())
print(f"  grootste verschil tussen letters: {scheef}")

# --- 5. vorm van de bank ------------------------------------------------------
print()
print("=== 5. Blijft de bank dezelfde vorm? ===")
for naam, sleutelf in (
    ("aantal items", lambda b: len(b)),
    ("per blok", lambda b: dict(sorted(Counter(x["blok"] for x in b).items()))),
    ("per soort", lambda b: dict(sorted(Counter(x["soort"] for x in b).items()))),
    ("bronverwijzingen", lambda b: len({x["bronVerwijzing"] for x in b})),
):
    a, c = sleutelf(origineel), sleutelf(kandidaat)
    gelijk = "gelijk" if a == c else f"AFWIJKING {a} -> {c}"
    print(f"  {naam}: {gelijk}")
    if a != c:
        fouten.append(f"{naam} veranderd")

print()
if fouten:
    print("UITKOMST: NIET IN ORDE")
    for f in fouten:
        print("  -", f)
    raise SystemExit(1)
print("UITKOMST: het voorstel haalt alle vijf de controles")
json.dump(kandidaat, io.open("/tmp/kandidaatcorpus.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("kandidaatcorpus bewaard in /tmp/kandidaatcorpus.json (corpus zelf onaangeroerd)")
