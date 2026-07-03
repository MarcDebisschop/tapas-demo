// =============================================================================
// server/gids/routes.ts  —  NIEUW BESTAND (Werkprotocol Regel 2)
// -----------------------------------------------------------------------------
// Publieke PDF-endpoints voor De Instrumentengids:
//   GET /api/instrumentengids/:id/fiche.pdf?taal=nl   → meeneembare fiche
//   GET /api/instrumentengids/brochure.pdf?taal=nl    → volledige brochure
//
// Volgt exact het download-patroon uit server/hdd/routes.ts (Content-Type +
// Content-Disposition + Content-Length + res.end(buffer)). Geen sessie/prior
// vereist — de gids is publiek raadpleegbaar.
// =============================================================================
import type { Express, Request, Response } from "express";
import { genereerFichePdf } from "./fiche-pdf";
import { genereerBrochurePdf } from "./brochure-pdf";

const TALEN = new Set(["nl", "fr", "en", "es", "ru"]);

function kiesTaal(req: Request): string {
  const t = String(req.query.taal ?? "nl").toLowerCase();
  return TALEN.has(t) ? t : "nl";
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "instrument"
  );
}

export function registerGidsPdfRoutes(app: Express): void {
  // Volledige brochure — MOET vóór de :id-route staan zodat "brochure" niet als id matcht.
  app.get(
    "/api/instrumentengids/brochure.pdf",
    async (req: Request, res: Response) => {
      try {
        const taal = kiesTaal(req);
        const pdf = await genereerBrochurePdf(taal);
        const filename = `tapas-instrumentengids-${taal}.pdf`;
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Length", String(pdf.length));
        res.end(pdf);
      } catch (err) {
        res.status(500).json({
          error: "Brochure-generatie mislukt",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }
  );

  // Fiche per instrument
  app.get(
    "/api/instrumentengids/:id/fiche.pdf",
    async (req: Request, res: Response) => {
      try {
        const taal = kiesTaal(req);
        const id = String(req.params.id);
        const pdf = await genereerFichePdf(id, taal);
        if (!pdf) {
          return res.status(404).json({ error: "Onbekend instrument", id });
        }
        const filename = `tapas-fiche-${slug(id)}-${taal}.pdf`;
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Length", String(pdf.length));
        res.end(pdf);
      } catch (err) {
        res.status(500).json({
          error: "Fiche-generatie mislukt",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }
  );
}
