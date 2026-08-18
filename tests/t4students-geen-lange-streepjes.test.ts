import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import { htmlVanRapport } from "../server/t4students/rapport-keten";
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

describe("de HTML-weergave van het Studiekompas draagt geen lange liggende streepjes", () => {
  it("de HTML-uitvoer van htmlVanRapport bevat geen streepje uit U+2010 tot U+2015", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    expect(vindStreepjes(htmlVanRapport(rapport))).toEqual([]);
  });
});

describe("de vragenlijstitems van het Studiekompas dragen geen lange liggende streepjes", () => {
  it("geen streepje uit U+2010 tot U+2015 in familie, construct of tekst van enig item", () => {
    const items = laadInstrumentItems("tapas-t4students");
    // De itembank van het vraagbeheer is dezelfde als die van de afname en van
    // de scoring: server/data/t4students.json. Eerder stond hier een tweede,
    // met de hand geschreven lijst met eigen id's; die is afgevoerd.
    expect(items.length).toBeGreaterThan(30);
    expect(items.some((it) => it.itemId.startsWith("MOT-"))).toBe(true);
    for (const item of items) {
      for (const veld of [item.family, item.construct ?? "", item.tekst.nl ?? ""]) {
        expect(vindStreepjes(veld), `${item.itemId}: ${veld}`).toEqual([]);
      }
    }
  });
});
