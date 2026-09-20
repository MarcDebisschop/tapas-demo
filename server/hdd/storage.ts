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
import {
  teamscanSessies,
  teamscanDeelnemers,
  teamscanAntwoorden,
} from "../teamscan/schema";
import type {
  TeamscanDeelnemer,
  TeamscanAntwoordenInhoud,
} from "../teamscan/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, inArray } from "drizzle-orm";
import { randomBytes } from "crypto";
import { pasEncryptieToe } from "../db-encryptie";
import { vindDatabasePad } from "../db-pad";

/**
 * Human Due Diligence-storage.
 * ------------------------------------------------------------------
 * Eigen better-sqlite3-handle op hetzelfde data.db-bestand als het platform
 * (WAL laat meerdere handles toe). Tabellen krijgen het prefix hdd_ en botsen
 * niet met de platform-, t4r- of teamscan-tabellen.
 *
 * Een HDD-traject bewaart per board member enkel de tokens van de onderliggende
 * instrumenten; de meet-/antwoorddata leeft in die instrumenten zelf.
 *
 * Waarom staan de Teamscan-hulpjes onderaan dit bestand en niet in
 * server/teamscan/storage.ts? Om de invoerketen kort te houden: HDD zou anders
 * de volledige Teamscan-module moeten inladen enkel om drie rijen te schrijven.
 * Beide handles wijzen wel naar hetzelfde databestand, want elke opslagmodule
 * opent vindDatabasePad() en volgt dus TAPAS_DB_PATH; tests/hdd-databestand.test.ts
 * houdt dat vast. Het Teamscan-schema blijft de enige waarheid over de kolommen
 * (geen tweede DDL, geen tweede scoringslogica: scoren gebeurt in
 * server/teamscan/scoring.ts).
 */

const sqlite = new Database(vindDatabasePad());
// FIX 6 (AVG art. 32): dezelfde encryptie-hook als in storage.ts. Bij Optie B
// moet ELKE handle de sleutel toepassen; eén handle die het vergeet opent het
// bestand zonder sleutel. No-op zolang TAPAS_DB_SLEUTEL niet gezet is.
pasEncryptieToe(sqlite, "server/hdd/storage.ts");
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
  teamscan_sessie_id INTEGER,
  credits_geboekt INTEGER NOT NULL DEFAULT 0,
  credits_geboekt_op TEXT,
  platform_sessie_id INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS hdd_board_leden (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  traject_id INTEGER NOT NULL,
  naam TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  instrument_tokens TEXT NOT NULL DEFAULT '{}',
  rapport_vrijgave_op INTEGER,
  rapport_vrijgave_door TEXT,
  created_at INTEGER NOT NULL
);
`);

// Bestaande databestanden kregen hun hdd_trajecten voor deze kolommen bestonden.
// CREATE TABLE IF NOT EXISTS voegt niets toe aan een tabel die er al is, dus de
// kolommen worden hier los bijgezet. Idempotent: enkel wat nog ontbreekt.
function vulKolomAan(tabel: string, kolom: string, definitie: string): void {
  const aanwezig = sqlite
    .prepare(`PRAGMA table_info(${tabel})`)
    .all() as Array<{ name: string }>;
  if (aanwezig.some((k) => k.name === kolom)) return;
  sqlite.exec(`ALTER TABLE ${tabel} ADD COLUMN ${kolom} ${definitie}`);
}
vulKolomAan("hdd_trajecten", "teamscan_sessie_id", "INTEGER");
vulKolomAan("hdd_trajecten", "credits_geboekt", "INTEGER NOT NULL DEFAULT 0");
vulKolomAan("hdd_trajecten", "credits_geboekt_op", "TEXT");
// De rapportsluis kwam later dan de eerste trajecten. Bestaande leden krijgen
// hier een lege vrijgave, en een lege vrijgave betekent: dicht. Dat is de
// veilige kant, ook voor trajecten die al liepen.
vulKolomAan("hdd_board_leden", "rapport_vrijgave_op", "INTEGER");
vulKolomAan("hdd_board_leden", "rapport_vrijgave_door", "TEXT");

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
      teamscanSessieId: null as number | null,
      creditsGeboekt: 0,
      creditsGeboektOp: null as string | null,
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

  // Koppelt de Teamscan-sessie aan het traject (eenmalig, bij start fase 1).
  setTeamscanSessie(id: number, sessieId: number): void {
    db.update(trajecten)
      .set({ teamscanSessieId: sessieId })
      .where(eq(trajecten.id, id))
      .run();
  },

  // Legt vast dat de trajectprijs afgeboekt is. Wordt alleen aangeroepen nadat
  // de afboeking gelukt is; de routekant leest creditsGeboekt eerst en boekt
  // niets meer als er al iets staat.
  markeerCreditsGeboekt(id: number, credits: number): void {
    db.update(trajecten)
      .set({ creditsGeboekt: credits, creditsGeboektOp: new Date().toISOString() })
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
      // Nieuw lid, sluis dicht. De begeleider geeft later vrij.
      rapportVrijgaveOp: null as number | null,
      rapportVrijgaveDoor: null as string | null,
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

  // Alle leden van alle trajecten. De rapportsluis heeft dit nodig om van een
  // token naar het lid te komen: de tokens staan per lid in een JSON-veld, dus
  // er valt niet op te zoeken in SQL. De tabel bevat één rij per board member
  // per traject en blijft klein.
  alleLeden(): HddBoardLid[] {
    return db.select().from(boardLeden).all();
  },

  getLid(lidId: number): HddBoardLid | undefined {
    return db.select().from(boardLeden).where(eq(boardLeden.id, lidId)).get();
  },

  /**
   * Opent of sluit de rapportsluis voor één lid.
   *
   * Vrijgeven is een daad van de begeleider en geen bijwerking van iets anders,
   * dus het tijdstip en de naam van wie vrijgaf blijven bewaard. Sluiten wist
   * beide velden: dan staat er geen vrijgave meer en is dicht ook echt dicht.
   */
  zetRapportVrijgave(lidId: number, vrij: boolean, door: string | null): void {
    db.update(boardLeden)
      .set({
        rapportVrijgaveOp: vrij ? Date.now() : null,
        rapportVrijgaveDoor: vrij ? (door ?? "") : null,
      })
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

  // ---- Teamscan-rijen op de HDD-handle ------------------------------------
  // Zie de kopnoot: server/teamscan/storage.ts opent een ander bestand dan
  // TAPAS_DB_PATH, dus HDD kan er niet doorheen werken zonder het traject en
  // zijn Teamscan-sessie in twee databestanden te laten landen.

  // Staan de Teamscan-tabellen in dit databestand? Zo niet, dan is er niets te
  // lezen en mag er zeker niets geschreven worden.
  teamscanTabellenAanwezig(): boolean {
    const rij = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'teamscan_deelnemers'",
      )
      .get();
    return Boolean(rij);
  },

  maakTeamscanSessie(teamNaam: string, orgLabel: string, platformSessieId?: number): number {
    const rij = db
      .insert(teamscanSessies)
      .values({
        teamNaam,
        orgLabel,
        status: "open",
        platformSessieId: platformSessieId ?? null,
        createdAt: Date.now(),
      })
      .returning()
      .get();
    return rij.id;
  },

  getTeamscanSessie(id: number) {
    return db.select().from(teamscanSessies).where(eq(teamscanSessies.id, id)).get();
  },

  // Zelfde tokenlengte en -alfabet als server/teamscan/storage.ts: 24 tekens
  // url-veilige base64 uit crypto.randomBytes.
  maakTeamscanDeelnemer(sessieId: number, label: string): TeamscanDeelnemer {
    const token = randomBytes(18).toString("base64url").slice(0, 24);
    return db
      .insert(teamscanDeelnemers)
      .values({
        sessieId,
        token,
        label,
        afgerond: false,
        afgerondAt: null,
        createdAt: Date.now(),
      })
      .returning()
      .get();
  },

  getTeamscanDeelnemerViaToken(token: string): TeamscanDeelnemer | undefined {
    return db
      .select()
      .from(teamscanDeelnemers)
      .where(eq(teamscanDeelnemers.token, token))
      .get();
  },

  teamscanDeelnemersVanSessie(sessieId: number): TeamscanDeelnemer[] {
    return db
      .select()
      .from(teamscanDeelnemers)
      .where(eq(teamscanDeelnemers.sessieId, sessieId))
      .all();
  },

  // De ingevulde antwoorden van een deelnemer, in het contract van het
  // Teamscan-schema. Null zolang de deelnemer niets bewaarde.
  getTeamscanAntwoorden(deelnemerId: number): TeamscanAntwoordenInhoud | null {
    const rij = db
      .select()
      .from(teamscanAntwoorden)
      .where(eq(teamscanAntwoorden.deelnemerId, deelnemerId))
      .all()
      .at(-1);
    if (!rij) return null;
    try {
      return {
        fundament: JSON.parse(rij.fundament),
        lencioni: JSON.parse(rij.lencioni),
        vertrouwenRanking: JSON.parse(rij.vertrouwenRanking),
        vertrouwenPrestatie: JSON.parse(rij.vertrouwenPrestatie),
      };
    } catch {
      return null;
    }
  },

  // Handig voor de voortgangsroute: welke deelnemer-ids hebben antwoorden?
  teamscanDeelnemersMetAntwoorden(deelnemerIds: number[]): Set<number> {
    if (!deelnemerIds.length) return new Set();
    const rijen = db
      .select({ deelnemerId: teamscanAntwoorden.deelnemerId })
      .from(teamscanAntwoorden)
      .where(inArray(teamscanAntwoorden.deelnemerId, deelnemerIds))
      .all();
    return new Set(rijen.map((r) => r.deelnemerId));
  },
};
