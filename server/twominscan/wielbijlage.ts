// =============================================================================
// server/twominscan/wielbijlage.ts — wielpagina achteraan het gedownloade rapport
// -----------------------------------------------------------------------------
// Waarom deze module bestaat
//   De webweergave van het 2MINSCAN-rapport toont sinds kort een pagina met de
//   plaats van de deelnemer op het temperamentenwiel. De knop "Download als PDF"
//   haalt echter het vooraf ontwikkelde rapport op (24 profielen × 5 talen,
//   eigen layout) en dat bestand kent die pagina niet. Wie downloadde, kreeg dus
//   een rapport zonder de eigen wielpositie, terwijl het scherm ze wel toonde.
//   Deze module plakt die ene pagina achteraan de gedownloade PDF.
//
// Waarom het wiel als afbeelding meekomt uit de browser
//   Het wiel wordt getekend door client/src/temperamentenwiel/wiel.ts, en de 24
//   posities met hun vaste kleurvolgorde staan in
//   client/src/temperamentenwiel/posities.ts. Die kleurvolgorde per positie is
//   gemeten op de speelmat en mag niet wijzigen. Zou de server het wiel zelf
//   natekenen, dan bestonden er twee waarheden en zou één van beide vroeg of
//   laat afwijken. Daarom stuurt de browser het al getekende wiel mee als PNG en
//   legt de server enkel de pagina op: kop, inleiding, beeld en twee regels.
//
// Waarom de teksten uit de browser komen
//   De vertalingen van dit instrument staan in
//   client/src/twominscan/vertalingen.json. De browser stuurt de al vertaalde
//   regels mee, zodat er geen tweede vertaaltabel op de server ontstaat.
//   De lengtes worden begrensd en de tekst wordt nooit als opmaak of code
//   uitgevoerd: pdf-lib schrijft ze als platte tekst.
//
// Faalgedrag
//   Deze pagina is een aanvulling, geen voorwaarde. Lukt het bijvoegen niet,
//   dan komt het oorspronkelijke rapport ongewijzigd terug. Een deelnemer mag
//   nooit zonder rapport achterblijven omdat een bijlage niet lukte.
// =============================================================================
import { z } from "zod";

/** Vorm van een wielpositie, bv. "24-44" of "128-148". */
const WIELPOSITIE = /^\d{2,3}-\d{2,3}$/;

// Ruim genoeg voor een wiel van ongeveer 900 pixels, krap genoeg om te
// voorkomen dat iemand via deze weg megabytes in het bericht duwt. De route
// zelf valt onder de gewone berichtgrens van 1 MB (server/bodygrens.ts).
const MAX_PNG_TEKENS = 900_000;

export const wielbijlageSchema = z.object({
  png: z
    .string()
    .startsWith("data:image/png;base64,")
    .max(MAX_PNG_TEKENS),
  wielpositie: z.string().trim().regex(WIELPOSITIE),
  kop: z.string().trim().min(1).max(120),
  titel: z.string().trim().min(1).max(160),
  lead: z.string().trim().min(1).max(1200),
  positieLabel: z.string().trim().min(1).max(60),
  kleurvolgorde: z.string().trim().min(1).max(120),
  sectorLabel: z.string().trim().min(1).max(120),
  sectorTitel: z.string().trim().min(1).max(60),
});

export type Wielbijlage = z.infer<typeof wielbijlageSchema>;

// Kleuren uit de huisstijl van het rapport (client/src/twominscan/theme.ts).
const PETROL = { r: 0x0f / 255, g: 0x4c / 255, b: 0x4a / 255 };
const TEAL = { r: 0x1c / 255, g: 0x7a / 255, b: 0x76 / 255 };
const INKT = { r: 0x1f / 255, g: 0x2a / 255, b: 0x28 / 255 };
const GRIJS = { r: 0x66 / 255, g: 0x6b / 255, b: 0x6a / 255 };

const MARGE = 56;

/** Breekt tekst op woordgrenzen af binnen de opgegeven breedte. */
function regels(
  tekst: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  grootte: number,
  breedte: number,
): string[] {
  const uit: string[] = [];
  let regel = "";
  for (const woord of tekst.split(/\s+/)) {
    const kandidaat = regel ? `${regel} ${woord}` : woord;
    if (font.widthOfTextAtSize(kandidaat, grootte) <= breedte) {
      regel = kandidaat;
    } else {
      if (regel) uit.push(regel);
      regel = woord;
    }
  }
  if (regel) uit.push(regel);
  return uit;
}

/**
 * Voegt één wielpagina toe achteraan het rapport. Geeft bij twijfel de
 * oorspronkelijke buffer terug: liever een rapport zonder bijlage dan geen
 * rapport.
 */
export async function voegWielpaginaToe(
  pdfBuffer: Buffer,
  bijlage: Wielbijlage,
): Promise<Buffer> {
  try {
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const doc = await PDFDocument.load(pdfBuffer);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const vet = await doc.embedFont(StandardFonts.HelveticaBold);

    // Neem het formaat over van pagina 1, zodat de bijlage exact op de rest van
    // het rapport past in plaats van een eigen A4-maat te verzinnen.
    const eerste = doc.getPages()[0];
    const breedte = eerste?.getWidth() ?? 595.28;
    const hoogte = eerste?.getHeight() ?? 841.89;
    const pagina = doc.addPage([breedte, hoogte]);
    const tekstBreedte = breedte - 2 * MARGE;

    const petrol = rgb(PETROL.r, PETROL.g, PETROL.b);
    const teal = rgb(TEAL.r, TEAL.g, TEAL.b);
    const inkt = rgb(INKT.r, INKT.g, INKT.b);
    const grijs = rgb(GRIJS.r, GRIJS.g, GRIJS.b);

    let y = hoogte - MARGE;

    // Kicker.
    pagina.drawText(bijlage.kop.toUpperCase(), {
      x: MARGE,
      y: y - 10,
      size: 9,
      font: vet,
      color: teal,
    });
    y -= 30;

    // Titel, over meerdere regels wanneer nodig.
    for (const regel of regels(bijlage.titel, vet, 20, tekstBreedte)) {
      pagina.drawText(regel, { x: MARGE, y: y - 20, size: 20, font: vet, color: petrol });
      y -= 26;
    }
    y -= 6;
    pagina.drawRectangle({ x: MARGE, y, width: tekstBreedte, height: 1.5, color: petrol });
    y -= 20;

    // Inleiding.
    for (const regel of regels(bijlage.lead, font, 10.5, tekstBreedte)) {
      pagina.drawText(regel, { x: MARGE, y: y - 11, size: 10.5, font, color: inkt });
      y -= 15;
    }
    y -= 14;

    // Het wiel zelf, gecentreerd en zo groot als de resterende hoogte toelaat.
    const png = await doc.embedPng(bijlage.png);
    const beschikbaar = y - MARGE - 74; // ruimte voor de twee regels onderaan
    const zijde = Math.max(120, Math.min(tekstBreedte, beschikbaar));
    const schaal = zijde / Math.max(png.width, png.height);
    const bBreedte = png.width * schaal;
    const bHoogte = png.height * schaal;
    pagina.drawImage(png, {
      x: MARGE + (tekstBreedte - bBreedte) / 2,
      y: y - bHoogte,
      width: bBreedte,
      height: bHoogte,
    });
    y -= bHoogte + 22;

    // Twee regels met de harde gegevens: positie met kleurvolgorde, en sector.
    const regelPaar: Array<[string, string]> = [
      [bijlage.positieLabel, `${bijlage.wielpositie} · ${bijlage.kleurvolgorde}`],
      [bijlage.sectorTitel, bijlage.sectorLabel],
    ];
    for (const [label, waarde] of regelPaar) {
      pagina.drawText(label.toUpperCase(), {
        x: MARGE,
        y: y - 9,
        size: 8,
        font: vet,
        color: grijs,
      });
      const labelBreedte = Math.max(vet.widthOfTextAtSize(label.toUpperCase(), 8) + 14, 96);
      for (const regel of regels(waarde, vet, 11, tekstBreedte - labelBreedte)) {
        pagina.drawText(regel, {
          x: MARGE + labelBreedte,
          y: y - 9,
          size: 11,
          font: vet,
          color: inkt,
        });
        y -= 15;
      }
      y -= 6;
    }

    const uit = await doc.save();
    return Buffer.from(uit);
  } catch (e: any) {
    console.error("[twominscan] wielpagina bijvoegen mislukt:", e?.message ?? e);
    return pdfBuffer;
  }
}
