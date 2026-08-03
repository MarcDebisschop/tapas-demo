import { describe, it, expect } from "vitest";
import { PAGINAPLAN } from "../server/t4students/rapport-contract";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";

// ---------------------------------------------------------------------------
// Opmaakherstel, punt 4: koppen die nog van een rangorde spreken.
//
// AANLEIDING
// De koppen "Talent-foci, jouw drie sterkste" en "Talent-versnellers, jouw
// drie sterkste" spraken van "drie sterkste", terwijl het rapport sinds
// herstelronde 2 geen genummerde rangorde meer toont: elk construct valt in
// een van drie groepen (sterk aanwezig, middenveld, minder aanwezig), en een
// groep kan meer of minder dan drie leden hebben. De kop sprak zichzelf dus
// tegen met wat de bladzijde er onder toont.
//
// WAT DEZE TEST VASTLEGT
// - De twee genoemde koppen zijn letterlijk vervangen door "wat sterk
//   aanwezig is", met dezelfde formulering op beide plaatsen.
// - Nergens in het paginaplan (PAGINAPLAN, dus elke paginatitel) staat nog
//   een kop met "drie sterkste", "rangorde", "plaats" (in de zin van een
//   ordening/ranking) of "top" (in de zin van een ranglijst).
// - Nergens in de ondertitels van het gebouwde rapport (T4SPagina.ondertitel)
//   staat nog zulke taal.
// ---------------------------------------------------------------------------

// Woorden die op een genummerde ordening wijzen. "plaats" en "top" hebben ook
// onschuldige betekenissen (bijvoorbeeld "makkelijker te plaatsen", "top" in
// een e-mailadres); deze test kijkt daarom naar de exacte, letterlijk
// verboden koppen en naar hele woorden "rangorde", "plaats" en "top" in
// koppen/ondertitels, waar zulke onschuldige nevenbetekenissen normaliter niet
// voorkomen.
const VERBODEN_KOP_WOORDEN = [/drie sterkste/i, /rangorde/i, /\bplaats\b/i, /\btop\b/i];

describe("geen koppen of ondertitels die nog van een rangorde, plaats of top spreken", () => {
  it('de kop "Talent-foci, jouw drie sterkste" is vervangen door "Talent-foci, wat sterk aanwezig is"', () => {
    const titel = PAGINAPLAN.find((p) => p.nr === 9)?.titel;
    expect(titel).toBe("Talent-foci, wat sterk aanwezig is");
  });

  it('de kop "Talent-versnellers, jouw drie sterkste" is vervangen door "Talent-versnellers, wat sterk aanwezig is"', () => {
    const titel = PAGINAPLAN.find((p) => p.nr === 12)?.titel;
    expect(titel).toBe("Talent-versnellers, wat sterk aanwezig is");
  });

  it("geen enkele paginatitel in het paginaplan bevat nog rangorde-taal", () => {
    const overtreders = PAGINAPLAN.filter((p) => VERBODEN_KOP_WOORDEN.some((re) => re.test(p.titel)));
    expect(overtreders, JSON.stringify(overtreders)).toHaveLength(0);
  });

  it("geen enkele ondertitel van het gebouwde rapport bevat nog rangorde-taal", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    const overtreders = rapport.paginas.filter((p) => VERBODEN_KOP_WOORDEN.some((re) => re.test(p.ondertitel)));
    expect(overtreders.map((p) => ({ nr: p.nr, ondertitel: p.ondertitel }))).toHaveLength(0);
  });
});
