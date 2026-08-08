import { afterEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const oorspronkelijkeWerkmap = process.cwd();
const oorspronkelijkePad = process.env.TAPAS_DB_PATH;
const tijdelijkeMappen: string[] = [];

function maakTijdelijkPad(): { map: string; databestand: string } {
  const map = mkdtempSync(join(tmpdir(), "tapas-hdd-databestand-"));
  tijdelijkeMappen.push(map);
  return { map, databestand: join(map, "platform.db") };
}

async function laadHddOpslag(databestand: string, werkmap: string) {
  process.env.TAPAS_DB_PATH = databestand;
  process.chdir(werkmap);
  vi.resetModules();
  return await import("../server/hdd/storage");
}

afterEach(() => {
  process.chdir(oorspronkelijkeWerkmap);
  if (oorspronkelijkePad === undefined) delete process.env.TAPAS_DB_PATH;
  else process.env.TAPAS_DB_PATH = oorspronkelijkePad;
  vi.resetModules();
  for (const map of tijdelijkeMappen.splice(0)) rmSync(map, { recursive: true, force: true });
});

describe("HDD-databestand", () => {
  it("schrijft HDD naar TAPAS_DB_PATH en niet naar data.db in de werkmap", async () => {
    const { map, databestand } = maakTijdelijkPad();
    const { hddStorage } = await laadHddOpslag(databestand, map);
    const boardNaam = `test-board-${Date.now()}`;

    hddStorage.maakTraject({ boardNaam });

    expect(existsSync(databestand)).toBe(true);
    const doel = new Database(databestand, { readonly: true });
    expect(
      doel.prepare("SELECT board_naam FROM hdd_trajecten WHERE board_naam = ?").get(boardNaam),
    ).toEqual({ board_naam: boardNaam });
    doel.close();
    expect(existsSync(join(map, "data.db"))).toBe(false);
  });

  it("laat HDD en de hoofdopslag naar exact hetzelfde databestand wijzen", async () => {
    const { map, databestand } = maakTijdelijkPad();
    const { hddStorage } = await laadHddOpslag(databestand, map);
    process.chdir(oorspronkelijkeWerkmap);
    const { sqlite } = await import("../server/storage");
    const boardNaam = `gedeeld-board-${Date.now()}`;

    hddStorage.maakTraject({ boardNaam });

    expect(resolve((sqlite as any).name)).toBe(resolve(databestand));
    expect(
      sqlite.prepare("SELECT board_naam FROM hdd_trajecten WHERE board_naam = ?").get(boardNaam),
    ).toEqual({ board_naam: boardNaam });
  });
});
