import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT } from "../server/t4students/instrument";
import { voedingPerConstruct, beantwoordPerFamilie } from "../server/t4students/rapport-contract";
import type { T4SAntwoorden } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Onderdeel A1 van de opdracht "Studiekompas persoonlijk maken".
//
// Het dekkingsblad (pagina "Hoe scherp is dit beeld") toont per familie hoeveel
// van de bijbehorende vragen beantwoord zijn. Die telling komt uit
// beantwoordPerFamilie(), die op zijn beurt voedingPerConstruct() gebruikt.
// voedingPerConstruct() liep tot nu toe over recognitionItems, beeldItems,
// interestItems, de sjt-items en energyItems, maar nooit over
// motivationItems. Daardoor kreeg de familie "Motivatie" nul voedende items
// toegewezen, en toonde het dekkingsblad "0 van 0" voor Motivatie, ook als de
// vijf motivatievragen wel degelijk beantwoord waren.
//
// Dit bestand legt vast dat de vijf motivatie-items wel meetellen als voeding
// voor hun construct, en dat de familie Motivatie in beantwoordPerFamilie een
// totaal van 5 krijgt (een voor elk van Autonomie, Competentie, Verbondenheid,
// Erkenning, Verwachting) en het aantal effectief beantwoorde motivatievragen
// als "beantwoord".
//
// Vóór de fix is dit rood: totaal voor Motivatie is dan 0.
// ---------------------------------------------------------------------------

describe("voedingPerConstruct telt de motivatie-items mee", () => {
  it("elk motivatieconstruct heeft precies een herkenningsitem als voeding", () => {
    const voeding = voedingPerConstruct(T4STUDENTS_INSTRUMENT);
    for (const con of ["Autonomie", "Competentie", "Verbondenheid", "Erkenning", "Verwachting"]) {
      expect(voeding[con]).toBeDefined();
      expect(voeding[con].herkenningsItems.length).toBe(1);
    }
  });

  it("de motivatie-items van de motor (MOT-INT-*/MOT-EXT-*) staan in de voeding", () => {
    const voeding = voedingPerConstruct(T4STUDENTS_INSTRUMENT);
    const alleIds = Object.values(voeding).flatMap((v) => v.herkenningsItems);
    for (const id of ["MOT-INT-1", "MOT-INT-2", "MOT-INT-3", "MOT-EXT-1", "MOT-EXT-2"]) {
      expect(alleIds).toContain(id);
    }
  });
});

describe("beantwoordPerFamilie telt de familie Motivatie correct", () => {
  it("de familie Motivatie heeft een totaal van 5 vragen, niet 0", () => {
    const antwoorden: T4SAntwoorden = {};
    const rijen = beantwoordPerFamilie(T4STUDENTS_INSTRUMENT, antwoorden);
    const motivatie = rijen.find((r) => r.familie === "Motivatie");
    expect(motivatie).toBeDefined();
    expect(motivatie!.totaal).toBe(5);
  });

  it("beantwoorde motivatievragen tellen mee in beantwoordPerFamilie", () => {
    const antwoorden: T4SAntwoorden = {
      "MOT-INT-1": { recognition: 2 },
      "MOT-INT-2": { recognition: 1 },
      "MOT-INT-3": { recognition: 0 },
      "MOT-EXT-1": { recognition: -1 },
      "MOT-EXT-2": { recognition: -2 },
    };
    const rijen = beantwoordPerFamilie(T4STUDENTS_INSTRUMENT, antwoorden);
    const motivatie = rijen.find((r) => r.familie === "Motivatie");
    expect(motivatie).toBeDefined();
    expect(motivatie!.beantwoord).toBe(5);
    expect(motivatie!.totaal).toBe(5);
  });

  it("een gedeeltelijk ingevulde motivatievragenlijst geeft een gedeeltelijke telling", () => {
    const antwoorden: T4SAntwoorden = {
      "MOT-INT-1": { recognition: 2 },
      "MOT-EXT-1": { recognition: -1 },
    };
    const rijen = beantwoordPerFamilie(T4STUDENTS_INSTRUMENT, antwoorden);
    const motivatie = rijen.find((r) => r.familie === "Motivatie");
    expect(motivatie).toBeDefined();
    expect(motivatie!.beantwoord).toBe(2);
    expect(motivatie!.totaal).toBe(5);
  });
});
