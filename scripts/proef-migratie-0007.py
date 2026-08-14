#!/usr/bin/env python3
"""Bewijst dat migratie 0007 doet wat ze belooft, op een wegwerpdatabank.

De echte data.db wordt niet aangeraakt.

LET OP, en dit is bij het schrijven van deze proef een echte vondst geweest: de
eerste versie liep met PRAGMA foreign_keys aan, waardoor elke INSERT viel op de
vreemde sleutel naar bekwaamheid_rondes. De proef meldde toen dat de verboden
waarden werden geweigerd, maar ze werden geweigerd om de VERKEERDE reden. Deze
versie maakt daarom eerst echte rondes aan en controleert bij elke weigering of
de melding werkelijk over de CHECK gaat.
"""
import io
import os
import sqlite3
import sys
import tempfile

TOEGESTAAN = ["bekrachtigd", "bekrachtigd_met_aandachtspunt", "voorwaardelijk",
              "opgeschort", "beeindigd"]
VERBODEN = ["herkansing", "niet_bekrachtigd", "gezakt", "", "BEKRACHTIGD"]

fouten = []
_ronde = 0


def eis(voorwaarde, wat):
    print(f"  {'OK  ' if voorwaarde else 'FOUT'} {wat}")
    if not voorwaarde:
        fouten.append(wat)


def lees(pad):
    with io.open(pad, encoding="utf-8") as f:
        return f.read()


def alle_migraties(tot):
    """De migratiebestanden op naam gesorteerd, tot en met `tot`.

    De volledige keten is nodig en niet alleen 0006: bekwaamheid_geaccrediteerden
    verwijst naar `beheerders`, en die tabel komt uit 0000. Een eerdere versie van
    deze proef draaide alleen 0006 en viel om met "no such table: main.beheerders".
    """
    namen = sorted(
        n for n in os.listdir("migrations")
        if n.endswith(".sql") and n[:4] <= tot
    )
    return [os.path.join("migrations", n) for n in namen]


def bouw(db, met_rij=False):
    """Draait alles tot en met 0006 en dan 0007, zoals de loper dat doet."""
    for pad in alle_migraties("0006"):
        db.executescript(lees(pad))
    if met_rij:
        maak_ronde(db, 1)
        db.execute(
            "INSERT INTO bekwaamheid_beslissingen (ronde_id, voorstel_uitkomst,"
            " voorstel_berekening, definitieve_uitkomst, bekrachtiger_een_id,"
            " bekrachtiger_twee_id, bekrachtigd_op) VALUES (?,?,?,?,?,?,?)",
            (1, "bekrachtigd", "{}", "bekrachtigd", 1, 2, NU),
        )
    db.executescript(lees("migrations/0007_beslisuitkomsten.sql"))


def kolommen(db, tabel):
    return [k[1] for k in db.execute(f"PRAGMA table_info({tabel})")]


NU = "2026-08-13T00:00:00.000Z"

# Tweehonderd tekens, want de CHECK op bekwaamheid_normprofielen eist dat. Geen
# vulling: dit is de werkelijke reden waarom deze proef bestaat.
ONDERBOUWING = (
    "Wegwerpnormprofiel voor de proef op migratie 0007. Deze proef bestaat omdat "
    "een migratie die een CHECK herschrijft, niet op haar tekst te vertrouwen is: "
    "pas als de databank de nieuwe waarden aanvaardt en de oude weigert, staat "
    "vast dat de correctie er werkelijk in zit."
)

_opgezet = set()


def maak_ronde(db, id_):
    """Bouwt de volledige keten die een ronde nodig heeft.

    Twee niveaus: een geaccrediteerde en een normprofiel. Bewust met de hand
    geschreven en niet uit PRAGMA table_info afgeleid; een eerdere versie deed dat
    laatste en viel stil om, waardoor de proef de vreemde sleutel meette in plaats
    van de CHECK.

    De geaccrediteerde wordt met coach_register_id geidentificeerd en niet met een
    e-mailadres. Een verzonnen adres in de broncode is precies waar het commentaar
    bij die tabel tegen waarschuwt.
    """
    if db not in _opgezet:
        db.execute(
            "INSERT OR IGNORE INTO bekwaamheid_geaccrediteerden"
            " (id, coach_register_id, naam, created_at, updated_at)"
            " VALUES (1, 1, 'Proefpersoon', ?, ?)",
            (NU, NU),
        )
        db.execute(
            "INSERT OR IGNORE INTO bekwaamheid_normprofielen"
            " (id, instrument_id, versie, weging, drempel_totaal, drempel_per_as,"
            "  activiteitsdrempel, activiteitsvenster_maanden, methode,"
            "  paneel_omschrijving, vastgesteld_op, vastgesteld_door, bevroren_op,"
            "  onderbouwing)"
            " VALUES (1, 'proef', 1, ?, 0.7, ?, 6, 24, 'proef', 'proef', ?,"
            "  'proef', ?, ?)",
            (
                '{"weten":0.2,"zien":0.3,"zeggen":0.3,"zorgen":0.2}',
                '{"weten":0.6,"zien":0.6,"zeggen":0.6,"zorgen":0.6}',
                NU, NU, ONDERBOUWING,
            ),
        )
        _opgezet.add(db)
    db.execute(
        "INSERT OR IGNORE INTO bekwaamheid_rondes"
        " (id, geaccrediteerde_id, instrument_id, normprofiel_id, soort,"
        "  codenummer, geopend_op, venster_tot)"
        " VALUES (?, 1, 'proef', 1, 'bekrachtiging', ?, ?, ?)",
        (id_, f"P-{id_}", NU, "2028-08-13T00:00:00.000Z"),
    )


def rij(db, voorstel, definitief=None, motivering=None, een=1, twee=2,
        gepubliceerd=None, debrief=None, ronde=None):
    global _ronde
    if ronde is None:
        _ronde += 1
        ronde = _ronde
    maak_ronde(db, ronde)
    db.execute(
        "INSERT INTO bekwaamheid_beslissingen (ronde_id, voorstel_uitkomst,"
        " voorstel_berekening, definitieve_uitkomst, afwijking_motivering,"
        " bekrachtiger_een_id, bekrachtiger_twee_id, bekrachtigd_op,"
        " gepubliceerd_op, debrief_op) VALUES (?,?,?,?,?,?,?,?,?,?)",
        (ronde, voorstel, "{}", definitief if definitief else voorstel,
         motivering, een, twee, NU, gepubliceerd, debrief),
    )


def verwacht_weigering(db, wat, beperking, **kw):
    """Eist een weigering EN dat ze om de bedoelde beperking gaat."""
    try:
        rij(db, **kw)
        eis(False, f"{wat} (werd AANVAARD)")
    except sqlite3.IntegrityError as e:
        melding = str(e)
        if beperking in melding:
            eis(True, f"{wat} — op '{beperking}'")
        else:
            eis(False, f"{wat} — maar om de VERKEERDE reden: {melding}")


def main():
    db = sqlite3.connect(os.path.join(tempfile.mkdtemp(), "proef.db"))
    # AAN, zoals borgDatabankIntegriteit() het na de migraties zet. Zo meet de
    # proef de toestand waarin het platform werkelijk draait.
    db.execute("PRAGMA foreign_keys = ON")
    bouw(db)

    print("== de vijf uitkomsten uit draaiboek 5.3 worden aanvaard ==")
    for waarde in TOEGESTAAN:
        try:
            rij(db, waarde)
            eis(True, f"'{waarde}' wordt aanvaard")
        except sqlite3.IntegrityError as e:
            eis(False, f"'{waarde}' wordt aanvaard ({e})")

    print("== de oude en de afkeurende woorden worden geweigerd ==")
    for waarde in VERBODEN:
        verwacht_weigering(
            db, f"'{waarde}' wordt geweigerd",
            "bekwaamheid_beslissing_voorstel", voorstel=waarde,
        )

    print("== ook de definitieve kolom is begrensd ==")
    verwacht_weigering(
        db, "'herkansing' als definitieve uitkomst wordt geweigerd",
        "bekwaamheid_beslissing_definitief",
        voorstel="bekrachtigd", definitief="herkansing", motivering="x" * 40,
    )

    print("== de vier andere CHECKs werken nog ==")
    verwacht_weigering(
        db, "gelijke bekrachtigers geweigerd",
        "bekwaamheid_beslissing_bekrachtigers_verschillen",
        voorstel="bekrachtigd", een=7, twee=7,
    )
    verwacht_weigering(
        db, "afwijking met een motivering van 39 tekens geweigerd",
        "bekwaamheid_beslissing_afwijking_gemotiveerd",
        voorstel="bekrachtigd", definitief="opgeschort", motivering="x" * 39,
    )
    try:
        rij(db, "bekrachtigd", definitief="opgeschort", motivering="x" * 40)
        eis(True, "afwijking met een motivering van 40 tekens aanvaard")
    except sqlite3.IntegrityError as e:
        eis(False, f"afwijking met 40 tekens aanvaard ({e})")
    verwacht_weigering(
        db, "publicatie zonder debrief geweigerd",
        "bekwaamheid_beslissing_publicatie_na_debrief",
        voorstel="bekrachtigd", gepubliceerd=NU,
    )

    print("== de unieke index op ronde_id staat er nog ==")
    rij(db, "bekrachtigd", ronde=5555)
    try:
        rij(db, "bekrachtigd", ronde=5555)
        eis(False, "tweede beslissing op dezelfde ronde geweigerd (werd AANVAARD)")
    except sqlite3.IntegrityError as e:
        eis("uq_bekwaamheid_beslissing_ronde" in str(e) or "UNIQUE" in str(e),
            f"tweede beslissing op dezelfde ronde geweigerd — {e}")

    print("== de uitgaande vreemde sleutel werkt nog ==")
    try:
        db.execute(
            "INSERT INTO bekwaamheid_beslissingen (ronde_id, voorstel_uitkomst,"
            " voorstel_berekening, definitieve_uitkomst, bekrachtiger_een_id,"
            " bekrachtiger_twee_id, bekrachtigd_op) VALUES (?,?,?,?,?,?,?)",
            (999999, "bekrachtigd", "{}", "bekrachtigd", 1, 2, NU),
        )
        eis(False, "een onbestaande ronde geweigerd (werd AANVAARD)")
    except sqlite3.IntegrityError as e:
        eis("FOREIGN KEY" in str(e), f"een onbestaande ronde geweigerd — {e}")

    print("== de kolommen zijn ongewijzigd ==")
    verwacht = ["id", "ronde_id", "voorstel_uitkomst", "voorstel_berekening",
                "definitieve_uitkomst", "afwijking_motivering",
                "bekrachtiger_een_id", "bekrachtiger_twee_id", "bekrachtigd_op",
                "gepubliceerd_op", "debrief_op", "debrief_door"]
    na = kolommen(db, "bekwaamheid_beslissingen")
    eis(na == verwacht, f"twaalf kolommen in dezelfde orde (gevonden: {len(na)})")

    print("== een bestaande rij overleeft de herbouw ==")
    db2 = sqlite3.connect(os.path.join(tempfile.mkdtemp(), "proef2.db"))
    db2.execute("PRAGMA foreign_keys = ON")
    bouw(db2, met_rij=True)
    bewaard = db2.execute(
        "SELECT ronde_id, voorstel_uitkomst, definitieve_uitkomst"
        " FROM bekwaamheid_beslissingen"
    ).fetchall()
    eis(bewaard == [(1, "bekrachtigd", "bekrachtigd")],
        f"de rij staat er ongewijzigd na de herbouw ({bewaard})")
    rest = db2.execute(
        "SELECT name FROM sqlite_master WHERE name LIKE '%_nieuw'"
    ).fetchall()
    eis(rest == [], f"geen werktabel achtergebleven ({rest})")

    print("== een rij met een oude waarde laat de migratie vallen ==")
    db3 = sqlite3.connect(os.path.join(tempfile.mkdtemp(), "proef3.db"))
    db3.execute("PRAGMA foreign_keys = ON")
    for pad in alle_migraties("0006"):
        db3.executescript(lees(pad))
    maak_ronde(db3, 1)
    db3.execute(
        "INSERT INTO bekwaamheid_beslissingen (ronde_id, voorstel_uitkomst,"
        " voorstel_berekening, definitieve_uitkomst, bekrachtiger_een_id,"
        " bekrachtiger_twee_id, bekrachtigd_op) VALUES (?,?,?,?,?,?,?)",
        (1, "herkansing", "{}", "herkansing", 1, 2, NU),
    )
    try:
        db3.executescript(lees("migrations/0007_beslisuitkomsten.sql"))
        eis(False, "migratie valt op een oude waarde (ze LIEP DOOR)")
    except sqlite3.IntegrityError:
        # Dit is de bedoelde uitkomst: de migratie verzint geen nieuwe uitkomst
        # voor een beslissing die een mens genomen heeft.
        eis(True, "migratie valt op een oude waarde in plaats van haar te hertalen")

    print()
    if fouten:
        print(f"NIET GOED: {len(fouten)} bevinding(en)")
        for f in fouten:
            print(f"  - {f}")
        return 1
    print("ALLES GOED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
