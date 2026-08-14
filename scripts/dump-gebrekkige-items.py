#!/usr/bin/env python3
"""Schrijft de items met een gebrek in de afleiders uit naar /tmp voor bewerking.

Gebruikt exact dezelfde meting als scripts/maak-itemoverzicht.py, zodat het
voorstel over precies dezelfde verzameling gaat als het overzicht.
"""
import difflib
import io
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

WORTEL = Path("/home/user/workspace/core")
items = json.load(io.open(WORTEL / "server/bekwaamheid/itemcorpus-t4p.json", encoding="utf-8"))
LETTERS = "ABCDEF"
STOPWOORDEN = set(
    "de het een en of van in op bij is zijn wordt worden dat die dit deze niet"
    " geen te met voor als aan uit over per naar er wat welke wie hoe waarom mag"
    " moet kan hebben heeft".split()
)


def inhoudswoorden(t):
    return {w for w in re.findall(r"[a-z0-9]+", t.lower()) if w not in STOPWOORDEN and len(w) > 2}


keuze = [(i, x) for i, x in enumerate(items) if x["soort"] != "juistfout"]
sleutel = {i: x["opties"][LETTERS.index(x["sleutel"])] for i, x in keuze}

gebreken = defaultdict(list)
for i, x in keuze:
    st = inhoudswoorden(x["stam"])
    ks = LETTERS.index(x["sleutel"])
    dek = [len(st & inhoudswoorden(o)) / max(1, len(inhoudswoorden(o))) for o in x["opties"]]
    if dek[ks] > max(v for j, v in enumerate(dek) if j != ks) + 0.15:
        gebreken[i].append("verklappende stam")
    for j, o in enumerate(x["opties"]):
        if j == ks:
            continue
        for k, sl in sleutel.items():
            if k != i and difflib.SequenceMatcher(None, o.lower(), sl.lower()).ratio() >= 0.85:
                gebreken[i].append(f"optie {LETTERS[j]} is sleutel bij corpusindex {k}")
                break

# nummering per blok, gelijk aan het overzicht
nummer = {}
teller = Counter()
for i, x in enumerate(items):
    teller[x["blok"]] += 1
    nummer[i] = f"{x['blok']}{teller[x['blok']]:02d}"

geraakt = sorted(i for i in gebreken if gebreken[i])
r = []
for i in geraakt:
    x = items[i]
    ks = LETTERS.index(x["sleutel"])
    r.append(f"=== {nummer[i]}  (corpusindex {i})  soort {x['soort']}  bron {x['bronVerwijzing']}")
    r.append(f"GEBREK: {'; '.join(gebreken[i])}")
    r.append(f"STAM: {x['stam']}")
    for j, o in enumerate(x["opties"]):
        r.append(f"  {'*' if j == ks else ' '}{LETTERS[j]}. {o}")
    r.append(f"GOED: {x['toelichtingGoed']}")
    r.append(f"FOUT: {x['toelichtingFout']}")
    r.append("")

io.open("/tmp/gebrekkige-items.txt", "w", encoding="utf-8").write("\n".join(r))
json.dump(
    {"indices": geraakt, "nummer": {str(i): nummer[i] for i in geraakt}},
    io.open("/tmp/gebrekkige-indices.json", "w", encoding="utf-8"),
)
print(f"{len(geraakt)} items uitgeschreven naar /tmp/gebrekkige-items.txt")
print("nummers:", ", ".join(nummer[i] for i in geraakt))
