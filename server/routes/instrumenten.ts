/**
 * server/routes/instrumenten.ts
 * 
 * Domeinrouter: Instrument-registry.
 * Geëxtraheerd uit server/routes.ts (item 1.1, Fase 5).
 * 
 * Routes:
 *   GET /api/instrument          — standaard instrument (T4P Business)
 *   GET /api/instruments         — lijst van alle beschikbare instrumenten
 *   GET /api/instruments/:id     — taalbewuste view voor specifiek instrument
 */

import type { Express } from "express";
import { clientInstrument } from "../instrument";
import { instrumentSamenvattingen, clientInstrumentVoor } from "../registry";
import { normaliseerTaal } from "@shared/i18n";

export function registerInstrumentRoutes(app: Express): void {
  app.get("/api/instrument", (req, res) => {
    const taal = normaliseerTaal(req.query.taal);
    res.json(clientInstrument(taal));
  });

  // Instrument-registry (Fase 1): lijst van beschikbare instrumenten.
  // Maakt het platform multi-instrument: de frontend kan straks kiezen welk
  // instrument (individueel of collaboratief) wordt getoond.
  app.get("/api/instruments", (_req, res) => {
    res.json(instrumentSamenvattingen());
  });

  // Taalbewuste client-view voor een specifiek (individueel) instrument uit de
  // registry. Valt terug op het standaard-instrument; levert 404 voor een
  // onbekend id en 415 voor een (nog) niet-individueel instrument.
  app.get("/api/instruments/:instrumentId", (req, res) => {
    const taal = normaliseerTaal(req.query.taal);
    const view = clientInstrumentVoor(req.params.instrumentId, taal);
    if (view === null) {
      return res
        .status(415)
        .json({ error: "Dit instrument levert geen individuele vragenlijst-view." });
    }
    res.json(view);
  });
}
