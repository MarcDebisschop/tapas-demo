// server/t4sports/module-routes.ts
// Routes voor T4Sports extra modules (M1 / M2 / M3).
// NIEUW BESTAND — additief, raakt geen bestaande bestanden aan.
//
// Eigen SQLite tabel "t4sports_module_resultaten" — geen aanpassing van
// storage.ts of shared/schema.ts vereist.
//
// Endpoints:
//   GET  /api/t4sports/modules                               — module-definities
//   GET  /api/t4sports/modules/:moduleId                     — specifieke module
//   POST /api/t4sports/afnames/:id/module-antwoorden         — opslaan + scoren
//   GET  /api/t4sports/afnames/:id/module-resultaten         — resultaten ophalen
//   GET  /api/t4sports/afnames/:id/rapport-compleet/html     — HTML rapport
//   GET  /api/t4sports/afnames/:id/rapport-compleet/download — download HTML

import type { Express } from "express";
import { z } from "zod";
import Database from "better-sqlite3";
import { resolve } from "path";
import { storage } from "../storage";
import { scoreModule, getModuleDefinitie, getAlleModuleIds } from "./module-scoring";
import type { ModuleAntwoord, ModuleResultaat } from "./module-scoring";

// ─────────────────────────────────────────────────────────────────────────────
// Eigen database voor module-resultaten (zelfde DB-bestand als hoofdplatform)
// ─────────────────────────────────────────────────────────────────────────────

const DB_PATH = resolve(process.env.DATABASE_PATH ?? "./data.db");
const moduleDb = new Database(DB_PATH);

// Maak de tabel aan als die nog niet bestaat (idempotent)
moduleDb.exec(`
  CREATE TABLE IF NOT EXISTS t4sports_module_resultaten (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    afname_id INTEGER NOT NULL,
    module_id TEXT NOT NULL,
    resultaat_json TEXT NOT NULL,
    aangemaakt_at TEXT NOT NULL,
    UNIQUE(afname_id, module_id)
  );
`);

// ─────────────────────────────────────────────────────────────────────────────
// Hulpfuncties voor tabel-toegang
// ─────────────────────────────────────────────────────────────────────────────

function slaModuleResultaatOp(afnameId: number, moduleId: string, resultaat: ModuleResultaat): void {
  const now = new Date().toISOString();
  moduleDb.prepare(`
    INSERT INTO t4sports_module_resultaten (afname_id, module_id, resultaat_json, aangemaakt_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(afname_id, module_id) DO UPDATE SET
      resultaat_json = excluded.resultaat_json,
      aangemaakt_at = excluded.aangemaakt_at
  `).run(afnameId, moduleId, JSON.stringify(resultaat), now);
}

function haalModuleResultatenOp(afnameId: number): ModuleResultaat[] {
  const rijen = moduleDb.prepare(`
    SELECT module_id, resultaat_json, aangemaakt_at
    FROM t4sports_module_resultaten
    WHERE afname_id = ?
    ORDER BY aangemaakt_at ASC
  `).all(afnameId) as Array<{ module_id: string; resultaat_json: string; aangemaakt_at: string }>;
  return rijen.map((r) => JSON.parse(r.resultaat_json) as ModuleResultaat);
}

function haalAangemaakt(afnameId: number): string | null {
  const rij = moduleDb.prepare(`
    SELECT MAX(aangemaakt_at) AS laatste FROM t4sports_module_resultaten WHERE afname_id = ?
  `).get(afnameId) as { laatste: string | null } | undefined;
  return rij?.laatste ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validatieschema's
// ─────────────────────────────────────────────────────────────────────────────

const moduleAntwoordSchema = z.object({
  moduleId: z.enum(["M1", "M2", "M3"]),
  antwoorden: z.record(z.string(), z.number().int().min(0).max(10)),
});

const moduleAntwoordenBatchSchema = z.object({
  modules: z.array(moduleAntwoordSchema),
});

// ─────────────────────────────────────────────────────────────────────────────
// Route-registratie
// ─────────────────────────────────────────────────────────────────────────────

export function registerT4SportsModuleRoutes(app: Express): void {

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/t4sports/afnames/:id/info — basisinfo voor navigatie
  // Geeft respondentCode terug zodat client kan navigeren naar dashboard/:token
  // ───────────────────────────────────────────────────────────────────────────
  app.get("/api/t4sports/afnames/:id/info", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Ongeldig afname-id" });
    const afname = await storage.getAfname(id);
    if (!afname) return res.status(404).json({ error: "Afname niet gevonden" });
    res.json({
      id: afname.id,
      respondentCode: afname.respondentCode,
      naam: afname.name,
      status: afname.status,
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/t4sports/modules — alle module-definities (overzicht)
  // ───────────────────────────────────────────────────────────────────────────
  app.get("/api/t4sports/modules", (_req, res) => {
    try {
      const ids = getAlleModuleIds();
      const modules = ids.map((id) => {
        const def = getModuleDefinitie(id);
        return {
          id: def.id,
          naam: def.naam,
          subtitel: def.subtitel,
          beschrijving: def.beschrijving,
          instrument: def.instrument,
          betrouwbaarheid: def.betrouwbaarheid,
          afnameduur: def.afnameduur,
          aantalItems: def.aantalItems,
          wetenschappelijkeBron: def.wetenschappelijkeBron,
          doi: def.doi,
        };
      });
      res.json({ modules });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/t4sports/modules/:moduleId — volledige module-definitie incl. items
  // ───────────────────────────────────────────────────────────────────────────
  app.get("/api/t4sports/modules/:moduleId", (req, res) => {
    try {
      const { moduleId } = req.params;
      const def = getModuleDefinitie(moduleId.toUpperCase());
      res.json(def);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // POST /api/t4sports/afnames/:id/module-antwoorden — antwoorden opslaan + scoren
  // ───────────────────────────────────────────────────────────────────────────
  app.post("/api/t4sports/afnames/:id/module-antwoorden", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Ongeldig afname-id" });

    const afname = await storage.getAfname(id);
    if (!afname) return res.status(404).json({ error: "Afname niet gevonden" });
    if (afname.status !== "voltooid") {
      return res.status(400).json({
        error: "T4Sports nog niet voltooid — voer eerst de basisvragenlijst af",
      });
    }

    const parsed = moduleAntwoordenBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Ongeldige module-antwoorden",
        details: parsed.error.errors,
      });
    }

    const resultaten: ModuleResultaat[] = [];
    for (const mod of parsed.data.modules) {
      try {
        const resultaat = scoreModule(mod as ModuleAntwoord);
        resultaten.push(resultaat);
        slaModuleResultaatOp(id, mod.moduleId, resultaat);
      } catch (err: any) {
        return res.status(400).json({
          error: `Scoringsfout module ${mod.moduleId}: ${err.message}`,
        });
      }
    }

    res.json({ ok: true, resultaten });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/t4sports/afnames/:id/module-resultaten — opgeslagen resultaten
  // ───────────────────────────────────────────────────────────────────────────
  app.get("/api/t4sports/afnames/:id/module-resultaten", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Ongeldig afname-id" });

    const afname = await storage.getAfname(id);
    if (!afname) return res.status(404).json({ error: "Afname niet gevonden" });

    const moduleResultaten = haalModuleResultatenOp(id);
    const geselecteerdeModules = moduleResultaten.map((r) => r.moduleId);
    const aangemaakt = haalAangemaakt(id);

    res.json({ moduleResultaten, geselecteerdeModules, aangemaakt });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/t4sports/afnames/:id/rapport-compleet/html — gecombineerd HTML rapport
  // ───────────────────────────────────────────────────────────────────────────
  app.get("/api/t4sports/afnames/:id/rapport-compleet/html", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Ongeldig afname-id" });

    const afname = await storage.getAfname(id);
    if (!afname) return res.status(404).json({ error: "Afname niet gevonden" });
    if (!afname.generatorContract) {
      return res.status(400).send("Profiel nog niet voltooid — generatorContract ontbreekt");
    }

    const moduleResultaten = haalModuleResultatenOp(id);

    const { genereerT4SportsRapportCompleet } = await import("./rapport-compleet");
    const html = genereerT4SportsRapportCompleet(
      afname.generatorContract,
      moduleResultaten,
      "nl"
    );

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/t4sports/afnames/:id/rapport-compleet/download — download HTML
  // ───────────────────────────────────────────────────────────────────────────
  app.get("/api/t4sports/afnames/:id/rapport-compleet/download", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Ongeldig afname-id" });

    const afname = await storage.getAfname(id);
    if (!afname) return res.status(404).json({ error: "Afname niet gevonden" });
    if (!afname.generatorContract) {
      return res.status(400).send("Profiel nog niet voltooid — generatorContract ontbreekt");
    }

    const moduleResultaten = haalModuleResultatenOp(id);

    const { genereerT4SportsRapportCompleet } = await import("./rapport-compleet");
    const html = genereerT4SportsRapportCompleet(
      afname.generatorContract,
      moduleResultaten,
      "nl"
    );

    const naam = (() => {
      try {
        const c =
          typeof afname.generatorContract === "string"
            ? JSON.parse(afname.generatorContract)
            : afname.generatorContract;
        return (c?.name ?? c?.contract?.name ?? "atleet").replace(/\s+/g, "-");
      } catch {
        return "atleet";
      }
    })();

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="T4Sports-Compleet-${naam}.html"`
    );
    res.send(html);
  });
}
