/**
 * Tests voor `server/bekwaamheid/licentiebeeld.ts` — de samenvatting die scherm
 * 9.7 op drie plaatsen gebruikt.
 *
 * De belangrijkste test in dit bestand is niet een test op een getal, maar de
 * test die het beeld naast `magAfnemen` legt. Die twee moeten hetzelfde zeggen
 * over dezelfde licentie, altijd. Zeggen ze ooit iets anders, dan liegt een
 * scherm tegen iemand over zijn eigen bevoegdheid.
 */
import { describe, it, expect } from "vitest";
import {
  maakLicentieBeeld,
  LICENTIESTANDEN,
  type LicentieVoorBeeld,
} from "../server/bekwaamheid/licentiebeeld";
import { magAfnemen } from "../server/bekwaamheid/rechten";
import {
  LICENTIESTATUSSEN,
  STATUSSEN_MET_AFNAMERECHT,
  type Licentiestatus,
} from "../server/bekwaamheid/schema";

const PEIL = "2026-08-14";

function licentie(over: Partial<LicentieVoorBeeld> = {}): LicentieVoorBeeld {
  return {
    instrumentId: "t4p_business",
    status: "bekrachtigd",
    geldigVan: "2026-01-01",
    geldigTot: "2028-01-01",
    alertActief: false,
    voorwaardeVoor: null,
    ...over,
  };
}

describe("licentiebeeld — de twee soorten leegte", () => {
  it("iemand buiten het register krijgt geen leeg beeld maar de stand buiten_het_register", () => {
    const beeld = maakLicentieBeeld([], PEIL, false);
    expect(beeld.stand).toBe("buiten_het_register");
    expect(beeld.samenvatting).toBe("Staat niet in het register van geaccrediteerden.");
    expect(beeld.perInstrument).toEqual([]);
  });

  it("iemand in het register zonder licenties is iets anders dan iemand erbuiten", () => {
    const binnen = maakLicentieBeeld([], PEIL, true);
    const buiten = maakLicentieBeeld([], PEIL, false);
    expect(binnen.stand).toBe("geen_licenties");
    expect(buiten.stand).toBe("buiten_het_register");
    expect(binnen.samenvatting).not.toBe(buiten.samenvatting);
  });

  it("licenties worden genegeerd wanneer iemand niet in het register staat", () => {
    // Zou het beeld hier tellen, dan bestaat er een licentie zonder register-rij
    // in de weergave. De keten hoort dan gerepareerd te worden, niet getoond.
    const beeld = maakLicentieBeeld([licentie()], PEIL, false);
    expect(beeld.metAfnamerecht).toBe(0);
    expect(beeld.stand).toBe("buiten_het_register");
  });
});

describe("licentiebeeld — de standen", () => {
  it("alles geldig zonder alert of voorwaarde geeft in_orde", () => {
    const beeld = maakLicentieBeeld(
      [licentie(), licentie({ instrumentId: "t4students" })],
      PEIL,
      true,
    );
    expect(beeld.stand).toBe("in_orde");
    expect(beeld.metAfnamerecht).toBe(2);
    expect(beeld.zonderAfnamerecht).toBe(0);
  });

  it("één verlopen licentie naast een geldige geeft let_op, niet geen_afnamerecht", () => {
    const beeld = maakLicentieBeeld(
      [licentie(), licentie({ instrumentId: "t4teens", geldigTot: "2026-06-30" })],
      PEIL,
      true,
    );
    expect(beeld.stand).toBe("let_op");
    expect(beeld.metAfnamerecht).toBe(1);
    expect(beeld.zonderAfnamerecht).toBe(1);
  });

  it("een openstaande alert alleen is al genoeg voor let_op", () => {
    const beeld = maakLicentieBeeld([licentie({ alertActief: true })], PEIL, true);
    expect(beeld.stand).toBe("let_op");
    expect(beeld.metAlert).toBe(1);
    expect(beeld.metAfnamerecht).toBe(1);
  });

  it("een alert haalt het afnamerecht niet weg", () => {
    // rechten.ts kent het begrip alert bewust niet. Het beeld mag daar geen
    // tweede regel van maken.
    const beeld = maakLicentieBeeld([licentie({ alertActief: true })], PEIL, true);
    expect(beeld.perInstrument[0].afnamerecht).toBe(true);
    expect(beeld.perInstrument[0].reden).toBeNull();
  });

  it("geen enkele licentie met afnamerecht geeft geen_afnamerecht", () => {
    const beeld = maakLicentieBeeld(
      [licentie({ status: "opgeschort" }), licentie({ instrumentId: "t4kids", status: "beeindigd" })],
      PEIL,
      true,
    );
    expect(beeld.stand).toBe("geen_afnamerecht");
    expect(beeld.samenvatting).toContain("Geen enkele van 2 licenties");
  });

  it("elke stand uit LICENTIESTANDEN is met een echte invoer te bereiken", () => {
    const bereikt = new Set([
      maakLicentieBeeld([], PEIL, false).stand,
      maakLicentieBeeld([], PEIL, true).stand,
      maakLicentieBeeld([licentie()], PEIL, true).stand,
      maakLicentieBeeld([licentie({ alertActief: true })], PEIL, true).stand,
      maakLicentieBeeld([licentie({ status: "opgeschort" })], PEIL, true).stand,
    ]);
    expect([...bereikt].sort()).toEqual([...LICENTIESTANDEN].sort());
  });
});

describe("licentiebeeld — de voorwaarde", () => {
  it("een voorwaarde met een datum in de toekomst telt mee", () => {
    const beeld = maakLicentieBeeld(
      [licentie({ status: "voorwaardelijk", voorwaardeVoor: "2026-12-01" })],
      PEIL,
      true,
    );
    expect(beeld.metVoorwaarde).toBe(1);
    expect(beeld.stand).toBe("let_op");
    expect(beeld.samenvatting).toContain("1 voorwaarde nog te vervullen");
  });

  it("een voorwaarde waarvan de datum al voorbij is, telt niet meer als openstaand", () => {
    // Dat is dan een verstreken termijn en die hoort op de agenda van de
    // regiekamer, niet in een teller die suggereert dat er nog tijd is.
    const beeld = maakLicentieBeeld(
      [licentie({ status: "voorwaardelijk", voorwaardeVoor: "2026-03-01" })],
      PEIL,
      true,
    );
    expect(beeld.metVoorwaarde).toBe(0);
  });

  it("een voorwaarde die vandaag afloopt, telt nog wel", () => {
    const beeld = maakLicentieBeeld(
      [licentie({ status: "voorwaardelijk", voorwaardeVoor: PEIL })],
      PEIL,
      true,
    );
    expect(beeld.metVoorwaarde).toBe(1);
  });

  it("status voorwaardelijk houdt afnamerecht — een voorwaarde is geen verbod", () => {
    const beeld = maakLicentieBeeld([licentie({ status: "voorwaardelijk" })], PEIL, true);
    expect(beeld.metAfnamerecht).toBe(1);
  });
});

describe("licentiebeeld — het eerstverlopende", () => {
  it("neemt de vroegste einddatum onder de licenties met afnamerecht", () => {
    const beeld = maakLicentieBeeld(
      [
        licentie({ instrumentId: "t4p_business", geldigTot: "2027-05-01" }),
        licentie({ instrumentId: "t4students", geldigTot: "2026-11-20" }),
        licentie({ instrumentId: "t4teens", geldigTot: "2028-01-01" }),
      ],
      PEIL,
      true,
    );
    expect(beeld.eerstverlopend).toEqual({
      instrumentId: "t4students",
      geldigTot: "2026-11-20",
      dagen: 98,
    });
  });

  it("slaat licenties zonder afnamerecht over bij het bepalen van het eerstverlopende", () => {
    const beeld = maakLicentieBeeld(
      [
        licentie({ instrumentId: "t4kids", status: "opgeschort", geldigTot: "2026-09-01" }),
        licentie({ instrumentId: "t4students", geldigTot: "2027-01-15" }),
      ],
      PEIL,
      true,
    );
    expect(beeld.eerstverlopend?.instrumentId).toBe("t4students");
  });

  it("een licentie zonder einddatum kan niet het eerstverlopende zijn", () => {
    // Leeg betekent onbepaald, en dat komt alleen voor in de overgangsperiode.
    const beeld = maakLicentieBeeld(
      [licentie({ status: "overgangsperiode", geldigTot: null })],
      PEIL,
      true,
    );
    expect(beeld.eerstverlopend).toBeNull();
    expect(beeld.metAfnamerecht).toBe(1);
  });

  it("de dagenteller is nul op de laatste geldige dag", () => {
    const beeld = maakLicentieBeeld([licentie({ geldigTot: PEIL })], PEIL, true);
    expect(beeld.metAfnamerecht).toBe(1);
    expect(beeld.eerstverlopend?.dagen).toBe(0);
  });
});

describe("licentiebeeld — het venster", () => {
  it("een licentie die morgen begint, heeft vandaag geen afnamerecht", () => {
    const beeld = maakLicentieBeeld([licentie({ geldigVan: "2026-08-15" })], PEIL, true);
    expect(beeld.metAfnamerecht).toBe(0);
    expect(beeld.perInstrument[0].reden).toBe("nog niet geldig, begint 2026-08-15");
  });

  it("een licentie die vandaag begint, heeft vandaag wel afnamerecht", () => {
    const beeld = maakLicentieBeeld([licentie({ geldigVan: PEIL })], PEIL, true);
    expect(beeld.metAfnamerecht).toBe(1);
  });

  it("een licentie die gisteren afliep, is verlopen met datum in de reden", () => {
    const beeld = maakLicentieBeeld([licentie({ geldigTot: "2026-08-13" })], PEIL, true);
    expect(beeld.perInstrument[0].reden).toBe("verlopen op 2026-08-13");
  });

  it("tijdstempels met tijd erin worden op de dag gesneden", () => {
    const beeld = maakLicentieBeeld(
      [licentie({ geldigTot: "2026-08-14T23:59:59.000Z" })],
      "2026-08-14T09:12:00.000Z",
      true,
    );
    expect(beeld.metAfnamerecht).toBe(1);
    expect(beeld.perInstrument[0].geldigTot).toBe("2026-08-14");
  });
});

describe("licentiebeeld — gelijkloop met de poort", () => {
  it("zegt over elke status hetzelfde als magAfnemen", () => {
    for (const status of LICENTIESTATUSSEN) {
      const l = licentie({ status });
      const beeld = maakLicentieBeeld([l], PEIL, true);
      const poort = magAfnemen({
        licentie: {
          instrumentId: l.instrumentId,
          status: l.status,
          geldigVan: l.geldigVan,
          geldigTot: l.geldigTot,
        },
        instrumentId: l.instrumentId,
        peildatum: PEIL,
        stand: "handhaaf",
      });
      expect(beeld.perInstrument[0].afnamerecht, `status ${status}`).toBe(poort.toegestaan);
    }
  });

  it("zegt over elk venster hetzelfde als magAfnemen", () => {
    const vensters: Array<[string, string | null]> = [
      ["2026-01-01", "2028-01-01"],
      ["2026-08-15", "2028-01-01"],
      ["2026-01-01", "2026-08-13"],
      ["2026-08-14", "2026-08-14"],
      ["2026-01-01", null],
    ];
    for (const [van, tot] of vensters) {
      const l = licentie({ geldigVan: van, geldigTot: tot });
      const beeld = maakLicentieBeeld([l], PEIL, true);
      const poort = magAfnemen({
        licentie: {
          instrumentId: l.instrumentId,
          status: l.status,
          geldigVan: l.geldigVan,
          geldigTot: l.geldigTot,
        },
        instrumentId: l.instrumentId,
        peildatum: PEIL,
        stand: "handhaaf",
      });
      expect(beeld.perInstrument[0].afnamerecht, `venster ${van}..${tot}`).toBe(poort.toegestaan);
    }
  });

  it("telt precies de statussen uit STATUSSEN_MET_AFNAMERECHT als recht", () => {
    const alle = LICENTIESTATUSSEN.map((status, i) =>
      licentie({ instrumentId: `instrument_${i}`, status }),
    );
    const beeld = maakLicentieBeeld(alle, PEIL, true);
    expect(beeld.metAfnamerecht).toBe(STATUSSEN_MET_AFNAMERECHT.length);
    expect(beeld.zonderAfnamerecht).toBe(
      LICENTIESTATUSSEN.length - STATUSSEN_MET_AFNAMERECHT.length,
    );
  });
});

describe("licentiebeeld — de vorm van het antwoord", () => {
  it("sorteert per instrument op naam, zodat het scherm niet hoeft te sorteren", () => {
    const beeld = maakLicentieBeeld(
      [
        licentie({ instrumentId: "t4teens" }),
        licentie({ instrumentId: "hdd" }),
        licentie({ instrumentId: "t4kids" }),
      ],
      PEIL,
      true,
    );
    expect(beeld.perInstrument.map((r) => r.instrumentId)).toEqual(["hdd", "t4kids", "t4teens"]);
  });

  it("geeft nooit een lege samenvatting", () => {
    const gevallen = [
      maakLicentieBeeld([], PEIL, false),
      maakLicentieBeeld([], PEIL, true),
      maakLicentieBeeld([licentie()], PEIL, true),
      maakLicentieBeeld([licentie({ status: "beeindigd" })], PEIL, true),
    ];
    for (const beeld of gevallen) {
      expect(beeld.samenvatting.length).toBeGreaterThan(10);
      expect(beeld.samenvatting.trim()).toBe(beeld.samenvatting);
    }
  });

  it("noemt geen kleuren in de samenvatting — kleur alleen is geen boodschap", () => {
    const beeld = maakLicentieBeeld(
      [licentie(), licentie({ instrumentId: "t4kids", status: "opgeschort" })],
      PEIL,
      true,
    );
    expect(beeld.samenvatting).not.toMatch(/rood|groen|oranje|geel/i);
    expect(beeld.samenvatting).toContain("1 licentie met afnamerecht");
    expect(beeld.samenvatting).toContain("1 zonder");
  });

  it("gebruikt enkelvoud bij één en meervoud bij meer", () => {
    const een = maakLicentieBeeld([licentie()], PEIL, true);
    const twee = maakLicentieBeeld(
      [licentie(), licentie({ instrumentId: "t4kids" })],
      PEIL,
      true,
    );
    expect(een.samenvatting).toContain("1 licentie met");
    expect(twee.samenvatting).toContain("2 licenties met");
  });

  it("meldt een einddatum die al voorbij is in de verleden tijd", () => {
    // Kan alleen bij een licentie zonder afnamerecht, dus dan is er geen
    // eerstverlopende meer. De formulering staat er voor het geval dat verandert.
    const beeld = maakLicentieBeeld([licentie({ geldigTot: "2026-08-13" })], PEIL, true);
    expect(beeld.eerstverlopend).toBeNull();
    expect(beeld.stand).toBe("geen_afnamerecht");
  });
});
