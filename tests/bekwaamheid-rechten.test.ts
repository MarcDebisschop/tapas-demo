import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  LICENTIESTATUSSEN,
  STATUSSEN_MET_AFNAMERECHT,
  type Licentiestatus,
} from "../server/bekwaamheid/schema";
import {
  POORTSTANDEN,
  type LicentieVoorPoort,
  type Poortstand,
  magAfnemen,
  magBeoordelen,
  poortstandUitOmgeving,
} from "../server/bekwaamheid/rechten";

const INSTRUMENT = "t4p-business";
const PEILDATUM = "2026-08-13";

function licentie(overrides: Partial<LicentieVoorPoort> = {}): LicentieVoorPoort {
  return {
    instrumentId: INSTRUMENT,
    status: "bekrachtigd",
    geldigVan: "2026-01-01",
    geldigTot: "2027-12-31",
    ...overrides,
  };
}

function poort(stand: Poortstand, overrides: Partial<LicentieVoorPoort> | null = {}) {
  return magAfnemen({
    licentie: overrides === null ? null : licentie(overrides),
    instrumentId: INSTRUMENT,
    peildatum: PEILDATUM,
    stand,
  });
}

describe("de drie poortstanden", () => {
  it("kent precies drie standen", () => {
    expect([...POORTSTANDEN]).toEqual(["uit", "log", "handhaaf"]);
  });

  it("staat standaard op log en niet op handhaaf", () => {
    // Een poort die uit zichzelf begint te weigeren, weigert op het moment dat
    // iemand vergeet een omgevingsvariabele te zetten.
    expect(poortstandUitOmgeving({})).toBe("log");
    expect(poortstandUitOmgeving({ BEKWAAMHEID_POORT: undefined })).toBe("log");
    expect(poortstandUitOmgeving({ BEKWAAMHEID_POORT: "onzin" })).toBe("log");
    expect(poortstandUitOmgeving({ BEKWAAMHEID_POORT: "handhaaf" })).toBe("handhaaf");
    expect(poortstandUitOmgeving({ BEKWAAMHEID_POORT: "uit" })).toBe("uit");
  });

  it("laat bij uit en log alles door en weigert alleen bij handhaaf", () => {
    for (const stand of ["uit", "log"] as const) {
      const uitspraak = poort(stand, null);
      expect(uitspraak.toegestaan).toBe(true);
      // De regel is wel gerekend: dat is het punt van een schaduwstand.
      expect(uitspraak.zouWeigeren).toBe(true);
      expect(uitspraak.grond).toBe("geen_licentie");
    }
    const handhaaf = poort("handhaaf", null);
    expect(handhaaf.toegestaan).toBe(false);
    expect(handhaaf.zouWeigeren).toBe(true);
  });

  it("berekent bij elke stand dezelfde grond, zodat de nulmeting klopt", () => {
    const gronden = POORTSTANDEN.map((stand) => poort(stand, { status: "opgeschort" }).grond);
    expect(new Set(gronden).size).toBe(1);
    expect(gronden[0]).toBe("status_zonder_afnamerecht");
  });

  it("geeft bij elke uitspraak een leesbare toelichting", () => {
    for (const stand of POORTSTANDEN) {
      expect(poort(stand, { status: "beeindigd" }).toelichting).toContain("beeindigd");
    }
  });
});

describe("welke statussen door de poort komen", () => {
  it("laat exact de vier statussen met afnamerecht door", () => {
    const doorgelaten = LICENTIESTATUSSEN.filter(
      (status) => !poort("handhaaf", { status }).zouWeigeren,
    );
    expect([...doorgelaten].sort()).toEqual([...STATUSSEN_MET_AFNAMERECHT].sort());
  });

  it("laat een voorwaardelijke licentie door, want een voorwaarde is geen verbod", () => {
    expect(poort("handhaaf", { status: "voorwaardelijk" }).toegestaan).toBe(true);
  });

  it("weigert slapend, opgeschort en beeindigd", () => {
    for (const status of ["slapend", "opgeschort", "beeindigd"] as Licentiestatus[]) {
      expect(poort("handhaaf", { status }).grond).toBe("status_zonder_afnamerecht");
    }
  });
});

describe("geldigheid in de tijd", () => {
  it("weigert voor de begindatum", () => {
    expect(poort("handhaaf", { geldigVan: "2026-08-14" }).grond).toBe("nog_niet_geldig");
  });

  it("laat de begindatum zelf door", () => {
    expect(poort("handhaaf", { geldigVan: PEILDATUM }).toegestaan).toBe(true);
  });

  it("laat de einddatum zelf door en weigert de dag erna", () => {
    expect(poort("handhaaf", { geldigTot: PEILDATUM }).toegestaan).toBe(true);
    expect(poort("handhaaf", { geldigTot: "2026-08-12" }).grond).toBe("verlopen");
  });

  it("laat een lege einddatum nooit verlopen", () => {
    // Dat is uitsluitend de overgangsperiode: wie al jaren werkt, verliest zijn
    // recht niet op de dag dat deze module in productie gaat.
    expect(
      poort("handhaaf", { status: "overgangsperiode", geldigTot: null }).toegestaan,
    ).toBe(true);
  });

  it("weigert een licentie voor een ander instrument", () => {
    const uitspraak = magAfnemen({
      licentie: licentie({ instrumentId: "t4students" }),
      instrumentId: INSTRUMENT,
      peildatum: PEILDATUM,
      stand: "handhaaf",
    });
    expect(uitspraak.grond).toBe("geen_licentie");
  });
});

describe("een alert raakt de poort niet", () => {
  it("noemt het begrip alert nergens in de rechtenlaag", () => {
    // Hard gemaakt op de tekst van het bestand: zolang `alert` er niet in staat,
    // kan een latere wijziging aan de tussentijdse toets de poort niet
    // dichtzetten. Dit is de goedkoopste bewaking die deze belofte kan hebben.
    // Per regel filteren en niet met een blokcommentaarpatroon over het hele
    // bestand: zo'n patroon stopt bij de eerste `*\/` in een gewone string en kan
    // dan echte code wegnemen, waardoor deze wacht stil te ruim wordt.
    const code = readFileSync("server/bekwaamheid/rechten.ts", "utf8")
      .split("\n")
      .filter((regel) => {
        const kaal = regel.trim();
        return !kaal.startsWith("//") && !kaal.startsWith("*") && !kaal.startsWith("/*");
      })
      .join("\n");
    expect(code).not.toMatch(/alert/i);
  });

  it("kent geen weigergrond die met een alert te maken heeft", () => {
    const gronden = LICENTIESTATUSSEN.map((status) => poort("handhaaf", { status }).grond);
    expect(gronden.filter((g) => g !== null && /alert/i.test(g))).toHaveLength(0);
  });
});

describe("wie mag beoordelen", () => {
  const basis = {
    beoordelaarGeaccrediteerdeId: 1,
    beoordeeldeGeaccrediteerdeId: 2,
    isBeoordelaarVlag: true,
    licentieVanBeoordelaar: licentie(),
    instrumentId: INSTRUMENT,
    peildatum: PEILDATUM,
  };

  it("laat een bevoegde beoordelaar toe", () => {
    expect(magBeoordelen(basis).toegestaan).toBe(true);
  });

  it("weigert wie de vlag niet heeft", () => {
    expect(magBeoordelen({ ...basis, isBeoordelaarVlag: false }).toegestaan).toBe(false);
  });

  it("laat niemand zijn eigen ronde beoordelen", () => {
    const uitspraak = magBeoordelen({ ...basis, beoordeeldeGeaccrediteerdeId: 1 });
    expect(uitspraak.toegestaan).toBe(false);
    expect(uitspraak.toelichting).toContain("eigen ronde");
  });

  it("weigert wie zelf geen geldige licentie heeft", () => {
    expect(
      magBeoordelen({ ...basis, licentieVanBeoordelaar: null }).toegestaan,
    ).toBe(false);
    expect(
      magBeoordelen({
        ...basis,
        licentieVanBeoordelaar: licentie({ status: "opgeschort" }),
      }).toegestaan,
    ).toBe(false);
  });

  it("laat de schaduwstand van de poort hier niet doorwerken", () => {
    // Bij `log` mag een deelnemer wél afnemen zonder licentie. Beoordelen is
    // geen productiehandeling maar een bevoegdheid binnen de beoordeling zelf,
    // en die leest altijd streng.
    const oud = process.env.BEKWAAMHEID_POORT;
    process.env.BEKWAAMHEID_POORT = "log";
    try {
      expect(magAfnemen({ licentie: null, instrumentId: INSTRUMENT, peildatum: PEILDATUM })
        .toegestaan).toBe(true);
      expect(magBeoordelen({ ...basis, licentieVanBeoordelaar: null }).toegestaan).toBe(false);
    } finally {
      if (oud === undefined) delete process.env.BEKWAAMHEID_POORT;
      else process.env.BEKWAAMHEID_POORT = oud;
    }
  });
});
