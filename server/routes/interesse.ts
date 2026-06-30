/**
 * server/routes/interesse.ts
 * 
 * Domeinrouter: Interesse-aanmeldingen (webshop / lead-capture).
 * Geëxtraheerd uit server/routes.ts (item 1.1, Fase 5).
 * 
 * Routes:
 *   POST /api/interesse
 */

import type { Express } from "express";
import { storage, db } from "../storage";

export function registerInteresseRoutes(app: Express): void {
  app.post("/api/interesse", async (req, res) => {
    const { naam, email, product, bericht } = req.body ?? {};
    if (!naam?.trim() || !email?.trim() || !product?.trim()) {
      return res.status(400).json({ error: "naam, email en product zijn verplicht." });
    }
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email.trim())) {
      return res.status(400).json({ error: "Ongeldig e-mailadres." });
    }
    try {
      const sqlite = (db as any)._db ?? (storage as any).sqlite ?? null;
      if (sqlite) {
        sqlite.exec(`
          CREATE TABLE IF NOT EXISTS interesse_registraties (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            naam TEXT NOT NULL,
            email TEXT NOT NULL,
            product TEXT NOT NULL,
            bericht TEXT,
            geregistreerd_op TEXT NOT NULL
          )
        `);
        sqlite
          .prepare(
            "INSERT INTO interesse_registraties (naam, email, product, bericht, geregistreerd_op) VALUES (?, ?, ?, ?, ?)",
          )
          .run(
            naam.trim(),
            email.trim().toLowerCase(),
            product.trim(),
            (bericht ?? "").trim() || null,
            new Date().toISOString(),
          );
      }
      console.log(
        `[Webshop] Interesse: ${naam.trim()} <${email.trim()}> → ${product.trim()}`,
      );
      return res.json({ ok: true });
    } catch (e) {
      console.error("[Webshop] Interesse opslaan mislukt:", e);
      return res.status(500).json({ error: "Opslaan mislukt — probeer later opnieuw." });
    }
  });
}
