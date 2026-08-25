// =============================================================================
// tests/twominscan-teamwiel-credits.test.ts
// -----------------------------------------------------------------------------
// Bewaakt drie dingen die stil kunnen breken en dan geld kosten:
//   1. het tarief van één temperamentenwiel is vier credits, uit één bron;
//   2. dezelfde ploeg geeft dezelfde sleutel (dus geen tweede afboeking bij
//      opnieuw openen of afdrukken in een andere taal), een andere ploeg niet;
//   3. de knop op de instrumentenkaart draagt het tarief, zodat het teamwiel
//      nergens meer als gratis wordt aangeboden.
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  TEAMWIEL_CREDITS_STANDAARD,
  teamwielCredits,
  teamwielCreditsTekst,
} from "../shared/twominscan-teamwiel";
import { teamwielSleutel } from "../server/twominscan/teamwiel-aankoop";
import { INSTRUMENTENGIDS } from "../client/src/data/instrumentengids";

describe("tarief van het temperamentenwiel", () => {
  it("staat op vier credits", () => {
    expect(TEAMWIEL_CREDITS_STANDAARD).toBe(4);
    expect(teamwielCredits({})).toBe(4);
    expect(teamwielCreditsTekst(4)).toBe("4 credits");
    expect(teamwielCreditsTekst(1)).toBe("1 credit");
  });

  it("laat een geldige omgevingswaarde door en negeert onzin", () => {
    expect(teamwielCredits({ TWOMINSCAN_TEAMWIEL_CREDITS: "6" })).toBe(6);
    expect(teamwielCredits({ TWOMINSCAN_TEAMWIEL_CREDITS: "0" })).toBe(4);
    expect(teamwielCredits({ TWOMINSCAN_TEAMWIEL_CREDITS: "-3" })).toBe(4);
    expect(teamwielCredits({ TWOMINSCAN_TEAMWIEL_CREDITS: "gratis" })).toBe(4);
    expect(teamwielCredits({ TWOMINSCAN_TEAMWIEL_CREDITS: "" })).toBe(4);
  });
});

describe("sleutel van een teamwiel", () => {
  const ploeg = [
    { naam: "Ilse Verhoeven", wielpositie: "24-44" },
    { naam: "Bram De Cock", wielpositie: "34-54" },
    { naam: "Naima El Amrani", wielpositie: "26-46" },
  ];

  it("is onafhankelijk van de invoerorde, spaties en hoofdletters", () => {
    const anders = [
      { naam: "naima el amrani", wielpositie: "26-46" },
      { naam: "  Ilse   Verhoeven ", wielpositie: "24-44" },
      { naam: "Bram De Cock", wielpositie: "34-54" },
    ];
    expect(teamwielSleutel(anders)).toBe(teamwielSleutel(ploeg));
  });

  it("verandert wanneer de samenstelling verandert", () => {
    const extra = [...ploeg, { naam: "Tom Peeters", wielpositie: "31-51" }];
    expect(teamwielSleutel(extra)).not.toBe(teamwielSleutel(ploeg));
    const verplaatst = [
      { naam: "Ilse Verhoeven", wielpositie: "25-45" },
      ...ploeg.slice(1),
    ];
    expect(teamwielSleutel(verplaatst)).not.toBe(teamwielSleutel(ploeg));
  });
});

describe("de kaart biedt het teamwiel niet gratis aan", () => {
  it("zet het tarief op de nevenweg van de 2MINSCAN", () => {
    const scan = INSTRUMENTENGIDS.find((i) => i.id === "twominscan");
    expect(scan?.nevenweg?.credits).toBe(TEAMWIEL_CREDITS_STANDAARD);
  });
});
