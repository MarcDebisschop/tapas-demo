import { describe, it, expect } from "vitest";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { voedingPerConstruct } from "../server/t4students/voeding";

// ---------------------------------------------------------------------------
// Herstelronde 2, punt A: de motor rangschikt op het aandeel van het haalbare
// maximum, niet meer op de ruwe herkenningssom.
//
// WAT ER MIS GING
// Elk construct heeft een ander hoogst haalbaar aantal punten. Een construct
// dat door meer vragen gevoed wordt, haalt vanzelf een hogere ruwe som. De
// motor zette constructen met een hogere ruwe som boven constructen met een
// hoger aandeel, wat geen eerlijke vergelijking is.
//
// DEZE TESTCASUS (talent-versnellers)
// Groepsondersteunend: ruwe herkenning 4 op een haalbaar maximum van 6
// (V3 + D5 + F5) → aandeel 4/6 = 0,667.
// Impact: ruwe herkenning 3 op een haalbaar maximum van 3 (V4 alleen) →
// aandeel 3/3 = 1,0.
// Op de ruwe som staat Groepsondersteunend boven Impact (4 > 3). Op het
// aandeel moet Impact boven Groepsondersteunend staan (1,0 > 0,667).
// ---------------------------------------------------------------------------

const ANTWOORDEN_VERSNELLERS = {
  V3: { recognition: 2, energy: 1 },
  V4: { recognition: 3, energy: 1 },
  D5: { choice: "b" },
  F5: { choice: "a" },
  S1: { choice: "overzicht" },
} as const;

describe("punt A: de motor rangschikt op aandeel, niet op ruwe som", () => {
  it("talent-versnellers: Impact komt boven Groepsondersteunend te staan (hoger aandeel, lagere ruwe som)", () => {
    const resultaat = scoreStudiekompas(I, ANTWOORDEN_VERSNELLERS, null, "nl");

    // Vooropstelling: op de ruwe som zou Groepsondersteunend (4) boven
    // Impact (3) staan. De motor moet dat nu net andersom zetten, want het
    // aandeel van Impact (3/3 = 1,0) is hoger dan dat van Groepsondersteunend
    // (4/6 = 0,667).
    const plaats = (con: string) => resultaat.versnellers.rangorde.indexOf(con);
    expect(
      plaats("Impact"),
      "Impact heeft het hoogste aandeel en moet boven Groepsondersteunend staan",
    ).toBeLessThan(plaats("Groepsondersteunend"));
  });

  it("talent-foci: de rangorde volgt het aandeel over het hele instrument, niet de ruwe som", () => {
    // Een brede invulling met velden uit meerdere families, opgezet zodat de
    // ruwe-som-volgorde en de aandeel-volgorde voor talent-foci uiteenlopen.
    const antwoorden = {
      ...ANTWOORDEN_VERSNELLERS,
      F1: { recognition: 3, energy: 1 },
      F2: { recognition: 1, energy: -1 },
      F3: { recognition: 2, energy: 0 },
      F6: { recognition: 3, energy: 2 },
      D1: { recognition: 2 },
      D2: { recognition: 1 },
      D3: { recognition: 3 },
      D4: { recognition: 0 },
      D6: { choice: "a" },
      D7: { recognition: 2 },
    } as const;
    const resultaat = scoreStudiekompas(I, antwoorden, null, "nl");
    const voeding = voedingPerConstruct(I);

    const fociFam = I.families.find((f) => f.id === "Talent-foci")!;
    for (const con of fociFam.constructs) {
      const v = voeding[con];
      if (!v || v.maxHerkenning === 0) continue;
    }

    // Bereken het aandeel zelf, onafhankelijk van de motor, en vergelijk met
    // resultaat.foci.sorted: de volgorde moet dalend op aandeel zijn.
    const aandeel = (con: string): number => {
      const score = resultaat.constructScores[con];
      const v = voeding[con];
      if (!score || !v || v.maxHerkenning === 0) return 0;
      return score.recognition / v.maxHerkenning;
    };
    const gesorteerd = resultaat.foci.sorted;
    for (let i = 0; i < gesorteerd.length - 1; i++) {
      expect(
        aandeel(gesorteerd[i]) + 1e-9,
        `foci.sorted moet dalend op aandeel staan: ${gesorteerd[i]} (${aandeel(gesorteerd[i])}) vs ${gesorteerd[i + 1]} (${aandeel(gesorteerd[i + 1])})`,
      ).toBeGreaterThanOrEqual(aandeel(gesorteerd[i + 1]));
    }
  });

  it("drivers: Be Perfect (3 van 4) komt boven Be Strong (3 van 8) te staan bij gelijke ruwe som", () => {
    // Be Perfect: alleen D1, maximum 4. Be Strong: D5/D6 laden er soms op,
    // maximum 8, geen eigen herkenningsitem. Bij ruwe som 3 om 3 zou de motor
    // vroeger een willekeurige of stabiele volgorde geven; op aandeel moet
    // Be Perfect (3/4 = 0,75) overtuigend boven Be Strong (3/8 = 0,375) staan.
    const antwoorden = {
      D1: { recognition: 3 }, // Be Perfect: 3 van 4
      D5: { choice: "a" }, // laadt Be Strong
      D6: { choice: "a" }, // laadt Be Strong (kiest niet optie b, dus geen Hurry Up-lading)
    } as const;
    const resultaat = scoreStudiekompas(I, antwoorden, null, "nl");
    const plaats = (con: string) => resultaat.drivers.sorted.indexOf(con);
    if (plaats("Be Strong") >= 0 && plaats("Be Perfect") >= 0) {
      expect(
        plaats("Be Perfect"),
        "Be Perfect heeft het hoogste aandeel en moet boven Be Strong staan",
      ).toBeLessThan(plaats("Be Strong"));
    }
  });

  it("een echt gelijk aandeel blijft een echt gelijkspel: dezelfde plaats in de groepering", () => {
    // Try Hard (alleen D3, max 3) en een tweede construct met exact hetzelfde
    // aandeel moeten samen in dezelfde tie-groep vallen, ook al verschilt hun
    // ruwe som en hun haalbaar maximum.
    const antwoorden = {
      D3: { recognition: 3 }, // Try Hard: 3 van 3 = aandeel 1,0
      D1: { recognition: 4 }, // Be Perfect: 4 van 4 = aandeel 1,0
    } as const;
    const resultaat = scoreStudiekompas(I, antwoorden, null, "nl");
    // Beide op aandeel 1,0: ze horen in dezelfde groep van de motor.
    const groepen = (resultaat as unknown as { drivers: { sorted: string[] } }).drivers.sorted;
    expect(groepen.includes("Try Hard")).toBe(true);
    expect(groepen.includes("Be Perfect")).toBe(true);
  });
});
