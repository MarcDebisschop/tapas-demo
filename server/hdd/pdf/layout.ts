/**
 * Layout engine for the flagship HDD PDF.
 * pdfkit is imperative (no flowables), so we manage a y-cursor with
 * automatic page breaks, keep-together guards and per-page chrome —
 * reproducing reportlab's BaseDocTemplate behaviour.
 */
import {
  PAGE_W, PAGE_H, MARGIN, CONTENT_W, BODY_BOTTOM, MM,
  INK, INK2, ACCENT, SUB, LINE, GOLD, WHITE, F,
} from "./theme";

export interface ChromeMeta {
  subject: string;
  confidentiality: string;
  variant: string;
}

// An inline run after markup parsing.
interface Run {
  text: string;
  font: string;
  color: string;
}

// Body content cursor uses pdfkit FROM-TOP coordinates (y grows downward).
const TOP_OF_BODY = 22 * MM;             // top inset where body content begins
const BODY_FLOOR = PAGE_H - BODY_BOTTOM; // lowest usable y (from top)

export class Layout {
  doc: PDFKit.PDFDocument;
  y: number; // current cursor, FROM-TOP of page (pdfkit origin), grows downward
  meta: ChromeMeta;
  // Page counter includes the dark cover (cover = page 1, like reportlab's
  // doc.page), so the first body page is numbered 2 in the footer.
  page = 1;
  private painting = false; // suppress chrome while painting covers/dividers

  constructor(doc: PDFKit.PDFDocument, meta: ChromeMeta) {
    this.doc = doc;
    this.meta = meta;
    this.y = TOP_OF_BODY;
  }

  setMeta(meta: ChromeMeta) {
    this.meta = meta;
  }

  // remaining vertical space in the body frame (pt below the cursor)
  remaining(): number {
    return BODY_FLOOR - this.y;
  }

  // Start a fresh body page (chrome painted) and reset the cursor.
  newBodyPage() {
    this.doc.addPage();
    this.page += 1;
    this.paintChrome();
    this.y = TOP_OF_BODY;
  }

  // Ensure at least `need` pt remain; otherwise break to a new body page.
  ensure(need: number) {
    if (this.remaining() < need) this.newBodyPage();
  }

  // CondPageBreak guard: only break if less than need(mm) remains.
  guardMm(needMm: number) {
    this.ensure(needMm * MM);
  }

  // advance the cursor DOWNWARD by dy pt.
  advance(dy: number) {
    this.y += dy;
  }

  // left edge of the body content frame
  docX(): number {
    return MARGIN;
  }

  // ---- chrome (header/footer) on body pages ----
  // reportlab baselines (from bottom) -> pdfkit text tops (from top):
  //   header baseline y_rl = PAGE_H - 13mm  -> top = 13mm - fontSize
  //   footer baseline y_rl = 9.2mm          -> top = PAGE_H - 9.2mm - fontSize
  paintChrome() {
    const c = this.doc;
    // header text
    c.font(F.dmBold).fontSize(8.5).fillColor(INK);
    c.text("HUMAN DUE DILIGENCE", MARGIN, 13 * MM - 8.5, { lineBreak: false });
    const right = `${this.meta.subject}  \u00b7  ${this.meta.confidentiality}`;
    c.font(F.inter).fontSize(7.5).fillColor(SUB);
    c.text(right, PAGE_W - MARGIN - 300, 13 * MM - 7.5, {
      width: 300, align: "right", lineBreak: false,
    });
    // header rule (from-bottom 15.5mm -> from-top PAGE_H-15.5mm)
    c.lineWidth(0.6).strokeColor(LINE);
    c.moveTo(MARGIN, 15.5 * MM).lineTo(PAGE_W - MARGIN, 15.5 * MM).stroke();
    // footer rule (from-bottom 12.5mm -> from-top PAGE_H-12.5mm)
    c.moveTo(MARGIN, PAGE_H - 12.5 * MM).lineTo(PAGE_W - MARGIN, PAGE_H - 12.5 * MM).stroke();
    // footer text
    c.font(F.inter).fontSize(7).fillColor(SUB);
    const fyTop = PAGE_H - 9.2 * MM - 7;
    c.text(`TaPas Platform \u00b7 ${this.meta.variant} \u00b7 Always produced in English`, MARGIN, fyTop, { lineBreak: false });
    c.text(`Page ${this.page}`, PAGE_W - MARGIN - 120, fyTop, { width: 120, align: "right", lineBreak: false });
  }

  // ---------------------------------------------------------------
  // Inline markup parser: handles <b>..</b>, <i>..</i>,
  // <font name=".." color="#..">..</font>, and &amp; / &lt; / &gt; / &#xx;
  // Produces a run list with explicit font + color.
  // ---------------------------------------------------------------
  parseRuns(html: string, baseFont: string, baseColor: string): Run[] {
    const runs: Run[] = [];
    let i = 0;
    const fontStack: string[] = [baseFont];
    const colorStack: string[] = [baseColor];
    let bold = false;
    let italic = false;

    const interVariant = (f: string): string => {
      // map to semibold when bold within Inter family; DM has its own bold
      if (bold) {
        if (f === F.inter || f === F.interMed) return F.interSemi;
        if (f === F.dm || f === F.dmMed) return F.dmBold;
      }
      return f;
    };

    const pushText = (t: string) => {
      if (!t) return;
      const f = interVariant(fontStack[fontStack.length - 1]);
      runs.push({ text: t, font: f, color: colorStack[colorStack.length - 1] });
    };

    const decode = (s: string) =>
      s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
        .replace(/&quot;/g, '"').replace(/&rsquo;/g, "\u2019").replace(/&ldquo;/g, "\u201c").replace(/&rdquo;/g, "\u201d");

    while (i < html.length) {
      const lt = html.indexOf("<", i);
      if (lt === -1) {
        pushText(decode(html.slice(i)));
        break;
      }
      if (lt > i) pushText(decode(html.slice(i, lt)));
      const gt = html.indexOf(">", lt);
      if (gt === -1) {
        pushText(decode(html.slice(lt)));
        break;
      }
      const tag = html.slice(lt + 1, gt).trim();
      const lower = tag.toLowerCase();
      if (lower === "b" || lower === "strong") bold = true;
      else if (lower === "/b" || lower === "/strong") bold = false;
      else if (lower === "i" || lower === "em") italic = true;
      else if (lower === "/i" || lower === "/em") italic = false;
      else if (lower.startsWith("font")) {
        const nameM = tag.match(/name\s*=\s*"([^"]+)"/i);
        const colM = tag.match(/color\s*=\s*"([^"]+)"/i);
        fontStack.push(nameM ? nameM[1] : fontStack[fontStack.length - 1]);
        colorStack.push(colM ? colM[1] : colorStack[colorStack.length - 1]);
      } else if (lower === "/font") {
        if (fontStack.length > 1) fontStack.pop();
        if (colorStack.length > 1) colorStack.pop();
      }
      // italic is visually approximated by keeping the same font (no oblique
      // TTF available); the specimen uses <i> only for emphasis words.
      void italic;
      i = gt + 1;
    }
    return runs;
  }

  // Measure the wrapped height of a runs paragraph at a given width/size/leading.
  private wrapRuns(runs: Run[], width: number, size: number) {
    const c = this.doc;
    // tokenise into words carrying their run style
    type Tok = { w: string; run: Run; space: boolean };
    const toks: Tok[] = [];
    for (const r of runs) {
      const parts = r.text.split(/(\s+)/);
      for (const p of parts) {
        if (p === "") continue;
        if (/^\s+$/.test(p)) {
          if (toks.length) toks[toks.length - 1].space = true;
        } else {
          toks.push({ w: p, run: r, space: false });
        }
      }
    }
    const lines: Tok[][] = [];
    let line: Tok[] = [];
    let lineW = 0;
    const spaceW = (font: string) => {
      c.font(font).fontSize(size);
      return c.widthOfString(" ");
    };
    for (const t of toks) {
      c.font(t.run.font).fontSize(size);
      const wlen = c.widthOfString(t.w);
      const add = (line.length ? spaceW(t.run.font) : 0) + wlen;
      if (lineW + add > width && line.length) {
        lines.push(line);
        line = [t];
        lineW = wlen;
      } else {
        line.push(t);
        lineW += add;
      }
    }
    if (line.length) lines.push(line);
    return lines;
  }

  // Draw a multi-run paragraph; returns height consumed (excludes spaceAfter).
  drawRuns(
    runs: Run[],
    opts: {
      x?: number; width?: number; size: number; leading: number;
      align?: "left" | "justify" | "center"; indent?: number;
    },
  ): number {
    const c = this.doc;
    const x0 = (opts.x ?? MARGIN) + (opts.indent ?? 0);
    const width = (opts.width ?? CONTENT_W) - (opts.indent ?? 0);
    const lines = this.wrapRuns(runs, width, opts.size);
    const align = opts.align ?? "left";
    let yy = this.y;
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      // compute natural width and spaces
      let natural = 0;
      const spaceWidths: number[] = [];
      for (let k = 0; k < line.length; k++) {
        c.font(line[k].run.font).fontSize(opts.size);
        natural += c.widthOfString(line[k].w);
        if (k < line.length - 1) {
          const sw = c.widthOfString(" ");
          spaceWidths.push(sw);
          natural += sw;
        }
      }
      const isLast = li === lines.length - 1;
      let gap = 0;
      let startX = x0;
      if (align === "justify" && !isLast && line.length > 1) {
        gap = (width - natural) / (line.length - 1);
      } else if (align === "center") {
        startX = x0 + (width - natural) / 2;
      }
      let cx = startX;
      // pdfkit places text with y = top of the text box; cursor yy is the top
      // of the current line, and lines flow DOWNWARD.
      const topY = yy;
      for (let k = 0; k < line.length; k++) {
        const t = line[k];
        c.font(t.run.font).fontSize(opts.size).fillColor(t.run.color);
        c.text(t.w, cx, topY, { lineBreak: false });
        cx += c.widthOfString(t.w);
        if (k < line.length - 1) cx += spaceWidths[k] + gap;
      }
      yy += opts.leading;
    }
    const consumed = lines.length * opts.leading;
    return consumed;
  }
}
