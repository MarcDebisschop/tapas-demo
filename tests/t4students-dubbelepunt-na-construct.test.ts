import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import type { T4SPagina } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Herstelronde, punt 3: tussen een constructnaam en de korte omschrijving die
// erop volgt staat een dubbele punt ("Overdrachtelijk Interactief: kennis
// overbrengen"), nooit een punt gevolgd door een kleine letter
// ("Overdrachtelijk Interactief. kennis overbrengen"). Dat laatste patroon
// oogt als het einde van een zin met een tikfout erna. Deze test doorzoekt
// alle bladen van het rapport (behalve het bronnenblad, waar een punt gevolgd
// door een kleine letter wel normaal is, bijvoorbeeld in een titel of URL)
// op dat foute patroon en eist dat het nergens meer voorkomt.
// ---------------------------------------------------------------------------

function alleTeksten(pagina: T4SPagina): string[] {
  const stukken: string[] = [];
  for (const blok of pagina.blokken as any[]) {
    if (Array.isArray(blok.punten)) stukken.push(...blok.punten);
    if (typeof blok.tekst === "string") stukken.push(blok.tekst);
  }
  return stukken;
}

// Punt gevolgd door een kleine letter, met een hoofdletter- of
// cijferwoord ervoor (een constructnaam), niet gevolgd door een url-vorm.
const FOUT_PATROON = /\b[A-Za-zÀ-ÿ][A-Za-zà-ÿ/]*\.\s[a-zà-ÿ]/g;

function vindFoutePlekken(variant: "basis" | "verdieping"): string[] {
  const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
  const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, variant, {
    naam: VOORBEELDAFNAME.naam,
    code: VOORBEELDAFNAME.code,
    datum: VOORBEELDAFNAME.datum,
    instrumentVersie: I.version,
  });
  const treffers: string[] = [];
  for (const pagina of rapport.paginas) {
    if (/waarop dit rapport gebouwd is/i.test(pagina.titel)) continue; // bronnenblad: eigen regels
    for (const tekst of alleTeksten(pagina)) {
      const matches = tekst.match(FOUT_PATROON);
      if (matches) treffers.push(...matches.map((m) => `${pagina.titel}: "${m}"`));
    }
  }
  return treffers;
}

describe("geen punt gevolgd door een kleine letter tussen constructnaam en omschrijving", () => {
  it("het verdiepingsrapport bevat nergens meer dat patroon", () => {
    expect(vindFoutePlekken("verdieping")).toEqual([]);
  });

  it("het basisrapport bevat nergens meer dat patroon", () => {
    expect(vindFoutePlekken("basis")).toEqual([]);
  });
});
