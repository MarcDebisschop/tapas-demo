/**
 * Flagship HDD PDF renderer — pure-Node entry point.
 *
 * renderFlagshipPdf() produces ONE variant (investor OR team) of the
 * approved HDD flagship report, byte-for-byte faithful to the reportlab
 * specimen (HDD-Flagship-Report.pdf), driven by live trajectory data.
 *
 * Engine: pdfkit (pure Node, no Python sidecar) so the report can be
 * generated on demand from a single print button with no extra runtime.
 */
import PDFDocument from "pdfkit";
import { PAGE_W, PAGE_H, registerFonts } from "./theme";
import { Layout, ChromeMeta } from "./layout";
import { drawDarkCover, CoverMeta, CoverIndex } from "./primitives";
import {
  FlagshipInput,
  buildReportBody,
} from "./flagship";

export type { FlagshipInput } from "./flagship";
export type {
  FlagshipMeta,
  FlagshipIndex,
  FlagshipFacts,
  Audience,
} from "./flagship";
export type { VisualData } from "./visuals";

/**
 * Render a single-variant flagship report to a PDF Buffer.
 *
 * Page flow (mirrors the specimen, per variant):
 *   1. Dark cover page (audience-specific recipient, index, verdict)
 *   2. First body page (chrome painted) — chapters flow with auto page-breaks
 *      and keep-together guards exactly as the specimen.
 */
export function renderFlagshipPdf(fi: FlagshipInput): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [PAGE_W, PAGE_H],
        autoFirstPage: false,
        margin: 0,
        bufferPages: true,
      });

      // metadata — Author MUST be "Perplexity Computer"
      doc.info.Author = "Perplexity Computer";
      doc.info.Title =
        `Human Due Diligence — ${fi.meta.company} — ${fi.meta.variant}`;
      doc.info.Subject = fi.meta.subject;

      registerFonts(doc);

      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // ---- cover page ----
      const coverMeta: CoverMeta = {
        confidentiality: fi.meta.confidentiality,
        date: fi.meta.date,
        company: fi.meta.company,
        recipient: fi.meta.recipient,
        context: fi.meta.context,
        basis: fi.meta.basis,
      };
      const coverIndex: CoverIndex = {
        value: fi.index.value,
        band: fi.index.band,
        verdict: fi.index.verdict,
        verdictShort: fi.index.verdictShort,
        pillSub: fi.index.pillSub,
      };
      doc.addPage();
      drawDarkCover(doc, coverMeta, coverIndex, fi.meta.variant);

      // ---- body ----
      const chrome: ChromeMeta = {
        subject: fi.meta.subject,
        confidentiality: fi.meta.confidentiality,
        variant: fi.meta.variant,
      };
      const L = new Layout(doc, chrome);

      // The first body page must be created manually: each chapter calls
      // L.newBodyPage() at its END, so buildReportBody expects an already-open
      // body page on entry. (The cover page above is the currently-open page.)
      L.newBodyPage(); // page counter -> 1, chrome painted, cursor reset
      buildReportBody(L, fi);

      doc.end();
    } catch (err) {
      reject(err as Error);
    }
  });
}
