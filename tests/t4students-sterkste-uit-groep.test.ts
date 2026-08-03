import { describe, it, expect } from "vitest";
import { sterksteUitGroep, type T4SDimensie, type T4SRij } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Herstelronde 2, punt C: de bladen "In één zin" en "Wat je hier zocht"
// benoemen de sterkste onderdelen. Ze putten voortaan uit de groep "sterk
// aanwezig" (op aandeel), niet meer rechtstreeks uit rang 1 van de motor:
//
// - Zijn er meer dan twee constructen met het hoogste aandeel binnen de groep
//   sterk aanwezig, dan worden er twee benoemd en staat erbij hoeveel er even
//   sterk uitkwamen (dezelfde soort zin als bij een gewoon gelijkspel).
// - Is de groep sterk aanwezig leeg, dan valt de keuze terug op het hoogste
//   aandeel uit het middenveld, met een zin erbij dat niets in dit beeld
//   sterk uitkomt en dat dat ook een uitkomst is.
//
// Deze test dekt sterksteUitGroep() rechtstreeks met opgebouwde rijen, omdat
// het voorbeeldprofiel (VOORBEELDAFNAME) toevallig nooit meer dan twee
// gelijke hoogste aandelen heeft en nooit een lege groep sterk aanwezig: dat
// zijn precies de twee gevallen die punt C toevoegt.
// ---------------------------------------------------------------------------

function rij(construct: string, groep: T4SRij["groep"], herkenning: number): T4SRij {
  return {
    construct,
    omschrijving: `omschrijving van ${construct}`,
    rang: null,
    groep,
    herkenning,
    weergavePrecisie: 1,
    energie: null,
    evenSterk: false,
    ingevuld: true,
    leeswoord: "",
    vorm: "geen",
  };
}

function dimensie(rijen: T4SRij[]): T4SDimensie {
  return { familie: "test", kleur: "#000000", rijen, gerangschikt: rijen, zonderOordeel: [] };
}

describe("sterksteUitGroep kiest uit de groep sterk aanwezig, met terugval op middenveld", () => {
  it("kiest het enige construct met het hoogste aandeel als er geen gelijkspel is", () => {
    const dim = dimensie([
      rij("A", "sterk aanwezig", 3),
      rij("B", "sterk aanwezig", 2.4),
      rij("C", "middenveld", 1),
    ]);
    const res = sterksteUitGroep(dim);
    expect(res.constructen.map((r) => r.construct)).toEqual(["A"]);
    expect(res.aantalGelijk).toBe(1);
    expect(res.uitMiddenveld).toBe(false);
  });

  it("benoemt twee constructen en meldt het aantal, wanneer er meer dan twee gelijk op het hoogste aandeel staan", () => {
    const dim = dimensie([
      rij("A", "sterk aanwezig", 3),
      rij("B", "sterk aanwezig", 3),
      rij("C", "sterk aanwezig", 3),
      rij("D", "sterk aanwezig", 2),
    ]);
    const res = sterksteUitGroep(dim);
    expect(res.constructen).toHaveLength(2);
    expect(res.constructen.map((r) => r.construct)).toEqual(["A", "B"]);
    expect(res.aantalGelijk).toBe(3);
    expect(res.uitMiddenveld).toBe(false);
  });

  it("valt terug op het middenveld wanneer de groep sterk aanwezig leeg is, en meldt dat niets sterk uitkomt", () => {
    const dim = dimensie([
      rij("A", "middenveld", 1.8),
      rij("B", "middenveld", 1),
      rij("C", "minder aanwezig", 0.5),
    ]);
    const res = sterksteUitGroep(dim);
    expect(res.constructen.map((r) => r.construct)).toEqual(["A"]);
    expect(res.uitMiddenveld).toBe(true);
  });

  it("geeft een lege lijst terug wanneer geen enkele rij een groep heeft (niets ingevuld)", () => {
    const dim = dimensie([rij("A", null, 0), rij("B", null, 0)]);
    const res = sterksteUitGroep(dim);
    expect(res.constructen).toEqual([]);
    expect(res.uitMiddenveld).toBe(false);
  });

  it("meer dan twee gelijk in het middenveld (na terugval) meldt ook het aantal", () => {
    const dim = dimensie([
      rij("A", "middenveld", 1.5),
      rij("B", "middenveld", 1.5),
      rij("C", "middenveld", 1.5),
      rij("D", "minder aanwezig", 0),
    ]);
    const res = sterksteUitGroep(dim);
    expect(res.constructen).toHaveLength(2);
    expect(res.aantalGelijk).toBe(3);
    expect(res.uitMiddenveld).toBe(true);
  });
});
