// ---------------------------------------------------------------------------
// tests/role-fit-golden.test.ts
//
// Golden fixtures: vier met de hand nagerekende scenario's die de volledige
// deterministische keten doorlopen (profiel, fitregels, H-BOM, integratie,
// besluitregels). Elk verwacht resultaat staat hieronder uitgeschreven en is
// nagerekend met de regeltabellen in server/role-fit/*-engine.ts.
//
//   1. supported               Orily / Plant Manager (testfixture, geen productmodel)
//   2. mixed                   HR Business Partner
//   3. counter-indication      Accountmanager
//   4. insufficient evidence   Projectleider, met een onvolledig profiel
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { leesProfielUitContract } from "../server/role-fit/profiel";
import { berekenFitItems } from "../server/role-fit/fit-engine";
import { stelHbomVoor } from "../server/role-fit/hbom-engine";
import { integreerHypothese, toetsBesluit } from "../server/role-fit/integration-engine";
import { maakContract, volledigProfiel, type ProfielWaarden } from "./role-fit-fixture";

interface Golden {
  naam: string;
  scenario: "supported" | "mixed" | "counter-indication" | "insufficient";
  profiel: ProfielWaarden;
  vereiste: { dimensie: string; vereiste: string; kriticiteit: "critical" | "important" | "supporting" };
  gate: "met" | "open" | "not_met";
  observaties: Array<{ rol: "recruiter" | "hiring_manager"; barsScore: 1 | 3 | 5 | null; bewijskwaliteit: "direct" | "indirect" | "limited"; onvoldoendeKans: boolean }>;
  verwacht: {
    indicatie: string;
    profielConfidence: string;
    status: string;
    confidence: string;
    toegestaan: string[];
  };
}

const GOLDEN: Golden[] = [
  {
    naam: "Orily / Plant Manager",
    scenario: "supported",
    profiel: volledigProfiel({ Operationeel: { net: 5, avg: 1.5 } }),
    vereiste: { dimensie: "operatie", vereiste: "De dagelijkse productie in drie ploegen stabiel aansturen", kriticiteit: "critical" },
    gate: "met",
    observaties: [
      { rol: "recruiter", barsScore: 5, bewijskwaliteit: "direct", onvoldoendeKans: false },
      { rol: "hiring_manager", barsScore: 5, bewijskwaliteit: "direct", onvoldoendeKans: false },
    ],
    verwacht: {
      indicatie: "strong_support",
      profielConfidence: "low",
      status: "convergent_support",
      confidence: "high",
      toegestaan: ["positive", "conditionally_positive", "postpone", "negative"],
    },
  },
  {
    naam: "HR Business Partner",
    scenario: "mixed",
    profiel: volledigProfiel({ Coaching: { net: 1, avg: 0.1 } }),
    vereiste: { dimensie: "coaching", vereiste: "Leidinggevenden begeleiden in moeilijke gesprekken", kriticiteit: "important" },
    gate: "open",
    observaties: [
      { rol: "recruiter", barsScore: 5, bewijskwaliteit: "direct", onvoldoendeKans: false },
      { rol: "hiring_manager", barsScore: 1, bewijskwaliteit: "indirect", onvoldoendeKans: false },
    ],
    verwacht: {
      indicatie: "mixed",
      profielConfidence: "low",
      status: "mixed_context_dependent",
      confidence: "medium",
      toegestaan: ["conditionally_positive", "postpone", "negative"],
    },
  },
  {
    naam: "Accountmanager",
    scenario: "counter-indication",
    profiel: volledigProfiel({ Impact: { net: -2, avg: -1.4 } }),
    vereiste: { dimensie: "impact", vereiste: "Nieuwe klanten overtuigen in een eerste gesprek", kriticiteit: "critical" },
    gate: "not_met",
    observaties: [
      { rol: "recruiter", barsScore: 1, bewijskwaliteit: "direct", onvoldoendeKans: false },
      { rol: "hiring_manager", barsScore: 1, bewijskwaliteit: "indirect", onvoldoendeKans: false },
    ],
    verwacht: {
      indicatie: "likely_friction",
      profielConfidence: "low",
      status: "repeated_counter_indication",
      confidence: "medium",
      toegestaan: ["postpone", "negative"],
    },
  },
  {
    naam: "Projectleider",
    scenario: "insufficient",
    profiel: volledigProfiel({ Faciliteren: { net: null, avg: null } }),
    vereiste: { dimensie: "faciliteren", vereiste: "Werksessies met vijf partners begeleiden", kriticiteit: "important" },
    gate: "met",
    observaties: [
      { rol: "recruiter", barsScore: null, bewijskwaliteit: "limited", onvoldoendeKans: true },
      { rol: "hiring_manager", barsScore: 3, bewijskwaliteit: "limited", onvoldoendeKans: false },
    ],
    verwacht: {
      indicatie: "not_assessable",
      profielConfidence: "low",
      status: "insufficient_evidence",
      confidence: "low",
      toegestaan: ["positive", "conditionally_positive", "postpone", "negative"],
    },
  },
];

describe("golden fixtures", () => {
  it("dekt de vier verplichte scenario's", () => {
    expect(GOLDEN.map((g) => g.scenario).sort()).toEqual(["counter-indication", "insufficient", "mixed", "supported"]);
  });

  for (const g of GOLDEN) {
    it(`${g.scenario}: ${g.naam}`, () => {
      const profiel = leesProfielUitContract(maakContract(g.profiel));
      const vereisten = [
        { id: 1, fitType: "person_job" as const, niveau: "entry", bronClaimIds: [], ...g.vereiste },
        { id: 2, dimensie: "gate", fitType: "person_job" as const, vereiste: "Geldig attest", niveau: "knockout", kriticiteit: "gate" as const, bronClaimIds: [] },
      ];
      const items = berekenFitItems(vereisten, profiel.claims, []);
      expect(items[0].indicatie).toBe(g.verwacht.indicatie);
      expect(items[0].confidence).toBe(g.verwacht.profielConfidence);
      expect(items[1].gate).toBe(true);
      if (g.scenario === "insufficient") expect(items[0].net).toBeNull();

      const hbom = stelHbomVoor(
        items.map((it, i) => ({
          id: i + 1,
          requirementId: it.requirementId,
          indicatie: it.indicatie,
          confidence: it.confidence,
          kriticiteit: it.kriticiteit,
          gate: it.gate,
          dimensie: vereisten[i].dimensie,
          vereiste: vereisten[i].vereiste,
          bronClaimIds: [],
          profielClaimCodes: it.profielClaimCodes,
        })),
      );
      expect(hbom.gates.length).toBe(1);
      expect(hbom.pool.length).toBe(1);
      expect(hbom.pool[0].dimensie).toBe(g.vereiste.dimensie);

      const uit = integreerHypothese(items[0].indicatie, g.observaties);
      expect(uit.status).toBe(g.verwacht.status);
      expect(uit.confidence).toBe(g.verwacht.confidence);
      // Geen middeling: beide scores blijven apart zichtbaar.
      expect(uit.scores).toEqual({ recruiter: g.observaties[0].barsScore, hiring_manager: g.observaties[1].barsScore });

      const toets = toetsBesluit([{ vereisteId: 2, vereiste: "Geldig attest", status: g.gate }], "negative", []);
      expect(toets.toegestaan).toEqual(g.verwacht.toegestaan);
    });
  }

  it("onvoldoende bewijs wordt nooit omgezet in een negatieve status", () => {
    const g = GOLDEN.find((x) => x.scenario === "insufficient")!;
    const uit = integreerHypothese("likely_friction", g.observaties);
    expect(uit.status).toBe("insufficient_evidence");
    expect(uit.redenen.join(" ")).not.toMatch(/talent ontbreekt|geen talent/i);
  });
});
