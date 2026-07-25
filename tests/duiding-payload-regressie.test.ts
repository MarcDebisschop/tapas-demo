// ---------------------------------------------------------------------------
// tests/duiding-payload-regressie.test.ts - de poort mag de duiding niet breken
//
// Wat de test bewijst:
//   1. De payload die de echte code voor een echt contract opbouwt, bevat geen
//      persoonsgegevens en passeert de pseudonimiseringspoort. De guard schakelt
//      de AI-duiding dus niet stil uit (dat zou een stille regressie zijn).
//   2. Zodra er wel een naam in de te herschrijven proza terechtkomt, weigert de
//      poort. De check is dus echt werkzaam en niet altijd-groen.
//
// De echte database wordt niet aangeraakt: server/duiding-manager importeert
// storage, dus mockken we die module.
// ---------------------------------------------------------------------------
import { describe, it, expect, vi } from "vitest";
import Database from "better-sqlite3";

const geheugenDb = new Database(":memory:");
vi.mock("../server/storage", () => ({ sqlite: geheugenDb, db: {}, storage: {} }));

const { buildGeneratorContract } = await import("../server/scoring");
const { bouwRapportInhoud } = await import("../server/rapportgenerator");
const { keurDuidingPayload } = await import("../server/duiding-manager");

function maakContract() {
  return buildGeneratorContract({
    respondentCode: "TDE-2026-001",
    name: "Test Deelnemer",
    company: "TaPasCity",
    role: "Coach",
    consentScope: "profiel-generatie + rapport",
    consentTimestamp: "2026-01-01T00:00:00.000Z",
    responses: {},
    baseline: 6,
    connection: { q1: 5, q2: 6, q3: 7, q4: 8 },
    taal: "nl",
  } as any);
}

describe("AI-payload passeert de pseudonimiseringspoort", () => {
  for (const variant of ["kompas", "coachatlas"] as const) {
    it(`bevat geen persoonsgegevens voor variant ${variant}`, () => {
      const contract = maakContract();
      const inhoud = bouwRapportInhoud(contract, variant);
      const uitkomst = keurDuidingPayload(inhoud, contract);
      expect(uitkomst.redenen).toEqual([]);
      expect(uitkomst.ok).toBe(true);
    });
  }

  it("weigert zodra een naam in de te herschrijven proza staat", () => {
    const contract = maakContract();
    const inhoud = bouwRapportInhoud(contract, "kompas");
    const besmet = {
      ...inhoud,
      secties: inhoud.secties.map((s, i) =>
        i === 0 ? { ...s, paragrafen: [...s.paragrafen, "Dit profiel is van Test Deelnemer."] } : s,
      ),
    };
    const uitkomst = keurDuidingPayload(besmet, contract);
    expect(uitkomst.ok).toBe(false);
  });
});
