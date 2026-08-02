import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";

// ---------------------------------------------------------------------------
// Punt 4 uit fase 1: tieMargin werd gelezen maar stond nergens.
//
// WAT ER MIS WAS, IN GEWONE TAAL
// De motor bundelt scores die dicht bij elkaar liggen tot een groep, zodat een
// verschil van een tiende niet als rangorde wordt gepresenteerd. Hoe dicht
// "dicht bij elkaar" is, heet tieMargin. De motor las die waarde uit de
// constantenlijst van het instrument, maar daar stond hij niet in. Er stond een
// terugval in de code: als hij ontbreekt, neem 1.0. Omdat hij altijd ontbrak,
// was de terugval in de praktijk de enige waarde die ooit gold.
//
// WAT EEN DEELNEMER DAARVAN MERKTE
// Niets, want de uitkomst was gewoon 1.0. Het is geen rekenfout. Het is een
// waarde die het gedrag van het rapport stuurt zonder dat ze ergens staat waar
// de opdrachtgever haar kan zien of aanpassen. Alle acht andere constanten
// staan wel in het instrumentbestand; deze was de enige uitzondering, en de
// enige terugval van dit soort in welke scoringsmotor van het platform dan ook.
//
// WAT ER NU GEBEURT
// De waarde staat op de plek waar de andere acht ook staan. De terugval in de
// code is weg, zodat er nog maar een plaats is waar het getal vandaan komt.
//
// DE WAARDE ZELF STAAT INMIDDELS OP 0.3
// Fase 1c heeft de constante alleen benoemd en de waarde met opzet op 1.0
// gelaten. In de motorronde heeft de opdrachtgever haar op 0.3 gezet. Wat dat
// verandert, staat in tests/t4students-gelijke-stand.test.ts en in het verslag
// van de motorronde. Deze test bewaakt alleen nog dat de constante bestaat, uit
// het instrument komt en nergens anders vandaan.
// ---------------------------------------------------------------------------

const C = I.scoringMap.constants;
const motorBron = readFileSync(
  path.resolve(__dirname, "../server/t4students/kompas-scoring.ts"),
  "utf-8",
);

describe("punt 4: elke constante die de motor leest staat ook in het instrument", () => {
  it("tieMargin staat in de constantenlijst", () => {
    expect(
      C.tieMargin,
      "de motor leest tieMargin, dus die hoort in de constantenlijst te staan",
    ).toBe(0.3);
  });

  it("er is geen terugval meer in de code, dus maar een bron voor het getal", () => {
    expect(
      motorBron.includes("C.tieMargin != null"),
      "de terugval C.tieMargin != null ? ... : 1.0 hoort weg te zijn",
    ).toBe(false);
  });

  it("geen enkele constante die de motor leest ontbreekt nog", () => {
    // Vangt de volgende keer af dat iemand een nieuwe C.iets introduceert
    // zonder hem in het instrumentbestand te zetten.
    const gelezen = new Set<string>();
    for (const m of motorBron.matchAll(/\bC\.([A-Za-z][A-Za-z0-9]*)/g)) {
      gelezen.add(m[1]);
    }
    expect(gelezen.size).toBeGreaterThan(0);
    const ontbreekt = [...gelezen].filter(
      (naam) => (C as Record<string, unknown>)[naam] === undefined,
    );
    expect(
      ontbreekt,
      `deze constanten worden gelezen maar staan niet in het instrument: ${ontbreekt.join(", ")}`,
    ).toEqual([]);
  });

  it("de groepering van bijna gelijke scores werkt nog precies hetzelfde", () => {
    // Tegenproef op de uitkomst zelf: een verschil van precies 1.0 hoort nog
    // steeds tot dezelfde groep te horen, een groter verschil niet.
    const r = scoreStudiekompas(
      I,
      {
        V1: { recognition: 3 },
        V2: { recognition: 3 },
        V3: { recognition: 3 },
        V4: { recognition: 3 },
        V5: { recognition: 3 },
        V6: { recognition: 3 },
      },
      null,
      "nl",
    );
    // Zes gelijke scores horen in een groep te vallen.
    expect(r.versnellers.groepen[0]).toHaveLength(6);
  });
});
