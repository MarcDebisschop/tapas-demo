/**
 * Component builders for the flagship HDD PDF — reproduce the reportlab
 * helpers from build_flagship_pdf.py (chip, headings, tables, callout,
 * member cards, hard Q&A, gauge, dark cover, section divider).
 */
import {
  PAGE_W, PAGE_H, MARGIN, CONTENT_W, MM,
  INK, INK2, ACCENT, SUB, LINE, SURFACE, SURFACE2, WHITE, GOLD, GREEN, AMBER, RED,
  BODYCOL, F, VERDICT_COLOR, BAND_COLOR, bandColor,
} from "./theme";
import { Layout } from "./layout";

const PALE = (hex: string) => hex; // explicit pale bg colors passed directly

// Uppercase a plain-text label after decoding HTML entities, so e.g.
// "...Verification &amp; Governance" renders as "...VERIFICATION & GOVERNANCE"
// rather than the broken "&AMP;" (uppercasing before decoding breaks the
// lowercase-only entity regex in parseRuns).
function upperLabel(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .toUpperCase();
}

// ---- text style constants (size, leading, font, color, spaceAfter) ----
export const ST = {
  chapnum: { font: F.interSemi, size: 9, leading: 12, color: GOLD, after: 2 },
  h1: { font: F.dmBold, size: 20, leading: 24, color: INK, after: 4 },
  h1sub: { font: F.inter, size: 10.5, leading: 15, color: SUB, after: 10 },
  h2: { font: F.dmBold, size: 12.5, leading: 16, color: INK, before: 10, after: 5 },
  body: { font: F.inter, size: 9.6, leading: 14.8, color: BODYCOL, after: 7 },
  lead: { font: F.interMed, size: 11, leading: 16.5, color: INK2, after: 9 },
  bullet: { font: F.inter, size: 9.4, leading: 14.2, color: "#2f3a40", after: 4 },
  th: { font: F.interSemi, size: 8.4, leading: 11, color: INK },
  td: { font: F.inter, size: 8.7, leading: 12.2, color: "#2f3a40" },
  tds: { font: F.interSemi, size: 8.7, leading: 12.2, color: INK },
  cardT: { font: F.dmBold, size: 10, leading: 13, color: INK, after: 2 },
  cardL: { font: F.inter, size: 8.2, leading: 11.6, color: "#3a444a" },
  calLbl: { font: F.interSemi, size: 7.6, leading: 10, color: ACCENT, after: 2 },
  cal: { font: F.inter, size: 9, leading: 13.5, color: "#33414a" },
  fig: { font: F.inter, size: 7.8, leading: 10.5, color: SUB, before: 3 },
  qaQ: { font: F.dmBold, size: 10.5, leading: 14, color: INK, after: 3 },
  qaV: { font: F.interSemi, size: 9.4, leading: 13, color: ACCENT, after: 3 },
};

// ---- simple paragraph helpers ----
export function para(L: Layout, text: string, justify = true) {
  const runs = L.parseRuns(text, F.inter, BODYCOL);
  const h = L.drawRuns(runs, {
    size: ST.body.size, leading: ST.body.leading,
    align: justify ? "justify" : "left",
  });
  L.advance(h + ST.body.after);
}

export function lead(L: Layout, text: string) {
  const runs = L.parseRuns(text, F.interMed, INK2);
  const h = L.drawRuns(runs, { size: ST.lead.size, leading: ST.lead.leading, align: "left" });
  L.advance(h + ST.lead.after);
}

export function subhead(L: Layout, text: string) {
  L.advance(ST.h2.before!);
  const runs = L.parseRuns(text, F.dmBold, INK);
  const h = L.drawRuns(runs, { size: ST.h2.size, leading: ST.h2.leading, align: "left" });
  L.advance(h + ST.h2.after);
}

export function bullets(L: Layout, items: string[]) {
  const c = L.doc;
  for (const it of items) {
    const runs = L.parseRuns(it, F.inter, "#2f3a40");
    // bullet dot — L.y is the top of the line (from-top)
    c.font(F.inter).fontSize(ST.bullet.size).fillColor("#2f3a40");
    c.text("\u2022", MARGIN + 2, L.y, { lineBreak: false });
    const h = L.drawRuns(runs, {
      size: ST.bullet.size, leading: ST.bullet.leading, align: "left", indent: 13,
    });
    L.advance(h + ST.bullet.after);
  }
}

export function chapterHeading(L: Layout, numLabel: string, title: string, subtitle: string) {
  L.guardMm(0); // start cleanly
  const c = L.doc;
  // chapter number
  let runs = L.parseRuns(upperLabel(numLabel), F.interSemi, GOLD);
  let h = L.drawRuns(runs, { size: ST.chapnum.size, leading: ST.chapnum.leading, align: "left" });
  L.advance(h + ST.chapnum.after);
  // title
  runs = L.parseRuns(title, F.dmBold, INK);
  h = L.drawRuns(runs, { size: ST.h1.size, leading: ST.h1.leading, align: "left" });
  L.advance(h + ST.h1.after);
  // subtitle
  if (subtitle) {
    runs = L.parseRuns(subtitle, F.inter, SUB);
    h = L.drawRuns(runs, { size: ST.h1sub.size, leading: ST.h1sub.leading, align: "left" });
    L.advance(h + ST.h1sub.after);
  }
  // gold rule
  L.advance(2);
  c.lineWidth(1.4).strokeColor(GOLD);
  c.moveTo(MARGIN, L.y).lineTo(MARGIN + CONTENT_W, L.y).stroke();
  L.advance(9);
}

// ---- callout box ----
export function callout(L: Layout, label: string, text: string, color = ACCENT, bg = "#eef5f7") {
  const c = L.doc;
  const padX = 12, padTop = 9, padBottom = 9;
  const innerW = CONTENT_W - padX * 2;
  // measure label + body height
  const labelRuns = L.parseRuns(upperLabel(label), F.interSemi, color);
  const bodyRuns = L.parseRuns(text, F.inter, "#33414a");
  const labelH = measureRuns(L, labelRuns, innerW, ST.calLbl.size, ST.calLbl.leading);
  const bodyH = measureRuns(L, bodyRuns, innerW, ST.cal.size, ST.cal.leading);
  const boxH = padTop + labelH + 2 + bodyH + padBottom;
  L.ensure(boxH + 4);
  const topY = L.y; // top of box (from-top)
  // background
  c.rect(MARGIN, topY, CONTENT_W, boxH).fill(bg);
  // left bar
  c.rect(MARGIN, topY, 3, boxH).fill(color);
  // text
  L.y = topY + padTop;
  L.drawRuns(labelRuns, { x: MARGIN + padX, width: innerW, size: ST.calLbl.size, leading: ST.calLbl.leading, align: "left" });
  L.advance(labelH + 2);
  L.drawRuns(bodyRuns, { x: MARGIN + padX, width: innerW, size: ST.cal.size, leading: ST.cal.leading, align: "left" });
  L.y = topY + boxH;
}

function measureRuns(L: Layout, runs: ReturnType<Layout["parseRuns"]>, width: number, size: number, leading: number): number {
  // reuse private wrap by drawing into a measure pass: replicate wrapping count
  // We approximate by a lightweight re-wrap identical to drawRuns logic.
  const c = L.doc;
  type Tok = { w: string; font: string };
  const toks: Tok[] = [];
  for (const r of runs) {
    for (const p of r.text.split(/(\s+)/)) {
      if (p === "" || /^\s+$/.test(p)) continue;
      toks.push({ w: p, font: r.font });
    }
  }
  let lines = 1, lineW = 0;
  for (let i = 0; i < toks.length; i++) {
    c.font(toks[i].font).fontSize(size);
    const wlen = c.widthOfString(toks[i].w);
    const sp = lineW ? c.widthOfString(" ") : 0;
    if (lineW + sp + wlen > width && lineW) {
      lines++;
      lineW = wlen;
    } else {
      lineW += sp + wlen;
    }
  }
  return lines * leading;
}

// ---- chip (band-coloured bold word) ----
export function chipColor(text: string): string {
  return bandColor(text);
}

// ---- data table ----
export interface TableSpec {
  headers: string[];
  rows: string[][];
  colFracs?: number[];
  bandCol?: number; // index of column whose value is a band chip
}

export function dataTable(L: Layout, spec: TableSpec) {
  const c = L.doc;
  const ncol = spec.headers.length;
  const colW = spec.colFracs
    ? spec.colFracs.map((f) => CONTENT_W * f)
    : Array(ncol).fill(CONTENT_W / ncol);
  const padX = 7, padY = 5.5;

  // measure each row height
  const cellRunsFor = (v: string, ci: number, isHeader: boolean) => {
    if (isHeader) return L.parseRuns(v, ST.th.font, ST.th.color);
    if (spec.bandCol === ci && bandColorKnown(v)) return L.parseRuns(`<b>${v}</b>`, F.interSemi, bandColor(v));
    if (ci === 0) return L.parseRuns(v, ST.tds.font, ST.tds.color);
    return L.parseRuns(v, ST.td.font, ST.td.color);
  };
  const rowHeight = (cells: string[], isHeader: boolean) => {
    let maxH = 0;
    for (let ci = 0; ci < ncol; ci++) {
      const runs = cellRunsFor(cells[ci] ?? "", ci, isHeader);
      const size = isHeader ? ST.th.size : ST.td.size;
      const leading = isHeader ? ST.th.leading : ST.td.leading;
      const h = measureRuns(L, runs, colW[ci] - padX * 2, size, leading);
      if (h > maxH) maxH = h;
    }
    return maxH + padY * 2;
  };

  const headerH = rowHeight(spec.headers, true);

  const drawRow = (cells: string[], isHeader: boolean, rh: number, zebra: number) => {
    const topY = L.y; // top of row (from-top)
    // backgrounds
    if (isHeader) {
      c.rect(MARGIN, topY, CONTENT_W, rh).fill(SURFACE2);
    } else if (zebra % 2 === 1) {
      c.rect(MARGIN, topY, CONTENT_W, rh).fill(SURFACE);
    }
    // cell text
    let cx = MARGIN;
    for (let ci = 0; ci < ncol; ci++) {
      const runs = cellRunsFor(cells[ci] ?? "", ci, isHeader);
      const size = isHeader ? ST.th.size : ST.td.size;
      const leading = isHeader ? ST.th.leading : ST.td.leading;
      const ch = measureRuns(L, runs, colW[ci] - padX * 2, size, leading);
      // vertical-center within the row
      L.y = topY + (rh - ch) / 2;
      L.drawRuns(runs, { x: cx + padX, width: colW[ci] - padX * 2, size, leading, align: "left" });
      cx += colW[ci];
    }
    L.y = topY + rh; // cursor to bottom edge of row
    // header underline accent / row separator at the bottom edge
    if (isHeader) {
      c.lineWidth(0.7).strokeColor(ACCENT);
      c.moveTo(MARGIN, L.y).lineTo(MARGIN + CONTENT_W, L.y).stroke();
    } else {
      c.lineWidth(0.4).strokeColor(LINE);
      c.moveTo(MARGIN, L.y).lineTo(MARGIN + CONTENT_W, L.y).stroke();
    }
  };

  // keep header + first row together
  L.ensure(headerH + rowHeight(spec.rows[0] ?? [], false) + 4);
  drawRow(spec.headers, true, headerH, 0);
  for (let ri = 0; ri < spec.rows.length; ri++) {
    const rh = rowHeight(spec.rows[ri], false);
    if (L.remaining() < rh + 2) {
      L.newBodyPage();
      drawRow(spec.headers, true, headerH, 0); // repeat header
    }
    drawRow(spec.rows[ri], false, rh, ri + 1);
  }
}

function bandColorKnown(v: string): boolean {
  return v in BAND_COLOR;
}

// ---- member cards (2-up grid) ----
export interface CardSpec {
  title: string;
  role?: string;
  lines: string[];
}

export function memberCards(L: Layout, cards: CardSpec[]) {
  const c = L.doc;
  const gap = 6 * MM;
  const cellW = (CONTENT_W - gap) / 2;
  // padX matches the specimen (10pt); innerW gets a tiny measurement
  // tolerance because pdfkit measures Inter ~1% wider than reportlab, which
  // would otherwise wrap the longest accelerator line onto a second row.
  const padX = 10, padY = 7;
  const innerW = cellW - padX * 2 + 5;

  const cardHeight = (cd: CardSpec): number => {
    let h = padY;
    h += measureRuns(L, L.parseRuns(cd.title, ST.cardT.font, ST.cardT.color), innerW, ST.cardT.size, ST.cardT.leading) + ST.cardT.after;
    if (cd.role) h += measureRuns(L, L.parseRuns(cd.role, F.interSemi, ACCENT), innerW, 7.6, 10) + 3;
    for (const ln of cd.lines) {
      const runs = lineToRuns(L, ln);
      h += measureRuns(L, runs, innerW, ST.cardL.size, ST.cardL.leading) + 1.0;
    }
    h += padY;
    return h;
  };

  const lineToRuns = (L2: Layout, ln: string) => {
    if (ln.includes(":")) {
      const idx = ln.indexOf(":");
      const lbl = ln.slice(0, idx);
      const rest = ln.slice(idx + 1);
      return L2.parseRuns(`<font name="Inter-Semi" color="${INK2}">${lbl}:</font>${rest}`, F.inter, "#3a444a");
    }
    return L2.parseRuns(ln, F.inter, "#3a444a");
  };

  const drawCard = (cd: CardSpec, x: number, topY: number, h: number) => {
    // background + box + accent bar (topY = top of card, from-top)
    c.rect(x, topY, cellW, h).fill(SURFACE);
    c.lineWidth(0.5).strokeColor(LINE).rect(x, topY, cellW, h).stroke();
    c.rect(x, topY, 2.2, h).fill(ACCENT);
    L.y = topY + padY;
    // title
    L.drawRuns(L.parseRuns(cd.title, ST.cardT.font, ST.cardT.color), { x: x + padX, width: innerW, size: ST.cardT.size, leading: ST.cardT.leading, align: "left" });
    L.advance(measureRuns(L, L.parseRuns(cd.title, ST.cardT.font, ST.cardT.color), innerW, ST.cardT.size, ST.cardT.leading) + ST.cardT.after);
    if (cd.role) {
      L.drawRuns(L.parseRuns(cd.role, F.interSemi, ACCENT), { x: x + padX, width: innerW, size: 7.6, leading: 10, align: "left" });
      L.advance(measureRuns(L, L.parseRuns(cd.role, F.interSemi, ACCENT), innerW, 7.6, 10) + 3);
    }
    for (const ln of cd.lines) {
      const runs = lineToRuns(L, ln);
      L.drawRuns(runs, { x: x + padX, width: innerW, size: ST.cardL.size, leading: ST.cardL.leading, align: "left" });
      L.advance(measureRuns(L, runs, innerW, ST.cardL.size, ST.cardL.leading) + 1.0);
    }
  };

  for (let i = 0; i < cards.length; i += 2) {
    const left = cards[i];
    const right = cards[i + 1];
    const hL = cardHeight(left);
    const hR = right ? cardHeight(right) : 0;
    const rowH = Math.max(hL, hR);
    L.ensure(rowH + 5);
    const topY = L.y;
    drawCard(left, MARGIN, topY, rowH);
    if (right) drawCard(right, MARGIN + cellW + gap, topY, rowH);
    L.y = topY + rowH + 5;
  }
}

// ---- hard Q&A block ----
export function hardQa(L: Layout, question: string, verdict: string, body: string) {
  const c = L.doc;
  const padX = 13, padTop = 10, padBottom = 10;
  const innerW = CONTENT_W - padX * 2;
  const qRuns = L.parseRuns(question, ST.qaQ.font, ST.qaQ.color);
  const vRuns = L.parseRuns(verdict, ST.qaV.font, ST.qaV.color);
  const bRuns = L.parseRuns(body, F.inter, BODYCOL);
  const qH = measureRuns(L, qRuns, innerW, ST.qaQ.size, ST.qaQ.leading);
  const vH = measureRuns(L, vRuns, innerW, ST.qaV.size, ST.qaV.leading);
  const bH = measureRuns(L, bRuns, innerW, 9.2, 13.8);
  const boxH = padTop + qH + ST.qaQ.after + vH + ST.qaV.after + bH + padBottom;
  L.ensure(boxH + 8);
  const topY = L.y; // top of box (from-top)
  c.rect(MARGIN, topY, CONTENT_W, boxH).fill(WHITE);
  c.lineWidth(0.6).strokeColor(LINE).rect(MARGIN, topY, CONTENT_W, boxH).stroke();
  c.rect(MARGIN, topY, 3, boxH).fill(GOLD);
  L.y = topY + padTop;
  L.drawRuns(qRuns, { x: MARGIN + padX, width: innerW, size: ST.qaQ.size, leading: ST.qaQ.leading, align: "left" });
  L.advance(qH + ST.qaQ.after);
  L.drawRuns(vRuns, { x: MARGIN + padX, width: innerW, size: ST.qaV.size, leading: ST.qaV.leading, align: "left" });
  L.advance(vH + ST.qaV.after);
  L.drawRuns(bRuns, { x: MARGIN + padX, width: innerW, size: 9.2, leading: 13.8, align: "left" });
  L.y = topY + boxH + 8;
}

// ---- figure caption (the visual itself is drawn by visuals.ts) ----
export function figureCaption(L: Layout, caption: string) {
  const runs = L.parseRuns(caption, ST.fig.font, ST.fig.color);
  L.advance(ST.fig.before!);
  const h = L.drawRuns(runs, { size: ST.fig.size, leading: ST.fig.leading, align: "center" });
  L.advance(h);
}

// ===================================================================
// Full-bleed DARK cover (painted on the page)
// ===================================================================
export interface CoverMeta {
  confidentiality: string;
  date: string;
  company: string;
  recipient: string;
  context: string;
  basis: string;
}
export interface CoverIndex {
  value: number;
  band: string;
  verdict: string;
  verdictShort: string;
  pillSub: string;
}

export function drawDarkCover(doc: PDFKit.PDFDocument, meta: CoverMeta, index: CoverIndex, variantLabel: string) {
  const W = PAGE_W, H = PAGE_H;
  const c = doc;
  const vc = VERDICT_COLOR[index.verdict] ?? ACCENT;
  // reportlab y is from BOTTOM (baseline). pdfkit y is from TOP (text-box top).
  //   reportlab baseline at y_rl  ->  pdfkit text top = (H - y_rl) - fontSize.
  const topOf = (yRl: number) => H - yRl;                 // geometry conversion
  const bl = (yRl: number, size: number) => H - yRl - size; // baseline text top

  c.rect(0, 0, W, H).fill(INK);
  const bandH = H * 0.31;
  c.rect(0, 0, W, bandH).fill(INK2); // reportlab top band (H-bandH..H) -> top strip
  // watermark triangles top-right (reportlab anchored at H -> pdfkit y=0)
  c.save().fillOpacity(0.55).fillColor("#1a4253");
  c.moveTo(W * 0.84, 0).lineTo(W, 0).lineTo(W, H * 0.22).fill();
  c.restore();
  c.save().fillOpacity(0.45).fillColor("#21536a");
  c.moveTo(W * 0.93, 0).lineTo(W, 0).lineTo(W, H * 0.12).fill();
  c.restore();
  c.fillOpacity(1);

  const LX = MARGIN;
  c.fillColor("#7fa9b8").font(F.interSemi).fontSize(8.5);
  c.text(`${meta.confidentiality.toUpperCase()}   \u00b7   ${meta.date.toUpperCase()}`, LX, bl(H - 26 * MM, 8.5), { lineBreak: false });
  c.lineWidth(0.8).strokeColor("#2b4a58");
  c.moveTo(LX, topOf(H - 30 * MM)).lineTo(W - MARGIN, topOf(H - 30 * MM)).stroke();
  c.fillColor(GOLD).font(F.interSemi).fontSize(11);
  c.text(variantLabel.toUpperCase(), LX, bl(H - 44 * MM, 11), { lineBreak: false });
  c.fillColor(WHITE).font(F.dmBold).fontSize(40);
  c.text("Human Due", LX, bl(H - 60 * MM, 40), { lineBreak: false });
  c.text("Diligence", LX, bl(H - 78 * MM, 40), { lineBreak: false });
  c.rect(LX, topOf(H - 84 * MM), 46 * MM, 2.4).fill(GOLD);
  c.fillColor("#cfe0e6").font(F.inter).fontSize(13);
  c.text("Founder & Management-Team Assessment", LX, bl(H - 96 * MM, 13), { lineBreak: false });
  c.fillColor(WHITE).font(F.interMed).fontSize(13);
  c.text(meta.company, LX, bl(H - 104 * MM, 13), { lineBreak: false });

  // gauge (right-mid). reportlab centre gy = H-152mm.
  const gx = W - 58 * MM, gy = topOf(H - 152 * MM), gr = 18 * MM;
  c.lineWidth(4.0).strokeColor("#234a59");
  c.circle(gx, gy, gr).stroke();
  const frac = Math.max(0, Math.min(1, index.value / 100));
  drawArc(c, gx, gy, gr, -90, -90 + frac * 360, GOLD, 4.4);
  c.fillColor(WHITE).font(F.dmBold).fontSize(30);
  centerText(c, String(index.value), gx, gy - 3 * MM - 30); // reportlab drawCentred at gy-3mm
  c.fillColor("#9fb6bf").font(F.inter).fontSize(9);
  centerText(c, "/ 100", gx, gy + 9 * MM - 9);              // reportlab gy-9mm
  c.fillColor(GOLD).font(F.interSemi).fontSize(9.5);
  centerText(c, index.band.toUpperCase(), gx, gy - gr - 5 * MM - 9.5); // reportlab gy+gr+5mm
  c.fillColor("#9fb6bf").font(F.interSemi).fontSize(8);
  centerText(c, "HUMAN CAPITAL INDEX", gx, gy + gr + 8 * MM - 8);      // reportlab gy-gr-8mm

  // recommendation pill (left-mid). reportlab pill_y = H-152mm.
  const pillCY = topOf(H - 152 * MM), pillH = 24 * MM, pillW = 92 * MM;
  c.roundedRect(LX, pillCY - pillH / 2, pillW, pillH, 3).fill(vc);
  c.fillColor(WHITE).font(F.interSemi).fontSize(10);
  c.text(`RECOMMENDATION: ${index.verdictShort.toUpperCase()}`, LX + 8 * MM, pillCY - 2.4 * MM - 10, { lineBreak: false });
  c.fillColor("#d7ece1").font(F.inter).fontSize(7.2);
  c.text(index.pillSub, LX + 8 * MM, pillCY + 4.6 * MM - 8, { width: pillW - 12 * MM, lineBreak: false });

  // lower context block. reportlab rule at y = 78mm.
  c.lineWidth(0.8).strokeColor("#2b4a58");
  c.moveTo(LX, topOf(78 * MM)).lineTo(W - MARGIN, topOf(78 * MM)).stroke();
  c.fillColor("#7fa9b8").font(F.interSemi).fontSize(8);
  c.text("PREPARED FOR", LX, bl(70 * MM, 8), { lineBreak: false });
  c.fillColor(WHITE).font(F.interMed).fontSize(11.5);
  c.text(meta.recipient, LX, bl(63 * MM, 11.5), { lineBreak: false });
  c.fillColor("#9fb6bf").font(F.inter).fontSize(9);
  c.text(meta.context, LX, bl(55 * MM, 9), { width: W - 2 * MARGIN, lineBreak: false });
  c.fillColor("#88a2ab").font(F.inter).fontSize(8.5);
  c.text(`Basis: ${meta.basis}`, LX, bl(49 * MM, 8.5), { width: W - 2 * MARGIN, lineBreak: false });
  c.fillColor(WHITE).font(F.interSemi).fontSize(9);
  c.text("TaPas Platform", LX, bl(22 * MM, 9), { lineBreak: false });
  c.fillColor("#7f9aa4").font(F.inter).fontSize(7.8);
  c.text("Always produced in English \u2014 the international character is immediate.", LX, bl(16 * MM, 7.8), { lineBreak: false });
}

// ---- section divider (light, for Team Report start) ----
export function drawSectionDivider(doc: PDFKit.PDFDocument, kicker: string, title: string, subtitle: string) {
  const W = PAGE_W, H = PAGE_H, c = doc;
  c.rect(0, 0, W, H).fill(WHITE);
  c.rect(0, 0, 7 * MM, H).fill(INK);
  c.rect(7 * MM, 0, 2 * MM, H).fill(GOLD);
  c.fillColor(ACCENT).font(F.interSemi).fontSize(11);
  c.text(kicker.toUpperCase(), MARGIN, H / 2 - 18 * MM - 11, { lineBreak: false });
  c.fillColor(INK).font(F.dmBold).fontSize(30);
  c.text(title, MARGIN, H / 2 - 2 * MM - 30, { lineBreak: false });
  c.rect(MARGIN, H / 2 + 4 * MM, 44 * MM, 2.2).fill(GOLD);
  c.fillColor(SUB).font(F.inter).fontSize(12);
  c.text(subtitle, MARGIN, H / 2 + 16 * MM - 12, { lineBreak: false });
}

// ---- shared arc + centered text helpers ----
export function drawArc(c: PDFKit.PDFDocument, cx: number, cy: number, r: number, a0deg: number, a1deg: number, color: string, width: number) {
  // angles in degrees, clockwise from top (-90 = top). pdfkit y grows down.
  const steps = Math.max(8, Math.round(Math.abs(a1deg - a0deg) / 4));
  c.save().lineWidth(width).strokeColor(color);
  for (let i = 0; i <= steps; i++) {
    const t = a0deg + (a1deg - a0deg) * (i / steps);
    const rad = (t * Math.PI) / 180;
    const x = cx + r * Math.cos(rad);
    const y = cy + r * Math.sin(rad);
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.stroke().restore();
}

export function centerText(c: PDFKit.PDFDocument, text: string, cx: number, yTop: number) {
  const w = c.widthOfString(text);
  c.text(text, cx - w / 2, yTop, { lineBreak: false });
}
