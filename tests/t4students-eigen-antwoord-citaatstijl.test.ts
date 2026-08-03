import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Opmaakherstel-2, punt 4: wat de student zelf zei, moet eruit springen als
// een citaat. Zijn eigen antwoord op een vraag (T4SCitaatRegel.herkenning)
// staat nu als gewone rechte tekst. In het referentiebeeld staat dat schuin
// gezet, tussen aanhalingstekens. Dit geldt overal waar letterlijk wordt
// weergegeven wat de student zelf invulde of aanvinkte, dus in het
// "citaat"-blok in rapport-pdf.ts, op de regel die r.herkenning tekent.
//
// We meten dit aan de broncode van de tekenaar: de regel die r.herkenning
// tekent moet de optie oblique (schuin) meegeven, en de tekst die naar
// schrijf()/doc.text() gaat moet tussen aanhalingstekens staan (niet het
// kale r.herkenning zelf).
// ---------------------------------------------------------------------------

function leesTekenaar(): string {
  return readFileSync(join(__dirname, "..", "server", "t4students", "rapport-pdf.ts"), "utf-8");
}

function citaatCase(): string {
  const bron = leesTekenaar();
  const marker = `function tekenBlok(`;
  const tekenBlokBron = bron.slice(bron.indexOf(marker));
  const caseStart = tekenBlokBron.indexOf(`case "citaat": {`);
  expect(caseStart).toBeGreaterThan(-1);
  const na = tekenBlokBron.slice(caseStart);
  const volgendeCase = na.search(/\n\s*case "/);
  return na.slice(0, volgendeCase > -1 ? volgendeCase : na.length);
}

describe("het letterlijke antwoord van de student springt eruit als een citaat", () => {
  it("de regel die r.herkenning tekent, gebruikt aanhalingstekens rond de tekst", () => {
    const code = citaatCase();
    // Zoek de regel waar r.herkenning als teken-argument wordt meegegeven,
    // en controleer dat die niet het kale r.herkenning is, maar een string
    // met aanhalingstekens erin verwerkt (bijvoorbeeld `"\u201C" + r.herkenning + "\u201D"`).
    const regelMatch = code.match(/schrijf\(doc, ([^,]*r\.herkenning[^,]*),/);
    expect(regelMatch, "geen regel gevonden die r.herkenning naar schrijf() stuurt").not.toBeNull();
    const argument = regelMatch![1];
    const heeftAanhalingsteken = /["\u2018\u2019\u201C\u201D]/.test(argument) && argument !== `r.herkenning || ""`;
    expect(
      heeftAanhalingsteken,
      `de tekenaar geeft r.herkenning kaal door ("${argument}") zonder aanhalingstekens eromheen`,
    ).toBe(true);
  });

  it("de regel die r.herkenning tekent, zet de tekst schuin (oblique)", () => {
    const code = citaatCase();
    const lijnen = code.split("\n");
    const idx = lijnen.findIndex((l) => l.includes("r.herkenning") && l.includes("schrijf("));
    expect(idx, "geen regel gevonden die r.herkenning tekent").toBeGreaterThan(-1);
    // schrijf() aanvaardt een schuin-parameter als laatste argument (true).
    // We controleren dat de aanroep eindigt met ", true)" (schuin=true) of
    // het woord SCHUIN/true ergens in de aanroep zelf voorkomt.
    expect(/,\s*true\s*\)/.test(lijnen[idx]), `de regel "${lijnen[idx].trim()}" zet r.herkenning niet schuin`).toBe(
      true,
    );
  });
});
