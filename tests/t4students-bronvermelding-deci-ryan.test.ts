import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import type { T4SPagina } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// De verwijzing naar Deci en Ryan mag in het Studiekompas maar in één vorm
// voorkomen.
//
// WAAROM DIT BEWAAKT MOET WORDEN
// Het rapport noemde Deci en Ryan eerst kort bij het motivatieblok
// ("Deci en Ryan (1985, 2000)") en gaf daarnaast, bij de verantwoording, een
// tweede, afwijkende reeks losse verwijzingen. Het bronnenbesluit
// (/home/user/workspace/bronnenbesluit.md) beslist dat de vorm bij het
// motivatieblok blijft staan zoals die al stond, dat er geen tweede,
// afwijkende vorm bij komt, en dat de volledige, letterlijke verwijzingen
// voortaan uitsluitend op het bronnenblad (onderdeel G) staan, overgenomen
// uit bronnen-geverifieerd.md.
// ---------------------------------------------------------------------------

function alleTeksten(pagina: T4SPagina): string {
  const stukken: string[] = [pagina.titel, pagina.ondertitel];
  for (const blok of pagina.blokken) {
    if ("tekst" in blok && typeof blok.tekst === "string") stukken.push(blok.tekst);
    if ("kop" in blok && typeof blok.kop === "string") stukken.push(blok.kop);
    if ("punten" in blok && Array.isArray(blok.punten)) stukken.push(...blok.punten);
  }
  return stukken.join(" \n ");
}

describe("de verwijzing naar Deci en Ryan staat maar in één vorm in het Studiekompas", () => {
  it("gebruikt overal dezelfde inline vorm, Deci en Ryan (2000, 2020), en nergens de oude vorm 1985", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    const volledigeTekst = rapport.paginas.map(alleTeksten).join(" \n ");
    expect(volledigeTekst).toContain("Deci en Ryan (2000, 2020)");
    expect(volledigeTekst).not.toContain("Deci en Ryan (1985");
    expect(volledigeTekst).not.toContain("Deci & Ryan");
  });

  it("de volledige, letterlijke verwijzingen naar Deci en Ryan staan uitsluitend op het bronnenblad", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    const bronnenblad = rapport.paginas.find((p) => /waarop dit rapport gebouwd is/i.test(p.titel));
    expect(bronnenblad, "geen bronnenblad gevonden").toBeDefined();
    const tekst = alleTeksten(bronnenblad!);
    expect(tekst).toContain(
      'Deci, E. L. en Ryan, R. M. (2000). The "what" and "why" of goal pursuits: Human needs and ' +
        "the self-determination of behavior. Psychological Inquiry, 11(4), 227 tot 268.",
    );
    expect(tekst).toContain(
      "Ryan, R. M. en Deci, E. L. (2000). Self-determination theory and the facilitation of intrinsic " +
        "motivation, social development, and well-being. American Psychologist, 55(1), 68 tot 78.",
    );
    expect(tekst).toContain(
      "Ryan, R. M. en Deci, E. L. (2020). Intrinsic and extrinsic motivation from a self-determination " +
        "theory perspective: Definitions, theory, practices, and future directions. Contemporary " +
        "Educational Psychology, 61, artikel 101860.",
    );
  });

  it("het verantwoordingsblad bevat geen eigen, afwijkende bronvermelding meer", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    const verantwoording = rapport.paginas.find((p) => /^verantwoording en grenzen$/i.test(p.titel));
    expect(verantwoording, "geen verantwoordingsblad gevonden").toBeDefined();
    const tekst = alleTeksten(verantwoording!);
    expect(tekst).not.toContain("Plenum Press");
    expect(tekst).not.toContain("Guilford Press");
  });
});
