import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import {
  rangschik,
  groepeerOpAandeel,
  FAM_FOCI,
  FAM_VERSNELLERS,
  FAM_DRIVERS,
  type T4SLicentie,
  type T4SBlok,
} from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Groepen doortrekken naar de uitgewerkte bladen.
//
// AANLEIDING
// De hoofdstukken "wat sterk aanwezig is" en "wat lager staat" werkten nog
// een vast aantal van drie onderdelen uit (rijen.slice(0, 3) en
// rijen.slice(-3)), terwijl de rest van het rapport op groepen werkt
// (groepeerOpAandeel). Bij het voorbeeldrapport zit de groep "sterk
// aanwezig" van Talent-foci met vier leden (Sociaal Interactief,
// Overdrachtelijk Interactief, Systematisch/Uitvoerend en Functioneel
// Innovatief); de vaste drie-indeling zette Functioneel Innovatief dan ook
// nog in het hoofdstuk "wat lager staat", een tegenspraak met het overzicht
// op blad 4 waar hetzelfde onderdeel bij "sterk aanwezig" staat.
//
// WAT DEZE TEST VASTLEGT
// - Voor Talent-foci en Talent-versnellers (en, waar van toepassing,
//   Drivers): elk onderdeel van de familie komt in precies één van de twee
//   hoofdstukken voor, en de verdeling volgt exact groepeerOpAandeel: "wat
//   sterk aanwezig is" bevat alle leden van de groep sterk aanwezig, "wat
//   lager staat" bevat middenveld en minder aanwezig samen.
// - Geen enkel onderdeel ontbreekt en geen enkel onderdeel staat dubbel.
// - De inleidingszin bij "wat sterk aanwezig is" spreekt niet meer van "de
//   drie" maar noemt geen aantal.
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

function constructenOpPagina(blokken: T4SBlok[]): string[] {
  return blokken
    .filter((b): b is Extract<T4SBlok, { soort: "constructblok" }> => b.soort === "constructblok")
    .map((b) => b.construct);
}

describe("de hoofdstukken 'wat sterk aanwezig is' en 'wat lager staat' volgen de groepen", () => {
  it("Talent-foci: 'wat sterk aanwezig is' bevat precies de groep sterk aanwezig, 'wat lager staat' de rest", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const dim = rangschik(I, resultaat, VOORBEELDAFNAME.antwoorden, FAM_FOCI);
    const groepen = groepeerOpAandeel(dim.gerangschikt);
    const sterk = groepen.find((g) => g.titel === "sterk aanwezig")?.rijen.map((r) => r.construct) ?? [];
    const lager = groepen
      .filter((g) => g.titel !== "sterk aanwezig")
      .flatMap((g) => g.rijen.map((r) => r.construct));

    // Bij het voorbeeldrapport zit Functioneel Innovatief in de groep sterk
    // aanwezig samen met drie andere onderdelen: de groep telt hier vier
    // leden, niet drie. Deze aanname bewijst dat de test de tegenspraak echt
    // raakt en niet toevallig altijd op drie leden uitkomt.
    expect(sterk.length).toBeGreaterThan(3);
    expect(sterk).toContain("Functioneel Innovatief");

    const rapport = rapportVan("verdieping");
    const bladSterk = rapport.paginas.find((p) => p.titel === "Talent-foci, wat sterk aanwezig is")!;
    const bladLager = rapport.paginas.find((p) => p.titel === "Talent-foci, wat lager staat")!;

    expect(constructenOpPagina(bladSterk.blokken).sort()).toEqual([...sterk].sort());
    expect(constructenOpPagina(bladLager.blokken).sort()).toEqual([...lager].sort());
  });

  it("Talent-versnellers: 'wat sterk aanwezig is' bevat precies de groep sterk aanwezig, 'wat lager staat' de rest", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const dim = rangschik(I, resultaat, VOORBEELDAFNAME.antwoorden, FAM_VERSNELLERS);
    const groepen = groepeerOpAandeel(dim.gerangschikt);
    const sterk = groepen.find((g) => g.titel === "sterk aanwezig")?.rijen.map((r) => r.construct) ?? [];
    const lager = groepen
      .filter((g) => g.titel !== "sterk aanwezig")
      .flatMap((g) => g.rijen.map((r) => r.construct));

    const rapport = rapportVan("verdieping");
    const bladSterk = rapport.paginas.find((p) => p.titel === "Talent-versnellers, wat sterk aanwezig is")!;
    const bladLager = rapport.paginas.find((p) => p.titel === "Talent-versnellers, wat lager staat")!;

    expect(constructenOpPagina(bladSterk.blokken).sort()).toEqual([...sterk].sort());
    expect(constructenOpPagina(bladLager.blokken).sort()).toEqual([...lager].sort());
  });

  it("Drivers: 'jouw patroon' bevat precies de groep sterk aanwezig, 'de keerzijde' de rest", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const dim = rangschik(I, resultaat, VOORBEELDAFNAME.antwoorden, FAM_DRIVERS);
    const groepen = groepeerOpAandeel(dim.gerangschikt);
    const sterk = groepen.find((g) => g.titel === "sterk aanwezig")?.rijen.map((r) => r.construct) ?? [];
    const lager = groepen
      .filter((g) => g.titel !== "sterk aanwezig")
      .flatMap((g) => g.rijen.map((r) => r.construct));

    const rapport = rapportVan("verdieping");
    const bladSterk = rapport.paginas.find((p) => p.titel === "Drivers, jouw patroon")!;
    const bladLager = rapport.paginas.find((p) => p.titel === "Drivers, de keerzijde")!;

    expect(constructenOpPagina(bladSterk.blokken).sort()).toEqual([...sterk].sort());
    expect(constructenOpPagina(bladLager.blokken).sort()).toEqual([...lager].sort());
  });

  it("elk onderdeel van een familie komt in precies één van de twee hoofdstukken voor", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = rapportVan("verdieping");

    const paren: [string, string, string, string][] = [
      [FAM_FOCI, "Talent-foci, wat sterk aanwezig is", "Talent-foci, wat lager staat", "gerangschikt"],
      [
        FAM_VERSNELLERS,
        "Talent-versnellers, wat sterk aanwezig is",
        "Talent-versnellers, wat lager staat",
        "gerangschikt",
      ],
      [FAM_DRIVERS, "Drivers, jouw patroon", "Drivers, de keerzijde", "gerangschikt"],
    ];

    for (const [fam, titelSterk, titelLager, _] of paren) {
      const dim = rangschik(I, resultaat, VOORBEELDAFNAME.antwoorden, fam);
      const alleMetOordeel = dim.gerangschikt.map((r) => r.construct);
      const bladSterk = rapport.paginas.find((p) => p.titel === titelSterk)!;
      const bladLager = rapport.paginas.find((p) => p.titel === titelLager);

      const opSterk = constructenOpPagina(bladSterk.blokken);
      const opLager = bladLager ? constructenOpPagina(bladLager.blokken) : [];
      const samen = [...opSterk, ...opLager];

      // Geen dubbel, geen ontbrekend onderdeel.
      expect(new Set(samen).size, `${fam}: geen onderdeel mag dubbel voorkomen`).toBe(samen.length);
      expect(samen.sort(), `${fam}: elk onderdeel met een oordeel moet in een van de twee hoofdstukken staan`).toEqual(
        [...alleMetOordeel].sort(),
      );
    }
  });

  it("de inleiding bij 'wat sterk aanwezig is' spreekt niet meer van 'de drie'", () => {
    const rapport = rapportVan("verdieping");
    for (const titel of ["Talent-foci, wat sterk aanwezig is", "Talent-versnellers, wat sterk aanwezig is"]) {
      const blad = rapport.paginas.find((p) => p.titel === titel)!;
      const intro = blad.blokken.find((b) => b.soort === "intro") as Extract<T4SBlok, { soort: "intro" }>;
      expect(intro.tekst, `${titel}: intro mag niet meer van "de drie" spreken`).not.toMatch(/de drie\b/i);
    }
  });
});
