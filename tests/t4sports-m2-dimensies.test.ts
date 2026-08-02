import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Ronde C, punt 3. De registerbeschrijving van T4Sports module 2 noemde zes
// dimensies terwijl het databestand er negen bevat. Alle negen worden gescoord
// en alle negen komen in het rapport; er viel dus niets stilzwijgend weg. Deze
// test telt het aantal in het databestand en houdt beschrijving en werkelijkheid
// aan elkaar vast.
// ---------------------------------------------------------------------------

const wortel = path.resolve(__dirname, "..");

const modules = JSON.parse(
  readFileSync(path.join(wortel, "server/data/t4sports-modules.json"), "utf-8"),
) as { modules: Record<string, { aantalItems: number; schalen: { id: string; items: number[] }[] }> };

describe("T4Sports module 2: het aantal dimensies", () => {
  const m2 = modules.modules.M2;

  it("het databestand bevat negen dimensies van elk twee items", () => {
    expect(m2.schalen).toHaveLength(9);
    for (const schaal of m2.schalen) {
      expect(schaal.items, `dimensie ${schaal.id}`).toHaveLength(2);
    }
    expect(m2.aantalItems).toBe(18);
  });

  it("de registerbeschrijving noemt datzelfde aantal", async () => {
    const { getDescriptor } = await import("../server/registry");
    const d = getDescriptor("t4sports-m2");
    expect(d).toBeDefined();
    expect(d!.description).toContain(`${m2.schalen.length} dimensies`);
    expect(d!.description).not.toContain("6 dimensies");
  });

  it("de scoring geeft alle negen dimensies terug", async () => {
    const { scoreModule } = await import("../server/t4sports/module-scoring");
    const antwoorden: Record<string, number> = {};
    for (let i = 1; i <= m2.aantalItems; i++) antwoorden[String(i)] = 3;
    const resultaat = scoreModule({ moduleId: "M2", antwoorden });
    expect(resultaat.schalen).toHaveLength(9);
  });
});
