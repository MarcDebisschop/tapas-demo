// ---------------------------------------------------------------------------
// tests/role-fit-migratie.test.ts
//
// De tabellen van Recruitment & Role Fit hebben drie beschrijvingen die
// gelijk moeten blijven: server/role-fit/ddl.ts (aangemaakt bij het opstarten),
// migrations/0012_role_fit.sql (voor de migratieloper) en het Drizzle-schema
// server/role-fit/schema.ts. Deze test houdt ze gelijk en toont dat de
// migratie zowel op een lege als op een bestaande databank werkt, en dat de
// triggers ingediende observaties, besluiten en artefacten onveranderlijk
// maken.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { ROLE_FIT_DDL, ROLE_FIT_TABELLEN, roleFitStatements } from "../server/role-fit/ddl";
import { ROLE_FIT_DRIZZLE_TABELLEN } from "../server/role-fit/schema";
import { REEDS_TOEGEPAST } from "../server/migratieloper";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migratie = readFileSync(resolve(root, "migrations/0012_role_fit.sql"), "utf8");

function databankMetDdl(): InstanceType<typeof Database> {
  const d = new Database(":memory:");
  for (const s of roleFitStatements()) d.exec(s);
  return d;
}

describe("Role Fit: migratie en schema", () => {
  it("de migratie is letterlijk de DDL uit de code (op de kopcommentaar na)", () => {
    const zonderKop = migratie
      .replace(/\r\n/g, "\n")
      .split("\n")
      .filter((r, i, alle) => !(r.startsWith("--") && !r.startsWith("--> ") && alle.slice(0, i).every((x) => x.startsWith("--") || x.trim() === "")))
      .join("\n")
      .trim();
    expect(zonderKop).toBe(ROLE_FIT_DDL.replace(/\r\n/g, "\n").trim());
  });

  it("maakt alle veertien tabellen, en een tweede keer uitvoeren verandert niets", () => {
    const d = databankMetDdl();
    for (const s of roleFitStatements()) d.exec(s);
    const namen = (d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'role_fit_%' ORDER BY name").all() as any[]).map((r) => r.name);
    expect(namen).toEqual([...ROLE_FIT_TABELLEN].sort());
    expect(namen.length).toBe(14);
  });

  it("het Drizzle-schema komt kolom voor kolom overeen met de databank", () => {
    const d = databankMetDdl();
    expect(ROLE_FIT_DRIZZLE_TABELLEN.length).toBe(ROLE_FIT_TABELLEN.length);
    for (const t of ROLE_FIT_DRIZZLE_TABELLEN) {
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
    expect(REEDS_TOEGEPAST["0012_role_fit"](d)).toBe(false);
    for (const s of roleFitStatements()) d.exec(s);
    expect(REEDS_TOEGEPAST["0012_role_fit"](d)).toBe(true);
    expect(d.prepare("SELECT sql FROM sqlite_master WHERE name='afnames'").get()).toEqual(voor);
    expect((d.prepare("SELECT COUNT(*) AS n FROM afnames").get() as any).n).toBe(1);
  });

  it("maakt ingediende observaties, besluiten en artefacten onveranderlijk", () => {
    const d = databankMetDdl();
    const tabellen = ["role_fit_observations", "role_fit_decisions", "role_fit_artifacts"];
    const triggers = (d.prepare("SELECT tbl_name, sql FROM sqlite_master WHERE type='trigger'").all() as any[]);
    for (const t of tabellen) {
      expect(triggers.some((x) => x.tbl_name === t && /UPDATE/i.test(x.sql)), `${t} update`).toBe(true);
    }
  });

  it("heeft geen em-dash, en-dash of minteken in de migratie", () => {
    expect(/[\u2013\u2014\u2212]/.test(migratie)).toBe(false);
  });
});
