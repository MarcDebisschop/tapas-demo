import { describe, it, expect } from "vitest";
import { buildT4StudentsContract } from "../server/t4students/scoring";

// ---------------------------------------------------------------------------
// Fase 1b: eigen vaste-uitkomsten-set voor de motivatiebalans.
//
// Deze test raakt de nieuwe kompas-scoring.ts niet aan. Ze meet uitsluitend
// tegen de BESTAANDE, vandaag draaiende implementatie in
// server/t4students/scoring.ts (buildT4StudentsContract), om zwart op wit te
// hebben hoe die motor de motivatiebalans vandaag berekent, voordat er iets
// wordt overgezet. Dat is de basislijn waartegen de overzetting in
// kompas-scoring.ts (zie tests/t4students-motivatiebalans-motor.test.ts) later
// beoordeeld moet worden.
//
// BELANGRIJKE VASTSTELLING: SCHAALVERSCHIL
// server/t4students/scoring.ts berekent intrinsiek en extrinsiek als het
// gemiddelde van de ENERGIESCORE van de motivatie-items (schaal -2 tot +2,
// via scoreVan/clampScore), niet van de herkenningsscore (schaal 0 tot 3) die
// de rest van het nieuwe instrument gebruikt. Deze vijf tests geven de
// antwoorden dus als energiescore mee (het veld "score", zoals scoreVan het
// leest), niet als herkenning. Dit verschil wordt in het verslag gemeld als
// een open keuze voor de opdrachtgever en is bewust niet zelf beslist.
//
// Het contract van deze motor draagt de motivatiebalans al kant en klaar in
// sections.main.meta.motivatie, met dezelfde drie velden (intrinsiek,
// extrinsiek, balansLabel) als het nieuwe motivatie-veld in kompas-scoring.ts.
// Deze test leest dat bestaande veld uit, in plaats van familyRows, dat geen
// eigen plaats voor de balans zelf heeft.
// ---------------------------------------------------------------------------

function basisOpts(responses: Record<string, unknown>) {
  return {
    respondentCode: "test-motivatiebalans",
    responses,
    taal: "nl" as const,
  };
}

function energie(score: number): { score: number } {
  return { score };
}

describe("motivatiebalans in de bestaande productiemotor (server/t4students/scoring.ts)", () => {
  it("zuiver intrinsiek: alle drie intrinsieke items op +2, beide extrinsieke op -2, levert het label intrinsiek", () => {
    const contract = buildT4StudentsContract(
      basisOpts({
        "T4S-MOT-INT-1": energie(2),
        "T4S-MOT-INT-2": energie(2),
        "T4S-MOT-INT-3": energie(2),
        "T4S-MOT-EXT-1": energie(-2),
        "T4S-MOT-EXT-2": energie(-2),
      }),
    );
    const { motivatie } = contract.sections.main.meta;
    expect(motivatie.intrinsiek).toBe(2);
    expect(motivatie.extrinsiek).toBe(-2);
    expect(motivatie.balansLabel).toBe("intrinsiek");
  });

  it("zuiver extrinsiek: de twee gemiddelden liggen precies verwisseld met het vorige geval", () => {
    const contract = buildT4StudentsContract(
      basisOpts({
        "T4S-MOT-INT-1": energie(-2),
        "T4S-MOT-INT-2": energie(-2),
        "T4S-MOT-INT-3": energie(-2),
        "T4S-MOT-EXT-1": energie(2),
        "T4S-MOT-EXT-2": energie(2),
      }),
    );
    const { motivatie } = contract.sections.main.meta;
    expect(motivatie.intrinsiek).toBe(-2);
    expect(motivatie.extrinsiek).toBe(2);
    expect(motivatie.balansLabel).toBe("extrinsiek");
  });

  it("precies op de drempel: intrinsiek gemiddelde 1, extrinsiek gemiddelde 0.5, verschil exact 0.5", () => {
    const contract = buildT4StudentsContract(
      basisOpts({
        "T4S-MOT-INT-1": energie(1),
        "T4S-MOT-INT-2": energie(1),
        "T4S-MOT-INT-3": energie(1),
        "T4S-MOT-EXT-1": energie(1),
        "T4S-MOT-EXT-2": energie(0),
      }),
    );
    const { motivatie } = contract.sections.main.meta;
    expect(motivatie.intrinsiek).toBe(1);
    expect(motivatie.extrinsiek).toBe(0.5);
    // Precies op de drempel telt in deze motor als "intrinsiek", niet als
    // "evenwichtig": de vergelijking in scoring.ts gebruikt >=, niet >.
    expect(motivatie.balansLabel).toBe("intrinsiek");
  });

  it("net onder de drempel: verschil 0.49 in plaats van 0.5", () => {
    const contract = buildT4StudentsContract(
      basisOpts({
        "T4S-MOT-INT-1": energie(1),
        "T4S-MOT-INT-2": energie(1),
        "T4S-MOT-INT-3": energie(1),
        "T4S-MOT-EXT-1": energie(0.51),
        "T4S-MOT-EXT-2": energie(0.51),
      }),
    );
    const { motivatie } = contract.sections.main.meta;
    expect(motivatie.intrinsiek).toBe(1);
    expect(motivatie.extrinsiek).toBe(0.51);
    expect(motivatie.balansLabel).toBe("evenwichtig");
  });

  it("ontbrekende antwoorden: geen enkel motivatie-item beantwoord geeft een leeg gemiddelde (0) voor beide kanten", () => {
    const contract = buildT4StudentsContract(basisOpts({}));
    const { motivatie } = contract.sections.main.meta;
    // Bij geen enkel antwoord komt de familie niet voor in familyRows, en de
    // ?? 0 in scoring.ts vangt dat af: intrinsiek en extrinsiek worden dan
    // allebei 0, niet een ontbrekende waarde. Dat is een eigenschap van de
    // bestaande motor zelf en wordt hier vastgelegd, niet gewijzigd.
    expect(motivatie.intrinsiek).toBe(0);
    expect(motivatie.extrinsiek).toBe(0);
    expect(motivatie.balansLabel).toBe("evenwichtig");
  });
});
