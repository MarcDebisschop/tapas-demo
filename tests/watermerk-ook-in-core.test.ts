// ---------------------------------------------------------------------------
// Het vliegtuigje van Amelia Earhart is het merkteken van TaPasCity. Het hoort
// op elk eigen scherm, dus ook in de kale versie van de toepassing, en het hoort
// nooit op het portaal van een klant.
//
// Tot nu toe hing het merkteken aan de belevingslaag. Die laag staat in de kale
// versie uit, en daarmee verdween het merkteken mee. Dat was niet de bedoeling:
// het merkteken is geen belevingselement maar een merkregel.
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ORGANISATIE_BRANDING_KLASSE } from "../shared/branding";
import {
  MERKTEKEN_KLASSE,
  documentKlassen,
} from "../client/src/lib/document-klassen";

const css = readFileSync("client/src/index.css", "utf8");
const watermerkRegel = `.${MERKTEKEN_KLASSE} body::after`;

describe("Het merkteken staat los van de belevingslaag", () => {
  it("wordt aangebracht in de kale versie", () => {
    expect(documentKlassen(false)).toContain(MERKTEKEN_KLASSE);
  });

  it("wordt ook aangebracht in het volledige platform", () => {
    expect(documentKlassen(true)).toContain(MERKTEKEN_KLASSE);
  });

  it("brengt in de kale versie verder niets van de belevingslaag aan", () => {
    // Marc vroeg uitsluitend het merkteken, niet de rest van de sfeerlaag.
    expect(documentKlassen(false)).toEqual([MERKTEKEN_KLASSE]);
  });
});

describe("De opmaak van het merkteken", () => {
  it("hangt aan de merktekenklasse en niet aan de belevingsklasse", () => {
    expect(css).toContain(watermerkRegel);
    expect(css).not.toContain(".belevings-modus body::after");
  });

  it("toont het vliegtuigje van Earhart", () => {
    const begin = css.indexOf(watermerkRegel);
    const blok = css.slice(begin, css.indexOf("}", begin));
    expect(blok).toContain("earhart-vega-watermark");
  });
});

describe("Het merkteken blijft van het portaal van een klant af", () => {
  it("wordt uitgeschakeld zodra de organisatieklasse op het document staat", () => {
    const suppressor = `.${ORGANISATIE_BRANDING_KLASSE} body::after { display: none !important }`;
    expect(css).toContain(suppressor);
    // De onderdrukking moet na de merktekenregel staan, anders wint de eerste.
    expect(css.indexOf(suppressor)).toBeGreaterThan(css.indexOf(watermerkRegel));
  });

  it("blijft ook weg op de poort en op de lichte schermen van de 2MINSCAN", () => {
    expect(css).toContain("body:has(.poort-pagina)::after { display: none !important }");
    expect(css).toContain(".dark:has(.twominscan-pagina) body::after");
  });
});

describe("De opstartcode van de toepassing", () => {
  it("bepaalt de klassen met de gedeelde functie en niet met een eigen regel", () => {
    const bron = readFileSync("client/src/main.tsx", "utf8");
    expect(bron).toContain("documentKlassen(");
    // Zou de klasse binnen een voorwaarde op de belevingslaag staan, dan viel
    // het merkteken in de kale versie opnieuw weg.
    expect(bron).not.toMatch(/if\s*\(\s*BELEVING\s*\)/);
  });
});
