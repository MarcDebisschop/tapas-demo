import PDFDocument from "pdfkit";
import { registerFonts, F } from "./theme";
const MM = 2.834645669;
const PAGE_W = 595.2756;
const MARGIN = 19 * MM;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const gap = 6 * MM;
const cellW = (CONTENT_W - gap) / 2;
const padX = 10;
const innerW = cellW - padX * 2;
const doc = new PDFDocument({ size: [PAGE_W, 800], margin: 0 });
registerFonts(doc);
const lines = [
  ["Accelerators: ","Analysis \u00b7 Facilitation \u00b7 Result-orientation"],
  ["DRIVER(S): ","Be Perfect \u00b7 Try Hard \u00b7 Be Strong"],
  ["DRIVER(S): ","Hurry Up \u00b7 Be Strong \u00b7 Please Others"],
  ["Talent: ","Strategy \u00b7 Operational \u00b7 Interrelational"],
];
console.log("innerW =", innerW.toFixed(2), "cellW=", cellW.toFixed(2));
for (const [lbl, rest] of lines) {
  doc.font(F.interSemi).fontSize(8.2);
  const wl = doc.widthOfString(lbl);
  doc.font(F.inter).fontSize(8.2);
  const wr = doc.widthOfString(rest);
  const w = wl + wr;
  console.log(`${w > innerW ? "WRAP" : "ok  "} ${w.toFixed(1)}  ${lbl}${rest}`);
}
