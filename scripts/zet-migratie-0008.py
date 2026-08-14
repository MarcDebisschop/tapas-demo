#!/usr/bin/env python3
"""Voegt migratie 0008 toe aan het register van de loper en aan haar tests."""
import io
import sys

FOUT = 0


def bewerk(pad, paren):
    global FOUT
    s = io.open(pad, encoding="utf-8").read()
    for anker, nieuw in paren:
        n = s.count(anker)
        if n != 1:
            print("FOUT %s: anker komt %d keer voor: %r" % (pad, n, anker[:70]))
            FOUT = 1
            return
        s = s.replace(anker, nieuw, 1)
    io.open(pad, "w", encoding="utf-8").write(s)
    print("OK %s -> %d regels" % (pad, s.count("\n") + 1))


LOPER_ANKER = '''  "0007_beslisuitkomsten": (db) =>
    tabelOmschrijvingBevat(db, "bekwaamheid_beslissingen", "'opgeschort'"),
};'''

LOPER_NIEUW = '''  "0007_beslisuitkomsten": (db) =>
    tabelOmschrijvingBevat(db, "bekwaamheid_beslissingen", "'opgeschort'"),
  // 0008 herbouwt bekwaamheid_items om er de kolom `blok` met twee CHECKs aan toe
  // te voegen; SQLite kan een kolom met CHECK niet los toevoegen. Ook dit
  // verdraagt geen tweede loop. De toets kijkt naar de kolom en niet naar de
  // CHECK-tekst: de kolom is wat de rest van de module nodig heeft, en een
  // kolomtoets blijft kloppen als een latere migratie de CHECK aanscherpt.
  "0008_itemblokken": (db) => kolomBestaat(db, "bekwaamheid_items", "blok"),
};'''

bewerk("server/migratieloper.ts", [(LOPER_ANKER, LOPER_NIEUW)])

TEST_A = '''      "0006_bekwaamheid",
      "0007_beslisuitkomsten",
    ]);'''

TEST_A_NIEUW = '''      "0006_bekwaamheid",
      "0007_beslisuitkomsten",
      "0008_itemblokken",
    ]);'''

TEST_B = '''    // De werktabel mag niet blijven staan.
    expect(tabelBestaat(db, "bekwaamheid_beslissingen_nieuw")).toBe(false);
  });
});'''

TEST_B_NIEUW = '''    // De werktabel mag niet blijven staan.
    expect(tabelBestaat(db, "bekwaamheid_beslissingen_nieuw")).toBe(false);
  });

  it("levert na 0008 een itembank met de kolom blok en beide grenzen erop", () => {
    // 0008 herbouwt bekwaamheid_items. Zou die herbouw half lopen of stil worden
    // overgeslagen, dan staat er een tabel zonder blokkolom en is de verdeling
    // A10/B6/C8/D8/E8 uit het draaiboek niet af te dwingen. Erger: de
    // samensteller zou dan items zonder blok aannemen en een set opleveren
    // waarvan niemand kan zeggen of ze de verdeling haalt. Deze test meet de
    // eindtoestand.
    pasMigratiesToe(db, echteMigraties);

    expect(kolomBestaat(db, "bekwaamheid_items", "blok")).toBe(true);

    // De twee CHECKs moeten er echt staan, niet alleen de kolom. Een kolom
    // zonder grens laat 'F' en 'blok 3' toe.
    db.exec(
      `INSERT INTO bekwaamheid_items
         (instrument_id, "as", blok, soort, stam, sleutel, toelichting_goed,
          toelichting_fout, gebruik, versie, actief)
       VALUES ('t4p', 'weten', 'C', 'meerkeuze', 'Een stam die lang genoeg is.',
               'B', 'Omdat dit klopt volgens de handleiding.',
               'Omdat dit niet klopt volgens de handleiding.', 'meten', 1, 1)`,
    );

    // Een blok buiten A tot E moet stuklopen.
    expect(() =>
      db.exec(
        `INSERT INTO bekwaamheid_items
           (instrument_id, "as", blok, soort, stam, sleutel, toelichting_goed,
            toelichting_fout, gebruik, versie, actief)
         VALUES ('t4p', 'weten', 'F', 'meerkeuze', 'Een stam die lang genoeg is.',
                 'B', 'Omdat dit klopt volgens de handleiding.',
                 'Omdat dit niet klopt volgens de handleiding.', 'meten', 1, 1)`,
      ),
    ).toThrow();

    // Een blok op een andere as dan weten moet ook stuklopen: de blokken zijn de
    // indeling van de kennischeck, en die meet weten.
    expect(() =>
      db.exec(
        `INSERT INTO bekwaamheid_items
           (instrument_id, "as", blok, soort, stam, sleutel, toelichting_goed,
            toelichting_fout, gebruik, versie, actief)
         VALUES ('t4p', 'zien', 'C', 'meerkeuze', 'Een stam die lang genoeg is.',
                 'B', 'Omdat dit klopt volgens de handleiding.',
                 'Omdat dit niet klopt volgens de handleiding.', 'meten', 1, 1)`,
      ),
    ).toThrow();

    // Een item zonder blok blijft toegestaan: er zijn drie andere assen die geen
    // blokindeling hebben.
    db.exec(
      `INSERT INTO bekwaamheid_items
         (instrument_id, "as", soort, stam, sleutel, toelichting_goed,
          toelichting_fout, gebruik, versie, actief)
       VALUES ('t4p', 'zien', 'open', 'Een stam die lang genoeg is.',
               'De sleutel beschrijft waaraan het antwoord moet voldoen.',
               'Omdat dit klopt volgens de handleiding.',
               'Omdat dit niet klopt volgens de handleiding.', 'oefenen', 1, 1)`,
    );

    // De index op instrument moet de herbouw overleefd hebben. Op de naam alleen
    // toetsen volstaat niet: bij 0007 liet een mutatieproef zien dat een index
    // die zijn eigenschappen verliest onopgemerkt doorging. Hier is de
    // eigenschap dat blok in de index zit, want daar loopt de dekkingsvraag over.
    const kolommen = db
      .prepare("PRAGMA index_info(idx_bekwaamheid_item_instrument)")
      .all() as { name: string }[];
    expect(kolommen.map((k) => k.name)).toContain("blok");

    // En de tweede index moet er ook nog zijn.
    const indexen = db
      .prepare("PRAGMA index_list(bekwaamheid_items)")
      .all() as { name: string }[];
    expect(indexen.map((i) => i.name)).toContain("idx_bekwaamheid_item_gebruik");

    // De werktabel mag niet blijven staan.
    expect(tabelBestaat(db, "bekwaamheid_items_nieuw")).toBe(false);
  });
});'''

bewerk("tests/migratieloper.test.ts", [(TEST_A, TEST_A_NIEUW), (TEST_B, TEST_B_NIEUW)])

sys.exit(FOUT)
