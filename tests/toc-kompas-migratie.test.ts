// ---------------------------------------------------------------------------
// tests/toc-kompas-migratie.test.ts
//
// De tabellen van het TOC Commitmentkompas hebben drie beschrijvingen die
// gelijk moeten blijven: server/toc-kompas/ddl.ts (aangemaakt bij het
// opstarten), migrations/0013_toc_kompas.sql (voor de migratieloper) en het
// Drizzle-schema server/toc-kompas/schema.ts. Deze test houdt ze gelijk en
// toont dat de migratie zowel op een lege als op een bestaande databank werkt,
// en dat de triggers ingediende vragenlijsten, besluiten en artefacten
// onveranderlijk maken.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { TOC_KOMPAS_DDL, TOC_KOMPAS_TABELLEN, tocKompasStatements } from "../server/toc-kompas/ddl";
import { TOC_KOMPAS_DRIZZLE_TABELLEN } from "../server/toc-kompas/schema";
import { REEDS_TOEGEPAST } from "../server/migratieloper";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migratie = readFileSync(resolve(root, "migrations/0013_toc_kompas.sql"), "utf8");

function databankMetDdl(): InstanceType<typeof Database> {
  const d = new Database(":memory:");
  for (const s of tocKompasStatements()) d.exec(s);
  return d;
}

function vulBasis(d: InstanceType<typeof Database>) {
  const t = "2026-09-26T10:00:00.000Z";
  d.prepare("INSERT INTO toc_kompas_rondes (titel, periode, owner_admin_id, created_at, updated_at) VALUES (?,?,?,?,?)").run("Nulmeting", "2026-Q4", 1, t, t);
  d.prepare("INSERT INTO toc_kompas_captains (ronde_id, rol, naam, token_hash, created_at, updated_at) VALUES (1,'visibility','Gina Peeters','h1',?,?)").run(t, t);
  d.prepare("INSERT INTO toc_kompas_indieningen (ronde_id, captain_id, versie, antwoorden_json, content_hash, ingediend_op) VALUES (1,1,1,'{}','x',?)").run(t);
  d.prepare("INSERT INTO toc_kompas_besluiten (ronde_id, datum, onderwerp, besluit, beslisser, vastgelegd_door_admin_id, created_at) VALUES (1,'2026-10-01','Onderwerp','Besluit','TOC als geheel',1,?)").run(t);
  d.prepare("INSERT INTO toc_kompas_artefacten (ronde_id, type, versie, input_hash, html, created_at) VALUES (1,'workshopdossier',1,'h','<p></p>',?)").run(t);
}

describe("TOC Commitmentkompas: migratie en schema", () => {
  it("de migratie is letterlijk de DDL uit de code (op de kopcommentaar na)", () => {
    const zonderKop = migratie
      .replace(/\r\n/g, "\n")
      .split("\n")
      .filter((r, i, alle) => !(r.startsWith("--") && !r.startsWith("--> ") && alle.slice(0, i).every((x) => x.startsWith("--") || x.trim() === "")))
      .join("\n")
      .trim();
    expect(zonderKop).toBe(TOC_KOMPAS_DDL.replace(/\r\n/g, "\n").trim());
  });

  it("bevat enkel CREATE ... IF NOT EXISTS: strikt additief", () => {
    for (const s of tocKompasStatements()) {
      expect(s, s.slice(0, 60)).toMatch(/^CREATE (TABLE|UNIQUE INDEX|INDEX|TRIGGER) IF NOT EXISTS /);
    }
    expect(/\b(ALTER|DROP)\b/i.test(TOC_KOMPAS_DDL)).toBe(false);
  });

  it("maakt alle zes tabellen, en een tweede keer uitvoeren verandert niets", () => {
    const d = databankMetDdl();
    for (const s of tocKompasStatements()) d.exec(s);
    const namen = (d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'toc_kompas_%' ORDER BY name").all() as any[]).map((r) => r.name);
    expect(namen).toEqual([...TOC_KOMPAS_TABELLEN].sort());
    expect(namen.length).toBe(6);
  });

  it("het Drizzle-schema komt kolom voor kolom overeen met de databank", () => {
    const d = databankMetDdl();
    expect(TOC_KOMPAS_DRIZZLE_TABELLEN.length).toBe(TOC_KOMPAS_TABELLEN.length);
    for (const t of TOC_KOMPAS_DRIZZLE_TABELLEN) {
      const cfg = getTableConfig(t as any);
      const pragma = d.prepare(`PRAGMA table_info(\`${cfg.name}\`)`).all() as Array<{ name: string; notnull: number; pk: number }>;
      const inDb = pragma.map((k) => k.name).sort();
      const inSchema = cfg.columns.map((k) => k.name).sort();
      expect(inSchema, cfg.name).toEqual(inDb);
      for (const k of cfg.columns) {
        const p = pragma.find((x) => x.name === k.name)!;
        if (!p.pk) expect(Boolean(p.notnull), `${cfg.name}.${k.name}`).toBe(k.notNull);
      }
    }
  });

  it("loopt op een bestaande databank met andere tabellen zonder die te raken", () => {
    const d = new Database(":memory:");
    d.exec("CREATE TABLE afnames (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO afnames (name) VALUES ('bestaand');");
    const voor = d.prepare("SELECT sql FROM sqlite_master WHERE name='afnames'").get();
    expect(REEDS_TOEGEPAST["0013_toc_kompas"](d)).toBe(false);
    for (const s of tocKompasStatements()) d.exec(s);
    expect(REEDS_TOEGEPAST["0013_toc_kompas"](d)).toBe(true);
    expect(d.prepare("SELECT sql FROM sqlite_master WHERE name='afnames'").get()).toEqual(voor);
    expect((d.prepare("SELECT COUNT(*) AS n FROM afnames").get() as any).n).toBe(1);
  });

  it("maakt ingediende vragenlijsten, besluiten en artefacten onveranderlijk", () => {
    const d = databankMetDdl();
    vulBasis(d);
    expect(() => d.prepare("UPDATE toc_kompas_indieningen SET antwoorden_json = '{\"x\":1}'").run()).toThrow(/niet gewijzigd/);
    expect(() => d.prepare("UPDATE toc_kompas_besluiten SET besluit = 'anders'").run()).toThrow(/niet gewijzigd/);
    expect(() => d.prepare("DELETE FROM toc_kompas_besluiten").run()).toThrow(/niet verwijderd/);
    expect(() => d.prepare("UPDATE toc_kompas_artefacten SET html = 'x'").run()).toThrow(/niet gewijzigd/);
  });

  it("weigert een tweede Captain met dezelfde rol in dezelfde ronde en een tweede ronde voor hetzelfde kwartaal", () => {
    const d = databankMetDdl();
    vulBasis(d);
    const t = "2026-09-26T10:00:00.000Z";
    expect(() =>
      d.prepare("INSERT INTO toc_kompas_captains (ronde_id, rol, naam, token_hash, created_at, updated_at) VALUES (1,'visibility','Dubbel','h2',?,?)").run(t, t),
    ).toThrow(/UNIQUE/);
    expect(() =>
      d.prepare("INSERT INTO toc_kompas_rondes (titel, periode, owner_admin_id, created_at, updated_at) VALUES ('Tweede','2026-Q4',1,?,?)").run(t, t),
    ).toThrow(/UNIQUE/);
  });

  it("laat enkel de vier Captain-rollen toe, zonder rangorde", () => {
    const d = databankMetDdl();
    vulBasis(d);
    const t = "2026-09-26T10:00:00.000Z";
    expect(() =>
      d.prepare("INSERT INTO toc_kompas_captains (ronde_id, rol, naam, token_hash, created_at, updated_at) VALUES (1,'ceo','X','h3',?,?)").run(t, t),
    ).toThrow(/CHECK/);
  });

  it("heeft geen em-dash, en-dash of minteken in de migratie en de DDL", () => {
    expect(/[\u2013\u2014\u2212]/.test(migratie)).toBe(false);
    expect(/[\u2013\u2014\u2212]/.test(TOC_KOMPAS_DDL)).toBe(false);
  });
});
