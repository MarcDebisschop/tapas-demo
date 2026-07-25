// ---------------------------------------------------------------------------
// tests/bewaartermijn-job.test.ts - AVG art. 5.1.e: automatische opruiming
//
// Wat de test bewijst:
//   1. De taak selecteert precies de afnames waarvan bewaartotDatum verstreken
//      is EN die nog niet geanonimiseerd zijn; niet-verstreken en al
//      geanonimiseerde rijen blijven ongemoeid.
//   2. Ze anonimiseert met de reden "bewaartermijn verstreken - automatisch".
//   3. Ze is idempotent: een tweede run doet niets meer.
//   4. Ze faalt zacht: een fout op één afname stopt de rest niet.
//   5. Het interval is instelbaar via env en valt bij onzin terug op 24 uur.
//
// De echte database wordt niet aangeraakt: we mockken de storage-module met een
// SQLite-database in het geheugen.
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";

const geheugenDb = new Database(":memory:");
geheugenDb.exec(`
  CREATE TABLE afnames (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bewaartot_datum TEXT,
    geanonimiseerd_at TEXT
  );
`);

const geanonimiseerd: Array<{ id: number; reden: string }> = [];
let laatFalenVoorId: number | null = null;

vi.mock("../server/storage", () => ({
  sqlite: geheugenDb,
  storage: {
    anonimiseerAfname: async (id: number, reden: string) => {
      if (id === laatFalenVoorId) throw new Error("gesimuleerde fout");
      const rij = geheugenDb.prepare(`SELECT geanonimiseerd_at FROM afnames WHERE id = ?`).get(id) as
        | { geanonimiseerd_at: string | null }
        | undefined;
      if (!rij) return undefined;
      if (rij.geanonimiseerd_at) return { id };
      geheugenDb
        .prepare(`UPDATE afnames SET geanonimiseerd_at = ? WHERE id = ?`)
        .run(new Date().toISOString(), id);
      geanonimiseerd.push({ id, reden });
      return { id };
    },
  },
}));

vi.mock("../server/audit-log", () => ({ schrijfAuditLog: () => {} }));

const {
  verstrekenAfnameIds,
  voerBewaartermijnOpruimingUit,
  bewaartermijnIntervalUren,
  ANONIMISERINGSREDEN,
} = await import("../server/bewaartermijn-job");

beforeEach(() => {
  geheugenDb.exec("DELETE FROM afnames");
  geanonimiseerd.length = 0;
  laatFalenVoorId = null;
  delete process.env.TAPAS_BEWAARTERMIJN_INTERVAL_UREN;
});

function voegToe(id: number, bewaartot: string | null, geanonAt: string | null = null) {
  geheugenDb
    .prepare(`INSERT INTO afnames (id, bewaartot_datum, geanonimiseerd_at) VALUES (?, ?, ?)`)
    .run(id, bewaartot, geanonAt);
}

const VERLEDEN = "2020-01-01T00:00:00.000Z";
const TOEKOMST = "2099-01-01T00:00:00.000Z";

describe("bewaartermijn-job", () => {
  it("selecteert enkel verstreken en nog niet geanonimiseerde afnames", () => {
    voegToe(1, VERLEDEN);
    voegToe(2, TOEKOMST);
    voegToe(3, VERLEDEN, "2021-01-01T00:00:00.000Z");
    voegToe(4, null);
    expect(verstrekenAfnameIds()).toEqual([1]);
  });

  it("anonimiseert verstreken afnames met de vaste reden", async () => {
    voegToe(1, VERLEDEN);
    voegToe(2, VERLEDEN);
    voegToe(3, TOEKOMST);
    const aantal = await voerBewaartermijnOpruimingUit();
    expect(aantal).toBe(2);
    expect(geanonimiseerd.map((g) => g.id)).toEqual([1, 2]);
    expect(new Set(geanonimiseerd.map((g) => g.reden))).toEqual(new Set([ANONIMISERINGSREDEN]));
    expect(ANONIMISERINGSREDEN).toBe("bewaartermijn verstreken - automatisch");
  });

  it("is idempotent: een tweede run anonimiseert niets meer", async () => {
    voegToe(1, VERLEDEN);
    expect(await voerBewaartermijnOpruimingUit()).toBe(1);
    expect(await voerBewaartermijnOpruimingUit()).toBe(0);
  });

  it("faalt zacht: een fout op één afname stopt de rest niet", async () => {
    voegToe(1, VERLEDEN);
    voegToe(2, VERLEDEN);
    laatFalenVoorId = 1;
    const aantal = await voerBewaartermijnOpruimingUit();
    expect(aantal).toBe(1);
    expect(geanonimiseerd.map((g) => g.id)).toEqual([2]);
  });

  it("neemt het interval uit env over en negeert onbruikbare waarden", () => {
    expect(bewaartermijnIntervalUren()).toBe(24);
    process.env.TAPAS_BEWAARTERMIJN_INTERVAL_UREN = "6";
    expect(bewaartermijnIntervalUren()).toBe(6);
    process.env.TAPAS_BEWAARTERMIJN_INTERVAL_UREN = "0";
    expect(bewaartermijnIntervalUren()).toBe(24);
    process.env.TAPAS_BEWAARTERMIJN_INTERVAL_UREN = "onzin";
    expect(bewaartermijnIntervalUren()).toBe(24);
  });
});
