// ---------------------------------------------------------------------------
// tests/uitnodigingsontvanger.test.ts - naar wie een uitnodiging mag gaan
//
// AANLEIDING. Het uitnodigingsscherm had geen adresveld: een beheerder maakte een
// link aan en zette die zelf in een bericht. Nu kan het platform de uitnodiging
// zelf versturen, en daarmee wordt de vraag scherp naar wie dat mag. Bij T4Kids en
// T4Teens is dat geen kwestie van gemak: onder de drempel van AVG art. 8 hoort de
// uitnodiging bij een ouder, voogd of begeleider, niet bij het kind zelf. Boven de
// drempel mag de jongere hem wel zelf krijgen; hem dat ontzeggen zou een eigen
// recht wegnemen.
//
// Wat deze toetsen vastleggen:
//   1. Geen adres is in orde zolang er niets verstuurd wordt: de oude weg, een
//      link aanmaken en die zelf doorgeven, blijft volwaardig bestaan.
//   2. Wie wil versturen zonder adres krijgt een fout, niet een stille niet-actie.
//   3. Buiten de instrumenten voor minderjarigen verandert er niets.
//   4. Bij T4Kids en T4Teens moet de leeftijdsgroep bekend zijn voordat er een
//      adres bewaard mag worden, ook zonder verzending.
//   5. Onder de drempel weigert de regel het adres van de jongere zelf.
//   6. Vanaf 16 mag de jongere het adres wel zelf zijn.
//   7. Een leeftijdsgroep die niet bij het instrument hoort, wordt geweigerd.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import {
  valideerUitnodigingsontvanger,
  isVerantwoordelijke,
  ONTVANGERROLLEN,
} from "../shared/uitnodigingsontvanger";

describe("valideerUitnodigingsontvanger", () => {
  it("laat een uitnodiging zonder adres door wanneer er niet verstuurd wordt", () => {
    const r = valideerUitnodigingsontvanger({ instrumentId: "t4p" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.email).toBeNull();
      expect(r.rol).toBeNull();
      expect(r.naarVerantwoordelijke).toBe(false);
    }
  });

  it("weigert versturen zonder adres", () => {
    const r = valideerUitnodigingsontvanger({ instrumentId: "t4p", wilVersturen: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fout).toMatch(/e-mailadres/i);
  });

  it("weigert een adres dat geen adres is", () => {
    const r = valideerUitnodigingsontvanger({ instrumentId: "t4p", email: "herman apenstaartje be" });
    expect(r.ok).toBe(false);
  });

  it("laat bij een instrument voor volwassenen het adres van de deelnemer door", () => {
    const r = valideerUitnodigingsontvanger({
      instrumentId: "t4p",
      email: " Herman@TaPasCity.com ",
      wilVersturen: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.email).toBe("Herman@TaPasCity.com");
      expect(r.rol).toBe("deelnemer");
      expect(r.naarVerantwoordelijke).toBe(false);
    }
  });

  it("vraagt bij T4Teens eerst de leeftijdsgroep, ook zonder verzending", () => {
    const r = valideerUitnodigingsontvanger({ instrumentId: "t4teens", email: "ouder@voorbeeld.be" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fout).toMatch(/leeftijdsgroep/i);
  });

  it("weigert onder de drempel het adres van de jongere zelf", () => {
    const r = valideerUitnodigingsontvanger({
      instrumentId: "t4teens",
      leeftijdsband: "13-15",
      ontvangerRol: "deelnemer",
      email: "jongere@voorbeeld.be",
      wilVersturen: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fout).toMatch(/ouder, voogd of begeleider/i);
  });

  it("aanvaardt onder de drempel het adres van een begeleider", () => {
    const r = valideerUitnodigingsontvanger({
      instrumentId: "t4kids",
      leeftijdsband: "10-12",
      ontvangerRol: "begeleider",
      email: "begeleider@school.be",
      wilVersturen: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.naarVerantwoordelijke).toBe(true);
      expect(r.band).toBe("10-12");
    }
  });

  it("laat een zestienjarige zijn eigen adres houden", () => {
    const r = valideerUitnodigingsontvanger({
      instrumentId: "t4teens",
      leeftijdsband: "16-17",
      ontvangerRol: "deelnemer",
      email: "jongere@voorbeeld.be",
      wilVersturen: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rol).toBe("deelnemer");
      expect(r.naarVerantwoordelijke).toBe(false);
    }
  });

  it("weigert een leeftijdsgroep die niet bij het instrument hoort", () => {
    const r = valideerUitnodigingsontvanger({
      instrumentId: "t4kids",
      leeftijdsband: "18+",
      ontvangerRol: "ouder",
      email: "ouder@voorbeeld.be",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fout).toMatch(/leeftijdsgroep/i);
  });

  it("weigert een rol die niet bestaat", () => {
    const r = valideerUitnodigingsontvanger({
      instrumentId: "t4p",
      ontvangerRol: "grootouder",
      email: "iemand@voorbeeld.be",
    });
    expect(r.ok).toBe(false);
  });
});

describe("de rollen zelf", () => {
  it("rekent enkel ouder, voogd en begeleider als verantwoordelijke", () => {
    expect(isVerantwoordelijke("deelnemer")).toBe(false);
    expect(isVerantwoordelijke("ouder")).toBe(true);
    expect(isVerantwoordelijke("voogd")).toBe(true);
    expect(isVerantwoordelijke("begeleider")).toBe(true);
  });

  it("kent geen andere rollen dan deze vier", () => {
    // Een vijfde rol erbij zetten is geen kleine wijziging: het scherm, de
    // bewaring op de afname en deze regel moeten dan samen mee.
    expect([...ONTVANGERROLLEN]).toEqual(["deelnemer", "ouder", "voogd", "begeleider"]);
  });
});
