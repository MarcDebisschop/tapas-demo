import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * TaPas Teamscan — datamodel (collaboratief instrument).
 * ------------------------------------------------------------------
 * Een team-afname bestaat uit één sessie met meerdere (anonieme,
 * token-gebaseerde) deelnemers die elk de drie meetblokken invullen:
 *   A. Fundament (8 stellingen, 1-5)
 *   B. Lencioni (38 stellingen, 1-5)
 *   C. Vertrouwensanatomie (ranking 1-5 + prestatie 1-5 per element)
 *
 * Antwoorden worden per deelnemer als JSON-contracten bewaard (SQLite
 * heeft geen array-/object-kolommen). De tabelnamen krijgen het prefix
 * teamscan_ en botsen niet met de platform- of t4r-tabellen.
 */

// ---- Sessie (één team-afname) ---------------------------------------------
export const teamscanSessies = sqliteTable("teamscan_sessies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamNaam: text("team_naam").notNull(),
  orgLabel: text("org_label").notNull().default(""),
  status: text("status").notNull().default("open"), // open | gesloten
  // Koppeling naar de platform-sessie (credits/collaboratie). In het platform
  // altijd gezet; null bij een (theoretische) losstaande sessie.
  platformSessieId: integer("platform_sessie_id"),
  createdAt: integer("created_at").notNull(),
});

export const insertTeamscanSessieSchema = createInsertSchema(teamscanSessies).omit({
  id: true,
  status: true,
  platformSessieId: true,
  createdAt: true,
});
export type InsertTeamscanSessie = z.infer<typeof insertTeamscanSessieSchema>;
export type TeamscanSessie = typeof teamscanSessies.$inferSelect;

// ---- Deelnemer (anoniem, via token) ---------------------------------------
export const teamscanDeelnemers = sqliteTable("teamscan_deelnemers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessieId: integer("sessie_id").notNull(),
  token: text("token").notNull(),
  // Optioneel label dat de deelnemer zelf kan invullen (bv. "deelnemer 1");
  // niet identificerend vereist. Leeg = volledig anoniem.
  label: text("label").notNull().default(""),
  afgerond: integer("afgerond", { mode: "boolean" }).notNull().default(false),
  afgerondAt: integer("afgerond_at"),
  createdAt: integer("created_at").notNull(),
});

export const insertTeamscanDeelnemerSchema = createInsertSchema(teamscanDeelnemers).omit({
  id: true,
  token: true,
  afgerond: true,
  afgerondAt: true,
  createdAt: true,
});
export type InsertTeamscanDeelnemer = z.infer<typeof insertTeamscanDeelnemerSchema>;
export type TeamscanDeelnemer = typeof teamscanDeelnemers.$inferSelect;

// ---- Antwoorden per deelnemer (JSON-contracten) ---------------------------
export const teamscanAntwoorden = sqliteTable("teamscan_antwoorden", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deelnemerId: integer("deelnemer_id").notNull(),
  // Fundament: { "F1": 1..5, ..., "F8": 1..5 }
  fundament: text("fundament").notNull(),
  // Lencioni: { "1": 1..5, ..., "38": 1..5 }
  lencioni: text("lencioni").notNull(),
  // Vertrouwen-ranking: { "intentie": 1..5, ... } (unieke rang per element)
  vertrouwenRanking: text("vertrouwen_ranking").notNull(),
  // Vertrouwen-prestatie: { "intentie": 1..5, ... }
  vertrouwenPrestatie: text("vertrouwen_prestatie").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const teamscanAntwoordenInhoudSchema = z.object({
  fundament: z.record(z.string(), z.number().int().min(1).max(5)),
  lencioni: z.record(z.string(), z.number().int().min(1).max(5)),
  vertrouwenRanking: z.record(z.string(), z.number().int().min(1).max(5)),
  vertrouwenPrestatie: z.record(z.string(), z.number().int().min(1).max(5)),
});
export type TeamscanAntwoordenInhoud = z.infer<typeof teamscanAntwoordenInhoudSchema>;
export type TeamscanAntwoorden = typeof teamscanAntwoorden.$inferSelect;
