import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import type { T4SPagina } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Herstelronde, punt 4: bij een gelijkspel binnen het interesse-onderdeel van
// de grote samenvattende zin mag er geen drievoudige "en" ontstaan. Elke
// interesse-bouwsteen bevat zelf al een "en" (bijvoorbeeld "vorm, beeld en
// taal"), dus het samenvoegen van twee gelijk geëindigde bouwstenen met nog
// een "en" ertussen geeft "vorm, beeld en taal en mensen en wat hen
// bezighoudt". De juiste vorm scheidt de twee bouwstenen met een komma en
// herhaalt het woord "over": "...en waar het gaat over vorm, beeld en taal,
// en over mensen en wat hen bezighoudt."
//
// OPMAAKHERSTEL (2026-08-03), PUNT 2: deze zin stond oorspronkelijk als
// eerste alinea op het blad "In één zin". Sinds de zin verhuisd is naar het
// citaatvlak van het slothoofdstuk "Een zin om mee te nemen" (om te
// voorkomen dat de student ze twee keer leest), vindt deze test de zin op de
// nieuwe plaats. De bewaakte tekst zelf verandert niet.
//
// OPMAAKHERSTEL-2, PUNT 5: het "citaat"-blok van weleer is vervangen door het
// nieuwe, rustigere "zinvlak" (geen opschrift, geen kop, alleen de zin,
// gecentreerd en schuin tussen aanhalingstekens): een citaatvlak met een
// opschrift, een kop én een decoratief aanhalingsteken tegelijk was te veel
// voor de rustigste kaart van het blad. De vindplaats in deze test is
// daarom verlegd naar "zinvlak"; de bewaakte tekst (de grammaticale
// controle op de samenvattende zin) is ongewijzigd.
//
// Het voorbeeldprofiel (VOORBEELDAFNAME) heeft een echt gelijkspel op rang 1
// tussen Artistiek en Sociaal in het interesse-onderdeel (R3 en R4 staan
// allebei op het maximum), dus deze test gebruikt geen verzonnen data.
// ---------------------------------------------------------------------------

function vindZin(paginas: T4SPagina[]): string {
  const slot = paginas.find((p) => /een zin om mee te nemen/i.test(p.titel));
  expect(slot, "geen slothoofdstuk Een zin om mee te nemen gevonden").toBeDefined();
  const zinvlak = (slot!.blokken as any[]).find((b) => b.soort === "zinvlak");
  expect(zinvlak, "geen zinvlak op het slothoofdstuk gevonden").toBeDefined();
  return zinvlak.tekst as string;
}

describe("de samenvattende zin in het citaatvlak van het slothoofdstuk blijft grammaticaal correct bij een gelijkspel", () => {
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
