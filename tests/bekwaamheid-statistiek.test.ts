/**
 * De F-verdeling, geijkt op scipy.
 *
 * Waarom deze module getest wordt tegen externe getallen en niet tegen zichzelf.
 * De kwantielfunctie is de kern van het betrouwbaarheidsinterval rond de ICC, en
 * dat interval bepaalt of een panel de norm van §13.1 haalt. Een fout van enkele
 * procenten in het derde decimaal is op het scherm onzichtbaar en verandert wel
 * het oordeel. Daarom staan hier waarden uit `scipy.stats.f.ppf` (scipy 1.18.0)
 * met tien decimalen, en niet waarden die deze code zelf heeft voortgebracht.
 *
 * De gebroken vrijheidsgraden in de reeks zijn geen curiositeit: het interval van
 * McGraw & Wong gebruikt een Satterthwaite-benadering, en die levert per definitie
 * een gebroken getal. Kon deze module dat niet, dan was het interval niet te
 * berekenen.
 */
import { describe, it, expect } from "vitest";
import {
  logGamma,
  incompleteBeta,
  fVerdelingKans,
  fKwantiel,
} from "../server/bekwaamheid/statistiek";

/** `scipy.stats.f.ppf(p, d1, d2)` uit scipy 1.18.0. */
const KWANTIELEN: ReadonlyArray<[number, number, number, number]> = [
  [0.975, 5, 10, 4.2360856682],
  [0.975, 10, 5, 6.6191543314],
  [0.95, 3, 7, 4.3468313999],
  [0.975, 5, 3.5, 11.3997695668],
  [0.995, 2, 2, 199.0],
  [0.975, 1, 1, 647.7890114778],
];

describe("het kwantiel van de F-verdeling", () => {
  it("komt op zes decimalen overeen met scipy", () => {
    for (const [p, d1, d2, verwacht] of KWANTIELEN) {
      expect(fKwantiel(p, d1, d2)).toBeCloseTo(verwacht, 6);
    }
  });

  it("werkt met gebroken vrijheidsgraden", () => {
    // Zonder dit is het interval van McGraw & Wong niet te berekenen: de
    // Satterthwaite-benadering geeft altijd een gebroken noemer.
    expect(fKwantiel(0.975, 5, 3.5)).toBeCloseTo(11.3997695668, 6);
    expect(fKwantiel(0.975, 4.785144, 5)).toBeGreaterThan(0);
  });

  it("is de omgekeerde van de kansfunctie", () => {
    // De sterkste interne controle: wie het kwantiel terug door de kansfunctie
    // haalt, hoort de oorspronkelijke kans terug te krijgen. Dat toetst beide
    // functies tegen elkaar zonder een externe tabel.
    for (const p of [0.05, 0.5, 0.9, 0.975, 0.999]) {
      for (const [d1, d2] of [
        [3, 7],
        [5, 10],
        [12, 4],
        [2.5, 6.25],
      ]) {
        expect(fVerdelingKans(fKwantiel(p, d1, d2), d1, d2)).toBeCloseTo(p, 8);
      }
    }
  });

  it("loopt op met de kans", () => {
    let vorig = 0;
    for (const p of [0.01, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99]) {
      const nu = fKwantiel(p, 4, 9);
      expect(nu).toBeGreaterThan(vorig);
      vorig = nu;
    }
  });

  it("weigert kansen op of buiten de randen", () => {
    // Bij kans nul en kans één liggen de kwantielen op nul en op oneindig. Die
    // uitersten stil teruggeven zou in het interval van McGraw & Wong een
    // grenswaarde opleveren die als getal leest maar geen betekenis heeft.
    // Daarom weigert de functie ze allebei.
    for (const p of [0, 1, -0.1, 1.5]) {
      expect(() => fKwantiel(p, 4, 9)).toThrow(/kans tussen 0 en 1/);
    }
  });

  it("weigert vrijheidsgraden van nul of lager", () => {
    // Een F-verdeling met nul vrijheidsgraden bestaat niet. Stil een getal
    // teruggeven zou hier een onzichtbaar verkeerd interval opleveren.
    expect(() => fKwantiel(0.975, 0, 5)).toThrow();
    expect(() => fKwantiel(0.975, 5, 0)).toThrow();
    expect(() => fKwantiel(0.975, 5, -1)).toThrow();
  });
});

describe("de kansfunctie van de F-verdeling", () => {
  it("geeft nul op en onder nul", () => {
    expect(fVerdelingKans(0, 4, 9)).toBe(0);
    expect(fVerdelingKans(-3, 4, 9)).toBe(0);
  });

  it("nadert één bij grote waarden", () => {
    expect(fVerdelingKans(1e6, 4, 9)).toBeGreaterThan(0.999999);
  });

  it("geeft bij gelijke vrijheidsgraden precies een halve kans op x = 1", () => {
    // Een eigenschap van de F-verdeling: bij d1 = d2 is de mediaan exact 1,
    // omdat de verdeling dan symmetrisch is onder omkering van teller en noemer.
    for (const d of [1, 2, 5, 20, 7.5]) {
      expect(fVerdelingKans(1, d, d)).toBeCloseTo(0.5, 10);
    }
  });
});

describe("de hulpfuncties", () => {
  it("reproduceert de logaritme van de gammafunctie op bekende punten", () => {
    // Gamma(1) = 1 en Gamma(5) = 24, dus de logaritmen zijn 0 en ln(24).
    expect(logGamma(1)).toBeCloseTo(0, 10);
    expect(logGamma(5)).toBeCloseTo(Math.log(24), 10);
    // Gamma(1/2) = wortel pi.
    expect(logGamma(0.5)).toBeCloseTo(Math.log(Math.sqrt(Math.PI)), 10);
  });

  it("geeft de onvolledige betafunctie op de randen exact", () => {
    expect(incompleteBeta(3, 4, 0)).toBe(0);
    expect(incompleteBeta(3, 4, 1)).toBe(1);
  });

  it("voldoet aan de spiegelregel van de onvolledige betafunctie", () => {
    // I_x(a,b) = 1 − I_{1−x}(b,a). Een identiteit, dus elke afwijking is een
    // rekenfout in de kettingbreuk en niet een kwestie van precisie.
    for (const [a, b, x] of [
      [3, 4, 0.3],
      [0.5, 2.5, 0.8],
      [10, 1, 0.05],
      [2.25, 6.75, 0.5],
    ]) {
      expect(incompleteBeta(a, b, x)).toBeCloseTo(1 - incompleteBeta(b, a, 1 - x), 10);
    }
  });
});
