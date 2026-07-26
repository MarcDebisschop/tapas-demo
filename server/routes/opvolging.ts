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
 * BEVEILIGING (fase 5 van de organisatie-scoping):
 * Beide endpoints staan achter `vereisScope`. De scope komt uit de SESSIE en
 * nooit uit de query. Voordien haalde niveau 2 de organisatie uit
 * `?organisatie_id=`, en dat betekende dat elke admin-sessie de cijfers van
 * elke organisatie kon opvragen.
 *
 * Niveau 1 (alle organisaties samen) is daarmee vanzelf prior-only: een
 * organisatie die dat pad aanroept krijgt haar eigen cijfers, niet die van het
 * platform. Voor de prior blijft `organisatie_id` een FILTER binnen wat hij
 * toch al mag zien.
 */

import type { Express, Request, Response } from "express";
import { sqlite } from "../storage";
import { vereisScope, scopeVanVerzoek } from "../scope-guard";
import { organisatieFilterVanScope } from "../scope";
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
  app.get("/api/admin/opvolging-per-instrument", vereisScope, (req: Request, res: Response) => {
    try {
      const scope = scopeVanVerzoek(req);

      // Niveau 1 (alle organisaties samen) is hiermee vanzelf prior-only. Een
      // organisatie die dit pad aanroept zakt naar haar eigen cijfers in plaats
      // van een fout te krijgen: zo kan een verkeerde URL nooit meer opleveren
      // dan de scope toestaat.
      let organisatieId = organisatieFilterVanScope(scope, "opvolging-admin");

      // Voor de prior is organisatie_id een FILTER binnen wat hij toch al mag
      // zien. Een meegegeven maar ongeldige waarde negeren we niet
      // stilzwijgend: dat zou ongemerkt de cijfers van alle organisaties tonen.
      const ruw = req.query.organisatie_id;
      if (scope.soort === "prior" && ruw !== undefined && String(ruw).trim() !== "") {
        organisatieId = parseOrganisatieId(ruw);
        if (organisatieId === null) {
          return res.status(400).json({ error: "Ongeldige organisatie_id." });
        }
      }

      const rijen = leesAfnameRijen(sqlite, organisatieId);
      const { rijen: perInstrument, totalen } = aggregeerPerInstrument(rijen, instrumentLabels());

      return res.json({
        niveau: scope.soort === "prior" ? "admin" : "organisatie",
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
  app.get("/api/organisatie/opvolging-per-instrument", vereisScope, (req: Request, res: Response) => {
    try {
      const scope = scopeVanVerzoek(req);

      // DE KERN VAN DE FIX: de organisatie komt uit de sessie. Een
      // `?organisatie_id=` in de URL kan de uitkomst niet meer beinvloeden.
      // Voor de prior, die geen eigen organisatie heeft, is die parameter wel
      // de enige manier om te zeggen welke organisatie hij wil bekijken.
      let organisatieId: number | null = organisatieFilterVanScope(scope, "opvolging-organisatie");
      if (organisatieId === null) {
        organisatieId = parseOrganisatieId(req.query.organisatie_id);
        if (organisatieId === null) {
          return res.status(400).json({
            error: "organisatie_id is verplicht en moet een positief geheel getal zijn.",
          });
        }
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
