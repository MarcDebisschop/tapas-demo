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
import type { Answers, Energy } from "../t4teens/scoring";
import { renderT4TeensHtml } from "../t4teens/rapport";
import { bouwT4TeensPdf } from "../t4teens/rapport-pdf";

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
}

// In-memory opslag (desnoods per BUILD-BRIEF). Simpele LRU-cap tegen groei.
const RAPPORTEN = new Map<string, OpgeslagenRapport>();
const MAX_RAPPORTEN = 200;

function bewaar(r: OpgeslagenRapport): void {
  RAPPORTEN.set(r.id, r);
  while (RAPPORTEN.size > MAX_RAPPORTEN) {
    const oudste = RAPPORTEN.keys().next().value;
    if (oudste === undefined) break;
    RAPPORTEN.delete(oudste);
  }
}

export function registerT4TeensRapportRoutes(app: Express): void {
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
}
