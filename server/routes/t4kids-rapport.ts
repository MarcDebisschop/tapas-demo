/**
 * server/routes/t4kids-rapport.ts — NIEUW BESTAND (strikt additief).
 *
 * Publieke, T4Kids-eigen leesroute voor het rijke kindrapport:
 *   GET /api/afnames/:id/t4kids-rapport.json
 *
 * Geeft het reeds server-side gebouwde generator-contract terug (identiek aan
 * wat buildT4KidsContract produceerde en in afname.generatorContract staat
 * opgeslagen), maar UITSLUITEND als de afname instrumentId === "t4kids" heeft.
 * Zo hoeft de kind-eindpagina (client/src/pages/t4kids-rapport.tsx) geen admin-
 * sessie te hebben. Geen enkel ander instrument raakt hierdoor aan: andere
 * instrumenten krijgen 404.
 *
 * Er is bewust GEEN server-side PDF-route: het rapport is beeld- en grafiek-rijk
 * (aardappelillustraties + recharts). De "Download als PDF"-knop gebruikt de
 * browser-print (window.print) met een print-stylesheet — de betrouwbaarste weg
 * om exact dezelfde rijke lay-out netjes op A4 te pagineren.
 */

import type { Express } from "express";
import { storage } from "../storage";

export function registerT4KidsRapportRoutes(app: Express): void {
  app.get("/api/afnames/:id/t4kids-rapport.json", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Ongeldige afname-id" });
    }
    const a = await storage.getAfname(id);
    if (!a || a.instrumentId !== "t4kids") {
      return res.status(404).json({ error: "Geen T4Kids-rapport gevonden" });
    }
    if (!a.generatorContract) {
      return res.status(404).json({ error: "Rapport nog niet beschikbaar" });
    }
    let contract: unknown;
    try {
      contract = JSON.parse(a.generatorContract);
    } catch {
      return res.status(500).json({ error: "Rapport kon niet gelezen worden" });
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.json(contract);
  });
}
