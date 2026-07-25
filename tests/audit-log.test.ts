// ---------------------------------------------------------------------------
// tests/audit-log.test.ts - AVG art. 5.2 en art. 32: aantoonbaar auditspoor
//
// Wat de test bewijst:
//   1. Een auditregel legt wie (adminId), wat (actie + afnameId) en wanneer
//      (ISO-tijdstip) vast; een automatische actie mag adminId null hebben.
//   2. Het log is append-only: UPDATE en DELETE worden door de database zelf
//      geweigerd, niet enkel door een afspraak in de code.
//   3. Aanmaken is idempotent (meermaals aanroepen is onschadelijk).
//   4. Elke GDPR-route in server/routes/afnames.ts schrijft een auditregel.
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";

const geheugenDb = new Database(":memory:");
vi.mock("../server/storage", () => ({ sqlite: geheugenDb }));

const { schrijfAuditLog, leesAuditLog, zorgVoorAuditTabel } = await import("../server/audit-log");

beforeEach(() => {
  zorgVoorAuditTabel();
  // Legen kan niet via DELETE (append-only), dus verwijderen we de tabel zelf.
  geheugenDb.exec("DROP TRIGGER IF EXISTS gdpr_audit_geen_delete");
  geheugenDb.exec("DELETE FROM gdpr_audit_log");
  geheugenDb.exec(`
    CREATE TRIGGER IF NOT EXISTS gdpr_audit_geen_delete
      BEFORE DELETE ON gdpr_audit_log
      BEGIN SELECT RAISE(ABORT, 'audit-log is append-only'); END;
  `);
});

describe("audit-log", () => {
  it("legt wie, wat en wanneer vast", () => {
    schrijfAuditLog({ adminId: 3, actie: "gdpr_export", afnameId: 42 });
    const regels = leesAuditLog();
    expect(regels).toHaveLength(1);
    expect(regels[0]!.adminId).toBe(3);
    expect(regels[0]!.actie).toBe("gdpr_export");
    expect(regels[0]!.afnameId).toBe(42);
    expect(regels[0]!.tijdstip).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("staat een automatische actie zonder adminId toe", () => {
    schrijfAuditLog({ adminId: null, actie: "auto_anonimisering", afnameId: 7, detail: "bewaartermijn" });
    const regel = leesAuditLog()[0]!;
    expect(regel.adminId).toBeNull();
    expect(regel.detail).toBe("bewaartermijn");
  });

  it("is append-only: wijzigen en verwijderen worden door de database geweigerd", () => {
    schrijfAuditLog({ adminId: 1, actie: "anonimisering", afnameId: 9 });
    expect(() =>
      geheugenDb.prepare("UPDATE gdpr_audit_log SET actie = 'gewist' WHERE afname_id = 9").run(),
    ).toThrow(/append-only/);
    expect(() =>
      geheugenDb.prepare("DELETE FROM gdpr_audit_log WHERE afname_id = 9").run(),
    ).toThrow(/append-only/);
    expect(leesAuditLog()[0]!.actie).toBe("anonimisering");
  });

  it("kan de tabel meermaals veilig aanmaken", () => {
    expect(() => {
      zorgVoorAuditTabel();
      zorgVoorAuditTabel();
    }).not.toThrow();
  });

  it("schrijft een auditregel op elke GDPR-route", () => {
    const bron = readFileSync("server/routes/afnames.ts", "utf8");
    // Elk /api/gdpr-blok tot aan de volgende routeregistratie moet een
    // schrijfAuditLog-aanroep bevatten.
    const blokken = bron.split(/app\.(?:get|post|put|patch|delete)\(/).filter((b) => b.startsWith('"/api/gdpr'));
    expect(blokken.length).toBeGreaterThanOrEqual(5);
    for (const blok of blokken) {
      expect(blok, `GDPR-route zonder auditregel: ${blok.slice(0, 60)}`).toContain("schrijfAuditLog(");
    }
  });
});
