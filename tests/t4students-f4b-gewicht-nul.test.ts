import { describe, it, expect } from "vitest";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";

// ---------------------------------------------------------------------------
// Punt 6 uit fase 1: optie b van F4 draagt een lading met gewicht nul.
//
// DIT IS NIET GEREPAREERD, EN DAT IS EEN BEWUSTE KEUZE
// De opdracht zegt: als de blauwdruk of het itemselectiedocument uitsluitsel
// geeft over F4, voer dat uit; geeft geen van beide uitsluitsel, laat het dan
// staan en leg de keuze voor. Beide zijn nagelezen en geen van beide geeft
// uitsluitsel. Daarom staat het gewicht nog op nul en legt het verslag van
// fase 1c de drie mogelijkheden voor met de gemeten gevolgen.
//
// WAT ER PRECIES STAAT
// F4 vraagt hoe je met het werk van een ander omgaat. Optie a is "ik zie het
// als uitdaging om het op te lossen" en laadt Systematisch/Uitvoerend met 2.
// Optie b is "ik voer andermans idee tot tevredenheid uit" en laadt
// Systematisch/Uitvoerend met 0. De motor slaat ladingen met gewicht nul over,
// dus die lading doet niets. Het is de enige lading met gewicht nul in het hele
// instrument.
//
// WAT EEN DEELNEMER DAARVAN MERKT
// Wie optie b kiest, zegt in gewone taal iets uitvoerends over zichzelf, maar
// komt op Systematisch/Uitvoerend uit op min een half. Dat komt doordat optie b
// wel een energiewaarde van min 1 meedraagt en die energiewaarde als enige
// overblijft. De deelnemer beschrijft uitvoerend gedrag en krijgt op dat punt
// een negatieve score.
//
// WAAROM DE BRONNEN GEEN UITSLUITSEL GEVEN
// De blauwdruk zegt bij sjtWeight: "een gekozen SJT-optie laadt het
// bijbehorende construct met gewicht 2". Zou dat betekenen "het construct van
// het item", dan hoorde hier 2 te staan. Maar dan klopt F5 optie b ook niet:
// die laadt Sociaal Interactief helemaal niet en laadt in plaats daarvan Be
// Strong en Analyse. Onder de lezing "het construct achter de gekozen optie"
// kloppen F5 optie b en F4 optie b allebei. De zin laat beide lezingen toe en
// beslist dus niets. Het itemselectiedocument noemt voor F4 optie b bron B.8
// ("ik kan ideeen van anderen tot hun tevredenheid uitvoeren") maar noemt geen
// enkel getal.
//
// WAT DEZE TEST DOET
// Hij legt de huidige toestand vast, inclusief wat een deelnemer eraan merkt,
// zodat het gewicht niet stilzwijgend verandert. Verandert iemand het, dan
// wordt hij hier rood en moet de keuze eerst gemaakt en verantwoord worden.
// ---------------------------------------------------------------------------

const items = I.sections.find((s) => s.sectionId === "main")!.items;

describe("punt 6: de lading met gewicht nul bij F4 optie b staat er nog, met opzet", () => {
  it("F4 optie b laadt Systematisch/Uitvoerend met gewicht nul", () => {
    const f4b = items.find((i) => i.id === "F4")!.options!.find((o) => o.key === "b")!;
    expect(f4b.loads).toEqual([
      { family: "Talent-foci", construct: "Systematisch/Uitvoerend", weight: 0 },
    ]);
    expect(f4b.energyValue).toBe(-1);
  });

  it("het is de enige lading met gewicht nul in het hele instrument", () => {
    const nul: string[] = [];
    for (const it of items)
      for (const o of it.options || [])
        for (const l of o.loads || []) if (l.weight === 0) nul.push(it.id + "." + o.key);
    expect(nul).toEqual(["F4.b"]);
  });

  it("de motor slaat de lading over, dus gewicht nul is hetzelfde als geen lading", () => {
    const b = scoreStudiekompas(I, { F4: { choice: "b" } }, null, "nl");
    // Alleen de energiewaarde blijft over: min 1, voor de helft verrekend.
    expect(b.constructScores["Systematisch/Uitvoerend"].recognition).toBe(0);
    expect(b.constructScores["Systematisch/Uitvoerend"].combined).toBe(-0.5);
  });

  it("optie a laadt wel, en het verschil tussen a en b is daardoor groot", () => {
    const a = scoreStudiekompas(I, { F4: { choice: "a" } }, null, "nl");
    const b = scoreStudiekompas(I, { F4: { choice: "b" } }, null, "nl");
    expect(a.constructScores["Systematisch/Uitvoerend"].recognition).toBe(2);
    expect(a.constructScores["Systematisch/Uitvoerend"].combined).toBe(2.5);
    expect(b.constructScores["Systematisch/Uitvoerend"].combined).toBe(-0.5);
  });

  it("F5 optie b laat zien waarom de blauwdrukzin niets beslist", () => {
    // F5 optie b laadt het construct van zijn eigen item niet. Wie de
    // blauwdrukzin leest als "het construct van het item", moet ook hier een
    // fout zien; wie hem leest als "het construct achter de gekozen optie",
    // ziet bij allebei niets mis. De zin laat beide lezingen toe.
    const f5b = items.find((i) => i.id === "F5")!.options!.find((o) => o.key === "b")!;
    const constructen = (f5b.loads || []).map((l) => l.construct);
    expect(constructen).not.toContain("Sociaal Interactief");
    expect(constructen).toEqual(["Be Strong", "Analyse"]);
  });
});
