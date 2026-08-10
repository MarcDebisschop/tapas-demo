// ---------------------------------------------------------------------------
// tests/dashboardkaart-instrumentnaam.test.ts
//
// Wat deze tests vastleggen:
//   1. Op het persoonlijk dashboard staat boven elke afnamekaart de naam van
//      het instrument dat de deelnemer werkelijk invulde. De kaart rendert
//      `{a.instrumentNaam}{a.bedrijf ? ` · ${a.bedrijf}` : ""}`
//      (client/src/pages/dashboard.tsx). Stuurt de server geen instrumentNaam
//      mee, dan blijft daar een losse punt met enkel de bedrijfsnaam staan.
//   2. Die naam komt uit server/registry.ts, dezelfde eenduidige bron die ook
//      de vragenlijst- en rapportroutes gebruiken. Niet uit een vaste tekst.
//   3. Het pad /api/dashboard/:token in server/routes/dashboard.ts levert dat
//      veld. Dat is van belang omdat dit pad tweemaal geregistreerd staat
//      (ook in server/routes-deelnemer.ts) en Express de eerste registratie
//      neemt: die in server/routes/dashboard.ts wint.
//   4. Het instrument wordt uit het bevroren contract gelezen, met terugval op
//      de kolom. In oudere gegevens is die kolom leeg.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDescriptor, getDefaultDescriptor } from "../server/registry";

const dashboardBron = readFileSync(resolve(__dirname, "../server/routes/dashboard.ts"), "utf8");
const routesBron = readFileSync(resolve(__dirname, "../server/routes.ts"), "utf8");
const dashboardTsx = readFileSync(resolve(__dirname, "../client/src/pages/dashboard.tsx"), "utf8");

// Alleen het blok van GET /api/dashboard/:token, zodat de controles niet per
// ongeluk op een naburige route slagen.
function tokenRoute(): string {
  const start = dashboardBron.indexOf('app.get("/api/dashboard/:token"');
  expect(start).toBeGreaterThan(-1);
  const rest = dashboardBron.slice(start + 10);
  const eind = rest.indexOf("app.get(") === -1 ? rest.length : rest.indexOf("app.get(");
  return rest.slice(0, eind);
}

describe("de kaart op het dashboard verwacht een instrumentnaam", () => {
  it("het scherm toont a.instrumentNaam voor de bedrijfsnaam", () => {
    expect(dashboardTsx).toMatch(/\{a\.instrumentNaam\}/);
  });
});

describe("de winnende dashboardroute levert die naam", () => {
  it("de route in server/routes/dashboard.ts wordt als eerste geregistreerd", () => {
    const oud = routesBron.indexOf("registerDashboardRoutes(app)");
    const nieuw = routesBron.indexOf("registerDeelnemerRoutes(app)");
    expect(oud).toBeGreaterThan(-1);
    expect(nieuw).toBeGreaterThan(-1);
    expect(oud).toBeLessThan(nieuw);
  });

  it("de afnamelijst draagt instrumentId en instrumentNaam", () => {
    const route = tokenRoute();
    expect(route).toMatch(/instrumentId: /);
    expect(route).toMatch(/instrumentNaam: /);
  });

  it("haalt de naam uit de registry, niet uit een vaste tekst", () => {
    const route = tokenRoute();
    expect(route).toMatch(/getDescriptor\(/);
    expect(route).toMatch(/getDefaultDescriptor\(\)/);
    expect(route).not.toMatch(/instrumentNaam: "/);
  });

  it("bepaalt het instrument uit het contract, met terugval op de kolom", () => {
    expect(tokenRoute()).toMatch(/instrumentVanAfname\(/);
  });
});

describe("de registry kent de instrumenten die op een kaart kunnen staan", () => {
  it("geeft een leesbare naam voor T4P Business Kompas", () => {
    const d = getDescriptor("t4p-business-kompas");
    expect(d).toBeTruthy();
    expect(String(d?.name ?? "").trim().length).toBeGreaterThan(0);
  });

  it("heeft altijd een terugval met een leesbare naam", () => {
    expect(String(getDefaultDescriptor().name ?? "").trim().length).toBeGreaterThan(0);
  });
});
