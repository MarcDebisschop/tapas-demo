#!/usr/bin/env python3
"""Rijtelling van elke tabel in data.db, in de vorm `tabel|aantal`.

Bestaat omdat de vergelijking van rijaantallen tussen blokken tweemaal is
misgelopen op een verschil in uitvoervorm — één keer `table count`, één keer
`table|count`. Eén script betekent één vorm.

Gebruik:  python3 scripts/rijtelling.py [uitvoerbestand]
"""
import sqlite3
import sys

db = sqlite3.connect("data.db")
tabellen = [
    r[0]
    for r in db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' "
        "AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
]
regels = []
for naam in tabellen:
    aantal = db.execute(f'SELECT COUNT(*) FROM "{naam}"').fetchone()[0]
    regels.append(f"{naam}|{aantal}")

uit = sys.argv[1] if len(sys.argv) > 1 else None
if uit:
    with open(uit, "w", encoding="utf-8") as f:
        f.write("\n".join(regels) + "\n")
    print(f"{len(regels)} tabellen geschreven naar {uit}")
else:
    print("\n".join(regels))
