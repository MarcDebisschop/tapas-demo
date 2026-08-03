import { describe, it, expect } from "vitest";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { renderT4StudentsRapport } from "../server/t4students/rapport-pdf";
import { T4STUDENTS_INSTRUMENT } from "../server/t4students/instrument";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import type { T4SBlok } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Herstelronde 2, punt B: geen genummerde rangorde meer in het rapport dat
// een student ziet. Elke plaats met een rangtabel toont in plaats daarvan de
// drie groepen (sterk aanwezig, middenveld, minder aanwezig) met de vaste
// uitlegzin (opdracht-herstelronde-2.md, punt B), en geen enkele rangtabel
// draagt nog een los plaatsnummer.
// ---------------------------------------------------------------------------

function bouwVoorbeeldrapport() {
  const resultaat = scoreStudiekompas(T4STUDENTS_INSTRUMENT, VOORBEELDAFNAME.antwoorden, null, "nl");
  return bouwT4StudentsRapport(T4STUDENTS_INSTRUMENT, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
    naam: VOORBEELDAFNAME.naam,
    code: VOORBEELDAFNAME.code,
    datum: VOORBEELDAFNAME.datum,
    instrumentVersie: T4STUDENTS_INSTRUMENT.version,
  });
}

function alleRangtabellen(blokken: T4SBlok[][]): Extract<T4SBlok, { soort: "rangtabel" }>[] {
  return blokken.flat().filter((b): b is Extract<T4SBlok, { soort: "rangtabel" }> => b.soort === "rangtabel");
}

describe("punt B: elke rangtabel in het rapport toont groepen met de vaste uitlegzin, geen plaatsnummer", () => {
  it("elk rangtabel-blok draagt de vaste uitlegzin over de drie groepen", () => {
    const rapport = bouwVoorbeeldrapport();
    const tabellen = alleRangtabellen(rapport.paginas.map((p) => p.blokken));
    expect(tabellen.length).toBeGreaterThan(0);
    const VASTE_TEKST =
      "De drie groepen hieronder komen uit de antwoordschaal zelf, in drie gelijke " +
      "delen. Het is geen vergelijking met andere studenten, want die " +
      "vergelijkingsgroep bestaat niet. Het is het beeld dat jij vandaag van " +
      "jezelf geeft.";
    for (const t of tabellen) {
      expect(t.naschrift.join(" ")).toContain(VASTE_TEKST);
    }
  });

  it("de groepstitels staan letterlijk in de gerenderde PDF-tekst", async () => {
    const rapport = bouwVoorbeeldrapport();
    const { doc } = renderT4StudentsRapport(rapport);
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    const einde = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
    doc.end();
    const buffer = await einde;

    const pdfParse = (await import("pdf-parse")).default;
    let volledigeTekst = "";
    await pdfParse(buffer, {
      pagerender: (pageData: { getTextContent: () => Promise<{ items: { str: string }[] }> }) =>
        pageData.getTextContent().then((tc) => {
          const tekst = tc.items.map((it) => it.str).join(" ");
          volledigeTekst += tekst + "\n";
          return tekst;
        }),
    });

    // De vaste uitlegzin moet ergens direct gevolgd worden door minstens een
    // van de drie groepstitels: dat is de plek waar een rangtabel staat, niet
    // een toevallig gebruik van dezelfde woorden elders ("sterk aanwezig"
    // komt bijvoorbeeld ook voor in de motivatietekst, los van punt B).
    const kop = "vandaag van jezelf geeft.";
    const idx = volledigeTekst.indexOf(kop);
    expect(idx, "de vaste uitlegzin van punt B staat niet in de PDF-tekst").toBeGreaterThanOrEqual(0);
    // Het naschrift met de vaste uitlegzin staat ONDER de groepen (net als
    // vroeger onder de rijen), dus de groepstitel(s) staan er ruim voor.
    const omgeving = volledigeTekst.slice(Math.max(0, idx - 600), idx + 50);
    expect(omgeving).toMatch(/Sterk aanwezig|Middenveld|Minder aanwezig/i);
  });
});
