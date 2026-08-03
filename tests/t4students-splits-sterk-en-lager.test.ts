import { describe, it, expect } from "vitest";
import { splitsSterkEnLager, type T4SDimensie, type T4SRij } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Groepen doortrekken naar de uitgewerkte bladen.
//
// AANLEIDING
// De hoofdstukken "wat sterk aanwezig is" en "wat lager staat" gebruikten
// rijen.slice(0, 3) en rijen.slice(-3): een vast aantal van drie, terwijl de
// rest van het rapport op groepen werkt (groepeerOpAandeel). Bij een groep
// sterk aanwezig met meer of minder dan drie leden ontstond zo een
// tegenspraak: een onderdeel kon op het overzicht bij "sterk aanwezig" staan
// en toch in het hoofdstuk "wat lager staat" belanden.
//
// WAT DEZE TEST VASTLEGT
// splitsSterkEnLager(dim) geeft { sterk, lager } terug, waarbij:
// - sterk exact de rijen van de groep sterk aanwezig bevat, in hun bestaande
//   volgorde, ongeacht of dat er meer of minder dan drie zijn;
// - lager de rijen van middenveld en minder aanwezig samen bevat, in die
//   volgorde;
// - elke rij met een oordeel (een groep) in precies één van de twee lijsten
//   terechtkomt, nooit in beide en nooit in geen van beide;
// - is de groep sterk aanwezig leeg, dan is sterk een lege lijst (het
//   hoofdstuk blijft zelf bestaan met een eigen tekst, dat is aan de
//   aanroeper, niet aan deze functie);
// - is de groep sterk aanwezig zo groot dat ze alle rijen bevat, dan is lager
//   een lege lijst.
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

describe("splitsSterkEnLager verdeelt de rijen van een dimensie volgens groepeerOpAandeel", () => {
  it("een groep sterk aanwezig met vier leden levert alle vier op in sterk, niet slechts drie", () => {
    const dim = dimensie([
      rij("A", "sterk aanwezig", 3),
      rij("B", "sterk aanwezig", 3),
      rij("C", "sterk aanwezig", 2.4),
      rij("D", "sterk aanwezig", 2),
      rij("E", "middenveld", 1.5),
      rij("F", "middenveld", 1),
    ]);
    const { sterk, lager } = splitsSterkEnLager(dim);
    expect(sterk.map((r) => r.construct)).toEqual(["A", "B", "C", "D"]);
    expect(lager.map((r) => r.construct)).toEqual(["E", "F"]);
  });

  it("elke rij met een oordeel komt in precies één van de twee lijsten voor", () => {
    const dim = dimensie([
      rij("A", "sterk aanwezig", 3),
      rij("B", "middenveld", 1.5),
      rij("C", "minder aanwezig", 0.5),
    ]);
    const { sterk, lager } = splitsSterkEnLager(dim);
    const samen = [...sterk, ...lager].map((r) => r.construct);
    expect(new Set(samen).size).toBe(samen.length);
    expect(samen.sort()).toEqual(["A", "B", "C"]);
  });

  it("is de groep sterk aanwezig leeg, dan is sterk leeg en lager bevat alles", () => {
    const dim = dimensie([
      rij("A", "middenveld", 1.5),
      rij("B", "minder aanwezig", 0.5),
    ]);
    const { sterk, lager } = splitsSterkEnLager(dim);
    expect(sterk).toEqual([]);
    expect(lager.map((r) => r.construct)).toEqual(["A", "B"]);
  });

  it("bevat de groep sterk aanwezig alle rijen, dan is lager leeg", () => {
    const dim = dimensie([
      rij("A", "sterk aanwezig", 3),
      rij("B", "sterk aanwezig", 2.5),
    ]);
    const { sterk, lager } = splitsSterkEnLager(dim);
    expect(sterk.map((r) => r.construct)).toEqual(["A", "B"]);
    expect(lager).toEqual([]);
  });

  it("rijen zonder groep (niet ingevuld) komen in geen van beide lijsten terecht", () => {
    // gerangschikt bevat per contract al alleen rijen mét oordeel (zie
    // T4SDimensie.zonderOordeel voor de rest), maar deze test bewijst dat een
    // eventuele rij zonder groep hier niet stiekem wordt meegeteld.
    const dim = dimensie([rij("A", "sterk aanwezig", 3), rij("B", null, 0)]);
    const { sterk, lager } = splitsSterkEnLager(dim);
    const samen = [...sterk, ...lager].map((r) => r.construct);
    expect(samen).toEqual(["A"]);
  });
});
