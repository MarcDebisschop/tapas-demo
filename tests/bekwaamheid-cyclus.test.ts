import { describe, expect, it } from "vitest";
import {
  ACTIVITEITSDREMPEL,
  ACTIVITEITSVENSTER_MAANDEN,
  CYCLUS_MAANDEN,
  OEFENGEMIDDELDE_ONDERGRENS,
  TUSSENTIJDSE_DREMPEL,
  TUSSENTIJDSE_TOETS_MAANDEN,
  TUSSENTIJDS_VENSTER_MAANDEN,
  berekenCyclus,
  telMaandenAf,
  telMaandenOp,
  vensterTot,
} from "../server/bekwaamheid/cyclus";

describe("de termijnen van de licentiecyclus", () => {
  it("houdt de cyclus op twee jaar met een toetsmoment na het eerste", () => {
    expect(CYCLUS_MAANDEN).toBe(24);
    expect(TUSSENTIJDSE_TOETS_MAANDEN).toBe(12);
    expect(TUSSENTIJDSE_TOETS_MAANDEN).toBeLessThan(CYCLUS_MAANDEN);
  });

  it("schaalt de tussentijdse drempel mee met het kortere venster", () => {
    // De volledige cyclus vraagt zes afnames over vierentwintig maanden. Na
    // twaalf maanden hetzelfde aantal eisen zou de drempel verdubbelen zonder
    // dat iemand dat besloten heeft.
    expect(ACTIVITEITSDREMPEL).toBe(6);
    expect(ACTIVITEITSVENSTER_MAANDEN).toBe(24);
    expect(TUSSENTIJDS_VENSTER_MAANDEN).toBe(12);
    expect(TUSSENTIJDSE_DREMPEL).toBe(
      Math.ceil((ACTIVITEITSDREMPEL * TUSSENTIJDS_VENSTER_MAANDEN) / ACTIVITEITSVENSTER_MAANDEN),
    );
    expect(TUSSENTIJDSE_DREMPEL).toBe(3);
  });

  it("houdt de oefenondergrens op de schaal die het platform al gebruikt", () => {
    // bepaalInschaling in server/routes-stm.ts legt de grens tussen
    // onvoldoende en net voldoende op 0,55. Een tweede, eigen grens zou
    // betekenen dat het dashboard en het dossier iemand anders beoordelen.
    expect(OEFENGEMIDDELDE_ONDERGRENS).toBe(55);
  });
});

describe("maandrekenen", () => {
  it("telt maanden op zonder over te lopen naar de verkeerde maand", () => {
    // 31 januari plus één maand is geen 31 februari.
    expect(telMaandenOp("2026-01-31", 1)).toBe("2026-02-28");
    expect(telMaandenOp("2024-01-31", 1)).toBe("2024-02-29");
    expect(telMaandenOp("2026-08-13", 24)).toBe("2028-08-13");
  });

  it("telt maanden af met dezelfde behandeling van maandeinden", () => {
    expect(telMaandenAf("2026-03-31", 1)).toBe("2026-02-28");
    expect(telMaandenAf("2026-08-13", 12)).toBe("2025-08-13");
  });

  it("laat optellen en aftrekken op elkaar aansluiten", () => {
    expect(telMaandenAf(telMaandenOp("2026-08-13", 24), 24)).toBe("2026-08-13");
  });
});

describe("berekenCyclus", () => {
  const cyclus = berekenCyclus("2026-08-13");

  it("zet het toetsmoment op één jaar en het einde op twee jaar", () => {
    expect(cyclus.bekrachtigdOp).toBe("2026-08-13");
    expect(cyclus.tussentijdseToets).toBe("2027-08-13");
    expect(cyclus.geldigTot).toBe("2028-08-13");
  });

  it("laat het tussentijdse venster op de bekrachtiging beginnen", () => {
    const venster = vensterTot(cyclus.tussentijdseToets, TUSSENTIJDS_VENSTER_MAANDEN);
    expect(venster.van).toBe(cyclus.bekrachtigdOp);
    expect(venster.tot).toBe(cyclus.tussentijdseToets);
  });

  it("laat het volledige venster de hele cyclus dekken, zonder gat of overlap", () => {
    const venster = vensterTot(cyclus.geldigTot, ACTIVITEITSVENSTER_MAANDEN);
    expect(venster.van).toBe(cyclus.bekrachtigdOp);
    expect(venster.tot).toBe(cyclus.geldigTot);
  });
});
