// ---------------------------------------------------------------------------
// tests/bekwaamheid-poortbrug.test.ts — de brug tussen verzoek en poort.
//
// `poort.ts` is zuiver en heeft 58 tests zonder databank. Deze suite toetst de
// enige laag die wél een databank aanraakt, en dus het enige stuk waar de zes
// feiten verkeerd opgezocht kunnen worden. Een poort die perfect oordeelt over
// verkeerde feiten is nutteloos.
//
// Tegen een echte sqlite in het geheugen, niet tegen een nagemaakte opslaglaag:
// de bezwaarvraag is een join over twee tabellen en juist daar zit het risico.
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import type BetterSqlite3 from "better-sqlite3";
import {
  beoordeelSchrijfweg,
  afnemerUitVerzender,
  weigeringslichaam,
  type Verzender,
} from "../server/bekwaamheid/poortbrug";
import type { AuditInvoer } from "../server/audit-log";
import type { BekwaamheidOpslag } from "../server/bekwaamheid/storage";

/**
 * Twee tabellen, precies de kolommen die de brug leest.
 *
 * Niet de hele migratie 0006: die zou dit bestand laten breken bij elke
 * schemawijziging die de poort niet raakt. Wat de brug leest, staat hier, en de
 * echte migratie is elders getoetst.
 */
function maakDb(): BetterSqlite3.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE toegangen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      beheerder_id INTEGER NOT NULL,
      platformdeel TEXT NOT NULL,
      toegestaan INTEGER NOT NULL
    );
    CREATE TABLE bekwaamheid_rondes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      geaccrediteerde_id INTEGER NOT NULL,
      instrument_id TEXT NOT NULL
    );
    CREATE TABLE bekwaamheid_bezwaren (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ronde_id INTEGER NOT NULL,
      ingediend_op TEXT NOT NULL,
      uitspraak_op TEXT
    );
  `);
  return db;
}

/** Een opslaglaag met alleen wat de brug aanspreekt. */
function maakOpslag(opties: {
  geaccrediteerde?: { id: number; beheerderId: number } | null;
  licentie?: { status: string; geldigVan: string; geldigTot: string | null } | null;
}): BekwaamheidOpslag {
  const rec = opties.geaccrediteerde ?? null;
  return {
    register: {
      vindOpBeheerder: (beheerderId: number) =>
        rec && rec.beheerderId === beheerderId ? { id: rec.id } : undefined,
    },
    licenties: {
      vind: (geaccrediteerdeId: number, instrumentId: string) =>
        rec && geaccrediteerdeId === rec.id && opties.licentie
          ? { instrumentId, ...opties.licentie }
          : undefined,
    },
  } as unknown as BekwaamheidOpslag;
}

const PERSOON: Verzender = { aangemaaktDoorBeheerderId: 1, aangemaaktDoorOrganisatieId: null };
const ORGANISATIE: Verzender = { aangemaaktDoorBeheerderId: null, aangemaaktDoorOrganisatieId: 7 };
const DEELNEMER: Verzender = { aangemaaktDoorBeheerderId: null, aangemaaktDoorOrganisatieId: null };

let db: BetterSqlite3.Database;
let regels: AuditInvoer[];
const audit = (i: AuditInvoer) => {
  regels.push(i);
};

beforeEach(() => {
  db = maakDb();
  regels = [];
});

describe("afnemerUitVerzender — de volgorde van de drie soorten", () => {
  it("een beheerder-id levert een persoon", () => {
    expect(afnemerUitVerzender(PERSOON)).toEqual({ soort: "persoon", geaccrediteerdeId: 1 });
  });

  it("alleen een organisatie levert een organisatie", () => {
    expect(afnemerUitVerzender(ORGANISATIE)).toEqual({ soort: "organisatie", organisatieId: 7 });
  });

  it("niets levert een deelnemer — het zelfstartpad", () => {
    expect(afnemerUitVerzender(DEELNEMER)).toEqual({ soort: "deelnemer" });
  });

  it("een beheerder weegt zwaarder dan een organisatie, ook als beide er staan", () => {
    // Een licentie is altijd die van één mens. Staat er een mens, dan is dat het
    // sterkste feit dat er is; de organisatie is dan alleen de kostenplaats.
    expect(
      afnemerUitVerzender({ aangemaaktDoorBeheerderId: 4, aangemaaktDoorOrganisatieId: 7 }),
    ).toEqual({ soort: "persoon", geaccrediteerdeId: 4 });
  });
});

describe("stand uit — er wordt niets opgezocht en niets gelogd", () => {
  it("laat door zonder de databank aan te raken", async () => {
    const kapot = new Proxy({} as BetterSqlite3.Database, {
      get() {
        throw new Error("de databank mag in stand uit niet aangeraakt worden");
      },
    });
    const u = await beoordeelSchrijfweg(
      { handeling: "afname_aanmaken", instrumentId: "t4kids", verzender: PERSOON, stand: "uit" },
      maakOpslag({}),
      kapot,
      audit,
    );
    expect(u.mag).toBe(true);
    expect(u.toetsbaar).toBe(false);
    expect(regels).toEqual([]);
  });
});

describe("stand log — meten zonder iemand te hinderen", () => {
  it("een persoon zonder registerinschrijving mag door, maar wordt geteld", async () => {
    const u = await beoordeelSchrijfweg(
      { handeling: "afname_aanmaken", instrumentId: "t4kids", verzender: PERSOON, stand: "log" },
      maakOpslag({ geaccrediteerde: null }),
      db,
      audit,
    );
    expect(u.mag).toBe(true);
    expect(u.zouWeigeren).toBe(true);
    expect(u.grond).toBe("niet_in_register");
    expect(regels).toHaveLength(1);
    expect(regels[0].actie).toBe("bekwaamheid_poort_zou_weigeren");
    expect(regels[0].adminId).toBe(1);
    expect(regels[0].detail).toContain("grond niet_in_register");
    expect(regels[0].detail).toContain("beheerder 1");
  });

  it("een organisatie zonder persoon wordt geteld als niet-herleidbaar", async () => {
    const u = await beoordeelSchrijfweg(
      {
        handeling: "uitnodiging_aanmaken",
        instrumentId: "t4students",
        verzender: ORGANISATIE,
        stand: "log",
      },
      maakOpslag({}),
      db,
      audit,
    );
    expect(u.mag).toBe(true);
    expect(u.grond).toBe("afnemer_niet_herleidbaar");
    expect(regels).toHaveLength(1);
    // Geen adminId, want er is geen mens. Precies het probleem dat geteld wordt.
    expect(regels[0].adminId).toBeNull();
    expect(regels[0].detail).toContain("organisatie 7");
  });

  it("het zelfstartpad levert nooit een auditregel op, want het weigert nooit", async () => {
    const u = await beoordeelSchrijfweg(
      { handeling: "afname_aanmaken", instrumentId: "t4kids", verzender: DEELNEMER, stand: "log" },
      maakOpslag({}),
      db,
      audit,
    );
    expect(u.mag).toBe(true);
    expect(u.zouWeigeren).toBe(false);
    expect(u.grond).toBe("zelfstart_buiten_licentiekader");
    expect(regels).toEqual([]);
  });
});

describe("stand handhaaf — nu bijt de poort", () => {
  it("een persoon zonder registerinschrijving wordt geweigerd en hard gelogd", async () => {
    const u = await beoordeelSchrijfweg(
      {
        handeling: "afname_aanmaken",
        instrumentId: "t4kids",
        verzender: PERSOON,
        stand: "handhaaf",
      },
      maakOpslag({ geaccrediteerde: null }),
      db,
      audit,
    );
    expect(u.mag).toBe(false);
    expect(regels).toHaveLength(1);
    expect(regels[0].actie).toBe("bekwaamheid_poort_geweigerd");
  });

  it("een geldige licentie komt door, ook in handhaaf", async () => {
    // T4Kids heeft geen platformdeel; dat is een leemte, geen weigering.
    const u = await beoordeelSchrijfweg(
      {
        handeling: "afname_aanmaken",
        instrumentId: "t4kids",
        verzender: PERSOON,
        stand: "handhaaf",
        peildatum: "2026-08-13",
      },
      maakOpslag({
        geaccrediteerde: { id: 9, beheerderId: 1 },
        licentie: { status: "bekrachtigd", geldigVan: "2025-01-01", geldigTot: "2027-01-01" },
      }),
      db,
      audit,
    );
    expect(u.mag).toBe(true);
    expect(u.grond).toBe("bevoegd");
    expect(u.platformdeelLeemte).toBe(true);
    expect(regels).toEqual([]);
  });

  it("het zelfstartpad blijft ook in handhaaf open", async () => {
    const u = await beoordeelSchrijfweg(
      {
        handeling: "afname_aanmaken",
        instrumentId: "t4kids",
        verzender: DEELNEMER,
        stand: "handhaaf",
      },
      maakOpslag({}),
      db,
      audit,
    );
    expect(u.mag).toBe(true);
    expect(regels).toEqual([]);
  });

  it("een verlopen licentie wordt geweigerd", async () => {
    const u = await beoordeelSchrijfweg(
      {
        handeling: "uitnodiging_aanmaken",
        instrumentId: "t4kids",
        verzender: PERSOON,
        stand: "handhaaf",
        peildatum: "2026-08-13",
      },
      maakOpslag({
        geaccrediteerde: { id: 9, beheerderId: 1 },
        licentie: { status: "bekrachtigd", geldigVan: "2023-01-01", geldigTot: "2024-01-01" },
      }),
      db,
      audit,
    );
    expect(u.mag).toBe(false);
    expect(u.grond).toBe("verlopen");
  });
});

describe("de toegangsvlag wordt werkelijk uit de tabel gelezen", () => {
  const geldig = {
    geaccrediteerde: { id: 9, beheerderId: 1 },
    licentie: { status: "bekrachtigd", geldigVan: "2025-01-01", geldigTot: "2027-01-01" },
  };

  it("T4P Business met het platformdeel op nul wordt geweigerd", async () => {
    db.prepare(`INSERT INTO toegangen (beheerder_id, platformdeel, toegestaan) VALUES (1,'kompas',0)`).run();
    const u = await beoordeelSchrijfweg(
      {
        handeling: "afname_aanmaken",
        instrumentId: "t4p-business-kompas",
        verzender: PERSOON,
        stand: "handhaaf",
        peildatum: "2026-08-13",
      },
      maakOpslag(geldig),
      db,
      audit,
    );
    expect(u.mag).toBe(false);
    expect(u.grond).toBe("platformdeel_geblokkeerd");
  });

  it("dezelfde persoon met het platformdeel op één komt door", async () => {
    db.prepare(`INSERT INTO toegangen (beheerder_id, platformdeel, toegestaan) VALUES (1,'kompas',1)`).run();
    const u = await beoordeelSchrijfweg(
      {
        handeling: "afname_aanmaken",
        instrumentId: "t4p-business-kompas",
        verzender: PERSOON,
        stand: "handhaaf",
        peildatum: "2026-08-13",
      },
      maakOpslag(geldig),
      db,
      audit,
    );
    expect(u.mag).toBe(true);
    expect(u.grond).toBe("bevoegd");
    expect(u.platformdeelLeemte).toBe(false);
  });

  it("een ontbrekende rij geldt als niet toegestaan, niet als leemte", async () => {
    // De tabel is leeg: er is een platformdeel, maar geen vinkje. Dat is een
    // stellig 'nee', anders zou een nieuw platformdeel stilzwijgend voor iedereen
    // open staan zodra niemand er een rij voor heeft aangemaakt.
    const u = await beoordeelSchrijfweg(
      {
        handeling: "afname_aanmaken",
        instrumentId: "t4p-business-kompas",
        verzender: PERSOON,
        stand: "handhaaf",
        peildatum: "2026-08-13",
      },
      maakOpslag(geldig),
      db,
      audit,
    );
    expect(u.mag).toBe(false);
    expect(u.grond).toBe("platformdeel_geblokkeerd");
  });

  it("de vlag van een ándere beheerder doet niets", async () => {
    db.prepare(`INSERT INTO toegangen (beheerder_id, platformdeel, toegestaan) VALUES (2,'kompas',1)`).run();
    const u = await beoordeelSchrijfweg(
      {
        handeling: "afname_aanmaken",
        instrumentId: "t4p-business-kompas",
        verzender: PERSOON,
        stand: "handhaaf",
        peildatum: "2026-08-13",
      },
      maakOpslag(geldig),
      db,
      audit,
    );
    expect(u.mag).toBe(false);
  });
});

describe("de bezwaarjoin — de zwaarste belofte hangt hieraan", () => {
  const zonderLicentie = { geaccrediteerde: { id: 9, beheerderId: 1 } };

  async function oordeel(instrumentId: string) {
    return beoordeelSchrijfweg(
      {
        handeling: "afname_aanmaken",
        instrumentId,
        verzender: PERSOON,
        stand: "handhaaf",
        peildatum: "2026-08-13",
      },
      maakOpslag(zonderLicentie),
      db,
      audit,
    );
  }

  it("zonder bezwaar weigert de poort", async () => {
    const u = await oordeel("t4kids");
    expect(u.mag).toBe(false);
    expect(u.grond).toBe("geen_licentie");
  });

  it("een lopend bezwaar houdt de poort open", async () => {
    db.prepare(`INSERT INTO bekwaamheid_rondes (id, geaccrediteerde_id, instrument_id) VALUES (1,9,'t4kids')`).run();
    db.prepare(`INSERT INTO bekwaamheid_bezwaren (ronde_id, ingediend_op, uitspraak_op) VALUES (1,'2026-06-01',NULL)`).run();
    const u = await oordeel("t4kids");
    expect(u.mag).toBe(true);
    expect(u.grond).toBe("bezwaar_loopt");
    expect(regels).toEqual([]);
  });

  it("een afgehandeld bezwaar houdt de poort niet open", async () => {
    db.prepare(`INSERT INTO bekwaamheid_rondes (id, geaccrediteerde_id, instrument_id) VALUES (1,9,'t4kids')`).run();
    db.prepare(`INSERT INTO bekwaamheid_bezwaren (ronde_id, ingediend_op, uitspraak_op) VALUES (1,'2026-06-01','2026-07-01')`).run();
    const u = await oordeel("t4kids");
    expect(u.mag).toBe(false);
  });

  it("een bezwaar over een ánder instrument houdt deze poort niet open", async () => {
    db.prepare(`INSERT INTO bekwaamheid_rondes (id, geaccrediteerde_id, instrument_id) VALUES (1,9,'t4teens')`).run();
    db.prepare(`INSERT INTO bekwaamheid_bezwaren (ronde_id, ingediend_op, uitspraak_op) VALUES (1,'2026-06-01',NULL)`).run();
    const u = await oordeel("t4kids");
    expect(u.mag).toBe(false);
  });

  it("een bezwaar van een ánder persoon houdt deze poort niet open", async () => {
    db.prepare(`INSERT INTO bekwaamheid_rondes (id, geaccrediteerde_id, instrument_id) VALUES (1,44,'t4kids')`).run();
    db.prepare(`INSERT INTO bekwaamheid_bezwaren (ronde_id, ingediend_op, uitspraak_op) VALUES (1,'2026-06-01',NULL)`).run();
    const u = await oordeel("t4kids");
    expect(u.mag).toBe(false);
  });

  it("één lopend bezwaar naast twee afgehandelde is genoeg", async () => {
    db.prepare(`INSERT INTO bekwaamheid_rondes (id, geaccrediteerde_id, instrument_id) VALUES (1,9,'t4kids')`).run();
    db.prepare(`INSERT INTO bekwaamheid_bezwaren (ronde_id, ingediend_op, uitspraak_op) VALUES (1,'2024-01-01','2024-02-01')`).run();
    db.prepare(`INSERT INTO bekwaamheid_bezwaren (ronde_id, ingediend_op, uitspraak_op) VALUES (1,'2025-01-01','2025-02-01')`).run();
    db.prepare(`INSERT INTO bekwaamheid_bezwaren (ronde_id, ingediend_op, uitspraak_op) VALUES (1,'2026-06-01',NULL)`).run();
    const u = await oordeel("t4kids");
    expect(u.grond).toBe("bezwaar_loopt");
  });
});

describe("de brug legt het platform niet plat als ze zelf stuk is", () => {
  it("een kapotte databank laat het verzoek door in plaats van te weigeren", async () => {
    const kapot = {
      prepare() {
        throw new Error("tabel bestaat niet in deze omgeving");
      },
    } as unknown as BetterSqlite3.Database;
    const u = await beoordeelSchrijfweg(
      {
        handeling: "afname_aanmaken",
        instrumentId: "t4kids",
        verzender: PERSOON,
        stand: "handhaaf",
      },
      maakOpslag({ geaccrediteerde: { id: 9, beheerderId: 1 } }),
      kapot,
      audit,
    );
    expect(u.mag).toBe(true);
    expect(u.toetsbaar).toBe(false);
  });

  it("een kapotte opslaglaag doet hetzelfde", async () => {
    const kapotteOpslag = {
      register: {
        vindOpBeheerder() {
          throw new Error("opslag onbereikbaar");
        },
      },
    } as unknown as BekwaamheidOpslag;
    const u = await beoordeelSchrijfweg(
      {
        handeling: "afname_aanmaken",
        instrumentId: "t4kids",
        verzender: PERSOON,
        stand: "handhaaf",
      },
      kapotteOpslag,
      db,
      audit,
    );
    expect(u.mag).toBe(true);
    expect(u.toetsbaar).toBe(false);
  });
});

describe("het weigeringslichaam", () => {
  it("draagt een tekst, een grond en een weg vooruit", async () => {
    const u = await beoordeelSchrijfweg(
      {
        handeling: "afname_aanmaken",
        instrumentId: "t4kids",
        verzender: PERSOON,
        stand: "handhaaf",
      },
      maakOpslag({ geaccrediteerde: null }),
      db,
      audit,
    );
    const lichaam = weigeringslichaam(u);
    expect(lichaam.code).toBe("BEKWAAMHEID_POORT");
    expect(lichaam.grond).toBe("niet_in_register");
    expect(lichaam.error.length).toBeGreaterThan(40);
    expect(lichaam.watNu.actie.length).toBeGreaterThan(0);
    // Nooit de plaatshouder rauw naar de gebruiker.
    expect(lichaam.error).not.toContain("{contact}");
  });

  it("de tekst volgt de gevraagde taal", async () => {
    const invoer = {
      handeling: "afname_aanmaken" as const,
      instrumentId: "t4kids",
      verzender: PERSOON,
      stand: "handhaaf" as const,
    };
    const nl = await beoordeelSchrijfweg({ ...invoer, taal: "nl" }, maakOpslag({}), db, audit);
    const fr = await beoordeelSchrijfweg({ ...invoer, taal: "fr" }, maakOpslag({}), db, audit);
    expect(nl.tekst).not.toBe(fr.tekst);
    expect(nl.grond).toBe(fr.grond);
  });
});
