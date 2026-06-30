import {
  hddTrajecten as trajecten,
  hddBoardLeden as boardLeden,
} from "./schema";
import type {
  HddTraject,
  InsertHddTraject,
  HddBoardLid,
  InsertHddBoardLid,
  GateResultaat,
} from "./schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";

/**
 * Human Due Diligence-storage.
 * ------------------------------------------------------------------
 * Eigen better-sqlite3-handle op hetzelfde data.db-bestand als het platform
 * (WAL laat meerdere handles toe). Tabellen krijgen het prefix hdd_ en botsen
 * niet met de platform-, t4r- of teamscan-tabellen.
 *
 * Een HDD-traject bewaart per board member enkel de tokens van de onderliggende
 * instrumenten; de meet-/antwoorddata leeft in die instrumenten zelf.
 */

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("synchronous = NORMAL");   // NP-5 fix 2026-06-30
sqlite.pragma("cache_size = -8000");     // NP-5 fix 2026-06-30: 8 MB voor HDD

sqlite.exec(`
CREATE TABLE IF NOT EXISTS hdd_trajecten (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_naam TEXT NOT NULL,
  org_label TEXT NOT NULL DEFAULT '',
  context TEXT NOT NULL DEFAULT 'self-screening',
  vereist_stratum INTEGER,
  status TEXT NOT NULL DEFAULT 'fase1_open',
  gate_resultaat TEXT,
  platform_sessie_id INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS hdd_board_leden (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  traject_id INTEGER NOT NULL,
  naam TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  instrument_tokens TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);
`);

const db = drizzle(sqlite);

export const hddStorage = {
  // ---- Trajecten ----------------------------------------------------------
  alleTrajecten(): HddTraject[] {
    return db.select().from(trajecten).all();
  },

  getTraject(id: number): HddTraject | undefined {
    return db.select().from(trajecten).where(eq(trajecten.id, id)).get();
  },

  maakTraject(data: InsertHddTraject, platformSessieId?: number): HddTraject {
    const rij = {
      boardNaam: data.boardNaam,
      orgLabel: data.orgLabel ?? "",
      context: data.context ?? "self-screening",
      vereistStratum: data.vereistStratum ?? null,
      status: "fase1_open",
      gateResultaat: null as string | null,
      platformSessieId: platformSessieId ?? null,
      createdAt: Date.now(),
    };
    const res = db.insert(trajecten).values(rij).returning().get();
    return res;
  },

  setStatus(id: number, status: string): void {
    db.update(trajecten).set({ status }).where(eq(trajecten.id, id)).run();
  },

  setGateResultaat(id: number, gate: GateResultaat): void {
    db.update(trajecten)
      .set({ gateResultaat: JSON.stringify(gate), status: "gate" })
      .where(eq(trajecten.id, id))
      .run();
  },

  getGateResultaat(id: number): GateResultaat | null {
    const t = this.getTraject(id);
    if (!t?.gateResultaat) return null;
    try {
      return JSON.parse(t.gateResultaat) as GateResultaat;
    } catch {
      return null;
    }
  },

  // ---- Board members ------------------------------------------------------
  ledenVanTraject(trajectId: number): HddBoardLid[] {
    return db
      .select()
      .from(boardLeden)
      .where(eq(boardLeden.trajectId, trajectId))
      .all();
  },

  voegLidToe(trajectId: number, data: InsertHddBoardLid): HddBoardLid {
    const rij = {
      trajectId,
      naam: data.naam ?? "",
      email: data.email ?? "",
      instrumentTokens: "{}",
      createdAt: Date.now(),
    };
    return db.insert(boardLeden).values(rij).returning().get();
  },

  // Zet/merge per-instrument tokens voor één board member.
  setTokens(lidId: number, tokens: Record<string, string>): void {
    const lid = db
      .select()
      .from(boardLeden)
      .where(eq(boardLeden.id, lidId))
      .get();
    if (!lid) return;
    let bestaand: Record<string, string> = {};
    try {
      bestaand = JSON.parse(lid.instrumentTokens || "{}");
    } catch {
      bestaand = {};
    }
    const samengevoegd = { ...bestaand, ...tokens };
    db.update(boardLeden)
      .set({ instrumentTokens: JSON.stringify(samengevoegd) })
      .where(eq(boardLeden.id, lidId))
      .run();
  },

  getTokens(lidId: number): Record<string, string> {
    const lid = db
      .select()
      .from(boardLeden)
      .where(eq(boardLeden.id, lidId))
      .get();
    if (!lid) return {};
    try {
      return JSON.parse(lid.instrumentTokens || "{}");
    } catch {
      return {};
    }
  },
};
