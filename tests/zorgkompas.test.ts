import { describe, it, expect } from "vitest";
import { detecteerDistress, herkenIntentie, beantwoord, type ProfielFeiten } from "../server/chat-engine";

// D1 — Tests voor de DETERMINISTISCHE zorgkompas-detectielaag (zonder LLM).
// We leggen het bestaande gedrag vast: nood-signalen worden herkend, gevoelige
// thema's krijgen een voorzichtig antwoord zonder AI-diagnose, met warme
// doorverwijzing naar een mens/coach.

// Minimaal, leeg profiel — het existentiële pad gebruikt het profiel niet, maar
// beantwoord() verwacht wel een geldig ProfielFeiten-object.
const leegProfiel: ProfielFeiten = {
  heeftProfiel: false,
  naam: null,
  foci: [],
  versnellers: [],
  drivers: [],
  driversEnergieverlies: [],
  tapasBeeld: null,
  driverTopNet: null,
  driverLabel: "laag",
  energieVragenlijst: 0,
  baseline: 0,
  discrepantie: 0,
  herkenbaarheid: null,
  driverItems: {},
};

describe("detecteerDistress", () => {
  it("herkent een zwaar nood-woord", () => {
    expect(detecteerDistress("ik voel me suicidaal")).toBe(true);
  });

  it("herkent een nood-frase samen met een licht woord", () => {
    expect(detecteerDistress("ik ben uitgeput en kan niet meer")).toBe(true);
  });

  it("herkent twee lichte signaalwoorden samen", () => {
    expect(detecteerDistress("ik voel me eenzaam en verdrietig")).toBe(true);
  });

  it("slaat NIET aan op een neutrale vraag", () => {
    expect(detecteerDistress("wat is een driver?")).toBe(false);
  });

  it("slaat NIET aan op één enkel licht woord", () => {
    expect(detecteerDistress("ik ben een beetje moe vandaag")).toBe(false);
  });

  it("gaat veilig om met lege invoer", () => {
    expect(detecteerDistress("")).toBe(false);
    expect(detecteerDistress(undefined as unknown as string)).toBe(false);
  });
});

describe("herkenIntentie", () => {
  it("classificeert nood-uitingen als existentieel (absolute voorrang)", () => {
    expect(herkenIntentie("ik zie het niet meer zitten")).toBe("existentieel");
  });

  it("laat een nood-uiting niet kapen door een taak-intentie", () => {
    // "wat moet ik doen" zou normaal een taak-intentie zijn, maar distress wint.
    expect(herkenIntentie("ik ben radeloos en uitgeput, wat moet ik doen")).toBe("existentieel");
  });
});

describe("beantwoord — existentieel", () => {
  it("verwijst warm door naar een coach (veiligheid = coach)", () => {
    const { veiligheid } = beantwoord("ik voel me hopeloos en leeg", leegProfiel, "nl");
    expect(veiligheid).toBe("coach");
  });

  it("geeft geen AI-diagnose en benoemt geen oordeel/diagnose", () => {
    const { reply } = beantwoord("ik voel me hopeloos en leeg", leegProfiel, "nl");
    expect(reply.toLowerCase()).toContain("geen oordeel of diagnose");
    expect(reply.toLowerCase()).toContain("coach");
  });

  it("verwijst naar een mens/echt gesprek", () => {
    const { reply } = beantwoord("ik voel me hopeloos en leeg", leegProfiel, "nl");
    expect(reply.toLowerCase()).toContain("mens");
  });

  it("werkt taalbewust (Engels pad)", () => {
    const { reply, veiligheid } = beantwoord("I feel hopeless and empty", leegProfiel, "en");
    expect(veiligheid).toBe("coach");
    expect(reply.toLowerCase()).toContain("diagnosis");
  });
});
