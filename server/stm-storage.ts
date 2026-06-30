// =============================================================================
// stm-storage.ts — SQLite persistentie voor STM-sessies
//
// Aangemaakt: 2026-06-30 (Fase 2, NP-4)
//
// Probleem: routes-stm.ts sloeg STM-sessiedata op in in-memory Maps.
// Bij elke server-herstart gingen alle trainingshistorieken verloren.
//
// Oplossing: aparte SQLite database (data.db, gedeeld met hoofdapp via WAL)
// met een dedicated tabel stm_sessies. Zelfde patroon als t4r/storage.ts.
//
// Exports:
//   stmDb       — sqlite handle voor raw queries
//   stmSessieOpslagen — CRUD helpers
// =============================================================================

import Database from "better-sqlite3";
import { join } from "node:path";

// Gebruik dezelfde data.db als de hoofdapp (WAL laat meerdere handles toe).
const DB_PAD = join(process.cwd(), "data.db");
const stmDb = new Database(DB_PAD);
stmDb.pragma("journal_mode = WAL");
stmDb.pragma("synchronous = NORMAL");
stmDb.pragma("cache_size = -4000"); // 4 MB voor STM

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

stmDb.exec(`
  CREATE TABLE IF NOT EXISTS stm_sessies (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    beheerder_id INTEGER NOT NULL,
    gestart_at   TEXT    NOT NULL,
    afgerond_at  TEXT,
    score_totaal REAL,
    inschaling   TEXT,
    duur_seconden INTEGER,
    scores_per_laag TEXT NOT NULL DEFAULT '{}',
    feedback     TEXT NOT NULL DEFAULT '[]'
  );
  CREATE INDEX IF NOT EXISTS idx_stm_sessies_beheerder
    ON stm_sessies (beheerder_id);
`);

export { stmDb };

// ---------------------------------------------------------------------------
// Type
// ---------------------------------------------------------------------------

export interface StmSessieRecord {
  id: number;
  beheerder_id: number;
  gestart_at: string;
  afgerond_at: string | null;
  score_totaal: number | null;
  inschaling: string | null;
  duur_seconden: number | null;
  scores_per_laag: Record<string, number>;
  feedback: Array<{ vraag_id: number; correct: boolean; feedback: string }>;
}

// Rij zoals SQLite ze retourneert (JSON-velden als string)
interface StmRij {
  id: number;
  beheerder_id: number;
  gestart_at: string;
  afgerond_at: string | null;
  score_totaal: number | null;
  inschaling: string | null;
  duur_seconden: number | null;
  scores_per_laag: string;
  feedback: string;
}

function rijNaarRecord(r: StmRij): StmSessieRecord {
  return {
    ...r,
    scores_per_laag: JSON.parse(r.scores_per_laag || "{}"),
    feedback: JSON.parse(r.feedback || "[]"),
  };
}

// ---------------------------------------------------------------------------
// CRUD helpers
// ---------------------------------------------------------------------------

export const stmSessieOpslagen = {
  /** Nieuwe lege sessie aanmaken — retourneert het id. */
  maakAan(beheerderId: number): number {
    const res = stmDb
      .prepare(
        `INSERT INTO stm_sessies (beheerder_id, gestart_at, scores_per_laag, feedback)
         VALUES (?, ?, '{}', '[]')`
      )
      .run(beheerderId, new Date().toISOString());
    return res.lastInsertRowid as number;
  },

  /** Ophalen op id. */
  vindOp(id: number): StmSessieRecord | undefined {
    const r = stmDb
      .prepare(`SELECT * FROM stm_sessies WHERE id = ?`)
      .get(id) as StmRij | undefined;
    return r ? rijNaarRecord(r) : undefined;
  },

  /** Ophalen op beheerderId — alleen afgeronde sessies. */
  historiek(beheerderId: number): StmSessieRecord[] {
    const rijen = stmDb
      .prepare(
        `SELECT * FROM stm_sessies
         WHERE beheerder_id = ? AND afgerond_at IS NOT NULL
         ORDER BY afgerond_at DESC`
      )
      .all(beheerderId) as StmRij[];
    return rijen.map(rijNaarRecord);
  },

  /** Alle sessies van een beheerder (ook niet-afgeronde). */
  alleVanBeheerder(beheerderId: number): StmSessieRecord[] {
    const rijen = stmDb
      .prepare(`SELECT * FROM stm_sessies WHERE beheerder_id = ? ORDER BY gestart_at DESC`)
      .all(beheerderId) as StmRij[];
    return rijen.map(rijNaarRecord);
  },

  /** Sessie afronden: scores + feedback opslaan. */
  afronden(
    id: number,
    afgerondAt: string,
    scoreTotaal: number,
    inschaling: string,
    duurSeconden: number | null,
    scoresPerLaag: Record<string, number>,
    feedback: StmSessieRecord["feedback"]
  ): void {
    stmDb
      .prepare(
        `UPDATE stm_sessies SET
           afgerond_at   = ?,
           score_totaal  = ?,
           inschaling    = ?,
           duur_seconden = ?,
           scores_per_laag = ?,
           feedback      = ?
         WHERE id = ?`
      )
      .run(
        afgerondAt,
        scoreTotaal,
        inschaling,
        duurSeconden,
        JSON.stringify(scoresPerLaag),
        JSON.stringify(feedback),
        id
      );
  },
};
