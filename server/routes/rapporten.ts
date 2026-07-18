/**
 * server/routes/rapporten.ts
 *
 * Domeinrouter: Rapportgeneratie (contract -> afgewerkt TaPas-rapport).
 * Geëxtraheerd uit server/routes.ts (item 1.1, Fase 5).
 *
 * Routes:
 *   POST /api/rapporten              — rapport genereren
 *   GET  /api/rapporten              — rapporten ophalen (optioneel gefilterd op afnameId)
 *   GET  /api/rapporten/:id          — rapport detail (zonder PDF-data)
 *   GET  /api/rapporten/:id/html     — rapport weergeven (HTML of inline PDF)
 *   GET  /api/rapporten/:id/download — rapport downloaden (HTML of PDF attachment)
 */

import type { Express } from "express";
import { storage, CreditError } from "../storage";
import { genereerRapportSchema } from "@shared/schema";
import { renderRapportPdf, diagServerlessPdf } from "../rapport-pdf";

export function registerRapportenRoutes(app: Express): void {
  // =========================================================================
  // Fase C3 — Rapportgeneratie
  // =========================================================================

  // TIJDELIJK (Fase 5) — diagnose van de serverless PDF-launch op Render.
  // Geeft ALTIJD HTTP 200 + JSON zodat curl de echte fout leest. Wordt na de
  // fix weer verwijderd (geen debug-endpoint in productie laten).
  app.get("/api/_pdfdiag", async (req, res) => {
    // ?real=<id> rendert de ECHTE rapport-HTML met de productie-wachtconditie.
    // &via=render roept de ECHTE renderRapportPdf aan (exact het productie-pad)
    // en legt de opgevangen fout bloot i.p.v. stil op HTML terug te vallen.
    const realId = req.query.real ? Number(req.query.real) : undefined;
    const viaRender = req.query.via === "render";

    if (realId && viaRender) {
      const r = await storage.getRapport(realId);
      if (!r) return res.status(200).json({ ok: false, stap: "getRapport", error: "rapport niet gevonden" });
      const t0 = Date.now();
      try {
        const buf = await renderRapportPdf(r.html, { titel: r.titel });
        const head = buf.subarray(0, 5).toString("latin1");
        return res.status(200).json({
          ok: head === "%PDF-", stap: "renderRapportPdf", via: "render",
          pdfBytes: buf.length, header: head, ms: Date.now() - t0, htmlLen: r.html.length,
        });
      } catch (e) {
        const result = {
          ok: false, stap: "renderRapportPdf", via: "render", ms: Date.now() - t0,
          error: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error && e.stack ? e.stack.slice(0, 1500) : undefined,
          htmlLen: r.html.length,
        };
        console.log("[_pdfdiag via=render]", JSON.stringify(result));
        return res.status(200).json(result);
      }
    }

    let html: string | undefined;
    let waitUntil: "load" | "networkidle" = "load";
    if (realId) {
      const r = await storage.getRapport(realId);
      html = r?.html;
      waitUntil = "networkidle";
    }
    const result = await diagServerlessPdf(html ?? undefined, waitUntil);
    console.log("[_pdfdiag]", JSON.stringify(result));
    res.status(200).json({ ...result, realId: realId ?? null, htmlLen: html?.length ?? null });
  });

  app.post("/api/rapporten", async (req, res) => {
    const parsed = genereerRapportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldige invoer" });
    }
    try {
      const rapport = await storage.genereerRapport(parsed.data.afnameId, parsed.data.variant);
      res.json({
        id: rapport.id,
        afnameId: rapport.afnameId,
        variant: rapport.variant,
        titel: rapport.titel,
        contractVersie: rapport.contractVersie,
        createdAt: rapport.createdAt,
        inhoud: JSON.parse(rapport.inhoud),
      });
    } catch (e) {
      const msg = e instanceof CreditError ? e.message : "Rapportgeneratie mislukt";
      res.status(400).json({ error: msg });
    }
  });

  app.get("/api/rapporten", async (req, res) => {
    const afnameId = req.query.afnameId ? Number(req.query.afnameId) : undefined;
    const list = await storage.listRapporten(afnameId);
    res.json(
      list.map((r) => ({
        id: r.id,
        afnameId: r.afnameId,
        variant: r.variant,
        titel: r.titel,
        contractVersie: r.contractVersie,
        createdAt: r.createdAt,
      }))
    );
  });

  app.get("/api/rapporten/:id", async (req, res) => {
    const r = await storage.getRapport(Number(req.params.id));
    if (!r) return res.status(404).json({ error: "Rapport niet gevonden" });
    // pdfBase64 kan groot zijn en is alleen nodig in de /html en /download
    // endpoints — hou de JSON-payload licht en geef enkel een vlag mee.
    const { pdfBase64, ...rest } = r as any;
    res.json({ ...rest, heeftPdf: !!pdfBase64, inhoud: JSON.parse(r.inhoud) });
  });

  // Bekijk het rapport (voor weergave/afdruk). Wanneer er een echt PDF-document
  // aan het rapport hangt (pdfBase64), wordt dat definitieve document inline
  // getoond — zo toont een T4P Business Kompas met een echt document altijd dat
  // document. Anders valt de weergave terug op de gegenereerde HTML.
  app.get("/api/rapporten/:id/html", async (req, res) => {
    const r = await storage.getRapport(Number(req.params.id));
    if (!r) return res.status(404).send("Rapport niet gevonden");
    const pdf = (r as any).pdfBase64 as string | null | undefined;
    if (pdf) {
      const buf = Buffer.from(pdf, "base64");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline");
      return res.send(buf);
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(r.html);
  });

  // Download het volledige rapport als zelfstandig HTML-bestand.
  app.get("/api/rapporten/:id/download", async (req, res) => {
    const r = await storage.getRapport(Number(req.params.id));
    if (!r) return res.status(404).send("Rapport niet gevonden");
    const veiligeNaam =
      (r.titel || "profiel")
        .normalize("NFKD")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .slice(0, 80) || "profiel";
    const pdf = (r as any).pdfBase64 as string | null | undefined;
    if (pdf) {
      const buf = Buffer.from(pdf, "base64");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${veiligeNaam}.pdf"`,
      );
      return res.send(buf);
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${veiligeNaam}.html"`,
    );
    res.send(r.html);
  });

  // Download het rapport als een ECHTE, code-gegenereerde PDF via de gedeelde
  // HTML->PDF-laag (server/rapport-pdf.ts). De vaste, instrument-eigen
  // HTML-layout blijft de bindende structuur; deze route zet enkel diezelfde
  // HTML om naar PDF. Zo krijgt elk gedeeld-pad-instrument (t4p, t4students,
  // t4teens, ...) altijd een downloadbare PDF op maat.
  //
  // ROBUUST: faalt de render (geen Chromium, crash), dan valt de route netjes
  // terug op de HTML-download i.p.v. de afname/rapport-flow te breken.
  app.get("/api/rapporten/:id/pdf", async (req, res) => {
    const r = await storage.getRapport(Number(req.params.id));
    if (!r) return res.status(404).send("Rapport niet gevonden");
    const veiligeNaam =
      (r.titel || "profiel")
        .normalize("NFKD")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .slice(0, 80) || "profiel";

    // Hangt er al een echt PDF-document aan (pdfkit-instrument/seed)? Serveer dat.
    const bestaandePdf = (r as any).pdfBase64 as string | null | undefined;
    if (bestaandePdf) {
      const buf = Buffer.from(bestaandePdf, "base64");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${veiligeNaam}.pdf"`);
      return res.send(buf);
    }

    try {
      const buffer = await renderRapportPdf(r.html, { titel: r.titel });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${veiligeNaam}.pdf"`);
      return res.send(buffer);
    } catch (e) {
      console.error("[rapporten] PDF-render mislukt, terugval op HTML:", e);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${veiligeNaam}.html"`);
      return res.send(r.html);
    }
  });
}
