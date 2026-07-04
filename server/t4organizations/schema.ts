import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * TaPas 4 Organizations (T4O) — datamodel.
 * ------------------------------------------------------------------
 * Een organisatie-afname bestaat uit één sessie met respondenten die
 * verdeeld zijn over drie ringen (groepen): leiding, medewerker en
 * stakeholder. Elke respondent vult via een token de vragen in die bij
 * zijn ring horen. De antwoorden worden per respondent als JSON-map
 * (itemId -> waarde) bewaard en per ring geaggregeerd tot één
 * organisatieprofiel.
 *
 * De tabelnamen krijgen het prefix t4o_ en botsen niet met de platform-,
 * teamscan- of t4r-tabellen.
 */

// ---- Sessie (één organisatie-afname) --------------------------------------
export const t4oSessies = sqliteTable("t4o_sessies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orgNaam: text("org_naam").notNull(),
  orgLabel: text("org_label").notNull().default(""),
  status: text("status").notNull().default("open"), // open | gesloten
  createdAt: integer("created_at").notNull(),
});

export const insertT4OSessieSchema = createInsertSchema(t4oSessies).omit({
  id: true,
  status: true,
  createdAt: true,
});
export type InsertT4OSessie = z.infer<typeof insertT4OSessieSchema>;
export type T4OSessie = typeof t4oSessies.$inferSelect;

// ---- Respondent (anoniem, via token; hoort bij één ring/groep) ------------
export const t4oRespondenten = sqliteTable("t4o_respondenten", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessieId: integer("sessie_id").notNull(),
  token: text("token").notNull(),
  groep: text("groep").notNull(), // leiding | medewerker | stakeholder
  rank: integer("rank").notNull(),
  afgerond: integer("afgerond", { mode: "boolean" }).notNull().default(false),
  afgerondAt: integer("afgerond_at"),
  createdAt: integer("created_at").notNull(),
});

export const insertT4ORespondentSchema = createInsertSchema(t4oRespondenten).omit({
  id: true,
  token: true,
  rank: true,
  afgerond: true,
  afgerondAt: true,
  createdAt: true,
});
export type InsertT4ORespondent = z.infer<typeof insertT4ORespondentSchema>;
export type T4ORespondent = typeof t4oRespondenten.$inferSelect;

// ---- Antwoorden per respondent (JSON-map itemId -> waarde) ----------------
export const t4oAntwoorden = sqliteTable("t4o_antwoorden", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  respondentId: integer("respondent_id").notNull(),
  // JSON-map: { "i1": 1..5, "i9": -1|0|1, "nulmeting": 0..10,
  //            "i46": "A", "i52": ["...","...","..."], ... }
  antwoorden: text("antwoorden").notNull(),
  createdAt: integer("created_at").notNull(),
});

// Waarden zijn heterogeen (getal, string, string[]) afhankelijk van itemType.
export const t4oAntwoordWaardeSchema = z.union([
  z.number(),
  z.string(),
  z.array(z.string()),
]);
export const t4oAntwoordenMapSchema = z.record(z.string(), t4oAntwoordWaardeSchema);
export type T4OAntwoordenMap = z.infer<typeof t4oAntwoordenMapSchema>;
export type T4OAntwoorden = typeof t4oAntwoorden.$inferSelect;

export const T4O_GROEPEN = ["leiding", "medewerker", "stakeholder"] as const;
export type T4OGroep = (typeof T4O_GROEPEN)[number];

// Ring-mapping: groep -> ring (binnen/midden/buiten), conform contract.
export const GROEP_NAAR_RING: Record<T4OGroep, "binnen" | "midden" | "buiten"> = {
  leiding: "binnen",
  medewerker: "midden",
  stakeholder: "buiten",
};
