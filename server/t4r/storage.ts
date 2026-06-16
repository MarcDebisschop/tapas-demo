import {
  t4rSessions as sessions,
  t4rStakeholders as stakeholders,
  t4rAnswers as answers,
  t4rAuditEvents as auditEvents,
  t4rCandidateReports as candidateReports,
  t4rChat as chat,
} from "./schema";
import type {
  Session,
  InsertSession,
  Stakeholder,
  InsertStakeholder,
  Answer,
  UpsertAnswer,
  AuditEvent,
  CandidateReport,
  SaveCandidateReport,
  T4rChatBericht,
} from "./schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and } from "drizzle-orm";

/**
 * T4Recruitment-storage (ingeplugde versie).
 * ------------------------------------------------------------------
 * Eén-op-één overgenomen uit de canonieke stand-alone app
 * (t4r_src/server/storage.ts). De ENIGE wijzigingen t.o.v. de bron:
 *   • Tabelnamen krijgen het prefix t4r_ (botst niet met platformtabellen).
 *   • De storage deelt hetzelfde data.db-bestand als het platform, via een
 *     eigen better-sqlite3-handle op datzelfde bestand (WAL laat meerdere
 *     handles toe). Zo blijft alles in één database, zonder de platformcode
 *     te raken.
 *   • createSession ondersteunt een optioneel platformSessieId (koppeling
 *     naar de Fase 2 credit-/collaboratielaag). De beslislogica blijft gelijk.
 */

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

sqlite.exec(`
CREATE TABLE IF NOT EXISTS t4r_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  function_title TEXT NOT NULL,
  org_label TEXT NOT NULL,
  role_type TEXT NOT NULL,
  role_level TEXT NOT NULL,
  fill_mode TEXT NOT NULL,
  end_moment TEXT NOT NULL,
  context_version TEXT NOT NULL DEFAULT 'v1',
  status TEXT NOT NULL DEFAULT 'draft',
  closed_ring INTEGER NOT NULL DEFAULT 0,
  platform_sessie_id INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS t4r_stakeholders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  stakeholder_role TEXT NOT NULL,
  system_role TEXT NOT NULL DEFAULT 'stakeholder',
  voting INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS t4r_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  classification TEXT,
  context_value TEXT,
  critical INTEGER NOT NULL DEFAULT 0,
  rank INTEGER,
  note TEXT,
  conflict INTEGER NOT NULL DEFAULT 0,
  final_decision TEXT,
  final_reason TEXT,
  updated_by INTEGER,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS t4r_audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  event TEXT NOT NULL,
  detail TEXT,
  at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS t4r_candidate_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  candidate_label TEXT NOT NULL,
  source_file TEXT,
  metingen TEXT NOT NULL DEFAULT '{}',
  context TEXT NOT NULL DEFAULT '{}',
  raw_text TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  decision TEXT,
  decision_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS t4r_chat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  rol TEXT NOT NULL,
  inhoud TEXT NOT NULL,
  veiligheid TEXT,
  created_at INTEGER NOT NULL
);
`);

// Idempotente migratie: 'rank' en 'platform_sessie_id' op reeds bestaande tabellen.
try { sqlite.exec("ALTER TABLE t4r_answers ADD COLUMN rank INTEGER"); } catch { /* bestaat al */ }
try { sqlite.exec("ALTER TABLE t4r_sessions ADD COLUMN platform_sessie_id INTEGER"); } catch { /* bestaat al */ }
try { sqlite.exec("ALTER TABLE t4r_sessions ADD COLUMN chat_gebruikt INTEGER NOT NULL DEFAULT 0"); } catch { /* bestaat al */ }
try { sqlite.exec("ALTER TABLE t4r_sessions ADD COLUMN chat_tegoed INTEGER NOT NULL DEFAULT 0"); } catch { /* bestaat al */ }

export const t4rDb = drizzle(sqlite);

export interface IT4RStorage {
  createSession(data: InsertSession, platformSessieId?: number): Promise<Session>;
  getSession(id: number): Promise<Session | undefined>;
  listSessions(): Promise<Session[]>;
  updateSession(id: number, patch: Partial<Session>): Promise<Session | undefined>;
  getByPlatformSessie(platformSessieId: number): Promise<Session | undefined>;

  addStakeholder(data: InsertStakeholder): Promise<Stakeholder>;
  listStakeholders(sessionId: number): Promise<Stakeholder[]>;
  removeStakeholder(id: number): Promise<void>;

  upsertAnswer(data: UpsertAnswer): Promise<Answer>;
  listAnswers(sessionId: number): Promise<Answer[]>;

  addAudit(sessionId: number, event: string, detail?: string): Promise<void>;
  listAudit(sessionId: number): Promise<AuditEvent[]>;

  getCandidateReport(sessionId: number): Promise<CandidateReport | undefined>;
  saveCandidateReport(data: SaveCandidateReport): Promise<CandidateReport>;

  listChatBerichten(sessionId: number): Promise<T4rChatBericht[]>;
  voegChatBerichtToe(sessionId: number, rol: string, inhoud: string, veiligheid?: string | null): Promise<T4rChatBericht>;
  verhoogChatGebruikt(sessionId: number): Promise<void>;
  voegChatTegoedToe(sessionId: number, aantal: number): Promise<Session | undefined>;
}

export class T4RDatabaseStorage implements IT4RStorage {
  async createSession(data: InsertSession, platformSessieId?: number): Promise<Session> {
    const row = t4rDb
      .insert(sessions)
      .values({ ...data, platformSessieId: platformSessieId ?? null, createdAt: Date.now() })
      .returning()
      .get();
    await this.addAudit(row.id, "Sessie aangemaakt", `${data.functionTitle} — ${data.orgLabel}`);
    return row;
  }

  async getSession(id: number): Promise<Session | undefined> {
    return t4rDb.select().from(sessions).where(eq(sessions.id, id)).get();
  }

  async listSessions(): Promise<Session[]> {
    return t4rDb.select().from(sessions).all();
  }

  async updateSession(id: number, patch: Partial<Session>): Promise<Session | undefined> {
    t4rDb.update(sessions).set(patch).where(eq(sessions.id, id)).run();
    return this.getSession(id);
  }

  async getByPlatformSessie(platformSessieId: number): Promise<Session | undefined> {
    return t4rDb.select().from(sessions).where(eq(sessions.platformSessieId, platformSessieId)).get();
  }

  async addStakeholder(data: InsertStakeholder): Promise<Stakeholder> {
    return t4rDb.insert(stakeholders).values(data).returning().get();
  }

  async listStakeholders(sessionId: number): Promise<Stakeholder[]> {
    return t4rDb.select().from(stakeholders).where(eq(stakeholders.sessionId, sessionId)).all();
  }

  async removeStakeholder(id: number): Promise<void> {
    t4rDb.delete(stakeholders).where(eq(stakeholders.id, id)).run();
  }

  async upsertAnswer(data: UpsertAnswer): Promise<Answer> {
    const existing = t4rDb
      .select()
      .from(answers)
      .where(and(eq(answers.sessionId, data.sessionId), eq(answers.itemId, data.itemId)))
      .get();

    const patch = {
      classification: data.classification ?? existing?.classification ?? null,
      contextValue: data.contextValue ?? existing?.contextValue ?? null,
      critical: data.critical ?? existing?.critical ?? false,
      rank: data.rank ?? existing?.rank ?? null,
      note: data.note ?? existing?.note ?? null,
      conflict: data.conflict ?? existing?.conflict ?? false,
      finalDecision: data.finalDecision ?? existing?.finalDecision ?? null,
      finalReason: data.finalReason ?? existing?.finalReason ?? null,
      updatedBy: data.updatedBy ?? existing?.updatedBy ?? null,
      updatedAt: Date.now(),
    };

    if (existing) {
      t4rDb.update(answers).set(patch).where(eq(answers.id, existing.id)).run();
      return t4rDb.select().from(answers).where(eq(answers.id, existing.id)).get()!;
    }
    return t4rDb
      .insert(answers)
      .values({ sessionId: data.sessionId, itemId: data.itemId, ...patch })
      .returning()
      .get();
  }

  async listAnswers(sessionId: number): Promise<Answer[]> {
    return t4rDb.select().from(answers).where(eq(answers.sessionId, sessionId)).all();
  }

  async addAudit(sessionId: number, event: string, detail?: string): Promise<void> {
    t4rDb.insert(auditEvents).values({ sessionId, event, detail: detail ?? null, at: Date.now() }).run();
  }

  async listAudit(sessionId: number): Promise<AuditEvent[]> {
    return t4rDb.select().from(auditEvents).where(eq(auditEvents.sessionId, sessionId)).all();
  }

  async getCandidateReport(sessionId: number): Promise<CandidateReport | undefined> {
    return t4rDb.select().from(candidateReports).where(eq(candidateReports.sessionId, sessionId)).get();
  }

  async saveCandidateReport(data: SaveCandidateReport): Promise<CandidateReport> {
    const existing = t4rDb
      .select()
      .from(candidateReports)
      .where(eq(candidateReports.sessionId, data.sessionId))
      .get();

    const patch = {
      candidateLabel: data.candidateLabel,
      sourceFile: data.sourceFile ?? existing?.sourceFile ?? null,
      metingen: JSON.stringify(data.metingen ?? {}),
      context: JSON.stringify(data.context ?? {}),
      rawText: data.rawText ?? existing?.rawText ?? null,
      verified: data.verified ?? existing?.verified ?? false,
      decision: data.decision ?? existing?.decision ?? null,
      decisionReason: data.decisionReason ?? existing?.decisionReason ?? null,
      updatedAt: Date.now(),
    };

    if (existing) {
      t4rDb.update(candidateReports).set(patch).where(eq(candidateReports.id, existing.id)).run();
      return t4rDb.select().from(candidateReports).where(eq(candidateReports.id, existing.id)).get()!;
    }
    return t4rDb
      .insert(candidateReports)
      .values({ sessionId: data.sessionId, ...patch, createdAt: Date.now() })
      .returning()
      .get();
  }

  // ---- Eindrapport-chatbot (recruiter-only) -------------------------------
  async listChatBerichten(sessionId: number): Promise<T4rChatBericht[]> {
    return t4rDb.select().from(chat).where(eq(chat.sessionId, sessionId)).all();
  }

  async voegChatBerichtToe(
    sessionId: number,
    rol: string,
    inhoud: string,
    veiligheid?: string | null,
  ): Promise<T4rChatBericht> {
    return t4rDb
      .insert(chat)
      .values({ sessionId, rol, inhoud, veiligheid: veiligheid ?? null, createdAt: Date.now() })
      .returning()
      .get();
  }

  async verhoogChatGebruikt(sessionId: number): Promise<void> {
    const s = await this.getSession(sessionId);
    if (!s) return;
    t4rDb.update(sessions).set({ chatGebruikt: (s.chatGebruikt ?? 0) + 1 }).where(eq(sessions.id, sessionId)).run();
  }

  async voegChatTegoedToe(sessionId: number, aantal: number): Promise<Session | undefined> {
    const s = await this.getSession(sessionId);
    if (!s) return undefined;
    t4rDb.update(sessions).set({ chatTegoed: (s.chatTegoed ?? 0) + aantal }).where(eq(sessions.id, sessionId)).run();
    return this.getSession(sessionId);
  }
}

export const t4rStorage = new T4RDatabaseStorage();
