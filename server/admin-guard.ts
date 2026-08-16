// ---------------------------------------------------------------------------
// server/admin-guard.ts - Centrale admin-toegangscontrole (AVG art. 32)
//
// Het platform gebruikte tot nu toe per bestand een eigen, identieke
// `requireAdmin`-helper. Voor de GDPR-endpoints (export, anonimisering,
// consent-intrekking, bewaartermijn) ontbrak die controle volledig. Deze module
// centraliseert het patroon als Express-middleware zodat een route niet meer
// per ongeluk zonder guard geregistreerd kan worden.
//
// De sessie blijft de bron van waarheid (`req.session.adminId`), exact zoals de
// bestaande admin-routes; er verandert dus niets aan de manier van inloggen.
// ---------------------------------------------------------------------------
import type { Request, Response, NextFunction } from "express";

/**
 * De aanmeldversie van een geldige beheerderssessie.
 *
 * Er is een tijd geweest waarin de beheeromgeving zonder wachtwoord binnenliet:
 * de poort in de browser vulde zelf inloggegevens in en de server sloeg de
 * wachtwoordcontrole over in demostand. Elke sessie die in die tijd ontstond,
 * bleef daarna 24 uur geldig. Wachtwoord vragen bij de deur haalt niets uit
 * zolang die oude sessies blijven werken.
 *
 * Daarom draagt een sessie sinds de herstelling een versienummer. Alleen een
 * sessie die bij het aanmelden dit nummer meekreeg, geldt nog. Wie een oudere
 * sessie heeft, staat weer voor de poort. Verhoog dit nummer wanneer opnieuw
 * alle beheerderssessies moeten vervallen.
 */
export const AANMELD_VERSIE = 2;

// Het id van de ingelogde beheerder, of null wanneer er geen sessie is.
// Ook gebruikt door de audit-log om "wie" vast te leggen.
export function adminIdVanSessie(req: Request): number | null {
  // De aanmeldversie wordt niet hier getoetst maar bij de ingang van de server
  // (server/index.ts): daar wordt de beheerdersidentiteit uit een verouderde
  // sessie gehaald voordat enige route ze kan lezen. Eén plaats, en elke lezer
  // van req.session.adminId is er meteen mee gedekt.
  const ruw = (req.session as any)?.adminId;
  if (ruw == null) return null;
  const id = Number(ruw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

// Express-middleware: weiger elk verzoek zonder admin-sessie met 401.
export function vereisAdmin(req: Request, res: Response, next: NextFunction): void {
  if (adminIdVanSessie(req) === null) {
    res.status(401).json({ error: "Niet ingelogd." });
    return;
  }
  next();
}
