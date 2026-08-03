import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import type { T4SBlok, T4SPagina } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Opmaakherstel-2, punt 3: een opschriftje mag nooit de hoofdstuktitel of de
// kop eronder herhalen. Op het blad "Dit hoopte je te vinden" stond als
// opschriftje letterlijk DIT HOOPTE JE TE VINDEN: dat zegt niets extra
// bovenop de titel die al op het blad staat. Hetzelfde gebeurde op het blad
// "Waar jij iets wilt betekenen" met het opschrift WAAR JIJ IETS WILT
// BETEKENEN.
//
// Een opschriftje benoemt wat voor soort blok het is (bijvoorbeeld JOUW
// EIGEN WOORDEN), niet waar het hoofdstuk over gaat. Deze test rekent het
// echte voorbeeldprofiel door de motor en de rapportlaag (net als de
// bestaande test t4students-opschrift-op-kaarten.test.ts) en controleert
// voor elke kaart met een opschrift dat het opschrift noch de hoofdstuktitel,
// noch de kop die er direct onder staat, herhaalt.
// ---------------------------------------------------------------------------

function bouw(variant: "verdieping" | "basis"): T4SPagina[] {
  const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
  const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, variant, {
    naam: VOORBEELDAFNAME.naam,
    code: VOORBEELDAFNAME.code,
    datum: VOORBEELDAFNAME.datum,
    instrumentVersie: I.version,
  });
  return rapport.paginas;
}

function kaartBlokken(paginas: T4SPagina[]): { pagina: T4SPagina; blok: T4SBlok }[] {
  const uit: { pagina: T4SPagina; blok: T4SBlok }[] = [];
  for (const pagina of paginas) {
    for (const blok of pagina.blokken) {
      if (blok.soort === "kader" || blok.soort === "citaat" || blok.soort === "kaartvlak") {
        uit.push({ pagina, blok });
      }
    }
  }
  return uit;
}

function normaliseer(s: string): string {
  return s.trim().toLowerCase();
}

describe.each([["verdieping"], ["basis"]] as const)("geen opschriftje herhaalt de titel of de kop (%s)", (variant) => {
  it("geen enkel opschriftje is gelijk aan de titel van het hoofdstuk waarin het staat", () => {
    const kaarten = kaartBlokken(bouw(variant));
    for (const { pagina, blok } of kaarten) {
      const opschrift = (blok as unknown as { opschrift?: string }).opschrift ?? "";
      expect(
        normaliseer(opschrift) === normaliseer(pagina.titel),
        `pagina ${pagina.nr} (${pagina.titel}): het opschrift "${opschrift}" herhaalt de hoofdstuktitel`,
      ).toBe(false);
    }
  });

  it("geen enkel opschriftje is gelijk aan de kop die er direct onder staat", () => {
    const kaarten = kaartBlokken(bouw(variant));
    for (const { pagina, blok } of kaarten) {
      const opschrift = (blok as unknown as { opschrift?: string }).opschrift ?? "";
      const kop = (blok as unknown as { kop?: string }).kop ?? "";
      if (!kop) continue;
      expect(
        normaliseer(opschrift) === normaliseer(kop),
        `pagina ${pagina.nr} (${pagina.titel}): het opschrift "${opschrift}" herhaalt de kop eronder ("${kop}")`,
      ).toBe(false);
    }
  });
});
