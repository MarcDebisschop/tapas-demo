/**
 * server/gids-manager.ts  —  NIEUW BESTAND (Werkprotocol Regel 2)
 * -----------------------------------------------------------------------------
 * Tekst-overschrijvingen voor De Instrumentengids.
 *
 * Volledig gemodelleerd naar het bewezen patroon in question-manager.ts:
 *   - lazy `CREATE TABLE IF NOT EXISTS` (buiten Drizzle-schema, geen migratie)
 *   - override wint over de default uit client/src/data/instrumentengids.ts
 *   - enkel prior-beheerders mogen lezen/schrijven (requirePrior)
 *   - audit-trail: gewijzigd_door / gewijzigd_op
 *   - meertalig: nl / fr / en / es / ru
 *
 * Beheerbare velden per instrument (veld = "veld"-kolom):
 *   omschrijving | beantwoordt | gebruik | rapportTeaser | doelgroep
 *
 * Routes:
 *   GET    /api/gids                              — publiek: alle overrides (nl-default of ?taal=)
 *   GET    /api/admin/gids/:id                    — prior: overrides voor één instrument (alle talen)
 *   PUT    /api/admin/gids/:id/:veld              — prior: override opslaan  { taal, tekst }
 *   DELETE /api/admin/gids/:id/:veld/:taal        — prior: override verwijderen (terug naar default)
 *   GET    /api/admin/gids/:id/:veld/log          — prior: wijzigingslog
 *
 * Dit bestand raakt GEEN bestaand bestand aan. Registratie gebeurt via
 * één extra regel in server/routes.ts (buildGidsManagerRoutes(app)).
 */

import type { Express, Request, Response } from "express";
import { db, storage, sqlite as rawSqlite } from "./storage";

// Toegestane velden — whitelist zodat de admin nooit een willekeurige kolom kan zetten.
const TOEGESTANE_VELDEN = new Set([
  "omschrijving",
  "beantwoordt",
  "gebruik",
  "rapportTeaser",
  "doelgroep",
]);

const TOEGESTANE_TALEN = new Set(["nl", "fr", "en", "es", "ru"]);

// ─── SQLite-handle ───────────────────────────────────────────────────────────
// storage.ts exporteert de raw better-sqlite3-handle als named export `sqlite`
// (regel: `export { sqlite }`). Dat is de betrouwbare bron. We vallen daarnaast
// terug op drizzle's interne client ($client) en de oude _db/storage.sqlite-
// varianten, puur als extra vangnet.
function getSqlite(): any {
  return (
    rawSqlite ??
    (db as any)?.$client ??
    (db as any)?._db ??
    (storage as any)?.sqlite ??
    null
  );
}

// ─── Prior-check middleware (identiek aan question-manager.ts) ───────────────
async function requirePrior(req: Request, res: Response, next: Function) {
  const adminId = (req.session as any)?.adminId;
  if (!adminId) return res.status(401).json({ error: "Niet ingelogd." });
  const beheerder = await storage.getBeheerder(Number(adminId));
  if (!beheerder || !beheerder.isPrior) {
    return res.status(403).json({ error: "Enkel prior-beheerders kunnen de gids beheren." });
  }
  (req as any).beheerder = beheerder;
  next();
}

// ─── Lazy tabel-aanmaak ──────────────────────────────────────────────────────
function ensureGidsTable() {
  try {
    const sqlite = getSqlite();
    if (sqlite) {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS gids_teksten (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          instrument TEXT NOT NULL,
          veld TEXT NOT NULL,
          taal TEXT NOT NULL,
          tekst TEXT NOT NULL,
          gewijzigd_door TEXT NOT NULL,
          gewijzigd_op TEXT NOT NULL,
          UNIQUE(instrument, veld, taal)
        )
      `);
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS gids_teksten_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          instrument TEXT NOT NULL,
          veld TEXT NOT NULL,
          taal TEXT NOT NULL,
          tekst TEXT NOT NULL,
          actie TEXT NOT NULL,
          gewijzigd_door TEXT NOT NULL,
          gewijzigd_op TEXT NOT NULL
        )
      `);
    }
  } catch (e) {
    console.error("[GIDS] Tabel aanmaken mislukt:", e);
  }
}

// ─── Alle overrides (optioneel gefilterd op taal) ────────────────────────────
// Vorm: { [instrumentId]: { [veld]: { [taal]: tekst } } }
function getAlleOverrides(): Record<string, Record<string, Record<string, string>>> {
  ensureGidsTable();
  const result: Record<string, Record<string, Record<string, string>>> = {};
  try {
    const sqlite = getSqlite();
    if (!sqlite) return result;
    const rows = sqlite
      .prepare("SELECT instrument, veld, taal, tekst FROM gids_teksten")
      .all() as { instrument: string; veld: string; taal: string; tekst: string }[];
    for (const r of rows) {
      result[r.instrument] ??= {};
      result[r.instrument][r.veld] ??= {};
      result[r.instrument][r.veld][r.taal] = r.tekst;
    }
  } catch (e) {
    console.error("[GIDS] Overrides ophalen mislukt:", e);
  }
  return result;
}

function getOverridesVoorInstrument(
  instrument: string
): Record<string, Record<string, string>> {
  return getAlleOverrides()[instrument] ?? {};
}

// ─── Override opslaan + loggen ───────────────────────────────────────────────
function saveOverride(
  instrument: string,
  veld: string,
  taal: string,
  tekst: string,
  gewijzigdDoor: string
) {
  ensureGidsTable();
  const sqlite = getSqlite();
  if (!sqlite) throw new Error("Geen database beschikbaar.");
  const nu = new Date().toISOString();
  sqlite
    .prepare(
      `INSERT INTO gids_teksten (instrument, veld, taal, tekst, gewijzigd_door, gewijzigd_op)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(instrument, veld, taal)
       DO UPDATE SET tekst = excluded.tekst,
                     gewijzigd_door = excluded.gewijzigd_door,
                     gewijzigd_op = excluded.gewijzigd_op`
    )
    .run(instrument, veld, taal, tekst, gewijzigdDoor, nu);
  sqlite
    .prepare(
      `INSERT INTO gids_teksten_log (instrument, veld, taal, tekst, actie, gewijzigd_door, gewijzigd_op)
       VALUES (?, ?, ?, ?, 'opslaan', ?, ?)`
    )
    .run(instrument, veld, taal, tekst, gewijzigdDoor, nu);
}

function deleteOverride(
  instrument: string,
  veld: string,
  taal: string,
  gewijzigdDoor: string
) {
  ensureGidsTable();
  const sqlite = getSqlite();
  if (!sqlite) throw new Error("Geen database beschikbaar.");
  const nu = new Date().toISOString();
  sqlite
    .prepare("DELETE FROM gids_teksten WHERE instrument = ? AND veld = ? AND taal = ?")
    .run(instrument, veld, taal);
  sqlite
    .prepare(
      `INSERT INTO gids_teksten_log (instrument, veld, taal, tekst, actie, gewijzigd_door, gewijzigd_op)
       VALUES (?, ?, ?, '', 'verwijderen', ?, ?)`
    )
    .run(instrument, veld, taal, gewijzigdDoor, nu);
}

function getLog(instrument: string, veld: string) {
  ensureGidsTable();
  const sqlite = getSqlite();
  if (!sqlite) return [];
  return sqlite
    .prepare(
      `SELECT taal, tekst, actie, gewijzigd_door, gewijzigd_op
       FROM gids_teksten_log
       WHERE instrument = ? AND veld = ?
       ORDER BY id DESC LIMIT 100`
    )
    .all(instrument, veld);
}

// Exporteerbaar zodat de PDF-generatoren (fiche + brochure) dezelfde overrides
// kunnen toepassen — één bron van waarheid voor preview, HTML én PDF.
export function gidsOverridesSnapshot(): Record<
  string,
  Record<string, Record<string, string>>
> {
  return getAlleOverrides();
}

/**
 * Pas de override toe op één veld voor een instrument in een gegeven taal.
 * Valt terug op de meegegeven default als er geen override bestaat.
 */
export function pasOverrideToe(
  instrument: string,
  veld: string,
  taal: string,
  standaard: string,
  snapshot?: Record<string, Record<string, Record<string, string>>>
): string {
  const alle = snapshot ?? getAlleOverrides();
  const perVeld = alle[instrument]?.[veld];
  if (!perVeld) return standaard;
  return perVeld[taal] ?? perVeld["nl"] ?? standaard;
}

// ─── Route-registratie ───────────────────────────────────────────────────────
export function buildGidsManagerRoutes(app: Express): void {
  // Publiek: alle overrides in één keer (de client merget met de default-data).
  app.get("/api/gids", (_req: Request, res: Response) => {
    try {
      res.json(getAlleOverrides());
    } catch (e) {
      res.status(500).json({ error: "Kon gids-overrides niet laden." });
    }
  });

  // Prior: overrides voor één instrument (alle velden, alle talen).
  app.get("/api/admin/gids/:id", requirePrior, (req: Request, res: Response) => {
    try {
      res.json(getOverridesVoorInstrument(req.params.id));
    } catch (e) {
      res.status(500).json({ error: "Kon overrides niet laden." });
    }
  });

  // Prior: override opslaan.
  app.put("/api/admin/gids/:id/:veld", requirePrior, (req: Request, res: Response) => {
    const { id, veld } = req.params;
    const { taal, tekst } = req.body ?? {};
    if (!TOEGESTANE_VELDEN.has(veld)) {
      return res.status(400).json({ error: `Onbekend veld: ${veld}` });
    }
    if (typeof taal !== "string" || !TOEGESTANE_TALEN.has(taal)) {
      return res.status(400).json({ error: "Ongeldige of ontbrekende taal." });
    }
    if (typeof tekst !== "string" || tekst.trim().length === 0) {
      return res.status(400).json({ error: "Tekst mag niet leeg zijn." });
    }
    try {
      const beheerder = (req as any).beheerder;
      const door = beheerder?.email ?? beheerder?.naam ?? `admin#${beheerder?.id ?? "?"}`;
      saveOverride(id, veld, taal, tekst.trim(), door);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: "Opslaan mislukt.", detail: String(e) });
    }
  });

  // Prior: override verwijderen (terug naar default).
  app.delete(
    "/api/admin/gids/:id/:veld/:taal",
    requirePrior,
    (req: Request, res: Response) => {
      const { id, veld, taal } = req.params;
      if (!TOEGESTANE_VELDEN.has(veld)) {
        return res.status(400).json({ error: `Onbekend veld: ${veld}` });
      }
      try {
        const beheerder = (req as any).beheerder;
        const door = beheerder?.email ?? beheerder?.naam ?? `admin#${beheerder?.id ?? "?"}`;
        deleteOverride(id, veld, taal, door);
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: "Verwijderen mislukt.", detail: String(e) });
      }
    }
  );

  // Prior: wijzigingslog voor één veld.
  app.get(
    "/api/admin/gids/:id/:veld/log",
    requirePrior,
    (req: Request, res: Response) => {
      try {
        res.json(getLog(req.params.id, req.params.veld));
      } catch (e) {
        res.status(500).json({ error: "Kon log niet laden." });
      }
    }
  );
}
