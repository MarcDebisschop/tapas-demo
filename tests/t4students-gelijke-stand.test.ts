import { describe, it, expect } from "vitest";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";

// ---------------------------------------------------------------------------
// Punt 3 van de motorronde: de marge voor gelijke stand gaat van 1,0 naar 0,3.
//
// WAT DE MARGE DOET
// De motor zet constructen die dicht bij elkaar scoren in dezelfde groep. Wie
// in de kopgroep staat, leest niet "jouw sterkste is X" maar "X en Y liggen bij
// jou dicht bij elkaar". De marge bepaalt hoe ver "dicht bij elkaar" reikt.
//
// WAT ER MIS MEE WAS
// De marge stond op 1,0. De herkenningsschaal loopt van 0 tot 3, dus een heel
// punt is een derde van de schaal. Wie bij het ene construct antwoordde "dit
// kenmerkt me helemaal" (3) en bij het andere "dit kenmerkt me tamelijk" (2),
// las dat die twee bij hem even sterk zijn. Gemeten over 2001 doorgerekende
// invullingen deelde in 76,2 procent van de families de kopgroep zich met
// meerdere constructen, met gemiddeld 4,03 constructen in die kopgroep. Van de
// zes constructen in een familie stonden er dus vaak vier gelijk bovenaan.
//
// WAT ER NU GEBEURT
// De opdrachtgever heeft de marge op 0,3 gezet. Dezelfde 2001 invullingen geven
// dan een gedeelde kopgroep in 35,1 procent van de families, met gemiddeld 1,72
// constructen erin.
//
// EEN GEVOLG DAT DE MOEITE VAN HET WETEN WAARD IS
// Sinds punt 2 wordt er op herkenning gerangschikt, en die scores zijn stuk
// voor stuk hele getallen: de zelfbeoordeling is 0, 1, 2 of 3 en de
// situatieladingen zijn 1 of 2. Er zit dus nooit iets tussen twee scores in.
// Daardoor betekent 0,3 in de praktijk precies hetzelfde als 0,1 of 0,9: alleen
// wie exact gelijk scoort, komt in dezelfde groep. Zou er ooit een halve punt
// bij komen, dan begint het getal weer te tellen; daarom is 0,3 een andere
// keuze dan 0.
// ---------------------------------------------------------------------------

const C = I.scoringMap.constants;

/**
 * Vier versnellers met elk maar een bron, op vier opeenvolgende hele scores.
 * Bij marge 1,0 gelden 3 en 2 als gelijk; bij 0,3 niet meer.
 */
const TRAP = {
  V1: { recognition: 3 },
  V4: { recognition: 2 },
  V5: { recognition: 1 },
  V6: { recognition: 0 },
};

describe("punt 3: de marge voor gelijke stand staat op 0,3", () => {
  it("de marge staat in het instrument en nergens anders", () => {
    expect(C.tieMargin).toBe(0.3);
  });

  it("een heel punt verschil geldt niet langer als gelijke stand", () => {
    const r = scoreStudiekompas(I, TRAP, null, "nl");
    expect(r.versnellers.scores["Analyse"]).toBe(3);
    expect(r.versnellers.scores["Impact"]).toBe(2);

    // Dit is de kern. Onder de oude marge stonden deze twee samen bovenaan,
    // hoewel de deelnemer bij de een "helemaal" en bij de ander "tamelijk"
    // antwoordde.
    expect(r.versnellers.kopGroep).toEqual(["Analyse"]);
    expect(r.versnellers.dominante).toBe("Analyse");
    expect(r.versnellers.gedeeldMet).toEqual([]);
  });

  it("wie werkelijk gelijk scoort, staat nog altijd samen in de kopgroep", () => {
    // Tegenproef. De marge verkleinen mag de groep niet afschaffen.
    const r = scoreStudiekompas(
      I,
      { V1: { recognition: 3 }, V4: { recognition: 3 }, V5: { recognition: 1 } },
      null,
      "nl",
    );
    expect(r.versnellers.kopGroep.sort()).toEqual(["Analyse", "Impact"]);
    expect(r.versnellers.gedeeldMet).toEqual(["Impact"]);
  });

  it("alle rangschikscores zijn hele getallen, dus elke marge onder 1 doet hetzelfde", () => {
    // Dit is het getal waar de opdrachtgever op moet letten als de schaal ooit
    // verandert. Zolang dit klopt, is 0,3 hetzelfde als "precies gelijk".
    const r = scoreStudiekompas(
      I,
      { V1: { recognition: 3, energy: 1 }, V3: { recognition: 2 }, D5: { choice: "b" }, F4: { choice: "a" } },
      null,
      "nl",
    );
    for (const bron of [r.foci.scores, r.versnellers.scores, r.interesse.scores, r.drivers.scores]) {
      for (const [con, waarde] of Object.entries(bron)) {
        expect(Number.isInteger(waarde), `${con} scoort ${waarde} en is geen heel getal`).toBe(true);
      }
    }
  });

  it("de groepen dekken samen alle constructen, zonder dubbels", () => {
    // Een verkleinde marge mag niemand uit de indeling laten vallen.
    const r = scoreStudiekompas(I, TRAP, null, "nl");
    for (const [fam, groepen] of [
      ["Talent-versnellers", r.versnellers.groepen],
      ["Talent-foci", r.foci.groepen],
    ] as const) {
      const plat = groepen.flat();
      const verwacht = I.families.find((f) => f.id === fam)!.constructs;
      expect(plat.slice().sort(), `${fam}`).toEqual(verwacht.slice().sort());
      expect(new Set(plat).size).toBe(plat.length);
    }
  });
});
