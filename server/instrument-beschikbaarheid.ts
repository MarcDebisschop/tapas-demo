/**
 * Instrument-beschikbaarheid — globale vrijgave-vlag per instrument (default UIT)
 *
 * Architectuur (spiegel van duiding-manager.ts — Regel 1 & 2, strikt additief):
 *  - Een globale aan/uit-vlag PER instrument-id. Default = UIT: zolang een
 *    prior-beheerder een instrument niet expliciet vrijgeeft, kan een
 *    eindgebruiker het niet afnemen.
 *  - De vlag wordt opgeslagen in een EIGEN SQLite-tabel `instrument_beschikbaarheid`
 *    (NIET hergebruikt van `duiding_overschrijvingen`). Geen rij = UIT.
 *  - Beveiliging: enkel is_prior=true beheerders mogen lezen + schrijven.
 *  - Audit trail: elke wijziging slaat wie + wanneer op (gewijzigd_door/-op).
 *
 * Deze module raakt geen bestaand afname- of rapportpad aan; ze levert enkel de
 * vlag + de admin-routes. De handhaving zelf gebeurt in de afname-routes van het
 * betrokken instrument (bv. server/driverscan/routes.ts).
 */

import { type Request, type Response } from "express";
import { storage, sqlite } from "./storage";

// ─── Helper: prior-check middleware (spiegel van duiding-manager.ts) ──────────

async function requirePrior(req: Request, res: Response, next: Function) {
  const adminId = (req.session as any)?.adminId;
  if (!adminId) return res.status(401).json({ error: "Niet ingelogd." });
  const beheerder = await storage.getBeheerder(Number(adminId));
  if (!beheerder || !beheerder.isPrior) {
    return res.status(403).json({ error: "Enkel prior-beheerders kunnen de beschikbaarheid beheren." });
  }
  (req as any).beheerder = beheerder;
  next();
}

// ─── Registry van beheerbare instrumenten (label + id) ────────────────────────
// Additief uitbreidbaar. Server-id `tapas-driverscan` = consistent met
// server/driverscan/routes.ts.
const BESCHIKBAARHEID_INSTRUMENTEN = [
  { id: "tapas-driverscan", label: "Driver-scan" },
  // Additief (Regel 2): T4Teens toegevoegd t.b.v. de open/dicht-knop voor de
  // schoolpilot. Default UIT (geen rij = UIT), net als elk ander instrument.
  { id: "tapas-t4teens", label: "T4Teens" },
];

const BEKENDE_IDS = new Set(BESCHIKBAARHEID_INSTRUMENTEN.map((i) => i.id));

// ─── SQLite (raw handle via named export — het bewezen patroon in deze codebase,
// zie server/credit-recovery.ts / gids-manager.ts / bulk-import/mailer.ts) ─────

function ensureBeschikbaarheidTable() {
  try {
    if (sqlite) {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS instrument_beschikbaarheid (
          instrument TEXT PRIMARY KEY,
          beschikbaar INTEGER NOT NULL DEFAULT 0,
          gewijzigd_door TEXT,
          gewijzigd_op TEXT
        )
      `);
    }
  } catch (e) {
    console.error("[IB] Tabel aanmaken mislukt:", e);
  }
}

// ─── Publieke lees-interface: default UIT (false) als er geen rij is ──────────

export function isInstrumentBeschikbaar(instrument: string): boolean {
  ensureBeschikbaarheidTable();
  try {
    if (!sqlite) return false;
    const row = sqlite
      .prepare("SELECT beschikbaar FROM instrument_beschikbaarheid WHERE instrument = ?")
      .get(instrument) as { beschikbaar: number } | undefined;
    return row ? row.beschikbaar === 1 : false;
  } catch {
    return false;
  }
}

export function getBeschikbaarheidInstrumenten(): { id: string; label: string; beschikbaar: boolean }[] {
  return BESCHIKBAARHEID_INSTRUMENTEN.map((i) => ({
    id: i.id,
    label: i.label,
    beschikbaar: isInstrumentBeschikbaar(i.id),
  }));
}

function setBeschikbaar(instrument: string, beschikbaar: boolean, gewijzigdDoor: string): boolean {
  ensureBeschikbaarheidTable();
  try {
    if (!sqlite) throw new Error("geen sqlite");
    const now = new Date().toISOString();
    sqlite
      .prepare(`
        INSERT INTO instrument_beschikbaarheid (instrument, beschikbaar, gewijzigd_door, gewijzigd_op)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(instrument) DO UPDATE SET
          beschikbaar = excluded.beschikbaar,
          gewijzigd_door = excluded.gewijzigd_door,
          gewijzigd_op = excluded.gewijzigd_op
      `)
      .run(instrument, beschikbaar ? 1 : 0, gewijzigdDoor, now);
    return true;
  } catch (e) {
    console.error("[IB] Beschikbaarheid opslaan mislukt:", e);
    return false;
  }
}

// ─── Route builder (spiegel van buildDuidingManagerRoutes) ────────────────────

export function buildInstrumentBeschikbaarheidRoutes(app: any) {
  // ── Lijst beheerbare instrumenten + hun vlag ──────────────────────────────
  app.get("/api/admin/beschikbaarheid", requirePrior, async (_req: Request, res: Response) => {
    res.json({ instrumenten: getBeschikbaarheidInstrumenten() });
  });

  // ── Zet de vrijgave-vlag voor één instrument ──────────────────────────────
  app.put("/api/admin/beschikbaarheid/:instrument", requirePrior, async (req: Request, res: Response) => {
    const instrument = req.params.instrument as string;
    if (!BEKENDE_IDS.has(instrument)) {
      return res.status(404).json({ error: "Onbekend instrument." });
    }
    const beschikbaar = (req.body as any)?.beschikbaar === true;
    const beheerder = (req as any).beheerder;
    const ok = setBeschikbaar(instrument, beschikbaar, beheerder.email);
    if (!ok) return res.status(500).json({ error: "Opslaan mislukt." });
    res.json({ ok: true, instrument, beschikbaar: isInstrumentBeschikbaar(instrument) });
  });
}
