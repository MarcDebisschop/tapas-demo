import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import type { T4SPagina } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Herstelronde, punt 4: bij een gelijkspel binnen het interesse-onderdeel van
// de zin op "In één zin" mag er geen drievoudige "en" ontstaan. Elke
// interesse-bouwsteen bevat zelf al een "en" (bijvoorbeeld "vorm, beeld en
// taal"), dus het samenvoegen van twee gelijk geëindigde bouwstenen met nog
// een "en" ertussen geeft "vorm, beeld en taal en mensen en wat hen
// bezighoudt". De juiste vorm scheidt de twee bouwstenen met een komma en
// herhaalt het woord "over": "...en waar het gaat over vorm, beeld en taal,
// en over mensen en wat hen bezighoudt."
//
// Het voorbeeldprofiel (VOORBEELDAFNAME) heeft een echt gelijkspel op rang 1
// tussen Artistiek en Sociaal in het interesse-onderdeel (R3 en R4 staan
// allebei op het maximum), dus deze test gebruikt geen verzonnen data.
// ---------------------------------------------------------------------------

function vindZin(paginas: T4SPagina[]): string {
  const blad = paginas.find((p) => /^in één zin$/i.test(p.titel));
  expect(blad, "geen blad In één zin gevonden").toBeDefined();
  const eersteAlinea = (blad!.blokken as any[]).find((b) => typeof b.tekst === "string");
  return eersteAlinea.tekst as string;
}

describe("de samenvattende zin op In één zin blijft grammaticaal correct bij een gelijkspel", () => {
  it("gebruikt bij een gelijkspel in het interesse-onderdeel een komma en herhaalt over, geen drievoudige en", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    // Vaststellen dat dit profiel echt een gelijkspel op rang 1 heeft bij
    // interesse: Artistiek en Sociaal (anders test dit niets).
    expect(resultaat.interesse.sorted[0]).toBe("Artistiek");
    const zin = vindZin(rapport.paginas);
    expect(zin).not.toContain("vorm, beeld en taal en mensen");
    expect(zin).toContain("vorm, beeld en taal, en over mensen en wat hen bezighoudt");
  });
});
