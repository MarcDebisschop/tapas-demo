import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * TAPAS 4 Recruitment — datamodel (ingeplugde versie)
 * ------------------------------------------------------------------
 * Eén-op-één overgenomen uit de canonieke stand-alone T4Recruitment-app
 * (t4r_src/shared/schema.ts). Beslislogica ONGEWIJZIGD: gesloten
 * stakeholderkring, modulaire flow, prioriteitsmodel need/nice/not-needed
 * met sublabel kritisch succescriterium, gelaagde minimumdrempels,
 * conflictlogica. De tabelnamen (sessions/stakeholders/answers/...) botsen
 * niet met de platformtabellen (sessies/sessie_deelnemers/...).
 */

// ---- Sessie ----------------------------------------------------------------
export const t4rSessions = sqliteTable("t4r_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  functionTitle: text("function_title").notNull(),
  orgLabel: text("org_label").notNull(),
  roleType: text("role_type").notNull(),
  roleLevel: text("role_level").notNull(),
  fillMode: text("fill_mode").notNull(),
  endMoment: text("end_moment").notNull(),
  contextVersion: text("context_version").notNull().default("v1"),
  status: text("status").notNull().default("draft"),
  closedRing: integer("closed_ring", { mode: "boolean" }).notNull().default(false),
  // Koppeling naar de platform-sessie (Fase 2 credits/collaboratie). Null bij
  // een (theoretische) los-staande T4R-sessie; in het platform altijd gezet.
  platformSessieId: integer("platform_sessie_id"),
  // Eindrapport-chatbot (recruiter-only). Tellers identiek aan het Kompas-model:
  // 10 gratis vragen, daarna pakketten van 25 via (gesimuleerde) betaling.
  chatGebruikt: integer("chat_gebruikt").notNull().default(0),
  chatTegoed: integer("chat_tegoed").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const insertT4rSessionSchema = createInsertSchema(t4rSessions).omit({
  id: true,
  createdAt: true,
  status: true,
  closedRing: true,
  contextVersion: true,
  platformSessieId: true,
});
export type InsertSession = z.infer<typeof insertT4rSessionSchema>;
export type Session = typeof t4rSessions.$inferSelect;

// ---- Stakeholders ----------------------------------------------------------
export const t4rStakeholders = sqliteTable("t4r_stakeholders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull(),
  name: text("name").notNull(),
  stakeholderRole: text("stakeholder_role").notNull(),
  systemRole: text("system_role").notNull().default("stakeholder"),
  voting: integer("voting", { mode: "boolean" }).notNull().default(true),
});

export const insertT4rStakeholderSchema = createInsertSchema(t4rStakeholders).omit({ id: true });
export type InsertStakeholder = z.infer<typeof insertT4rStakeholderSchema>;
export type Stakeholder = typeof t4rStakeholders.$inferSelect;

// ---- Antwoorden per item ---------------------------------------------------
export const t4rAnswers = sqliteTable("t4r_answers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull(),
  itemId: text("item_id").notNull(),
  classification: text("classification"),
  contextValue: text("context_value"),
  critical: integer("critical", { mode: "boolean" }).notNull().default(false),
  rank: integer("rank"),
  note: text("note"),
  conflict: integer("conflict", { mode: "boolean" }).notNull().default(false),
  finalDecision: text("final_decision"),
  finalReason: text("final_reason"),
  updatedBy: integer("updated_by"),
  updatedAt: integer("updated_at").notNull(),
});

export const insertT4rAnswerSchema = createInsertSchema(t4rAnswers).omit({
  id: true,
  updatedAt: true,
});
export type InsertAnswer = z.infer<typeof insertT4rAnswerSchema>;
export type Answer = typeof t4rAnswers.$inferSelect;

export const upsertAnswerSchema = z.object({
  sessionId: z.number(),
  itemId: z.string(),
  classification: z.enum(["need", "nice", "not-needed"]).nullable().optional(),
  contextValue: z.string().nullable().optional(),
  critical: z.boolean().optional(),
  rank: z.number().nullable().optional(),
  note: z.string().nullable().optional(),
  conflict: z.boolean().optional(),
  finalDecision: z.enum(["alignment", "ondanks-restverschil"]).nullable().optional(),
  finalReason: z.string().nullable().optional(),
  updatedBy: z.number().nullable().optional(),
});
export type UpsertAnswer = z.infer<typeof upsertAnswerSchema>;

// ---- Kandidaatrapport ------------------------------------------------------
export const t4rCandidateReports = sqliteTable("t4r_candidate_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull(),
  candidateLabel: text("candidate_label").notNull(),
  sourceFile: text("source_file"),
  metingen: text("metingen").notNull().default("{}"),
  context: text("context").notNull().default("{}"),
  rawText: text("raw_text"),
  verified: integer("verified", { mode: "boolean" }).notNull().default(false),
  decision: text("decision"),
  decisionReason: text("decision_reason"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const insertT4rCandidateReportSchema = createInsertSchema(t4rCandidateReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCandidateReport = z.infer<typeof insertT4rCandidateReportSchema>;
export type CandidateReport = typeof t4rCandidateReports.$inferSelect;

export const saveCandidateReportSchema = z.object({
  sessionId: z.number(),
  candidateLabel: z.string().min(1),
  sourceFile: z.string().nullable().optional(),
  metingen: z.record(
    z.string(),
    z.object({ net: z.number(), energie: z.enum(["geeft", "neutraal", "kost"]) })
  ),
  context: z
    .object({
      energieDiscrepantie: z.number().nullable().optional(),
      herstelTraag: z.boolean().nullable().optional(),
      perfectionistischeBelasting: z.boolean().nullable().optional(),
      scheveWederkerigheid: z.boolean().nullable().optional(),
    })
    .optional(),
  rawText: z.string().nullable().optional(),
  verified: z.boolean().optional(),
  decision: z.enum(["doorgaan", "afwijzen", "voorbehoud"]).nullable().optional(),
  decisionReason: z.string().nullable().optional(),
});
export type SaveCandidateReport = z.infer<typeof saveCandidateReportSchema>;

// ---- Eindrapport-chatbot (recruiter-only) ---------------------------------
// Berichten worden per T4R-sessie bewaard. De chatbot bevraagt het eindrapport
// (de vergelijkende studie) en is uitsluitend voor de recruiter/begeleidende
// coach bedoeld — NOOIT voor de kandidaat (er is geen kandidaat-toegang tot
// deze sessie). rol: "user" | "assistant". veiligheid: "coach" of null.
export const t4rChat = sqliteTable("t4r_chat", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull(),
  rol: text("rol").notNull(),
  inhoud: text("inhoud").notNull(),
  veiligheid: text("veiligheid"),
  createdAt: integer("created_at").notNull(),
});
export type T4rChatBericht = typeof t4rChat.$inferSelect;

export const t4rChatVraagSchema = z.object({
  vraag: z.string().min(1).max(2000),
});
export type T4rChatVraag = z.infer<typeof t4rChatVraagSchema>;

// ---- Audit trail -----------------------------------------------------------
export const t4rAuditEvents = sqliteTable("t4r_audit_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull(),
  event: text("event").notNull(),
  detail: text("detail"),
  at: integer("at").notNull(),
});
export type AuditEvent = typeof t4rAuditEvents.$inferSelect;
