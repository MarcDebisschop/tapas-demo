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
import {
  genereer2msRapportPdf,
  genereer2msRapportOpVolgorde,
  TALEN,
} from "./rapport-selectie";
import { registerOrganisatiefotoRoutes } from "./organisatiefotos";
import { registerTwominscanAfnameRoutes } from "./afname-opslag";
import { registerTwominscanTeamwielAankoopRoutes } from "./teamwiel-aankoop";
import { voegWielpaginaToe, wielbijlageSchema } from "./wielbijlage";

const KLEUR = z.enum(["rood", "geel", "groen", "blauw"]);

// AANBEVOLEN pad: kleurvolgorde + gemeten X-stand -> altijd één van de 24.
// TERUGVAL: egCode (oud pad). Minstens één van beide moet aanwezig zijn.
const rapportSchema = z.object({
  egCode: z.string().min(2).optional(),
  volgorde: z.array(KLEUR).min(2).max(4).optional(),
  xStand: z.enum(["II", "EE", "IE", "X"]).optional(),
  naam: z.string().optional(),
  taal: z.enum(["nl", "fr", "en", "es", "ru"]).optional(),
  datum: z.string().optional(),
  // Naam van de organisatie voor de cover. Optioneel: is ze leeg, dan blijft de
  // cover zoals ze was.
  organisatie: z.string().max(80).optional(),
  // Optionele wielpagina achteraan: de browser stuurt het al getekende wiel mee
  // als PNG plus de al vertaalde regels. Zie wielbijlage.ts voor het waarom.
  wielbijlage: wielbijlageSchema.optional(),
}).refine((d) => (d.volgorde && d.volgorde.length >= 2) || (d.egCode && d.egCode.length >= 2), {
  message: "Geef een kleurvolgorde (aanbevolen) of een egCode op.",
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
  // Portretfoto's van één pagina die de organisatie zelf publiceerde, per
  // persoon te bevestigen door de coach. Zie organisatiefotos.ts voor de grenzen.
  registerOrganisatiefotoRoutes(app);

  // Bewaarde afnames (naam + wielpositie) zodat de teamwielpagina de deelnemers
  // automatisch kan inladen in plaats van ze met de hand te laten overtypen.
  registerTwominscanAfnameRoutes(app);

  // Een temperamentenwiel is een betaald product: de teamwielpagina levert het
  // rapport pas nadat deze route het tarief heeft afgeboekt (of vastgesteld dat
  // dit wiel al betaald is).
  registerTwominscanTeamwielAankoopRoutes(app);

  app.post("/api/twominscan/rapport.pdf", async (req: Request, res: Response) => {
    const parsed = rapportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldige aanvraag" });
    }
    const { egCode, volgorde, xStand, naam, taal, datum, organisatie, wielbijlage } = parsed.data;
    const afnamedatum = datum && datum.trim() ? datum : new Date().toLocaleDateString("nl-BE");

    try {
      // AANBEVOLEN: match op kleurvolgorde + X-stand (levert altijd één van de 24).
      // TERUGVAL: egCode-pad voor bestaande integraties.
      const { buffer, selectie } =
        volgorde && volgorde.length >= 2
          ? await genereer2msRapportOpVolgorde(volgorde, xStand ?? null, taal ?? "nl", {
              naam: naam ?? null,
              datum: afnamedatum,
              organisatie: organisatie ?? null,
              taal: taal ?? "nl",
            })
          : await genereer2msRapportPdf(egCode as string, taal ?? "nl", {
              naam: naam ?? null,
              datum: afnamedatum,
              organisatie: organisatie ?? null,
              taal: taal ?? "nl",
            });
      // De wielpagina is een aanvulling: mislukt ze, dan komt het rapport
      // ongewijzigd terug (zie wielbijlage.ts).
      const volledig = wielbijlage ? await voegWielpaginaToe(buffer, wielbijlage) : buffer;
      const bestandsnaam = veiligeBestandsnaam(naam, selectie.profiel.egCodeRaw);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${bestandsnaam}.pdf"`);
      res.setHeader("X-2MS-Profiel", selectie.bestandsnaam);
      return res.send(volledig);
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
