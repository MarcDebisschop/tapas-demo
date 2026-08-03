import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { bouwT4StudentsRapport as bouwOudeWeg, renderT4StudentsHtml } from "../server/t4students/rapport";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import type { T4SPagina } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Herstelronde, punt 2: eén vorm voor het hele platform, in beide rapportwegen
// gelijk. Deze test staat los van
// tests/t4students-bronvermelding-deci-ryan.test.ts (die bewaakt dat de
// letterlijke bronnen aanwezig zijn) en toont in plaats daarvan aan dat de
// korte, inline vorm in de lopende tekst van beide wegen letterlijk hetzelfde
// woord voor woord is.
// ---------------------------------------------------------------------------

const INLINE_VORM = "Deci en Ryan (1985, 2000)";

function alleTeksten(pagina: T4SPagina): string {
  const stukken: string[] = [pagina.titel, pagina.ondertitel];
  for (const blok of pagina.blokken) {
    if ("tekst" in blok && typeof blok.tekst === "string") stukken.push(blok.tekst);
  }
  return stukken.join(" \n ");
}

describe("de inline vorm van Deci en Ryan is letterlijk gelijk in beide rapportwegen", () => {
  it("het Studiekompas (nieuwe weg) gebruikt precies 'Deci en Ryan (1985, 2000)'", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    const volledigeTekst = rapport.paginas.map(alleTeksten).join(" \n ");
    expect(volledigeTekst).toContain(INLINE_VORM);
  });

  it("de oude T4Students-rapportweg gebruikt precies dezelfde inline vorm", () => {
    const contract = {
      participant: { name: VOORBEELDAFNAME.naam, respondentCode: VOORBEELDAFNAME.code },
      answers: VOORBEELDAFNAME.antwoorden,
      instrument: I,
    };
    const inhoud = bouwOudeWeg(contract as never);
    const html = renderT4StudentsHtml(inhoud);
    expect(html).toContain(INLINE_VORM);
  });

  it("geen van beide wegen gebruikt een andere jaartalcombinatie of het teken &", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    const nieuweWeg = rapport.paginas.map(alleTeksten).join(" \n ");
    expect(nieuweWeg).not.toContain("Deci en Ryan (2000, 2020)");
    expect(nieuweWeg).not.toContain("Deci & Ryan");

    const contract = {
      participant: { name: VOORBEELDAFNAME.naam, respondentCode: VOORBEELDAFNAME.code },
      answers: VOORBEELDAFNAME.antwoorden,
      instrument: I,
    };
    const html = renderT4StudentsHtml(bouwOudeWeg(contract as never));
    expect(html).not.toContain("Deci en Ryan (2000, 2020)");
    expect(html).not.toContain("Deci &amp; Ryan");
    expect(html).not.toContain("Deci & Ryan");
  });
});
