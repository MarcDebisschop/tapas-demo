// ---------------------------------------------------------------------------
// tests/mail-html-versie.test.ts  -  NIEUW BESTAND
//
// AANLEIDING. Een board member kreeg zijn uitnodiging, klikte de link aan, en
// las "404, pagina niet gevonden". Het adres in zijn adresbalk stopte precies
// waar het token hoorde te beginnen: https://host/#/deelnemer/ en verder niets.
// Het platform verstuurde enkel platte tekst; het programma van de ontvanger
// maakte daar zelf een link van, en die lezing stopt bij de regelovergang die
// een plat bericht na 76 tekens zet. Sindsdien gaat er een klikbare versie mee.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import { htmlVanTekst, regelNaarHtml } from "../server/mailpoort/html-versie";
import { berichtVoorLid } from "../server/hdd/uitnodigingsmail";
import { isOnvolledigeUitnodiging } from "../client/src/pages/not-found";

const LINK = "https://tapas-demo.onrender.com/deelnemer/a1b2c3d4-e5f6a7b8-c9d0e1f2";

describe("regelNaarHtml", () => {
  it("maakt van een adres een echte verwijzing, met het token erin", () => {
    const html = regelNaarHtml(LINK);
    expect(html).toContain(`href="${LINK}"`);
    expect(html).toContain("a1b2c3d4-e5f6a7b8-c9d0e1f2");
  });

  it("laat een sluitend leesteken buiten de verwijzing", () => {
    const html = regelNaarHtml(`Open ${LINK}.`);
    expect(html).toContain(`href="${LINK}"`);
    expect(html).not.toContain(`href="${LINK}."`);
  });

  it("maakt tekens met een betekenis in html onschadelijk", () => {
    expect(regelNaarHtml("<script>kwaad()</script>")).not.toContain("<script>");
  });

  it("behoudt de zoekreeks van de 2MINSCAN in de verwijzing", () => {
    const tweemin = "https://voorbeeld.be/?uitnodiging=abc123#/2minscan";
    expect(regelNaarHtml(tweemin)).toContain('href="https://voorbeeld.be/?uitnodiging=abc123#/2minscan"');
  });

  it("raakt een regel zonder adres niet aan", () => {
    expect(regelNaarHtml("Beste Herman,")).toBe("Beste Herman,");
  });
});

describe("htmlVanTekst", () => {
  it("levert een volledig bericht met de verwijzing erin", () => {
    const html = htmlVanTekst(`Beste Herman,\n\nStart hier:\n${LINK}\n\nTaPasCity`);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain(`href="${LINK}"`);
    expect(html).toContain("Beste Herman,");
  });

  it("gebruikt nergens een lang streepje", () => {
    const html = htmlVanTekst(`Beste,\n${LINK}`);
    expect(html).not.toContain("\u2014");
    expect(html).not.toContain("\u2013");
  });
});

describe("de HDD-uitnodiging als platte tekst", () => {
  const tekst = berichtVoorLid({
    naam: "Herman Van Esbroeck",
    boardNaam: "Tapascity",
    fase: 1,
    links: [
      { instrumentId: "t4p-business-kompas", link: LINK },
      { instrumentId: "twominscan", link: "https://tapas-demo.onrender.com/2minscan?uitnodiging=abc123" },
    ],
  });

  it("zet elk adres alleen op zijn regel, dus binnen 76 tekens", () => {
    const adresregels = tekst.split("\n").filter((r) => r.startsWith("https://"));
    expect(adresregels).toHaveLength(2);
    for (const regel of adresregels) expect(regel.length).toBeLessThan(76);
  });

  it("noemt het instrument op de regel boven het adres", () => {
    const regels = tekst.split("\n");
    const i = regels.indexOf(LINK);
    expect(regels[i - 1]).toBe("TaPas Business Kompas:");
  });

  it("gebruikt nergens een lang streepje", () => {
    expect(tekst).not.toContain("\u2014");
    expect(tekst).not.toContain("\u2013");
  });
});

describe("de foutpagina herkent een geknipte uitnodiging", () => {
  it("herkent de routes waarachter een kenmerk hoort", () => {
    expect(isOnvolledigeUitnodiging("/deelnemer/")).toBe(true);
    expect(isOnvolledigeUitnodiging("/deelnemer")).toBe(true);
    expect(isOnvolledigeUitnodiging("/teamscan/r/")).toBe(true);
    expect(isOnvolledigeUitnodiging("/dashboard/")).toBe(true);
  });

  it("houdt een gewone onbekende pagina een gewone foutpagina", () => {
    expect(isOnvolledigeUitnodiging("/bestaat-niet")).toBe(false);
    expect(isOnvolledigeUitnodiging("/deelnemer/abc123")).toBe(false);
    expect(isOnvolledigeUitnodiging("")).toBe(false);
  });
});
