import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { buildGeneratorContract, type Responses, type ConnectionAnswers } from "../server/scoring";
import { instrument } from "../server/instrument";

// B1 — Contract-tests die het BEVROREN generator-contract (v1.0.0) vastleggen.
// Doel: als iemand de vorm of versie van het contract per ongeluk wijzigt,
// faalt deze test. We leggen het bestaande gedrag vast, we wijzigen het niet.

const connection: ConnectionAnswers = { q1: 5, q2: 6, q3: 7, q4: 8 };
const responses: Responses = {};

function maakContract(extra?: Partial<Parameters<typeof buildGeneratorContract>[0]>) {
  return buildGeneratorContract({
    respondentCode: "R-001",
    name: "Test Deelnemer",
    company: "TaPasCity",
    role: "Coach",
    consentScope: "profiel-generatie + rapport",
    consentTimestamp: "2026-01-01T00:00:00.000Z",
    responses,
    baseline: 6,
    connection,
    taal: "nl",
    ...extra,
  });
}

describe("generator-contract (bevroren v1.0.0)", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T12:00:00.000Z"));
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("legt versie en instrument-id vast", () => {
    const c = maakContract();
    expect(c.contractVersion).toBe("1.0.0");
    expect(c.instrumentId).toBe(instrument.instrumentId);
  });

  it("bevat de verwachte top-level secties/velden", () => {
    const c = maakContract();
    // "instrumentVersie" is er in ronde C bijgekomen. Het contract blijft
    // contractVersion 1.0.0: het veld is zuiver toegevoegd, geen bestaand veld
    // is van vorm of betekenis veranderd, en oudere contracten zonder dit veld
    // blijven leesbaar. Zie tests/instrument-inhoudsversie.test.ts.
    expect(Object.keys(c).sort()).toEqual(
      [
        "consent",
        "contractVersion",
        "generatedAt",
        "instrumentId",
        "instrumentVersie",
        "participant",
        "sections",
        "taal",
      ].sort(),
    );
  });

  it("legt participant-vorm vast", () => {
    const c = maakContract();
    expect(c.participant).toEqual({
      respondentCode: "R-001",
      name: "Test Deelnemer",
      company: "TaPasCity",
      role: "Coach",
    });
  });

  it("legt consent-vorm vast (given altijd true)", () => {
    const c = maakContract();
    expect(c.consent.given).toBe(true);
    expect(c.consent.scope).toBe("profiel-generatie + rapport");
    expect(c.consent.timestamp).toBe("2026-01-01T00:00:00.000Z");
  });

  it("valt terug op nl en default consent-scope", () => {
    const c = maakContract({ taal: null, consentScope: null, consentTimestamp: null });
    expect(c.taal).toBe("nl");
    expect(c.consent.scope).toBe("profiel-generatie + rapport");
    expect(c.consent.timestamp).toBeNull();
  });

  it("legt sections-vorm vast (main + connection 0-10)", () => {
    const c = maakContract();
    expect(Object.keys(c.sections).sort()).toEqual(["connection", "main"]);
    expect(c.sections.connection.scale).toBe("0-10");
    expect(c.sections.connection.answers).toEqual(connection);
    expect(Object.keys(c.sections.connection.labels).sort()).toEqual(["q1", "q2", "q3", "q4"]);
    expect(c.sections.main.meta).toBeDefined();
    expect(c.sections.main.meta.totalScreens).toBe(instrument.blocks.length);
  });

  it("genereert generatedAt als ISO-tijdstempel", () => {
    const c = maakContract();
    expect(c.generatedAt).toBe("2026-07-16T12:00:00.000Z");
  });
});
