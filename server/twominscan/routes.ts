// =============================================================================
// server/twominscan/routes.ts  —  2MINSCAN energetische rapport-koppeling
// -----------------------------------------------------------------------------
// De 2MINSCAN is een ENERGETISCH GEDRAGSPROFIEL (knipoog naar Insights Discovery
// en MBTI). Het staat STRIKT los van het TaPas talentprofiel en van drivers
// (Taibi Kahler). De 24 profielen zijn reeds volledig ontwikkeld en in eigen
// layout omgezet in 5 talen (nl/fr/en/es/ru). Deze route koppelt de afname aan
// dat vooraf ontwikkelde rapport:
//
//   POST /api/twominscan/rapport.pdf
//     body { egCode: string, naam?: string, taal?: "nl"|"fr"|"en"|"es"|"ru",
//            datum?: string }
//     -> serveert het exacte energetische PDF-rapport voor die EG-code, met de
//        deelnemersnaam + afnamedatum geïnjecteerd op pagina 1 (layout intact).
//
// De EG-code wordt door het geijkte client-model (client/src/twominscan/) exact
// berekend uit 32 kleurwoorden + 21 IE-stellingen. Deze route bouwt GEEN
// T4P-rapport en valt NOOIT terug op het T4P Business Profiel.
// =============================================================================
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { genereer2msRapportPdf, TALEN } from "./rapport-selectie";

const rapportSchema = z.object({
  egCode: z.string().min(2, "egCode is verplicht"),
  naam: z.string().optional(),
  taal: z.enum(["nl", "fr", "en", "es", "ru"]).optional(),
  datum: z.string().optional(),
});

function veiligeBestandsnaam(naam: string | undefined, egCode: string): string {
  const basis = (naam && naam.trim() ? naam : `2MINSCAN-${egCode}`)
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return basis || "2MINSCAN-energetisch-gedragsprofiel";
}

export function registerTwominscanRoutes(app: Express): void {
  app.post("/api/twominscan/rapport.pdf", async (req: Request, res: Response) => {
    const parsed = rapportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldige aanvraag" });
    }
    const { egCode, naam, taal, datum } = parsed.data;
    const afnamedatum = datum && datum.trim() ? datum : new Date().toLocaleDateString("nl-BE");

    try {
      const { buffer, selectie } = await genereer2msRapportPdf(egCode, taal ?? "nl", {
        naam: naam ?? null,
        datum: afnamedatum,
      });
      const bestandsnaam = veiligeBestandsnaam(naam, selectie.profiel.egCodeRaw);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${bestandsnaam}.pdf"`);
      res.setHeader("X-2MS-Profiel", selectie.bestandsnaam);
      return res.send(buffer);
    } catch (e: any) {
      console.error("[twominscan] rapport-selectie mislukt:", e?.message ?? e);
      return res.status(404).json({
        error: e?.message ?? "2MINSCAN-rapport niet gevonden voor deze EG-code.",
      });
    }
  });

  // Diagnostische route: welke talen/bestanden zijn beschikbaar voor een EG-code.
  app.get("/api/twominscan/beschikbaar", (_req: Request, res: Response) => {
    res.json({ talen: TALEN });
  });
}
