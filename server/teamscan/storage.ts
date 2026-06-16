import {
  teamscanSessies as sessies,
  teamscanDeelnemers as deelnemers,
  teamscanAntwoorden as antwoorden,
} from "./schema";
import type {
  TeamscanSessie,
  InsertTeamscanSessie,
  TeamscanDeelnemer,
  TeamscanAntwoorden,
  TeamscanAntwoordenInhoud,
} from "./schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";

/**
 * TaPas Teamscan-storage.
 * ------------------------------------------------------------------
 * Eigen better-sqlite3-handle op hetzelfde data.db-bestand als het
 * platform (WAL laat meerdere handles toe). Tabellen krijgen het prefix
 * teamscan_ en botsen niet met de platform- of t4r-tabellen.
 */

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

sqlite.exec(`
CREATE TABLE IF NOT EXISTS teamscan_sessies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_naam TEXT NOT NULL,
  org_label TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  platform_sessie_id INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS teamscan_deelnemers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessie_id INTEGER NOT NULL,
  token TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  afgerond INTEGER NOT NULL DEFAULT 0,
  afgerond_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS teamscan_antwoorden (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deelnemer_id INTEGER NOT NULL,
  fundament TEXT NOT NULL,
  lencioni TEXT NOT NULL,
  vertrouwen_ranking TEXT NOT NULL,
  vertrouwen_prestatie TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_teamscan_deelnemers_sessie ON teamscan_deelnemers(sessie_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_teamscan_deelnemers_token ON teamscan_deelnemers(token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_teamscan_antwoorden_deelnemer ON teamscan_antwoorden(deelnemer_id);
`);

const db = drizzle(sqlite);

function token(len = 24): string {
  return randomBytes(Math.ceil(len * 0.75))
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, len);
}

export class TeamscanStorage {
  // ---- Sessies -------------------------------------------------------------
  maakSessie(data: InsertTeamscanSessie, platformSessieId?: number): TeamscanSessie {
    const row = db
      .insert(sessies)
      .values({
        teamNaam: data.teamNaam,
        orgLabel: data.orgLabel ?? "",
        status: "open",
        platformSessieId: platformSessieId ?? null,
        createdAt: Date.now(),
      })
      .returning()
      .get();
    return row;
  }

  getSessie(id: number): TeamscanSessie | undefined {
    return db.select().from(sessies).where(eq(sessies.id, id)).get();
  }

  alleSessies(): TeamscanSessie[] {
    return db.select().from(sessies).all();
  }

  sluitSessie(id: number): TeamscanSessie | undefined {
    return db
      .update(sessies)
      .set({ status: "gesloten" })
      .where(eq(sessies.id, id))
      .returning()
      .get();
  }

  // ---- Deelnemers ----------------------------------------------------------
  maakDeelnemer(sessieId: number, label = ""): TeamscanDeelnemer {
    const row = db
      .insert(deelnemers)
      .values({
        sessieId,
        token: token(),
        label,
        afgerond: false,
        afgerondAt: null,
        createdAt: Date.now(),
      })
      .returning()
      .get();
    return row;
  }

  getDeelnemerViaToken(t: string): TeamscanDeelnemer | undefined {
    return db.select().from(deelnemers).where(eq(deelnemers.token, t)).get();
  }

  getDeelnemer(id: number): TeamscanDeelnemer | undefined {
    return db.select().from(deelnemers).where(eq(deelnemers.id, id)).get();
  }

  deelnemersVanSessie(sessieId: number): TeamscanDeelnemer[] {
    return db.select().from(deelnemers).where(eq(deelnemers.sessieId, sessieId)).all();
  }

  markeerAfgerond(deelnemerId: number): void {
    db.update(deelnemers)
      .set({ afgerond: true, afgerondAt: Date.now() })
      .where(eq(deelnemers.id, deelnemerId))
      .run();
  }

  // ---- Antwoorden ----------------------------------------------------------
  bewaarAntwoorden(deelnemerId: number, inhoud: TeamscanAntwoordenInhoud): TeamscanAntwoorden {
    // Eén set antwoorden per deelnemer: bestaande overschrijven.
    const bestaand = db
      .select()
      .from(antwoorden)
      .where(eq(antwoorden.deelnemerId, deelnemerId))
      .get();
    if (bestaand) {
      db.delete(antwoorden).where(eq(antwoorden.deelnemerId, deelnemerId)).run();
    }
    const row = db
      .insert(antwoorden)
      .values({
        deelnemerId,
        fundament: JSON.stringify(inhoud.fundament),
        lencioni: JSON.stringify(inhoud.lencioni),
        vertrouwenRanking: JSON.stringify(inhoud.vertrouwenRanking),
        vertrouwenPrestatie: JSON.stringify(inhoud.vertrouwenPrestatie),
        createdAt: Date.now(),
      })
      .returning()
      .get();
    this.markeerAfgerond(deelnemerId);
    return row;
  }

  getAntwoorden(deelnemerId: number): TeamscanAntwoordenInhoud | undefined {
    const row = db
      .select()
      .from(antwoorden)
      .where(eq(antwoorden.deelnemerId, deelnemerId))
      .get();
    if (!row) return undefined;
    return {
      fundament: JSON.parse(row.fundament),
      lencioni: JSON.parse(row.lencioni),
      vertrouwenRanking: JSON.parse(row.vertrouwenRanking),
      vertrouwenPrestatie: JSON.parse(row.vertrouwenPrestatie),
    };
  }

  // Alle afgeronde antwoorden van een sessie (voor teamaggregatie).
  afgerondeAntwoordenVanSessie(sessieId: number): TeamscanAntwoordenInhoud[] {
    const ds = this.deelnemersVanSessie(sessieId).filter((d) => d.afgerond);
    const resultaat: TeamscanAntwoordenInhoud[] = [];
    for (const d of ds) {
      const a = this.getAntwoorden(d.id);
      if (a) resultaat.push(a);
    }
    return resultaat;
  }
}

export const teamscanStorage = new TeamscanStorage();
