import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import type { T4SPagina } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Geen bladzijde in het Studiekompas mag een vast paginanummer of een
// relatieve plaatsaanduiding ("de pagina hiervoor") gebruiken om naar een
// ander onderdeel te verwijzen, want de bladzijden kunnen van plaats
// veranderen (basis versus verdieping, of een latere herschikking).
//
// WAAROM DIT BEWAAKT MOET WORDEN
// Het verantwoordingsblad zei ooit "Het motivatieprofiel op de pagina
// hiervoor", terwijl het motivatieblok elders in het rapport staat, niet op
// de vorige bladzijde. Die eigen bronvermelding op het verantwoordingsblad is
// intussen vervangen door het bronnenblad (onderdeel G), dat de bronnen groepeert
// per onderwerp in plaats van per bladzijde. Deze test legt vast dat er
// nergens een foute plaatsaanduiding meer voorkomt.
// ---------------------------------------------------------------------------

function alleTeksten(pagina: T4SPagina): string {
  const stukken: string[] = [pagina.titel, pagina.ondertitel];
  for (const blok of pagina.blokken) {
    if ("tekst" in blok && typeof blok.tekst === "string") stukken.push(blok.tekst);
    if ("punten" in blok && Array.isArray(blok.punten)) stukken.push(...blok.punten);
  }
  return stukken.join(" \n ");
}

describe("de verwijzing naar het motivatieprofiel op het verantwoordingsblad klopt", () => {
  it("noemt nergens meer de pagina hiervoor of een ander vast paginanummer als verwijzing", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    const volledigeTekst = rapport.paginas.map(alleTeksten).join(" \n ");
    expect(volledigeTekst).not.toMatch(/pagina hiervoor/i);
  });

  it("het verantwoordingsblad zelf bevat geen eigen bronvermelding meer, die staat op het bronnenblad", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    const verantwoording = rapport.paginas.find((p) => /^verantwoording en grenzen$/i.test(p.titel));
    expect(verantwoording, "geen verantwoordingsblad gevonden").toBeDefined();
    const bronnenblad = rapport.paginas.find((p) => /waarop dit rapport gebouwd is/i.test(p.titel));
    expect(bronnenblad, "geen bronnenblad gevonden").toBeDefined();
    const tekstVerantwoording = alleTeksten(verantwoording!);
    expect(tekstVerantwoording).not.toMatch(/bronvermelding/i);
    const tekstBronnenblad = alleTeksten(bronnenblad!);
    expect(tekstBronnenblad).toMatch(/deci.*ryan|ryan.*deci/i);
  });
});
