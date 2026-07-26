// ---------------------------------------------------------------------------
// server/scope-guard.ts - de kern van de organisatie-scoping (fase 3).
//
// Een `Scope` is het antwoord op de vraag: welke gegevens mag deze oproeper
// zien? Er zijn precies drie antwoorden en geen vierde:
//
//   prior        - TaPasCity-superbeheerder, ziet alles over alle organisaties
//   organisatie  - ziet uitsluitend de gegevens van een organisatie
//   geen         - ziet niets
//
// Drie principes die deze module afdwingt:
//
//   1. De scope komt uit de SESSIE, nooit uit het verzoek. Een query- of
//      bodyparameter kan de scope niet beinvloeden. Vroeger haalde
//      /api/organisatie/opvolging-per-instrument de organisatie uit de query,
//      en dat betekende dat elke oproeper elke organisatie kon opvragen.
//   2. Deny by default. Wie geen aantoonbare identiteit heeft, krijgt scope
//      "geen", en "geen" levert 403 op. Er is geen stilzwijgende terugval op
//      "toon alles".
//   3. Prior wordt CENTRAAL beslist, hier en nergens anders. Prior is enkel wie
//      `isPrior` heeft EN bij PRIOR_ORGANISATIE hoort. Beide voorwaarden, want
//      `isPrior` alleen zou een klantbeheerder die ooit die vlag kreeg
//      platformbrede toegang geven.
// ---------------------------------------------------------------------------

import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { adminIdVanSessie } from "./admin-guard";
import { organisatieIdVanSessie } from "./routes/organisatie-auth";
import { PRIOR_ORGANISATIE } from "@shared/platformdelen";

export type Scope =
  | { soort: "prior" }
  | { soort: "organisatie"; organisatieId: number }
  | { soort: "geen" };

export const SCOPE_PRIOR: Scope = { soort: "prior" };
export const SCOPE_GEEN: Scope = { soort: "geen" };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      scope?: Scope;
    }
  }
}

/**
 * Het id van de aangemelde praktijkgebruiker. Een coachsessie geeft dezelfde
 * praktijkrechten als een adminsessie (zie `getPractitionerId` in routes-stm),
 * en volgens beslissing 2 van de opdrachtgever krijgt een zelfstandige coach
 * gewoon de organisatie-scope van zijn organisatie.
 */
function beheerderIdVanSessie(req: Request): number | null {
  const viaAdmin = adminIdVanSessie(req);
  if (viaAdmin !== null) return viaAdmin;
  const ruw = (req.session as any)?.coachId;
  if (ruw == null) return null;
  const id = Number(ruw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * Leidt de scope af uit de sessie. De volgorde is bewust: een beheerder-sessie
 * wint van een organisatie-sessie, want de beheerder is de specifiekere
 * identiteit wanneer iemand toevallig allebei heeft.
 */
export async function bepaalScope(req: Request): Promise<Scope> {
  const beheerderId = beheerderIdVanSessie(req);
  if (beheerderId !== null) {
    const beheerder = await storage.getBeheerder(beheerderId);
    // Gedeactiveerde beheerder houdt geen enkele scope over.
    if (!beheerder || !beheerder.actief) return SCOPE_GEEN;
    if (beheerder.isPrior && beheerder.organisatie === PRIOR_ORGANISATIE) {
      return SCOPE_PRIOR;
    }
    if (beheerder.organisatieId != null) {
      return { soort: "organisatie", organisatieId: beheerder.organisatieId };
    }
    // Beheerder zonder koppeling: bewust geen data in plaats van alle data.
    // De koppeling uit fase 2 logt precies deze rijen.
    return SCOPE_GEEN;
  }

  const organisatieId = organisatieIdVanSessie(req);
  if (organisatieId !== null) return { soort: "organisatie", organisatieId };

  return SCOPE_GEEN;
}

/**
 * Middleware: bepaalt de scope, zet ze op `req.scope` en weigert scope "geen".
 * Elk endpoint dat organisatiegebonden gegevens teruggeeft hoort hierachter.
 */
export async function vereisScope(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const scope = await bepaalScope(req);
    if (scope.soort === "geen") {
      res.status(403).json({ error: "Geen toegang tot organisatiegegevens." });
      return;
    }
    req.scope = scope;
    next();
  } catch (err) {
    console.error("[scope] bepalen mislukt:", err);
    res.status(500).json({ error: "Toegang bepalen mislukt." });
  }
}

/**
 * Middleware: enkel de prior mag door. Voor platformbrede gegevens die nooit
 * naar een organisatie mogen, zoals de bestuurscijfers en de boekhoudexport.
 */
export async function vereisPrior(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const scope = await bepaalScope(req);
    if (scope.soort !== "prior") {
      res.status(403).json({ error: "Enkel de hoofdbeheerder heeft hier toegang toe." });
      return;
    }
    req.scope = scope;
    next();
  } catch (err) {
    console.error("[scope] prior-controle mislukt:", err);
    res.status(500).json({ error: "Toegang bepalen mislukt." });
  }
}

/**
 * De scope van een verzoek dat al door `vereisScope` of `vereisPrior` kwam.
 * Werpt wanneer de middleware ontbreekt: dat is een programmeerfout en mag
 * nooit stil resulteren in ongescopeerde gegevens.
 */
export function scopeVanVerzoek(req: Request): Scope {
  const scope = req.scope;
  if (!scope) {
    throw new Error("scopeVanVerzoek zonder vereisScope-middleware aangeroepen.");
  }
  return scope;
}
