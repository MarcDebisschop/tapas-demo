import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import drizzleConfig from "../drizzle.config";
import { vindDatabasePad } from "../server/db-pad";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const drizzleJournaalTabel = "__drizzle_migrations";

function vindSchemaBestanden(): string[] {
  if (!Array.isArray(drizzleConfig.schema)) {
    throw new Error("drizzle.config.ts bevat geen lijst met schemabestanden.");
  }

  return drizzleConfig.schema.map((bestand) => resolve(projectRoot, bestand));
}

function vindTabelnamenInSchema(bestanden: string[]): string[] {
  return bestanden.flatMap((bestand) => {
    const inhoud = readFileSync(bestand, "utf8");
    return [...inhoud.matchAll(/sqliteTable\s*\(\s*["']([^"']+)["']/g)].map(
      (match) => match[1],
    );
  });
}

describe("Drizzle-schema en databank", () => {
  it("dekt elke functionele tabel uit de databank", () => {
    const databank = new Database(vindDatabasePad(), { readonly: true });
    const databankTabellen = databank
      .prepare("SELECT name FROM sqlite_master WHERE type = ? ORDER BY name")
      .all("table")
      .map(({ name }: { name: string }) => name)
      .filter(
        (naam) =>
          !naam.startsWith("sqlite_") && naam !== drizzleJournaalTabel,
      );
    databank.close();

    const schemaTabellen = new Set(
      vindTabelnamenInSchema(vindSchemaBestanden()),
    );
    const ontbrekendeTabellen = databankTabellen.filter(
      (naam) => !schemaTabellen.has(naam),
    );

    // Deze controle vult de bestaande migratietest aan: die controleert of
    // schematabellen een migratie hebben, deze controleert de omgekeerde dekking.
    expect(
      ontbrekendeTabellen,
      `Tabellen zonder sqliteTable-definitie: ${ontbrekendeTabellen.join(", ")}`,
    ).toEqual([]);
  });
});
