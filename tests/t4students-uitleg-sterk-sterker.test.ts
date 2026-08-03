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
//
// Herstelronde 2, punt D: de rangorde bestaat niet meer als iets dat een
// student ziet (Punt B verving elke genummerde rangorde door drie groepen
// op aandeel). Punt D schrijft daarom letterlijk voor dat deze tekst het
// woord "rangorde" vervangt door "groepen": een construct kan bij de sterk
// aanwezige onderdelen staan (in plaats van "hoog in de rangorde staan") en
// toch in het tweede lijstje verschijnen. De strekking van de test blijft
// exact dezelfde waarborg: de uitlegzin staat letterlijk en vlak voor het
// blok "Wat nu al sterk is".
//
// Opdracht-verwijzingen.md, punt 2: "de groepen hierboven" verwees naar
// niets, want op dit blad staan geen groepen. Vervangen door "de groepen op
// de bladen hiervoor". Ook hier verandert alleen de letterlijke tekst zelf;
// de waarborg (zin staat letterlijk en vlak voor "Wat nu al sterk is")
// blijft exact gelden.
//
// OPMAAKHERSTEL (2026-08-03), PUNT 2: het blad zelf heet niet meer "In één
// zin" maar "Wat vlot gaat en wat energie kost", omdat de grote
// samenvattende zin (D1) verhuisd is naar het citaatvlak van het
// slothoofdstuk "Een zin om mee te nemen". Deze uitlegzin hoort bij D2, niet
// bij D1, en bleef dus altijd al op dit blad staan; alleen de titel waarmee
// de test het blad opzoekt, is aangepast.
// ---------------------------------------------------------------------------

const UITLEG_TEKST =
  "De twee lijstjes hieronder komen niet uit de groepen op de bladen hiervoor, maar uit de verhouding tussen " +
  "hoeveel je iets in jezelf herkent en hoeveel energie het je geeft. Daarom kan iets bij de sterk aanwezige " +
  "onderdelen staan en toch in het tweede lijstje verschijnen.";

function vindBlad(paginas: T4SPagina[]): T4SPagina {
  const blad = paginas.find((p) => /^wat vlot gaat en wat energie kost$/i.test(p.titel));
  expect(blad, "geen blad Wat vlot gaat en wat energie kost gevonden").toBeDefined();
  return blad!;
}

describe("het blad Wat vlot gaat en wat energie kost legt uit waar de twee lijstjes wel en niet uit voortkomen", () => {
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
