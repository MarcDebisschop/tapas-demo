// ---------------------------------------------------------------------------
// tests/privacy-auditronde6.test.ts
//
// Deze toetsen leggen twee ingrepen vast uit auditronde 6, de ronde die het
// privacydossier van september 2026 opleverde.
//
//   A. Bevinding 08: het startwachtwoord stond als tekst in de broncode. Elke
//      installatie die ooit geseed is, kreeg hetzelfde wachtwoord, en iedereen
//      die de code kon lezen kende het. Het staat er niet meer: er wordt enkel
//      nog een starthash gezet wanneer de omgevingsvariabele
//      TAPAS_START_WACHTWOORD gezet is, en die moet minstens twaalf tekens
//      lang zijn.
//
//   B. Beslispunt 7: de demo-omgeving toonde een volledig afgerond
//      due-diligence-traject van een bestaande onderneming, met vijf namen die
//      op echte bestuurders leken en met adressen op het echte domein van dat
//      bedrijf. Een gate-advies of een waardenverschil naast een aanwijsbare
//      naam is een persoonsgegeven. Alles is verzonnen gemaakt, en bestaande
//      installaties worden bij het opstarten omgezet.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const wortel = resolve(__dirname, "..");
const lees = (pad: string) => readFileSync(resolve(wortel, pad), "utf8");

const storageBron = lees("server/storage.ts");
const versieBron = lees("VERSION.md");

// De namen van toen. Ze staan hier als zoeksleutel, niet als demo-inhoud.
const OUDE_NAMEN = [
  "Loop Earplugs",
  "loop-earplugs.com",
  "Dimitri Oosterlinck",
  "Maarten Bodewes",
  "Marloes Mantel",
  "Cedric Schepers",
  "Rob Weston",
];

describe("A. bevinding 08: geen startwachtwoord in de broncode", () => {
  it("het oude wachtwoord staat nergens meer in de broncode", () => {
    for (const pad of ["server/storage.ts", "VERSION.md", "README.md"]) {
      let inhoud = "";
      try {
        inhoud = lees(pad);
      } catch {
        continue; // bestaat het bestand niet, dan valt er niets te toetsen
      }
      expect(inhoud, `${pad} bevat nog het oude wachtwoord`).not.toContain("Tintinenco01");
    }
  });

  it("er wordt enkel een starthash gezet wanneer de omgeving een wachtwoord geeft", () => {
    expect(storageBron).toMatch(/process\.env\.TAPAS_START_WACHTWOORD/);
    // Zonder de variabele: geen hash, en een luide waarschuwing in het logboek.
    expect(storageBron).toMatch(/console\.warn/);
  });

  it("een te kort wachtwoord wordt geweigerd, met twaalf tekens als ondergrens", () => {
    expect(storageBron).toMatch(/length\s*<\s*12/);
  });

  it("de versienota legt uit hoe het wachtwoord gezet wordt", () => {
    expect(versieBron).toContain("TAPAS_START_WACHTWOORD");
    expect(versieBron).not.toContain("Tintinenco01");
  });
});

describe("B. beslispunt 7: de demo-omgeving toont verzonnen personen", () => {
  it("de seed maakt een verzonnen onderneming aan", () => {
    expect(storageBron).toContain("Veldstroom Founder-Management Team");
    expect(storageBron).toContain("Veldstroom Audio");
  });

  it("de verzonnen leden hebben adressen op een domein dat niemand kan bezitten", () => {
    for (const naam of [
      "Ilse Vandervelde",
      "Joris Craeninckx",
      "Nadia El Amrani",
      "Bram Segers",
      "Hanne Loridan",
    ]) {
      expect(storageBron, `verzonnen lid ${naam} ontbreekt`).toContain(naam);
    }
    // RFC 2606 houdt .example vrij: zo'n adres kan nooit aan iemand toebehoren.
    expect(storageBron).toContain("@veldstroom-audio.example");
  });

  it("de oude namen komen in geen enkel rapportbestand nog voor", () => {
    for (const pad of [
      "client/src/pages/hdd-rapport.tsx",
      "server/hdd/pdf/flagship.ts",
      "server/hdd/pdf/mapping.ts",
      "server/hdd/pdf/_test_render.ts",
      "client/public/assets/index-CxFhBwUz.js",
    ]) {
      const inhoud = lees(pad);
      for (const naam of OUDE_NAMEN) {
        expect(inhoud, `${pad} bevat nog "${naam}"`).not.toContain(naam);
      }
    }
  });

  it("storage.ts noemt de oude namen enkel nog in de omzetting", () => {
    // De omzetting heeft de oude namen nodig als zoeksleutel. Ze mogen dus wel
    // in storage.ts staan, maar niet meer in een INSERT.
    expect(storageBron).toMatch(/UPDATE hdd_board_leden SET naam = \?, email = \? WHERE naam = \?/);
    expect(storageBron).toMatch(/UPDATE hdd_trajecten\s*\n?\s*SET board_naam = 'Veldstroom/);
    const inserts = storageBron
      .split("\n")
      .filter((r) => /INSERT INTO hdd_/.test(r))
      .join("\n");
    for (const naam of OUDE_NAMEN) {
      expect(inserts).not.toContain(naam);
    }
  });

  it("een lid met een adres op het oude domein houdt in geen geval zijn naam", () => {
    expect(storageBron).toMatch(/WHERE email LIKE '%@loop-earplugs\.com'/);
    expect(storageBron).toMatch(/naam = 'Demolid'/);
  });
});
