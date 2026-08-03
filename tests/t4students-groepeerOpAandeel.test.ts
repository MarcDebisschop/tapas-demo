import { describe, it, expect } from "vitest";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { rangschik, FAM_VERSNELLERS, groepeerOpAandeel } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Herstelronde 2, punt B: een rangtabel die een student ziet, moet de drie
// groepen tonen (sterk aanwezig, middenveld, minder aanwezig), niet een
// genummerde plaats. groepeerOpAandeel() zet de gerangschikte rijen van een
// dimensie om in die drie groepen, in dezelfde volgorde als de motor, met een
// lege groep die gewoon wegvalt (opdracht-herstelronde-2.md, punt B).
// ---------------------------------------------------------------------------

const ANTWOORDEN = {
  V4: { recognition: 3, energy: 1 }, // Impact: aandeel 1,0 -> sterk aanwezig
  V6: { recognition: 1, energy: 0 }, // Constructief onderscheidend: aandeel 1/3 -> minder aanwezig
  V1: { recognition: 1, energy: 0 }, // Analyse (max 5, met F5b/S1): laag
  F5: { choice: "b" },
  S1: { choice: "stapsgewijs" },
} as const;

describe("punt B: groepeerOpAandeel() vervangt de genummerde rangorde door drie groepen", () => {
  it("levert alleen niet-lege groepen, in de vaste volgorde sterk aanwezig / middenveld / minder aanwezig", () => {
    const resultaat = scoreStudiekompas(I, ANTWOORDEN, null, "nl");
    const dim = rangschik(I, resultaat, ANTWOORDEN, FAM_VERSNELLERS);
    const groepen = groepeerOpAandeel(dim.rijen);
    // Er zijn hier maar twee bezette constructen (Impact en Analyse en
    // Constructief onderscheidend zijn ingevuld; de andere drie niet), dus
    // niet elke groep is per se gevuld, maar de volgorde van de wel-gevulde
    // groepen moet kloppen.
    const titels = groepen.map((g) => g.titel);
    const gesorteerd = [...titels].sort(
      (a, b) =>
        ["sterk aanwezig", "middenveld", "minder aanwezig"].indexOf(a) -
        ["sterk aanwezig", "middenveld", "minder aanwezig"].indexOf(b),
    );
    expect(titels).toEqual(gesorteerd);
  });

  it("een lege groep verschijnt niet in de lijst", () => {
    // Alles op aandeel 1,0 (Impact alleen ingevuld): middenveld en minder
    // aanwezig blijven dan leeg en mogen niet in de uitvoer staan.
    const resultaat = scoreStudiekompas(I, { V4: { recognition: 3, energy: 1 } }, null, "nl");
    const dim = rangschik(I, resultaat, { V4: { recognition: 3, energy: 1 } }, FAM_VERSNELLERS);
    const groepen = groepeerOpAandeel(dim.rijen);
    expect(groepen.length).toBe(1);
    expect(groepen[0].titel).toBe("sterk aanwezig");
    expect(groepen[0].rijen.map((r) => r.construct)).toEqual(["Impact"]);
  });

  it("binnen elke groep staan de constructen nog op aandeel onder elkaar", () => {
    const resultaat = scoreStudiekompas(I, ANTWOORDEN, null, "nl");
    const dim = rangschik(I, resultaat, ANTWOORDEN, FAM_VERSNELLERS);
    const groepen = groepeerOpAandeel(dim.rijen);
    for (const g of groepen) {
      for (let i = 1; i < g.rijen.length; i++) {
        expect(g.rijen[i - 1].herkenning! >= g.rijen[i].herkenning!).toBe(true);
      }
    }
  });

  it("niet-ingevulde constructen (groep null) komen in geen van de drie groepen terecht", () => {
    const resultaat = scoreStudiekompas(I, ANTWOORDEN, null, "nl");
    const dim = rangschik(I, resultaat, ANTWOORDEN, FAM_VERSNELLERS);
    const groepen = groepeerOpAandeel(dim.rijen);
    const construtenInGroepen = groepen.flatMap((g) => g.rijen.map((r) => r.construct));
    for (const r of dim.zonderOordeel) {
      expect(construtenInGroepen).not.toContain(r.construct);
    }
  });

  it("het rangnummer wordt niet gebruikt om te groeperen, enkel het aandeel", () => {
    const resultaat = scoreStudiekompas(I, ANTWOORDEN, null, "nl");
    const dim = rangschik(I, resultaat, ANTWOORDEN, FAM_VERSNELLERS);
    const groepen = groepeerOpAandeel(dim.rijen);
    for (const g of groepen) {
      for (const r of g.rijen) {
        const drempel = g.titel === "sterk aanwezig" ? r.herkenning! >= 2 : g.titel === "middenveld" ? r.herkenning! >= 1 && r.herkenning! < 2 : r.herkenning! < 1;
        expect(drempel).toBe(true);
      }
    }
  });
});
