import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Regressietest voor de portaal-crash: het organisatiedashboard las
// `opvolging.rijen`, maar de server levert de opvolgingsrijen onder de naam
// `instrumenten` (zie server/routes/opvolging.ts: `instrumenten: perInstrument`).
// Daardoor was `opvolging.rijen` undefined en crashte `.map()` het volledige
// portaal via de ErrorBoundary. Deze test borgt dat het frontend-veld en het
// server-veld op elkaar blijven aansluiten, zodat dit niet stil terugkeert.

const wortel = resolve(__dirname, "..");
const dashboardBron = readFileSync(
  resolve(wortel, "client/src/pages/organisatie-dashboard.tsx"),
  "utf8",
);
const serverBron = readFileSync(
  resolve(wortel, "server/routes/opvolging.ts"),
  "utf8",
);

describe("organisatiedashboard: opvolgingsveld sluit aan op de server", () => {
  it("de server levert het opvolgingsveld als `instrumenten`", () => {
    // De organisatie-route bouwt haar antwoord met `instrumenten: ...`.
    expect(serverBron).toMatch(/instrumenten:\s*perInstrument/);
  });

  it("het dashboard leest `opvolging.instrumenten`, niet `opvolging.rijen`", () => {
    expect(dashboardBron).toContain("opvolging.instrumenten");
    // Het niet-bestaande veld mag nergens meer gebruikt worden.
    expect(dashboardBron).not.toContain("opvolging.rijen");
  });

  it("de `.map` over de opvolgingsrijen heeft een leeg-vangnet", () => {
    // Bescherm tegen undefined zolang de data nog niet geladen is.
    expect(dashboardBron).toMatch(/opvolging\.instrumenten\s*\?\?\s*\[\]/);
  });
});
