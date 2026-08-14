// ---------------------------------------------------------------------------
// tests/bekwaamheid-poort-matrix.test.ts — de isolatiematrix van de poort.
//
// In de stijl van tests/fase8-scope-isolatie-matrix.test.ts: niet per geval een
// eigen test, maar één tabel van omstandigheden waar dezelfde vragen over
// worden gedraaid. Wie een licentiestatus, een afnemerssoort of een handeling
// toevoegt, voegt een regel aan de tabel toe en is meteen volledig getoetst.
//
// De matrix heeft vier assen:
//   1. licentiestatus  — alle zeven uit LICENTIESTATUSSEN
//   2. afnemerssoort   — persoon / organisatie / deelnemer
//   3. handeling       — de vijf uit HANDELINGEN
//   4. poortstand      — uit / log / handhaaf
//
// Twee dekkingscontroles sluiten de blinde vlek van elke matrix af: dat de
// assen volledig zijn (elke status, elke grond, elke handeling komt voor) en dat
// elk instrument uit het register in de platformdeel-afbeelding staat.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { beoordeelPoort, HANDELINGEN, type Afnemer, type Handeling } from "../server/bekwaamheid/poort";
import {
  POORTGRONDEN,
  POORTTEKSTEN,
  WEIGERENDE_GRONDEN,
  NIET_WEIGERENDE_GRONDEN,
  isWeigerendeGrond,
  talenVolledig,
  heeftContactweg,
  contactadres,
  CONTACT_PLAATSHOUDER,
  type Poortgrond,
} from "../server/bekwaamheid/poort-teksten";
import {
  PLATFORMDEEL_VAN_INSTRUMENT,
  bestaandePlatformdeelIds,
  platformdeelVanInstrument,
  toegangsvlagVoorInstrument,
} from "../server/bekwaamheid/poort-platformdelen";
import {
  LICENTIESTATUSSEN,
  STATUSSEN_MET_AFNAMERECHT,
  type Licentiestatus,
} from "../server/bekwaamheid/schema";
import { POORTSTANDEN, type Poortstand } from "../server/bekwaamheid/rechten";
import { TALEN } from "@shared/talen";

const PEILDATUM = "2026-08-13";
const INSTRUMENT = "t4students";

/** Een licentie die op de peildatum in orde is, zodat alleen de status varieert. */
function licentie(status: Licentiestatus) {
  return {
    instrumentId: INSTRUMENT,
    status,
    geldigVan: "2025-01-01",
    geldigTot: "2027-12-31",
  };
}

/** De standaardinvoer: alles in orde, zodat elke test één ding kan bederven. */
function basis(overrides: Partial<Parameters<typeof beoordeelPoort>[0]> = {}) {
  return {
    handeling: "afname_aanmaken" as Handeling,
    afnemer: { soort: "persoon", geaccrediteerdeId: 1 } as Afnemer,
    instrumentId: INSTRUMENT,
    platformdeelToegestaan: true as boolean | null,
    licentie: licentie("bekrachtigd"),
    staatInRegister: true,
    bezwaarLoopt: false,
    peildatum: PEILDATUM,
    stand: "handhaaf" as Poortstand,
    ...overrides,
  };
}

describe("as 1 — licentiestatus bepaalt het afnamerecht", () => {
  for (const status of LICENTIESTATUSSEN) {
    const magAfnemen = STATUSSEN_MET_AFNAMERECHT.includes(status);
    it(`${status}: ${magAfnemen ? "laat door" : "weigert"} bij handhaaf`, () => {
      const u = beoordeelPoort(basis({ licentie: licentie(status) }));
      expect(u.toegestaan).toBe(magAfnemen);
      expect(u.zouWeigeren).toBe(!magAfnemen);
      expect(u.grond).toBe(magAfnemen ? "bevoegd" : "status_zonder_afnamerecht");
    });
  }

  it("de vier statussen met afnamerecht zijn precies die uit het schema", () => {
    const doorgelaten = LICENTIESTATUSSEN.filter(
      (s) => beoordeelPoort(basis({ licentie: licentie(s) })).toegestaan,
    );
    expect([...doorgelaten].sort()).toEqual([...STATUSSEN_MET_AFNAMERECHT].sort());
  });
});

describe("as 2 — de afnemerssoort", () => {
  const gevallen: { afnemer: Afnemer; grond: Poortgrond; weigert: boolean }[] = [
    { afnemer: { soort: "persoon", geaccrediteerdeId: 1 }, grond: "bevoegd", weigert: false },
    { afnemer: { soort: "organisatie", organisatieId: 7 }, grond: "afnemer_niet_herleidbaar", weigert: true },
    { afnemer: { soort: "deelnemer" }, grond: "zelfstart_buiten_licentiekader", weigert: false },
  ];

  for (const g of gevallen) {
    it(`${g.afnemer.soort} → ${g.grond}`, () => {
      const u = beoordeelPoort(basis({ afnemer: g.afnemer }));
      expect(u.grond).toBe(g.grond);
      expect(u.zouWeigeren).toBe(g.weigert);
    });
  }

  it("het zelfstartpad wordt ook geraakt wanneer er niets anders in orde is", () => {
    // Beslissing 1: het zelfstartpad valt buiten het licentiekader. Dan mag geen
    // enkele licentiekwestie er alsnog doorheen breken, ook niet een ontbrekend
    // instrument of een opgeschorte licentie.
    const u = beoordeelPoort(
      basis({
        afnemer: { soort: "deelnemer" },
        licentie: null,
        instrumentId: null,
        staatInRegister: false,
        platformdeelToegestaan: false,
      }),
    );
    expect(u.grond).toBe("zelfstart_buiten_licentiekader");
    expect(u.zouWeigeren).toBe(false);
    expect(u.toegestaan).toBe(true);
  });
});

describe("as 3 — de handeling", () => {
  for (const handeling of HANDELINGEN) {
    const binnen = handeling === "afname_aanmaken" || handeling === "uitnodiging_aanmaken";
    it(`${handeling} valt ${binnen ? "binnen" : "buiten"} de poort`, () => {
      // Een licentie die zeker weigert, zodat de handeling het enige is dat
      // het verschil kan maken.
      const u = beoordeelPoort(basis({ handeling, licentie: licentie("beeindigd") }));
      if (binnen) {
        expect(u.zouWeigeren).toBe(true);
        expect(u.grond).toBe("status_zonder_afnamerecht");
      } else {
        expect(u.zouWeigeren).toBe(false);
        expect(u.grond).toBe("handeling_valt_buiten_de_poort");
        expect(u.toegestaan).toBe(true);
      }
    });
  }
});

describe("as 4 — de poortstand", () => {
  for (const stand of POORTSTANDEN) {
    it(`${stand}: zouWeigeren blijft waar, toegestaan volgt de stand`, () => {
      const u = beoordeelPoort(basis({ stand, licentie: licentie("opgeschort") }));
      // Dit is het hele punt van de schaduwstand: de regel wordt altijd
      // volledig berekend, ook wanneer ze niet bijt.
      expect(u.zouWeigeren).toBe(true);
      expect(u.grond).toBe("status_zonder_afnamerecht");
      expect(u.toegestaan).toBe(stand === "handhaaf" ? false : true);
      expect(u.stand).toBe(stand);
    });
  }

  it("in log en uit wordt nooit iets geweigerd, welke grond ook geldt", () => {
    for (const stand of ["uit", "log"] as Poortstand[]) {
      for (const status of LICENTIESTATUSSEN) {
        expect(beoordeelPoort(basis({ stand, licentie: licentie(status) })).toegestaan).toBe(true);
      }
    }
  });
});

describe("de volledige matrix — geen enkele combinatie valt buiten de regels", () => {
  it("elke combinatie van vier assen geeft een grond en een tekst", () => {
    const afnemers: Afnemer[] = [
      { soort: "persoon", geaccrediteerdeId: 1 },
      { soort: "organisatie", organisatieId: 7 },
      { soort: "deelnemer" },
    ];
    let gevallen = 0;
    for (const status of LICENTIESTATUSSEN) {
      for (const afnemer of afnemers) {
        for (const handeling of HANDELINGEN) {
          for (const stand of POORTSTANDEN) {
            const u = beoordeelPoort(basis({ licentie: licentie(status), afnemer, handeling, stand }));
            gevallen++;
            // Sectie 7.3 punt 4: nooit stil falen. Elke uitkomst heeft een
            // grond en een leesbare tekst, ook de uitkomsten die doorlaten.
            expect(POORTGRONDEN).toContain(u.grond);
            expect(u.tekst.length).toBeGreaterThan(20);
            // toegestaan is bij niet-handhaaf altijd waar; bij handhaaf is het
            // exact de ontkenning van zouWeigeren. Nooit iets ertussenin.
            expect(u.toegestaan).toBe(stand === "handhaaf" ? !u.zouWeigeren : true);
            expect(u.zouWeigeren).toBe(isWeigerendeGrond(u.grond));
          }
        }
      }
    }
    expect(gevallen).toBe(7 * 3 * 5 * 3);
  });
});

describe("de weigergronden buiten de licentie", () => {
  it("een dicht platformdeel weigert, en zegt dat het geen licentiekwestie is", () => {
    const u = beoordeelPoort(basis({ platformdeelToegestaan: false }));
    expect(u.grond).toBe("platformdeel_geblokkeerd");
    expect(u.zouWeigeren).toBe(true);
    expect(u.tekst).toContain("geen licentiekwestie");
  });

  it("een ontbrekend platformdeel weigert niet, maar wordt wel als leemte gemeld", () => {
    const u = beoordeelPoort(basis({ platformdeelToegestaan: null }));
    expect(u.grond).toBe("bevoegd");
    expect(u.zouWeigeren).toBe(false);
    expect(u.platformdeelLeemte).toBe(true);
  });

  it("een ontbrekend instrument wordt niet stil naar de standaard herleid", () => {
    for (const waarde of [null, "", "   "]) {
      const u = beoordeelPoort(basis({ instrumentId: waarde }));
      expect(u.grond).toBe("instrument_onbekend");
      expect(u.zouWeigeren).toBe(true);
    }
  });

  it("wie niet in het register staat, heeft geen licentie om te toetsen", () => {
    const u = beoordeelPoort(basis({ staatInRegister: false }));
    expect(u.grond).toBe("niet_in_register");
    expect(u.zouWeigeren).toBe(true);
  });

  it("geen licentie is een eigen grond, niet dezelfde als een verkeerde status", () => {
    expect(beoordeelPoort(basis({ licentie: null })).grond).toBe("geen_licentie");
  });

  it("een licentie voor een ander instrument geldt niet", () => {
    const u = beoordeelPoort(
      basis({ licentie: { ...licentie("bekrachtigd"), instrumentId: "t4kids" } }),
    );
    expect(u.grond).toBe("geen_licentie");
  });

  it("de datumgrenzen bijten aan beide kanten", () => {
    const nogNiet = beoordeelPoort(
      basis({ licentie: { ...licentie("bekrachtigd"), geldigVan: "2027-01-01" } }),
    );
    expect(nogNiet.grond).toBe("nog_niet_geldig");
    const verlopen = beoordeelPoort(
      basis({ licentie: { ...licentie("bekrachtigd"), geldigTot: "2026-01-01" } }),
    );
    expect(verlopen.grond).toBe("verlopen");
  });

  it("een lege einddatum verloopt nooit — dat is de overgangsperiode", () => {
    const u = beoordeelPoort(
      basis({ licentie: { ...licentie("overgangsperiode"), geldigTot: null } }),
    );
    expect(u.grond).toBe("bevoegd");
  });
});

describe("dekking — de assen zijn volledig", () => {
  it("elke grond uit de lijst is bereikbaar of uitdrukkelijk niet-bereikbaar", () => {
    // Elke weigerende grond moet door minstens één invoer bereikt worden,
    // anders staat er dode tekst in de lijst.
    const bereikt = new Set<Poortgrond>();
    const invoeren = [
      basis(),
      basis({ licentie: null }),
      basis({ licentie: licentie("opgeschort") }),
      basis({ licentie: { ...licentie("bekrachtigd"), geldigVan: "2027-01-01" } }),
      basis({ licentie: { ...licentie("bekrachtigd"), geldigTot: "2026-01-01" } }),
      basis({ platformdeelToegestaan: false }),
      basis({ afnemer: { soort: "organisatie", organisatieId: 1 } }),
      basis({ instrumentId: null }),
      basis({ staatInRegister: false }),
      basis({ afnemer: { soort: "deelnemer" } }),
      basis({ bezwaarLoopt: true }),
      basis({ handeling: "rapport_bekijken" }),
    ];
    for (const inv of invoeren) bereikt.add(beoordeelPoort(inv).grond);
    for (const grond of POORTGRONDEN) {
      expect(bereikt.has(grond), `grond ${grond} is door geen enkele invoer bereikt`).toBe(true);
    }
  });

  it("de twee grondgroepen overlappen niet en dekken samen alles", () => {
    const overlap = WEIGERENDE_GRONDEN.filter((g) =>
      (NIET_WEIGERENDE_GRONDEN as readonly string[]).includes(g),
    );
    expect(overlap).toEqual([]);
    expect(POORTGRONDEN.length).toBe(WEIGERENDE_GRONDEN.length + NIET_WEIGERENDE_GRONDEN.length);
  });

  it("elke grond heeft een tekst in alle vijf platformtalen en een weg vooruit", () => {
    for (const grond of POORTGRONDEN) {
      expect(talenVolledig(grond), `grond ${grond} mist een taal`).toBe(true);
      const u = beoordeelPoort(basis({ instrumentId: null }));
      expect(u.watNu).toHaveProperty("actie");
    }
    expect(TALEN.length).toBe(5);
  });

  it("geen enkele weigering eindigt doodlopend", () => {
    // Sectie 7.2: elke reden krijgt een eigen weg vooruit. Voor een weigering
    // is "geen" geen geldige actie — er moet iets te doen zijn, of een plaats.
    // Getoetst op de teksttabel zelf en niet via basis(), want de gronden
    // maskeren elkaar: de eerste die geldt, wint.
    for (const grond of WEIGERENDE_GRONDEN) {
      const watNu = POORTTEKSTEN[grond].watNu;
      expect(watNu.actie, `grond ${grond} heeft geen handeling`).not.toBe("geen");
      const heeftWeg = watNu.url !== null || heeftContactweg(grond);
      expect(heeftWeg, `grond ${grond} heeft geen plaats en geen contactweg`).toBe(true);
    }
  });

  it("geen enkele tekst draagt een adres in de broncode", () => {
    // Bewaakt door tests/bekwaamheid-geen-namenlijst.test.ts voor de hele
    // module; hier nog eens op de teksten zelf, omdat dit het bestand is waar
    // de verleiding het grootst is.
    for (const grond of POORTGRONDEN) {
      for (const taal of TALEN) {
        expect(POORTTEKSTEN[grond].tekst[taal]).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\./);
      }
    }
  });

  it("de plaatshouder wordt gevuld uit de omgeving, met een leesbare terugval", () => {
    expect(contactadres({ BEKWAAMHEID_CONTACT: "licenties@voorbeeld.be" })).toBe(
      "licenties@voorbeeld.be",
    );
    // Niet gezet, of leeg: geen half adres maar een omschrijving.
    expect(contactadres({})).toBe("de beheerder van je organisatie");
    expect(contactadres({ BEKWAAMHEID_CONTACT: "   " })).toBe("de beheerder van je organisatie");

    const u = beoordeelPoort({ ...basis({ instrumentId: null }), taal: "nl" });
    // De uitkomst mag de plaatshouder nooit rauw doorgeven aan de gebruiker.
    expect(u.tekst).not.toContain(CONTACT_PLAATSHOUDER);
    expect(u.tekst).toContain("de beheerder van je organisatie");
  });
});

describe("dekking — de platformdeel-afbeelding is volledig", () => {
  it("elk instrument uit het register staat in de afbeelding", async () => {
    const { alleInstrumenten } = await import("../server/registry");
    const uitRegister = alleInstrumenten().map((i) => i.instrumentId);
    const ontbreekt = uitRegister.filter((id) => !(id in PLATFORMDEEL_VAN_INSTRUMENT));
    expect(ontbreekt, `niet in de afbeelding: ${ontbreekt.join(", ")}`).toEqual([]);
  });

  it("elk platformdeel in de afbeelding bestaat werkelijk", () => {
    const bestaand = bestaandePlatformdeelIds();
    for (const [instrument, deel] of Object.entries(PLATFORMDEEL_VAN_INSTRUMENT)) {
      if (deel === null) continue;
      expect(bestaand, `${instrument} verwijst naar onbestaand deel ${deel}`).toContain(deel);
    }
  });

  it("van de vier families heeft alleen T4P Business een platformdeel", () => {
    // Dit is een vondst uit de inventarisatie, hier vastgezet zodat ze niet
    // stil verandert. Wordt er ooit een platformdeel voor T4Students gemaakt,
    // dan faalt deze test en is dat de bedoeling: het is een productbeslissing
    // die iemand moet zien.
    expect(platformdeelVanInstrument("t4p-business-kompas")).toBe("kompas");
    expect(platformdeelVanInstrument("t4students")).toBeNull();
    expect(platformdeelVanInstrument("t4teens")).toBeNull();
    expect(platformdeelVanInstrument("t4kids")).toBeNull();
  });

  it("een afwezige toegangsrij betekent niet toegestaan, geen stille terugval", () => {
    expect(toegangsvlagVoorInstrument("t4p-business-kompas", [])).toBe(false);
    expect(
      toegangsvlagVoorInstrument("t4p-business-kompas", [{ platformdeel: "kompas", toegestaan: true }]),
    ).toBe(true);
    expect(
      toegangsvlagVoorInstrument("t4p-business-kompas", [{ platformdeel: "kompas", toegestaan: false }]),
    ).toBe(false);
    // Een instrument zonder platformdeel levert een leemte en geen weigering.
    expect(toegangsvlagVoorInstrument("t4students", [])).toBeNull();
    // Een onbekend instrument-id ook: dat is een programmeerfout en mag geen
    // gebruiker treffen.
    expect(toegangsvlagVoorInstrument("bestaat-niet", [])).toBeNull();
  });
});
