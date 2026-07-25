/**
 * server/routes/opvolging.ts
 *
 * Opvolging van ingevulde/niet-ingevulde vragenlijsten PER INSTRUMENT, op twee
 * niveaus:
 *
 *   NIVEAU 1 - admin, alle organisaties:
 *     GET /api/admin/opvolging-per-instrument[?organisatie_id=<id>]
 *
 *   NIVEAU 2 - één organisatie, hard gescoped:
 *     GET /api/organisatie/opvolging-per-instrument?organisatie_id=<id>
 *
 * BEVEILIGING VAN NIVEAU 2 (bewuste keuze, zie ook de PR-omschrijving):
 * Dit platform heeft vandaag GEEN organisatie-authenticatie. Nagekeken en niet
 * gevonden: er is geen req.session.organisatieId (de sessie kent enkel adminId,
 * coachId en platformSessieId), de tabel `organisaties` heeft geen wachtwoord-
 * of tokenkolom, en `beheerders.organisatie` is vrije tekst zonder koppeling
 * naar organisaties.id. Er bestaat dus geen enkele server-geverifieerde bron
 * voor "welke organisatie ben jij".
 *
 * Daarom is de organisatie-endpoint NIET publiek gemaakt. Hij staat achter
 * dezelfde admin-guard als niveau 1 en vereist een expliciete, gevalideerde
 * organisatie_id. Zo kan niemand zonder authenticatie organisatiecijfers
 * opvragen. Een echte organisatie-login blijft een openstaand punt; zodra die
 * er is, hoeft enkel `bepaalOrganisatieScope` de id uit de sessie te halen in
 * plaats van uit de query.
 */

import type { Express, Request, Response } from "express";
import { sqlite } from "../storage";
import { vereisAdmin } from "../admin-guard";
import { alleInstrumenten } from "../registry";
import {
  aggregeerPerInstrument,
  leesAfnameRijen,
  parseOrganisatieId,
  type InstrumentLabel,
} from "../opvolging-per-instrument";

// Instrument-id -> label uit het canonieke register.
function instrumentLabels(): InstrumentLabel[] {
  return alleInstrumenten().map((d) => ({
    instrumentId: d.instrumentId,
    label: d.name,
  }));
}

function organisatieNaam(id: number): string | null {
  try {
    const rij = sqlite
      .prepare(`SELECT naam FROM organisaties WHERE id = ?`)
      .get(id) as { naam?: string } | undefined;
    return rij?.naam ?? null;
  } catch {
    return null;
  }
}

export function registerOpvolgingRoutes(app: Express): void {
  // ── NIVEAU 1: admin, alle organisaties of gefilterd op één ────────────────
  app.get("/api/admin/opvolging-per-instrument", vereisAdmin, (req: Request, res: Response) => {
    try {
      // Voor de admin is organisatie_id een FILTER en dus optioneel. Een
      // meegegeven maar ongeldige waarde negeren we niet stilzwijgend: dat zou
      // ongemerkt de cijfers van alle organisaties tonen.
      const ruw = req.query.organisatie_id;
      let organisatieId: number | null = null;
      if (ruw !== undefined && String(ruw).trim() !== "") {
        organisatieId = parseOrganisatieId(ruw);
        if (organisatieId === null) {
          return res.status(400).json({ error: "Ongeldige organisatie_id." });
        }
      }

      const rijen = leesAfnameRijen(sqlite, organisatieId);
      const { rijen: perInstrument, totalen } = aggregeerPerInstrument(rijen, instrumentLabels());

      return res.json({
        niveau: "admin",
        organisatieId,
        organisatieNaam: organisatieId === null ? null : organisatieNaam(organisatieId),
        gegenereerdOp: new Date().toISOString(),
        instrumenten: perInstrument,
        totalen,
      });
    } catch (err) {
      console.error("[opvolging] admin-overzicht mislukt:", err);
      return res.status(500).json({ error: "Opvolging ophalen mislukt." });
    }
  });

  // ── NIVEAU 2: één organisatie, altijd hard gescoped ───────────────────────
  app.get("/api/organisatie/opvolging-per-instrument", vereisAdmin, (req: Request, res: Response) => {
    try {
      // Hier is organisatie_id VERPLICHT en moet ze geldig zijn. Zonder geldige
      // id doen we geen enkele query: ontbrekende scope mag nooit "toon alles"
      // betekenen.
      const organisatieId = parseOrganisatieId(req.query.organisatie_id);
      if (organisatieId === null) {
        return res.status(400).json({
          error: "organisatie_id is verplicht en moet een positief geheel getal zijn.",
        });
      }

      const naam = organisatieNaam(organisatieId);
      if (naam === null) {
        return res.status(404).json({ error: "Organisatie niet gevonden." });
      }

      // leesAfnameRijen filtert op `organisatie_id = ?`. Afnames van een andere
      // organisatie en afnames zonder organisatie (NULL) vallen daar per
      // definitie buiten.
      const rijen = leesAfnameRijen(sqlite, organisatieId);
      const { rijen: perInstrument, totalen } = aggregeerPerInstrument(rijen, instrumentLabels());

      return res.json({
        niveau: "organisatie",
        organisatieId,
        organisatieNaam: naam,
        gegenereerdOp: new Date().toISOString(),
        instrumenten: perInstrument,
        totalen,
      });
    } catch (err) {
      console.error("[opvolging] organisatie-overzicht mislukt:", err);
      return res.status(500).json({ error: "Opvolging ophalen mislukt." });
    }
  });
}
