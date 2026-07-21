import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { maakTendensTabellen, berekenBaseline, schrijfUaIjkpunt } from "../server/tendens-monitoring";

// Fase 0-1 tests — Inzichtcentrum tendensmonitoring.
// Doel: de datalaag en baseline-berekening vastleggen. We gebruiken een
// in-memory SQLite-database met een minimale `afnames`-tabel, zodat de test
// deterministisch is en NOOIT afhangt van de live data.db.

function maakTestDb(): any {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE afnames (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instrument_id TEXT,
      status TEXT NOT NULL DEFAULT 'gestart',
      created_at TEXT NOT NULL
    )
  `);
  return db;
}

function voegAfnameToe(db: any, instrument: string | null, status: string, datum: string) {
  db.prepare("INSERT INTO afnames (instrument_id, status, created_at) VALUES (?, ?, ?)")
    .run(instrument, status, datum);
}

describe("tendensmonitoring fase 0 — datalaag", () => {
  it("maakt tendens_snapshot en tendens_signaal aan (idempotent)", () => {
    const db = maakTestDb();
    maakTendensTabellen(db);
    // Tweede keer mag niet falen (IF NOT EXISTS).
    maakTendensTabellen(db);

    const tabellen = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('tendens_snapshot','tendens_signaal') ORDER BY name"
    ).all().map((r: any) => r.name);

    expect(tabellen).toEqual(["tendens_signaal", "tendens_snapshot"]);
  });

  it("tendens_signaal start standaard leeg", () => {
    const db = maakTestDb();
    maakTendensTabellen(db);
    const n = (db.prepare("SELECT COUNT(*) AS n FROM tendens_signaal").get() as any).n;
    expect(n).toBe(0);
  });
});

describe("tendensmonitoring fase 1 — baseline", () => {
  beforeEach(() => {});

  it("schrijft baseline-meetpunten weg uit de afnames-data", () => {
    const db = maakTestDb();
    // 6 voltooide T4S-afnames in twee maanden (boven k-anonimiteit).
    for (let i = 0; i < 4; i++) voegAfnameToe(db, "t4sports", "voltooid", "2026-05-10");
    for (let i = 0; i < 2; i++) voegAfnameToe(db, "t4sports", "voltooid", "2026-06-10");

    const res = berekenBaseline(db);
    expect(res.meetpunten).toBeGreaterThan(0);

    // Er moet minstens een volume_instrument-, volume_maand- en voltooiingsgraad-meetpunt zijn.
    const dimensies = db.prepare(
      "SELECT DISTINCT dimensie FROM tendens_snapshot WHERE is_baseline = 1 ORDER BY dimensie"
    ).all().map((r: any) => r.dimensie);
    expect(dimensies).toContain("volume_instrument");
    expect(dimensies).toContain("volume_maand");
    expect(dimensies).toContain("voltooiingsgraad");
    // Baseline bevat ook het extern gevalideerde UA-structuurijkpunt.
    expect(dimensies).toContain("structuur_ua");
  });

  it("berekent de voltooiingsgraad als correcte base-rate", () => {
    const db = maakTestDb();
    // 8 afnames, 6 voltooid -> aandeel 0,75.
    for (let i = 0; i < 6; i++) voegAfnameToe(db, "t4sports", "voltooid", "2026-06-10");
    for (let i = 0; i < 2; i++) voegAfnameToe(db, "t4sports", "gestart", "2026-06-10");

    berekenBaseline(db);
    const rij = db.prepare(
      "SELECT n, aandeel, onderdrukt FROM tendens_snapshot WHERE dimensie = 'voltooiingsgraad' AND is_baseline = 1"
    ).get() as any;

    expect(rij.n).toBe(8);
    expect(rij.aandeel).toBeCloseTo(0.75, 5);
    expect(rij.onderdrukt).toBe(0);
  });

  it("onderdrukt kleine groepen (k-anonimiteit < 5)", () => {
    const db = maakTestDb();
    // Slechts 3 afnames van één instrument -> moet onderdrukt worden op instrumentniveau.
    for (let i = 0; i < 3; i++) voegAfnameToe(db, "t4kids", "voltooid", "2026-06-10");

    berekenBaseline(db);
    const rij = db.prepare(
      "SELECT n, aandeel, onderdrukt FROM tendens_snapshot WHERE dimensie = 'volume_instrument' AND sleutel = 't4kids' AND is_baseline = 1"
    ).get() as any;

    expect(rij.n).toBe(3);
    expect(rij.onderdrukt).toBe(1);
    // Detailwaarden onderdrukt.
    expect(rij.aandeel).toBeNull();
  });

  it("is herhaalbaar: opnieuw berekenen vervangt de baseline, dupliceert niet", () => {
    const db = maakTestDb();
    for (let i = 0; i < 6; i++) voegAfnameToe(db, "t4sports", "voltooid", "2026-06-10");

    berekenBaseline(db);
    const eerste = (db.prepare("SELECT COUNT(*) AS n FROM tendens_snapshot WHERE is_baseline = 1").get() as any).n;
    berekenBaseline(db);
    const tweede = (db.prepare("SELECT COUNT(*) AS n FROM tendens_snapshot WHERE is_baseline = 1").get() as any).n;

    expect(tweede).toBe(eerste);
  });

  it("werkt op een lege database zonder te crashen", () => {
    const db = maakTestDb();
    const res = berekenBaseline(db);
    // Geen afnames -> voltooiingsgraad-meetpunt bestaat wél (n=0), maar geen volume-rijen.
    expect(res.meetpunten).toBeGreaterThanOrEqual(1);
    const graad = db.prepare(
      "SELECT n, aandeel FROM tendens_snapshot WHERE dimensie = 'voltooiingsgraad' AND is_baseline = 1"
    ).get() as any;
    expect(graad.n).toBe(0);
    expect(graad.aandeel).toBeNull();
  });
});

describe("tendensmonitoring — UA-structuurijkpunt (extern gevalideerd)", () => {
  it("schrijft de zes gevalideerde UA-waarden weg als baseline-ijkpunt", () => {
    const db = maakTestDb();
    const aantal = schrijfUaIjkpunt(db);
    expect(aantal).toBe(6);

    const rijen = db.prepare(
      "SELECT sleutel, gemiddelde, instrument, n, onderdrukt FROM tendens_snapshot WHERE dimensie = 'structuur_ua' AND is_baseline = 1"
    ).all() as any[];
    expect(rijen.length).toBe(6);
    // Alle rijen horen bij het t4sports-instrument en zijn geen steekproef (n=0).
    for (const r of rijen) {
      expect(r.instrument).toBe("t4sports");
      expect(r.n).toBe(0);
      expect(r.onderdrukt).toBe(0);
    }
  });

  it("bewaart de exacte gevalideerde referentiewaarden (geen afronding/verzinning)", () => {
    const db = maakTestDb();
    schrijfUaIjkpunt(db);
    const haal = (sleutel: string) =>
      (db.prepare("SELECT gemiddelde FROM tendens_snapshot WHERE dimensie='structuur_ua' AND sleutel=?").get(sleutel) as any)?.gemiddelde;

    expect(haal("f1_variantie")).toBeCloseTo(0.232, 3);
    expect(haal("omega_18")).toBeCloseTo(0.939, 3);
    expect(haal("omega_14_kern")).toBeCloseTo(0.946, 3);
    expect(haal("tucker_phi_f1")).toBeCloseTo(0.994, 3);
    expect(haal("tucker_phi_gem")).toBeCloseTo(0.929, 3);
    expect(haal("kmo")).toBeCloseTo(0.828, 3);
  });

  it("is idempotent: opnieuw schrijven dupliceert het ijkpunt niet", () => {
    const db = maakTestDb();
    schrijfUaIjkpunt(db);
    schrijfUaIjkpunt(db);
    const n = (db.prepare(
      "SELECT COUNT(*) AS n FROM tendens_snapshot WHERE dimensie = 'structuur_ua' AND is_baseline = 1"
    ).get() as any).n;
    expect(n).toBe(6);
  });

  it("baseline-run neemt het ijkpunt mee", () => {
    const db = maakTestDb();
    for (let i = 0; i < 6; i++) voegAfnameToe(db, "t4sports", "voltooid", "2026-06-10");
    berekenBaseline(db);
    const n = (db.prepare(
      "SELECT COUNT(*) AS n FROM tendens_snapshot WHERE dimensie = 'structuur_ua' AND is_baseline = 1"
    ).get() as any).n;
    expect(n).toBe(6);
  });
});
