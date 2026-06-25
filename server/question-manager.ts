/**
 * Question Manager — prior-beheerder beheert vragen van alle instrumenten
 *
 * Architectuur:
 *  - Vragen worden LIVE uit instrument.json geladen (en teamscan/itembank.json).
 *  - Aanpassingen worden opgeslagen in een SQLite-tabel `vraag_overschrijvingen`.
 *  - Bij elke afname wordt eerst gekeken of er een override bestaat; zo ja, wint
 *    die boven de originele tekst — volledig transparant voor de scorer.
 *  - Beveiliging: enkel is_prior=true beheerders mogen lezen + schrijven.
 *  - Audit trail: elke wijziging slaat wie + wanneer op.
 *
 * Ondersteunde instrumenten:
 *   tapas-t4p         → server/data/instrument.json  (T4P Business Kompas)
 *   tapas-teamscan    → server/teamscan/itembank.json
 *
 * Talen: nl, fr, en, es, ru
 */

import { Router, type Request, type Response } from "express";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { eq, and } from "drizzle-orm";
import { storage, db } from "./storage";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VraagItem {
  itemId: string;       // bijv. "1.1" of "teamscan-b1-1"
  instrument: string;   // "tapas-t4p" | "tapas-teamscan" | ...
  family?: string;
  construct?: string;
  tekst: Record<string, string>;  // { nl, fr, en, es, ru }
  heeftOverride: boolean;
  origineel?: Record<string, string>;
}

// ─── Helper: prior-check middleware ──────────────────────────────────────────

async function requirePrior(req: Request, res: Response, next: Function) {
  const adminId = (req.session as any)?.adminId;
  if (!adminId) return res.status(401).json({ error: "Niet ingelogd." });
  const beheerder = await storage.getBeheerder(Number(adminId));
  if (!beheerder || !beheerder.isPrior) {
    return res.status(403).json({ error: "Enkel prior-beheerders kunnen vragen beheren." });
  }
  (req as any).beheerder = beheerder;
  next();
}

// ─── Items laden uit de ruwe JSON-bestanden ───────────────────────────────────

function laadT4PItems(): VraagItem[] {
  try {
    const pad = join(process.cwd(), "server/data/instrument.json");
    const data = JSON.parse(readFileSync(pad, "utf-8"));
    const items: VraagItem[] = [];
    for (const sec of data.sections ?? []) {
      for (const block of sec.blocks ?? []) {
        for (const item of block.items ?? []) {
          const tekst: Record<string, string> = {};
          if (typeof item.text === "string") {
            tekst.nl = item.text;
          } else {
            Object.assign(tekst, item.text ?? {});
          }
          items.push({
            itemId: item.id ?? `${block.blockIndex}-${item.pos}`,
            instrument: "tapas-t4p",
            family: item.family,
            construct: item.construct,
            tekst,
            heeftOverride: false,
          });
        }
      }
    }
    // Verbindingsvragen (deel 2)
    for (const cq of data.connectionQuestions ?? []) {
      const tekst: Record<string, string> = {};
      if (typeof cq.text === "string") tekst.nl = cq.text;
      else Object.assign(tekst, cq.text ?? {});
      items.push({
        itemId: `deel2-${cq.id}`,
        instrument: "tapas-t4p",
        family: "Verbindingsvragen",
        construct: cq.scale,
        tekst,
        heeftOverride: false,
      });
    }
    return items;
  } catch (e) {
    console.error("[QM] Fout bij laden T4P items:", e);
    return [];
  }
}

function laadTeamscanItems(): VraagItem[] {
  try {
    const pad = join(process.cwd(), "server/teamscan/itembank.json");
    const data = JSON.parse(readFileSync(pad, "utf-8"));
    const items: VraagItem[] = [];
    for (const blok of data.blokken ?? []) {
      for (const item of blok.items ?? []) {
        const tekst: Record<string, string> = {};
        if (typeof item.tekst === "string") tekst.nl = item.tekst;
        else Object.assign(tekst, item.tekst ?? {});
        items.push({
          itemId: `ts-${blok.blokId ?? blok.id}-${item.id}`,
          instrument: "tapas-teamscan",
          family: blok.pijler ?? blok.naam ?? "Teamscan",
          construct: item.construct ?? item.dimensie,
          tekst,
          heeftOverride: false,
        });
      }
    }
    return items;
  } catch (e) {
    console.error("[QM] Fout bij laden Teamscan items:", e);
    return [];
  }
}

// ─── SQLite voor overschrijvingen (lazy init) ─────────────────────────────────

function ensureOverrideTable() {
  try {
    const sqlite = (db as any)._db ?? (storage as any).sqlite;
    if (sqlite) {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS vraag_overschrijvingen (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          instrument TEXT NOT NULL,
          item_id TEXT NOT NULL,
          taal TEXT NOT NULL,
          tekst TEXT NOT NULL,
          gewijzigd_door TEXT NOT NULL,
          gewijzigd_op TEXT NOT NULL,
          UNIQUE(instrument, item_id, taal)
        )
      `);
    }
  } catch (e) {
    console.error("[QM] Tabel aanmaken mislukt:", e);
  }
}

function getOverrides(instrument: string): Map<string, Record<string, string>> {
  ensureOverrideTable();
  const result = new Map<string, Record<string, string>>();
  try {
    const sqlite = (db as any)._db ?? (storage as any).sqlite;
    if (!sqlite) return result;
    const rows = sqlite.prepare(
      "SELECT item_id, taal, tekst FROM vraag_overschrijvingen WHERE instrument = ?"
    ).all(instrument) as { item_id: string; taal: string; tekst: string }[];
    for (const row of rows) {
      if (!result.has(row.item_id)) result.set(row.item_id, {});
      result.get(row.item_id)![row.taal] = row.tekst;
    }
  } catch {}
  return result;
}

function saveOverride(
  instrument: string,
  itemId: string,
  taal: string,
  tekst: string,
  gewijzigdDoor: string
) {
  ensureOverrideTable();
  try {
    const sqlite = (db as any)._db ?? (storage as any).sqlite;
    if (!sqlite) throw new Error("geen sqlite");
    const now = new Date().toISOString();
    sqlite.prepare(`
      INSERT INTO vraag_overschrijvingen (instrument, item_id, taal, tekst, gewijzigd_door, gewijzigd_op)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(instrument, item_id, taal) DO UPDATE SET
        tekst = excluded.tekst,
        gewijzigd_door = excluded.gewijzigd_door,
        gewijzigd_op = excluded.gewijzigd_op
    `).run(instrument, itemId, taal, tekst, gewijzigdDoor, now);
    return true;
  } catch (e) {
    console.error("[QM] Override opslaan mislukt:", e);
    return false;
  }
}

function deleteOverride(instrument: string, itemId: string, taal: string) {
  ensureOverrideTable();
  try {
    const sqlite = (db as any)._db ?? (storage as any).sqlite;
    if (!sqlite) return false;
    sqlite.prepare(
      "DELETE FROM vraag_overschrijvingen WHERE instrument = ? AND item_id = ? AND taal = ?"
    ).run(instrument, itemId, taal);
    return true;
  } catch { return false; }
}

function getAuditLog(instrument: string, itemId: string) {
  ensureOverrideTable();
  try {
    const sqlite = (db as any)._db ?? (storage as any).sqlite;
    if (!sqlite) return [];
    return sqlite.prepare(
      "SELECT taal, tekst, gewijzigd_door, gewijzigd_op FROM vraag_overschrijvingen WHERE instrument = ? AND item_id = ? ORDER BY gewijzigd_op DESC"
    ).all(instrument, itemId);
  } catch { return []; }
}

// ─── Route builder ────────────────────────────────────────────────────────────

export function buildQuestionManagerRoutes(app: any) {
  // Lijst alle vragen op voor een instrument
  app.get("/api/admin/vraagbeheer/:instrument", requirePrior, async (req: Request, res: Response) => {
    const { instrument } = req.params;
    const zoek = (req.query.q as string ?? "").toLowerCase();
    const taalFilter = (req.query.taal as string ?? "");

    let items: VraagItem[] = [];
    if (instrument === "tapas-t4p") items = laadT4PItems();
    else if (instrument === "tapas-teamscan") items = laadTeamscanItems();
    else return res.status(404).json({ error: "Onbekend instrument." });

    const overrides = getOverrides(instrument);

    // Overrides mergen
    for (const item of items) {
      const ov = overrides.get(item.itemId);
      if (ov && Object.keys(ov).length > 0) {
        item.origineel = { ...item.tekst };
        Object.assign(item.tekst, ov);
        item.heeftOverride = true;
      }
    }

    // Zoekfilter
    let gefilterd = items;
    if (zoek) {
      gefilterd = items.filter(it =>
        Object.values(it.tekst).some(t => t.toLowerCase().includes(zoek)) ||
        (it.construct ?? "").toLowerCase().includes(zoek) ||
        (it.family ?? "").toLowerCase().includes(zoek) ||
        it.itemId.toLowerCase().includes(zoek)
      );
    }

    res.json({
      instrument,
      totaal: items.length,
      aantalOverrides: items.filter(i => i.heeftOverride).length,
      items: gefilterd,
    });
  });

  // Sla één override op voor één taal
  app.put("/api/admin/vraagbeheer/:instrument/:itemId", requirePrior, async (req: Request, res: Response) => {
    const instrument = req.params.instrument as string;
    const itemId = req.params.itemId as string;
    const { taal, tekst } = req.body as { taal: string; tekst: string };
    const beheerder = (req as any).beheerder;

    if (!taal || !tekst?.trim()) {
      return res.status(400).json({ error: "taal en tekst zijn verplicht." });
    }
    const geldige_talen = ["nl", "fr", "en", "es", "ru"];
    if (!geldige_talen.includes(taal)) {
      return res.status(400).json({ error: `Ongeldige taal. Kies uit: ${geldige_talen.join(", ")}` });
    }

    const ok = saveOverride(instrument, itemId, taal, tekst.trim(), beheerder.email);
    if (!ok) return res.status(500).json({ error: "Opslaan mislukt." });

    res.json({ ok: true, instrument, itemId, taal, tekst: tekst.trim() });
  });

  // Herstel originele tekst (verwijder override voor één taal)
  app.delete("/api/admin/vraagbeheer/:instrument/:itemId/:taal", requirePrior, async (req: Request, res: Response) => {
    const instrument = req.params.instrument as string;
    const itemId = req.params.itemId as string;
    const taal = req.params.taal as string;
    const ok = deleteOverride(instrument, itemId, taal);
    res.json({ ok, instrument, itemId, taal });
  });

  // Audit log voor één item
  app.get("/api/admin/vraagbeheer/:instrument/:itemId/log", requirePrior, async (req: Request, res: Response) => {
    const instrument = req.params.instrument as string;
    const itemId = req.params.itemId as string;
    const log = getAuditLog(instrument, itemId);
    res.json({ instrument, itemId, log });
  });
}

// ─── Export: override ophalen (voor gebruik in scoring/afname) ────────────────

export function getVraagTekst(instrument: string, itemId: string, taal: string, origineel: string): string {
  const overrides = getOverrides(instrument);
  const ov = overrides.get(itemId);
  if (ov && ov[taal]) return ov[taal];
  return origineel;
}
