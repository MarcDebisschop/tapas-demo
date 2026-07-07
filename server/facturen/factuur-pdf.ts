/**
 * server/facturen/factuur-pdf.ts — NIEUW BESTAND (Werkprotocol Regel 2)
 *
 * Echte visuele A4-factuur met pdfkit. Raakt geen bestaand rapport- of
 * factuurpad aan: het bestaande Peppol/UBL-JSON-document blijft ongewijzigd.
 * Deze generator produceert enkel een PDF-weergave van een reeds bestaande
 * factuur-record.
 *
 * Huisstijl-resolutie (bepaald door de aanroeper, zie financieel.ts):
 *   org-override wint van biller; valt terug op de biller-default (#b08b3f).
 *   Logo: org-override anders biller; http(s)-URL wordt gefetcht, data-URI
 *   gedecodeerd, leeg = geen logo. Volledig defensief — een falend logo mag
 *   de PDF nooit doen crashen.
 *
 * Alle bedragen komen in eurocent binnen en worden gedeeld door 100 en als
 * EUR (nl-BE) geformatteerd. Alle teksten zijn Nederlands (Vlaams).
 */
import PDFDocument from "pdfkit";

// ─── Publieke input ─────────────────────────────────────────────────────────

export interface FactuurPdfRegel {
  omschrijving: string;
  aantal: number;
  eenheidsprijsExclCent: number;
  btwTarief: number;
  totaalExclCent: number;
}

export interface FactuurPdfPartij {
  naam?: string | null;
  vennootschapsnaam?: string | null;
  adres?: string | null;
  postcode?: string | null;
  gemeente?: string | null;
  land?: string | null;
  btwNummer?: string | null;
  kboNummer?: string | null;
  peppolId?: string | null;
  iban?: string | null;
  email?: string | null;
}

export interface FactuurPdfHuisstijl {
  kleur: string;
  logo?: string | null;   // URL of data-URI
  footer?: string | null;
}

export interface FactuurPdfInput {
  factuurnummer: string;
  factuurdatum: string;        // ISO
  vervaldatum?: string | null; // ISO
  betaalstatus: string;        // 'betaald' | 'openstaand' | 'vervallen'
  munt: string;
  biller: FactuurPdfPartij;
  klant: FactuurPdfPartij;
  regels: FactuurPdfRegel[];
  bedragExclBtw: number;       // eurocent
  btwBedrag: number;           // eurocent
  bedragInclBtw: number;       // eurocent
  huisstijl: FactuurPdfHuisstijl;
}

// ─── Pagina-geometrie (A4) ──────────────────────────────────────────────────

const PAGE_W = 595.2756;
const PAGE_H = 841.8898;
const MARGIN = 50;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const BOTTOM = PAGE_H - MARGIN;

const INK = "#1e293b";
const MUTE = "#64748b";
const RULE = "#e2e8f0";
const ZEBRA = "#f8fafc";

const BETAALSTATUS_LABEL: Record<string, string> = {
  betaald: "Betaald",
  openstaand: "Openstaand",
  vervallen: "Vervallen",
};
const BETAALSTATUS_KLEUR: Record<string, string> = {
  betaald: "#16a34a",
  openstaand: "#d97706",
  vervallen: "#dc2626",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function euroCent(cent: number): string {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(
    (cent ?? 0) / 100
  );
}

function datumNL(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("nl-BE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Laad een logo defensief: data-URI decoderen of http(s) fetchen. Nooit werpen.
async function laadLogo(bron?: string | null): Promise<Buffer | null> {
  if (!bron || typeof bron !== "string") return null;
  try {
    const s = bron.trim();
    const m = s.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
    if (m) return Buffer.from(m[1], "base64");
    if (/^https?:\/\//i.test(s)) {
      const resp = await fetch(s);
      if (!resp.ok) return null;
      const ab = await resp.arrayBuffer();
      return Buffer.from(ab);
    }
    return null;
  } catch {
    return null;
  }
}

function partijRegels(p: FactuurPdfPartij): string[] {
  const out: string[] = [];
  const titel = p.vennootschapsnaam || p.naam;
  if (titel) out.push(titel);
  if (p.naam && p.vennootschapsnaam && p.naam !== p.vennootschapsnaam) out.push(p.naam);
  if (p.adres) out.push(p.adres);
  const pc = [p.postcode, p.gemeente].filter(Boolean).join(" ");
  if (pc) out.push(pc);
  if (p.land) out.push(p.land);
  if (p.btwNummer) out.push(`BTW: ${p.btwNummer}`);
  else if (p.kboNummer) out.push(`KBO: ${p.kboNummer}`);
  if (p.email) out.push(p.email);
  if (p.peppolId) out.push(`Peppol: ${p.peppolId}`);
  return out;
}

// ─── Generator ──────────────────────────────────────────────────────────────

export async function renderFactuurPdf(input: FactuurPdfInput): Promise<Buffer> {
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(input.huisstijl?.kleur ?? "")
    ? input.huisstijl.kleur
    : "#b08b3f";
  const logoBuf = await laadLogo(input.huisstijl?.logo);

  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [PAGE_W, PAGE_H],
        margin: MARGIN,
        bufferPages: true,
        autoFirstPage: true,
      });
      const F = "Helvetica";
      const FB = "Helvetica-Bold";
      doc.info.Title = `Factuur ${input.factuurnummer}`;
      doc.info.Author = input.biller?.vennootschapsnaam || input.biller?.naam || "TaPas";

      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      let y = MARGIN;

      // ── Kop: logo + titel ────────────────────────────────────────────────
      if (logoBuf) {
        try {
          doc.image(logoBuf, MARGIN, y, { fit: [150, 60] });
        } catch {
          /* corrupt logo — negeer, ga door met tekst */
        }
      }
      doc.font(FB).fontSize(26).fillColor(accent);
      doc.text("FACTUUR", MARGIN, y, { width: CONTENT_W, align: "right" });
      doc.font(F).fontSize(10).fillColor(MUTE);
      doc.text(input.factuurnummer, MARGIN, y + 32, { width: CONTENT_W, align: "right" });

      y += 78;
      doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).lineWidth(2).strokeColor(accent).stroke();
      y += 18;

      // ── Afzender (biller) links, klant rechts ────────────────────────────
      const kolomW = (CONTENT_W - 20) / 2;
      const linkerX = MARGIN;
      const rechterX = MARGIN + kolomW + 20;
      const startY = y;

      const schrijfPartij = (titel: string, p: FactuurPdfPartij, x: number) => {
        let yy = startY;
        doc.font(FB).fontSize(9).fillColor(accent);
        doc.text(titel.toUpperCase(), x, yy, { width: kolomW });
        yy += 14;
        doc.font(F).fontSize(9.5).fillColor(INK);
        for (const r of partijRegels(p)) {
          doc.text(r, x, yy, { width: kolomW });
          yy += 13;
        }
        return yy;
      };

      const yLinks = schrijfPartij("Van", input.biller, linkerX);
      const yRechts = schrijfPartij("Aan", input.klant, rechterX);
      y = Math.max(yLinks, yRechts) + 14;

      // ── Meta-blok: datum, vervaldatum, betaalstatus ──────────────────────
      const status = String(input.betaalstatus ?? "betaald");
      const statusLabel = BETAALSTATUS_LABEL[status] ?? status;
      const statusKleur = BETAALSTATUS_KLEUR[status] ?? MUTE;

      doc.font(F).fontSize(9.5).fillColor(MUTE);
      doc.text(`Factuurdatum: `, MARGIN, y, { continued: true }).fillColor(INK).text(datumNL(input.factuurdatum));
      doc.fillColor(MUTE).text(`Vervaldatum: `, MARGIN, y + 14, { continued: true }).fillColor(INK).text(datumNL(input.vervaldatum));

      // Betaalstatus-badge (rechts uitgelijnd)
      const badgeTekst = statusLabel;
      doc.font(FB).fontSize(9);
      const bw = doc.widthOfString(badgeTekst) + 20;
      const bx = PAGE_W - MARGIN - bw;
      doc.roundedRect(bx, y, bw, 20, 5).fillColor(statusKleur).fill();
      doc.fillColor("#ffffff").text(badgeTekst, bx, y + 6, { width: bw, align: "center" });

      y += 40;

      // ── Regels-tabel ─────────────────────────────────────────────────────
      const cols = [
        { key: "omschrijving", label: "Omschrijving", w: 0.40, align: "left" as const },
        { key: "aantal", label: "Aantal", w: 0.10, align: "right" as const },
        { key: "eenheid", label: "Eenh. excl.", w: 0.18, align: "right" as const },
        { key: "btw", label: "Btw %", w: 0.12, align: "right" as const },
        { key: "totaal", label: "Totaal excl.", w: 0.20, align: "right" as const },
      ];
      const colX: number[] = [];
      let acc = MARGIN;
      for (const c of cols) {
        colX.push(acc);
        acc += c.w * CONTENT_W;
      }
      const cellW = (i: number) => cols[i].w * CONTENT_W - 8;

      const kopHoogte = 22;
      doc.rect(MARGIN, y, CONTENT_W, kopHoogte).fillColor(accent).fill();
      doc.font(FB).fontSize(9).fillColor("#ffffff");
      cols.forEach((c, i) => {
        doc.text(c.label, colX[i] + 4, y + 7, { width: cellW(i), align: c.align });
      });
      y += kopHoogte;

      const rijHoogte = 20;
      doc.font(F).fontSize(9).fillColor(INK);
      input.regels.forEach((r, idx) => {
        if (y + rijHoogte > BOTTOM - 120) {
          doc.addPage();
          y = MARGIN;
        }
        if (idx % 2 === 1) {
          doc.rect(MARGIN, y, CONTENT_W, rijHoogte).fillColor(ZEBRA).fill();
        }
        doc.fillColor(INK).font(F).fontSize(9);
        const waarden = [
          String(r.omschrijving ?? ""),
          String(r.aantal ?? 0),
          euroCent(r.eenheidsprijsExclCent),
          `${r.btwTarief ?? 0}%`,
          euroCent(r.totaalExclCent),
        ];
        waarden.forEach((v, i) => {
          doc.text(v, colX[i] + 4, y + 6, { width: cellW(i), align: cols[i].align });
        });
        y += rijHoogte;
      });

      doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).lineWidth(1).strokeColor(RULE).stroke();
      y += 12;

      // ── Totalen (rechts) ─────────────────────────────────────────────────
      const totLabelX = MARGIN + CONTENT_W * 0.55;
      const totWaardeX = MARGIN + CONTENT_W * 0.78;
      const totLabelW = CONTENT_W * 0.22;
      const totWaardeW = CONTENT_W * 0.22;
      const totRegel = (label: string, waarde: string, vet = false) => {
        doc.font(vet ? FB : F).fontSize(vet ? 11 : 9.5).fillColor(vet ? accent : MUTE);
        doc.text(label, totLabelX, y, { width: totLabelW, align: "right" });
        doc.fillColor(vet ? accent : INK).font(vet ? FB : F);
        doc.text(waarde, totWaardeX, y, { width: totWaardeW, align: "right" });
        y += vet ? 20 : 16;
      };
      totRegel("Bedrag excl. btw", euroCent(input.bedragExclBtw));
      totRegel("Btw", euroCent(input.btwBedrag));
      y += 2;
      doc.moveTo(totLabelX, y).lineTo(PAGE_W - MARGIN, y).lineWidth(1).strokeColor(RULE).stroke();
      y += 6;
      totRegel("Totaal incl. btw", euroCent(input.bedragInclBtw), true);

      // ── IBAN / betaalinstructie ──────────────────────────────────────────
      if (input.biller?.iban && status !== "betaald") {
        y += 10;
        doc.font(F).fontSize(9).fillColor(MUTE);
        doc.text(
          `Gelieve ${euroCent(input.bedragInclBtw)} te storten op ${input.biller.iban} met vermelding van ${input.factuurnummer}.`,
          MARGIN,
          y,
          { width: CONTENT_W }
        );
      }

      // ── Footer ───────────────────────────────────────────────────────────
      // Blijf op de HUIDIGE pagina: plaats de footer laag, maar begrens fy zo
      // dat de tekst volledig binnen de ondermarge valt (voorkomt dat pdfkit
      // automatisch een lege extra pagina toevoegt).
      const footer = (input.huisstijl?.footer ?? "").trim();
      if (footer) {
        doc.font(F).fontSize(8).fillColor(MUTE);
        const fh = doc.heightOfString(footer, { width: CONTENT_W });
        // Veiligheidsbuffer zodat de tekst gegarandeerd vóór de ondermarge
        // eindigt en pdfkit geen extra pagina toevoegt.
        const VEILIG = 14;
        const maxFy = BOTTOM - fh - VEILIG;
        const fy = Math.min(maxFy, Math.max(y + 24, maxFy));
        doc.moveTo(MARGIN, fy - 8).lineTo(PAGE_W - MARGIN, fy - 8).lineWidth(1).strokeColor(RULE).stroke();
        doc.text(footer, MARGIN, fy, { width: CONTENT_W, align: "center", height: fh });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
