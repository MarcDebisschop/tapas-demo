// Wielpagina achteraan het gedownloade 2MINSCAN-rapport.
//
// Wat hier geborgd wordt
//   1. de bijlage voegt precies één pagina toe en laat de bestaande pagina's
//      ongemoeid, want het vooraf ontwikkelde rapport is het bindende document;
//   2. de nieuwe pagina heeft hetzelfde formaat als pagina 1;
//   3. de harde gegevens (wielpositie, kleurvolgorde, sector) staan als tekst in
//      de PDF en niet enkel in het beeld;
//   4. een onbruikbaar beeld levert het oorspronkelijke rapport op in plaats van
//      een foutmelding: een deelnemer mag nooit zonder rapport achterblijven;
//   5. het schema weigert een te groot of verkeerd gevormd bericht.
import { describe, expect, it } from "vitest";
import { PDFDocument, rgb } from "pdf-lib";
import { voegWielpaginaToe, wielbijlageSchema } from "../server/twominscan/wielbijlage";

/** Klein rapport van twee pagina's om tegen te testen. */
async function maakRapport(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.addPage([595.28, 841.89]).drawRectangle({
    x: 20,
    y: 20,
    width: 100,
    height: 40,
    color: rgb(0.9, 0.9, 0.9),
  });
  doc.addPage([595.28, 841.89]);
  return Buffer.from(await doc.save());
}

/** Eenvoudig geldig PNG-beeld (1×1 pixel) als data-URL. */
async function maakPng(): Promise<string> {
  const doc = await PDFDocument.create();
  // pdf-lib kan zelf geen PNG maken; een vaste, geldige 1×1 PNG volstaat.
  void doc;
  return (
    "data:image/png;base64," +
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
  );
}

const bijlage = {
  wielpositie: "24-44",
  kop: "Jouw plaats op het temperamentenwiel",
  titel: "Waar jouw energie op het wiel staat",
  lead:
    "Elke positie op het wiel heeft haar eigen volgorde van vier energiekleuren: " +
    "de eerste kleur in de buitenste band, daarna de tweede en de derde, en in de " +
    "kern de kleur die energie kost.",
  positieLabel: "Wielpositie",
  kleurvolgorde: "Rood Geel/Groen-Blauw",
  sectorTitel: "Sector op het wiel",
  sectorLabel: "3 · Toekomstgericht leiderschap",
};

describe("2MINSCAN — wielpagina achteraan het rapport", () => {
  it("voegt precies één pagina toe met hetzelfde formaat", async () => {
    const rapport = await maakRapport();
    const uit = await voegWielpaginaToe(rapport, { ...bijlage, png: await maakPng() });
    const doc = await PDFDocument.load(uit);
    expect(doc.getPageCount()).toBe(3);
    const eerste = doc.getPages()[0];
    const laatste = doc.getPages()[2];
    expect(Math.round(laatste.getWidth())).toBe(Math.round(eerste.getWidth()));
    expect(Math.round(laatste.getHeight())).toBe(Math.round(eerste.getHeight()));
  });

  it("zet de wielpositie, kleurvolgorde en sector als tekst in de PDF", async () => {
    const rapport = await maakRapport();
    const uit = await voegWielpaginaToe(rapport, { ...bijlage, png: await maakPng() });
    const pdfParse = (await import("pdf-parse")).default;
    const tekst = (await pdfParse(uit)).text;
    for (const stuk of ["24-44", "Rood", "Toekomstgericht", "WIELPOSITIE"]) {
      expect(tekst.includes(stuk), `mist ${stuk}`).toBe(true);
    }
  });

  it("geeft het oorspronkelijke rapport terug wanneer het beeld onbruikbaar is", async () => {
    const rapport = await maakRapport();
    const uit = await voegWielpaginaToe(rapport, {
      ...bijlage,
      png: "data:image/png;base64,dit-is-geen-png",
    });
    const doc = await PDFDocument.load(uit);
    expect(doc.getPageCount()).toBe(2);
  });

  it("weigert een bericht dat geen PNG-data-URL is", () => {
    const uit = wielbijlageSchema.safeParse({ ...bijlage, png: "https://ergens/wiel.png" });
    expect(uit.success).toBe(false);
  });

  it("weigert een onmogelijk groot beeld", () => {
    const uit = wielbijlageSchema.safeParse({
      ...bijlage,
      png: "data:image/png;base64," + "A".repeat(1_000_000),
    });
    expect(uit.success).toBe(false);
  });

  it("weigert een wielpositie die niet de vorm van de speelmat heeft", () => {
    const uit = wielbijlageSchema.safeParse({
      ...bijlage,
      png: "data:image/png;base64,AAAA",
      wielpositie: "kwadrant rechtsboven",
    });
    expect(uit.success).toBe(false);
  });
});
