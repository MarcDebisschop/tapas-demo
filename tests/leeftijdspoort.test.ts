// ---------------------------------------------------------------------------
// tests/leeftijdspoort.test.ts - AVG art. 8: leeftijdspoort en ouderlijke
// toestemming. Deze test legt het beleid van TaPasCity vast:
//   - andere instrumenten blijven volledig ongewijzigd (geen poort);
//   - T4Kids vereist altijd ouderlijke toestemming;
//   - T4Teens onder 16 vereist ouderlijke bevestiging, 16-17 niet;
//   - een band buiten het bereik van het instrument wordt netjes geweigerd.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import {
  valideerLeeftijdspoort,
  vereistOuderlijkeToestemming,
  toegestaneBandenVoor,
} from "../shared/leeftijd";

const ouder = {
  ouderlijkeToestemming: true,
  ouderNaam: "An Peeters",
  ouderEmail: "an.peeters@example.com",
};

describe("leeftijdspoort", () => {
  it("laat instrumenten zonder minderjarige doelgroep ongemoeid", () => {
    for (const id of ["t4p", "t4sports", "t4students", null, undefined]) {
      const r = valideerLeeftijdspoort({ instrumentId: id });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.band).toBeNull();
        expect(r.ouderlijkeToestemmingVereist).toBe(false);
      }
    }
  });

  it("weigert een afname zonder leeftijdsband bij een minderjarig instrument", () => {
    for (const id of ["t4kids", "t4teens"]) {
      const r = valideerLeeftijdspoort({ instrumentId: id });
      expect(r.ok).toBe(false);
    }
  });

  it("weigert een onbekende leeftijdsband", () => {
    const r = valideerLeeftijdspoort({ instrumentId: "t4teens", leeftijdsband: "42-99" });
    expect(r.ok).toBe(false);
  });

  it("weigert een band die niet bij het instrument past", () => {
    // 18+ hoort niet bij T4Teens, 16-17 niet bij T4Kids.
    expect(valideerLeeftijdspoort({ instrumentId: "t4teens", leeftijdsband: "18+" }).ok).toBe(false);
    expect(valideerLeeftijdspoort({ instrumentId: "t4kids", leeftijdsband: "16-17" }).ok).toBe(false);
    expect(toegestaneBandenVoor("t4kids")).toEqual(["10-12", "13-15"]);
    expect(toegestaneBandenVoor("t4teens")).toEqual(["13-15", "16-17"]);
  });

  it("eist bij T4Kids altijd ouderlijke toestemming, ook boven de BE-drempel van 13", () => {
    expect(vereistOuderlijkeToestemming("t4kids", "10-12")).toBe(true);
    expect(vereistOuderlijkeToestemming("t4kids", "13-15")).toBe(true);
    const zonder = valideerLeeftijdspoort({ instrumentId: "t4kids", leeftijdsband: "13-15" });
    expect(zonder.ok).toBe(false);
    const met = valideerLeeftijdspoort({ instrumentId: "t4kids", leeftijdsband: "13-15", ...ouder });
    expect(met.ok).toBe(true);
    if (met.ok) expect(met.ouderlijkeToestemmingVereist).toBe(true);
  });

  it("eist bij T4Teens onder 16 een ouderlijke bevestiging en laat 16-17 zelfstandig toe", () => {
    expect(vereistOuderlijkeToestemming("t4teens", "13-15")).toBe(true);
    expect(vereistOuderlijkeToestemming("t4teens", "16-17")).toBe(false);
    expect(valideerLeeftijdspoort({ instrumentId: "t4teens", leeftijdsband: "13-15" }).ok).toBe(false);
    const zelfstandig = valideerLeeftijdspoort({ instrumentId: "t4teens", leeftijdsband: "16-17" });
    expect(zelfstandig.ok).toBe(true);
    if (zelfstandig.ok) expect(zelfstandig.ouderlijkeToestemmingVereist).toBe(false);
  });

  it("eist naam en een geldig e-mailadres van de ouder als bewijslast", () => {
    const geenNaam = valideerLeeftijdspoort({
      instrumentId: "t4kids",
      leeftijdsband: "10-12",
      ouderlijkeToestemming: true,
      ouderNaam: "A",
      ouderEmail: "an@example.com",
    });
    expect(geenNaam.ok).toBe(false);
    const slechteMail = valideerLeeftijdspoort({
      instrumentId: "t4kids",
      leeftijdsband: "10-12",
      ouderlijkeToestemming: true,
      ouderNaam: "An Peeters",
      ouderEmail: "an[at]example",
    });
    expect(slechteMail.ok).toBe(false);
  });
});
