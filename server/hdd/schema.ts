import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * Human Due Diligence (HDD) — datamodel (journey / orkestrator-instrument).
 * ------------------------------------------------------------------
 * HDD is GEEN meetinstrument maar een gefaseerd traject dat bestaande
 * instrumenten orkestreert voor één board:
 *
 *   Fase 1 "Verkenning"     → TaPas Teamscan + 2MINSCAN (twee links per lid)
 *                             → teamfoto + energiebalans + Go/No-Go-advies.
 *   Fase 2 "Diepteanalyse"  → T4P Business Kompas per lid → talentkaart,
 *                             driverpatroon, geaggregeerd cognitief profiel
 *                             (Elliott Jaques-indicatie uit T4P), SWOT,
 *                             roladviezen.
 *
 * Crux: een HDD-traject BEZIT geen antwoorden. Per board member bewaren we de
 * deelnemer-/afnametokens van de onderliggende instrumenten (JSON-contract).
 * De aggregatie/rapportage leest op generatiemoment uit die bronnen — één
 * bron van waarheid per instrument, geen datadubbeling. Tabellen krijgen het
 * prefix hdd_ en botsen niet met de platform-, t4r- of teamscan-tabellen.
 */

// ---- Traject (één board, dezelfde mensen door beide fasen) -----------------
export const hddTrajecten = sqliteTable("hdd_trajecten", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  boardNaam: text("board_naam").notNull(),
  orgLabel: text("org_label").notNull().default(""),
  // Context als VARIABELE (géén aparte modus): "ma" | "self-screening".
  context: text("context").notNull().default("self-screening"),
  // Bij M&A: het vereiste cognitieve niveau (Jaques-stratum I–VII, 1..7) dat de
  // groei-/integratieambitie vraagt. Voedt de cognitieve gap-analyse in fase 2.
  vereistStratum: integer("vereist_stratum"), // optioneel
  // Trajectstatus: fase1_open → fase1_klaar → gate → fase2_open → afgerond.
  status: text("status").notNull().default("fase1_open"),
  // Go/No-Go-resultaat zodra de gate is geëvalueerd (JSON-contract) of null.
  gateResultaat: text("gate_resultaat"),
  platformSessieId: integer("platform_sessie_id"),
  createdAt: integer("created_at").notNull(),
});

export const insertHddTrajectSchema = createInsertSchema(hddTrajecten).omit({
  id: true,
  status: true,
  gateResultaat: true,
  platformSessieId: true,
  createdAt: true,
});
export type InsertHddTraject = z.infer<typeof insertHddTrajectSchema>;
export type HddTraject = typeof hddTrajecten.$inferSelect;

// ---- Board member (één persoon, door beide fasen) --------------------------
export const hddBoardLeden = sqliteTable("hdd_board_leden", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  trajectId: integer("traject_id").notNull(),
  // Naam mag leeg blijven voor voorbeeld-/anonieme trajecten; bij een echte
  // afname met meegegeven naam wordt die ingevuld (conform de naamregel).
  naam: text("naam").notNull().default(""),
  email: text("email").notNull().default(""),
  // Per-instrument tokens als JSON-contract, bv.:
  //   { "tapas-teamscan": "<token>", "twominscan": "<token>",
  //     "t4p-business-kompas": "<token>" }
  // Tokens verwijzen naar de bestaande deelnemer-/uitnodigingstabellen van elk
  // onderliggend instrument — HDD dupliceert geen meetlogica.
  instrumentTokens: text("instrument_tokens").notNull().default("{}"),
  createdAt: integer("created_at").notNull(),
});

export const insertHddBoardLidSchema = createInsertSchema(hddBoardLeden).omit({
  id: true,
  instrumentTokens: true,
  createdAt: true,
});
export type InsertHddBoardLid = z.infer<typeof insertHddBoardLidSchema>;
export type HddBoardLid = typeof hddBoardLeden.$inferSelect;

// ---- Gedeelde typecontracten (gate / aggregatie) ---------------------------

// Eén risico-signaal uit de Fase 1-evaluatie.
export interface RodeVlag {
  indicator: string;        // bv. "waardenfit", "vertrouwens-gap"
  ernst: "hoog" | "midden"; // weegt mee in de Go/No-Go-beslissing
  toelichting: string;      // mensleesbare onderbouwing
}

// Resultaat van het Go/No-Go-scharnier "onder de motorkap".
export interface GateResultaat {
  advies: "go" | "no-go";   // platform-advies (consultant houdt eindregie)
  signalen: RodeVlag[];
  samenvatting: string;
  // Consultant-overschrijving (optioneel): de mens beslist uiteindelijk.
  consultantBesluit?: "go" | "no-go";
  consultantMotivatie?: string;
}

export const hddContextSchema = z.enum(["ma", "self-screening"]);
