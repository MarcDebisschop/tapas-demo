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

import type { Express, Request, Response } from "express";
import { storage, CreditError } from "../storage";
import { genereerRapportSchema } from "@shared/schema";
import { renderRapportPdf } from "../rapport-pdf";
import { vereisScope, scopeVanVerzoek, valtBinnenScope } from "../scope-guard";

export function registerRapportenRoutes(app: Express): void {
  // Een rapport erft de scope van de afname waaruit het gegenereerd is. Zonder
  // deze controle zou een organisatie via een gegokt rapport-id het volledige
  // profiel van een deelnemer van een andere organisatie kunnen lezen of
  // downloaden.
  //
  // Buiten scope levert 404 op en niet 403: een 403 zou bevestigen dat het
  // rapport bestaat, en dat is op zich al informatie over een andere
  // organisatie.
  async function afnameBuitenScope(req: Request, res: Response, afnameId: number): Promise<boolean> {
    const afname = await storage.getAfname(afnameId);
    if (!afname || !valtBinnenScope(scopeVanVerzoek(req), afname.organisatieId)) {
      res.status(404).json({ error: "Rapport niet gevonden" });
      return true;
    }
    return false;
  }

  async function rapportBuitenScope(req: Request, res: Response, id: number, tekst = false) {
    const r = await storage.getRapport(id);
    if (!r) {
      tekst ? res.status(404).send("Rapport niet gevonden") : res.status(404).json({ error: "Rapport niet gevonden" });
      return null;
    }
    const afname = await storage.getAfname(r.afnameId);
    if (!afname || !valtBinnenScope(scopeVanVerzoek(req), afname.organisatieId)) {
      tekst ? res.status(404).send("Rapport niet gevonden") : res.status(404).json({ error: "Rapport niet gevonden" });
      return null;
    }
    return r;
  }

  // =========================================================================
  // Fase C3 — Rapportgeneratie
  // =========================================================================

  app.post("/api/rapporten", vereisScope, async (req, res) => {
    const parsed = genereerRapportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldige invoer" });
    }
    if (await afnameBuitenScope(req, res, parsed.data.afnameId)) return;
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

  app.get("/api/rapporten", vereisScope, async (req, res) => {
    const afnameId = req.query.afnameId ? Number(req.query.afnameId) : undefined;
    // Zonder afnameId zou dit alle rapporten van alle organisaties opleveren.
    // De prior mag dat; een organisatie moet een afname aanduiden die van haar
    // is.
    const scope = scopeVanVerzoek(req);
    if (afnameId === undefined) {
      if (scope.soort !== "prior") {
        return res.status(400).json({ error: "afnameId is verplicht." });
      }
    } else if (await afnameBuitenScope(req, res, afnameId)) {
      return;
    }
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

  app.get("/api/rapporten/:id", vereisScope, async (req, res) => {
    const r = await rapportBuitenScope(req, res, Number(req.params.id));
    if (!r) return;
    // pdfBase64 kan groot zijn en is alleen nodig in de /html en /download
    // endpoints — hou de JSON-payload licht en geef enkel een vlag mee.
    const { pdfBase64, ...rest } = r as any;
    res.json({ ...rest, heeftPdf: !!pdfBase64, inhoud: JSON.parse(r.inhoud) });
  });

  // Bekijk het rapport (voor weergave/afdruk). Wanneer er een echt PDF-document
  // aan het rapport hangt (pdfBase64), wordt dat definitieve document inline
  // getoond — zo toont een T4P Business Kompas met een echt document altijd dat
  // document. Anders valt de weergave terug op de gegenereerde HTML.
  app.get("/api/rapporten/:id/html", vereisScope, async (req, res) => {
    const r = await rapportBuitenScope(req, res, Number(req.params.id), true);
    if (!r) return;
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
  app.get("/api/rapporten/:id/download", vereisScope, async (req, res) => {
    const r = await rapportBuitenScope(req, res, Number(req.params.id), true);
    if (!r) return;
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
  app.get("/api/rapporten/:id/pdf", vereisScope, async (req, res) => {
    const r = await rapportBuitenScope(req, res, Number(req.params.id), true);
    if (!r) return;
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
