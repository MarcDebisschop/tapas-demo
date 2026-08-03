import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { renderT4StudentsRapport } from "../server/t4students/rapport-pdf";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import type { T4SLicentie } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Opmaakherstel, punt 1: de overzichtspagina "Jouw talentmotor in één
// oogopslag" in drie afzonderlijke blokken (Talent-foci, Talent-versnellers,
// Drivers), zodat de opmaak tussen twee lagen kan breken in plaats van
// middenin een lijst.
//
// AANLEIDING
// Het ene blok van het soort "banden" met alle drie de lagen samen was 836
// punten hoog, hoger dan het beschikbare deel van een blad (~630 punten). Het
// bouwscript zet zo'n blok op een eigen blad en laat het regel per regel
// doorlopen, wat op acht bladen kapotte, kopjeloze restjes tekst achterliet.
//
// WAT DEZE TEST VASTLEGT
// - Het bouwscript geeft geen enkele melding meer dat een blok van het soort
//   "banden" hoger is dan een blad.
// - Pagina 4 bestaat uit drie afzonderlijke "banden"-blokken (één per laag),
//   niet één blok met drie lagen samen.
// - De vaste uitlegtekst over de drie groepen staat op deze pagina precies
//   één keer, niet drie keer.
// - In de gegenereerde PDF-tekst staan Talent-foci, Talent-versnellers en
//   Drivers nog steeds alle drie op de bladen van pagina 4 (niets is verloren
//   gegaan bij het opsplitsen).
// ---------------------------------------------------------------------------

function rapportVan(licentie: T4SLicentie) {
  const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
  return bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, licentie, {
    naam: VOORBEELDAFNAME.naam,
    code: VOORBEELDAFNAME.code,
    datum: VOORBEELDAFNAME.datum,
    instrumentVersie: I.version,
  });
}

describe("de overzichtspagina in drie blokken, één per laag", () => {
  it("geen melding meer dat een banden-blok hoger is dan een blad", () => {
    const rapport = rapportVan("verdieping");
    const { meldingen } = renderT4StudentsRapport(rapport);
    const teHoog = meldingen.filter((m) => m.includes("banden") && m.includes("hoger dan een blad"));
    expect(teHoog).toHaveLength(0);
  });

  it("pagina 4 bestaat uit drie afzonderlijke banden-blokken, één per laag", () => {
    const rapport = rapportVan("verdieping");
    const p4 = rapport.paginas.find((p) => p.nr === 4)!;
    const bandenBlokken = p4.blokken.filter((b) => b.soort === "banden") as Extract<
      (typeof p4.blokken)[number],
      { soort: "banden" }
    >[];
    expect(bandenBlokken).toHaveLength(3);
    expect(bandenBlokken[0].banden).toHaveLength(1);
    expect(bandenBlokken[0].banden[0].titel).toBe("TALENT-FOCI");
    expect(bandenBlokken[1].banden).toHaveLength(1);
    expect(bandenBlokken[1].banden[0].titel).toBe("TALENT-VERSNELLERS");
    expect(bandenBlokken[2].banden).toHaveLength(1);
    expect(bandenBlokken[2].banden[0].titel).toBe("DRIVERS");
  });

  it("de vaste uitlegzin over de drie groepen staat op pagina 4 maar één keer, niet per blok herhaald", () => {
    const rapport = rapportVan("verdieping");
    const p4 = rapport.paginas.find((p) => p.nr === 4)!;
    const bandenBlokken = p4.blokken.filter((b) => b.soort === "banden") as Extract<
      (typeof p4.blokken)[number],
      { soort: "banden" }
    >[];
    const treffers = bandenBlokken.flatMap((b) => b.naschrift).filter((r) => r.includes("komen uit de antwoordschaal zelf"));
    expect(treffers).toHaveLength(1);
  });

  it("de kop en inleiding van het hoofdstuk blijven op blad 4 zelf, blad 4 is niet leeg", async () => {
    const rapport = rapportVan("verdieping");
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

    const bladMetTitel = bladen.findIndex((b) => b.includes("Jouw talentmotor in één oogopslag") && !b.includes("(vervolg)"));
    expect(bladMetTitel, "de titel van de one-page niet gevonden zonder (vervolg)").toBeGreaterThanOrEqual(0);
    expect(bladen[bladMetTitel]).toContain("Deze pagina zet je drie lagen onder elkaar");
    expect(bladen[bladMetTitel]).toContain("TALENT-FOCI");

    // Alle drie de lagen komen ergens terug op de bladen van deze pagina.
    const allePaginaVierBladen = bladen.filter((b) => b.includes("Jouw talentmotor in één oogopslag"));
    const samen = allePaginaVierBladen.join(" ");
    expect(samen).toContain("TALENT-FOCI");
    expect(samen).toContain("TALENT-VERSNELLERS");
    expect(samen).toContain("DRIVERS");
  });
});
