import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { htmlVanRapport } from "../server/t4students/rapport-keten";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import type { T4SPagina } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Herstelronde, punt 2: eén vorm voor het hele platform, in de bladen en in de
// HTML-weergave gelijk. Deze test staat los van
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

describe("de inline vorm van Deci en Ryan is letterlijk gelijk in de bladen en in de HTML", () => {
  it("het Studiekompas gebruikt precies 'Deci en Ryan (1985, 2000)'", () => {
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

  it("de HTML-weergave van hetzelfde rapport gebruikt dezelfde inline vorm", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    expect(htmlVanRapport(rapport)).toContain(INLINE_VORM);
  });

  it("geen enkele weergave gebruikt een andere jaartalcombinatie of het teken &", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    const bladen = rapport.paginas.map(alleTeksten).join(" \n ");
    expect(bladen).not.toContain("Deci en Ryan (2000, 2020)");
    expect(bladen).not.toContain("Deci & Ryan");

    const html = htmlVanRapport(rapport);
    expect(html).not.toContain("Deci en Ryan (2000, 2020)");
    expect(html).not.toContain("Deci &amp; Ryan");
    expect(html).not.toContain("Deci & Ryan");
  });
});
