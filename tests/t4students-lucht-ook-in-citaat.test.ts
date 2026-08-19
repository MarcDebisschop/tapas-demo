import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Opmaak afwerken, punt 3: de tussenruimte tussen een kop en de eerste
// tekstregel, die al voor "kader" en "kaartvlak" is toegevoegd (zie
// tests/t4students-lucht-kop-tekst.test.ts), moet ook binnen de getinte
// vlakken gelden. Het blok "citaat" is zo'n getint vlak (KLEUR.okerZacht,
// zonder balk) en plakte zijn eerste regel nog tegen de kop aan (16 punten in
// plaats van de 18 die "kader" en "kaartvlak" al kregen). Dit raakt onder
// meer de dankkaart en andere citaatvlakken in het rapport.
//
// Deze test meet, net als de bestaande lucht-test, de broncode van
// tekenBlok() voor de case "citaat": het verschil tussen de y-positie van de
// kop (blok.kop) en de y-positie waar de eerste regel (r.vraag van de eerste
// regel) begint, moet minstens 15 punten zijn.
// ---------------------------------------------------------------------------

function leesTekenaar(): string {
  return readFileSync(join(__dirname, "..", "server", "t4students", "rapport-pdf.ts"), "utf-8");
}

function pakCase(bron: string, soort: string): string {
  const marker = `function tekenBlok(`;
  const startTeken = bron.indexOf(marker);
  const tekenBlokBron = bron.slice(startTeken);
  const caseMarker = `case "${soort}": {`;
  const caseStart = tekenBlokBron.indexOf(caseMarker);
  expect(caseStart, `case "${soort}" niet gevonden binnen tekenBlok()`).toBeGreaterThan(-1);
  const na = tekenBlokBron.slice(caseStart + caseMarker.length);
  const volgendeCase = na.search(/\n\s*case "/);
  return na.slice(0, volgendeCase > -1 ? volgendeCase : na.length);
}

describe("lucht tussen de kop en de eerste tekstregel geldt ook binnen een getint vlak (citaat)", () => {
  it("citaat: de afstand tussen de kop en het beginpunt van de regels (yy) is even groot als bij kader/kaartvlak (minstens 18 punten)", () => {
    const code = pakCase(leesTekenaar(), "citaat");
    // De kop wordt getekend op "y + N"; het beginpunt van de regels-lus staat
    // in "let yy = y + M;" vlak na het tekenen van de kop. "kader" en
    // "kaartvlak" tekenen hun eerste tekstregel op y + 40 na een kop op
    // y + 22 (18 punten afstand); dezelfde 18 punten moeten hier gelden.
    const kopMatch = code.match(/doc\.text\(blok\.kop,[^\n]*y \+ ([0-9.]+)/);
    expect(kopMatch, "geen y-positie gevonden voor blok.kop in citaat").not.toBeNull();
    const kopY = Number(kopMatch![1]);
    // Opmaakherstel-3, punt 3: het beginpunt van de regels is niet langer een
    // vast getal. Heeft dit vlak geen kop, dan wordt de regel waar de kop zou
    // staan niet opengehouden en schuiven de regels evenveel op:
    // "let yy = y + 42 - (CITAAT_KOP_H - citaatKopH);". Voor deze meting geldt
    // het geval MET kop, want alleen dan bestaat er een afstand tussen kop en
    // eerste regel; dan is citaatKopH gelijk aan CITAAT_KOP_H en valt de
    // aftrek weg.
    const yyMatch = code.match(/let yy = y \+ ([0-9.]+)(?: - \(CITAAT_KOP_H - citaatKopH\))?;/);
    expect(yyMatch, "geen startpunt yy gevonden in citaat").not.toBeNull();
    const yyStart = Number(yyMatch![1]);
    expect(yyStart - kopY).toBeGreaterThanOrEqual(18);
  });
});
