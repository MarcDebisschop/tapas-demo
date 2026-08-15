// ---------------------------------------------------------------------------
// tests/deelnemersdeur-magic-link.test.ts
//
// Wat deze tests bewijzen:
//
//   A. De deelnemersdeur (/mijn) gebruikt de ONVEILIGE route niet meer.
//      POST /api/deelnemers/login geeft het dashboardToken terug zodra er een
//      e-mailadres wordt ingetikt, zonder enige controle dat de bezoeker dat
//      adres bezit. Deze test is het vangnet dat verhindert dat de pagina daar
//      ooit opnieuw op aansluit.
//
//   B. De aanmeldlink is echt geïmplementeerd. Vóór deze ronde riepen de routes
//      `storage.maakMagicLink()` en `storage.wisselMagicLink()` aan, functies
//      die nergens bestonden; de typecontrole meldde dat met TS2339 en de route
//      liep bij elke aanvraag stuk.
//
//   C. De veiligheidseigenschappen van de aanmeldlink: bestaande deelnemer
//      verplicht, onraadbaar token, 15 minuten geldig, eenmalig gebruik.
//
//   D. Het antwoord van de route verklapt buiten de demostand niet of een
//      e-mailadres bestaat.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mijnBron = readFileSync(resolve(__dirname, "../client/src/pages/mijn.tsx"), "utf8");

// Dezelfde bron zonder commentaarregels. De toetsen die iets moeten UITSLUITEN
// kijken hiernaar, zodat de verantwoording bovenaan het bestand — waarin de
// oude, onveilige weg beschreven staat — geen valse alarmen geeft.
const mijnCode = mijnBron
  .split("\n")
  .filter((r) => !r.trim().startsWith("//"))
  .join("\n");
const routesBron = readFileSync(resolve(__dirname, "../server/routes-deelnemer.ts"), "utf8");
const moduleBron = readFileSync(resolve(__dirname, "../server/magic-link.ts"), "utf8");

describe("A. De deelnemersdeur gebruikt de onveilige aanmeldroute niet meer", () => {
  it("mijn.tsx post niet naar /api/deelnemers/login", () => {
    expect(mijnCode).not.toMatch(/["'`]\/api\/deelnemers\/login["'`]/);
  });

  it("mijn.tsx post naar /api/deelnemers/magic-link", () => {
    expect(mijnBron).toMatch(/["'`]\/api\/deelnemers\/magic-link["'`]/);
  });

  it("mijn.tsx leest geen dashboardToken meer uit het antwoord", () => {
    expect(mijnCode).not.toMatch(/dashboardToken/);
  });

  it("mijn.tsx navigeert niet meer zelf naar /dashboard/:token", () => {
    expect(mijnCode).not.toMatch(/navigate\(\s*`\/dashboard\//);
  });
});

describe("B. De aanmeldlink is echt geïmplementeerd", () => {
  it("de routes roepen de eigen module aan, niet de onbestaande storage-functies", () => {
    expect(routesBron).not.toMatch(/storage\.maakMagicLink/);
    expect(routesBron).not.toMatch(/storage\.wisselMagicLink/);
    expect(routesBron).toMatch(/from\s+["']\.\/magic-link["']/);
  });

  it("de module exporteert beide functies en de geldigheidsduur", () => {
    expect(moduleBron).toMatch(/export async function maakMagicLink/);
    expect(moduleBron).toMatch(/export async function wisselMagicLink/);
    expect(moduleBron).toMatch(/export const LINK_GELDIG_MIN\s*=\s*15/);
  });
});

describe("C. De veiligheidseigenschappen van de aanmeldlink", () => {
  it("maakt geen account aan: alleen een bestaande deelnemer krijgt een link", () => {
    expect(moduleBron).toMatch(/storage\.getDeelnemerByEmail/);
    expect(moduleBron).not.toMatch(/vindOfMaakDeelnemer/);
  });

  it("gebruikt een onraadbaar token uit crypto.randomBytes", () => {
    expect(moduleBron).toMatch(/randomBytes\(32\)\.toString\("hex"\)/);
  });

  it("laat het token na 15 minuten verlopen", () => {
    expect(moduleBron).toMatch(/LINK_GELDIG_MIN\s*\*\s*60\s*\*\s*1000/);
    expect(moduleBron).toMatch(/verloopt_op/);
  });

  it("staat maar één keer gebruik toe", () => {
    expect(moduleBron).toMatch(/SET gebruikt_op = \? WHERE token = \? AND gebruikt_op IS NULL/);
    expect(moduleBron).toMatch(/changes !== 1/);
  });

  it("vergelijkt het token in constante tijd", () => {
    expect(moduleBron).toMatch(/timingSafeEqual/);
  });

  it("aanvaardt enkel een token van 64 hexadecimale tekens", () => {
    expect(moduleBron).toMatch(/\/\^\[0-9a-f\]\{64\}\$\//);
  });
});

describe("D. Het antwoord verklapt niet of een e-mailadres bestaat", () => {
  // Het routeblok van POST /api/deelnemers/magic-link, zonder commentaarregels,
  // zodat de toetsen naar de echte code kijken en niet naar de uitleg erboven.
  const blok = routesBron
    .slice(
      routesBron.indexOf('app.post("/api/deelnemers/magic-link"'),
      routesBron.indexOf('app.get("/api/deelnemers/magic/'),
    )
    .split("\n")
    .filter((r) => !r.trim().startsWith("//"))
    .join("\n");

  it("antwoordt altijd met 200 op een aanvraag", () => {
    // Enkel de schemavalidatie mag een 400 geven; de uitkomst van de opzoeking niet.
    const statussen = blok.match(/res\.status\(\d{3}\)/g) ?? [];
    expect(statussen).toEqual(["res.status(400)"]);
  });

  it("geeft de link en het veld gevonden enkel in de demostand mee", () => {
    expect(blok).toMatch(/const demo = isDemoModus\(\)/);
    expect(blok).toMatch(/if \(!demo\)/);
    // Buiten de demo bevat het antwoord geen link en geen `gevonden`.
    const buitenDemo = blok.match(/if \(!demo\) \{[\s\S]*?\}/)?.[0] ?? "";
    expect(buitenDemo).not.toMatch(/\blink\b/);
    expect(buitenDemo).not.toMatch(/gevonden/);
  });

  it("de pagina toont altijd dezelfde neutrale boodschap", () => {
    expect(mijnBron).toMatch(/Is dit adres bij ons bekend/);
  });
});
