import Database from "better-sqlite3";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import drizzleConfig from "../drizzle.config";

/**
 * Deze test loopt de weg die een echte server ook loopt: een leeg
 * databankbestand, dan opstarten, en dan kijken of de tabellen er zijn die de
 * code nodig heeft.
 *
 * De bestaande test `schema-dekt-databank` kijkt de andere kant op: staat elke
 * tabel die in de databank zit ook in het schema? Die vangt niet dat een tabel
 * uit het schema in de databank ontbreekt. Precies dat gat liet de Regiekamer
 * op een verse installatie omvallen met "no such table: traject".
 *
 * Er wordt met opzet een apart proces gestart. De opstartcode opent de databank
 * op het moment dat de module geladen wordt, dus binnen een lopende testreeks is
 * dat pad niet meer te veranderen. Een apart proces meet wat productie doet en
 * niet wat de testomgeving toevallig al klaargezet heeft.
 */

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const drizzleJournaalTabel = "__drizzle_migrations";

let werkmap: string;
let databankPad: string;

function schemaBestanden(): string[] {
  if (!Array.isArray(drizzleConfig.schema)) {
    throw new Error("drizzle.config.ts bevat geen lijst met schemabestanden.");
  }
  return drizzleConfig.schema.map((bestand) => resolve(projectRoot, bestand));
}

function tabelnamenUitSchema(): string[] {
  return schemaBestanden().flatMap((bestand) => {
    const inhoud = readFileSync(bestand, "utf8");
    return [...inhoud.matchAll(/sqliteTable\s*\(\s*["']([^"']+)["']/g)].map(
      (treffer) => treffer[1],
    );
  });
}

function tabelnamenInDatabank(pad: string): string[] {
  const databank = new Database(pad, { readonly: true });
  try {
    return databank
      .prepare("SELECT name FROM sqlite_master WHERE type = ? ORDER BY name")
      .all("table")
      .map(({ name }: { name: string }) => name)
      .filter((naam) => !naam.startsWith("sqlite_") && naam !== drizzleJournaalTabel);
  } finally {
    databank.close();
  }
}

beforeAll(() => {
  werkmap = mkdtempSync(join(tmpdir(), "tapas-opstart-"));
  databankPad = join(werkmap, "data.db");

  // Enkel de opslagmodule laden. Dat is wat de server als eerste doet en het is
  // de plaats waar de databank wordt klaargezet.
  execFileSync(
    "npx",
    ["tsx", "-e", 'import("./server/storage.ts").then(() => process.exit(0));'],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        TAPAS_DB_PATH: databankPad,
        TAPAS_DEMO: "0",
        NODE_ENV: "development",
      },
      timeout: 180_000,
      stdio: "pipe",
    },
  );
}, 200_000);

afterAll(() => {
  if (werkmap) rmSync(werkmap, { recursive: true, force: true });
});

describe("Een verse opstart", () => {
  it("maakt elke tabel aan die in een schema beschreven staat", () => {
    const aanwezig = new Set(tabelnamenInDatabank(databankPad));
    const verwacht = [...new Set(tabelnamenUitSchema())].sort();
    const ontbreekt = verwacht.filter((naam) => !aanwezig.has(naam));

    expect(
      ontbreekt,
      `Deze tabellen staan in een schema maar worden bij het opstarten niet aangemaakt: ${ontbreekt.join(", ")}`,
    ).toEqual([]);
  });

  it("houdt bij welke migraties zijn toegepast", () => {
    const aanwezig = new Set(tabelnamenInDatabank(databankPad));
    const register = new Database(databankPad, { readonly: true });
    let toegepast: string[] = [];
    try {
      const heeftRegister = register
        .prepare("SELECT name FROM sqlite_master WHERE type = ? AND name = ?")
        .get("table", "migratie_register");
      if (heeftRegister) {
        toegepast = register
          .prepare("SELECT naam FROM migratie_register ORDER BY naam")
          .all()
          .map(({ naam }: { naam: string }) => naam);
      }
    } finally {
      register.close();
    }

    // Zonder register kan een migratie die een tabel afbreekt en opnieuw opbouwt
    // een tweede keer draaien. Dan gaan de rijen die er al stonden verloren.
    expect(
      toegepast.length,
      "Er is geen register van toegepaste migraties; een herhaalbare opstart is dan niet gegarandeerd.",
    ).toBeGreaterThan(0);
    expect(aanwezig.has("traject")).toBe(true);
  });
});
