import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { KLEUR } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Opmaakherstel-2 van de opdracht "Herstelronde opmaak: het contrast
// terugbrengen".
//
// Bij de vorige ronde is er per ongeluk maar één kaartsoort ontstaan: elk
// blok (kader, citaat, kaartvlak) werd een getint vlak met een gekleurde
// balk aan de linkerrand. Daardoor viel het contrast weg dat de opmaak
// juist levendig moest maken (zie het referentiebeeld,
// uploaded_attachments/.../image-2.jpg). Er moeten weer twee duidelijk
// verschillende kaartsoorten zijn:
//
// - de UITLEGKAART ("kader"): achtergrond WIT (KLEUR.kaart), met een
//   gekleurde balk aan de linkerrand. Voor alles wat het rapport uitlegt.
// - het INGETOGEN VLAK ("citaat", "kaartvlak"): achtergrond in de warme
//   lichte tint (KLEUR.okerZacht), ZONDER balk. Voor wat de student zelf
//   zei, een citaat, of een samenvattende gedachte.
//
// Deze test leest de broncode van de tekenaar (rapport-pdf.ts) om vast te
// leggen dat:
// 1. het "kader"-blok een witte achtergrond vult (KLEUR.kaart) en een balk
//    tekent;
// 2. het "citaat"-blok een getinte achtergrond vult (KLEUR.okerZacht of
//    KLEUR.papier2, nooit KLEUR.kaart) en GEEN balk tekent;
// 3. het "kaartvlak"-blok een getinte achtergrond vult en GEEN balk tekent.
//
// Een getint vlak mag dus nooit een balk krijgen, en een uitlegkaart is
// altijd wit met een balk: dat is precies het contrast dat hersteld moet
// worden.
// ---------------------------------------------------------------------------

function leesTekenaar(): string {
  return readFileSync(join(__dirname, "..", "server", "t4students", "rapport-pdf.ts"), "utf-8");
}

/** Haalt het codeblok van een "case" in tekenBlok() eruit, tot aan de volgende case. */
function pakCase(bron: string, soort: string): string {
  // De functie tekenBlok() bevat de tekencode; er is maar één "case" per
  // soort daarbinnen. We zoeken vanaf de tweede match van `case "soort":`
  // (de eerste hoort meestal bij blokHoogte()) tot aan de eerstvolgende
  // "case" erna, zodat we alleen het tekencode-blok van tekenBlok() pakken.
  const marker = `function tekenBlok(`;
  const startTeken = bron.indexOf(marker);
  expect(startTeken, "tekenBlok() niet gevonden in rapport-pdf.ts").toBeGreaterThan(-1);
  const tekenBlokBron = bron.slice(startTeken);
  const caseMarker = `case "${soort}": {`;
  const caseStart = tekenBlokBron.indexOf(caseMarker);
  expect(caseStart, `case "${soort}" niet gevonden binnen tekenBlok()`).toBeGreaterThan(-1);
  const na = tekenBlokBron.slice(caseStart + caseMarker.length);
  const volgendeCase = na.search(/\n\s*case "/);
  return na.slice(0, volgendeCase > -1 ? volgendeCase : na.length);
}

describe("twee duidelijk verschillende kaartsoorten in de tekenaar", () => {
  it("de uitlegkaart (kader) heeft een witte achtergrond (KLEUR.kaart)", () => {
    const bron = leesTekenaar();
    const kaderCode = pakCase(bron, "kader");
    expect(
      kaderCode.includes("KLEUR.kaart"),
      "het kader-blok vult niet KLEUR.kaart (wit): de uitlegkaart moet wit zijn, geen getinte tint",
    ).toBe(true);
    expect(
      kaderCode.includes("KLEUR.papier2") || kaderCode.includes("KLEUR.okerZacht"),
      "het kader-blok gebruikt nog een getinte achtergrondkleur: dat hoort bij het ingetogen vlak, niet bij de uitlegkaart",
    ).toBe(false);
  });

  it("de uitlegkaart (kader) tekent een balk aan de linkerrand", () => {
    const bron = leesTekenaar();
    const kaderCode = pakCase(bron, "kader");
    // Een balk is een tweede, smalle vulRechthoek-aanroep met blok.kleur.
    const balkAanroepen = kaderCode.match(/vulRechthoek\([^)]*blok\.kleur[^)]*\)/g) ?? [];
    expect(balkAanroepen.length, "het kader-blok tekent geen balk in blok.kleur").toBeGreaterThan(0);
  });

  it("het ingetogen vlak (citaat) heeft een getinte achtergrond, nooit wit", () => {
    const bron = leesTekenaar();
    const citaatCode = pakCase(bron, "citaat");
    expect(
      citaatCode.includes("KLEUR.okerZacht") || citaatCode.includes("KLEUR.papier2"),
      "het citaat-blok vult geen getinte achtergrond",
    ).toBe(true);
    expect(citaatCode.includes("KLEUR.kaart"), "het citaat-blok mag geen witte achtergrond (KLEUR.kaart) vullen").toBe(
      false,
    );
  });

  it("het ingetogen vlak (citaat) tekent GEEN balk aan de linkerrand", () => {
    const bron = leesTekenaar();
    const citaatCode = pakCase(bron, "citaat");
    const balkAanroepen = citaatCode.match(/vulRechthoek\([^)]*blok\.kleur[^)]*,\s*1\.\d\)/g) ?? [];
    expect(balkAanroepen.length, "het citaat-blok tekent nog een balk: een getint vlak mag nooit een balk krijgen").toBe(
      0,
    );
  });

  it("het ingetogen vlak (kaartvlak) heeft een getinte achtergrond en geen balk", () => {
    const bron = leesTekenaar();
    const kaartvlakCode = pakCase(bron, "kaartvlak");
    expect(
      kaartvlakCode.includes("KLEUR.okerZacht") || kaartvlakCode.includes("KLEUR.papier2"),
      "het kaartvlak-blok vult geen getinte achtergrond",
    ).toBe(true);
    const balkAanroepen = kaartvlakCode.match(/vulRechthoek\([^)]*blok\.kleur[^)]*,\s*1\.\d\)/g) ?? [];
    expect(balkAanroepen.length, "het kaartvlak-blok tekent een balk: dat hoort niet bij het ingetogen vlak").toBe(0);
  });
});

describe("de kleurwaarden die het contrast dragen bestaan en verschillen", () => {
  it("KLEUR.kaart (wit) en KLEUR.okerZacht (de warme lichte tint) zijn niet gelijk", () => {
    expect(KLEUR.kaart).not.toBe(KLEUR.okerZacht);
    expect(KLEUR.kaart.toUpperCase()).toBe("#FFFFFF");
  });
});
