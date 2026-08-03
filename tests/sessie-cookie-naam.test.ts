// ---------------------------------------------------------------------------
// tests/sessie-cookie-naam.test.ts — Punt C (doorloop-herstel).
//
// Wat deze tests bewijzen:
//   1. Op een echte HTTPS-omgeving (productie of de pplx.app-sandbox) blijft
//      de aanmeldcookie het __Host- voorvoegsel dragen, exact zoals voorheen.
//      De beveiliging op die omgevingen wordt door dit werk niet verzwakt.
//   2. Op elke andere omgeving (lokale ontwikkeling, een installatie zonder
//      eigen HTTPS-terminatie) vervalt het voorvoegsel, zodat de browser de
//      cookie ook zonder de Secure-vlag effectief zet en aanmelden mogelijk
//      blijft. Dit is de regressietest voor Gebrek 1 uit
//      verslag-t4teens-doorloop.md: een __Host--cookie zonder Secure-vlag
//      wordt door geen enkele standaardconforme browser of http-client
//      geaccepteerd.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { bepaalSessieCookieNaam } from "../server/sessie-cookie";

describe("bepaalSessieCookieNaam", () => {
  it("gebruikt __Host- in productie (NODE_ENV=production)", () => {
    expect(bepaalSessieCookieNaam({ NODE_ENV: "production" })).toBe("__Host-tapas-sid");
  });

  it("gebruikt __Host- in de pplx.app-sandbox (PPLX_SANDBOX=true)", () => {
    expect(bepaalSessieCookieNaam({ NODE_ENV: "development", PPLX_SANDBOX: "true" })).toBe(
      "__Host-tapas-sid",
    );
  });

  it("laat het __Host- voorvoegsel vallen op gewone lokale ontwikkeling", () => {
    expect(bepaalSessieCookieNaam({ NODE_ENV: "development" })).toBe("tapas-sid");
  });

  it("laat het __Host- voorvoegsel vallen zonder omgevingsvariabelen", () => {
    expect(bepaalSessieCookieNaam({})).toBe("tapas-sid");
  });

  it("is niet gevoelig aan een toevallige waarheidsgetrouwe string voor PPLX_SANDBOX", () => {
    // Enkel de exacte tekst "true" mag de __Host- omgeving activeren; dit
    // voorkomt dat een per ongeluk gezette waarde (bv. "1", "TRUE") stilzwijgend
    // de verkeerde cookienaam kiest.
    expect(bepaalSessieCookieNaam({ PPLX_SANDBOX: "1" })).toBe("tapas-sid");
  });
});
