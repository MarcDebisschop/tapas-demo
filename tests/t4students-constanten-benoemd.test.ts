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
    // Tegenproef op de uitkomst zelf: een verschil van precies 1.0 op de
    // schaal van 0 tot 3 hoort nog steeds tot dezelfde groep te horen, een
    // groter verschil niet.
    //
    // HERSTELRONDE 2, PUNT A. Deze test gaf voorheen elk van de zes
    // versnellers dezelfde ruwe herkenning (3) en verwachtte daaruit een
    // gelijke groepering. Dat klopt sinds punt A niet meer: de zes
    // versnellers hebben elk een ander haalbaar maximum (Analyse 5,
    // Individueel ondersteunend 4, Groepsondersteunend 6, Impact 3, Resultaat
    // 5, Constructief onderscheidend 3), dus eenzelfde ruwe som van 3 is geen
    // gelijk aandeel meer. De motor rangschikt nu op aandeel, dus de
    // tegenproef moet elk construct hetzelfde aandeel geven, niet dezelfde
    // ruwe som. Elk construct hier haalt precies zijn eigen maximum via zijn
    // eigen herkenningsitem (aandeel 1,0 voor alle zes), zonder de
    // keuze-items D5, F4, F5 of S1 te beantwoorden, zodat het maximum van elk
    // construct niet toevallig door een gedeeld item wordt opgerekt.
    const r = scoreStudiekompas(
      I,
      {
        V1: { recognition: 3 }, // Analyse: eigen item loopt tot 3
        V2: { recognition: 3 }, // Individueel ondersteunend: eigen item loopt tot 3
        V3: { recognition: 3 }, // Groepsondersteunend: eigen item loopt tot 3
        V4: { recognition: 3 }, // Impact: eigen item loopt tot 3, maximum van het construct
        V5: { recognition: 3 }, // Resultaat: eigen item loopt tot 3
        V6: { recognition: 3 }, // Constructief onderscheidend: maximum van het construct
      },
      null,
      "nl",
    );
    // Impact en Constructief onderscheidend hebben hier hun volle aandeel
    // (3 van 3 = 1,0) en horen samen in de kopgroep. De andere vier komen op
    // een lager aandeel uit (3 van 5, 4 of 6) en horen daar niet meer bij.
    expect(r.versnellers.groepen[0].sort()).toEqual(
      ["Constructief onderscheidend", "Impact"].sort(),
    );
  });
});
