import {
  t4oSessies as sessies,
  t4oRespondenten as respondenten,
  t4oAntwoorden as antwoorden,
} from "./schema";
import type {
  T4OSessie,
  InsertT4OSessie,
  T4ORespondent,
  T4OAntwoordenMap,
  T4OGroep,
} from "./schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import { vindDatabasePad } from "../db-pad";

/**
 * TaPas 4 Organizations — storage.
 * ------------------------------------------------------------------
 * Eigen better-sqlite3-handle op hetzelfde data.db-bestand als het
 * platform (WAL laat meerdere handles toe). Tabellen krijgen het prefix
 * t4o_ en botsen niet met de platform-, teamscan- of t4r-tabellen.
 */

// Gedeeld pad (respecteert TAPAS_DB_PATH) — voorkomt split-brain met de hoofd-DB.
const sqlite = new Database(vindDatabasePad());
sqlite.pragma("journal_mode = WAL");

sqlite.exec(`
CREATE TABLE IF NOT EXISTS t4o_sessies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_naam TEXT NOT NULL,
  org_label TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS t4o_respondenten (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessie_id INTEGER NOT NULL,
  token TEXT NOT NULL,
  groep TEXT NOT NULL,
  rank INTEGER NOT NULL,
  afgerond INTEGER NOT NULL DEFAULT 0,
  afgerond_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS t4o_antwoorden (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  respondent_id INTEGER NOT NULL,
  antwoorden TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_t4o_respondenten_sessie ON t4o_respondenten(sessie_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_t4o_respondenten_token ON t4o_respondenten(token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_t4o_antwoorden_respondent ON t4o_antwoorden(respondent_id);
`);

const db = drizzle(sqlite);

function token(len = 24): string {
  return randomBytes(Math.ceil(len * 0.75))
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, len);
}

export type T4ORespondentMetAntwoorden = { groep: T4OGroep; antwoorden: T4OAntwoordenMap };

export class T4OrganizationsStorage {
  // ---- Sessies -------------------------------------------------------------
  maakSessie(data: InsertT4OSessie): T4OSessie {
    return db
      .insert(sessies)
      .values({
        orgNaam: data.orgNaam,
        orgLabel: data.orgLabel ?? "",
        status: "open",
        createdAt: Date.now(),
      })
      .returning()
      .get();
  }

  getSessie(id: number): T4OSessie | undefined {
    return db.select().from(sessies).where(eq(sessies.id, id)).get();
  }

  alleSessies(): T4OSessie[] {
    return db.select().from(sessies).all();
  }

  // ---- Respondenten --------------------------------------------------------
  // Rank loopt oplopend per groep binnen de sessie (respondent 1, 2, ...).
  maakRespondent(sessieId: number, groep: T4OGroep): T4ORespondent {
    const bestaand = db
      .select()
      .from(respondenten)
      .where(and(eq(respondenten.sessieId, sessieId), eq(respondenten.groep, groep)))
      .all();
    const rank = bestaand.length + 1;
    return db
      .insert(respondenten)
      .values({
        sessieId,
        token: token(),
        groep,
        rank,
        afgerond: false,
        afgerondAt: null,
        createdAt: Date.now(),
      })
      .returning()
      .get();
  }

  getRespondentViaToken(t: string): T4ORespondent | undefined {
    return db.select().from(respondenten).where(eq(respondenten.token, t)).get();
  }

  respondentenVanSessie(sessieId: number): T4ORespondent[] {
    return db.select().from(respondenten).where(eq(respondenten.sessieId, sessieId)).all();
  }

  markeerAfgerond(respondentId: number): void {
    db.update(respondenten)
      .set({ afgerond: true, afgerondAt: Date.now() })
      .where(eq(respondenten.id, respondentId))
      .run();
  }

  // ---- Antwoorden ----------------------------------------------------------
  bewaarAntwoorden(respondentId: number, map: T4OAntwoordenMap): void {
    // Eén set antwoorden per respondent: bestaande overschrijven.
    const bestaand = db
      .select()
      .from(antwoorden)
      .where(eq(antwoorden.respondentId, respondentId))
      .get();
    if (bestaand) {
      db.delete(antwoorden).where(eq(antwoorden.respondentId, respondentId)).run();
    }
    db.insert(antwoorden)
      .values({
        respondentId,
        antwoorden: JSON.stringify(map),
        createdAt: Date.now(),
      })
      .run();
    this.markeerAfgerond(respondentId);
  }

  getAntwoorden(respondentId: number): T4OAntwoordenMap | undefined {
    const row = db
      .select()
      .from(antwoorden)
      .where(eq(antwoorden.respondentId, respondentId))
      .get();
    if (!row) return undefined;
    return JSON.parse(row.antwoorden) as T4OAntwoordenMap;
  }

  // Alle afgeronde antwoorden van een sessie, met groep meegeleverd voor
  // ring-aggregatie in de scoringsmotor.
  afgerondeAntwoordenVanSessie(sessieId: number): T4ORespondentMetAntwoorden[] {
    const rs = this.respondentenVanSessie(sessieId).filter((r) => r.afgerond);
    const resultaat: T4ORespondentMetAntwoorden[] = [];
    for (const r of rs) {
      const a = this.getAntwoorden(r.id);
      if (a) resultaat.push({ groep: r.groep as T4OGroep, antwoorden: a });
    }
    return resultaat;
  }
}

export const t4oStorage = new T4OrganizationsStorage();
