import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { renderT4StudentsRapport } from "../server/t4students/rapport-pdf";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import type { T4SRapport } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Herstelronde, punt 7: op het blad "Waarop dit rapport gebouwd is" stond het
// kopje "Rapportontwerp" helemaal onderaan het eerste blad, terwijl de eerste
// verwijzing eronder pas op het vervolgblad kwam. Een kopje mag nooit alleen
// onderaan een blad achterblijven: het gaat samen met minstens de eerste
// verwijzing eronder naar het volgende blad over.
//
// Deze test dwingt de situatie af met een eigen, synthetisch blad: een
// tussenkop die nog net op het blad past, gevolgd door een opsomming die daar
// niet meer bij past. De eerste regel van de PDF-tekst na "TESTKOP" moet dan
// het eerste punt van de opsomming zijn, op hetzelfde blad; TESTKOP mag nooit
// de laatste regel van een blad zijn.
// ---------------------------------------------------------------------------

function synthetischRapport(): T4SRapport {
  return {
    licentie: "verdieping",
    taal: "nl",
    naam: "Test",
    code: "T4S-0000-0000",
    datum: "2 augustus 2026",
    instrumentVersie: "test",
    scorerVersie: "test",
    meldingen: [],
    paginas: [
      {
        nr: 1,
        soort: "inhoud",
        titel: "Testblad",
        ondertitel: "",
        blokken: [
          // Genoeg opvulling om de rest van het blad bijna te vullen, zodat
          // de tussenkop hierna nog net past maar de opsomming niet meer.
          { soort: "ruimte", hoogte: 575 },
          { soort: "tussenkop", tekst: "TESTKOP" },
          {
            soort: "opsomming",
            kop: null,
            punten: [
              "Eerste testpunt onder de kop, lang genoeg om samen met de kop niet meer op hetzelfde blad te passen als de kop niet meeverhuist.",
              "Tweede testpunt.",
            ],
          },
        ],
      },
    ],
  };
}

describe("een kopje blijft nooit alleen onderaan een blad staan", () => {
  it("een tussenkop die net nog past, verhuist toch mee naar het volgende blad als de opsomming eronder niet meer past", async () => {
    const rapport = synthetischRapport();
    const { doc } = renderT4StudentsRapport(rapport);
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    const einde = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
    doc.end();
    const buffer = await einde;

    const pdfParse = (await import("pdf-parse")).default;
    const bladen: string[] = [];
    await pdfParse(buffer, {
      pagerender: (pageData: { getTextContent: () => Promise<{ items: { str: string }[] }> }) =>
        pageData.getTextContent().then((tc) => {
          const tekst = tc.items.map((it) => it.str).join(" ");
          bladen.push(tekst);
          return tekst;
        }),
    });

    const bladMetKopje = bladen.findIndex((b) => b.includes("TESTKOP"));
    expect(bladMetKopje, "TESTKOP niet gevonden in de PDF-tekst").toBeGreaterThanOrEqual(0);
    expect(bladen[bladMetKopje]).toContain("Eerste testpunt onder de kop");
  });

  it("op het echte voorbeeldrapport staat Rapportontwerp samen met de eerste verwijzing op hetzelfde blad", async () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    const { doc } = renderT4StudentsRapport(rapport);
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    const einde = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
    doc.end();
    const buffer = await einde;

    const pdfParse = (await import("pdf-parse")).default;
    const bladen: string[] = [];
    await pdfParse(buffer, {
      pagerender: (pageData: { getTextContent: () => Promise<{ items: { str: string }[] }> }) =>
        pageData.getTextContent().then((tc) => {
          const tekst = tc.items.map((it) => it.str).join(" ");
          bladen.push(tekst);
          return tekst;
        }),
    });

    const bladMetKopje = bladen.findIndex((b) => b.includes("Rapportontwerp"));
    expect(bladMetKopje, "kopje Rapportontwerp niet gevonden in de PDF-tekst").toBeGreaterThanOrEqual(0);
    expect(bladen[bladMetKopje]).toContain("Nielsen Norman");
  });
});
