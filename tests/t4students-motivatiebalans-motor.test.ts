import { describe, it, expect } from "vitest";
import { scoreStudiekompas, type T4SAntwoorden } from "../server/t4students/kompas-scoring";
import { T4STUDENTS_INSTRUMENT } from "../server/t4students/instrument";

// ---------------------------------------------------------------------------
// Fase 1b: de motivatiebalans in de overgezette scoringsmotor.
//
// De formule en de drempel komen letterlijk uit server/t4students/scoring.ts
// (de bestaande, vandaag draaiende T4Students-toepassing): het gemiddelde van
// de drie intrinsieke items minus het gemiddelde van de twee extrinsieke
// items, met een drempel van 0.5 voor het label "intrinsiek" of "extrinsiek".
// Onder die drempel heet de balans "evenwichtig".
//
// Belangrijk: de motivatiebalans mag geen van de bestaande velden van
// T4SResultaat wijzigen. Dat wordt in de gelijkheidstoets van fase 1 bewaakt
// (tests/t4students-gelijkheidstoets.test.ts); hier wordt alleen het nieuwe
// veld zelf getest.
// ---------------------------------------------------------------------------

function antwoord(recognition: number): { recognition: number } {
  return { recognition };
}

describe("de motivatiebalans in scoreStudiekompas", () => {
  it("het resultaat draagt een veld motivatie met intrinsiek, extrinsiek en balansLabel", () => {
    const antwoorden: T4SAntwoorden = {
      "MOT-INT-1": antwoord(3),
      "MOT-INT-2": antwoord(3),
      "MOT-INT-3": antwoord(3),
      "MOT-EXT-1": antwoord(0),
      "MOT-EXT-2": antwoord(0),
    };
    const res: any = scoreStudiekompas(T4STUDENTS_INSTRUMENT, antwoorden, null, "nl");
    expect(res.motivatie).toBeDefined();
    expect(res.motivatie.intrinsiek).toBe(3);
    expect(res.motivatie.extrinsiek).toBe(0);
    expect(res.motivatie.balansLabel).toBe("intrinsiek");
  });

  it("zuiver extrinsiek geeft het label extrinsiek", () => {
    const antwoorden: T4SAntwoorden = {
      "MOT-INT-1": antwoord(0),
      "MOT-INT-2": antwoord(0),
      "MOT-INT-3": antwoord(0),
      "MOT-EXT-1": antwoord(3),
      "MOT-EXT-2": antwoord(3),
    };
    const res: any = scoreStudiekompas(T4STUDENTS_INSTRUMENT, antwoorden, null, "nl");
    expect(res.motivatie.balansLabel).toBe("extrinsiek");
  });

  it("precies op de drempel van 0.5 telt al als intrinsiek", () => {
    // intrinsiek gemiddelde 2, extrinsiek gemiddelde 1.5: verschil is exact 0.5.
    const antwoorden: T4SAntwoorden = {
      "MOT-INT-1": antwoord(2),
      "MOT-INT-2": antwoord(2),
      "MOT-INT-3": antwoord(2),
      "MOT-EXT-1": antwoord(2),
      "MOT-EXT-2": antwoord(1),
    };
    const res: any = scoreStudiekompas(T4STUDENTS_INSTRUMENT, antwoorden, null, "nl");
    expect(res.motivatie.intrinsiek).toBe(2);
    expect(res.motivatie.extrinsiek).toBe(1.5);
    expect(res.motivatie.balansLabel).toBe("intrinsiek");
  });

  it("net onder de drempel blijft evenwichtig", () => {
    // intrinsiek gemiddelde 2, extrinsiek gemiddelde 1.51: verschil 0.49, onder 0.5.
    const antwoorden: T4SAntwoorden = {
      "MOT-INT-1": antwoord(2),
      "MOT-INT-2": antwoord(2),
      "MOT-INT-3": antwoord(2),
      "MOT-EXT-1": antwoord(1.51),
      "MOT-EXT-2": antwoord(1.51),
    };
    const res: any = scoreStudiekompas(T4STUDENTS_INSTRUMENT, antwoorden, null, "nl");
    expect(res.motivatie.balansLabel).toBe("evenwichtig");
  });

  it("ontbrekende antwoorden geven een gemiddelde van nul voor die kant, geen fout", () => {
    const antwoorden: T4SAntwoorden = {};
    const res: any = scoreStudiekompas(T4STUDENTS_INSTRUMENT, antwoorden, null, "nl");
    expect(res.motivatie.intrinsiek).toBe(0);
    expect(res.motivatie.extrinsiek).toBe(0);
    expect(res.motivatie.balansLabel).toBe("evenwichtig");
  });

  it("de motivatiebalans laat de bestaande velden van het resultaat ongewijzigd", () => {
    // Steekproef: eenvoudig antwoordenpatroon met en zonder motivatie-items
    // moet exact dezelfde niet-motivatie-velden opleveren.
    const basis: T4SAntwoorden = { D1: { recognition: 2, energy: 1 } };
    const metMotivatie: T4SAntwoorden = {
      ...basis,
      "MOT-INT-1": antwoord(3),
      "MOT-EXT-1": antwoord(1),
    };
    const zonder: any = scoreStudiekompas(T4STUDENTS_INSTRUMENT, basis, null, "nl");
    const met: any = scoreStudiekompas(T4STUDENTS_INSTRUMENT, metMotivatie, null, "nl");
    delete zonder.motivatie;
    delete met.motivatie;
    delete zonder.constructScores.Autonomie;
    delete zonder.constructScores.Competentie;
    delete zonder.constructScores.Verbondenheid;
    delete zonder.constructScores.Erkenning;
    delete zonder.constructScores.Verwachting;
    delete met.constructScores.Autonomie;
    delete met.constructScores.Competentie;
    delete met.constructScores.Verbondenheid;
    delete met.constructScores.Erkenning;
    delete met.constructScores.Verwachting;
    expect(met).toEqual(zonder);
  });
});
