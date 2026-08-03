import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import type { T4SBlok, T4SPagina } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// De verwijzing naar het motivatieprofiel op het verantwoordingsblad mag geen
// bladzijdenummer of relatieve plaatsaanduiding hardcoderen die niet klopt.
//
// WAAROM DIT BEWAAKT MOET WORDEN
// Het verantwoordingsblad zei "Het motivatieprofiel op de pagina hiervoor",
// terwijl het motivatieblok twaalf bladzijden eerder in het rapport staat,
// niet op de vorige bladzijde. Deze test legt vast dat die specifieke,
// onjuiste formulering nergens meer voorkomt, en dat er een formulering staat
// die niet van een vaste plaats in het rapport afhangt.
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
  it("noemt niet langer de pagina hiervoor, en verwijst in plaats daarvan zonder bladzijdenummer", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    const verantwoording = rapport.paginas.find((p) => /verantwoording/i.test(p.titel));
    expect(verantwoording).toBeDefined();
    const tekst = alleTeksten(verantwoording!);
    expect(tekst).not.toMatch(/pagina hiervoor/i);
    expect(tekst).toMatch(/motivatieprofiel eerder in dit rapport/i);
  });
});
