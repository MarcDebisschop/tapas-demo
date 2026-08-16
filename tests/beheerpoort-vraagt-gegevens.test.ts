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

describe("D. De merknaam in de kopbalk is de weg terug naar het platform", () => {
  it("brengt je vanuit het beheer naar de platformpagina", () => {
    expect(merkBestemming("/admin")).toBe("/platform");
    expect(merkBestemming("/admin/credits")).toBe("/platform");
    expect(merkBestemming("/admin/bekwaamheid/rondes")).toBe("/platform");
  });

  it("doet hetzelfde voor de andere afgeschermde omgevingen", () => {
    expect(merkBestemming("/coach")).toBe("/platform");
    expect(merkBestemming("/coach/dashboard")).toBe("/platform");
    expect(merkBestemming("/organisatie")).toBe("/platform");
    expect(merkBestemming("/t4r/sessie/12")).toBe("/platform");
  });

  it("de platformpagina heeft een eigen adres in de routetabel", () => {
    const routes = readFileSync("client/src/App.tsx", "utf8");
    expect(routes).toContain('<Route path="/platform" component={Home} />');
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

  it("is geen verwijzing meer wanneer je al op de bestemming staat", () => {
    // Een knop die niets doet voelt stuk aan. Sta je al op de bestemming, dan
    // is de merknaam gewoon een naam.
    expect(kopbalk).toContain("const staErAl =");
    expect(kopbalk).toContain("<MerkOmhulsel href={bestemming} actief={!staErAl}>");
    expect(kopbalk).toContain('if (!actief) return <span className="cursor-default">');
  });

  it("de kopbalk gebruikt die regel en niet langer een vast pad", () => {
    expect(kopbalk).toContain("import { merkBestemming }");
    expect(kopbalk).toContain("const bestemming = merkBestemming(pad)");
    expect(kopbalk).not.toContain('<Link href="/">');
  });
});

describe("F. Sessies van vóór de wachtwoordplicht vervallen", () => {
  // Een sessie duurt 24 uur. Wie in de tijd van de vrije ingang binnenkwam,
  // bleef dus een dag binnen, ook nadat de poort een wachtwoord vroeg. Een
  // aanmeldversie op de sessie maakt die oude sessies ongeldig.
  const bewaker = readFileSync("server/admin-guard.ts", "utf8");
  const ingang = readFileSync("server/index.ts", "utf8");

  it("de bewaker geeft de huidige aanmeldversie uit", () => {
    expect(bewaker).toMatch(/export const AANMELD_VERSIE = \d+;/);
  });

  it("de aanmelding schrijft die versie op de sessie", () => {
    expect(adminRoute).toContain("aanmeldVersie: AANMELD_VERSIE");
  });

  it("de ingang van de server haalt een verouderde identiteit weg", () => {
    expect(ingang).toContain('import { AANMELD_VERSIE } from "./admin-guard"');
    expect(ingang).toContain(
      "if (sessie?.adminId != null && Number(sessie.aanmeldVersie) !== AANMELD_VERSIE)",
    );
    expect(ingang).toContain("sessie.adminId = undefined;");
  });
});

describe("E. Er is een weg terug naar de aanmeldpoort", () => {
  // Een sessie duurt 24 uur (server/index.ts). Zonder afmeldknop kwam wie
  // eenmaal binnen was een dag lang zonder wachtwoord binnen, en leek de poort
  // opnieuw open te staan.
  const beheerOverzicht = readFileSync("client/src/pages/admin.tsx", "utf8");

  it("het beheeroverzicht heeft een afmeldknop", () => {
    expect(beheerOverzicht).toContain('data-testid="button-admin-afmelden"');
    expect(beheerOverzicht).toContain("Afmelden");
  });

  it("die knop wist de sessie via de poort zelf", () => {
    expect(beheerOverzicht).toContain('import { useAdminAuth } from "@/components/AdminLoginGate"');
    expect(beheerOverzicht).toContain("const { afmelden } = useAdminAuth()");
    expect(beheerOverzicht).toContain("onClick={() => { void afmelden(); }}");
  });

  it("de poort wist de sessie ook bij de server, niet enkel in de browser", () => {
    expect(beheerPoort).toContain('apiRequest("POST", "/api/admin/logout"');
    expect(adminRoute).toContain('"/api/admin/logout"');
  });
});
