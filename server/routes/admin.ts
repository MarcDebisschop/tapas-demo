/**
 * server/routes/admin.ts
 * 
 * Domeinrouter: Admin authenticatie en afname-inzicht.
 * Geëxtraheerd uit server/routes.ts (item 1.1, Fase 5).
 * 
 * Routes:
 *   POST /api/admin/login
 *   GET  /api/admin/me
 *   POST /api/admin/logout
 *   GET  /api/admin/afnames
 *   GET  /api/admin/afnames/:id
 *   GET  /api/admin/afnames/:id/contract.json
 *   GET  /api/admin/interesse
 */

import type { Express } from "express";
import { storage, db } from "../storage";

export function registerAdminRoutes(app: Express): void {
  // --- Admin: login ---
  app.post("/api/admin/login", async (req, res) => {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: "E-mailadres ontbreekt." });
    const beheerder = await storage.getBeheerderByEmail(email.trim().toLowerCase());
    if (!beheerder || !beheerder.actief) {
      return res.status(401).json({ message: "E-mailadres of wachtwoord onjuist." });
    }
    (req.session as any).adminId = beheerder.id;
    req.session.save((err) => {
      if (err) return res.status(500).json({ message: "Sessie opslaan mislukt." });
      res.json({
        ok: true,
        naam: beheerder.naam,
        email: beheerder.email,
        isPrior: beheerder.isPrior,
      });
    });
  });

  app.get("/api/admin/me", async (req, res) => {
    try {
      const adminId = (req as any).session?.adminId;
      if (!adminId) return res.status(401).json({ message: "Niet ingelogd." });
      const beheerder = await storage.getBeheerder(Number(adminId));
      if (!beheerder || !beheerder.actief)
        return res.status(401).json({ message: "Sessie verlopen." });
      res.json({
        ok: true,
        naam: beheerder.naam,
        email: beheerder.email,
        isPrior: beheerder.isPrior,
      });
    } catch {
      res.status(401).json({ message: "Niet ingelogd." });
    }
  });

  app.post("/api/admin/logout", (req, res) => {
    req.session.destroy(() => {});
    res.json({ ok: true });
  });

  // --- Admin: lijst van afnames ---
  app.get("/api/admin/afnames", async (_req, res) => {
    const list = await storage.listAfnames();
    res.json(
      list.map((a) => ({
        id: a.id,
        respondentCode: a.respondentCode,
        name: a.name,
        company: a.company,
        role: a.role,
        status: a.status,
        taal: a.taal,
        createdAt: a.createdAt,
        completedAt: a.completedAt,
        inviteToken: a.inviteToken,
        uitgenodigdAt: a.uitgenodigdAt,
        herinnerdAt: a.herinnerdAt,
      })),
    );
  });

  // --- Admin: volledig profiel + generator-JSON van één afname ---
  app.get("/api/admin/afnames/:id", async (req, res) => {
    const id = Number(req.params.id);
    const a = await storage.getAfname(id);
    if (!a) return res.status(404).json({ error: "Afname niet gevonden" });
    let dashboardToken: string | null = null;
    if (a.deelnemerEmail) {
      const deelnemer = await storage.getDeelnemerByEmail(a.deelnemerEmail);
      if (deelnemer) dashboardToken = deelnemer.dashboardToken;
    }
    res.json({
      ...a,
      dashboardToken,
      mainResponses: a.mainResponses ? JSON.parse(a.mainResponses) : null,
      connectionAnswers: a.connectionAnswers ? JSON.parse(a.connectionAnswers) : null,
      generatorContract: a.generatorContract ? JSON.parse(a.generatorContract) : null,
    });
  });

  // --- Download generator-JSON als bestand ---
  app.get("/api/admin/afnames/:id/contract.json", async (req, res) => {
    const id = Number(req.params.id);
    const a = await storage.getAfname(id);
    if (!a || !a.generatorContract) {
      return res.status(404).json({ error: "Geen generator-JSON beschikbaar" });
    }
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${a.respondentCode}_generator-contract.json"`,
    );
    res.send(a.generatorContract);
  });

  // --- Admin: interesse-registraties ---
  app.get("/api/admin/interesse", async (req, res) => {
    const adminId = (req.session as any)?.adminId;
    if (!adminId) return res.status(401).json({ error: "Niet ingelogd." });
    try {
      const sqlite = (db as any)._db ?? (storage as any).sqlite ?? null;
      if (!sqlite) return res.json([]);
      const rows = sqlite
        .prepare(
          "SELECT id, naam, email, product, bericht, geregistreerd_op FROM interesse_registraties ORDER BY geregistreerd_op DESC",
        )
        .all();
      return res.json(rows);
    } catch {
      return res.status(500).json({ error: "Ophalen mislukt." });
    }
  });
}
