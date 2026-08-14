import { describe, expect, it } from "vitest";
import {
  OEFENGEMIDDELDE_ONDERGRENS,
  TUSSENTIJDSE_DREMPEL,
} from "../server/bekwaamheid/cyclus";
import {
  SIGNAALNAMEN,
  bepaalUitkomst,
  berekenTussentijdseToets,
  vraagtCoachingsplan,
} from "../server/bekwaamheid/tussentijdse-toets";

/** Waarden waarbij geen enkel signaal aanslaat. */
const RUIM_VOLDOENDE = {
  peildatum: "2027-08-13",
  afnamesAantal: TUSSENTIJDSE_DREMPEL + 4,
  stmSessies: 3,
  stmGemiddelde: 80,
};

describe("de twee signalen van de tussentijdse toets", () => {
  it("kent precies twee signalen, en een coachingsplan is er geen van", () => {
    // Een coachingsplan is het gevolg van een alert. Zou het zelf meetellen als
    // signaal, dan zou wie een plan heeft daardoor sneller opnieuw een alert
    // krijgen — en dat straft precies het gedrag dat de bedoeling was.
    expect([...SIGNAALNAMEN]).toEqual(["afnames_onder_drempel", "oefening_zwak_of_afwezig"]);
    expect(SIGNAALNAMEN).toHaveLength(2);
  });

  it("slaat aan op te weinig afnames en noemt de waarde en de grens", () => {
    const toets = berekenTussentijdseToets({
      ...RUIM_VOLDOENDE,
      afnamesAantal: TUSSENTIJDSE_DREMPEL - 1,
    });
    expect(toets.signalen.map((s) => s.naam)).toEqual(["afnames_onder_drempel"]);
    expect(toets.signalen[0].gelezenWaarde).toBe(TUSSENTIJDSE_DREMPEL - 1);
    expect(toets.signalen[0].grens).toBe(TUSSENTIJDSE_DREMPEL);
  });

  it("slaat niet aan op precies de drempel", () => {
    const toets = berekenTussentijdseToets({
      ...RUIM_VOLDOENDE,
      afnamesAantal: TUSSENTIJDSE_DREMPEL,
    });
    expect(toets.signalen).toHaveLength(0);
    expect(toets.uitkomst).toBe("geen_signaal");
  });

  it("slaat aan op nul oefensessies", () => {
    const toets = berekenTussentijdseToets({
      ...RUIM_VOLDOENDE,
      stmSessies: 0,
      stmGemiddelde: null,
    });
    expect(toets.signalen.map((s) => s.naam)).toEqual(["oefening_zwak_of_afwezig"]);
  });

  it("slaat aan op een gemiddelde onder de ondergrens", () => {
    const toets = berekenTussentijdseToets({
      ...RUIM_VOLDOENDE,
      stmGemiddelde: OEFENGEMIDDELDE_ONDERGRENS - 1,
    });
    expect(toets.signalen.map((s) => s.naam)).toEqual(["oefening_zwak_of_afwezig"]);
  });

  it("slaat niet aan op precies de ondergrens", () => {
    const toets = berekenTussentijdseToets({
      ...RUIM_VOLDOENDE,
      stmGemiddelde: OEFENGEMIDDELDE_ONDERGRENS,
    });
    expect(toets.signalen).toHaveLength(0);
  });
});

describe("de uitkomst volgt uit het aantal signalen", () => {
  const signaal = (naam: (typeof SIGNAALNAMEN)[number]) => ({
    naam,
    gelezenWaarde: 0,
    grens: 1,
    toelichting: "proef",
  });

  it("geeft geen_signaal bij nul", () => {
    expect(bepaalUitkomst([]).uitkomst).toBe("geen_signaal");
  });

  it("geeft nooit meer dan een aandachtspunt bij één signaal", () => {
    for (const naam of SIGNAALNAMEN) {
      expect(bepaalUitkomst([signaal(naam)]).uitkomst).toBe("aandachtspunt");
    }
  });

  it("geeft een alert bij twee signalen", () => {
    expect(
      bepaalUitkomst([signaal("afnames_onder_drempel"), signaal("oefening_zwak_of_afwezig")])
        .uitkomst,
    ).toBe("alert");
  });

  it("noteert bij elke uitkomst welke regel bindend was", () => {
    // Zonder deze regel in het dossier is een uitkomst niet uit te leggen aan de
    // persoon over wie ze gaat, en dan is ze niet te weerleggen.
    expect(bepaalUitkomst([]).bindendeRegel).toBeTruthy();
    expect(bepaalUitkomst([signaal("afnames_onder_drempel")]).bindendeRegel).toContain(
      "afnames_onder_drempel",
    );
  });

  it("verplicht een coachingsplan alleen bij een alert", () => {
    expect(vraagtCoachingsplan("alert")).toBe(true);
    expect(vraagtCoachingsplan("aandachtspunt")).toBe(false);
    expect(vraagtCoachingsplan("geen_signaal")).toBe(false);
  });
});

describe("wat de toets vastlegt", () => {
  it("legt het venster en de gelezen waarden vast, niet alleen de uitkomst", () => {
    const toets = berekenTussentijdseToets({
      ...RUIM_VOLDOENDE,
      afnamesAantal: 1,
      stmSessies: 0,
      stmGemiddelde: null,
    });
    expect(toets.uitkomst).toBe("alert");
    expect(toets.vensterVan).toBe("2026-08-13");
    expect(toets.vensterTot).toBe("2027-08-13");
    expect(toets.afnamesAantal).toBe(1);
    expect(toets.afnamesDrempel).toBe(TUSSENTIJDSE_DREMPEL);
    expect(toets.stmSessies).toBe(0);
    expect(toets.stmGemiddelde).toBeNull();
  });

  it("houdt een leeg oefengemiddelde leeg en maakt er geen nul van", () => {
    // Nul zou een score suggereren die niemand heeft gehaald.
    const toets = berekenTussentijdseToets({
      ...RUIM_VOLDOENDE,
      stmSessies: 0,
      stmGemiddelde: null,
    });
    expect(toets.stmGemiddelde).toBeNull();
    expect(toets.stmGemiddelde).not.toBe(0);
  });
});
