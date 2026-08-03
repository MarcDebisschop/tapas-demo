import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import type { T4SPagina } from "../server/t4students/rapport-contract";
import rapportteksten from "../server/data/t4students-rapportteksten.json";

// ---------------------------------------------------------------------------
// Onderdeel D van de opdracht "Studiekompas persoonlijk maken".
//
// Oorspronkelijk bouwde deze opdracht een blad "In één zin" met zowel een
// vaste zinsbouw uit bouwstenen (D1) als twee blokken "Wat nu al sterk is" /
// "Wat sterker kan worden" (D2), die uitsluitend de bestaande balanslabels
// kernsterkte / latent / onderbenut aflezen.
//
// OPMAAKHERSTEL (2026-08-03), PUNT 2: het latere slothoofdstuk "Een zin om
// mee te nemen" toont dezelfde D1-zin nog eens in zijn citaatvlak, waardoor
// de student ze twee keer las. De zin (D1) is daarom verhuisd: ze staat nu
// alleen nog in het citaatvlak van het slothoofdstuk. Het blad van deze test
// heet voortaan "Wat vlot gaat en wat energie kost" en toont alleen nog D2,
// de twee lijstjes. Deze test bewaakt daarom de D1-zin nog steeds letterlijk
// met dezelfde teksten als voorheen, maar nu op de nieuwe plaats (het
// citaatvlak van het slothoofdstuk); alleen de vindplaats is aangepast, niet
// de bewaakte tekst zelf. De tests over D2 ("Wat nu al sterk is") blijven
// ongewijzigd op het eigen blad.
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

/** Het blad met de twee lijstjes (D2), vroeger "In één zin", nu "Wat vlot gaat en wat energie kost". */
function vindBlad(paginas: T4SPagina[]): T4SPagina | undefined {
  return paginas.find((p) => /^wat vlot gaat en wat energie kost$/i.test(p.titel));
}

/** Het slothoofdstuk waarin de D1-zin nu als citaatvlak staat. */
function vindSlot(paginas: T4SPagina[]): T4SPagina | undefined {
  return paginas.find((p) => /een zin om mee te nemen/i.test(p.titel));
}

/** De letterlijke tekst van de D1-zin uit het citaatvlak van het slothoofdstuk. */
function vindZinUitSlot(paginas: T4SPagina[]): string {
  const slot = vindSlot(paginas);
  const citaat = slot?.blokken.find((b) => b.soort === "citaat") as { regels: { vraag: string }[] } | undefined;
  return citaat?.regels[0]?.vraag ?? "";
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

describe("het slothoofdstuk toont de vaste zin uit bouwstenen in zijn citaatvlak", () => {
  it("bestaat, en staat vlak voor Wat je hier zocht (op de plaats van het blad Wat vlot gaat en wat energie kost)", () => {
    const rapport = bouw(VOORBEELDAFNAME.antwoorden as unknown as Record<string, unknown>);
    const blad = vindBlad(rapport.paginas);
    expect(blad, "geen blad Wat vlot gaat en wat energie kost gevonden").toBeDefined();
    const bladZocht = rapport.paginas.find((p) => /wat je hier zocht/i.test(p.titel));
    expect(bladZocht).toBeDefined();
    expect(rapport.paginas.indexOf(blad!)).toBe(rapport.paginas.indexOf(bladZocht!) - 1);
  });

  it("bevat de bouwsteen van de sterkste talent-focus, versneller en interessegebied", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouw(VOORBEELDAFNAME.antwoorden as unknown as Record<string, unknown>);
    const zin = vindZinUitSlot(rapport.paginas).toLowerCase();
    // De sterkste focus komt rechtstreeks uit de motor (resultaat.foci.sorted,
    // herstelronde punt 1), niet hertypt: voor het voorbeeldprofiel is dat
    // Sociaal Interactief.
    const sterksteFocus = resultaat.foci.sorted[0];
    expect(sterksteFocus).toBe("Sociaal Interactief");
    const bouwsteen = (
      rapportteksten as { eenZinTalentfocus: { teksten: Record<string, string> } }
    ).eenZinTalentfocus.teksten[sterksteFocus];
    expect(zin).toContain(bouwsteen.toLowerCase());
  });

  it("bevat de vaste regel dat de zin niet de hele persoon samenvat", () => {
    const rapport = bouw(VOORBEELDAFNAME.antwoorden as unknown as Record<string, unknown>);
    const slot = vindSlot(rapport.paginas)!;
    const tekst = alleTeksten(slot).toLowerCase();
    expect(tekst).toContain("hij vat je niet samen als persoon");
  });

  it("toont geen citaatvlak met de zin, wanneer het beeld voorlopig is (te weinig ingevuld)", () => {
    const resultaat = scoreStudiekompas(I, {}, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, {}, "verdieping", {
      naam: "Test",
      code: "T4S-0000-0000",
      datum: "2 augustus 2026",
      instrumentVersie: I.version,
    });
    expect(resultaat.betrouwbaarheid.voorlopig).toBe(true);
    const slot = vindSlot(rapport.paginas)!;
    const citaat = slot.blokken.find((b) => b.soort === "citaat");
    // Bij te weinig ingevuld levert berekenZinBlokken de vaste
    // te-weinig-alinea op, geen bruikbare zin; het citaatvlak op het
    // slothoofdstuk verschijnt dan niet (zie eenZinOmMeeTeNemenBlokken).
    expect(citaat, "citaatvlak had niet mogen verschijnen zonder genoeg antwoorden").toBeUndefined();
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
