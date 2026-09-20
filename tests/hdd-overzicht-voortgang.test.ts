// ---------------------------------------------------------------------------
// tests/hdd-overzicht-voortgang.test.ts
//
// Twee gaten die samen hetzelfde probleem gaven: een beheerder kon een traject
// niet opvolgen vanaf het beheerscherm. De weg naar de trajecten stond nergens
// in het beheerscherm, dus moest hij het adres uit het hoofd kennen. En het
// trajectoverzicht toonde enkel een status, dus moest hij elk traject openen om
// te zien wie al invulde.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const admin = readFileSync(resolve(__dirname, "../client/src/pages/admin.tsx"), "utf8");
const home = readFileSync(resolve(__dirname, "../client/src/pages/hdd-home.tsx"), "utf8");
const routes = readFileSync(resolve(__dirname, "../server/hdd/routes.ts"), "utf8");

describe("het beheerscherm wijst naar de trajecten", () => {
  it("draagt een link naar het trajectoverzicht", () => {
    expect(admin).toMatch(/href="\/hdd"/);
    expect(admin).toMatch(/data-testid="link-hdd-trajecten"/);
    expect(admin).toMatch(/Human Due Diligence-trajecten/);
    // De kolom Organisatie noemt het feit en niet een formulierfout.
    expect(admin).toMatch(/a\.company \|\| "geen organisatie"/);
  });
});

describe("het trajectoverzicht draagt de voortgang mee", () => {
  it("de lijstroute telt per instrument hoeveel leden afwerkten", () => {
    const start = routes.indexOf('app.get("/api/hdd/trajecten"');
    const blok = routes.slice(start, routes.indexOf('app.post("/api/hdd/trajecten"'));
    expect(blok).toMatch(/leesVoortgang\(traject, leden\)/);
    expect(blok).toMatch(/"tapas-teamscan": ingevuld\("tapas-teamscan"\)/);
    expect(blok).toMatch(/twominscan: ingevuld\("twominscan"\)/);
    expect(blok).toMatch(/"t4p-business-kompas": ingevuld\("t4p-business-kompas"\)/);
    expect(blok).toMatch(/aantalLeden/);
  });

  it("een traject waarvan de voortgang niet leesbaar is, blijft in de lijst staan", () => {
    const start = routes.indexOf('app.get("/api/hdd/trajecten"');
    const blok = routes.slice(start, routes.indexOf('app.post("/api/hdd/trajecten"'));
    expect(blok).toMatch(/let totalen: Record<string, number> \| null = null;/);
    expect(blok).toMatch(/catch \(err\) \{/);
    // De lijst wordt na de catch altijd aangevuld, dus geen res.status(500) hier.
    expect(blok).not.toMatch(/res\.status\(500\)/);
    expect(blok).toMatch(/uit\.push\(\{ \.\.\.traject, aantalLeden, totalen \}\)/);
  });

  it("het overzicht zet de voortgang in één regel per traject", () => {
    expect(home).toMatch(/function voortgangsregel\(tr: Traject\): string/);
    expect(home).toMatch(/data-testid=\{`voortgang-traject-\$\{tr\.id\}`\}/);
    expect(home).toMatch(/ingevuld: Teamscan \$\{deel\(t\["tapas-teamscan"\]\)\}/);
    expect(home).toMatch(/2MINSCAN \$\{deel\(t\.twominscan\)\}/);
    expect(home).toMatch(/Kompas \$\{deel\(t\["t4p-business-kompas"\]\)\}/);
  });

  it("toont niets wanneer de voortgang ontbreekt of het traject geen leden heeft", () => {
    expect(home).toMatch(/tr\.totalen && \(tr\.aantalLeden \?\? 0\) > 0/);
    expect(home).toMatch(/if \(!t\) return "";/);
  });
});
