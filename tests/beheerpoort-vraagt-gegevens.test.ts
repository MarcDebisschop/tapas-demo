/**
 * tests/beheerpoort-vraagt-gegevens.test.ts
 *
 * De beheeromgeving stond open. Twee oorzaken, beide vastgezet in dit bestand.
 *
 *   1. De aanmeldpoort in de browser vulde bij lege velden zelf een echt
 *      e-mailadres en een echt wachtwoord in. Die stonden dus letterlijk in de
 *      code die elke bezoeker binnenhaalt. Klikken op Inloggen volstond.
 *   2. De server sloeg de wachtwoordcontrole over zodra de demo-modus aanstond.
 *      Een e-mailadres kennen was genoeg.
 *
 * Daarnaast: de merknaam in de kopbalk bracht een ingelogde beheerder naar de
 * publieke onthaalpagina. Binnen een afgeschermde omgeving hoort ze binnen die
 * omgeving te blijven.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { merkBestemming } from "../client/src/lib/merkbestemming";

const beheerPoort = readFileSync("client/src/components/AdminLoginGate.tsx", "utf8");
const coachPoort = readFileSync("client/src/components/CoachLoginGate.tsx", "utf8");
const adminRoute = readFileSync("server/routes/admin.ts", "utf8");
const kopbalk = readFileSync("client/src/components/Brand.tsx", "utf8");

describe("A. Geen inloggegevens in de code die de browser binnenhaalt", () => {
  it("de beheerpoort draagt geen wachtwoord en geen adres bij zich", () => {
    expect(beheerPoort).not.toContain("Tintinenco");
    expect(beheerPoort).not.toContain("demoCreds");
    expect(beheerPoort).not.toContain("marc@tapascity.com");
  });

  it("de coachpoort evenmin", () => {
    expect(coachPoort).not.toContain("Tintinenco");
    expect(coachPoort).not.toContain("demoCreds");
    expect(coachPoort).not.toContain("marc@tapascity.com");
  });

  it("nergens in de clientcode staat nog een wachtwoord van een beheerder", () => {
    for (const bestand of ["AdminLoginGate", "CoachLoginGate"]) {
      const bron = readFileSync(`client/src/components/${bestand}.tsx`, "utf8");
      expect(bron, bestand).not.toMatch(/w:\s*"[^"]+"/);
    }
  });
});

describe("B. Een leeg veld levert geen aanmelding op", () => {
  it("de beheerpoort stuurt niets zonder beide velden", () => {
    expect(beheerPoort).toContain("if (!stuurEmail || !stuurWachtwoord) return;");
  });

  it("de knop van de beheerpoort blijft uit zolang een veld leeg is", () => {
    expect(beheerPoort).toContain(
      'disabled={bezig || email.trim() === "" || wachtwoord === ""}',
    );
  });

  it("de coachpoort werkt op dezelfde manier", () => {
    expect(coachPoort).toContain("if (!stuurEmail || !stuurWachtwoord) return;");
    expect(coachPoort).toContain(
      'disabled={bezig || email.trim() === "" || wachtwoord === ""}',
    );
  });

  it("geen van beide poorten nodigt nog uit om zonder gegevens door te klikken", () => {
    for (const [naam, bron] of [
      ["beheer", beheerPoort],
      ["coach", coachPoort],
    ] as const) {
      expect(bron, naam).not.toContain("klik op Inloggen om verder te gaan");
    }
  });
});

describe("C. De server vraagt het wachtwoord altijd", () => {
  it("toetst het wachtwoord zodra het account er een heeft, buiten elke demovlag om", () => {
    expect(adminRoute).toMatch(
      /if \(beheerder\.wachtwoordHash\) \{[\s\S]{0,400}?verifieerWachtwoord/,
    );
  });

  it("zet de wachtwoordcontrole niet meer achter de demo-modus", () => {
    expect(adminRoute).not.toMatch(/if \(!DEMO_MODE\) \{[\s\S]{0,400}?verifieerWachtwoord/);
  });

  it("houdt de demo-modus enkel over voor een account zonder wachtwoord", () => {
    expect(adminRoute).toContain("} else if (!DEMO_MODE) {");
    expect(adminRoute).toContain("nog geen wachtwoord ingesteld");
  });

  it("leest de demostand nog uit de enige bron", () => {
    expect(adminRoute).toContain("const DEMO_MODE = isDemoModus()");
  });
});

describe("D. De merknaam in de kopbalk blijft binnen de omgeving", () => {
  it("brengt je binnen het beheer naar het beheeroverzicht", () => {
    expect(merkBestemming("/admin")).toBe("/admin");
    expect(merkBestemming("/admin/credits")).toBe("/admin");
    expect(merkBestemming("/admin/bekwaamheid/rondes")).toBe("/admin");
  });

  it("doet hetzelfde voor de andere afgeschermde omgevingen", () => {
    expect(merkBestemming("/coach")).toBe("/coach");
    expect(merkBestemming("/coach/dashboard")).toBe("/coach");
    expect(merkBestemming("/organisatie")).toBe("/organisatie");
    expect(merkBestemming("/t4r/sessie/12")).toBe("/t4r");
  });

  it("brengt je buiten die omgevingen naar de onthaalpagina", () => {
    for (const pad of ["/", "/mijn", "/instrumenten", "/koop/t4kids", "/studie"]) {
      expect(merkBestemming(pad), pad).toBe("/");
    }
  });

  it("verwart geen pad dat toevallig zo begint", () => {
    expect(merkBestemming("/administratie")).toBe("/");
    expect(merkBestemming("/coaches")).toBe("/");
  });

  it("de kopbalk gebruikt die regel en niet langer een vast pad", () => {
    expect(kopbalk).toContain("import { merkBestemming }");
    expect(kopbalk).toContain("const bestemming = merkBestemming(pad)");
    expect(kopbalk).toContain("<Link href={bestemming}>");
  });
});
