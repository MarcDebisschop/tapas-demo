// ---------------------------------------------------------------------------
// tests/smtp-antwoord.test.ts - het antwoord van de mailserver beoordelen
//
// AANLEIDING. In het beheeroverzicht stond bij drie uitnodigingen "verstuurd",
// terwijl die berichten nooit aankwamen. De SMTP-weg gaf die stand terug zodra
// nodemailer geen uitzondering gooide, en nodemailer gooit niets wanneer de
// mailserver een adres weigert of uitstelt. Wat de server werkelijk zei stond in
// accepted, rejected en pending, en werd nergens gelezen.
//
// Wat deze toetsen vastleggen:
//   1. "Verstuurd" vraagt dat de server ons adres uitdrukkelijk aanvaardde.
//   2. Een geweigerd of uitgesteld adres is een fout, ook als er tegelijk een
//      ander adres aanvaard werd.
//   3. Een leeg of afwijkend antwoord is een fout en nooit stille bezorging.
//   4. Adressen worden vergeleken zonder te struikelen over hoofdletters,
//      witruimte of de objectvorm die sommige transporten teruggeven.
//   5. De melding bevat wat de server zei, want daar dient het logboek voor.
//   6. Broncontrole: de verzendmodule leest dit oordeel op elke SMTP-weg en
//      geeft nergens nog blind "verstuurd" terug.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { beoordeelSmtpAntwoord } from "../server/bulk-import/smtp-antwoord";

describe("beoordeelSmtpAntwoord", () => {
  it("noemt een aanvaard adres verstuurd en bewaart de messageId", () => {
    const r = beoordeelSmtpAntwoord("herman@tapascity.com", {
      accepted: ["herman@tapascity.com"],
      rejected: [],
      messageId: "<abc@tapascity.com>",
      response: "250 2.0.0 OK",
    });
    expect(r.status).toBe("verstuurd");
    expect(r.gesimuleerd).toBe(false);
    expect(r.melding).toContain("<abc@tapascity.com>");
  });

  it("noemt een geweigerd adres een fout, ook naast een aanvaard adres", () => {
    const r = beoordeelSmtpAntwoord("herman@tapascity.com", {
      accepted: ["iemand@anders.be"],
      rejected: ["herman@tapascity.com"],
      response: "550 5.1.1 unknown recipient",
    });
    expect(r.status).toBe("fout");
    expect(r.melding).toContain("weigerde");
    expect(r.melding).toContain("550");
  });

  it("noemt een uitgesteld adres een fout en niet bezorgd", () => {
    const r = beoordeelSmtpAntwoord("herman@tapascity.com", {
      accepted: [],
      rejected: [],
      pending: ["herman@tapascity.com"],
    });
    expect(r.status).toBe("fout");
    expect(r.melding).toContain("uit");
  });

  it("noemt het een fout wanneer de server geen enkel adres aanvaardde", () => {
    const r = beoordeelSmtpAntwoord("herman@tapascity.com", { accepted: [], rejected: [] });
    expect(r.status).toBe("fout");
    expect(r.melding).toContain("aanvaardde");
  });

  it("noemt een leeg of afwijkend antwoord een fout", () => {
    expect(beoordeelSmtpAntwoord("a@b.be", null).status).toBe("fout");
    expect(beoordeelSmtpAntwoord("a@b.be", undefined).status).toBe("fout");
    // Een antwoord zonder de velden die wij nodig hebben mag nooit bezorging heten.
    expect(beoordeelSmtpAntwoord("a@b.be", { messageId: "x" }).status).toBe("fout");
  });

  it("vergelijkt adressen zonder te struikelen over vorm of hoofdletters", () => {
    expect(
      beoordeelSmtpAntwoord("Herman@TaPasCity.com", { accepted: [" herman@tapascity.com "] }).status,
    ).toBe("verstuurd");
    expect(
      beoordeelSmtpAntwoord("herman@tapascity.com", {
        accepted: [{ address: "HERMAN@tapascity.com", name: "Herman" }],
      }).status,
    ).toBe("verstuurd");
  });

  it("kort een uitzonderlijk lang serverantwoord af", () => {
    const r = beoordeelSmtpAntwoord("a@b.be", { accepted: [], response: "x".repeat(900) });
    expect(r.status).toBe("fout");
    expect((r.melding ?? "").length).toBeLessThan(400);
  });
});

describe("broncontrole van de verzendmodule", () => {
  const bron = readFileSync(new URL("../server/bulk-import/mailer.ts", import.meta.url), "utf8");

  it("leest het oordeel in plaats van blind verstuurd te melden", () => {
    expect(bron).toContain("beoordeelSmtpAntwoord");
    // Geen enkele SMTP-tak mag nog zelf de stand verstuurd verzinnen. De enige
    // plaats waar die stand nog in de module staat, is de weg over de HTTPS-API
    // van de leverancier: daar volgt de stand uit de HTTP-code van het antwoord.
    const blind = bron.match(/status: "verstuurd"/g) ?? [];
    expect(blind.length).toBe(1);
    const brevo = bron.slice(bron.indexOf("async function verstuurViaBrevoApi"));
    expect((brevo.match(/status: "verstuurd"/g) ?? []).length).toBe(1);
  });

  it("stuurt elke SMTP-verzending langs dezelfde ene weg", () => {
    const aanroepen = bron.match(/verstuurViaSmtp\(/g) ?? [];
    // Een aangifte plus vier verzendfuncties: uitnodiging, toegangsmail,
    // aanmeldlink en bericht.
    expect(aanroepen.length).toBe(5);
    const rechtstreeks = bron.match(/getTransporter\(\)\.sendMail/g) ?? [];
    expect(rechtstreeks.length).toBe(1);
  });
});
