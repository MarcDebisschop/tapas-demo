import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import type { T4SPagina } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Onderdeel D van de opdracht "Studiekompas persoonlijk maken".
//
// Een blad "In één zin" met een vaste zinsbouw uit bouwstenen (D1), en twee
// blokken "Wat nu al sterk is" / "Wat sterker kan worden" (D2), die uitsluitend
// de bestaande balanslabels kernsterkte / latent / onderbenut aflezen.
// ---------------------------------------------------------------------------

function bouw(antwoorden: Record<string, unknown>) {
  const resultaat = scoreStudiekompas(I, antwoorden as never, null, "nl");
  return bouwT4StudentsRapport(I, resultaat, antwoorden as never, "verdieping", {
    naam: "Test",
    code: "T4S-0000-0000",
    datum: "2 augustus 2026",
    instrumentVersie: I.version,
  });
}

function vindBlad(paginas: T4SPagina[]): T4SPagina | undefined {
  return paginas.find((p) => /^in één zin$/i.test(p.titel));
}

function alleTeksten(p: T4SPagina): string {
  const stukken: string[] = [p.titel, p.ondertitel];
  for (const b of p.blokken) {
    if ("tekst" in b && typeof b.tekst === "string") stukken.push(b.tekst);
    if ("kop" in b && typeof b.kop === "string") stukken.push(b.kop);
    if ("punten" in b && Array.isArray(b.punten)) stukken.push(...(b.punten as string[]));
  }
  return stukken.join(" \n ");
}

describe("het blad In één zin bouwt een vaste zin uit bouwstenen", () => {
  it("bestaat, en staat vlak voor Wat je hier zocht", () => {
    const rapport = bouw(VOORBEELDAFNAME.antwoorden as unknown as Record<string, unknown>);
    const blad = vindBlad(rapport.paginas);
    expect(blad, "geen blad In één zin gevonden").toBeDefined();
    const bladZocht = rapport.paginas.find((p) => /wat je hier zocht/i.test(p.titel));
    expect(bladZocht).toBeDefined();
    expect(rapport.paginas.indexOf(blad!)).toBe(rapport.paginas.indexOf(bladZocht!) - 1);
  });

  it("bevat de bouwsteen van de sterkste talent-focus, versneller en interessegebied", () => {
    const rapport = bouw(VOORBEELDAFNAME.antwoorden as unknown as Record<string, unknown>);
    const blad = vindBlad(rapport.paginas)!;
    const tekst = alleTeksten(blad).toLowerCase();
    // Sterkste focus in het voorbeeld: Overdrachtelijk Interactief.
    expect(tekst).toContain("iets kunt uitleggen zodat een ander het begrijpt");
  });

  it("bevat de vaste regel dat de zin niet de hele persoon samenvat", () => {
    const rapport = bouw(VOORBEELDAFNAME.antwoorden as unknown as Record<string, unknown>);
    const blad = vindBlad(rapport.paginas)!;
    const tekst = alleTeksten(blad).toLowerCase();
    expect(tekst).toContain("hij vat je niet samen als persoon");
  });

  it("toont in plaats van de zin een alinea over te weinig ingevuld, wanneer het beeld voorlopig is", () => {
    const resultaat = scoreStudiekompas(I, {}, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, {}, "verdieping", {
      naam: "Test",
      code: "T4S-0000-0000",
      datum: "2 augustus 2026",
      instrumentVersie: I.version,
    });
    expect(resultaat.betrouwbaarheid.voorlopig).toBe(true);
    const blad = vindBlad(rapport.paginas)!;
    const tekst = alleTeksten(blad).toLowerCase();
    expect(tekst).toContain("te weinig ingevuld");
  });

  it("toont het blok Wat nu al sterk is met constructen die het label kernsterkte dragen", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    const blad = vindBlad(rapport.paginas)!;
    const tekst = alleTeksten(blad);
    expect(tekst).toContain("Wat nu al sterk is");
  });

  it("gebruikt uitsluitend de vijf bestaande balanswoorden en verzint er geen nieuwe bij", () => {
    const rapport = bouw(VOORBEELDAFNAME.antwoorden as unknown as Record<string, unknown>);
    const blad = vindBlad(rapport.paginas)!;
    const tekst = alleTeksten(blad).toLowerCase();
    // Geen woord als "matig" of "gemiddeld" dat niet uit de motor komt.
    expect(tekst).not.toContain("gemiddeld");
    expect(tekst).not.toContain(" matig");
  });
});
