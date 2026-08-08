import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migratiesMap = join(projectRoot, "migrations");

function vindBestanden(map: string, extensie: string): string[] {
  if (!existsSync(map)) return [];

  return readdirSync(map, { withFileTypes: true }).flatMap((item) => {
    const pad = join(map, item.name);
    if (item.isDirectory()) return vindBestanden(pad, extensie);
    return item.isFile() && item.name.endsWith(extensie) ? [pad] : [];
  });
}

function vindSchemaBestanden(): string[] {
  return [
    join(projectRoot, "shared", "schema.ts"),
    ...vindBestanden(join(projectRoot, "server"), "schema.ts"),
  ];
}

function vindTabelnamen(schemaBestanden: string[]): string[] {
  return schemaBestanden.flatMap((bestand) => {
    const inhoud = readFileSync(bestand, "utf8");
    return [...inhoud.matchAll(/sqliteTable\s*\(\s*["']([^"']+)["']/g)].map((match) => match[1]);
  });
}

function ontsnapReguliereExpressie(waarde: string): string {
  return waarde.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("Drizzle-migraties", () => {
  it("bevat een map migrations", () => {
    expect(existsSync(migratiesMap)).toBe(true);
  });

  it("bevat minstens een SQL-migratie", () => {
    expect(vindBestanden(migratiesMap, ".sql").length).toBeGreaterThan(0);
  });

  it("beschrijft alle Drizzle-tabellen, inclusief HDD", () => {
    const schemaBestanden = vindSchemaBestanden();
    const relatieveSchemaBestanden = schemaBestanden.map((bestand) =>
      bestand.slice(projectRoot.length + 1),
    );
    const tabelnamen = vindTabelnamen(schemaBestanden);
    const migratieSql = vindBestanden(migratiesMap, ".sql")
      .map((bestand) => readFileSync(bestand, "utf8"))
      .join("\n");

    expect(relatieveSchemaBestanden).toContain("server/hdd/schema.ts");
    expect(tabelnamen).toContain("hdd_trajecten");
    expect(tabelnamen).toContain("hdd_board_leden");
    expect(tabelnamen.length).toBeGreaterThan(0);

    for (const tabelnaam of tabelnamen) {
      const patroon = new RegExp(
        `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?[^\\w]*${ontsnapReguliereExpressie(tabelnaam)}\\b`,
        "i",
      );
      expect(migratieSql, `Geen migratie voor tabel ${tabelnaam}`).toMatch(patroon);
    }
  });
});
