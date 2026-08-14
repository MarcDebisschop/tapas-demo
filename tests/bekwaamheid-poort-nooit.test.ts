// ---------------------------------------------------------------------------
// tests/bekwaamheid-poort-nooit.test.ts — de vier beloften van sectie 7.3.
//
// De matrixtest toetst of de poort de juiste dingen doet. Deze suite toetst het
// omgekeerde en het belangrijkere: dat ze vier dingen NOOIT doet. Dat zijn geen
// gevolgen van de regels maar beloften aan de mensen die met het platform
// werken, en een belofte hoort een test te hebben die faalt als iemand haar
// intrekt.
//
//   1. Nooit een lopende afname afbreken.
//   2. Nooit rapporten of historiek blokkeren.
//   3. Nooit weigeren tijdens een lopend bezwaar.
//   4. Nooit stil falen.
//
// Elke belofte wordt getoetst in de zwaarste omstandigheid die er is: een
// beëindigde licentie, geen registerinschrijving, een dicht platformdeel, geen
// instrument, en de poort op handhaaf. Als de belofte dáár houdt, houdt ze
// overal.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import {
  beoordeelPoort,
  HANDELINGEN,
  HANDELINGEN_BINNEN_DE_POORT,
  valtBinnenDePoort,
  type Afnemer,
  type Handeling,
  type PoortInvoer,
} from "../server/bekwaamheid/poort";
import { POORTGRONDEN, isWeigerendeGrond } from "../server/bekwaamheid/poort-teksten";
import { LICENTIESTATUSSEN } from "../server/bekwaamheid/schema";
import { POORTSTANDEN } from "../server/bekwaamheid/rechten";
import { TALEN } from "@shared/talen";

/**
 * De slechtst denkbare omstandigheid.
 *
 * Alles wat mis kan zijn, is mis. Elke belofte hieronder moet hier houden, want
 * een belofte die alleen geldt wanneer het toch al goed gaat, is geen belofte.
 */
function ergstGeval(overrides: Partial<PoortInvoer> = {}): PoortInvoer {
  return {
    handeling: "afname_aanmaken",
    afnemer: { soort: "persoon", geaccrediteerdeId: 1 },
    instrumentId: "t4kids",
    platformdeelToegestaan: false,
    licentie: null,
    staatInRegister: false,
    bezwaarLoopt: false,
    peildatum: "2026-08-13",
    stand: "handhaaf",
    ...overrides,
  };
}

describe("belofte 1 en 2 — een lopende afname en oude dossiers blijven onaangeroerd", () => {
  const buitenDePoort = HANDELINGEN.filter((h) => !HANDELINGEN_BINNEN_DE_POORT.includes(h));

  it("er zijn handelingen buiten de poort, anders toetst deze suite niets", () => {
    expect(buitenDePoort.length).toBeGreaterThan(0);
    expect(buitenDePoort).toContain("afname_voortzetten");
    expect(buitenDePoort).toContain("rapport_bekijken");
    expect(buitenDePoort).toContain("historiek_bekijken");
  });

  for (const handeling of buitenDePoort) {
    it(`${handeling} wordt nooit geweigerd, wat er ook mis is`, () => {
      const u = beoordeelPoort(ergstGeval({ handeling }));
      expect(u.toegestaan).toBe(true);
      expect(u.zouWeigeren).toBe(false);
      expect(u.grond).toBe("handeling_valt_buiten_de_poort");
    });
  }

  it("geen enkele licentiestatus verandert daar iets aan", () => {
    for (const handeling of buitenDePoort) {
      for (const status of LICENTIESTATUSSEN) {
        for (const stand of POORTSTANDEN) {
          const u = beoordeelPoort(
            ergstGeval({
              handeling,
              stand,
              licentie: {
                instrumentId: "t4kids",
                status,
                geldigVan: "2000-01-01",
                geldigTot: "2000-01-02", // lang verlopen
              },
            }),
          );
          expect(u.toegestaan, `${handeling} / ${status} / ${stand}`).toBe(true);
          expect(u.zouWeigeren).toBe(false);
        }
      }
    }
  });

  it("een coachee merkt niets: de afnemerssoort doet er niet toe bij voortzetten", () => {
    const afnemers: Afnemer[] = [
      { soort: "persoon", geaccrediteerdeId: 1 },
      { soort: "organisatie", organisatieId: 3 },
      { soort: "deelnemer" },
    ];
    for (const afnemer of afnemers) {
      const u = beoordeelPoort(ergstGeval({ handeling: "afname_voortzetten", afnemer }));
      expect(u.toegestaan).toBe(true);
    }
  });

  it("alleen aanmaken kan weigeren — de lijst binnen de poort is precies twee", () => {
    expect([...HANDELINGEN_BINNEN_DE_POORT].sort()).toEqual([
      "afname_aanmaken",
      "uitnodiging_aanmaken",
    ]);
    for (const h of HANDELINGEN) {
      expect(valtBinnenDePoort(h)).toBe(HANDELINGEN_BINNEN_DE_POORT.includes(h));
    }
  });
});

describe("belofte 3 — tijdens een lopend bezwaar weigert de poort nooit", () => {
  it("bezwaar houdt de poort open, ook zonder licentie en met een dicht platformdeel", () => {
    const u = beoordeelPoort(ergstGeval({ bezwaarLoopt: true }));
    expect(u.toegestaan).toBe(true);
    expect(u.zouWeigeren).toBe(false);
    expect(u.grond).toBe("bezwaar_loopt");
  });

  it("bezwaar weegt zwaarder dan elke licentiestatus", () => {
    for (const status of LICENTIESTATUSSEN) {
      const u = beoordeelPoort(
        ergstGeval({
          bezwaarLoopt: true,
          licentie: {
            instrumentId: "t4kids",
            status,
            geldigVan: "2000-01-01",
            geldigTot: "2000-01-02",
          },
        }),
      );
      expect(u.grond, `status ${status}`).toBe("bezwaar_loopt");
      expect(u.zouWeigeren).toBe(false);
    }
  });

  it("bezwaar weegt zwaarder dan een dicht platformdeel", () => {
    const u = beoordeelPoort(
      ergstGeval({ bezwaarLoopt: true, platformdeelToegestaan: false, staatInRegister: true }),
    );
    expect(u.grond).toBe("bezwaar_loopt");
  });

  it("bezwaar weegt zwaarder dan een ontbrekend instrument", () => {
    const u = beoordeelPoort(ergstGeval({ bezwaarLoopt: true, instrumentId: null }));
    expect(u.grond).toBe("bezwaar_loopt");
  });

  it("bezwaar weegt zwaarder dan een organisatieaccount zonder persoon", () => {
    const u = beoordeelPoort(
      ergstGeval({ bezwaarLoopt: true, afnemer: { soort: "organisatie", organisatieId: 9 } }),
    );
    expect(u.grond).toBe("bezwaar_loopt");
  });

  it("bezwaar houdt ook bij het aanmaken van een uitnodiging", () => {
    const u = beoordeelPoort(ergstGeval({ bezwaarLoopt: true, handeling: "uitnodiging_aanmaken" }));
    expect(u.toegestaan).toBe(true);
    expect(u.grond).toBe("bezwaar_loopt");
  });

  it("de bezwaartoets staat vóór de statustoets en niet erachter", () => {
    // Zou de bezwaartoets uit de statuslogica volgen in plaats van er vóór te
    // staan, dan zou een opgeschorte licentie mét bezwaar alsnog weigeren.
    // Precies dat is wat het draaiboek belooft dat niet gebeurt.
    const zonder = beoordeelPoort(
      ergstGeval({
        staatInRegister: true,
        platformdeelToegestaan: true,
        licentie: {
          instrumentId: "t4kids",
          status: "opgeschort",
          geldigVan: "2025-01-01",
          geldigTot: "2027-01-01",
        },
      }),
    );
    expect(zonder.zouWeigeren).toBe(true);
    const met = beoordeelPoort(
      ergstGeval({
        bezwaarLoopt: true,
        staatInRegister: true,
        platformdeelToegestaan: true,
        licentie: {
          instrumentId: "t4kids",
          status: "opgeschort",
          geldigVan: "2025-01-01",
          geldigTot: "2027-01-01",
        },
      }),
    );
    expect(met.zouWeigeren).toBe(false);
  });
});

describe("belofte 4 — nooit stil falen", () => {
  it("er is geen enkel pad door de poort dat geen grond teruggeeft", () => {
    // Systematisch: elke combinatie van de vier assen plus de vier vlaggen die
    // los kunnen staan. Elke uitkomst moet een grond, een tekst en een weg
    // hebben. Er bestaat geen lege uitkomst.
    const afnemers: Afnemer[] = [
      { soort: "persoon", geaccrediteerdeId: 1 },
      { soort: "organisatie", organisatieId: 3 },
      { soort: "deelnemer" },
    ];
    let gevallen = 0;
    for (const handeling of HANDELINGEN) {
      for (const afnemer of afnemers) {
        for (const bezwaarLoopt of [true, false]) {
          for (const staatInRegister of [true, false]) {
            for (const platformdeelToegestaan of [true, false, null]) {
              for (const instrumentId of ["t4kids", null]) {
                const u = beoordeelPoort(
                  ergstGeval({
                    handeling,
                    afnemer,
                    bezwaarLoopt,
                    staatInRegister,
                    platformdeelToegestaan,
                    instrumentId,
                  }),
                );
                gevallen++;
                expect(POORTGRONDEN).toContain(u.grond);
                expect(typeof u.tekst).toBe("string");
                expect(u.tekst.trim().length).toBeGreaterThan(20);
                expect(u.watNu).toHaveProperty("actie");
                expect(typeof u.watNu.actie).toBe("string");
                expect(u.watNu.actie.length).toBeGreaterThan(0);
                // De twee velden mogen nooit uit elkaar lopen.
                expect(u.zouWeigeren).toBe(isWeigerendeGrond(u.grond));
              }
            }
          }
        }
      }
    }
    expect(gevallen).toBe(5 * 3 * 2 * 2 * 3 * 2);
  });

  it("de tekst is nooit een generieke melding, in geen enkele taal", () => {
    // De codebasis heeft hier een eigen eis voor: een foutmelding zegt wat er
    // is, niet dat er iets is. Zie tests/foutmelding-zegt-wat-er-is.test.ts.
    const verboden = ["geen toegang", "niet toegestaan", "er ging iets mis", "onbekende fout"];
    for (const taal of TALEN) {
      for (const grond of POORTGRONDEN) {
        const u = beoordeelPoort(ergstGeval({ taal, instrumentId: null }));
        void grond;
        for (const v of verboden) {
          expect(u.tekst.toLowerCase()).not.toBe(v);
        }
      }
    }
  });

  it("elke weigering noemt een grond die geen sanctie suggereert waar er geen is", () => {
    // Twee gronden gaan uitdrukkelijk niet over de kwaliteit van iemands werk.
    // Als de tekst dat niet zegt, leest de betrokkene het als een oordeel.
    const geblokkeerd = beoordeelPoort(
      ergstGeval({ staatInRegister: true, platformdeelToegestaan: false, instrumentId: "t4kids" }),
    );
    expect(geblokkeerd.grond).toBe("platformdeel_geblokkeerd");
    expect(geblokkeerd.tekst.toLowerCase()).toContain("toegangsinstelling");

    const status = beoordeelPoort(
      ergstGeval({
        staatInRegister: true,
        platformdeelToegestaan: true,
        licentie: {
          instrumentId: "t4kids",
          status: "slapend",
          geldigVan: "2025-01-01",
          geldigTot: "2027-01-01",
        },
      }),
    );
    expect(status.grond).toBe("status_zonder_afnamerecht");
    expect(status.tekst.toLowerCase()).toContain("geen oordeel");
  });
});

describe("de stand uit tot en met handhaaf verandert de belofte niet", () => {
  it("de vier beloften houden in alle drie de standen", () => {
    for (const stand of POORTSTANDEN) {
      // 1 en 2
      expect(beoordeelPoort(ergstGeval({ stand, handeling: "afname_voortzetten" })).toegestaan).toBe(
        true,
      );
      expect(beoordeelPoort(ergstGeval({ stand, handeling: "rapport_bekijken" })).toegestaan).toBe(
        true,
      );
      // 3
      expect(beoordeelPoort(ergstGeval({ stand, bezwaarLoopt: true })).toegestaan).toBe(true);
      // 4
      expect(POORTGRONDEN).toContain(beoordeelPoort(ergstGeval({ stand })).grond);
    }
  });
});
