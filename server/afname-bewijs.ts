/**
 * server/afname-bewijs.ts
 *
 * Auditbevinding K-1 (kritiek), derde en laatste ronde.
 *
 * De koppelroutes zijn in eerdere rondes gedicht met een bezitsbewijs. De
 * INVULROUTES van een lopende afname stonden echter nog open: wie het oplopende
 * afname-id gokte, kon
 *
 *   - POST /api/afnames/:id/concept     eigen tussenantwoorden opslaan;
 *   - POST /api/afnames/:id/main        deel 1 van iemand anders inleveren of
 *                                      overschrijven;
 *   - POST /api/afnames/:id/connection  de afname van iemand anders afronden,
 *                                      waarmee het bevroren contract met vreemde
 *                                      antwoorden werd aangemaakt en een credit
 *                                      van de organisatie werd verbruikt.
 *
 * Deze module bevat één poortwachter die op die drie routes staat. Het bewijs is
 * dezelfde onraadbare waarde als bij het koppelen: de respondentCode of het
 * invite-token van deze afname. De deelnemer krijgt die waarde bij het starten
 * van de afname en de webclient stuurt ze automatisch mee in de kop
 * `X-TaPas-Bewijs`; ze mag ook in de body staan.
 *
 * Keuzes die bewust zo zijn:
 *   - Een beheerderssessie mag altijd door (ondersteuning en herstelwerk).
 *   - Zonder geldig bewijs volgt 404 met exact dezelfde tekst als bij een
 *     onbestaande afname, zodat het antwoord niet verklapt of het gegokte id
 *     bestaat.
 *   - In het logboek komen geen persoonsgegevens (auditbevinding S-1): enkel de
 *     methode, het pad en het id.
 */
import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { bewijsGeldig, bewijsUitBody } from "./koppel-bewijs";
import { adminIdVanSessie } from "./admin-guard";

/** Naam van de kop waarin de webclient het bezitsbewijs meestuurt. */
export const BEWIJS_KOP = "x-tapas-bewijs";

/**
 * Haalt het bewijs uit het verzoek: eerst de kop, daarna de body. Zo hoeven
 * bestaande body-schema's niet uitgebreid te worden.
 */
export function bewijsUitVerzoek(req: Request): string {
  const uitKop = req.headers[BEWIJS_KOP];
  const kop = Array.isArray(uitKop) ? uitKop[0] : uitKop;
  if (typeof kop === "string" && kop.trim()) return kop.trim();
  return bewijsUitBody(req.body);
}

/**
 * Poortwachter voor de invulroutes van een afname. Zet deze vóór de eigenlijke
 * behandelaar; die kan daarna gewoon opnieuw `storage.getAfname(id)` doen.
 */
export async function vereisAfnameBewijs(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Afname niet gevonden" });
    return;
  }
  // Beheerders mogen altijd door.
  if (adminIdVanSessie(req) !== null) {
    next();
    return;
  }
  const afname = await storage.getAfname(id);
  if (!afname) {
    res.status(404).json({ error: "Afname niet gevonden" });
    return;
  }
  if (!bewijsGeldig(afname, bewijsUitVerzoek(req))) {
    console.warn(
      `[afname-bewijs] geweigerd zonder bezitsbewijs: ${req.method} ${req.path} (afname ${id})`,
    );
    res.status(404).json({ error: "Afname niet gevonden" });
    return;
  }
  next();
}
