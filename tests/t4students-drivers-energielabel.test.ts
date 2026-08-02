import { describe, it, expect } from "vitest";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";

// ---------------------------------------------------------------------------
// De drivers krijgen een eigen woord voor hun energiesaldo.
//
// WAAROM NIET HET BALANSLABEL VAN DE FOCI EN DE VERSNELLERS
// Die vier woorden, kernsterkte, overbelast, onderbenut en latent, gaan over een
// talent dat je wel of niet inzet. Een driver is geen talent maar iets wat je
// aandrijft, dus zeggen ze daar het verkeerde. De drie eigen waarden zeggen wat
// er wel gemeten is: remmend, neutraal of gaspedaal.
//
// WAAROM NUL NIET HETZELFDE IS ALS NIETS
// Nul is op de energieschaal een antwoord: het kost niets en het levert niets
// op. Dat heet neutraal. Is er geen energie gemeten, dan is er geen saldo en
// dus geen oordeel, en staat er dat er te weinig antwoorden zijn. Neutraal is
// een uitspraak die gemeten moet zijn, geen lege plaats.
//
// Dat alle drie de waarden ook werkelijk kunnen vallen en dat geen enkele
// altijd valt, wordt over een brede reeks invullingen bewaakt in
// tests/t4students-oordelen-zijn-bereikbaar.test.ts.
// ---------------------------------------------------------------------------

const DRIVERS = I.families.find((f) => f.id === "Drivers")!.constructs;

/** Het driver-item waarvan de energie rechtstreeks op het construct slaat. */
const ANKER: Record<string, string> = {
  D1: "Be Perfect",
  D2: "Please Others",
  D3: "Try Hard",
  D4: "Hurry Up",
  D7: "Be Strong",
};

describe("het energiesaldo van een driver krijgt een eigen woord", () => {
  it("de vijf drivers hebben allemaal een energielabel", () => {
    const r = scoreStudiekompas(I, {}, null, "nl");
    expect(Object.keys(r.drivers.energielabels).sort()).toEqual([...DRIVERS].sort());
    expect(DRIVERS).toHaveLength(5);
  });

  it.each(Object.entries(ANKER))(
    "%s: een negatief saldo heet remmend, nul heet neutraal, positief heet gaspedaal",
    (item, construct) => {
      const label = (energy: number) =>
        scoreStudiekompas(I, { [item]: { recognition: 2, energy } }, null, "nl").drivers
          .energielabels[construct];
      expect(label(-2), `${construct} bij min twee`).toBe("remmend");
      expect(label(-1), `${construct} bij min een`).toBe("remmend");
      expect(label(0), `${construct} bij nul`).toBe("neutraal");
      expect(label(1), `${construct} bij plus een`).toBe("gaspedaal");
      expect(label(2), `${construct} bij plus twee`).toBe("gaspedaal");
    },
  );

  it("zonder energie-antwoord is er geen saldo en dus geen oordeel", () => {
    // De herkenning is wel ingevuld. Dat mag geen neutraal opleveren: neutraal
    // zou zeggen dat het de deelnemer niets doet, en dat heeft hij niet gezegd.
    const r = scoreStudiekompas(I, { D1: { recognition: 3 } }, null, "nl");
    expect(r.drivers.energielabels["Be Perfect"]).toBe("te_weinig_antwoorden");
    expect(r.drivers.energielabels["Be Perfect"]).not.toBe("neutraal");
  });

  it("een lege invulling levert bij geen enkele driver een oordeel op", () => {
    const r = scoreStudiekompas(I, {}, null, "nl");
    for (const con of DRIVERS) {
      expect(r.drivers.energielabels[con], `${con}`).toBe("te_weinig_antwoorden");
    }
  });

  it("de drivers dragen niet de vier balanslabels van de foci en de versnellers", () => {
    // Een driver is geen talent. Ging het balanslabel hier alsnog vallen, dan
    // stond er een uitspraak over talent bij iets wat geen talent is.
    const balans = ["kernsterkte", "overbelast", "onderbenut", "latent"];
    const r = scoreStudiekompas(
      I,
      Object.fromEntries(Object.keys(ANKER).map((i) => [i, { recognition: 3, energy: 2 }])),
      null,
      "nl",
    );
    for (const con of DRIVERS) {
      expect(balans, `${con} draagt een balanslabel`).not.toContain(r.drivers.energielabels[con]);
    }
  });

  it("het saldo en het woord spreken elkaar nergens tegen", () => {
    // Tegenproef over een brede reeks: het woord volgt precies het teken van
    // het getal dat het rapport ernaast zet.
    for (const energy of [-2, -1, 0, 1, 2]) {
      for (const recognition of [0, 1, 2, 3]) {
        const r = scoreStudiekompas(
          I,
          Object.fromEntries(Object.keys(ANKER).map((i) => [i, { recognition, energy }])),
          null,
          "nl",
        );
        for (const con of DRIVERS) {
          const saldo = r.constructScores[con].avgEnergy;
          const woord = r.drivers.energielabels[con];
          if (saldo === null) expect(woord).toBe("te_weinig_antwoorden");
          else if (saldo < 0) expect(woord, `${con} bij saldo ${saldo}`).toBe("remmend");
          else if (saldo > 0) expect(woord, `${con} bij saldo ${saldo}`).toBe("gaspedaal");
          else expect(woord, `${con} bij saldo ${saldo}`).toBe("neutraal");
        }
      }
    }
  });
});
