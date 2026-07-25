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

// Het id van de ingelogde beheerder, of null wanneer er geen sessie is.
// Ook gebruikt door de audit-log om "wie" vast te leggen.
export function adminIdVanSessie(req: Request): number | null {
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
