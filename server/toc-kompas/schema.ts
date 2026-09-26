import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

/**
 * TOC Commitmentkompas: Drizzle-beschrijving van de zes tabellen.
 * ------------------------------------------------------------------
 * De databank wordt aangemaakt door server/toc-kompas/ddl.ts (bij het
 * opstarten en via migrations/0013_toc_kompas.sql). Dit bestand beschrijft
 * dezelfde kolommen voor Drizzle; tests/toc-kompas-migratie.test.ts vergelijkt
 * beide.
 *
 * De module leest en schrijft via prepared statements op de hoofdhandle van
 * het platform (server/storage.ts), zodat de databankversleuteling vanzelf
 * geldt en er geen tweede handle bijkomt.
 */

export const tocKompasRondes = sqliteTable("toc_kompas_rondes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  titel: text("titel").notNull(),
  periode: text("periode").notNull(),
  deadline: text("deadline").notNull().default(""),
  status: text("status").notNull().default("INTAKE"),
  ownerAdminId: integer("owner_admin_id").notNull(),
  vergrendeldOp: text("vergrendeld_op"),
  vergrendelReden: text("vergrendel_reden"),
  coverageJson: text("coverage_json").notNull().default("[]"),
  coverageVersie: integer("coverage_versie").notNull().default(0),
  acceptatieJson: text("acceptatie_json").notNull().default("{}"),
  acceptatieVersie: integer("acceptatie_versie").notNull().default(0),
  vastgesteldOp: text("vastgesteld_op"),
  vastgesteldDoorAdminId: integer("vastgesteld_door_admin_id"),
  vaststelToelichting: text("vaststel_toelichting"),
  afgeslotenOp: text("afgesloten_op"),
  afsluitToelichting: text("afsluit_toelichting"),
  versie: integer("versie").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const tocKompasCaptains = sqliteTable("toc_kompas_captains", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  rondeId: integer("ronde_id").notNull(),
  rol: text("rol").notNull(),
  naam: text("naam").notNull(),
  email: text("email").notNull().default(""),
  tokenHash: text("token_hash").notNull(),
  linkVernieuwdOp: text("link_vernieuwd_op"),
  conceptJson: text("concept_json").notNull().default("{}"),
  conceptVersie: integer("concept_versie").notNull().default(0),
  conceptOp: text("concept_op"),
  laatsteIndieningId: integer("laatste_indiening_id"),
  ingediendOp: text("ingediend_op"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const tocKompasIndieningen = sqliteTable("toc_kompas_indieningen", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  rondeId: integer("ronde_id").notNull(),
  captainId: integer("captain_id").notNull(),
  versie: integer("versie").notNull(),
  antwoordenJson: text("antwoorden_json").notNull(),
  contentHash: text("content_hash").notNull(),
  ingediendOp: text("ingediend_op").notNull(),
});

export const tocKompasCommitments = sqliteTable("toc_kompas_commitments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  rondeId: integer("ronde_id").notNull(),
  code: text("code").notNull(),
  volgnummer: integer("volgnummer").notNull(),
  type: text("type").notNull(),
  ownerCaptainId: integer("owner_captain_id").notNull(),
  domein: text("domein").notNull().default(""),
  objective: text("objective").notNull().default(""),
  deliverable: text("deliverable").notNull().default(""),
  baselineTarget: text("baseline_target").notNull().default(""),
  responsible: text("responsible").notNull().default(""),
  consultedInformed: text("consulted_informed").notNull().default(""),
  deadline: text("deadline").notNull().default(""),
  acceptatiebewijs: text("acceptatiebewijs").notNull().default(""),
  capaciteit: text("capaciteit").notNull().default(""),
  urenPerWeek: real("uren_per_week"),
  beslissingsrecht: text("beslissingsrecht").notNull().default(""),
  budget: text("budget").notNull().default(""),
  dependencies: text("dependencies").notNull().default(""),
  toprisico: text("toprisico").notNull().default(""),
  stopkeuze: text("stopkeuze").notNull().default(""),
  status: text("status").notNull().default("groen"),
  statusToelichting: text("status_toelichting").notNull().default(""),
  heronderhandeling: text("heronderhandeling").notNull().default(""),
  bronIndieningId: integer("bron_indiening_id"),
  createdByAdminId: integer("created_by_admin_id").notNull(),
  versie: integer("versie").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const tocKompasBesluiten = sqliteTable("toc_kompas_besluiten", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  rondeId: integer("ronde_id").notNull(),
  datum: text("datum").notNull(),
  onderwerp: text("onderwerp").notNull(),
  besluit: text("besluit").notNull(),
  beslisser: text("beslisser").notNull(),
  rationale: text("rationale").notNull().default(""),
  aannames: text("aannames").notNull().default(""),
  gevolgen: text("gevolgen").notNull().default(""),
  reviewmoment: text("reviewmoment").notNull().default(""),
  vervangtBesluitId: integer("vervangt_besluit_id"),
  vastgelegdDoorAdminId: integer("vastgelegd_door_admin_id").notNull(),
  createdAt: text("created_at").notNull(),
});

export const tocKompasArtefacten = sqliteTable("toc_kompas_artefacten", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  rondeId: integer("ronde_id").notNull(),
  captainId: integer("captain_id"),
  type: text("type").notNull(),
  versie: integer("versie").notNull(),
  inputHash: text("input_hash").notNull(),
  html: text("html").notNull(),
  pdfBase64: text("pdf_base64"),
  createdByAdminId: integer("created_by_admin_id"),
  createdAt: text("created_at").notNull(),
});

export const TOC_KOMPAS_DRIZZLE_TABELLEN = [
  tocKompasRondes,
  tocKompasCaptains,
  tocKompasIndieningen,
  tocKompasCommitments,
  tocKompasBesluiten,
  tocKompasArtefacten,
];
