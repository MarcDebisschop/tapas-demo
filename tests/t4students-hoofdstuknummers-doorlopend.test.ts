import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";

// ---------------------------------------------------------------------------
// De hoofdstuknummers in het Studiekompas moeten een ononderbroken oplopende
// reeks vormen die overeenkomt met de volgorde van de bladzijden.
//
// WAAROM DIT BEWAAKT MOET WORDEN
// Het motivatieblok was toegevoegd met een vast nummer (28) op zijn plek in
// de leesvolgorde (na de drivers, voor "Hoe jij het beste leert"). Daardoor
// droeg de bladzijde die als zestiende in het rapport verscheen het nummer
// 28, terwijl de bladzijde erna nummer 16 droeg. De nummering was daardoor
// niet meer doorlopend. Deze test rekent het voorbeeld door met de echte
// motor.
//
// In de Verdieping toont het rapport elk hoofdstuk uit het paginaplan, dus
// daar moet de nummering exact 1, 2, 3 en zo verder tot en met de laatste
// bladzijde zijn, zonder gaten of sprongen. In de Basis worden bepaalde
// hoofdstukken bewust weggelaten (dat bestond al voor dit werk en is geen
// fout); daar moet de nummering wel strikt stijgen en elke bladzijde moet het
// nummer tonen dat bij zijn eigen plaats in het volledige paginaplan hoort,
// zonder dat twee bladzijden hetzelfde nummer krijgen of de volgorde omkeert.
// ---------------------------------------------------------------------------

describe("de hoofdstuknummers van het Studiekompas lopen ononderbroken op", () => {
  it("in de Verdieping is de nummering exact 1 tot en met het laatste hoofdstuk, zonder gaten", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    const nummers = rapport.paginas.map((p) => p.nr);
    const verwacht = nummers.map((_, i) => i + 1);
    expect(nummers).toEqual(verwacht);
  });

  it("in de Basis stijgt de nummering strikt, zonder sprong terug of dubbele nummers", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "basis", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    const nummers = rapport.paginas.map((p) => p.nr);
    for (let i = 1; i < nummers.length; i++) {
      expect(nummers[i], `bladzijde ${i + 1}`).toBeGreaterThan(nummers[i - 1]);
    }
  });

  it("het motivatieblok draagt in de Verdieping het nummer dat bij zijn plaats hoort: 17", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    const motivatiePagina = rapport.paginas.find((p) => /motiveert/i.test(p.titel));
    expect(motivatiePagina).toBeDefined();
    expect(motivatiePagina!.nr).toBe(17);
    const positie = rapport.paginas.indexOf(motivatiePagina!);
    expect(positie).toBe(16); // zeventiende bladzijde, index 16
  });
});
