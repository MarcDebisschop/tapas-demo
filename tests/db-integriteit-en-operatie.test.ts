// ---------------------------------------------------------------------------
// tests/db-integriteit-en-operatie.test.ts
//
// Auditbevindingen A-1 en O-1 (beide hoog).
//
// A-1: "Geen foreign keys en geen indexen op kerntabellen". De audit telde
//      dertien indexen, alle op randtabellen van losse instrumenten, en nul op de
//      kerntabellen. Deze tests werken op een EIGEN wegwerpdatabank, zodat ze
//      niets aan de echte databank veranderen.
//
// O-1: het laatste deel van de operationele laag - de back-upstrategie - plus de
//      licentiecontrole in de bouwpijplijn die de audit bij L-1 aanbeveelt.
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { readFileSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  zetKernIndexen,
  zetVerwijzingsafdwinging,
  controleerVerwijzingen,
} from "../server/db-integriteit";

const wortel = resolve(__dirname, "..");
const proefPad = resolve(wortel, "tests-proef-integriteit.db");
let db: Database.Database;

beforeAll(() => {
  if (existsSync(proefPad)) rmSync(proefPad);
  db = new Database(proefPad);
  db.exec(`
    CREATE TABLE organisaties (id INTEGER PRIMARY KEY, naam TEXT);
    CREATE TABLE afnames (id INTEGER PRIMARY KEY, organisatie_id INTEGER, status TEXT,
      instrument_id TEXT, deelnemer_email TEXT, invite_token TEXT, created_at TEXT);
    CREATE TABLE rapporten (id INTEGER PRIMARY KEY, afname_id INTEGER, created_at TEXT);
  `);
  db.exec(`
    INSERT INTO organisaties (id, naam) VALUES (1, 'Proef');
    INSERT INTO afnames (id, organisatie_id, status) VALUES (1, 1, 'voltooid'), (2, NULL, 'consent');
    INSERT INTO rapporten (id, afname_id) VALUES (1, 1);
  `);
});

afterAll(() => {
  db?.close();
  for (const rest of [proefPad, `${proefPad}-wal`, `${proefPad}-shm`]) {
    if (existsSync(rest)) rmSync(rest);
  }
});

describe("kernindexen (auditbevinding A-1)", () => {
  it("legt indexen aan op de kerntabellen en slaat onbekende tabellen stil over", () => {
    const uitslag = zetKernIndexen(db);
    expect(uitslag.aangelegd).toBeGreaterThan(0);
    const namen = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'")
      .all()
      .map((r: any) => r.name);
    expect(namen).toContain("idx_afnames_organisatie");
    expect(namen).toContain("idx_afnames_status");
    expect(namen).toContain("idx_rapporten_afname");
  });

  it("is idempotent: tweemaal aanleggen verandert niets", () => {
    const voor = db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='index'").get() as any;
    zetKernIndexen(db);
    const na = db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='index'").get() as any;
    expect(na.n).toBe(voor.n);
  });

  it("gebruikt de index bij het opzoeken van afnames van een organisatie", () => {
    const plan = db
      .prepare("EXPLAIN QUERY PLAN SELECT * FROM afnames WHERE organisatie_id = 1")
      .all()
      .map((r: any) => r.detail)
      .join(" ");
    expect(plan).toContain("idx_afnames_organisatie");
    expect(plan).not.toContain("SCAN afnames");
  });
});

describe("verwijzingsintegriteit (auditbevinding A-1)", () => {
  it("zet de afdwinging van verwijzingen aan", () => {
    expect(zetVerwijzingsafdwinging(db)).toBe(true);
  });

  it("meldt geen weeskinderen bij een gezonde databank", () => {
    expect(controleerVerwijzingen(db)).toEqual([]);
  });

  it("rekent een leeg verwijsveld niet als weeskind", () => {
    // Afname 2 heeft geen organisatie; dat is een geldige situatie.
    expect(controleerVerwijzingen(db).some((w) => w.kind === "afnames")).toBe(false);
  });

  it("vindt een verweesde verwijzing wel degelijk", () => {
    db.exec("INSERT INTO rapporten (id, afname_id) VALUES (99, 4242)");
    const wezen = controleerVerwijzingen(db);
    const treffer = wezen.find((w) => w.kind === "rapporten" && w.kolom === "afname_id");
    expect(treffer, "verweesd rapport niet opgemerkt").toBeTruthy();
    expect(treffer!.aantal).toBe(1);
    db.exec("DELETE FROM rapporten WHERE id = 99");
  });
});

describe("back-up en herstel (auditbevinding O-1)", () => {
  it("heeft een back-upscript dat de online-voorziening en een controle gebruikt", () => {
    const bron = readFileSync(resolve(wortel, "script/backup.mjs"), "utf8");
    expect(bron).toMatch(/\.backup\(/);
    expect(bron).toMatch(/integrity_check/);
    expect(bron).toMatch(/process\.exit\(1\)/);
  });

  it("heeft een herstelprocedure met een uitdrukkelijke bewaarstap", () => {
    const doc = readFileSync(resolve(wortel, "docs/OPERATIE-backup-en-herstel.md"), "utf8");
    expect(doc).toMatch(/Herstellen/);
    expect(doc).toMatch(/nooit overschrijven/i);
    expect(doc).toMatch(/Herstelproef/);
    expect(doc).toMatch(/api\/gezondheid/);
  });

  it("draait het back-upscript mee in de bouwpijplijn", () => {
    const ci = readFileSync(resolve(wortel, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toMatch(/script\/backup\.mjs/);
  });
});

describe("licentiecontrole in de pijplijn (vervolg op L-1)", () => {
  it("weigert sterk copyleft en staat in de pijplijn", () => {
    const bron = readFileSync(resolve(wortel, "script/licentiecontrole.mjs"), "utf8");
    expect(bron).toMatch(/AGPL/);
    expect(bron).toMatch(/GPL-\[23\]/);
    expect(bron).toMatch(/process\.exit\(1\)/);
    const ci = readFileSync(resolve(wortel, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toMatch(/script\/licentiecontrole\.mjs/);
  });
});
