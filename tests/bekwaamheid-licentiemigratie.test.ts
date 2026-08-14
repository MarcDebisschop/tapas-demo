import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error — het migratiescript is JavaScript zonder typedeclaraties.
import { legOvergangsperiodeVast, STANDAARD_INSTRUMENT } from "../script/migreer-licenties.mjs";
import { maakBekwaamheidOpslag } from "../server/bekwaamheid/storage";
import {
  LICENTIESTATUSSEN,
  STATUSSEN_MET_AFNAMERECHT,
} from "../server/bekwaamheid/schema";
import { magAfnemen } from "../server/bekwaamheid/rechten";

// ---------------------------------------------------------------------------
// De laatste eis van de opleverpoort van blok 1: "elke bestaande
// geaccrediteerde krijgt een licentierij op `overgangsperiode`", met "een test
// die aantoont dat geen enkele licentie na de migratie een status heeft die iets
// blokkeert."
//
// Die tweede eis is trivially waar zolang de tabel leeg is. Een bewering over
// alle elementen van een lege verzameling kost niets en bewijst niets. Deze test
// vult het register eerst, draait dan de migratiestap, en meet daarna pas.
// ---------------------------------------------------------------------------

const migratie = readFileSync("migrations/0006_bekwaamheid.sql", "utf8").replaceAll(
  "--> statement-breakpoint",
  "",
);

function maakProefdatabank(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE beheerders (
      id INTEGER PRIMARY KEY,
      naam TEXT NOT NULL,
      email TEXT NOT NULL
    );
    CREATE TABLE afnames (
      id INTEGER PRIMARY KEY,
      aangemaakt_door_beheerder_id INTEGER,
      instrument_id TEXT,
      status TEXT NOT NULL,
      completed_at TEXT
    );
    CREATE TABLE stm_sessies (
      id INTEGER PRIMARY KEY,
      beheerder_id INTEGER,
      afgerond_at TEXT,
      score_totaal REAL,
      scores_per_laag TEXT
    );
  `);
  db.exec(migratie);
  return db;
}

/**
 * Vult het register zoals `script/migreer-bekwaamheid.mjs` het achterlaat: de
 * eenentwintig namen op de behouden monitor-ids 1001 tot 1021, plus twee mensen
 * met een beheerdersaccount. Drieëntwintig rijen, waarvan eenentwintig zonder
 * e-mailadres — dezelfde verhouding als bij de werkelijke droogloop.
 */
function vulRegister(db: Database.Database): number[] {
  db.prepare("INSERT INTO beheerders (id, naam, email) VALUES (1, 'Marc Debisschop', 'marc@tapascity.com')").run();
  db.prepare("INSERT INTO beheerders (id, naam, email) VALUES (2, 'Tweede beheerder', 'twee@example.org')").run();

  const zet = db.prepare(
    `INSERT INTO bekwaamheid_geaccrediteerden
       (id, beheerder_id, coach_register_id, naam, email, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const nu = new Date().toISOString();
  const ids: number[] = [];

  zet.run(null, 1, null, "Marc Debisschop", "marc@tapascity.com", nu, nu);
  zet.run(null, 2, null, "Tweede beheerder", "twee@example.org", nu, nu);

  for (let i = 0; i < 21; i++) {
    const id = 1001 + i;
    // Zonder adres, met een rij in het coachregister als sleutel — precies de
    // vorm waarin de eenentwintig namen uit routes-stm.ts zijn overgekomen.
    zet.run(id, null, 500 + i, `Geaccrediteerde ${i + 1}`, null, nu, nu);
    ids.push(id);
  }
  return ids;
}

describe("de migratiestap zelf", () => {
  let db: Database.Database;
  beforeEach(() => {
    db = maakProefdatabank();
    vulRegister(db);
  });

  it("laat de droogloop niets schrijven", () => {
    const uit = legOvergangsperiodeVast({ db, schrijf: false });

    expect(uit.teller.nieuw).toBe(23);
    // De teller zegt drieëntwintig, de tabel zegt nul: dat is wat een droogloop is.
    const aantal = db
      .prepare("SELECT COUNT(*) AS n FROM bekwaamheid_licenties")
      .get() as { n: number };
    expect(aantal.n).toBe(0);
  });

  it("geeft elke actieve geaccrediteerde precies één licentie", () => {
    legOvergangsperiodeVast({ db, schrijf: true });

    const rijen = db
      .prepare("SELECT geaccrediteerde_id, instrument_id, status FROM bekwaamheid_licenties")
      .all() as Array<{ geaccrediteerde_id: number; instrument_id: string; status: string }>;

    expect(rijen).toHaveLength(23);
    expect(new Set(rijen.map((r) => r.geaccrediteerde_id)).size).toBe(23);
    expect(new Set(rijen.map((r) => r.status))).toEqual(new Set(["overgangsperiode"]));
    expect(new Set(rijen.map((r) => r.instrument_id))).toEqual(new Set([STANDAARD_INSTRUMENT]));
  });

  it("laat geen einddatum, geen agendadatum en geen alert achter", () => {
    legOvergangsperiodeVast({ db, schrijf: true });

    const rijen = db
      .prepare(
        `SELECT geldig_tot, volgende_bekrachtiging, volgende_tussentijdse_toets,
                laatste_bekrachtiging, alert_actief, voorwaarde_tekst
         FROM bekwaamheid_licenties`,
      )
      .all() as Array<Record<string, unknown>>;

    // Een overgangsperiode die stil een einddatum meekrijgt, is een opzegging met
    // een vriendelijke naam. Er hoort hier niets in de agenda te staan: de
    // eerste bekrachtigingsdatum volgt uit een beslissing, niet uit een migratie.
    for (const r of rijen) {
      expect(r.geldig_tot).toBeNull();
      expect(r.volgende_bekrachtiging).toBeNull();
      expect(r.volgende_tussentijdse_toets).toBeNull();
      expect(r.laatste_bekrachtiging).toBeNull();
      expect(r.alert_actief).toBe(0);
      expect(r.voorwaarde_tekst).toBeNull();
    }
  });

  it("zet een geldig_van op de dag van de migratie", () => {
    legOvergangsperiodeVast({ db, schrijf: true });
    const rij = db
      .prepare("SELECT geldig_van FROM bekwaamheid_licenties LIMIT 1")
      .get() as { geldig_van: string };
    expect(rij.geldig_van).toBe(new Date().toISOString().slice(0, 10));
  });

  it("slaat wie inactief staat over", () => {
    db.prepare("UPDATE bekwaamheid_geaccrediteerden SET actief = 0 WHERE id = 1001").run();
    const uit = legOvergangsperiodeVast({ db, schrijf: true });

    expect(uit.teller.overgeslagen).toBe(1);
    expect(uit.teller.nieuw).toBe(22);
    const rij = db
      .prepare("SELECT COUNT(*) AS n FROM bekwaamheid_licenties WHERE geaccrediteerde_id = 1001")
      .get() as { n: number };
    expect(rij.n).toBe(0);
  });

  it("geeft bij een tweede keer nul nieuwe rijen en verandert niets", () => {
    legOvergangsperiodeVast({ db, schrijf: true });
    const voor = db.prepare("SELECT * FROM bekwaamheid_licenties ORDER BY id").all();

    const tweede = legOvergangsperiodeVast({ db, schrijf: true });

    expect(tweede.teller.nieuw).toBe(0);
    expect(tweede.teller.bestond).toBe(23);
    const na = db.prepare("SELECT * FROM bekwaamheid_licenties ORDER BY id").all();
    expect(na).toEqual(voor);
  });

  it("overschrijft een licentie die al bekrachtigd is niet", () => {
    // Het gevaarlijke geval: het script twee keer draaien nadat er echte
    // beslissingen zijn genomen. Een migratiestap die een bekrachtiging terugzet
    // naar `overgangsperiode` wist een beslissing.
    legOvergangsperiodeVast({ db, schrijf: true });
    const opslag = maakBekwaamheidOpslag(db, () => {});
    const licentie = opslag.licenties.vind(1001, STANDAARD_INSTRUMENT)!;
    opslag.licenties.naBekrachtiging({
      licentieId: licentie.id,
      status: "bekrachtigd",
      bekrachtigdOp: "2026-08-13",
    });

    legOvergangsperiodeVast({ db, schrijf: true });

    const na = opslag.licenties.vind(1001, STANDAARD_INSTRUMENT)!;
    expect(na.status).toBe("bekrachtigd");
  });

  it("kan een tweede instrument naast het eerste zetten", () => {
    legOvergangsperiodeVast({ db, schrijf: true });
    legOvergangsperiodeVast({ db, instrumentId: "t4o", schrijf: true });

    const rij = db
      .prepare("SELECT COUNT(*) AS n FROM bekwaamheid_licenties WHERE geaccrediteerde_id = 1001")
      .get() as { n: number };
    expect(rij.n).toBe(2);
  });
});

describe("na de migratie blokkeert geen enkele licentie iets", () => {
  let db: Database.Database;
  beforeEach(() => {
    db = maakProefdatabank();
    vulRegister(db);
    legOvergangsperiodeVast({ db, schrijf: true });
  });

  it("staat op een niet-lege verzameling licenties", () => {
    // De wacht op de bewijskracht van de twee tests hieronder. Zonder deze
    // vaststelling zouden ze ook groen zijn op een lege tabel.
    const aantal = db
      .prepare("SELECT COUNT(*) AS n FROM bekwaamheid_licenties")
      .get() as { n: number };
    expect(aantal.n).toBeGreaterThan(0);
    expect(aantal.n).toBe(23);
  });

  it("heeft voor elke licentie een status die afnamerecht geeft", () => {
    const rijen = db
      .prepare("SELECT id, status FROM bekwaamheid_licenties")
      .all() as Array<{ id: number; status: string }>;

    for (const r of rijen) {
      expect(STATUSSEN_MET_AFNAMERECHT).toContain(r.status as never);
    }
  });

  it("laat de poort geen enkele licentie weigeren, ook niet op stand handhaaf", () => {
    // Niet de statuslijst nog eens nalopen, maar de functie bevragen die de poort
    // werkelijk gebruikt. Een statuslijst die klopt terwijl de regel iets anders
    // doet, is precies het soort verschil dat je pas in productie ziet.
    //
    // Gemeten wordt `zouWeigeren` en niet `toegestaan`. Op de huidige stand `log`
    // staat `toegestaan` altijd op waar, wat de test groen zou houden ook als elke
    // licentie geweigerd zou worden. `zouWeigeren` volgt de regels los van de
    // stand; daarnaast wordt `handhaaf` expliciet doorgerekend, want dat is de
    // stand waar het morgen om gaat.
    const opslag = maakBekwaamheidOpslag(db, () => {});
    const personen = db
      .prepare("SELECT id FROM bekwaamheid_geaccrediteerden WHERE actief = 1")
      .all() as Array<{ id: number }>;
    const vandaag = new Date().toISOString().slice(0, 10);

    expect(personen.length).toBe(23);
    for (const p of personen) {
      const licentie = opslag.licenties.vind(p.id, STANDAARD_INSTRUMENT);
      expect(licentie).toBeDefined();
      const uitspraak = magAfnemen({
        licentie: licentie!,
        instrumentId: STANDAARD_INSTRUMENT,
        peildatum: vandaag,
        stand: "handhaaf",
      });
      expect(uitspraak.zouWeigeren).toBe(false);
      expect(uitspraak.grond).toBeNull();
      expect(uitspraak.toegestaan).toBe(true);
    }
  });

  it("gebruikt geen status buiten de zeven die het schema toestaat", () => {
    const rijen = db
      .prepare("SELECT DISTINCT status FROM bekwaamheid_licenties")
      .all() as Array<{ status: string }>;
    for (const r of rijen) {
      expect(LICENTIESTATUSSEN).toContain(r.status as never);
    }
  });
});
