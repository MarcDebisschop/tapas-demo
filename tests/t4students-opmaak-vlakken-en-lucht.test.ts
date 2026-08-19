import { describe, it, expect } from "vitest";
import PDFDocument from "pdfkit";
import { registerFonts } from "../server/hdd/pdf/theme";
import {
  berekenInhoudStart,
  introMaten,
  kaartvlakKopHoogte,
  citaatKopHoogte,
} from "../server/t4students/rapport-pdf";

// ---------------------------------------------------------------------------
// Opmaakherstel-3. Drie waarborgen over de opmaak van een blad, elk op een
// echt gevonden gebrek in het proefrapport van tweeentwintig augustus:
//
//  1. Het inleidende vlak bovenaan een blad werd op een andere breedte
//     gemeten dan waarop het getekend werd. Daardoor was het vlak soms een
//     regel te laag en viel de laatste regel op of onder de gekleurde rand.
//     Meten en tekenen halen hun maten nu uit een en dezelfde functie
//     (introMaten), zodat ze niet meer uit elkaar kunnen lopen.
//
//  2. De verticale centrering van een kort hoofdstuk zette tot
//     vijfenzeventig punten lucht tussen het streepje onder de kop en de
//     eerste regel eronder, terwijl er onder de inhoud nog honderden punten
//     leeg bleven. Dat las als een gat. De lucht is nu begrensd op
//     zesendertig punten en op een kwart van de inhoud zelf.
//
//  3. Een ingetogen vlak zonder kop hield toch de regel open waar de kop zou
//     staan. Daardoor stond er een gat tussen het opschriftje en de eerste
//     regel. Is er geen kop, dan wordt die regel niet meer opengehouden.
// ---------------------------------------------------------------------------

function proefDoc() {
  const doc = new PDFDocument({ size: "A4", margin: 52, bufferPages: true });
  registerFonts(doc);
  return doc;
}

describe("het inleidende vlak meet en tekent op dezelfde maten", () => {
  it("introMaten geeft samenhangende maten terug", () => {
    const doc = proefDoc();
    const maten = introMaten(
      doc,
      "Een inleidende tekst die lang genoeg is om over meerdere regels te lopen, zodat de " +
        "hoogte van het vlak echt uit de tekst volgt en niet uit een vast getal.",
    );
    expect(maten.tekstHoogte).toBeGreaterThan(0);
    // Het vlak is altijd hoger dan de tekst zelf (marge boven en onder).
    expect(maten.vlakHoogte).toBeGreaterThan(maten.tekstHoogte);
    // Het blok is het vlak plus de ademruimte erna.
    expect(maten.blokHoogte).toBeGreaterThan(maten.vlakHoogte);
    // De tekstbreedte is smaller dan de volle tekstkolom van 491 punten.
    expect(maten.tekstBreedte).toBeLessThan(491);
    expect(maten.tekstBreedte).toBeGreaterThan(400);
  });

  it("twee aanroepen met dezelfde tekst geven exact dezelfde maten", () => {
    const doc = proefDoc();
    const tekst = "Dezelfde tekst, twee keer gemeten, moet twee keer hetzelfde opleveren.";
    expect(introMaten(doc, tekst)).toEqual(introMaten(doc, tekst));
  });

  it("een langere tekst geeft een hoger vlak", () => {
    const doc = proefDoc();
    const kort = introMaten(doc, "Een korte regel.");
    const lang = introMaten(
      doc,
      "Een veel langere tekst die zeker over drie of vier regels loopt, zodat het vlak " +
        "meetbaar hoger uitkomt dan bij de korte regel hierboven, ook op dezelfde breedte.",
    );
    expect(lang.vlakHoogte).toBeGreaterThan(kort.vlakHoogte);
  });
});

describe("de lucht boven de inhoud van een kort blad blijft binnen de perken", () => {
  it("nooit meer dan zesendertig punten extra ruimte", () => {
    const kopEindY = 150;
    for (const inhoud of [20, 60, 150, 300, 400]) {
      const start = berekenInhoudStart(inhoud, kopEindY, false);
      expect(start - kopEindY, `te veel lucht bij een inhoud van ${inhoud} punten`).toBeLessThanOrEqual(36);
    }
  });

  it("nooit meer dan een kwart van de inhoud zelf", () => {
    const kopEindY = 150;
    for (const inhoud of [20, 40, 60, 100, 144]) {
      const start = berekenInhoudStart(inhoud, kopEindY, false);
      expect(start - kopEindY, `de lucht is groot tegenover de inhoud (${inhoud} punten)`).toBeLessThanOrEqual(
        inhoud * 0.25 + 0.001,
      );
    }
  });

  it("een kort blad krijgt nog altijd wel enige rust boven de inhoud", () => {
    const start = berekenInhoudStart(200, 150, false);
    expect(start).toBeGreaterThan(150);
  });
});

describe("een ingetogen vlak zonder kop houdt geen lege regel open", () => {
  it("een lege kop kost geen regel, een gevulde kop wel", () => {
    expect(kaartvlakKopHoogte("")).toBe(0);
    expect(kaartvlakKopHoogte(null)).toBe(0);
    expect(kaartvlakKopHoogte("   ")).toBe(0);
    expect(kaartvlakKopHoogte("Jouw eigen woorden")).toBeGreaterThan(0);
    expect(citaatKopHoogte("")).toBe(0);
    expect(citaatKopHoogte(undefined)).toBe(0);
    expect(citaatKopHoogte("  ")).toBe(0);
    expect(citaatKopHoogte("Jouw eigen antwoord")).toBeGreaterThan(0);
  });

  it("de regel die wegvalt is ongeveer een tekstregel hoog, niet meer", () => {
    expect(kaartvlakKopHoogte("kop")).toBeLessThanOrEqual(24);
    expect(citaatKopHoogte("kop")).toBeLessThanOrEqual(24);
  });
});
