// ---------------------------------------------------------------------------
// Energie hoort bij elke driver en bij elke talent-focus.
//
// WAAROM DIT ER MOET ZIJN
// Herkenning zegt of iets je kenmerkt. De energie-anker zegt of het je energie
// geeft of energie kost. Dat zijn twee verschillende dingen, en juist bij de
// drivers is het tweede het interessante: een driver die je herkent en die je
// leegtrekt, is iets anders dan een driver die je herkent en die je voedt.
//
// Vandaag hebben twaalf items een energie-anker en zeven constructen geen:
// de vijf drivers en de twee talent-foci die via een situatie-item gemeten
// worden. Deze test legt vast dat elk construct in die twee families een
// energie-anker heeft, en dat dat anker op precies dezelfde manier gebouwd is
// als de twaalf die er al waren.
//
// WAT DEZE TEST UITDRUKKELIJK NIET DOET
// Zij zegt niets over intrinsieke of extrinsieke motivatie. Die laag komt in
// een aparte ronde met eigen items en wordt niet uit driverscores of uit
// driverenergie afgeleid.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I, t4studentsItems } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";

const sm = I.scoringMap;
const items = t4studentsItems();
const itemById = Object.fromEntries(items.map((i) => [i.id, i]));

/** De constructen van een familie, zoals het instrument ze zelf opsomt. */
function constructenVan(familie: string): string[] {
  return I.families.find((f) => f.id === familie)?.constructs ?? [];
}

/** Het energie-ankeritem dat bij een construct hoort, of undefined. */
function ankerVan(construct: string): string | undefined {
  return sm.energyItems.find((id) => itemById[id]?.construct === construct);
}

describe("elk construct in Drivers en Talent-foci heeft een energie-anker", () => {
  const teMeten = [...constructenVan("Drivers"), ...constructenVan("Talent-foci")];

  it("de twee families bevatten samen elf constructen", () => {
    expect(constructenVan("Drivers")).toEqual([
      "Be Perfect",
      "Please Others",
      "Try Hard",
      "Hurry Up",
      "Be Strong",
    ]);
    expect(constructenVan("Talent-foci").length).toBe(6);
  });

  it.each(teMeten)("%s heeft precies een energie-ankeritem", (construct) => {
    const anker = ankerVan(construct);
    expect(anker, `${construct} heeft geen item in scoringMap.energyItems`).toBeDefined();
    const dragers = sm.energyItems.filter((id) => itemById[id]?.construct === construct);
    expect(dragers.length, `${construct} heeft er meer dan een: ${dragers.join(", ")}`).toBe(1);
  });

  it.each(teMeten)("het anker van %s is gebouwd als de bestaande ankers", (construct) => {
    const anker = ankerVan(construct)!;
    const it_ = itemById[anker];
    // V1 is een bestaand energie-item en dient hier als model.
    const model = itemById["V1"];
    expect(it_.itemType).toBe(model.itemType);
    expect(it_.scale).toBe(model.scale);
    expect(it_.energyScale).toBe(model.energyScale);
    expect(typeof it_.text?.nl).toBe("string");
    expect(it_.text!.nl.length).toBeGreaterThan(10);
  });
});

describe("de energie van een driver komt ook echt in de uitkomst terecht", () => {
  const drivers = constructenVan("Drivers");

  it.each(drivers)("een energie-antwoord bij %s zet avgEnergy van dat construct", (driver) => {
    const anker = ankerVan(driver)!;
    const r = scoreStudiekompas(I, { [anker]: { recognition: 3, energy: 2 } }, null, "nl");
    expect(r.constructScores[driver].avgEnergy).toBe(2);
  });

  it("een driver met energie kan als energiebron uit de berekening komen", () => {
    const anker = ankerVan("Be Perfect")!;
    const r = scoreStudiekompas(I, { [anker]: { recognition: 3, energy: 2 } }, null, "nl");
    expect(r.energie.bronnen).toContain("Be Perfect");
  });

  it("een driver die energie kost, komt als energielek uit de berekening", () => {
    const anker = ankerVan("Hurry Up")!;
    const r = scoreStudiekompas(I, { [anker]: { recognition: 3, energy: -2 } }, null, "nl");
    expect(r.energie.lekken).toContain("Hurry Up");
  });
});
