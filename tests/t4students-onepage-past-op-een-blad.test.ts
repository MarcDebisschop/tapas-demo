import { describe, it, expect } from "vitest";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { renderT4StudentsRapport } from "../server/t4students/rapport-pdf";
import { T4STUDENTS_INSTRUMENT } from "../server/t4students/instrument";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";

// ---------------------------------------------------------------------------
// Herstelronde 2, vervolg op punt B: de one-page (pagina 4, "Jouw talentmotor
// in één oogopslag") werd met de invoering van de drie groepen (sterk
// aanwezig / middenveld / minder aanwezig) hoger dan een blad. Voor de
// groepeer-wijziging was dit blok al 659 punten (paste toen ook al niet op
// het beschikbare deel van het blad, ~630 punten, na de vaste intro-tekst
// bovenaan pagina 4); de groepskopjes brachten dat naar 873 punten.
//
// Op vraag van de opdrachtgever zijn de groepskopjes compacter gemaakt: één
// regel per kopje (in plaats van kopje + herhaalde kolomkoppen), een kleinere
// letter (7.6pt in plaats van 8.6pt), de kolomkoppen HERKENNING/ENERGIE
// VANDAAG worden nog maar één keer per band getekend in plaats van bij elke
// groep opnieuw, en de marge na elke groep ging van 8 naar 4 punten
// (GROEPKOP_H van 18 naar 12). Dat brengt het blok naar 836 punten.
//
// Dat is nog steeds meer dan de ~630 punten die op een blad beschikbaar zijn.
// Verdere besparing zou moeten komen uit onderdelen die al vóór de
// groepsindeling bestonden (de rijhoogte RIJ_H, die ook op de dimensiebladen
// wordt gebruikt; de bandkop met nummer-cirkel en onderschrift; de marge
// tussen de drie banden) en die vielen buiten de opdracht ("de groepskopjes
// mogen compacter"). Op uitdrukkelijk verzoek van de opdrachtgever wordt hier
// geen tekst weggelaten of overlappend gemaakt om dit toch op één blad te
// persen; de test legt het gemeten, verbeterde maar nog niet volledig
// opgeloste resultaat vast en faalt zodra het cijfer verandert, zodat een
// volgende wijziging dit bewust moet aanraken in plaats van de melding
// stilzwijgend te laten verschuiven.
// ---------------------------------------------------------------------------

describe("de one-page na de compactere groepskopjes (herstelronde 2, punt B vervolg)", () => {
  it("het banden-blok is met de compactere groepskopjes gekrompen van 873 naar 836 punten, maar past nog niet op een blad", () => {
    const resultaat = scoreStudiekompas(T4STUDENTS_INSTRUMENT, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(T4STUDENTS_INSTRUMENT, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: T4STUDENTS_INSTRUMENT.version,
    });
    const { meldingen } = renderT4StudentsRapport(rapport);
    const teHoog = meldingen.filter((m) => m.includes("banden") && m.includes("hoger dan een blad"));
    expect(teHoog).toHaveLength(1);
    expect(teHoog[0]).toContain("836 punten");
    // Geen tekst is weggevallen: het blok komt op een eigen vervolgblad terecht
    // in plaats van afgekapt of overlappend te worden getekend.
    const vervolgMelding = meldingen.find((m) => m.includes("past niet op een blad en loopt door op 1 vervolgblad"));
    expect(vervolgMelding).toBeDefined();
  });

  it("de vaste uitlegzin over de drie groepen staat maar één keer in het naschrift van de one-page", () => {
    const resultaat = scoreStudiekompas(T4STUDENTS_INSTRUMENT, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(T4STUDENTS_INSTRUMENT, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: T4STUDENTS_INSTRUMENT.version,
    });
    const onePagePagina = rapport.paginas.find((p) => p.nr === 4)!;
    const bandenBlok = onePagePagina.blokken.find((b) => b.soort === "banden") as Extract<
      (typeof onePagePagina.blokken)[number],
      { soort: "banden" }
    >;
    const gevonden = bandenBlok.naschrift.filter((r) => r.includes("komen uit de antwoordschaal zelf"));
    expect(gevonden.length).toBeLessThanOrEqual(1);
  });

  it("de groepskopjes zijn compacter: GROEPKOP_H is verlaagd en herhaalt de kolomkoppen niet meer per groep", () => {
    // Regressiebewaking op de renderer-broncode zelf: als iemand GROEPKOP_H
    // per ongeluk weer optrekt naar de oude 18 punten, moet dat opvallen.
    const bron = require("fs").readFileSync(
      require("path").join(__dirname, "..", "server", "t4students", "rapport-pdf.ts"),
      "utf-8",
    );
    const match = bron.match(/const GROEPKOP_H = (\d+);/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeLessThanOrEqual(12);
  });
});
