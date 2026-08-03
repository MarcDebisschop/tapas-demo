import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import { bouwT4StudentsRapport as bouwOudeWeg, renderT4StudentsHtml } from "../server/t4students/rapport";
import { laadInstrumentItems } from "../server/question-manager";
import type { T4SBlok } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Geen lange liggende streepjes in wat een lezer onder ogen komt.
//
// WAAROM DIT BEWAAKT MOET WORDEN
// De opdrachtgever wil in alle T4Students-rapporttekst en vragenlijsttekst
// gewone leestekens: komma, dubbele punt, haakjes of een nieuwe zin. Geen
// em-dash, en-dash of verwante streepjes uit het bereik U+2010 tot U+2015.
// Deze test rekent een echte afname door de motor en de rapportlaag en zoekt
// in de werkelijk gebouwde tekst, niet enkel in de bronbestanden.
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-control-regex
const STREEPJE = /[\u2010-\u2015]/;

function vindStreepjes(tekst: string): string[] {
  const gevonden: string[] = [];
  const regex = new RegExp(STREEPJE, "g");
  let m: RegExpExecArray | null;
  while ((m = regex.exec(tekst)) !== null) {
    const start = Math.max(0, m.index - 30);
    gevonden.push(tekst.slice(start, m.index + 30));
  }
  return gevonden;
}

/** Alle tekstvelden uit een blok van het Studiekompas, plat getrokken. */
function tekstenUitBlok(blok: T4SBlok): string[] {
  const uit: string[] = [];
  if ("tekst" in blok && typeof blok.tekst === "string") uit.push(blok.tekst);
  if ("kop" in blok && typeof blok.kop === "string") uit.push(blok.kop);
  if ("punten" in blok && Array.isArray(blok.punten)) uit.push(...blok.punten);
  if ("vragen" in blok && Array.isArray(blok.vragen)) uit.push(...blok.vragen);
  if ("duiding" in blok && typeof blok.duiding === "string") uit.push(blok.duiding);
  if ("legende" in blok && Array.isArray(blok.legende)) uit.push(...blok.legende);
  if ("naschrift" in blok && Array.isArray(blok.naschrift)) uit.push(...blok.naschrift);
  if ("paren" in blok && Array.isArray(blok.paren)) {
    for (const p of blok.paren) {
      uit.push(p.label, p.waarde);
    }
  }
  if ("regels" in blok && Array.isArray(blok.regels)) {
    for (const r of blok.regels as { tekst?: string }[]) {
      if (typeof r.tekst === "string") uit.push(r.tekst);
    }
  }
  return uit;
}

describe("het Studiekompas draagt geen lange liggende streepjes", () => {
  it("geen enkel blok in basis of verdieping bevat een streepje uit U+2010 tot U+2015", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    for (const licentie of ["basis", "verdieping"] as const) {
      const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, licentie, {
        naam: VOORBEELDAFNAME.naam,
        code: VOORBEELDAFNAME.code,
        datum: VOORBEELDAFNAME.datum,
        instrumentVersie: I.version,
      });
      for (const pagina of rapport.paginas) {
        for (const blok of pagina.blokken) {
          for (const tekst of tekstenUitBlok(blok)) {
            const gevonden = vindStreepjes(tekst);
            expect(gevonden, `pagina ${pagina.nr} (${pagina.titel})`).toEqual([]);
          }
        }
        expect(vindStreepjes(pagina.titel), `titel van pagina ${pagina.nr}`).toEqual([]);
        expect(vindStreepjes(pagina.ondertitel), `ondertitel van pagina ${pagina.nr}`).toEqual([]);
      }
    }
  });
});

describe("de oude T4Students-rapportweg draagt geen lange liggende streepjes", () => {
  it("de HTML-uitvoer van bouwT4StudentsRapport/renderT4StudentsHtml bevat geen streepje uit U+2010 tot U+2015", () => {
    const contract = {
      participant: { name: VOORBEELDAFNAME.naam, respondentCode: VOORBEELDAFNAME.code },
      answers: VOORBEELDAFNAME.antwoorden,
      instrument: I,
    };
    const inhoud = bouwOudeWeg(contract);
    const html = renderT4StudentsHtml(inhoud);
    const gevonden = vindStreepjes(html);
    expect(gevonden).toEqual([]);
  });
});

describe("de vijf T4S-MOT-vragenlijstitems en hun tekst dragen geen lange liggende streepjes", () => {
  it("geen streepje uit U+2010 tot U+2015 in familie, construct of tekst van de MOT-items", () => {
    const items = laadInstrumentItems("tapas-t4students");
    const motItems = items.filter((it) => it.itemId.startsWith("T4S-MOT"));
    expect(motItems.length).toBeGreaterThan(0);
    for (const item of motItems) {
      const tekstNl = item.tekst.nl ?? "";
      for (const veld of [item.family, item.construct, tekstNl]) {
        expect(vindStreepjes(veld), `${item.itemId}: ${veld}`).toEqual([]);
      }
    }
  });
});
