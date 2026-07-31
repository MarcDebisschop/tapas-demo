/**
 * server/routes/organisatie-auth.ts
 *
 * Organisatie-login (fase 2 van de organisatie-scoping).
 *
 * Tot nu toe bestond er geen enkele server-geverifieerde bron voor "welke
 * organisatie ben jij": de sessie kende enkel adminId en coachId, en
 * `beheerders.organisatie` was vrije tekst. Daardoor moest een endpoint als
 * /api/organisatie/opvolging-per-instrument de organisatie uit de query halen,
 * wat per definitie niet te vertrouwen is.
 *
 * Een organisatie kan zich nu rechtstreeks aanmelden met een eigen e-mailadres
 * en wachtwoord. Dat zet `req.session.organisatieId`, en dat is vanaf fase 3
 * een van de twee bronnen waaruit `bepaalScope` de scope afleidt (de andere is
 * `beheerders.organisatieId`).
 *
 * Routes:
 *   POST /api/organisatie/login
 *   POST /api/organisatie/logout
 *   GET   /api/organisatie/me
 *   PATCH /api/organisatie/branding
 */

import type { Express, Request } from "express";
import { sqlite } from "../storage";
import { verifieerWachtwoord } from "../auth/wachtwoord";
import { vereisScope, scopeVanVerzoek } from "../scope-guard";
import { zetSessieIdentiteit, wisSessieIdentiteit } from "../sessie-identiteit";
import { schoonBranding, type Branding } from "@shared/branding";
import { isDemoModus } from "../demomodus";

// Demo-modus: identiek criterium als in server/routes/admin.ts. In demo blijft
// de login e-mail-only zodat de publieke demo blijft werken; daarbuiten is een
// geldig wachtwoord verplicht.
// S-4 (audit): de demomodus komt uit één bron (server/demomodus.ts) en is in
// productie altijd uit, ook wanneer TAPAS_DEMO=1 gezet zou zijn.
const DEMO_MODE = isDemoModus();

interface OrganisatieLoginRij {
  id: number;
  naam: string;
  login_email: string | null;
  wachtwoord_hash: string | null;
  login_actief: number;
}

/**
 * Het id van de aangemelde organisatie, of null wanneer er geen
 * organisatie-sessie is. Tegenhanger van `adminIdVanSessie`.
 */
export function organisatieIdVanSessie(req: Request): number | null {
  const ruw = (req.session as any)?.organisatieId;
  if (ruw == null) return null;
  const id = Number(ruw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/** Leest de vier personalisatievelden (fase 9) van een organisatie. */
export function leesBranding(id: number): Branding {
  const rij = sqlite
    .prepare(
      `SELECT branding_logo_url, branding_achtergrond_url,
              branding_achtergrond_kleur, branding_quote
         FROM organisaties WHERE id = ?`,
    )
    .get(id) as Record<string, string | null> | undefined;
  return {
    logoUrl: rij?.branding_logo_url ?? null,
    achtergrondUrl: rij?.branding_achtergrond_url ?? null,
    achtergrondKleur: rij?.branding_achtergrond_kleur ?? null,
    quote: rij?.branding_quote ?? null,
  };
}

function zoekOpLoginEmail(email: string): OrganisatieLoginRij | undefined {
  return sqlite
    .prepare(
      `SELECT id, naam, login_email, wachtwoord_hash, login_actief
         FROM organisaties
        WHERE lower(login_email) = ?`,
    )
    .get(email) as OrganisatieLoginRij | undefined;
}

export function registerOrganisatieAuthRoutes(app: Express): void {
  app.post("/api/organisatie/login", async (req, res) => {
    const { email, wachtwoord } = req.body || {};
    if (!email) return res.status(400).json({ error: "E-mailadres ontbreekt." });

    const org = zoekOpLoginEmail(String(email).trim().toLowerCase());
    // Eenzelfde antwoord voor "bestaat niet" en "login staat uit", zodat de
    // foutmelding niet verklapt welke organisaties een login hebben.
    if (!org || org.login_actief !== 1) {
      return res.status(401).json({ error: "E-mailadres of wachtwoord onjuist." });
    }

    if (!DEMO_MODE) {
      if (!wachtwoord) {
        return res.status(401).json({ error: "E-mailadres of wachtwoord onjuist." });
      }
      if (!org.wachtwoord_hash) {
        return res.status(403).json({
          error:
            "Voor deze organisatie is nog geen wachtwoord ingesteld. Neem contact op met de hoofdbeheerder.",
        });
      }
      const geldig = await verifieerWachtwoord(String(wachtwoord), org.wachtwoord_hash);
      if (!geldig) {
        return res.status(401).json({ error: "E-mailadres of wachtwoord onjuist." });
      }
    }

    // H-1 (audit): sessie-id vernieuwen vóór het zetten van de identiteit
    // (bescherming tegen session fixation).
    try {
      await zetSessieIdentiteit(req, { organisatieId: org.id });
    } catch {
      return res.status(500).json({ error: "Sessie opslaan mislukt." });
    }
    res.json({ ok: true, organisatieId: org.id, naam: org.naam });
  });

  app.post("/api/organisatie/logout", async (req, res) => {
    // H-1 (audit): identiteit wissen én het sessie-id vervangen.
    try {
      await wisSessieIdentiteit(req, ["organisatieId"]);
    } catch {
      // Uitloggen mag nooit falen voor de gebruiker.
    }
    res.json({ ok: true });
  });

  app.get("/api/organisatie/me", (req, res) => {
    const id = organisatieIdVanSessie(req);
    if (id === null) return res.status(401).json({ error: "Niet ingelogd." });
    const org = sqlite
      .prepare(`SELECT id, naam, login_actief FROM organisaties WHERE id = ?`)
      .get(id) as { id: number; naam: string; login_actief: number } | undefined;
    // Login intussen uitgezet of organisatie verwijderd: sessie is niets meer waard.
    if (!org || org.login_actief !== 1) {
      return res.status(401).json({ error: "Sessie verlopen." });
    }
    res.json({ ok: true, organisatieId: org.id, naam: org.naam, branding: leesBranding(org.id) });
  });

  /**
   * De organisatie past haar eigen uiterlijk aan.
   *
   * Het te wijzigen id komt uit de SCOPE en niet uit de body. Een
   * `organisatieId` in de body wordt genegeerd voor een organisatie; enkel de
   * prior mag er een meegeven, want die beheert namens klanten. Zonder die
   * splitsing zou elke organisatie het portaal van een andere kunnen
   * herschilderen, en dat is een zichtbaardere aanval dan hij klinkt.
   */
  app.patch("/api/organisatie/branding", vereisScope, async (req, res) => {
    const scope = scopeVanVerzoek(req);
    let doelId: number | null = null;
    if (scope.soort === "organisatie") {
      doelId = scope.organisatieId;
    } else if (scope.soort === "prior") {
      const gevraagd = Number((req.body ?? {}).organisatieId);
      if (!Number.isFinite(gevraagd) || gevraagd <= 0) {
        return res.status(400).json({ error: "Geef op welke organisatie u aanpast." });
      }
      doelId = gevraagd;
    }
    if (doelId === null) return res.status(403).json({ error: "Geen organisatie in beeld." });

    const bestaat = sqlite.prepare(`SELECT id FROM organisaties WHERE id = ?`).get(doelId);
    if (!bestaat) return res.status(404).json({ error: "Organisatie niet gevonden." });

    const schoon = schoonBranding(req.body);
    sqlite
      .prepare(
        `UPDATE organisaties
            SET branding_logo_url = ?, branding_achtergrond_url = ?,
                branding_achtergrond_kleur = ?, branding_quote = ?
          WHERE id = ?`,
      )
      .run(schoon.logoUrl, schoon.achtergrondUrl, schoon.achtergrondKleur, schoon.quote, doelId);

    res.json({ ok: true, organisatieId: doelId, branding: schoon });
  });
}
