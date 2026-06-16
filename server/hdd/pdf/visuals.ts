/**
 * Vector visuals for the flagship HDD PDF — native pdfkit reproductions of the
 * eight matplotlib mocks (pyramid, sliders, driver-conflict, energy strip,
 * stratum ladder, gauge, scorecard, key-person, competence/potential).
 *
 * Each matplotlib mock defines an axis coordinate space (set_xlim/ylim, y from
 * BOTTOM). We render into a pdfkit box of a fixed width with the same aspect
 * ratio as the matplotlib figure, mapping axis coords → box coords (y flipped).
 *
 * Every visual is data-driven so the renderer reflects the live trajectory.
 */
import {
  CONTENT_W, MM,
  INK, ACCENT, SUB, GOLD, GREEN, AMBER, RED, WHITE, F,
} from "./theme";
import { Layout } from "./layout";
import { drawArc } from "./primitives";

// matplotlib mock palette (slightly different tints than the body chrome)
const V_LINE = "#dfe6e9";
const V_LIGHT = "#eef3f5";
const V_SUB = "#5c6b72";

function bandTri(v: number, hi: number, mid: number): string {
  return v >= hi ? GREEN : v >= mid ? AMBER : RED;
}

/**
 * A drawing surface that maps matplotlib-style axis coords (origin bottom-left)
 * to pdfkit page coords (origin top-left) inside a box [x0,topY] of size [w,h].
 * `xlim`/`ylim` define the axis range; `pad` is the matplotlib pad in axis units
 * approximated by extending the mapped area (we instead inset content slightly).
 */
class Surface {
  c: PDFKit.PDFDocument;
  x0: number; topY: number; w: number; h: number;
  xmin: number; xmax: number; ymin: number; ymax: number;
  constructor(c: PDFKit.PDFDocument, x0: number, topY: number, w: number, h: number,
    xmax: number, ymax: number, xmin = 0, ymin = 0) {
    this.c = c; this.x0 = x0; this.topY = topY; this.w = w; this.h = h;
    this.xmin = xmin; this.xmax = xmax; this.ymin = ymin; this.ymax = ymax;
  }
  X(ax: number) { return this.x0 + ((ax - this.xmin) / (this.xmax - this.xmin)) * this.w; }
  Y(ay: number) { return this.topY + (1 - (ay - this.ymin) / (this.ymax - this.ymin)) * this.h; }
  // scale a length on the x axis to points
  SX(len: number) { return (len / (this.xmax - this.xmin)) * this.w; }
  SY(len: number) { return (len / (this.ymax - this.ymin)) * this.h; }

  text(s: string, ax: number, ay: number, font: string, size: number, color: string,
    align: "left" | "center" | "right" = "left", valign: "top" | "center" | "bottom" = "center") {
    const c = this.c;
    c.font(font).fontSize(size).fillColor(color);
    const w = c.widthOfString(s);
    let x = this.X(ax);
    if (align === "center") x -= w / 2;
    else if (align === "right") x -= w;
    let yTop = this.Y(ay);
    if (valign === "center") yTop -= size / 2;
    else if (valign === "bottom") yTop -= size;
    c.text(s, x, yTop, { lineBreak: false });
  }
  rect(ax: number, ay: number, aw: number, ah: number, fill?: string, stroke?: string, lw = 1, alpha = 1) {
    const c = this.c;
    const x = this.X(ax), y = this.Y(ay + ah), w = this.SX(aw), h = this.SY(ah);
    c.save();
    if (alpha !== 1) c.fillOpacity(alpha);
    if (fill) c.rect(x, y, w, h).fill(fill);
    if (stroke) { c.fillOpacity(1).lineWidth(lw).strokeColor(stroke).rect(x, y, w, h).stroke(); }
    c.restore();
  }
  roundRect(ax: number, ay: number, aw: number, ah: number, r: number, fill?: string, stroke?: string, lw = 1, alpha = 1) {
    const c = this.c;
    const x = this.X(ax), y = this.Y(ay + ah), w = this.SX(aw), h = this.SY(ah);
    c.save();
    if (alpha !== 1) c.fillOpacity(alpha);
    if (fill) c.roundedRect(x, y, w, h, this.SY(r)).fill(fill);
    if (stroke) { c.fillOpacity(1).lineWidth(lw).strokeColor(stroke).roundedRect(x, y, w, h, this.SY(r)).stroke(); }
    c.restore();
  }
  circle(ax: number, ay: number, ar: number, fill?: string, stroke?: string, lw = 1) {
    const c = this.c;
    const x = this.X(ax), y = this.Y(ay), r = this.SY(ar);
    c.save();
    if (fill) c.circle(x, y, r).fill(fill);
    if (stroke) { c.lineWidth(lw).strokeColor(stroke).circle(x, y, r).stroke(); }
    c.restore();
  }
  line(ax0: number, ay0: number, ax1: number, ay1: number, color: string, lw = 1, dash?: number[]) {
    const c = this.c;
    c.save().lineWidth(lw).strokeColor(color);
    if (dash) c.dash(dash[0], { space: dash[1] });
    c.moveTo(this.X(ax0), this.Y(ay0)).lineTo(this.X(ax1), this.Y(ay1)).stroke();
    if (dash) c.undash();
    c.restore();
  }
  polygon(pts: [number, number][], fill?: string, stroke?: string, lw = 1) {
    const c = this.c;
    c.save();
    pts.forEach((p, i) => {
      const x = this.X(p[0]), y = this.Y(p[1]);
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    });
    c.closePath();
    if (fill && stroke) { c.lineWidth(lw).fillAndStroke(fill, stroke); }
    else if (fill) c.fill(fill);
    else if (stroke) { c.lineWidth(lw).strokeColor(stroke).stroke(); }
    c.restore();
  }
}

// tiny manual word-wrap (mirrors new_visuals._wrap)
function wrapText(text: string, width: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length <= width) cur = (cur + " " + w).trim();
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---- data contracts (fed by the data mapping layer) ----
export interface PyramidLevel { label: string; score: number | null; desc: string; }
export interface SliderItem { label: string; val: number; disp: number; }
export interface SliderGroup { name: string; desc: string; color: string; items: SliderItem[]; }
export interface ConflictAlert { title: string; sev: string; color: string; body: string; evidence: string; }
export interface EnergyMember { name: string; energy: number; phase: string; }
export interface StratumRow { name: string; span: string; count: number; }
export interface ScorecardRow { outcome: string; capability: string; who: string; rag: "strong" | "adequate" | "gap"; }
export interface KeyPersonCard { title: string; sev: string; color: string; impact: string; depth: string; mitigation: string; }
export interface CompPotPoint { label: string; competence: number; potential: number; }

export interface VisualData {
  pyramid: { levels: PyramidLevel[]; hi: number; mid: number };
  sliders: SliderGroup[];
  conflict: ConflictAlert[];
  energy: { members: EnergyMember[]; mean: number; meanBand: string; dispersion: number };
  stratum: { rows: StratumRow[]; maxCount: number; requiredIdx: number; fitVerdict: string; fitNote: string };
  gauge: { value: number; band: string; color: string };
  scorecard: ScorecardRow[];
  keyperson: KeyPersonCard[];
  comppot: CompPotPoint[];
}

const RAG: Record<string, string> = { strong: GREEN, adequate: AMBER, gap: RED };
const RAG_LABEL: Record<string, string> = { strong: "Covered", adequate: "Partial", gap: "Build" };

// width helper: figure() scales PNG to maxW (default CONTENT_W) unless capped by maxH.
function fit(figW: number, figH: number, maxW: number, maxHmm?: number): { w: number; h: number } {
  let w = maxW;
  let h = (w * figH) / figW;
  if (maxHmm) {
    const maxH = maxHmm * MM;
    if (h > maxH) { h = maxH; w = (h * figW) / figH; }
  }
  return { w, h };
}

// ============================================================
// 1. SIX-LEVEL PYRAMID
// ============================================================
export function drawPyramid(L: Layout, d: VisualData["pyramid"]) {
  // figsize 9.6 x 6.7, axis 0..10 x 0..10 ; tight bbox + pad — approximate by full box
  const { w, h } = fit(9.6, 6.7, CONTENT_W);
  L.ensure(h + 6);
  const s = new Surface(L.doc, L.docX(), L.y, w, h, 10, 10);
  const levels = d.levels;
  const n = levels.length;
  const base_y = 0.95, top_y = 8.95, H = (top_y - base_y) / n;
  const cx = 5.55, half_base = 2.7, half_apex = 0.0;
  const halfAt = (y: number) => half_base + (half_apex - half_base) * ((y - base_y) / (top_y - base_y));
  for (let i = 0; i < n; i++) {
    const { label, score, desc } = levels[i];
    const y0 = base_y + i * H, y1 = y0 + H;
    const hb = halfAt(y0), ht = halfAt(y1);
    const fc = score === null ? INK : bandTri(score, d.hi, d.mid);
    if (ht <= 0.02) {
      s.polygon([[cx - hb, y0], [cx + hb, y0], [cx, y1]], fc, WHITE, 2.4);
    } else {
      s.polygon([[cx - hb, y0], [cx + hb, y0], [cx + ht, y1], [cx - ht, y1]], fc, WHITE, 2.4);
    }
    const ymid = (y0 + y1) / 2;
    const railx = 0.2;
    s.line(railx + 1.95, ymid, cx - hb - 0.15, ymid, V_LINE, 0.8);
    s.text(label, railx, ymid + 0.12, F.interSemi, 9.6, INK, "left");
    s.text(desc, railx, ymid - 0.20, F.inter, 7.4, V_SUB, "left");
    const rightx = cx + half_base + 0.55;
    s.line(cx + hb + 0.12, ymid, rightx - 0.08, ymid, V_LINE, 0.8);
    if (score !== null) {
      s.text(score.toFixed(2), rightx, ymid, F.dmBold, 14, fc, "left");
      s.text("High", rightx + 0.95, ymid, F.interMed, 8.3, V_SUB, "left");
    } else {
      s.text("QUALITATIVE", rightx, ymid, F.interSemi, 8.3, ACCENT, "left");
    }
  }
  s.text("Team Health Architecture", 0.2, 9.78, F.dmBold, 15, INK, "left");
  s.text("Six-level model \u2014 psychological-safety foundation beneath the five Lencioni dimensions",
    0.2, 9.45, F.inter, 9, V_SUB, "left");
  const legend: [string, string][] = [[RED, "Low 1.00\u20133.24"], [AMBER, "Average 3.25\u20133.75"],
    [GREEN, "High 3.76\u20135.00"], [INK, "Foundation (qualitative)"]];
  legend.forEach(([col, t], i) => {
    s.rect(0.2 + i * 2.45, 0.16, 0.28, 0.28, col);
    s.text(t, 0.2 + i * 2.45 + 0.38, 0.30, F.inter, 7.6, V_SUB, "left");
  });
  L.y = L.y + h + 6; // advance cursor below the figure (from-top)
}

// ============================================================
// 2. POTENTIAL SLIDERS (3 groups)
// ============================================================
export function drawSliders(L: Layout, groups: SliderGroup[], maxHmm = 200) {
  const { w, h } = fit(9.2, 9.2, CONTENT_W, maxHmm);
  L.ensure(h + 6);
  const s = new Surface(L.doc, L.docX(), L.y, w, h, 10, 12);
  s.text("Team Potential \u2014 Three Dimensions", 0.15, 11.6, F.dmBold, 15, INK, "left");
  s.text("Where the collective strength sits on each axis. Marker = team position; band = dispersion.",
    0.15, 11.26, F.inter, 9, V_SUB, "left");
  let y = 10.5;
  const tx0 = 3.5, tx1 = 9.4, tw = tx1 - tx0;
  for (const g of groups) {
    s.text(g.name, 0.15, y, F.interSemi, 11, INK, "left");
    s.text(g.desc, 0.15, y - 0.32, F.inter, 7.6, V_SUB, "left");
    y -= 0.95;
    for (const it of g.items) {
      s.text(it.label, 3.25, y, F.interMed, 8.8, INK, "right");
      s.roundRect(tx0, y - 0.11, tw, 0.22, 0.11, V_LIGHT, V_LINE, 0.8);
      const lo = Math.max(0, it.val - it.disp), hi = Math.min(1, it.val + it.disp);
      s.roundRect(tx0 + lo * tw, y - 0.11, (hi - lo) * tw, 0.22, 0.11, g.color, undefined, 1, 0.22);
      s.roundRect(tx0, y - 0.11, it.val * tw, 0.22, 0.11, g.color, undefined, 1, 0.55);
      const mx = tx0 + it.val * tw;
      s.circle(mx, y, 0.14, WHITE, g.color, 2.4);
      s.circle(mx, y, 0.06, g.color);
      y -= 0.5;
    }
    y -= 0.35;
  }
  L.y = L.y + h + 6; // advance cursor below the figure (from-top)
}

// ============================================================
// 3. DRIVER-CONFLICT ALERTS
// ============================================================
export function drawConflict(L: Layout, alerts: ConflictAlert[]) {
  const { w, h } = fit(9.2, 5.6, CONTENT_W);
  L.ensure(h + 6);
  const s = new Surface(L.doc, L.docX(), L.y, w, h, 10, 10);
  s.text("Driver-Conflict Alerts", 0.15, 9.6, F.dmBold, 15, INK, "left");
  s.text("Structural friction points between dominant team drivers under sustained pressure.",
    0.15, 9.22, F.inter, 9, V_SUB, "left");
  let y = 8.2;
  for (const a of alerts) {
    const cardH = 1.62;
    s.roundRect(0.15, y - cardH, 9.55, cardH, 0.06, WHITE, V_LINE, 1.0);
    s.rect(0.15, y - cardH, 0.09, cardH, a.color);
    s.text(a.title, 0.45, y - 0.18, F.interSemi, 11, INK, "left", "top");
    s.roundRect(8.35, y - 0.34, 1.2, 0.34, 0.17, a.color);
    s.text(a.sev, 8.95, y - 0.17, F.interSemi, 8.5, WHITE, "center");
    // body wrapped, with the evidence line spaced below it
    const bodyLines = wrapText(a.body, 96);
    let by = y - 0.56;
    for (const ln of bodyLines) { s.text(ln, 0.45, by, F.inter, 8.2, "#33414a", "left", "top"); by -= 0.30; }
    s.text(a.evidence, 0.45, by - 0.16, F.interMed, 7.6, V_SUB, "left", "top");
    y -= cardH + 0.22;
  }
  L.y = L.y + h + 6; // advance cursor below the figure (from-top)
}

// ============================================================
// 4. ENERGY STRIP
// ============================================================
export function drawEnergy(L: Layout, e: VisualData["energy"], maxHmm = 74) {
  const { w, h } = fit(9.2, 4.6, CONTENT_W, maxHmm);
  L.ensure(h + 6);
  const s = new Surface(L.doc, L.docX(), L.y, w, h, 10, 10.4);
  s.text("Energy Sustainability \u2014 Point-in-Time Signal", 0.15, 10.0, F.dmBold, 14, INK, "left");
  s.text(`Team mean ${e.mean.toFixed(1)}/10 (${e.meanBand}) \u00b7 dispersion ${e.dispersion.toFixed(1)} \u00b7 all members Phase 0 (fully energised).`,
    0.15, 9.45, F.inter, 8.4, V_SUB, "left");
  s.text("Energy is read with caution: a single rising-exhaustion member can be masked by the mean.",
    0.15, 9.08, F.inter, 8.4, V_SUB, "left");
  const members = e.members;
  const n = members.length, x0 = 0.7, x1 = 9.5;
  const gap = (x1 - x0) / n, bw = gap * 0.62, base = 1.0, maxh = 5.9;
  members.forEach((m, i) => {
    const x = x0 + i * gap;
    const bh = maxh * (m.energy / 10);
    const col = bandTri(m.energy, 7, 5);
    s.roundRect(x, base, bw, bh, 0.05, col, undefined, 1, 0.85);
    s.text(String(m.energy), x + bw / 2, base + bh + 0.2, F.dmBold, 11, INK, "center", "bottom");
    s.text(m.name, x + bw / 2, base - 0.55, F.inter, 7.4, V_SUB, "center");
    s.text(m.phase, x + bw / 2, base - 0.95, F.interMed, 6.6, GREEN, "center");
  });
  const ym = base + maxh * (e.mean / 10);
  s.line(x0 - 0.1, ym, x1 - gap + bw + 0.1, ym, INK, 1.0, [4, 3]);
  s.text(`mean ${e.mean.toFixed(1)}`, x1 - gap + bw + 0.15, ym, F.interMed, 7.6, INK, "left");
  L.y = L.y + h + 6; // advance cursor below the figure (from-top)
}

// ============================================================
// 5. COGNITIVE STRATUM LADDER
// ============================================================
export function drawStratum(L: Layout, st: VisualData["stratum"]) {
  const { w, h } = fit(9.2, 6.2, CONTENT_W);
  L.ensure(h + 6);
  const s = new Surface(L.doc, L.docX(), L.y, w, h, 10, 11);
  s.text("Cognitive Capacity Map (Indicative)", 0.15, 10.5, F.dmBold, 14, INK, "left");
  const introLines = wrapText("Work-complexity required by the growth ambition vs. the board's indicative strata. " +
    "Indicative only \u2014 derived from talent profile, never a ranking of people.", 118);
  let iy = 9.95;
  for (const ln of introLines) { s.text(ln, 0.15, iy, F.inter, 8.4, V_SUB, "left", "top"); iy -= 0.32; }
  let y = 8.7;
  const rowh = 1.55, x0 = 2.7, barmax = 5.4;
  const maxcount = st.maxCount;
  st.rows.forEach((r) => {
    s.text(r.name, 0.15, y, F.interSemi, 10.5, INK, "left");
    s.text(r.span, 0.15, y - 0.34, F.inter, 7.6, V_SUB, "left");
    s.roundRect(x0, y - 0.28, barmax, 0.56, 0.06, V_LIGHT, V_LINE, 0.8);
    if (r.count > 0) {
      const bw = barmax * (r.count / maxcount);
      s.roundRect(x0, y - 0.28, bw, 0.56, 0.06, ACCENT, undefined, 1, 0.85);
      s.text(`${r.count} member(s)`, x0 + bw + 0.2, y, F.interMed, 8, INK, "left");
    }
    y -= rowh;
  });
  // required arrow at the required stratum row
  const req_y = 8.7 - st.requiredIdx * rowh;
  s.text("Growth ambition implies " + st.rows[st.requiredIdx].name.replace("Stratum ", "Stratum ") + " work-complexity",
    x0 + 0.2, req_y - 0.55, F.interSemi, 8.5, RED, "left", "top");
  s.line(x0 + 0.25, req_y - 0.9, x0 + 0.25, req_y - 0.1, RED, 1.4);
  // verdict band
  s.roundRect(0.15, 0.15, 9.55, 0.95, 0.05, "#eef5f7", ACCENT, 1.0);
  s.text(`FIT VERDICT: ${st.fitVerdict.toUpperCase()}`, 0.4, 0.83, F.interSemi, 9.5, ACCENT, "left");
  const noteLines = wrapText(st.fitNote, 120);
  let ny = 0.50;
  for (const ln of noteLines) { s.text(ln, 0.4, ny, F.inter, 8, "#33414a", "left"); ny -= 0.30; }
  L.y = L.y + h + 6; // advance cursor below the figure (from-top)
}

// ============================================================
// 6. INVESTMENT SCORECARD
// ============================================================
export function drawScorecard(L: Layout, rows: ScorecardRow[]) {
  const { w, h } = fit(9.6, 6.6, CONTENT_W);
  L.ensure(h + 6);
  const s = new Surface(L.doc, L.docX(), L.y, w, h, 10, 10.6);
  s.text("Investment Scorecard", 0.15, 10.25, F.dmBold, 15, INK, "left");
  s.text("Every value-creation outcome the deal thesis requires, the capability it demands, and the team\u2019s current bench strength against it.",
    0.15, 9.88, F.inter, 7.4, V_SUB, "left");
  const x_out = 0.15, x_cap = 3.35, x_who = 6.80, x_rag = 9.20;
  const header_y = 9.25;
  ([["VALUE-CREATION OUTCOME", x_out], ["REQUIRED CAPABILITY", x_cap], ["WHERE IT SITS TODAY", x_who], ["BENCH", x_rag]] as [string, number][])
    .forEach(([lbl, xx]) => s.text(lbl, xx, header_y, F.interSemi, 8.0, ACCENT, "left"));
  s.line(0.15, header_y - 0.28, 9.85, header_y - 0.28, ACCENT, 0.8);
  let y = 8.55;
  const rowh = 1.34;
  rows.forEach((r, i) => {
    if (i % 2 === 0) s.rect(0.05, y - rowh + 0.12, 9.9, rowh - 0.04, V_LIGHT, undefined, 1, 0.55);
    wrapText(r.outcome, 30).forEach((ln, k) => s.text(ln, x_out, y - k * 0.30, F.interSemi, 8.6, INK, "left", "top"));
    wrapText(r.capability, 36).forEach((ln, k) => s.text(ln, x_cap, y - k * 0.30, F.inter, 8.2, "#33414a", "left", "top"));
    wrapText(r.who, 26).forEach((ln, k) => s.text(ln, x_who, y - k * 0.30, F.interMed, 8.0, INK, "left", "top"));
    const col = RAG[r.rag], cy = y - 0.22;
    s.circle(x_rag + 0.18, cy, 0.13, col);
    s.text(RAG_LABEL[r.rag], x_rag + 0.18, cy - 0.42, F.interSemi, 6.8, col, "center");
    y -= rowh;
  });
  const items: [string, string][] = [[GREEN, "Covered \u2014 dependable bench"], [AMBER, "Partial \u2014 present, needs depth"], [RED, "Build \u2014 add via board / hire"]];
  let lx = 0.15;
  items.forEach(([col, t]) => {
    s.circle(lx + 0.12, 0.38, 0.12, col);
    s.text(t, lx + 0.34, 0.38, F.inter, 7.6, V_SUB, "left");
    lx += 3.25;
  });
  L.y = L.y + h + 6; // advance cursor below the figure (from-top)
}

// ============================================================
// 7. KEY-PERSON RISK
// ============================================================
export function drawKeyPerson(L: Layout, cards: KeyPersonCard[], maxHmm = 160) {
  const { w, h } = fit(9.6, 7.0, CONTENT_W, maxHmm);
  L.ensure(h + 6);
  const s = new Surface(L.doc, L.docX(), L.y, w, h, 10, 11.2);
  s.text("Key-Person Risk", 0.15, 10.85, F.dmBold, 15, INK, "left");
  s.text("Named concentrations, the impact if each departs, the depth of cover behind them, and the concrete mitigation.",
    0.15, 10.48, F.inter, 8.6, V_SUB, "left");
  let y = 9.95;
  const cardh = 3.05, gap = 0.30;
  for (const cd of cards) {
    s.roundRect(0.15, y - cardh, 9.7, cardh, 0.07, WHITE, V_LINE, 1.0);
    s.rect(0.15, y - cardh, 0.1, cardh, cd.color);
    s.text(cd.title, 0.5, y - 0.28, F.interSemi, 10.5, INK, "left", "top");
    s.roundRect(8.45, y - 0.46, 1.25, 0.34, 0.17, cd.color);
    s.text(cd.sev, 9.075, y - 0.29, F.interSemi, 8.2, WHITE, "center");
    s.text("IMPACT IF LOST", 0.5, y - 0.78, F.interSemi, 6.8, ACCENT, "left", "top");
    wrapText(cd.impact, 95).forEach((ln, k) => s.text(ln, 0.5, y - 1.02 - k * 0.26, F.inter, 7.9, "#33414a", "left", "top"));
    s.text(cd.depth, 0.5, y - 2.02, F.interMed, 7.8, INK, "left", "top");
    wrapText(cd.mitigation, 100).forEach((ln, k) => s.text(ln, 0.5, y - 2.40 - k * 0.26, F.inter, 7.7, V_SUB, "left", "top"));
    y -= (cardh + gap);
  }
  L.y = L.y + h + 6; // advance cursor below the figure (from-top)
}

// ============================================================
// 8. COMPETENCE vs POTENTIAL
// ============================================================
export function drawCompPot(L: Layout, pts: CompPotPoint[], maxHmm = 150) {
  const { w, h } = fit(8.6, 7.4, CONTENT_W, maxHmm);
  L.ensure(h + 6);
  const s = new Surface(L.doc, L.docX(), L.y, w, h, 10, 10.8);
  s.text("Competence vs. Potential", 0.1, 10.5, F.dmBold, 15, INK, "left");
  wrapText("Two distinct questions: what the team can do now (horizontal) and how far it can scale toward the exit need (vertical).", 120)
    .forEach((ln, k) => s.text(ln, 0.1, 10.13 - k * 0.32, F.inter, 8.6, V_SUB, "left", "top"));
  const px0 = 1.5, px1 = 9.4, py0 = 0.9, py1 = 8.9;
  const X = (v: number) => px0 + v * (px1 - px0);
  const Y = (v: number) => py0 + v * (py1 - py0);
  const midx = X(0.6), midy = Y(0.6);
  // quadrant shading
  s.rect(px0, py0, midx - px0, midy - py0, "#f7efe0");
  s.rect(midx, midy, px1 - midx, py1 - midy, "#eaf3ee");
  s.rect(px0, midy, midx - px0, py1 - midy, "#eef3f5");
  s.rect(midx, py0, px1 - midx, midy - py0, "#eef3f5");
  // frame + mid lines
  s.rect(px0, py0, px1 - px0, py1 - py0, undefined, V_LINE, 1.0);
  s.line(midx, py0, midx, py1, V_LINE, 0.8, [3, 3]);
  s.line(px0, midy, px1, midy, V_LINE, 0.8, [3, 3]);
  // axes
  s.line(px0, py0, px1 + 0.25, py0, INK, 1.2);
  s.line(px0, py0, px0, py1 + 0.25, INK, 1.2);
  s.text("CURRENT COMPETENCE  \u2192  what the team can do today", (px0 + px1) / 2, py0 - 0.55, F.interSemi, 8.4, INK, "center");
  // vertical axis label — rotated
  drawRotatedText(s, "POTENTIAL / SCALABILITY  \u2192  capacity to grow into the exit need", px0 - 0.45, (py0 + py1) / 2, F.interSemi, 8.4, INK);
  // quadrant captions
  s.text("STRENGTH \u2014 ready & scalable", midx + 0.12, py1 - 0.18, F.interSemi, 7.4, GREEN, "left", "top");
  s.text("RAW \u2014 invest to convert", px0 + 0.12, py1 - 0.18, F.interSemi, 7.4, ACCENT, "left", "top");
  s.text("PLATEAU \u2014 strong now, ceiling risk", midx + 0.12, py0 + 0.30, F.interSemi, 7.4, AMBER, "left", "bottom");
  s.text("BUILD \u2014 develop or hire", px0 + 0.12, py0 + 0.30, F.interSemi, 7.4, RED, "left", "bottom");
  for (const p of pts) {
    const x = X(p.competence), y = Y(p.potential);
    const col = (p.competence >= 0.6 && p.potential >= 0.6) ? GREEN : (p.competence < 0.6 && p.potential < 0.6 ? RED : ACCENT);
    s.circle(x, y, 0.17, col, WHITE, 1.8);
    p.label.split("\n").forEach((ln, k) => s.text(ln, x, y - 0.40 - k * 0.30, F.interMed, 7.6, INK, "center", "top"));
  }
  L.y = L.y + h + 6; // advance cursor below the figure (from-top)
}

function drawRotatedText(s: Surface, text: string, ax: number, ay: number, font: string, size: number, color: string) {
  const c = s.c;
  const x = s.X(ax), y = s.Y(ay);
  c.save();
  c.font(font).fontSize(size).fillColor(color);
  const tw = c.widthOfString(text);
  c.rotate(-90, { origin: [x, y] });
  c.text(text, x - tw / 2, y - size / 2, { lineBreak: false });
  c.restore();
}

// ============================================================
// Composite gauge (standalone, not used inside body but available)
// ============================================================
export function drawGauge(L: Layout, g: VisualData["gauge"]) {
  const { w, h } = fit(5.0, 5.0, CONTENT_W * 0.5);
  L.ensure(h + 6);
  const c = L.doc;
  const cx = L.docX() + w / 2, cy = L.y + h / 2, r = w * 0.32;
  c.save().lineWidth(14).strokeColor(V_LINE);
  drawArc(c, cx, cy, r, 135, 405, V_LINE, 14);
  c.restore();
  const frac = g.value / 100;
  drawArc(c, cx, cy, r, 135, 135 + 270 * frac, g.color, 14);
  c.font(F.dmBold).fontSize(46).fillColor(INK);
  const vw = c.widthOfString(String(g.value));
  c.text(String(g.value), cx - vw / 2, cy - 30, { lineBreak: false });
  L.y = L.y + h + 6; // advance cursor below the figure (from-top)
}
