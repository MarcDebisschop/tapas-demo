/**
 * server/gids/pdf-engine.ts  —  NIEUW BESTAND (Werkprotocol Regel 2)
 * -----------------------------------------------------------------------------
 * Zelfstandige, drukklare PDF-engine voor De Instrumentengids.
 *
 * Hergebruikt de GEVALIDEERDE bouwstenen uit server/hdd/pdf/ zonder ook maar
 * één van die bestanden aan te raken (Regel 1 & 2):
 *   - theme.ts   → A4-geometrie (PAGE_W/H, MARGIN), palet, registerFonts()
 *   - fonts.ts   → ingebedde DMSans + Inter (via registerFonts)
 *
 * De HDD-Layout-chrome ("HUMAN DUE DILIGENCE"-header) is HDD-specifiek, dus de
 * gids krijgt een eigen, merkgetrouwe chrome + cover. De low-level teken-API
 * (pdfkit) en alle geometrie/fonts zijn identiek → byte-consistente kwaliteit.
 *
 * Palet-uitbreiding: naast het HDD-palet gebruiken we de exacte business- en
 * education-tinten van het platform (afgeleid uit client/src/index.css:
 *   --werk  = 192 60% 34%  → #22808c (business, teal-blauw)
 *   --studie= 34 68% 42%   → #b47318 (education, amber)
 * ). Deze zijn hier hardgecodeerd als hex zodat de PDF onafhankelijk van CSS is.
 */
import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import {
  PAGE_W,
  PAGE_H,
  MARGIN,
  MM,
  CONTENT_W,
  registerFonts,
  F,
  INK,
  INK2,
  GOLD,
  SUB,
  LINE,
  WHITE,
} from "../hdd/pdf/theme";

// ---- Gids-specifiek palet (exact uit het platform) ----
export const WERK = "#22808c"; // business — hsl(192 60% 34%)
export const STUDIE = "#b47318"; // education — hsl(34 68% 42%)
export const SPORT = "#f0611e"; // sport — hsl(20 88% 50%), energiek/atletisch oranje
export const BODYCOL = "#283238";
export const SURFACE = "#f7f8f9";
export const SURFACE2 = "#eef3f4";
export const PAPER = "#ffffff";

export type Orientatie = "business" | "education" | "beide" | "sport";

export function kleurVoor(o: Orientatie): string {
  if (o === "business") return WERK;
  if (o === "education") return STUDIE;
  if (o === "sport") return SPORT; // eigen sportieve categorie
  return GOLD; // "beide" krijgt de neutrale/gouden merk-accent als primaire tint
}

export function orientatieLabelPdf(o: Orientatie): string {
  if (o === "business") return "BUSINESS";
  if (o === "education") return "EDUCATION";
  if (o === "sport") return "SPORT";
  return "BUSINESS & EDUCATION";
}

// ---- Merkbeelden (uit client/public/jester-galerij) ----
function publicImgPad(bestand: string): string | null {
  // Zowel bij dev (cwd = repo-root) als na build proberen we meerdere locaties.
  const kandidaten = [
    path.join(process.cwd(), "client/public/jester-galerij/assets/img", bestand),
    path.join(process.cwd(), "dist/public/jester-galerij/assets/img", bestand),
    path.join(process.cwd(), "public/jester-galerij/assets/img", bestand),
  ];
  for (const p of kandidaten) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/** Geometrie-constanten voor de body. */
const TOP_OF_BODY = 24 * MM;
const BODY_BOTTOM = 15 * MM;
const BODY_FLOOR = PAGE_H - BODY_BOTTOM;

/**
 * Lichte, merkgetrouwe layout-engine met y-cursor, auto page-breaks en chrome.
 * Bewust géén afhankelijkheid van de HDD-Layout (die heeft vaste HDD-header).
 */
export class GidsLayout {
  doc: PDFKit.PDFDocument;
  y: number;
  page = 1;
  titel: string;
  ondertitel: string;

  constructor(doc: PDFKit.PDFDocument, titel: string, ondertitel: string) {
    this.doc = doc;
    this.titel = titel;
    this.ondertitel = ondertitel;
    this.y = TOP_OF_BODY;
  }

  remaining(): number {
    return BODY_FLOOR - this.y;
  }

  ensure(need: number) {
    if (this.remaining() < need) this.newBodyPage();
  }

  guardMm(needMm: number) {
    this.ensure(needMm * MM);
  }

  advance(dy: number) {
    this.y += dy;
  }

  newBodyPage() {
    this.doc.addPage();
    this.page += 1;
    this.paintChrome();
    this.y = TOP_OF_BODY;
  }

  paintChrome() {
    const c = this.doc;
    // header
    c.font(F.dmBold).fontSize(8.5).fillColor(INK);
    c.text(this.titel.toUpperCase(), MARGIN, 13 * MM - 8.5, { lineBreak: false });
    c.font(F.inter).fontSize(7.5).fillColor(SUB);
    c.text(this.ondertitel, PAGE_W - MARGIN - 320, 13 * MM - 7.5, {
      width: 320,
      align: "right",
      lineBreak: false,
    });
    c.lineWidth(0.6).strokeColor(LINE);
    c.moveTo(MARGIN, 15.5 * MM).lineTo(PAGE_W - MARGIN, 15.5 * MM).stroke();
    // footer
    c.moveTo(MARGIN, PAGE_H - 12.5 * MM).lineTo(PAGE_W - MARGIN, PAGE_H - 12.5 * MM).stroke();
    c.font(F.inter).fontSize(7).fillColor(SUB);
    const fyTop = PAGE_H - 9.2 * MM - 7;
    c.text("TaPas Platform · De Instrumentengids", MARGIN, fyTop, { lineBreak: false });
    c.text(`Pagina ${this.page}`, PAGE_W - MARGIN - 120, fyTop, {
      width: 120,
      align: "right",
      lineBreak: false,
    });
  }

  /** Eenvoudige tekstalinea (wrapt automatisch, links uitgelijnd). */
  paragraph(
    text: string,
    opts: {
      font?: string;
      size?: number;
      leading?: number;
      color?: string;
      x?: number;
      width?: number;
      after?: number;
    } = {}
  ) {
    const c = this.doc;
    const font = opts.font ?? F.inter;
    const size = opts.size ?? 9.8;
    const leading = opts.leading ?? 14.8;
    const color = opts.color ?? BODYCOL;
    const x = opts.x ?? MARGIN;
    const width = opts.width ?? CONTENT_W;
    c.font(font).fontSize(size).fillColor(color);
    const h = c.heightOfString(text, { width, lineGap: leading - size });
    // page-break indien nodig
    if (this.remaining() < h) this.newBodyPage();
    c.font(font).fontSize(size).fillColor(color);
    c.text(text, x, this.y, { width, lineGap: leading - size });
    this.y += h + (opts.after ?? 6);
  }
}

/** Zet een nieuw A4-document op met ingebedde fonts. */
export function nieuwGidsDocument(titel: string, onderwerp: string): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    size: [PAGE_W, PAGE_H],
    autoFirstPage: false,
    margin: 0,
    bufferPages: true,
  });
  doc.info.Author = "Perplexity Computer";
  doc.info.Title = titel;
  doc.info.Subject = onderwerp;
  registerFonts(doc);
  return doc;
}

/**
 * Merkgetrouwe donkere cover voor de gids-PDF's (fiche én brochure).
 * Reproduceert de premium HDD-coversfeer maar toegespitst op de gids:
 *   - donkere achtergrond met accentband en subtiele driehoeken
 *   - gouden embleem (indien beschikbaar) rechtsboven
 *   - grote titel + gouden regel + ondertitel
 *   - onderaan: context/uitgever-blok
 */
export function tekenCover(
  doc: PDFKit.PDFDocument,
  opts: {
    kicker: string;
    titel1: string;
    titel2?: string;
    ondertitel: string;
    accent: string;
    contextLabel: string;
    contextTekst: string;
    datum: string;
  }
) {
  const W = PAGE_W;
  const H = PAGE_H;
  const c = doc;
  const LX = MARGIN;

  c.rect(0, 0, W, H).fill(INK);
  const bandH = H * 0.31;
  c.rect(0, 0, W, bandH).fill(INK2);

  // subtiele driehoeken rechtsboven
  c.save().fillOpacity(0.55).fillColor("#1a4253");
  c.moveTo(W * 0.84, 0).lineTo(W, 0).lineTo(W, H * 0.22).fill();
  c.restore();
  c.save().fillOpacity(0.45).fillColor("#21536a");
  c.moveTo(W * 0.93, 0).lineTo(W, 0).lineTo(W, H * 0.12).fill();
  c.restore();
  c.fillOpacity(1);

  // gouden embleem rechtsboven (indien aanwezig)
  const embleem = publicImgPad("embleem-goud.png");
  if (embleem) {
    try {
      const grootte = 30 * MM;
      c.image(embleem, W - MARGIN - grootte, 18 * MM, {
        width: grootte,
        height: grootte,
      });
    } catch {
      /* beeld optioneel */
    }
  }

  // kicker
  c.fillColor("#7fa9b8").font(F.interSemi).fontSize(8.5);
  c.text(`${opts.kicker.toUpperCase()}   ·   ${opts.datum.toUpperCase()}`, LX, 26 * MM, {
    lineBreak: false,
  });
  c.lineWidth(0.8).strokeColor("#2b4a58");
  c.moveTo(LX, 32 * MM).lineTo(W - MARGIN, 32 * MM).stroke();

  // accent-eyebrow
  c.fillColor(GOLD).font(F.interSemi).fontSize(11);
  c.text("TAPAS PLATFORM", LX, 46 * MM, { lineBreak: false });

  // grote titel
  c.fillColor(WHITE).font(F.dmBold).fontSize(42);
  c.text(opts.titel1, LX, 60 * MM, { lineBreak: false });
  if (opts.titel2) {
    c.text(opts.titel2, LX, 78 * MM, { lineBreak: false });
  }
  const regelY = opts.titel2 ? 98 * MM : 80 * MM;
  c.rect(LX, regelY, 48 * MM, 2.6).fill(GOLD);

  // ondertitel
  c.fillColor("#cfe0e6").font(F.inter).fontSize(13.5);
  c.text(opts.ondertitel, LX, regelY + 8 * MM, {
    width: W - 2 * MARGIN - 34 * MM,
    lineGap: 4,
  });

  // onderste context-blok
  c.lineWidth(0.8).strokeColor("#2b4a58");
  c.moveTo(LX, H - 78 * MM).lineTo(W - MARGIN, H - 78 * MM).stroke();
  c.fillColor("#7fa9b8").font(F.interSemi).fontSize(8);
  c.text(opts.contextLabel.toUpperCase(), LX, H - 72 * MM, { lineBreak: false });
  c.fillColor("#cfe0e6").font(F.inter).fontSize(10.5);
  c.text(opts.contextTekst, LX, H - 66 * MM, {
    width: W - 2 * MARGIN,
    lineGap: 3,
  });

  c.fillColor(WHITE).font(F.interSemi).fontSize(9.5);
  c.text("TaPas Platform", LX, H - 24 * MM, { lineBreak: false });
  c.fillColor("#7f9aa4").font(F.inter).fontSize(7.8);
  c.text(
    "Talentgericht ontwikkelen — instrumenten voor business én onderwijs.",
    LX,
    H - 19 * MM,
    { lineBreak: false }
  );
}

/** Sectie-titel binnen de body (met gouden regel). */
export function sectieKop(L: GidsLayout, kicker: string, titel: string, accent = GOLD) {
  L.guardMm(30);
  const c = L.doc;
  c.font(F.interSemi).fontSize(9).fillColor(accent);
  c.text(kicker.toUpperCase(), MARGIN, L.y, { lineBreak: false });
  L.advance(13);
  c.font(F.dmBold).fontSize(19).fillColor(INK);
  const h = c.heightOfString(titel, { width: CONTENT_W });
  c.text(titel, MARGIN, L.y, { width: CONTENT_W });
  L.advance(h + 4);
  c.lineWidth(1.4).strokeColor(accent);
  c.moveTo(MARGIN, L.y).lineTo(MARGIN + CONTENT_W, L.y).stroke();
  L.advance(10);
}

/** Kleine veld-kop (bv. "Welke vragen beantwoordt het?"). */
export function veldKop(L: GidsLayout, tekst: string, accent = GOLD) {
  L.guardMm(14);
  const c = L.doc;
  c.font(F.dmBold).fontSize(11.5).fillColor(INK);
  const h = c.heightOfString(tekst, { width: CONTENT_W });
  c.text(tekst, MARGIN, L.y, { width: CONTENT_W });
  L.advance(h + 3);
  // accent-tikje
  c.lineWidth(2).strokeColor(accent);
  c.moveTo(MARGIN, L.y).lineTo(MARGIN + 14 * MM, L.y).stroke();
  L.advance(6);
}

/** Info-callout (getinte doos met label + tekst). */
export function calloutBox(
  L: GidsLayout,
  label: string,
  tekst: string,
  accent = GOLD,
  bg = SURFACE2
) {
  const c = L.doc;
  const padX = 12;
  const padY = 10;
  const innerW = CONTENT_W - padX * 2;
  c.font(F.inter).fontSize(9.4);
  const bodyH = c.heightOfString(tekst, { width: innerW, lineGap: 4 });
  const boxH = padY * 2 + 14 + bodyH;
  L.ensure(boxH + 6);
  const top = L.y;
  c.roundedRect(MARGIN, top, CONTENT_W, boxH, 6).fill(bg);
  c.rect(MARGIN, top, 3, boxH).fill(accent);
  c.font(F.interSemi).fontSize(8).fillColor(accent);
  c.text(label.toUpperCase(), MARGIN + padX, top + padY, { lineBreak: false });
  c.font(F.inter).fontSize(9.4).fillColor(BODYCOL);
  c.text(tekst, MARGIN + padX, top + padY + 14, { width: innerW, lineGap: 4 });
  L.y = top + boxH + 8;
}

export { PAGE_W, PAGE_H, MARGIN, MM, CONTENT_W, F, INK, INK2, GOLD, SUB, LINE, WHITE };
