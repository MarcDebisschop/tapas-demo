import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT, t4studentsItems, T4STUDENTS_AANTAL_ITEMS } from "../server/t4students/instrument";

// ---------------------------------------------------------------------------
// Fase 1b: de motivatielaag als zevende familie.
//
// De T4Students-toepassing die vandaag op het platform draait (buiten dit
// nieuwe instrument, in server/question-manager.ts) heeft al vijf
// motivatie-items naar de zelfdeterminatietheorie van Deci en Ryan: drie
// intrinsiek (autonomie, competentie, verbondenheid) en twee extrinsiek
// (erkenning, verwachting). Dit bestand legt vast dat die vijf items ook in
// het nieuwe instrument (server/data/t4students.json) terechtkomen, als een
// eigen familie "Motivatie", los van de families Drivers en Talent-foci.
//
// Voor de wijziging is dit rood: de familie bestaat niet.
// ---------------------------------------------------------------------------

describe("de familie Motivatie bestaat als zevende familie in het instrument", () => {
  it("het instrument telt een familie met id Motivatie", () => {
    const namen = T4STUDENTS_INSTRUMENT.families.map((f) => f.id);
    expect(namen).toContain("Motivatie");
  });

  it("de familie Motivatie heeft de vijf verwachte clusters", () => {
    const fam = T4STUDENTS_INSTRUMENT.families.find((f) => f.id === "Motivatie");
    expect(fam).toBeDefined();
    expect(fam!.constructs.sort()).toEqual(
      ["Autonomie", "Competentie", "Erkenning", "Verbondenheid", "Verwachting"].sort(),
    );
  });

  it("er zijn precies vijf items met family Motivatie: drie intrinsiek, twee extrinsiek", () => {
    const items = t4studentsItems().filter((i) => i.family === "Motivatie");
    expect(items.length).toBe(5);
    const intrinsiek = items.filter((i) =>
      ["Autonomie", "Competentie", "Verbondenheid"].includes(i.construct ?? ""),
    );
    const extrinsiek = items.filter((i) => ["Erkenning", "Verwachting"].includes(i.construct ?? ""));
    expect(intrinsiek.length).toBe(3);
    expect(extrinsiek.length).toBe(2);
  });

  it("het instrument telt in totaal 39 items: 34 bestaande plus 5 motivatie-items", () => {
    expect(T4STUDENTS_AANTAL_ITEMS).toBe(39);
  });

  it("de motivatie-items dragen dezelfde herkenningsschaal als de rest van het instrument", () => {
    const items = t4studentsItems().filter((i) => i.family === "Motivatie");
    for (const it of items) {
      expect(it.scale).toBe("recognition");
    }
  });

  it("de motivatie-items zijn strikt los van de families Drivers en Talent-foci", () => {
    const items = t4studentsItems().filter((i) => i.family === "Motivatie");
    for (const it of items) {
      expect(it.family).not.toBe("Drivers");
      expect(it.family).not.toBe("Talent-foci");
    }
    // Geen motivatie-item mag als lading meetellen bij een driver of talent-construct.
    for (const it of t4studentsItems()) {
      for (const optie of it.options ?? []) {
        for (const lading of optie.loads ?? []) {
          if (lading.family === "Motivatie") {
            expect(it.family).toBe("Motivatie");
          }
        }
      }
    }
  });
});
