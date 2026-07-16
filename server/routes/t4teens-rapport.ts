/**
 * server/routes/t4teens-rapport.ts
 *
 * Per-leerling T4Teens rapport + PDF.
 *
 *   POST /api/t4teens/rapport
 *     body: { deelnemer:{naam,leeftijd?,klas?}, answers, energy }
 *     → scoring → HTML → PDF → in-memory opslag → { id, rapportUrl, pdfUrl }
 *
 *   GET  /api/t4teens/rapport/:id        → HTML-rapport (text/html)
 *   GET  /api/t4teens/rapport/:id/pdf    → PDF-download (application/pdf)
 *
 * Nieuw bestand — Regel 2: additief, eigen module-namespace.
 * Raakt bestaand gedrag niet aan.
 */

import type { Express, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import type { Answers, Energy, VonkMsg } from "../t4teens/scoring";
import { scoreVonk, selectVonk, VONK_MSG } from "../t4teens/scoring";
import { renderT4TeensHtml } from "../t4teens/rapport";
import { bouwT4TeensPdf } from "../t4teens/rapport-pdf";
import { storage } from "../storage";

// ADDITIEF (Regel 2): bouw de "uitlezing"-kaarten (titel + korte tekst) uit de
// opgeslagen vonk-antwoorden — exact dezelfde selectie (scoreVonk + selectVonk)
// die de losse vonk-client en de Studiekompas gebruiken. VonkMeta-items (opening/
// closing zonder title) worden overgeslagen; enkel echte headline-kaarten blijven.
function bouwUitlezingKaarten(answers: Answers, energy: Energy): { icon: string; title: string; body: string }[] {
  const scores = scoreVonk(answers, energy);
  const ids = selectVonk(scores);
  const kaarten: { icon: string; title: string; body: string }[] = [];
  for (const id of ids) {
    const msg = VONK_MSG[id] as VonkMsg | undefined;
    if (msg && "title" in msg && msg.title) {
      kaarten.push({ icon: msg.icon, title: msg.title, body: msg.body });
    }
  }
  return kaarten;
}

function parseVonkAntwoorden(raw: string | null | undefined): { answers: Answers; energy: Energy } {
  if (!raw) return { answers: {}, energy: {} };
  try {
    const o = typeof raw === "string" ? JSON.parse(raw) : raw;
    return {
      answers: o && typeof o.answers === "object" && o.answers ? o.answers : {},
      energy: o && typeof o.energy === "object" && o.energy ? o.energy : {},
    };
  } catch {
    return { answers: {}, energy: {} };
  }
}

interface Deelnemer {
  naam: string;
  leeftijd?: string | number;
  klas?: string;
  code?: string;
}

interface OpgeslagenRapport {
  id: string;
  html: string;
  pdf: Buffer | null;
  naam: string;
  aangemaakt: number;
  // ADDITIEF (Regel 2): koppeling naar de platform-afname die dit Studiekompas
  // opleverde. Enkel gevuld bij een platform-afname; de losse vonk-flow laat dit
  // leeg. Laat de uitlezing-endpoint het juiste rapport per afname terugvinden.
  afnameId?: number | null;
}

// In-memory opslag (desnoods per BUILD-BRIEF). Simpele LRU-cap tegen groei.
const RAPPORTEN = new Map<string, OpgeslagenRapport>();
const MAX_RAPPORTEN = 200;

// ── Persistente schijfopslag (ADDITIEF — Werkprotocol Regel 2) ──────────────
// Naast de in-memory Map bewaren we elk rapport ook op schijf, zodat de
// gegenereerde Studiekompas-PDF's een herstart van de service overleven en
// centraal (als ZIP) opgehaald kunnen worden. Dit raakt geen bestaand pad:
// de bestaande POST/GET-routes blijven identiek werken; dit voegt enkel een
// extra, best-effort persistentielaag toe. Faalt schrijven/lezen (bv. read-only
// FS), dan valt alles stil terug op de in-memory Map.
function rapportenDir(): string {
  const dir = path.resolve(process.cwd(), "t4teens-rapporten");
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    /* ignore — best-effort */
  }
  return dir;
}

function schrijfNaarSchijf(r: OpgeslagenRapport): void {
  try {
    const dir = rapportenDir();
    const meta = {
      id: r.id,
      naam: r.naam,
      aangemaakt: r.aangemaakt,
      heeftPdf: !!r.pdf,
      afnameId: r.afnameId ?? null,
    };
    fs.writeFileSync(path.join(dir, `${r.id}.json`), JSON.stringify(meta), "utf-8");
    fs.writeFileSync(path.join(dir, `${r.id}.html`), r.html, "utf-8");
    if (r.pdf) fs.writeFileSync(path.join(dir, `${r.id}.pdf`), r.pdf);
  } catch (e) {
    console.error("[T4Teens rapport] Schijf-persistentie mislukt (best-effort):", e);
  }
}

// Laad bij opstart de op schijf bewaarde rapporten terug in de Map, zodat de
// lijst/ZIP en de bestaande GET-routes ook na een herstart blijven werken.
function laadVanSchijf(): void {
  try {
    const dir = rapportenDir();
    const bestanden = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    for (const jsonBestand of bestanden) {
      try {
        const meta = JSON.parse(fs.readFileSync(path.join(dir, jsonBestand), "utf-8"));
        if (!meta || !meta.id) continue;
        const htmlPad = path.join(dir, `${meta.id}.html`);
        const pdfPad = path.join(dir, `${meta.id}.pdf`);
        const html = fs.existsSync(htmlPad) ? fs.readFileSync(htmlPad, "utf-8") : "";
        const pdf = fs.existsSync(pdfPad) ? fs.readFileSync(pdfPad) : null;
        RAPPORTEN.set(meta.id, {
          id: meta.id,
          html,
          pdf,
          naam: meta.naam || "deelnemer",
          aangemaakt: meta.aangemaakt || Date.now(),
          afnameId: typeof meta.afnameId === "number" ? meta.afnameId : null,
        });
      } catch {
        /* sla individueel corrupt bestand over */
      }
    }
  } catch {
    /* map bestaat nog niet of niet leesbaar — geen probleem */
  }
}

function verwijderVanSchijf(id: string): void {
  try {
    const dir = rapportenDir();
    for (const ext of [".json", ".html", ".pdf"]) {
      const p = path.join(dir, `${id}${ext}`);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  } catch {
    /* best-effort */
  }
}

// Veilige bestandsnaam voor download (zelfde regel als de bestaande /pdf-route).
function veiligeBestandsnaam(naam: string): string {
  return (naam || "deelnemer").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "deelnemer";
}

function bewaar(r: OpgeslagenRapport): void {
  RAPPORTEN.set(r.id, r);
  schrijfNaarSchijf(r);
  while (RAPPORTEN.size > MAX_RAPPORTEN) {
    const oudste = RAPPORTEN.keys().next().value;
    if (oudste === undefined) break;
    RAPPORTEN.delete(oudste);
    verwijderVanSchijf(oudste);
  }
}

// ── ADDITIEF (Regel 2): herbruikbare opslag-helper ──────────────────────────
// Slaat een reeds gegenereerd Studiekompas (HTML + optionele PDF) op via exact
// dezelfde weg als de POST /api/t4teens/rapport-route: in-memory Map + schijf-
// persistentie + LRU-cap (zie `bewaar`). Zo verschijnt een rapport dat elders in
// de codebase wordt aangemaakt (bv. bij het voltooien van een platform-afname in
// server/routes/afnames.ts) automatisch in de centrale lijst en de ZIP-download,
// ZONDER de opslaglogica te dupliceren.
// Retourneert dezelfde vorm als de POST-route: { id, rapportUrl, pdfUrl }.
export function slaT4TeensRapportOp(
  html: string,
  pdf: Buffer | null,
  naam: string,
  afnameId?: number | null,
): { id: string; rapportUrl: string; pdfUrl: string | null } {
  const id = randomUUID();
  bewaar({ id, html, pdf, naam: naam || "deelnemer", aangemaakt: Date.now(), afnameId: afnameId ?? null });
  return {
    id,
    rapportUrl: `/api/t4teens/rapport/${id}`,
    pdfUrl: pdf ? `/api/t4teens/rapport/${id}/pdf` : null,
  };
}

// Zoek het meest recente bewaarde rapport voor een gegeven platform-afname.
function vindRapportVoorAfname(afnameId: number): OpgeslagenRapport | undefined {
  let gevonden: OpgeslagenRapport | undefined;
  for (const r of RAPPORTEN.values()) {
    if (r.afnameId === afnameId && (!gevonden || r.aangemaakt >= gevonden.aangemaakt)) {
      gevonden = r;
    }
  }
  return gevonden;
}

export function registerT4TeensRapportRoutes(app: Express): void {
  // Herstel bij opstart de op schijf bewaarde rapporten (additief, best-effort).
  laadVanSchijf();

  app.post("/api/t4teens/rapport", async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      const deelnemer: Deelnemer = body.deelnemer ?? {};
      const answers: Answers = body.answers ?? {};
      const energy: Energy = body.energy ?? {};

      if (!deelnemer.naam || typeof deelnemer.naam !== "string") {
        return res.status(400).json({ error: "deelnemer.naam is verplicht." });
      }
      if (!answers || typeof answers !== "object") {
        return res.status(400).json({ error: "answers ontbreekt of is ongeldig." });
      }

      const jaar = new Date().getFullYear();
      const rnd = String(Math.floor(1000 + Math.random() * 9000));
      const code = deelnemer.code || `T4T-${jaar}-${rnd}`;

      const html = renderT4TeensHtml(answers, energy, {
        naam: deelnemer.naam,
        leeftijd: deelnemer.leeftijd,
        klas: deelnemer.klas,
        code,
      });

      const id = randomUUID();

      // Sla HTML meteen op; PDF proberen we te genereren maar mag falen
      // (bv. als chromium niet beschikbaar is) zonder de HTML te blokkeren.
      let pdf: Buffer | null = null;
      try {
        pdf = await bouwT4TeensPdf(html);
      } catch (pdfErr) {
        console.error("[T4Teens rapport] PDF-generatie mislukt:", pdfErr);
      }

      bewaar({ id, html, pdf, naam: deelnemer.naam, aangemaakt: Date.now() });

      const resp: { id: string; rapportUrl: string; pdfUrl: string | null } = {
        id,
        rapportUrl: `/api/t4teens/rapport/${id}`,
        pdfUrl: pdf ? `/api/t4teens/rapport/${id}/pdf` : null,
      };
      res.json(resp);
    } catch (e) {
      console.error("[T4Teens rapport] Fout bij genereren:", e);
      res.status(500).json({ error: "Rapport kon niet worden gegenereerd." });
    }
  });

  app.get("/api/t4teens/rapport/:id", (req: Request, res: Response) => {
    const r = RAPPORTEN.get(req.params.id);
    if (!r) return res.status(404).send("Rapport niet gevonden of verlopen.");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(r.html);
  });

  app.get("/api/t4teens/rapport/:id/pdf", (req: Request, res: Response) => {
    const r = RAPPORTEN.get(req.params.id);
    if (!r) return res.status(404).send("Rapport niet gevonden of verlopen.");
    if (!r.pdf) return res.status(404).send("PDF niet beschikbaar voor dit rapport.");
    const bestand = `T4Teens-Studiekompas-${r.naam.replace(/[^\p{L}\p{N}]+/gu, "-")}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${bestand}"`);
    res.send(r.pdf);
  });

  // ── ADDITIEF (Regel 2): centrale lijst van bewaarde T4Teens-rapporten ──────
  // Geeft de admin een overzicht van alle gegenereerde Studiekompas-rapporten,
  // gesorteerd van nieuw naar oud. Raakt geen bestaand pad aan.
  app.get("/api/t4teens/rapporten", (_req: Request, res: Response) => {
    const lijst = Array.from(RAPPORTEN.values())
      .sort((a, b) => b.aangemaakt - a.aangemaakt)
      .map((r) => ({
        id: r.id,
        naam: r.naam,
        aangemaakt: r.aangemaakt,
        heeftPdf: !!r.pdf,
        rapportUrl: `/api/t4teens/rapport/${r.id}`,
        pdfUrl: r.pdf ? `/api/t4teens/rapport/${r.id}/pdf` : null,
      }));
    res.json({ aantal: lijst.length, metPdf: lijst.filter((r) => r.heeftPdf).length, rapporten: lijst });
  });

  // ── ADDITIEF (Regel 2): uitlezing + PDF-koppeling per platform-afname ──────
  // Geeft de leerling op het einde van de platform/mail-flow dezelfde "uitlezing"
  // (opvallende headline-kaarten) als de losse vonk-client, plus de download-URL
  // van het al gegenereerde Studiekompas. Guarded op instrumentId "t4teens";
  // elk ander instrument krijgt 404 zodat de klassieke flow onaangeroerd blijft.
  app.get("/api/t4teens/afname/:afnameId/uitlezing", async (req: Request, res: Response) => {
    const afnameId = Number(req.params.afnameId);
    if (!Number.isFinite(afnameId)) return res.status(400).json({ error: "Ongeldig afname-id." });
    const afname = await storage.getAfname(afnameId);
    if (!afname || afname.instrumentId !== "t4teens") {
      return res.status(404).json({ error: "Geen T4Teens-uitlezing voor deze afname." });
    }
    const { answers, energy } = parseVonkAntwoorden((afname as any).mainResponses);
    const kaarten = bouwUitlezingKaarten(answers, energy);
    const rapport = vindRapportVoorAfname(afnameId);
    res.json({
      naam: afname.name ?? "",
      voltooid: afname.status === "voltooid",
      kaarten,
      rapportId: rapport?.id ?? null,
      rapportUrl: rapport ? `/api/t4teens/rapport/${rapport.id}` : null,
      pdfUrl: rapport && rapport.pdf ? `/api/t4teens/rapport/${rapport.id}/pdf` : null,
    });
  });

  // ── ADDITIEF (Regel 2): één knop → alle PDF's centraal als ZIP ─────────────
  // Bundelt alle bewaarde Studiekompas-PDF's in één ZIP, elk met de leerlingnaam
  // in de bestandsnaam. Botsende namen krijgen een volgnummer. Rapporten zonder
  // PDF worden overgeslagen (en gerapporteerd via een header). Raakt geen
  // bestaand pad aan.
  app.get("/api/t4teens/rapporten.zip", async (_req: Request, res: Response) => {
    try {
      const metPdf = Array.from(RAPPORTEN.values())
        .filter((r) => r.pdf)
        .sort((a, b) => a.aangemaakt - b.aangemaakt);

      if (metPdf.length === 0) {
        return res.status(404).json({ error: "Nog geen Studiekompas-PDF's beschikbaar om te bundelen." });
      }

      const zip = new JSZip();
      const gebruikt = new Map<string, number>();
      for (const r of metPdf) {
        let basis = `T4Teens-Studiekompas-${veiligeBestandsnaam(r.naam)}`;
        const n = (gebruikt.get(basis) ?? 0) + 1;
        gebruikt.set(basis, n);
        const naam = n === 1 ? `${basis}.pdf` : `${basis}-${n}.pdf`;
        zip.file(naam, r.pdf as Buffer);
      }

      const inhoud = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
      const stempel = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="T4Teens-Studiekompas-rapporten-${stempel}.zip"`);
      res.setHeader("X-Rapporten-Aantal", String(metPdf.length));
      res.send(inhoud);
    } catch (e) {
      console.error("[T4Teens rapport] ZIP-bundeling mislukt:", e);
      res.status(500).json({ error: "ZIP kon niet worden gemaakt." });
    }
  });

  // Tijdelijke diagnose-endpoint (additief): probeert een mini-PDF te renderen en
  // rapporteert de exacte chromium-fout. Enkel voor de pilot-verificatie; raakt
  // geen bestaand pad. Kan later verwijderd worden.
  app.get("/api/t4teens/rapport-pdf-diagnose", async (_req: Request, res: Response) => {
    try {
      const buf = await bouwT4TeensPdf("<html><body><h1>diagnose ok</h1></body></html>");
      res.json({ ok: true, bytes: buf.length });
    } catch (e: any) {
      res.json({ ok: false, error: String(e?.message || e), stack: String(e?.stack || "").split("\n").slice(0, 6) });
    }
  });
}
