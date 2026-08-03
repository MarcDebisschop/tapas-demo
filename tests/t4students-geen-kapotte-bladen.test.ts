import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { renderT4StudentsRapport } from "../server/t4students/rapport-pdf";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import type { T4SLicentie } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Opmaakherstel, punt 2 en 3: geen enkel blad zonder kopregel, voettekst en
// bladnummer, en geen (bijna) leeg blad.
//
// AANLEIDING
// Het blok van het soort "banden" op "Jouw talentmotor in één oogopslag" was
// 836 punten hoog, hoger dan een blad. Het bouwscript zette het daarom op een
// eigen blad en liet het regel per regel doorlopen op de bladen erna. Elk van
// die doorloopbladen kreeg geen kopregel, geen voettekst en geen bladnummer,
// omdat alleen het eerste blad van een pagina die elementen tekent. Sommige
// bladen bevatten daardoor maar één losse tekstregel ("Hurry Up", "0,6 -1,0"),
// en achteraan bleef een volledig leeg blad over.
//
// WAT DEZE TEST VASTLEGT
// Ze rendert het echte voorbeeldrapport naar PDF, leest de tekst per fysiek
// blad (net als tests/t4students-kopje-niet-alleen-onderaan.test.ts al doet)
// en controleert voor elk blad, behalve het titelblad:
// - het blad draagt de kopregel (naam · code) en de voettekst;
// - het blad heeft ten minste vier regels eigen inhoud (dus geen kaal blad
//   met alleen kop/voettekst en één losse regel);
// - er is geen volledig leeg blad.
// Getest op zowel de Verdieping- als de Basis-variant.
// ---------------------------------------------------------------------------

const VOETREGEL = "Een momentopname, geen oordeel of beslissing.";
const MIN_REGELS = 4;

async function bladenVan(licentie: T4SLicentie): Promise<string[]> {
  const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
  const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, licentie, {
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
  const bladen: { tekst: string; regels: number }[] = [];
  await pdfParse(buffer, {
    pagerender: (pageData: { getTextContent: () => Promise<{ items: { str: string; transform: number[] }[] }> }) =>
      pageData.getTextContent().then((tc) => {
        // Regels tellen op basis van verschillende verticale posities (transform[5]),
        // zodat twee stukjes tekst op dezelfde regel niet dubbel meetellen.
        const hoogtes = new Set(tc.items.filter((it) => it.str.trim().length > 0).map((it) => Math.round(it.transform[5])));
        const tekst = tc.items.map((it) => it.str).join(" ");
        bladen.push({ tekst, regels: hoogtes.size });
        return tekst;
      }),
  });
  return bladen.map((b) => `${b.tekst}\u0000${b.regels}`);
}

function controleer(bladen: string[], licentie: string): void {
  expect(bladen.length).toBeGreaterThan(0);
  // Blad 1 is het titelblad (cover): dat draagt bewust geen kopregel/voettekst/nummer.
  for (let i = 1; i < bladen.length; i++) {
    const [tekst, regelsStr] = bladen[i].split("\u0000");
    const regels = Number(regelsStr);
    const bladnr = i + 1;

    expect(tekst.length, `${licentie} blad ${bladnr}: mag niet volledig leeg zijn`).toBeGreaterThan(0);
    expect(tekst, `${licentie} blad ${bladnr}: mist de kopregel met naam en code`).toContain(VOORBEELDAFNAME.naam);
    expect(tekst, `${licentie} blad ${bladnr}: mist de voettekst`).toContain(VOETREGEL);
    // Het bladnummer zelf staat rechtsonder als los getal; dat is met tekst-
    // extractie niet feilloos te isoleren, maar de kop- en voetregel samen
    // bewijzen al dat tekenKopEnVoet() voor dit blad is gedraaid (het enige
    // pad dat ook het bladnummer tekent).
    expect(regels, `${licentie} blad ${bladnr}: heeft te weinig eigen inhoud (${regels} regels)`).toBeGreaterThanOrEqual(
      MIN_REGELS,
    );
  }
}

describe("geen enkel blad zonder kopregel, voettekst, bladnummer, en geen (bijna) leeg blad", () => {
  it("Verdieping: elk blad behalve de cover heeft kop, voettekst en minstens vier regels inhoud", async () => {
    const bladen = await bladenVan("verdieping");
    controleer(bladen, "verdieping");
  });

  it("Basis: elk blad behalve de cover heeft kop, voettekst en minstens vier regels inhoud", async () => {
    const bladen = await bladenVan("basis");
    controleer(bladen, "basis");
  });
});
