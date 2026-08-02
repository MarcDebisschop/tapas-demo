// ---------------------------------------------------------------------------
// tests/ronde-b-rekenfouten.test.ts
//
// Ronde B. Vier rekenkundige punten vastzetten:
//   1. T4Sports module 2 (flow): de normtabel loopt over de somscore van de
//      twee items van een schaal, niet over het gemiddelde.
//   2. T4Sports consistentie: koppeling op itemsleutel, niet op positie in een
//      gefilterde lijst.
//   3. T4Organizations: het vermogensgemiddelde weegt per ring, niet per hoofd.
//   5. Driver-scan: het knippunt tussen gaspedaal en rem is een benoemde
//      constante en komt nergens meer los voor.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { scoreModule } from "../server/t4sports/module-scoring";
import { ITEM_ENERGIE_MAX, ITEM_ENERGIE_MIN } from "../shared/energie-schaal";

const WORTEL = join(__dirname, "..");
const lees = (p: string) => readFileSync(join(WORTEL, p), "utf-8");

// ---------------------------------------------------------------------------
// Punt 1: T4Sports module 2, perfecte score hoort het hoogste label te krijgen
// ---------------------------------------------------------------------------
describe("T4Sports module 2, normlabel bij een perfecte invulling", () => {
  // Module 2 heeft 18 items, elk op een schaal van 1 tot en met 5, verdeeld
  // over negen schalen van twee items. Overal 5 is dus de best mogelijke
  // invulling.
  const allesMaximaal: Record<string, number> = {};
  for (let nr = 1; nr <= 18; nr++) allesMaximaal[String(nr)] = 5;

  const allesMinimaal: Record<string, number> = {};
  for (let nr = 1; nr <= 18; nr++) allesMinimaal[String(nr)] = 1;

  it("geeft bij overal het maximum het hoogste normlabel, niet het laagste", () => {
    const resultaat = scoreModule({ moduleId: "M2", antwoorden: allesMaximaal });
    for (const schaal of resultaat.schalen) {
      expect(schaal.score).toBe(10);
      expect(schaal.gemiddelde).toBe(5);
      expect(schaal.normLabel).toBe("Diepe flow");
    }
  });

  it("geeft bij overal het minimum het laagste normlabel", () => {
    const resultaat = scoreModule({ moduleId: "M2", antwoorden: allesMinimaal });
    for (const schaal of resultaat.schalen) {
      expect(schaal.score).toBe(2);
      expect(schaal.normLabel).toBe("Weinig flow");
    }
  });

  it("laat het label oplopen als de antwoorden oplopen", () => {
    const labelBijWaarde = (waarde: number) => {
      const antwoorden: Record<string, number> = {};
      for (let nr = 1; nr <= 18; nr++) antwoorden[String(nr)] = waarde;
      return scoreModule({ moduleId: "M2", antwoorden }).schalen[0].normLabel;
    };
    expect(labelBijWaarde(1)).toBe("Weinig flow"); // som 2
    expect(labelBijWaarde(2)).toBe("Weinig flow"); // som 4
    expect(labelBijWaarde(3)).toBe("Weinig flow"); // som 6
    expect(labelBijWaarde(4)).toBe("Regelmatige flow"); // som 8
    expect(labelBijWaarde(5)).toBe("Diepe flow"); // som 10
  });

  it("laat een overgeslagen item de schaal niet in het laagste vakje vallen", () => {
    // Eén van de twee items van de eerste schaal (items 1 en 10) ontbreekt.
    const antwoorden: Record<string, number> = {};
    for (let nr = 1; nr <= 18; nr++) antwoorden[String(nr)] = 5;
    delete antwoorden["10"];
    const resultaat = scoreModule({ moduleId: "M2", antwoorden });
    const eerste = resultaat.schalen.find((s) => s.id === "challenge_skill")!;
    expect(eerste.gemiddelde).toBe(5);
    expect(eerste.normLabel).toBe("Diepe flow");
  });
});

// ---------------------------------------------------------------------------
// Punt 5: Driver-scan, het knippunt tussen gaspedaal en rem heeft een naam
// ---------------------------------------------------------------------------
describe("Driver-scan, knippunt tussen gaspedaal en rem", () => {
  it("staat als benoemde constante op het midden van de energie-itemschaal", async () => {
    const mod = await import("../server/driverscan/duiding");
    expect(mod.GASPEDAAL_REM_GRENS).toBe(0);
    expect(mod.GASPEDAAL_REM_GRENS).toBe((ITEM_ENERGIE_MIN + ITEM_ENERGIE_MAX) / 2);
  });

  it("komt in de rapportcode niet meer als los getal voor", () => {
    const bron = lees("server/driverscan/rapport-pdf.ts");
    expect(bron).toContain("GASPEDAAL_REM_GRENS");
    // Geen losse vergelijking met 0 meer op de energiewaarde van een driver.
    expect(bron).not.toMatch(/avg\s*>=?\s*0\b/);
  });
});
