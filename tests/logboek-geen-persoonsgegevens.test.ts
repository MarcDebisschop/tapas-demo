// ---------------------------------------------------------------------------
// tests/logboek-geen-persoonsgegevens.test.ts - Auditbevindingen S-1 en
// versiehygiene.
//
// Wat deze tests bewijzen:
//   1. De verzoeklogger in server/index.ts schrijft GEEN antwoordinhoud meer weg.
//      Voorheen ging elk JSON-antwoord integraal naar het logboek, inclusief
//      namen, e-mailadressen en volledige profielinhoud. Dat is in strijd met de
//      dataminimalisatie (AVG art. 5.1.c) en met het eigen bewaarbeleid, want
//      logboeken vallen buiten de bewaartermijnen en de anonimisering.
//   2. res.json wordt niet meer overschreven om antwoorden af te tappen.
//   3. Het logboek houdt wel de nuttige metadata: methode, pad, statuscode, duur.
//   4. package.json en VERSION.md melden dezelfde versie (de audit stelde
//      2.4.0 tegenover 2.7.0 vast).
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const index = readFileSync(resolve(__dirname, "../server/index.ts"), "utf8");

describe("S-1: geen antwoordinhoud in het logboek", () => {
  it("tapt res.json niet meer af", () => {
    expect(index).not.toContain("capturedJsonResponse");
    expect(index).not.toMatch(/res\.json\s*=\s*function/);
  });

  it("stringify-t geen antwoordinhoud naar de logregel", () => {
    // De logregel mag nergens een antwoordobject serialiseren.
    const loggerStart = index.indexOf("res.on(\"finish\"");
    expect(loggerStart).toBeGreaterThan(-1);
    const logger = index.slice(loggerStart, loggerStart + 600);
    expect(logger).not.toMatch(/JSON\.stringify/);
    expect(logger).not.toMatch(/bodyJson/);
  });

  it("logt wel de metadata die nodig is om te bewaken", () => {
    expect(index).toMatch(/log\(`\$\{req\.method\} \$\{path\} \$\{res\.statusCode\} in \$\{duration\}ms`\)/);
  });
});

describe("Versiehygiene: package.json en VERSION.md lopen niet uiteen", () => {
  it("meldt dezelfde versie in beide bronnen", () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf8"));
    const versieDoc = readFileSync(resolve(__dirname, "../VERSION.md"), "utf8");
    const m = versieDoc.match(/Huidige versie:\s*v?(\d+\.\d+\.\d+)/);
    expect(m, "VERSION.md moet een regel 'Huidige versie: vX.Y.Z' bevatten").not.toBeNull();
    expect(pkg.version).toBe(m![1]);
  });
});
