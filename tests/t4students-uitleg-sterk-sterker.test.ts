import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import type { T4SPagina } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Herstelronde, punt 5: op het blad "In één zin" staat, net voor de twee
// blokken "Wat nu al sterk is" en "Wat sterker kan worden", een uitleg dat
// die twee lijstjes niet uit de rangorde komen, maar uit de verhouding
// tussen herkenning en energie. Zonder die uitleg lijkt het net alsof een
// construct dat hoog in de rangorde staat, nooit in het tweede lijstje kan
// staan, wat niet klopt.
// ---------------------------------------------------------------------------

const UITLEG_TEKST =
  "De twee lijstjes hieronder komen niet uit de rangorde, maar uit de verhouding tussen hoeveel je " +
  "iets in jezelf herkent en hoeveel energie het je geeft. Daarom kan iets hoog in je rangorde staan " +
  "en toch in het tweede lijstje verschijnen.";

function vindBlad(paginas: T4SPagina[]): T4SPagina {
  const blad = paginas.find((p) => /^in één zin$/i.test(p.titel));
  expect(blad, "geen blad In één zin gevonden").toBeDefined();
  return blad!;
}

describe("het blad In één zin legt uit waar de twee lijstjes wel en niet uit voortkomen", () => {
  it("bevat de uitlegzin vlak voor het blok Wat nu al sterk is", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    const blad = vindBlad(rapport.paginas);
    const blokken = blad.blokken as any[];
    const uitlegIndex = blokken.findIndex((b) => b.tekst === UITLEG_TEKST);
    expect(uitlegIndex, "de uitlegzin staat niet letterlijk op het blad").toBeGreaterThanOrEqual(0);
    const sterkIndex = blokken.findIndex((b) => b.kop === "Wat nu al sterk is");
    expect(sterkIndex, "blok Wat nu al sterk is niet gevonden").toBeGreaterThanOrEqual(0);
    expect(uitlegIndex).toBeLessThan(sterkIndex);
  });
});
