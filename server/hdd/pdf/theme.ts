/**
 * Flagship HDD PDF — theme: palette, geometry, fonts.
 * Mirrors build_flagship_pdf.py exactly so the Node output matches the
 * approved specimen.
 */
import { FONT_BUFFERS } from "./fonts";

// ---- Palette (identical to the approved specimen) ----
export const INK = "#0f2733";
export const INK2 = "#16384a";
export const ACCENT = "#1f6f8b";
export const SUB = "#5b6b73";
export const LINE = "#e3e8ea";
export const SURFACE = "#f7f8f9";
export const SURFACE2 = "#eef3f4";
export const WHITE = "#ffffff";
export const GOLD = "#caa24a";
export const GREEN = "#2e7d57";
export const AMBER = "#b8732b";
export const RED = "#9b2c2c";
export const BODYCOL = "#283238";

// Visual-only extra tints used inside the matplotlib mocks.
export const LIGHT = "#eef3f5";
export const VLINE = "#dfe6e9";

export const VERDICT_COLOR: Record<string, string> = {
  proceed: GREEN,
  conditional: AMBER,
  "hold-conditional": AMBER,
  hold: RED,
};

export const BAND_COLOR: Record<string, string> = {
  High: GREEN, Robust: GREEN, Strong: GREEN, Fit: GREEN, Deep: GREEN,
  Medium: AMBER, Watch: AMBER, Adequate: AMBER, Stretch: AMBER, Moderate: AMBER, Solid: AMBER,
  Low: RED, Fragile: RED, Thin: RED, Gap: RED, "High Risk": RED, "Thin coverage": RED,
};

// ---- Geometry (A4, points). reportlab uses mm; 1mm = 2.834645669 pt ----
export const MM = 2.834645669;
export const PAGE_W = 595.2756; // A4 width  in pt
export const PAGE_H = 841.8898; // A4 height in pt
export const MARGIN = 19 * MM;
export const CONTENT_W = PAGE_W - 2 * MARGIN;

// Body frame (matches reportlab: topMargin 22mm, content starts below header)
export const BODY_TOP = PAGE_H - 22 * MM; // first baseline area top (y from top)
export const BODY_BOTTOM = 15 * MM; // frame bottom (y from bottom)

// ---- Font registration ----
// PDF font names used throughout (mirror the reportlab registered names).
export const F = {
  dm: "DMSans",
  dmMed: "DMSans-Med",
  dmBold: "DMSans-Bold",
  inter: "Inter",
  interMed: "Inter-Med",
  interSemi: "Inter-Semi",
};

export function registerFonts(doc: PDFKit.PDFDocument) {
  doc.registerFont(F.dm, FONT_BUFFERS["DMSans_Regular"]);
  doc.registerFont(F.dmMed, FONT_BUFFERS["DMSans_Medium"]);
  doc.registerFont(F.dmBold, FONT_BUFFERS["DMSans_Bold"]);
  doc.registerFont(F.inter, FONT_BUFFERS["Inter_Regular"]);
  doc.registerFont(F.interMed, FONT_BUFFERS["Inter_Medium"]);
  doc.registerFont(F.interSemi, FONT_BUFFERS["Inter_Semi"]);
}

export function bandColor(label: string | undefined): string {
  if (!label) return SUB;
  return BAND_COLOR[label] ?? SUB;
}
