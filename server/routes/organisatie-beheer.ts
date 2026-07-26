/**
 * server/routes/organisatie-beheer.ts
 *
 * Het instellen van de organisatie-logingegevens (fase 3).
 *
 * Fase 2 haalde `loginEmail`, `wachtwoordHash` en `loginActief` bewust uit
 * `insertOrganisatieSchema`, zodat niemand via een gewone create- of
 * update-body inloggegevens kon zetten. Daardoor bestond er nadien geen enkele
 * weg meer om ze wel te zetten, en was de organisatie-login uit fase 2 in de
 * praktijk onbruikbaar. Deze route is die ene weg, en ze staat achter
 * `vereisPrior`: het uitdelen van toegang tot een organisatie is een
 * platformbeslissing, geen beslissing van de organisatie zelf.
 *
 * Dit bestand staat los van `organisatie-auth.ts` omdat `scope-guard` daaruit
 * `organisatieIdVanSessie` haalt; `vereisPrior` daar importeren zou een
 * kringverwijzing opleveren.
 *
 * Route:
 *   PUT /api/organisaties/:id/login
 */

import type { Express } from "express";
import { sqlite } from "../storage";
import { hashWachtwoord } from "../auth/wachtwoord";
import { vereisPrior } from "../scope-guard";

export function registerOrganisatieBeheerRoutes(app: Express): void {
  app.put("/api/organisaties/:id/login", vereisPrior, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: "Ongeldig organisatie-id." });
    }

    const bestaat = sqlite.prepare(`SELECT id FROM organisaties WHERE id = ?`).get(id);
    if (!bestaat) return res.status(404).json({ error: "Organisatie niet gevonden." });

    const { email, wachtwoord, actief } = req.body || {};

    if (email !== undefined) {
      const genormaliseerd = String(email).trim().toLowerCase();
      if (!genormaliseerd.includes("@")) {
        return res.status(400).json({ error: "Ongeldig e-mailadres." });
      }
      // De partiele unieke index vangt dit ook af, maar een nette 409 leest
      // beter dan een databankfout.
      const bezet = sqlite
        .prepare(`SELECT id FROM organisaties WHERE lower(login_email) = ? AND id <> ?`)
        .get(genormaliseerd, id);
      if (bezet) return res.status(409).json({ error: "Dit e-mailadres is al in gebruik." });
      sqlite.prepare(`UPDATE organisaties SET login_email = ? WHERE id = ?`).run(genormaliseerd, id);
    }

    if (wachtwoord !== undefined) {
      const ruw = String(wachtwoord);
      if (ruw.length < 10) {
        return res.status(400).json({ error: "Het wachtwoord telt minstens 10 tekens." });
      }
      const hash = await hashWachtwoord(ruw);
      sqlite.prepare(`UPDATE organisaties SET wachtwoord_hash = ? WHERE id = ?`).run(hash, id);
    }

    if (actief !== undefined) {
      sqlite
        .prepare(`UPDATE organisaties SET login_actief = ? WHERE id = ?`)
        .run(actief ? 1 : 0, id);
    }

    const na = sqlite
      .prepare(`SELECT id, naam, login_email, wachtwoord_hash, login_actief FROM organisaties WHERE id = ?`)
      .get(id) as {
      id: number;
      naam: string;
      login_email: string | null;
      wachtwoord_hash: string | null;
      login_actief: number;
    };

    // Nooit de hash teruggeven, enkel of er een wachtwoord staat.
    res.json({
      ok: true,
      organisatieId: na.id,
      naam: na.naam,
      loginEmail: na.login_email,
      heeftWachtwoord: na.wachtwoord_hash !== null,
      loginActief: na.login_actief === 1,
    });
  });
}
