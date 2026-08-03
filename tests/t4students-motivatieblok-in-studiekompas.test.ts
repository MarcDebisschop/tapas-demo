import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import type { T4SBlok, T4SPagina } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Het Studiekompas krijgt een eigen motivatieblok, gevoed door de motor.
//
// WAAROM DIT BEWAAKT MOET WORDEN
// scoreStudiekompas levert sinds fase 1b een veld motivatie met intrinsiek,
// extrinsiek en balansLabel. De nieuwe rapportweg (het Studiekompas) toont dit
// vandaag nergens. Deze test legt vast dat er een pagina bijkomt die het
// balanslabel, de twee getallen en een toelichting toont, en dat dat label
// letterlijk het label van de motor is: de rapportlaag rekent het nooit zelf
// opnieuw uit.
// ---------------------------------------------------------------------------

function vlagAlleTeksten(pagina: T4SPagina): string {
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

function vindMotivatiePagina(paginas: T4SPagina[]): T4SPagina | undefined {
  return paginas.find((p) => /motiveert/i.test(p.titel));
}

describe("het Studiekompas draagt een motivatieblok dat uit de motor leest", () => {
  it("er is een pagina die het balanslabel van de motor toont, letterlijk", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    const motivatiePagina = vindMotivatiePagina(rapport.paginas);
    expect(motivatiePagina, "geen motivatiepagina gevonden in het Studiekompas").toBeDefined();
    const tekst = vlagAlleTeksten(motivatiePagina!);
    expect(tekst).toContain(resultaat.motivatie.balansLabel);
  });

  it("de getoonde getallen voor intrinsiek en extrinsiek zijn de getallen van de motor, ongewijzigd", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    const motivatiePagina = vindMotivatiePagina(rapport.paginas);
    expect(motivatiePagina).toBeDefined();
    const tabelBlok = motivatiePagina!.blokken.find(
      (b): b is Extract<T4SBlok, { soort: "paren" }> => b.soort === "paren",
    );
    expect(tabelBlok, "geen paren-blok met de motivatiegetallen gevonden").toBeDefined();
    const waarden = tabelBlok!.paren.map((p) => p.waarde);
    const intrTekst = resultaat.motivatie.intrinsiek.toFixed(1).replace(".", ",");
    const extrTekst = resultaat.motivatie.extrinsiek.toFixed(1).replace(".", ",");
    expect(waarden.some((w) => w.includes(intrTekst))).toBe(true);
    expect(waarden.some((w) => w.includes(extrTekst))).toBe(true);
  });

  it("het label verandert mee met de motor, voor alle drie de mogelijke labels", () => {
    // Drie afnames op basis van de volledige voorbeeldafname, met alleen de vijf
    // motivatie-items aangepast, zodat de motor elk van de drie labels teruggeeft.
    const motNeutraal = {
      "MOT-INT-1": { recognition: 1, energy: 0 },
      "MOT-INT-2": { recognition: 1, energy: 0 },
      "MOT-INT-3": { recognition: 1, energy: 0 },
      "MOT-EXT-1": { recognition: 1, energy: 0 },
      "MOT-EXT-2": { recognition: 1, energy: 0 },
    };
    const varianten: Record<string, Record<string, unknown>> = {
      intrinsiekVariant: {
        ...VOORBEELDAFNAME.antwoorden,
        ...motNeutraal,
        "MOT-INT-1": { recognition: 3, energy: 0 },
        "MOT-INT-2": { recognition: 3, energy: 0 },
        "MOT-INT-3": { recognition: 3, energy: 0 },
      },
      extrinsiekVariant: {
        ...VOORBEELDAFNAME.antwoorden,
        ...motNeutraal,
        "MOT-EXT-1": { recognition: 3, energy: 0 },
        "MOT-EXT-2": { recognition: 3, energy: 0 },
      },
      evenwichtigVariant: { ...VOORBEELDAFNAME.antwoorden, ...motNeutraal },
    };
    for (const [naam, antwoorden] of Object.entries(varianten)) {
      const resultaat = scoreStudiekompas(I, antwoorden as never, null, "nl");
      const rapport = bouwT4StudentsRapport(I, resultaat, antwoorden as never, "verdieping", {
        naam: "Test",
        code: "T4S-0000-0000",
        datum: "2 augustus 2026",
        instrumentVersie: I.version,
      });
      const motivatiePagina = vindMotivatiePagina(rapport.paginas);
      expect(motivatiePagina, naam).toBeDefined();
      const tekst = vlagAlleTeksten(motivatiePagina!);
      expect(tekst, `${naam}: ${resultaat.motivatie.balansLabel}`).toContain(resultaat.motivatie.balansLabel);
    }
  });

  it("het motivatieblok bevat geen enkele koppeling met de drivers", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    const motivatiePagina = vindMotivatiePagina(rapport.paginas);
    expect(motivatiePagina).toBeDefined();
    const tekst = vlagAlleTeksten(motivatiePagina!).toLowerCase();
    for (const driverNaam of ["be perfect", "please others", "try hard", "hurry up", "be strong"]) {
      expect(tekst).not.toContain(driverNaam);
    }
  });

  it("het woord drijfveer komt nergens voor, ook niet in het motivatieblok", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    for (const pagina of rapport.paginas) {
      expect(vlagAlleTeksten(pagina).toLowerCase()).not.toContain("drijfve");
    }
  });
});
