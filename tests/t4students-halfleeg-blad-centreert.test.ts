import { describe, it, expect } from "vitest";
import PDFDocument from "pdfkit";
import { registerFonts } from "../server/hdd/pdf/theme";
import { renderT4StudentsRapport } from "../server/t4students/rapport-pdf";
import type { T4SPagina, T4SRapport } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Opmaak afwerken, punt 2: veel hoofdstukken zijn kort en laten het onderste
// deel van het blad leeg. Vult de inhoud van een blad minder dan ongeveer
// 0,55 van de beschikbare hoogte (tussen de kop en de voettekst), dan komt
// die inhoud verticaal in het midden van het blad te staan, zodat de
// witruimte als bedoelde rust leest in plaats van als een gat. De kop van het
// hoofdstuk, de onderkop en het streepje eronder blijven staan waar ze
// stonden; alleen de blokken eronder zakken mee. Dit geldt niet op een
// vervolgblad en niet op de cover.
//
// Deze test bouwt twee minimale rapporten met de echte renderer: één met een
// kort hoofdstuk (één alinea, ruim onder de drempel) en één met een hoofdstuk
// dat het blad vult (meerdere alinea's, ruim boven de drempel). Om de
// verticale plaatsing te meten zonder PDF-tekst te moeten lezen, meten we via
// PDFKit zelf: we laten hetzelfde blok twee keer tekenen, één keer via de
// echte renderer en één keer los, direct onder de kop, en vergelijken de
// tekstplaatsing die pdfkit teruggeeft (de aanroepen naar doc.text houden een
// interne "y" bij die met page.content valt te controleren is lastig zonder
// een PDF-parser); daarom meten we in plaats daarvan de aanroep-brontekst:
// de renderer moet een startpunt berekenen dat groter is dan het normale
// startpunt (INHOUD_TOP) wanneer de inhoud kort is, en gelijk aan het normale
// startpunt wanneer de inhoud het blad vult.
// ---------------------------------------------------------------------------

function basisRapport(blokken: T4SPagina["blokken"]): T4SRapport {
  return {
    naam: "Test Persoon",
    code: "TST-0001",
    datum: "3 augustus 2026",
    instrumentVersie: "test",
    scorerVersie: "test",
    paginas: [
      {
        nr: 1,
        soort: "inhoud",
        titel: "Een kort hoofdstuk",
        ondertitel: null,
        blokken,
      } as unknown as T4SPagina,
    ],
  } as unknown as T4SRapport;
}

/** Rendert het rapport en geeft de ruwe PDF-inhoud (het eerste blad) als tekst terug, inclusief de tekenopdrachten. */
function renderRuweContent(rapport: T4SRapport): string {
  // We roepen renderT4StudentsRapport aan zoals de rest van de test-suite dat
  // doet; de PDF zelf bevat de effectieve doc.text-coordinaten niet als
  // leesbare cijfers (PDF-operators werken met een tekstmatrix), dus deze
  // test controleert in plaats daarvan het gedrag op het niveau van de
  // functie zelf: geen enkele bladzijde met weinig inhoud mag verstoken
  // blijven van de verschuiving. We doen dit door de PDF te laten schrijven
  // en te controleren dat het proces geen fouten geeft; de echte, precieze
  // meting van de start-y gebeurt in de tweede test hieronder via een
  // toegevoegd exemplaar van de puur-berekenende hulpfunctie.
  const { doc } = renderT4StudentsRapport(rapport);
  doc.end();
  return "gerenderd";
}

describe("een halfleeg blad centreert zijn inhoud verticaal", () => {
  it("de renderer draait zonder fouten voor een kort en voor een vol hoofdstuk", () => {
    const kort = basisRapport([{ soort: "alinea", tekst: "Een korte alinea." }]);
    const vol = basisRapport(
      Array.from({ length: 14 }, () => ({
        soort: "alinea" as const,
        tekst:
          "Een lange alinea met genoeg tekst om samen met de andere veertien alinea's het hele blad te vullen " +
          "zodat de inhoud ruim boven de drempel van vijfenvijftig honderdsten van de beschikbare hoogte uitkomt.",
      })),
    );
    expect(() => renderRuweContent(kort)).not.toThrow();
    expect(() => renderRuweContent(vol)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// De eigenlijke, precieze waarborg: rapport-pdf.ts moet een puur berekenende
// functie exporteren voor het startpunt van de inhoud (bijvoorbeeld
// berekenInhoudStart of vergelijkbaar), die: (a) bij weinig inhoud een
// startpunt teruggeeft dat hoger ligt dan INHOUD_TOP (dus lager op de
// bladzijde: verschoven naar het midden), en (b) bij inhoud die het blad
// vult, of een pagina die op een vervolgblad terechtkomt, het normale
// startpunt (INHOUD_TOP, ongewijzigd) teruggeeft. Omdat rapport-pdf.ts die
// functie nog niet exporteert, faalt onderstaande test totdat ze is
// toegevoegd.
// ---------------------------------------------------------------------------
describe("het exacte startpunt van de inhoud op een blad", () => {
  it("rapport-pdf.ts exporteert een functie die het startpunt berekent op basis van de inhoudshoogte", async () => {
    const module = await import("../server/t4students/rapport-pdf");
    expect(
      typeof (module as Record<string, unknown>).berekenInhoudStart,
      "geen functie berekenInhoudStart geexporteerd door rapport-pdf.ts",
    ).toBe("function");
  });

  it("bij weinig inhoud (ruim onder 0,55 van de beschikbare hoogte) verschuift het startpunt naar beneden", async () => {
    const { berekenInhoudStart } = (await import("../server/t4students/rapport-pdf")) as unknown as {
      berekenInhoudStart: (inhoudHoogte: number, kopEindY: number, isVervolg: boolean) => number;
    };
    // INHOUD_TOP is 150, BODEM ligt rond de 780 (BLAD_H - 46 - 16); de
    // precieze waarden staan intern in rapport-pdf.ts. We geven een kopEindY
    // gelijk aan het normale startpunt (150) mee, en een kleine inhoudhoogte.
    const kopEindY = 150;
    const kleineInhoud = 60; // ruim onder de helft van de beschikbare ~630 punten
    const start = berekenInhoudStart(kleineInhoud, kopEindY, false);
    expect(start, "het startpunt is niet verschoven bij een kort blad").toBeGreaterThan(kopEindY);
  });

  it("bij inhoud die het blad vult, blijft het startpunt bij de kop staan", async () => {
    const { berekenInhoudStart } = (await import("../server/t4students/rapport-pdf")) as unknown as {
      berekenInhoudStart: (inhoudHoogte: number, kopEindY: number, isVervolg: boolean) => number;
    };
    const kopEindY = 150;
    const groteInhoud = 620; // vult zo goed als het hele blad
    const start = berekenInhoudStart(groteInhoud, kopEindY, false);
    expect(start).toBe(kopEindY);
  });

  it("op een vervolgblad wordt nooit verschoven, ook al is de inhoud kort", async () => {
    const { berekenInhoudStart } = (await import("../server/t4students/rapport-pdf")) as unknown as {
      berekenInhoudStart: (inhoudHoogte: number, kopEindY: number, isVervolg: boolean) => number;
    };
    const kopEindY = 150;
    const kleineInhoud = 60;
    const start = berekenInhoudStart(kleineInhoud, kopEindY, true);
    expect(start).toBe(kopEindY);
  });
});

// ---------------------------------------------------------------------------
// Centrering begrenzen: bij een heel kort hoofdstuk slaat de centrering door.
// De kop komt dan los van zijn inhoud te staan doordat het echte midden van
// het blad ver onder de kop ligt. De extra ruimte die berekenInhoudStart
// boven de inhoud zet, mag daarom nooit meer zijn dan vijfenzeventig punten:
// is het echte midden verder naar onder, dan zakt de inhoud niet verder dan
// die vijfenzeventig punten onder haar normale plaats (INHOUD_TOP/kopEindY).
// Een kort hoofdstuk moet nog steeds enige extra ruimte krijgen (de
// centrering blijft dus bestaan, ze slaat alleen niet meer door).
//
// Opmaakherstel-3: deze bovengrens is nadien verder aangescherpt naar
// zesendertig punten en naar een kwart van de inhoud zelf. Die scherpere
// waarborg staat in tests/t4students-opmaak-vlakken-en-lucht.test.ts. De
// grens van vijfenzeventig punten hieronder blijft als ondergrens van de
// belofte staan: ze mag nooit meer worden.
// ---------------------------------------------------------------------------
describe("de verticale centrering wordt begrensd op vijfenzeventig punten extra ruimte", () => {
  it("bij een heel kort hoofdstuk is de extra ruimte boven de inhoud nooit meer dan 75 punten", async () => {
    const { berekenInhoudStart } = (await import("../server/t4students/rapport-pdf")) as unknown as {
      berekenInhoudStart: (inhoudHoogte: number, kopEindY: number, isVervolg: boolean) => number;
    };
    const kopEindY = 150;
    // Een heel korte alinea: de beschikbare hoogte is ongeveer 630 punten, dus
    // zonder begrenzing zou de inhoud tot ver voorbij het midden zakken.
    const heelKleineInhoud = 20;
    const start = berekenInhoudStart(heelKleineInhoud, kopEindY, false);
    expect(start - kopEindY).toBeLessThanOrEqual(75);
  });

  it("een kort hoofdstuk krijgt nog steeds enige extra ruimte (de centrering blijft bestaan)", async () => {
    const { berekenInhoudStart } = (await import("../server/t4students/rapport-pdf")) as unknown as {
      berekenInhoudStart: (inhoudHoogte: number, kopEindY: number, isVervolg: boolean) => number;
    };
    const kopEindY = 150;
    const heelKleineInhoud = 20;
    const start = berekenInhoudStart(heelKleineInhoud, kopEindY, false);
    expect(start).toBeGreaterThan(kopEindY);
  });
});
