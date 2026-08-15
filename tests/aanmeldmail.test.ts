// ---------------------------------------------------------------------------
// tests/aanmeldmail.test.ts
//
// Het bericht met de aanmeldlink. Dit is het enige bericht dat toegang geeft
// tot de persoonlijke ruimte van een deelnemer, dus er mag niets aan ontbreken:
// de link moet erin staan, de geldigheidsduur moet vermeld zijn, en er mag nooit
// een onopgevulde plaatshouder in de tekst achterblijven.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { bouwAanmeldmail, AANMELDMAIL_TALEN } from "../server/aanmeldmail";

const LINK = "https://tapas-platform-2.pplx.app/#/magic/" + "a".repeat(64);

describe("De aanmeldmail — inhoud", () => {
  it("bevat de link letterlijk", () => {
    const m = bouwAanmeldmail({ naam: "Jana", link: LINK, geldigMinuten: 15, taal: "nl" });
    expect(m.tekst).toContain(LINK);
  });

  it("vermeldt de geldigheidsduur in minuten", () => {
    const m = bouwAanmeldmail({ naam: "Jana", link: LINK, geldigMinuten: 15, taal: "nl" });
    expect(m.tekst).toContain("15 minuten");
  });

  it("spreekt de deelnemer aan met de naam wanneer die bekend is", () => {
    const m = bouwAanmeldmail({ naam: "Jana", link: LINK, geldigMinuten: 15, taal: "nl" });
    expect(m.tekst).toContain("Beste Jana,");
  });

  it("valt terug op een neutrale aanspreking zonder naam", () => {
    const m = bouwAanmeldmail({ naam: "", link: LINK, geldigMinuten: 15, taal: "nl" });
    expect(m.tekst).toContain("Beste,");
    expect(m.tekst).not.toContain("Beste ,");
  });

  it("zegt dat de link één keer werkt", () => {
    const m = bouwAanmeldmail({ naam: "", link: LINK, geldigMinuten: 15, taal: "nl" });
    expect(m.tekst).toContain("één keer");
  });

  it("legt uit wat te doen als de aanvraag niet van de deelnemer kwam", () => {
    const m = bouwAanmeldmail({ naam: "", link: LINK, geldigMinuten: 15, taal: "nl" });
    expect(m.tekst).toContain("niet aangevraagd");
  });

  it("bevat geen toegangscode en geen dashboardtoken", () => {
    const m = bouwAanmeldmail({ naam: "Jana", link: LINK, geldigMinuten: 15, taal: "nl" });
    expect(m.tekst.toLowerCase()).not.toContain("toegangscode");
    expect(m.tekst.toLowerCase()).not.toContain("dashboardtoken");
  });
});

describe("De aanmeldmail — de vijf talen", () => {
  for (const taal of AANMELDMAIL_TALEN) {
    it(`is volledig in het ${taal}`, () => {
      const m = bouwAanmeldmail({ naam: "Jana", link: LINK, geldigMinuten: 15, taal });
      expect(m.onderwerp.trim().length).toBeGreaterThan(8);
      expect(m.tekst).toContain(LINK);
      expect(m.tekst).toContain("15");
      // Geen onopgevulde plaatshouders, geen ontbrekende waarden.
      expect(m.tekst).not.toMatch(/\{\{|\}\}|undefined|NaN|\[object/);
      // Zes regels of meer: aanspreking, inleiding, link, geldigheid, uitleg, groet.
      expect(m.tekst.split("\n").filter((r) => r.trim()).length).toBeGreaterThanOrEqual(6);
      expect(m.tekst).toContain("TaPasCity");
    });
  }

  it("valt bij een onbekende taal terug op het Nederlands", () => {
    const m = bouwAanmeldmail({ naam: "Jana", link: LINK, geldigMinuten: 15, taal: "de" });
    expect(m.onderwerp).toBe(
      bouwAanmeldmail({ naam: "Jana", link: LINK, geldigMinuten: 15, taal: "nl" }).onderwerp,
    );
  });

  it("verwerkt een taalcode met streek, zoals nl-BE", () => {
    const m = bouwAanmeldmail({ naam: "Jana", link: LINK, geldigMinuten: 15, taal: "nl-BE" });
    expect(m.onderwerp).toContain("aanmeldlink");
  });

  it("geeft elke taal een eigen onderwerp", () => {
    const onderwerpen = AANMELDMAIL_TALEN.map(
      (t) => bouwAanmeldmail({ naam: "", link: LINK, geldigMinuten: 15, taal: t }).onderwerp,
    );
    expect(new Set(onderwerpen).size).toBe(AANMELDMAIL_TALEN.length);
  });
});

describe("De aanmeldmail — grensgevallen", () => {
  it("valt bij een onzinnige geldigheidsduur terug op 15 minuten", () => {
    const m = bouwAanmeldmail({ naam: "", link: LINK, geldigMinuten: 0, taal: "nl" });
    expect(m.tekst).toContain("15 minuten");
  });

  it("laat geen NaN in de tekst achter", () => {
    const m = bouwAanmeldmail({
      naam: "",
      link: LINK,
      geldigMinuten: Number.NaN,
      taal: "nl",
    });
    expect(m.tekst).not.toContain("NaN");
  });
});

describe("De verzending is aangesloten op de bestaande weg", () => {
  const mailerBron = readFileSync(resolve(__dirname, "../server/bulk-import/mailer.ts"), "utf8");
  const routesBron = readFileSync(resolve(__dirname, "../server/routes-deelnemer.ts"), "utf8");

  it("de mailer heeft een verzendfunctie voor de aanmeldlink", () => {
    expect(mailerBron).toMatch(/export async function verstuurAanmeldlink/);
  });

  it("die functie gebruikt Brevo over HTTPS wanneer de sleutel staat", () => {
    const blok = mailerBron.slice(
      mailerBron.indexOf("export async function verstuurAanmeldlink"),
      mailerBron.indexOf("// C3 — Verstuur via de Brevo transactionele HTTP-API"),
    );
    expect(blok).toMatch(/brevoApiGeconfigureerd\(\)/);
    expect(blok).toMatch(/verstuurViaBrevoApi/);
    expect(blok).toMatch(/getTransporter\(\)\.sendMail/);
    expect(blok).toMatch(/isSimulatiemodus\(\)/);
  });

  it("de route roept de verzending aan", () => {
    expect(routesBron).toMatch(/verstuurAanmeldlink\(/);
  });

  it("de link komt in geen enkele logregel terecht", () => {
    // Elke console-regel in de mailer en in het routeblok mag de linkvariabele
    // niet meegeven. Wie de logs kan lezen, mag geen deur kunnen openen.
    const blok = mailerBron.slice(mailerBron.indexOf("export async function verstuurAanmeldlink"));
    const logregels = blok.match(/console\.(log|warn|error)\([\s\S]*?\);/g) ?? [];
    expect(logregels.length).toBeGreaterThan(0);
    for (const r of logregels) {
      expect(r).not.toMatch(/\$\{\s*(input\.)?link\s*\}/);
      expect(r).not.toMatch(/\$\{\s*tekst\s*\}/);
    }
  });

  it("een mislukte verzending verandert het antwoord van de route niet", () => {
    const blok = routesBron.slice(
      routesBron.indexOf('app.post("/api/deelnemers/magic-link"'),
      routesBron.indexOf('app.get("/api/deelnemers/magic/'),
    );
    // De fout wordt gelogd, niet doorgegeven: geen res.status in dat pad.
    const naVerzending = blok.slice(blok.indexOf("verstuurAanmeldlink("));
    expect(naVerzending).toMatch(/console\.error/);
    expect(naVerzending).not.toMatch(/res\.status\(5\d\d\)/);
    // En de verzending zit in een try/catch, zodat een uitzondering de route
    // niet laat stuklopen.
    expect(blok).toMatch(/try \{[\s\S]*verstuurAanmeldlink\([\s\S]*\} catch/);
  });
});
