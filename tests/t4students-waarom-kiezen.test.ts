import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import type { T4SPagina } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Onderdeel F van de opdracht "Studiekompas persoonlijk maken".
//
// Meteen na het motivatieblok komt een blad "Waarom kiezen makkelijk of
// moeilijk kan voelen": de motivatiebalans en het driverpatroon Please
// Others/Try Hard worden naast elkaar gelegd, nooit uit elkaar afgeleid.
// ---------------------------------------------------------------------------

function bouw(antwoorden: Record<string, unknown>) {
  const resultaat = scoreStudiekompas(I, antwoorden as never, null, "nl");
  const rapport = bouwT4StudentsRapport(I, resultaat, antwoorden as never, "verdieping", {
    naam: "Test",
    code: "T4S-0000-0000",
    datum: "2 augustus 2026",
    instrumentVersie: I.version,
  });
  return { resultaat, rapport };
}

function vindBlad(paginas: T4SPagina[]): T4SPagina | undefined {
  return paginas.find((p) => /waarom kiezen makkelijk of moeilijk kan voelen/i.test(p.titel));
}

function alleTeksten(p: T4SPagina): string {
  const stukken: string[] = [p.titel, p.ondertitel];
  for (const b of p.blokken) {
    if ("tekst" in b && typeof b.tekst === "string") stukken.push(b.tekst);
    if ("punten" in b && Array.isArray(b.punten)) stukken.push(...(b.punten as string[]));
  }
  return stukken.join(" \n ");
}

describe("het blad over kiezen staat meteen na het motivatieblok", () => {
  it("staat direct na Wat je motiveert om te studeren", () => {
    const { rapport } = bouw(VOORBEELDAFNAME.antwoorden as unknown as Record<string, unknown>);
    const motivatie = rapport.paginas.find((p) => /motiveert/i.test(p.titel));
    const blad = vindBlad(rapport.paginas);
    expect(blad, "geen blad over kiezen gevonden").toBeDefined();
    expect(rapport.paginas.indexOf(blad!)).toBe(rapport.paginas.indexOf(motivatie!) + 1);
  });

  it("bevat altijd de vaste alinea dat het twee losse metingen zijn", () => {
    const { rapport } = bouw(VOORBEELDAFNAME.antwoorden as unknown as Record<string, unknown>);
    const blad = vindBlad(rapport.paginas)!;
    const tekst = alleTeksten(blad).toLowerCase();
    expect(tekst).toContain("twee afzonderlijke metingen");
  });

  it("toont geval 1 (intrinsiek + gaspedaal bij Please Others of Try Hard)", () => {
    const antwoorden = {
      ...VOORBEELDAFNAME.antwoorden,
      "MOT-INT-1": { recognition: 3 },
      "MOT-INT-2": { recognition: 3 },
      "MOT-INT-3": { recognition: 3 },
      "MOT-EXT-1": { recognition: 0 },
      "MOT-EXT-2": { recognition: 0 },
      D1: { recognition: 3, energy: 2 }, // Please Others hoog en positieve energie -> gaspedaal
    };
    const { resultaat, rapport } = bouw(antwoorden as unknown as Record<string, unknown>);
    expect(resultaat.motivatie.balansLabel).toBe("intrinsiek");
    const blad = vindBlad(rapport.paginas)!;
    const tekst = alleTeksten(blad).toLowerCase();
    expect(tekst).toContain("wat zou ik kiezen als niemand meekeek");
  });

  it("toont in alle andere gevallen de derde vaste tekst", () => {
    const antwoorden = {
      ...VOORBEELDAFNAME.antwoorden,
      "MOT-INT-1": { recognition: 1, energy: 0 },
      "MOT-INT-2": { recognition: 1, energy: 0 },
      "MOT-INT-3": { recognition: 1, energy: 0 },
      "MOT-EXT-1": { recognition: 1, energy: 0 },
      "MOT-EXT-2": { recognition: 1, energy: 0 },
      D1: { recognition: 0, energy: -1 },
      D2: { recognition: 0, energy: -1 },
    };
    const { resultaat, rapport } = bouw(antwoorden as unknown as Record<string, unknown>);
    expect(resultaat.motivatie.balansLabel).toBe("evenwichtig");
    const blad = vindBlad(rapport.paginas)!;
    const tekst = alleTeksten(blad).toLowerCase();
    expect(tekst).toContain("trekken niet duidelijk aan je keuze");
  });

  it("gebruikt geen nieuwe drempel: sterk aanwezig is uitsluitend het label gaspedaal", () => {
    const { rapport } = bouw(VOORBEELDAFNAME.antwoorden as unknown as Record<string, unknown>);
    const blad = vindBlad(rapport.paginas)!;
    const tekst = alleTeksten(blad).toLowerCase();
    expect(tekst).not.toContain("drijfve");
  });
});
