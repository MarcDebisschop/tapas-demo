// ---------------------------------------------------------------------------
// tests/rapport-deelnemer-toegang.test.ts — Punt B (doorloop-herstel).
//
// Wat deze tests bewijzen:
//   1. Er bestaat een route waarmee een deelnemer zijn eigen rapport kan
//      bekijken (/html) en downloaden (/pdf) via het dashboardtoken, zonder
//      een beheerderssessie nodig te hebben. Zonder deze route gaf de
//      "Bekijken"-link op het dashboard altijd 403 (vereisScope), ook voor
//      een rapport dat de deelnemer net zelf via een afgeronde afname kreeg.
//   2. Beide routes controleren eigenaarschap: het rapport moet horen bij een
//      afname van precies de deelnemer achter dat token, anders 404. Zonder
//      die controle zou een geraden rapport-id het profiel van een andere
//      deelnemer lekken.
//   3. Het deelnemersdashboard (dashboard.tsx) linkt effectief naar deze
//      token-routes, niet meer naar de admin-only /api/rapporten/:id/html.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routes = readFileSync(resolve(__dirname, "../server/routes-deelnemer.ts"), "utf8");
const dashboardTsx = readFileSync(resolve(__dirname, "../client/src/pages/dashboard.tsx"), "utf8");

describe("Punt B: deelnemer kan het eigen rapport bereiken via het dashboardtoken", () => {
  it("registreert een /html en een /pdf route onder /api/dashboard/:token/rapport/:rapportId", () => {
    expect(routes).toMatch(/app\.get\(\s*"\/api\/dashboard\/:token\/rapport\/:rapportId\/html"/);
    expect(routes).toMatch(/app\.get\(\s*"\/api\/dashboard\/:token\/rapport\/:rapportId\/pdf"/);
  });

  it("de /html-route controleert eigenaarschap voordat ze de inhoud teruggeeft", () => {
    const start = routes.indexOf('"/api/dashboard/:token/rapport/:rapportId/html"');
    expect(start).toBeGreaterThan(-1);
    const route = routes.slice(start, start + 1800);
    // Moet de deelnemer via het token opzoeken...
    expect(route).toMatch(/getDeelnemerByToken/);
    // ...en verifiëren dat het rapport bij één van diens afnames hoort.
    expect(route).toMatch(/listAfnamesVoorDeelnemer/);
    expect(route).toMatch(/afnames\.some\(\(a\) => a\.id === rapport\.afnameId\)/);
    // Zonder eigenaarschap: 404, niet de inhoud.
    expect(route).toMatch(/if \(!magZien\) return res\.status\(404\)/);
  });

  it("de /pdf-route controleert eveneens eigenaarschap", () => {
    const start = routes.indexOf('"/api/dashboard/:token/rapport/:rapportId/pdf"');
    expect(start).toBeGreaterThan(-1);
    const route = routes.slice(start, start + 1800);
    expect(route).toMatch(/getDeelnemerByToken/);
    expect(route).toMatch(/listAfnamesVoorDeelnemer/);
    expect(route).toMatch(/if \(!magZien\) return res\.status\(404\)/);
  });

  it("het dashboard linkt naar de token-route, niet meer naar de admin-only route", () => {
    expect(dashboardTsx).toMatch(
      /href=\{`\$\{API_BASE\}\/api\/dashboard\/\$\{token\}\/rapport\/\$\{rapport\.id\}\/html`\}/,
    );
    expect(dashboardTsx).toMatch(
      /href=\{`\$\{API_BASE\}\/api\/dashboard\/\$\{token\}\/rapport\/\$\{rapport\.id\}\/pdf`\}/,
    );
    expect(dashboardTsx).not.toMatch(/API_BASE\}\/api\/rapporten\/\$\{rapport\.id\}\/html/);
    expect(dashboardTsx).not.toMatch(/API_BASE\}\/api\/rapporten\/\$\{rapport\.id\}\/pdf/);
  });
});
