// ---------------------------------------------------------------------------
// Pagina een van het kindrapport toont zes gekleurde tegels met een getal, en
// daaronder een staafgrafiek met dezelfde zes kleuren. Boven allebei staat dat
// ze uit Eiland 1 komen. De tegels en de grafiek moeten dus hetzelfde tellen.
//
// Wat het kind hiervan merkt staat per test in de omschrijving.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { buildT4KidsContract } from "../server/t4kids/scoring";

const deelnemer = { respondentCode: "TEST-002", name: "Test Kind" };

// Het gemeten voorbeeld uit de audit: op Eiland 1 een keer Sociaal-gericht
// kiezen (T4K-I-02 links) en verder niets, en op Eiland 2 de vijf figuren met
// kleur Abstraherend kiezen.
const EILAND1_EEN_KEUZE = { "T4K-I-02": "links" };
const EILAND2_VIJF_ABSTRAHEREND = {
  archetypen: [
    { id: "T4K-A-01" },
    { id: "T4K-A-02" },
    { id: "T4K-A-03" },
    { id: "T4K-A-04" },
    { id: "T4K-A-05" },
  ],
};

function contractVan(responses: Record<string, unknown>, keuzes: any) {
  return buildT4KidsContract({ ...deelnemer, responses, keuzes });
}

function tegelEnStaaf(contract: ReturnType<typeof contractVan>, focus: string) {
  const tegel = contract.sections.rapport.kind.reiskaart.find((r) => r.focus === focus);
  const staaf = contract.sections.rapport.exacteAntwoorden.focusTally.find((f) => f.focus === focus);
  return { tegel: tegel?.keuzes ?? null, staaf: staaf?.keuzes ?? null };
}

describe("T4Kids - de tegels en de grafiek op pagina een tellen hetzelfde", () => {
  it("een kleur die het kind op Eiland 1 nooit koos, staat niet met een getal op de tegel", () => {
    // Wat het kind merkt: het las "Abstraherend 5x" op een tegel en zag twee
    // centimeter lager een grafiek waarin Abstraherend niet voorkwam.
    const contract = contractVan(EILAND1_EEN_KEUZE, EILAND2_VIJF_ABSTRAHEREND);
    const abstraherend = tegelEnStaaf(contract, "Abstraherend");
    expect(abstraherend.tegel).toBe(abstraherend.staaf);
    expect(abstraherend.tegel).toBe(0);
  });

  it("elke kleur telt op de tegel hetzelfde als in de grafiek", () => {
    const contract = contractVan(EILAND1_EEN_KEUZE, EILAND2_VIJF_ABSTRAHEREND);
    for (const rij of contract.sections.rapport.kind.reiskaart) {
      const paar = tegelEnStaaf(contract, rij.focus);
      expect(paar.tegel).toBe(paar.staaf);
    }
  });

  it("een kind dat op Eiland 1 niets koos, krijgt geen zin die zegt dat het vaak koos", () => {
    // Wat het kind merkt: het sloeg Eiland 1 helemaal over, koos alleen
    // figuren, en las toch "Je koos vaak dingen waarbij je ...".
    const contract = contractVan({}, EILAND2_VIJF_ABSTRAHEREND);
    expect(contract.sections.rapport.kind.energieVan).toEqual([]);
    expect(contract.sections.rapport.kind.reiskaart.every((r) => r.keuzes === 0)).toBe(true);
  });

  it("wie wel op Eiland 1 kiest, ziet die keuzes gewoon terug op de tegels", () => {
    const contract = contractVan({ "T4K-I-01": "links", "T4K-I-04": "rechts" }, null);
    const abstraherend = tegelEnStaaf(contract, "Abstraherend");
    expect(abstraherend.tegel).toBe(2);
    expect(abstraherend.staaf).toBe(2);
    expect(contract.sections.rapport.kind.energieVan.length).toBeGreaterThan(0);
  });
});
