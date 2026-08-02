/**
 * Driver-scan — kort visueel PDF-rapport (1–2+ pagina's, 5 talen).
 *
 * Nieuwe, aparte generator (Regel 2): raakt geen bestaand rapportpad aan en
 * dupliceert geen scoring. De driver-rijen (net + avgEnergy) komen van
 * buildMainScores (scoring.ts, ONGEWIJZIGD) via de Driver-scan route.
 *
 * Engine: pdfkit (pure Node) met zelf-ingebedde DejaVu Sans (fonts.ts) zodat
 * Cyrillisch (RU) én de energie-pijlen ↑ ↓ overal correct renderen.
 *
 * Rapportopbouw:
 *   1. Kop "Driver-scan" + expliciete disclaimer: staat volledig LOS van de 2MINSCAN.
 *   2. Driver-volgorde VISUEEL: genummerde ranglijst + staafbeeld (sterkst→zwakst).
 *   3. Betekenis van de volgorde: welke driver het sterkst "aan het stuur" zit.
 *   4. REM OF GASPEDAAL per driver — het rijkst uitgewerkte deel (Marc's nadruk).
 *   5. Numeriek overzicht: ruwe net-score én avgEnergy + energie-signaal (↑/↓).
 */
import PDFDocument from "pdfkit";
import { DRIVERSCAN_FONTS } from "./fonts";
import {
  UI,
  DRIVER_DUIDING,
  DRIVER_KEYS,
  GASPEDAAL_REM_GRENS,
  veiligeTaal,
  type Taal,
  type DriverKey,
} from "./duiding";

// ─── Publieke input ─────────────────────────────────────────────────────────

export interface DriverScanRow {
  key: DriverKey;
  net: number;
  avgEnergy: number;
  toelichting?: string | null;
}

export interface DriverScanPdfInput {
  taal: string;
  naam?: string;
  datum?: string; // reeds geformatteerde datumstring (optioneel)
  drivers: DriverScanRow[];
}

// ─── Pagina-geometrie (A4) ──────────────────────────────────────────────────

const PAGE_W = 595.2756;
const PAGE_H = 841.8898;
const MARGIN = 48;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const BOTTOM = PAGE_H - MARGIN;

// ─── Kleuren ────────────────────────────────────────────────────────────────

const INK = "#1e293b";
const MUTE = "#64748b";
const FAINT = "#94a3b8";
const ACCENT = "#0f766e"; // teal
const ACCENT_SOFT = "#ccfbf1";
const RULE = "#e2e8f0";
const GAS = "#16a34a"; // groen — gaspedaal / energie ↑
const REM = "#dc2626"; // rood  — rem / energie ↓
const CARD = "#f8fafc";
const GOLD = "#b45309";

const F = "DVS";
const FB = "DVS-B";

// ─── Generator ──────────────────────────────────────────────────────────────

export function renderDriverScanPdf(input: DriverScanPdfInput): Promise<Buffer> {
  const taal: Taal = veiligeTaal(input.taal);
  const ui = UI[taal];
  const duiding = DRIVER_DUIDING[taal];

  // Rangschik sterkst→zwakst op net (aflopend); stabiel op vaste driver-volgorde.
  const rows = [...input.drivers].sort((a, b) => {
    if (b.net !== a.net) return b.net - a.net;
    return DRIVER_KEYS.indexOf(a.key) - DRIVER_KEYS.indexOf(b.key);
  });

  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [PAGE_W, PAGE_H],
        margin: MARGIN,
        bufferPages: true,
        autoFirstPage: true,
      });
      doc.registerFont(F, DRIVERSCAN_FONTS.regular);
      doc.registerFont(FB, DRIVERSCAN_FONTS.bold);
      doc.info.Title = `${ui.documentTitel}`;
      doc.info.Author = "TaPas";

      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      let y = MARGIN;

      // ── helpers ──────────────────────────────────────────────────────────
      const need = (h: number) => {
        if (y + h > BOTTOM) {
          doc.addPage();
          y = MARGIN;
        }
      };
      const text = (
        s: string,
        opts: {
          font?: string;
          size?: number;
          color?: string;
          x?: number;
          w?: number;
          gap?: number;
          lineGap?: number;
        } = {}
      ) => {
        const font = opts.font ?? F;
        const size = opts.size ?? 10;
        const x = opts.x ?? MARGIN;
        const w = opts.w ?? CONTENT_W;
        doc.font(font).fontSize(size).fillColor(opts.color ?? INK);
        const h = doc.heightOfString(s, { width: w, lineGap: opts.lineGap ?? 2 });
        need(h);
        doc.text(s, x, y, { width: w, lineGap: opts.lineGap ?? 2 });
        y += h + (opts.gap ?? 6);
      };
      const rule = (gap = 10) => {
        need(gap + 1);
        doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).lineWidth(0.75).strokeColor(RULE).stroke();
        y += gap;
      };
      const sectie = (titel: string) => {
        need(30);
        y += 4;
        doc.font(FB).fontSize(13).fillColor(ACCENT).text(titel, MARGIN, y);
        y += 20;
      };

      // ── 1. Kop ──────────────────────────────────────────────────────────
      doc.rect(MARGIN, y, CONTENT_W, 3).fill(ACCENT);
      y += 12;
      doc.font(FB).fontSize(24).fillColor(INK).text(ui.documentTitel, MARGIN, y);
      y += 30;
      doc.font(FB).fontSize(8.5).fillColor(ACCENT).text(ui.kicker.toUpperCase(), MARGIN, y, {
        characterSpacing: 0.5,
      });
      y += 16;

      // naam + datum (indien aanwezig)
      const meta: string[] = [];
      if (input.naam) meta.push(`${ui.naamLabel}: ${input.naam}`);
      const datum = input.datum ?? new Date().toLocaleDateString(localeVan(taal));
      meta.push(`${ui.datumLabel}: ${datum}`);
      doc.font(F).fontSize(9).fillColor(MUTE).text(meta.join("   ·   "), MARGIN, y);
      y += 18;

      // ── Disclaimer-kaart (LOS van 2MINSCAN) ───────────────────────────────
      {
        doc.font(FB).fontSize(10).fillColor(GOLD);
        const th = doc.heightOfString(ui.disclaimerTitel, { width: CONTENT_W - 24 });
        doc.font(F).fontSize(9).fillColor(INK);
        const bh = doc.heightOfString(ui.disclaimer, { width: CONTENT_W - 24, lineGap: 2 });
        const boxH = th + bh + 24;
        need(boxH);
        doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 8).fillAndStroke("#fffbeb", "#fcd34d");
        doc.font(FB).fontSize(10).fillColor(GOLD).text(ui.disclaimerTitel, MARGIN + 12, y + 10, {
          width: CONTENT_W - 24,
        });
        doc
          .font(F)
          .fontSize(9)
          .fillColor(INK)
          .text(ui.disclaimer, MARGIN + 12, y + 10 + th + 4, { width: CONTENT_W - 24, lineGap: 2 });
        y += boxH + 14;
      }

      // ── 2. Driver-volgorde: ranglijst + staafbeeld ────────────────────────
      sectie(ui.volgordeTitel);
      text(ui.volgordeIntro, { size: 9.5, color: MUTE, gap: 12 });

      const maxAbsNet = Math.max(1, ...rows.map((r) => Math.abs(r.net)));
      const numW = 26;
      const nameW = 152; // breed genoeg voor de vertaalde labels (langste: Please Others)
      const nameSize = 9.5;
      const barX = MARGIN + numW + nameW + 8;
      const barMaxW = PAGE_W - MARGIN - barX - 54; // ruimte rechts voor net-getal

      rows.forEach((r, i) => {
        const d = duiding[r.key];
        // De naam wordt ÉÉN keer getoond (het vertaalde label). Meet de hoogte
        // zodat lange labels netjes over max. twee regels lopen zonder overlap.
        doc.font(FB).fontSize(nameSize);
        const nameH = doc.heightOfString(d.naam, { width: nameW, lineGap: 1 });
        const rowH = Math.max(30, nameH + 12);
        need(rowH + 4);
        const cy = y;
        const midY = cy + rowH / 2; // gedeelde verticale as voor alle elementen

        // rangnummer-badge (verticaal gecentreerd)
        doc.roundedRect(MARGIN, midY - 11, numW - 6, 22, 4).fill(i === 0 ? ACCENT : ACCENT_SOFT);
        doc
          .font(FB)
          .fontSize(11)
          .fillColor(i === 0 ? "#ffffff" : ACCENT)
          .text(String(i + 1), MARGIN, midY - 6, { width: numW - 6, align: "center" });

        // drivernaam — enkel het vertaalde label, verticaal gecentreerd
        doc
          .font(FB)
          .fontSize(nameSize)
          .fillColor(INK)
          .text(d.naam, MARGIN + numW, midY - nameH / 2, { width: nameW, lineGap: 1 });

        // staaf (net; kan negatief zijn — teken vanaf een middenas)
        const axisX = barX + barMaxW / 2;
        const half = barMaxW / 2;
        const w = (Math.abs(r.net) / maxAbsNet) * half;
        doc.moveTo(axisX, midY - 13).lineTo(axisX, midY + 13).lineWidth(0.5).strokeColor(RULE).stroke();
        const pos = r.net >= 0;
        doc
          .roundedRect(pos ? axisX : axisX - w, midY - 7, Math.max(w, 1), 14, 3)
          .fill(pos ? ACCENT : FAINT);

        // net-getal + energiepijl rechts (verticaal gecentreerd)
        const sig = signaal(r.avgEnergy);
        doc
          .font(FB)
          .fontSize(10)
          .fillColor(INK)
          .text(fmtNet(r.net), PAGE_W - MARGIN - 50, midY - 6, { width: 30, align: "right" });
        doc
          .font(FB)
          .fontSize(11)
          .fillColor(sig.color)
          .text(sig.arrow, PAGE_W - MARGIN - 16, midY - 7, { width: 16, align: "right" });
        y += rowH;
      });
      y += 4;

      // ── 3. Betekenis van de volgorde ──────────────────────────────────────
      const top = duiding[rows[0].key].naam;
      sectie(ui.betekenisTitel);
      text(ui.betekenisIntro(top), { size: 10, gap: 14 });

      // ── 4. REM OF GASPEDAAL per driver (rijkst) ───────────────────────────
      sectie(ui.remGasTitel);
      text(ui.remGasIntro, { size: 10, color: MUTE, gap: 14 });

      rows.forEach((r, i) => {
        const d = duiding[r.key];
        // Kaartkop
        need(46);
        doc.roundedRect(MARGIN, y, CONTENT_W, 26, 6).fillAndStroke(CARD, RULE);
        doc.font(FB).fontSize(11).fillColor(ACCENT).text(`${i + 1}. ${d.naam}`, MARGIN + 12, y + 7, {
          width: CONTENT_W - 120,
        });
        const sig = signaal(r.avgEnergy);
        doc
          .font(F)
          .fontSize(8.5)
          .fillColor(MUTE)
          .text(
            `${ui.kolomNet} ${fmtNet(r.net)}   ·   ${ui.kolomEnergie} ${fmt2(r.avgEnergy)}`,
            PAGE_W - MARGIN - 150,
            y + 8,
            { width: 130, align: "right" }
          );
        y += 32;
        // kern
        text(d.kern, { size: 9, color: MUTE, gap: 8, x: MARGIN + 4, w: CONTENT_W - 8 });
        // gaspedaal
        labelBlok(ui.gaspedaalLabel.toUpperCase(), GAS, d.gaspedaal);
        // rem
        labelBlok(ui.remLabel.toUpperCase(), REM, d.rem);
        // kantelpunt
        labelBlok("↔", ACCENT, d.kantel);
        // optionele deelnemer-toelichting (alleen indien ingevuld bij een
        // energiekostende keuze); weggelaten bij oudere afnames zonder tekst.
        if (typeof r.toelichting === "string" && r.toelichting.trim()) {
          labelBlok(ui.toelichtingLabel.toUpperCase(), MUTE, r.toelichting.trim());
        }
        y += 10;
      });

      // Ingebedde helper die een gekleurd labelblokje + tekst tekent.
      function labelBlok(label: string, kleur: string, body: string) {
        doc.font(FB).fontSize(8);
        const lw = Math.max(46, doc.widthOfString(label) + 14);
        doc.font(F).fontSize(9);
        const bh = doc.heightOfString(body, { width: CONTENT_W - lw - 12, lineGap: 2 });
        need(Math.max(bh, 16) + 8);
        // pill
        doc.roundedRect(MARGIN + 4, y, lw, 15, 7).fill(kleur);
        doc
          .font(FB)
          .fontSize(8)
          .fillColor("#ffffff")
          .text(label, MARGIN + 4, y + 3.5, { width: lw, align: "center" });
        // body
        doc
          .font(F)
          .fontSize(9)
          .fillColor(INK)
          .text(body, MARGIN + 4 + lw + 8, y, { width: CONTENT_W - lw - 16, lineGap: 2 });
        y += Math.max(bh, 15) + 6;
      }

      // ── 5. Numeriek overzicht ─────────────────────────────────────────────
      sectie(ui.numeriekTitel);
      // tabelkop
      need(24);
      const c1 = MARGIN;
      const c2 = MARGIN + 210;
      const c3 = MARGIN + 320;
      const c4 = MARGIN + 430;
      doc.font(FB).fontSize(8.5).fillColor(MUTE);
      doc.text(ui.kolomDriver, c1, y);
      doc.text(ui.kolomNet, c2, y, { width: 90, align: "right" });
      doc.text(ui.kolomEnergie, c3, y, { width: 90, align: "right" });
      doc.text(ui.kolomSignaal, c4, y, { width: PAGE_W - MARGIN - c4, align: "right" });
      y += 15;
      rule(8);
      rows.forEach((r) => {
        need(20);
        const d = duiding[r.key];
        const sig = signaal(r.avgEnergy);
        doc.font(F).fontSize(9.5).fillColor(INK).text(d.naam, c1, y, { width: 200 });
        doc.font(FB).fontSize(9.5).fillColor(INK).text(fmtNet(r.net), c2, y, { width: 90, align: "right" });
        doc.font(F).fontSize(9.5).fillColor(INK).text(fmt2(r.avgEnergy), c3, y, { width: 90, align: "right" });
        doc
          .font(FB)
          .fontSize(9.5)
          .fillColor(sig.color)
          .text(`${sig.arrow} ${sig.label(ui)}`, c4, y, { width: PAGE_W - MARGIN - c4, align: "right" });
        y += 16;
      });
      y += 6;
      rule(8);
      text(ui.netUitleg, { size: 8, color: FAINT, gap: 3 });
      text(ui.energieUitleg, { size: 8, color: FAINT, gap: 10 });

      // ── Voetnoot ──────────────────────────────────────────────────────────
      rule(8);
      text(ui.voetnoot, { size: 7.5, color: FAINT, gap: 2 });
      text(`${ui.gegenereerd} ${datum}`, { size: 7.5, color: FAINT });

      doc.end();
    } catch (e) {
      reject(e as Error);
    }
  });

  // ── kleine hulpfuncties ─────────────────────────────────────────────────
  function signaal(avg: number): {
    arrow: string;
    color: string;
    label: (ui: (typeof UI)[Taal]) => string;
  } {
    if (avg >= GASPEDAAL_REM_GRENS) return { arrow: "↑", color: GAS, label: (u) => u.gaspedaalLabel };
    return { arrow: "↓", color: REM, label: (u) => u.remLabel };
  }
  function fmtNet(n: number): string {
    return (n > 0 ? "+" : "") + String(n);
  }
  function fmt2(n: number): string {
    const s = (n > 0 ? "+" : "") + n.toFixed(2);
    return s;
  }
  function localeVan(t: Taal): string {
    return { nl: "nl-BE", fr: "fr-BE", en: "en-GB", es: "es-ES", ru: "ru-RU" }[t];
  }
}
