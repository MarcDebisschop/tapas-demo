import { describe, it, expect } from "vitest";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { T4STUDENTS_INSTRUMENT } from "../server/t4students/instrument";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";

// ---------------------------------------------------------------------------
// Onderdeel A2 van de opdracht "Studiekompas persoonlijk maken".
//
// Op het energieblad stond: "Er is een meetmoment, dus er valt niets te
// zeggen over..." Dat is geen lopende zin: het ontbrekende woord is "maar
// één". Dit bestand legt de juiste tekst vast en controleert dat de foute
// constructie nergens anders in het rapport nog voorkomt.
//
// Vóór de fix is dit rood: de tekst mist "maar één".
// ---------------------------------------------------------------------------

describe("de zin over het meetmoment op het energieblad is een lopende zin", () => {
  it("het rapport bevat 'maar één meetmoment', niet 'een meetmoment, dus'", () => {
    const resultaat = scoreStudiekompas(T4STUDENTS_INSTRUMENT, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(T4STUDENTS_INSTRUMENT, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: T4STUDENTS_INSTRUMENT.version,
    });
    const alleTeksten = JSON.stringify(rapport);
    expect(alleTeksten).toContain("maar één meetmoment");
    expect(alleTeksten).not.toContain("Er is een meetmoment, dus");
  });
});
