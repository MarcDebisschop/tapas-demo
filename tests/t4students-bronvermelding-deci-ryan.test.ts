import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import { htmlVanRapport } from "../server/t4students/rapport-keten";
import type { T4SPagina } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// De volledige bronvermelding van Deci en Ryan, met jaartal, in de bladen en in
// de HTML-weergave.
//
// WAAROM DIT BEWAAKT MOET WORDEN
// Vandaag noemt de code Deci en Ryan alleen bij naam, zonder jaartal en zonder
// publicatie. De opdrachtgever wil in de lopende tekst "de zelfdeterminatie-
// theorie van Deci en Ryan (1985, 2000)" en daarnaast, bij de bronnen of de
// verantwoording, de drie volledige, letterlijke verwijzingen.
// ---------------------------------------------------------------------------

const VOLLEDIGE_BRONNEN = [
  "Deci, E. L., en Ryan, R. M. (1985). Intrinsic Motivation and Self-Determination in Human Behavior. New York: Plenum Press.",
  "Ryan, R. M., en Deci, E. L. (2000). Self-determination theory and the facilitation of intrinsic motivation, social development, and well-being. American Psychologist, 55(1), 68 tot 78.",
  "Ryan, R. M., en Deci, E. L. (2017). Self-Determination Theory: Basic Psychological Needs in Motivation, Development, and Wellness. New York: Guilford Press.",
];

function alleTekst(pagina: T4SPagina): string {
  const stukken: string[] = [pagina.titel, pagina.ondertitel];
  for (const blok of pagina.blokken) {
    if ("tekst" in blok && typeof blok.tekst === "string") stukken.push(blok.tekst);
    if ("kop" in blok && typeof blok.kop === "string") stukken.push(blok.kop);
    if ("punten" in blok && Array.isArray(blok.punten)) stukken.push(...blok.punten);
    if ("paren" in blok && Array.isArray(blok.paren)) {
      for (const p of blok.paren) stukken.push(p.label, p.waarde);
    }
  }
  return stukken.join(" \n ");
}

describe("de volledige bronvermelding van Deci en Ryan staat in het Studiekompas", () => {
  it("de drie volledige, letterlijke bronvermeldingen staan samen op de verantwoordingspagina", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    const volledigeTekst = rapport.paginas.map(alleTekst).join(" \n ");
    for (const bron of VOLLEDIGE_BRONNEN) {
      expect(volledigeTekst, `bron ontbreekt: ${bron}`).toContain(bron);
    }
  });

  it("de lopende tekst gebruikt 'en' tussen de auteurs en het jaartal 1985, 2000", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    const volledigeTekst = rapport.paginas.map(alleTekst).join(" \n ");
    expect(volledigeTekst).toContain("Deci en Ryan (1985, 2000)");
    expect(volledigeTekst).not.toContain("Deci & Ryan");
  });
});

describe("de volledige bronvermelding staat ook in de HTML-weergave van hetzelfde rapport", () => {
  function html(): string {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    return htmlVanRapport(rapport);
  }

  it("de drie volledige, letterlijke bronvermeldingen staan in de HTML-uitvoer", () => {
    const uitvoer = html();
    for (const bron of VOLLEDIGE_BRONNEN) {
      expect(uitvoer, `bron ontbreekt: ${bron}`).toContain(bron);
    }
  });

  it("de lopende tekst gebruikt 'en' tussen de auteurs en het jaartal 1985, 2000", () => {
    const uitvoer = html();
    expect(uitvoer).toContain("Deci en Ryan (1985, 2000)");
    expect(uitvoer).not.toContain("Deci &amp; Ryan");
    expect(uitvoer).not.toContain("Deci & Ryan");
  });
});
