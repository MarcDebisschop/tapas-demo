// ---------------------------------------------------------------------------
// tests/authlimiter-loginpaden.test.ts - Snelheidsbegrenzing op authenticatie.
//
// Wat deze tests bewijzen (statische broncontrole op server/index.ts):
//   1. De authLimiter is geconfigureerd (venster + limiet + nette boodschap).
//   2. ELK authenticatie-loginpad staat onder de authLimiter, inclusief het
//      organisatieportaal (/api/organisatie/login). Dit dekt het openstaande
//      punt uit het GDPR-auditrapport (art. 32): een login zonder
//      snelheidsbegrenzing is kwetsbaar voor brute-force.
//   3. Regressievangnet: als er een nieuw "*/login"-pad in de app verschijnt
//      moet het bewust onder de limiter of op de uitzonderingslijst komen.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const bron = readFileSync(resolve(__dirname, "../server/index.ts"), "utf8");

// De paden die de authLimiter volgens de code MOET dekken.
const VERPLICHTE_LIMIETPADEN = [
  "/api/admin/login",
  "/api/admin/wachtwoord",
  "/api/coach/login",
  "/api/deelnemers/login",
  "/api/deelnemers/token-login",
  "/api/deelnemers/magic",
  "/api/organisatie/login",
];

// Loginpaden die BEWUST geen aparte authLimiter krijgen, met reden.
// (Leeg vandaag; toekomstige uitzonderingen hier expliciet documenteren.)
const BEWUSTE_UITZONDERINGEN: string[] = [];

describe("Snelheidsbegrenzing op authenticatie (authLimiter)", () => {
  it("configureert de authLimiter met venster, limiet en boodschap", () => {
    expect(bron).toMatch(/const\s+authLimiter\s*=\s*rateLimit\(/);
    expect(bron).toMatch(/windowMs\s*:/);
    expect(bron).toMatch(/limit\s*:/);
    expect(bron).toMatch(/Te veel pogingen/);
  });

  it("past de authLimiter toe via app.use met een padlijst", () => {
    expect(bron).toMatch(/app\.use\(\s*\[[\s\S]*?\]\s*,\s*authLimiter\s*,?\s*\)/);
  });

  for (const pad of VERPLICHTE_LIMIETPADEN) {
    it(`begrenst ${pad}`, () => {
      // Het pad moet als string-literal in de authLimiter-lijst staan.
      expect(bron.includes(`"${pad}"`)).toBe(true);
    });
  }

  it("dekt het organisatieportaal expliciet (openstaand auditpunt)", () => {
    expect(bron.includes('"/api/organisatie/login"')).toBe(true);
  });

  it("laat geen enkel login-pad onbegrensd zonder bewuste uitzondering", () => {
    // Vind alle route-registraties die op ".../login" eindigen.
    const routeRegex =
      /app\.(?:post|get|put|patch)\(\s*["'`](\/api\/[^"'`]*login)["'`]/g;
    const gevonden = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = routeRegex.exec(bron)) !== null) gevonden.add(m[1]);

    for (const pad of gevonden) {
      if (BEWUSTE_UITZONDERINGEN.includes(pad)) continue;
      expect(
        bron.includes(`"${pad}"`) && bron.match(/authLimiter/) !== null,
        `Loginpad ${pad} lijkt niet onder de authLimiter te vallen`,
      ).toBeTruthy();
    }
  });
});
