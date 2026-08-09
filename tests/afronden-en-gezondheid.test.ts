// ---------------------------------------------------------------------------
// tests/afronden-en-gezondheid.test.ts
//
// Contracttests op broncodeniveau (zelfde aanpak als tests/anonimisering.test.ts
// en tests/authlimiter-loginpaden.test.ts) voor de tweede auditronde:
//
//   1. K-1 vervolg: een AL VOLTOOIDE afname kan niet opnieuw afgerond worden.
//      Zonder die controle kon iedereen met een gok op het oplopende id een
//      voltooid profiel overschrijven en kreeg die persoon in het antwoord de
//      respondentCode terug -- net het bezitsbewijs van het koppelpad.
//   2. K-1 vervolg: het e-mailadres dat optioneel bij het afronden meereist,
//      wordt alleen gekoppeld met een geldig bezitsbewijs.
//   3. Een eigen, strengere snelheidsbegrenzer op het koppel- en het afrondpad
//      in plaats van de ruime auth-limiet.
//   4. O-1/O-2: er is een gezondheidsendpoint voor monitoring dat geen
//      persoonsgegevens teruggeeft en 503 antwoordt bij een onbereikbare
//      databank.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const wortel = resolve(__dirname, "..");
const afnames = readFileSync(resolve(wortel, "server/routes/afnames.ts"), "utf8");
const index = readFileSync(resolve(wortel, "server/index.ts"), "utf8");

/** Het codeblok van de afrondroute, tot aan de volgende route-registratie. */
function afrondRoute(): string {
  const start = afnames.indexOf('app.post("/api/afnames/:id/connection"');
  expect(start, "afrondroute niet gevonden").toBeGreaterThan(-1);
  const volgende = afnames.indexOf("app.post(", start + 10);
  return afnames.slice(start, volgende > -1 ? volgende : undefined);
}

describe("afronden van deel 2 — herhaald afronden en e-mailkoppeling", () => {
  it("weigert een tweede afronding van een voltooide afname met 409", () => {
    const route = afrondRoute();
    expect(route).toMatch(/status\s*===\s*"voltooid"/);
    const positie = route.search(/status\s*===\s*"voltooid"/);
    const scoring = route.indexOf("buildGeneratorContract");
    // De controle staat vóór de scoring en de contractopbouw, dus er wordt geen
    // rekenwerk of opslag uitgevoerd voor een herhaalde poging.
    expect(positie).toBeGreaterThan(-1);
    if (scoring > -1) expect(positie).toBeLessThan(scoring);
    expect(route).toMatch(/status\(409\)/);
  });

  it("koppelt een meegestuurd e-mailadres alleen met een geldig bezitsbewijs", () => {
    const route = afrondRoute();
    expect(route).toMatch(/bewijsGeldig\(a,\s*bewijsUitBody\(req\.body\)\)/);
    // De koppelvoorwaarde bevat het bewijs én blijft het adres valideren.
    expect(route).toMatch(/if\s*\(emailRaw\s*&&\s*bewijsOk\s*&&/);
  });

  it("logt een geweigerde koppeling zonder persoonsgegevens", () => {
    const route = afrondRoute();
    const logregel = route.match(/console\.warn\(`\[koppel\][^`]*`\)/);
    expect(logregel, "logregel niet gevonden").not.toBeNull();
    // Geen e-mailadres, naam of code in de logregel: enkel het afname-id.
    expect(logregel![0]).not.toMatch(/emailRaw|\ba\.name\b|respondentCode/);
    expect(logregel![0]).toMatch(/\$\{id\}/);
  });
});

describe("snelheidsbegrenzing op de gevoelige deelnemerspaden", () => {
  it("heeft een eigen begrenzer die strenger is dan de auth-limiet", () => {
    const auth = index.match(/const authLimiter = rateLimit\(\{[\s\S]*?\}\);/);
    const koppel = index.match(/const koppelLimiter = rateLimit\(\{[\s\S]*?\}\);/);
    expect(auth, "authLimiter niet gevonden").not.toBeNull();
    expect(koppel, "koppelLimiter niet gevonden").not.toBeNull();
    const grens = (blok: string) => Number(blok.match(/limit:\s*(\d+)/)![1]);
    expect(grens(koppel![0])).toBeLessThan(grens(auth![0]));
    expect(grens(koppel![0])).toBeLessThanOrEqual(10);
  });

  it("legt die begrenzer op het koppelpad én op het afrondpad", () => {
    const gebruik = index.match(/app\.use\(\[[^\]]*\],\s*koppelLimiter\);/);
    expect(gebruik, "koppelLimiter wordt niet toegepast").not.toBeNull();
    expect(gebruik![0]).toContain("/api/afnames/:id/koppel-dashboard");
    expect(gebruik![0]).toContain("/api/afnames/:id/connection");
  });
});

/**
 * Knipt precies de handler van het gezondheidsvenster uit, van de openende
 * haak tot de bijbehorende sluitende haak.
 *
 * Vroeger werd hier een vast venster van 900 tekens genomen. Dat werkte zolang
 * de handler kort was, maar het is een willekeurige grens: bij elke regel die
 * erbij komt, schuift een deel van de handler stilletjes buiten beeld en meet
 * de test minder dan ze belooft. Haakjes tellen meet altijd de hele handler,
 * hoe lang die ook wordt.
 */
function leesGezondheidsHandler(bron: string): string {
  const start = bron.indexOf('app.get("/api/gezondheid"');
  if (start === -1) return "";
  let diepte = 0;
  for (let plaats = start; plaats < bron.length; plaats += 1) {
    const teken = bron[plaats];
    if (teken === "(") diepte += 1;
    if (teken === ")") {
      diepte -= 1;
      if (diepte === 0) return bron.slice(start, plaats + 1);
    }
  }
  return bron.slice(start);
}

describe("gezondheidsendpoint voor monitoring", () => {
  it("bestaat en controleert de databank", () => {
    expect(index).toMatch(/app\.get\("\/api\/gezondheid"/);
    const blok = leesGezondheidsHandler(index);
    expect(blok, "de handler is niet teruggevonden").not.toBe("");
    expect(blok).toMatch(/sqlite\.prepare\(/);
    expect(blok).toMatch(/503/);
  });

  it("geeft geen persoonsgegevens of configuratie prijs", () => {
    const blok = leesGezondheidsHandler(index);
    expect(blok, "de handler is niet teruggevonden").not.toBe("");
    for (const verboden of ["email", "respondentCode", "SESSION_SECRET", "DATABASE_URL", "process.env.DB"]) {
      expect(blok.includes(verboden), `gezondheidsendpoint mag ${verboden} niet tonen`).toBe(false);
    }
  });
});

describe("bouwpijplijn (auditbevinding O-1)", () => {
  it("heeft een CI-werkstroom die tests, typecontrole en bouw uitvoert", () => {
    const ci = readFileSync(resolve(wortel, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toMatch(/npm ci/);
    expect(ci).toMatch(/vitest run/);
    expect(ci).toMatch(/tsc-basislijn\.mjs/);
    expect(ci).toMatch(/npm run build/);
  });

  it("heeft een typecontrole met basislijn die faalt bij extra fouten", () => {
    const script = readFileSync(resolve(wortel, "script/tsc-basislijn.mjs"), "utf8");
    expect(script).toMatch(/const BASISLIJN = \d+/);
    expect(script).toMatch(/aantal > BASISLIJN/);
    expect(script).toMatch(/process\.exit\(1\)/);
  });
});
