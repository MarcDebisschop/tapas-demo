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

export function registerRapportenRoutes(app: Express): void {
  // =========================================================================
  // Fase C3 — Rapportgeneratie
  // =========================================================================

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
}
