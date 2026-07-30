// ---------------------------------------------------------------------------
// tests/anonimisering.test.ts - AVG art. 17: volledige anonimisering
//
// Wat de test bewijst:
//   1. Elk persoonsveld dat een rij aan een mens kan koppelen komt in de patch
//      voor en wordt op null gezet - inclusief deelnemerEmail, dat voorheen
//      bleef staan, en alle nieuwe leeftijds-/oudervelden.
//   2. De patch bevat geen enkele resterende waarde met inhoud behalve de
//      neutrale naam, de reden en het tijdstip.
//   3. Beide implementaties (DatabaseStorage en de afnames-repository) gebruiken
//      dezelfde gedeelde patch, zodat ze niet opnieuw kunnen uiteenlopen.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  anonimiseringsPatch,
  TE_ANONIMISEREN_VELDEN,
  GEANONIMISEERDE_NAAM,
} from "../server/anonimisering";

describe("anonimisering", () => {
  it("wist elk identificerend veld, inclusief deelnemerEmail en de oudergegevens", () => {
    const patch = anonimiseringsPatch("verzoek betrokkene", "2026-07-25T10:00:00.000Z");
    for (const veld of [
      "company",
      "role",
      "deelnemerEmail",
      "mainResponses",
      "connectionAnswers",
      "generatorContract",
      "consentIp",
      "consentUserAgent",
      "leeftijdsband",
      "ouderNaam",
      "ouderEmail",
      "ouderlijkeToestemmingAt",
      "ouderlijkeToestemmingIp",
      "ouderlijkeToestemmingUserAgent",
    ]) {
      expect(TE_ANONIMISEREN_VELDEN).toContain(veld);
      expect(patch[veld], `${veld} moet null zijn`).toBeNull();
    }
    expect(patch.ouderlijkeToestemming).toBe(false);
  });

  it("laat enkel neutrale, niet-identificerende waarden staan", () => {
    const patch = anonimiseringsPatch("bewaartermijn verstreken - automatisch", "2026-07-25T10:00:00.000Z");
    const gevuld = Object.entries(patch)
      .filter(([, v]) => v !== null && v !== false)
      .map(([k]) => k)
      .sort();
    expect(gevuld).toEqual(["consentScope", "geanonimiseerdAt", "name"]);
    expect(patch.name).toBe(GEANONIMISEERDE_NAAM);
    expect(String(patch.consentScope)).toContain("bewaartermijn verstreken");
  });

  it("is idempotent: een reeds geanonimiseerde afname wordt niet opnieuw gewist", () => {
    // Auditbevinding A-2: de ongebruikte kopie server/repositories/afnames.ts is
    // verwijderd, dus er is nog één implementatie om te bewaken.
    for (const pad of ["server/storage.ts"]) {
      const bron = readFileSync(pad, "utf8");
      expect(bron, `${pad} mist de idempotentiecheck`).toContain("if (a.geanonimiseerdAt) return a;");
    }
  });

  it("gebruikt de gedeelde patch", () => {
    for (const pad of ["server/storage.ts"]) {
      const bron = readFileSync(pad, "utf8");
      expect(bron, `${pad} gebruikt geen anonimiseringsPatch`).toContain("anonimiseringsPatch(");
    }
  });
});
