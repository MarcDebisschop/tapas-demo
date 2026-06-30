/**
 * server/routes/t4r.ts
 *
 * Domeinrouter: T4Recruitment — licenties, sessies, kringleden, vergelijkende
 * studies en de publieke kringlid-link (/api/r/:token).
 * Geëxtraheerd uit server/routes.ts (item 1.1, Fase 5).
 *
 * Routes:
 *   GET  /api/licenties                       — lijst van licenties
 *   POST /api/licenties                       — licentie aanmaken
 *   POST /api/licenties/:id/intrekken         — licentie intrekken
 *   GET  /api/sessies                         — lijst van sessies
 *   POST /api/sessies                         — sessie aanmaken
 *   GET  /api/sessies/:id                     — sessie-detail (incl. kring + studies)
 *   PUT  /api/sessies/:id/state               — collaboratieve toestand bijwerken
 *   POST /api/sessies/:id/kring               — kringlid toevoegen
 *   DELETE /api/sessies/:id/kring/:lidId      — kringlid verwijderen
 *   POST /api/sessies/:id/vergrendel          — kring vergrendelen
 *   POST /api/sessies/:id/heropen             — kring heropenen
 *   POST /api/sessies/:id/finaliseer          — sessie finaliseren
 *   POST /api/sessies/:id/studies             — vergelijkende studie toevoegen
 *   GET  /api/r/:token                        — kringlid-link ophalen
 *   PUT  /api/r/:token/input                  — individuele input bewaren
 */

import type { Express } from "express";
import { storage, CreditError } from "../storage";
import {
  maakLicentieSchema,
  maakSessieSchema,
  voegKringlidSchema,
} from "@shared/schema";

export function registerT4RInlineRoutes(app: Express): void {
  // =========================================================================
  // Licenties (losse, buiten-platform verkoop)
  // =========================================================================

  app.get("/api/licenties", async (_req, res) => {
    res.json(await storage.listLicenties());
  });

  app.post("/api/licenties", async (req, res) => {
    const parsed = maakLicentieSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" });
    }
    const d = parsed.data;
    const lic = await storage.maakLicentie({
      klantnaam: d.klantnaam,
      klantEmail: d.klantEmail || null,
      maxProfielen: d.maxProfielen ?? null,
      prijsPerProfielCent: Math.round((d.prijsPerProfiel ?? 0) * 100),
      geldigTot: d.geldigTot || null,
      notities: d.notities || null,
    });
    res.status(201).json(lic);
  });

  app.post("/api/licenties/:id/intrekken", async (req, res) => {
    const lic = await storage.trekLicentieIn(Number(req.params.id));
    if (!lic) return res.status(404).json({ error: "Licentie niet gevonden" });
    res.json(lic);
  });

  // =========================================================================
  // Sessies (rolprofiel-trajecten)
  // =========================================================================

  app.get("/api/sessies", async (_req, res) => {
    res.json(await storage.listSessies());
  });

  app.post("/api/sessies", async (req, res) => {
    const parsed = maakSessieSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" });
    }
    const d = parsed.data;
    let licentieId: number | null = null;
    if (d.licentieSleutel) {
      const lic = await storage.getLicentieBySleutel(d.licentieSleutel.trim().toUpperCase());
      if (!lic) return res.status(404).json({ error: "Onbekende licentiesleutel" });
      if (lic.status !== "actief") return res.status(403).json({ error: "Licentie is niet actief" });
      licentieId = lic.id;
    }
    const sessie = await storage.maakSessie({
      titel: d.titel,
      facilitatorNaam: d.facilitatorNaam || null,
      facilitatorEmail: d.facilitatorEmail || null,
      taal: d.taal ?? "nl",
      organisatieId: d.organisatieId ?? null,
      licentieId,
    });
    res.status(201).json(sessie);
  });

  // Sessie-detail incl. kring en studies.
  app.get("/api/sessies/:id", async (req, res) => {
    const sessie = await storage.getSessie(Number(req.params.id));
    if (!sessie) return res.status(404).json({ error: "Sessie niet gevonden" });
    const [kring, studies] = await Promise.all([
      storage.listKringleden(sessie.id),
      storage.listStudies(sessie.id),
    ]);
    res.json({ ...sessie, kring, studies });
  });

  // De collaboratieve toestand bijwerken.
  app.put("/api/sessies/:id/state", async (req, res) => {
    const sessie = await storage.getSessie(Number(req.params.id));
    if (!sessie) return res.status(404).json({ error: "Sessie niet gevonden" });
    const updated = await storage.updateSessie(sessie.id, {
      sessieState: JSON.stringify(req.body ?? {}),
      ...(typeof req.body?.status === "string" ? { status: req.body.status } : {}),
    });
    res.json(updated);
  });

  // Een kringlid toevoegen — alleen vóór vergrendeling.
  app.post("/api/sessies/:id/kring", async (req, res) => {
    const sessie = await storage.getSessie(Number(req.params.id));
    if (!sessie) return res.status(404).json({ error: "Sessie niet gevonden" });
    if (sessie.kringVergrendeld) {
      return res.status(409).json({ error: "kring_vergrendeld", boodschap: "De kring is vergrendeld. Heropen ze eerst (kost credits)." });
    }
    const parsed = voegKringlidSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" });
    }
    const lid = await storage.voegKringlidToe(sessie.id, {
      rol: parsed.data.rol,
      naam: parsed.data.naam || null,
      email: parsed.data.email || null,
    });
    res.status(201).json(lid);
  });

  // Een kringlid verwijderen — alleen vóór vergrendeling.
  app.delete("/api/sessies/:id/kring/:lidId", async (req, res) => {
    const sessie = await storage.getSessie(Number(req.params.id));
    if (!sessie) return res.status(404).json({ error: "Sessie niet gevonden" });
    if (sessie.kringVergrendeld) {
      return res.status(409).json({ error: "kring_vergrendeld" });
    }
    await storage.verwijderKringlid(Number(req.params.lidId));
    res.status(204).end();
  });

  // De kring vergrendelen + het sessietarief reserveren.
  app.post("/api/sessies/:id/vergrendel", async (req, res) => {
    try {
      const sessie = await storage.vergrendelKring(Number(req.params.id));
      if (!sessie) return res.status(404).json({ error: "Sessie niet gevonden" });
      res.json(sessie);
    } catch (e) {
      if (e instanceof CreditError) return res.status(402).json({ error: e.message });
      throw e;
    }
  });

  // De kring heropenen (uitzonderlijk).
  app.post("/api/sessies/:id/heropen", async (req, res) => {
    try {
      const sessie = await storage.heropenKring(Number(req.params.id));
      if (!sessie) return res.status(404).json({ error: "Sessie niet gevonden" });
      res.json(sessie);
    } catch (e) {
      if (e instanceof CreditError) return res.status(402).json({ error: e.message });
      throw e;
    }
  });

  // De sessie finaliseren — definitief verbruik.
  app.post("/api/sessies/:id/finaliseer", async (req, res) => {
    try {
      const sessie = await storage.finaliseerSessie(Number(req.params.id), req.body?.rolprofielContract);
      if (!sessie) return res.status(404).json({ error: "Sessie niet gevonden" });
      res.json(sessie);
    } catch (e) {
      if (e instanceof CreditError) return res.status(402).json({ error: e.message });
      throw e;
    }
  });

  // Een vergelijkende studie toevoegen (kandidaat vs. rolprofiel).
  app.post("/api/sessies/:id/studies", async (req, res) => {
    const sessie = await storage.getSessie(Number(req.params.id));
    if (!sessie) return res.status(404).json({ error: "Sessie niet gevonden" });
    const label = typeof req.body?.kandidaatLabel === "string" ? req.body.kandidaatLabel : "Kandidaat";
    const studie = await storage.voegStudieToe(sessie.id, label, req.body?.studieContract);
    res.status(201).json(studie);
  });

  // =========================================================================
  // Publieke kringlid-link: /api/r/:token
  // =========================================================================

  app.get("/api/r/:token", async (req, res) => {
    const lid = await storage.getKringlidByToken(req.params.token);
    if (!lid) return res.status(404).json({ error: "Uitnodiging niet gevonden" });
    const sessie = await storage.getSessie(lid.sessieId);
    if (!sessie) return res.status(404).json({ error: "Sessie niet gevonden" });
    // Markeer toegetreden bij eerste bezoek.
    if (lid.status === "uitgenodigd") {
      await storage.updateKringlid(lid.id, { status: "toegetreden", toegetredenAt: new Date().toISOString() });
    }
    res.json({
      rol: lid.rol,
      readOnly: lid.rol === "observer",
      naam: lid.naam,
      lidId: lid.id,
      sessie: {
        id: sessie.id,
        titel: sessie.titel,
        taal: sessie.taal,
        status: sessie.status,
        kringVergrendeld: sessie.kringVergrendeld,
        sessieState: sessie.sessieState ? JSON.parse(sessie.sessieState) : null,
      },
    });
  });

  // Een stakeholder bewaart zijn individuele input via zijn link.
  app.put("/api/r/:token/input", async (req, res) => {
    const lid = await storage.getKringlidByToken(req.params.token);
    if (!lid) return res.status(404).json({ error: "Uitnodiging niet gevonden" });
    if (lid.rol === "observer") {
      return res.status(403).json({ error: "Observers hebben alleen-leestoegang." });
    }
    const updated = await storage.updateKringlid(lid.id, {
      individueleInput: JSON.stringify(req.body ?? {}),
      status: "input-klaar",
    });
    res.json({ ok: true, lidId: updated?.id });
  });
}
