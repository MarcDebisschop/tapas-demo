import { describe, it, expect } from "vitest";
import {
  berekenAfnamekwaliteit,
  leesItemTijden,
  ITEM_TIJDSDREMPEL_MS,
  AANDEEL_DREMPEL,
  MINIMUM_ITEMS_MET_TIJD,
} from "../server/afnamekwaliteit";
import { buildGeneratorContract, type ConnectionAnswers, type Responses } from "../server/scoring";

// ---------------------------------------------------------------------------
// Tijdmeting per item (normentoetsing C07, C08, C20).
// Getoetst worden: de berekening, de gekozen drempels en het gedrag wanneer er
// helemaal geen tijdgegevens zijn (afnames van voor de invoering).
// ---------------------------------------------------------------------------

// Bouwt een set tijden: `snel` items onder de drempel, `traag` items erboven.
function tijden(snel: number, traag: number): Record<string, number> {
  const uit: Record<string, number> = {};
  for (let i = 0; i < snel; i++) uit[`B${i}`] = 900;
  for (let i = 0; i < traag; i++) uit[`T${i}`] = 8000;
  return uit;
}

describe("afnamekwaliteit - de drempels zelf", () => {
  it("hanteert twee seconden per item als ondergrens", () => {
    expect(ITEM_TIJDSDREMPEL_MS).toBe(2000);
  });

  it("meldt pas vanaf meer dan vijftien procent erg snelle items", () => {
    expect(AANDEEL_DREMPEL).toBe(0.15);
  });

  it("vraagt minstens vijf gemeten items voor een melding", () => {
    expect(MINIMUM_ITEMS_MET_TIJD).toBe(5);
  });
});

describe("afnamekwaliteit - berekening van het aandeel", () => {
  it("telt items onder twee seconden en berekent het aandeel", () => {
    const r = berekenAfnamekwaliteit(tijden(3, 7))!;
    expect(r.itemsMetTijd).toBe(10);
    expect(r.itemsOnderDrempel).toBe(3);
    expect(r.aandeelOnderDrempel).toBe(0.3);
  });

  it("telt exact twee seconden niet mee als erg snel (grens ligt eronder)", () => {
    const r = berekenAfnamekwaliteit({ a: 1999, b: 2000, c: 2001, d: 5000, e: 5000 })!;
    expect(r.itemsOnderDrempel).toBe(1);
  });

  it("negeert onmogelijke duren in plaats van te falen", () => {
    const r = berekenAfnamekwaliteit({ a: -50, b: NaN, c: "traag", d: 900, e: 8000 } as any)!;
    expect(r.itemsMetTijd).toBe(2);
    expect(r.itemsOnderDrempel).toBe(1);
  });
});

describe("afnamekwaliteit - wanneer de kwaliteitsmelding aangaat", () => {
  it("geen melding wanneer alle items rustig zijn beantwoord", () => {
    const r = berekenAfnamekwaliteit(tijden(0, 10))!;
    expect(r.vlag).toBe(false);
    expect(r.melding).toBeNull();
  });

  it("geen melding bij precies vijftien procent (de drempel moet overschreden zijn)", () => {
    const r = berekenAfnamekwaliteit(tijden(3, 17))!;
    expect(r.aandeelOnderDrempel).toBe(0.15);
    expect(r.vlag).toBe(false);
  });

  it("wel een melding zodra het aandeel boven vijftien procent uitkomt", () => {
    const r = berekenAfnamekwaliteit(tijden(4, 16))!;
    expect(r.aandeelOnderDrempel).toBe(0.2);
    expect(r.vlag).toBe(true);
    expect(r.melding).toBeTruthy();
  });

  it("vlagt niet bij te weinig gemeten items, maar rapporteert het aandeel wel", () => {
    const r = berekenAfnamekwaliteit({ a: 900, b: 900, c: 8000 })!;
    expect(r.itemsMetTijd).toBe(3);
    expect(r.aandeelOnderDrempel).toBeCloseTo(0.667, 3);
    expect(r.vlag).toBe(false);
    expect(r.melding).toBeNull();
  });

  it("de melding gaat over de afname en velt geen oordeel over de persoon", () => {
    const melding = berekenAfnamekwaliteit(tijden(5, 5))!.melding!;
    expect(melding).toContain("Deze vragenlijst");
    expect(melding).toContain("5 van de 10 items");
    for (const oordeel of ["slordig", "onbetrouwbaar", "niet serieus", "score", "onzorgvuldig"]) {
      expect(melding.toLowerCase()).not.toContain(oordeel);
    }
  });
});

describe("afnamekwaliteit - afnames zonder tijdgegevens (backward compatible)", () => {
  it("geeft null bij ontbrekende tijden", () => {
    expect(berekenAfnamekwaliteit(null)).toBeNull();
    expect(berekenAfnamekwaliteit(undefined)).toBeNull();
  });

  it("geeft null bij een leeg tijdenobject", () => {
    expect(berekenAfnamekwaliteit({})).toBeNull();
  });

  it("geeft null wanneer geen enkele waarde bruikbaar is", () => {
    expect(berekenAfnamekwaliteit({ a: null, b: "onbekend" } as any)).toBeNull();
  });

  it("leest opgeslagen JSON-tekst en valt terug op null bij onleesbare inhoud", () => {
    expect(leesItemTijden('{"B0":1500}')).toEqual({ B0: 1500 });
    expect(leesItemTijden("geen json")).toBeNull();
    expect(leesItemTijden(null)).toBeNull();
    expect(leesItemTijden("")).toBeNull();
  });
});

describe("afnamekwaliteit in het generator-contract", () => {
  const basis = {
    respondentCode: "R-001",
    name: "Test Deelnemer",
    company: null,
    role: null,
    consentScope: null,
    consentTimestamp: null,
    responses: {} as Responses,
    baseline: 6,
    connection: { q1: 5, q2: 5, q3: 5, q4: 5 } as ConnectionAnswers,
    taal: "nl",
  };

  it("een afname zonder tijdgegevens levert geen kwaliteitsmelding en geen fout", () => {
    const c = buildGeneratorContract(basis);
    expect(c.sections.main.meta.afnamekwaliteit).toBeNull();
  });

  it("een afname met tijdgegevens draagt de melding mee in het contract", () => {
    const c = buildGeneratorContract({ ...basis, itemTijden: tijden(4, 16) });
    expect(c.sections.main.meta.afnamekwaliteit?.vlag).toBe(true);
    expect(c.sections.main.meta.afnamekwaliteit?.melding).toBeTruthy();
  });
});
