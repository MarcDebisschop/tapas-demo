import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

/**
 * Recruitment & Role Fit met H-BOM Evidence Check: Drizzle-beschrijving van de
 * veertien tabellen.
 * ------------------------------------------------------------------
 * De databank wordt aangemaakt door server/role-fit/ddl.ts (bij het opstarten
 * en via migrations/0012_role_fit.sql). Dit bestand beschrijft dezelfde
 * kolommen voor Drizzle; tests/role-fit-migratie.test.ts vergelijkt beide.
 *
 * De module leest en schrijft via prepared statements op de hoofdhandle van
 * het platform (server/storage.ts), zodat de databankversleuteling van
 * server/db-encryptie.ts vanzelf geldt en er geen tweede handle bijkomt.
 */

// Kolommen die elke tabel draagt.
function gemeenschappelijk(standaardStatus: string, standaardHerkomst: string) {
  return {
    versie: integer("versie").notNull().default(1),
    status: text("status").notNull().default(standaardStatus),
    herkomst: text("herkomst").notNull().default(standaardHerkomst),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  };
}

export const roleFitCases = sqliteTable("role_fit_cases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organisatieId: integer("organisatie_id").notNull(),
  afnameId: integer("afname_id").notNull(),
  kandidaatLabel: text("kandidaat_label").notNull(),
  functieTitel: text("functie_titel").notNull(),
  beslisdoel: text("beslisdoel").notNull(),
  senioriteit: text("senioriteit").notNull().default(""),
  beslisdatum: text("beslisdatum").notNull().default(""),
  taal: text("taal").notNull().default("nl"),
  ownerAdminId: integer("owner_admin_id").notNull(),
  recruiterNaam: text("recruiter_naam").notNull(),
  recruiterEmail: text("recruiter_email").notNull(),
  recruiterAdminId: integer("recruiter_admin_id"),
  hmNaam: text("hm_naam").notNull(),
  hmEmail: text("hm_email").notNull(),
  hmAdminId: integer("hm_admin_id"),
  signerAdminId: integer("signer_admin_id").notNull(),
  reviewerAdminId: integer("reviewer_admin_id"),
  rechtsgrond: text("rechtsgrond").notNull(),
  kandidaatGeinformeerd: integer("kandidaat_geinformeerd").notNull().default(0),
  bewaarTot: text("bewaar_tot").notNull(),
  wizardJson: text("wizard_json").notNull().default("{}"),
  pakket: text("pakket"),
  recruiterBevestigdOp: text("recruiter_bevestigd_op"),
  hmBevestigdOp: text("hm_bevestigd_op"),
  freezeOverrideReden: text("freeze_override_reden"),
  bevrorenOp: text("bevroren_op"),
  gearchiveerdOp: text("gearchiveerd_op"),
  verwijderdOp: text("verwijderd_op"),
  contentHash: text("content_hash"),
  ...gemeenschappelijk("DRAFT", "mens"),
});

export const roleFitSources = sqliteTable("role_fit_sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: integer("case_id").notNull(),
  organisatieId: integer("organisatie_id").notNull(),
  type: text("type").notNull(),
  titel: text("titel").notNull().default(""),
  url: text("url"),
  tekst: text("tekst").notNull(),
  lengte: integer("lengte").notNull(),
  toegevoegdDoor: integer("toegevoegd_door"),
  contentHash: text("content_hash").notNull(),
  ...gemeenschappelijk("active", "mens"),
});

export const roleFitContextClaims = sqliteTable("role_fit_context_claims", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: integer("case_id").notNull(),
  organisatieId: integer("organisatie_id").notNull(),
  sourceId: integer("source_id"),
  categorie: text("categorie").notNull(),
  claim: text("claim").notNull(),
  bronpassage: text("bronpassage").notNull().default(""),
  passageStart: integer("passage_start"),
  confidence: text("confidence").notNull().default("low"),
  aiRunId: integer("ai_run_id"),
  beoordeeldDoor: integer("beoordeeld_door"),
  beoordeeldOp: text("beoordeeld_op"),
  contentHash: text("content_hash"),
  ...gemeenschappelijk("proposed", "engine"),
});

export const roleFitRequirements = sqliteTable("role_fit_requirements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: integer("case_id").notNull(),
  organisatieId: integer("organisatie_id").notNull(),
  dimensie: text("dimensie").notNull(),
  fitType: text("fit_type").notNull(),
  vereiste: text("vereiste").notNull(),
  niveau: text("niveau").notNull(),
  kriticiteit: text("kriticiteit").notNull(),
  bronClaimIds: text("bron_claim_ids").notNull().default("[]"),
  gateStatus: text("gate_status"),
  gateToelichting: text("gate_toelichting"),
  toegevoegdDoor: integer("toegevoegd_door"),
  contentHash: text("content_hash"),
  ...gemeenschappelijk("active", "mens"),
});

export const roleFitProfileClaims = sqliteTable("role_fit_profile_claims", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: integer("case_id").notNull(),
  organisatieId: integer("organisatie_id").notNull(),
  afnameId: integer("afname_id").notNull(),
  bronInstrument: text("bron_instrument").notNull(),
  bronContractversie: text("bron_contractversie").notNull().default(""),
  claimCode: text("claim_code").notNull(),
  construct: text("construct").notNull(),
  familie: text("familie").notNull().default(""),
  net: real("net"),
  gemEnergie: real("gem_energie"),
  energieStatus: text("energie_status"),
  volledig: integer("volledig").notNull().default(0),
  contentHash: text("content_hash").notNull(),
  ...gemeenschappelijk("active", "t4p-contract"),
});

export const roleFitFitItems = sqliteTable("role_fit_fit_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: integer("case_id").notNull(),
  organisatieId: integer("organisatie_id").notNull(),
  requirementId: integer("requirement_id").notNull(),
  fitType: text("fit_type").notNull(),
  indicatie: text("indicatie").notNull(),
  confidence: text("confidence").notNull(),
  kriticiteit: text("kriticiteit").notNull(),
  ontwikkelafstand: text("ontwikkelafstand").notNull(),
  energie: text("energie"),
  detailJson: text("detail_json").notNull().default("{}"),
  regelversie: text("regelversie").notNull(),
  contentHash: text("content_hash").notNull(),
  ...gemeenschappelijk("active", "engine"),
});

export const roleFitHypotheses = sqliteTable("role_fit_hypotheses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: integer("case_id").notNull(),
  organisatieId: integer("organisatie_id").notNull(),
  fitItemId: integer("fit_item_id"),
  requirementId: integer("requirement_id").notNull(),
  stelling: text("stelling").notNull(),
  tegenhypothese: text("tegenhypothese").notNull(),
  bronClaimIds: text("bron_claim_ids").notNull().default("[]"),
  kriticiteit: text("kriticiteit").notNull(),
  onzekerheid: integer("onzekerheid").notNull(),
  observeerbaarheid: text("observeerbaarheid").notNull(),
  prioriteit: integer("prioriteit").notNull(),
  methode: text("methode").notNull(),
  detailJson: text("detail_json").notNull().default("{}"),
  verbodenInferentie: text("verboden_inferentie").notNull(),
  rang: integer("rang").notNull(),
  geselecteerd: integer("geselecteerd").notNull().default(0),
  regelversie: text("regelversie").notNull(),
  contentHash: text("content_hash").notNull(),
  ...gemeenschappelijk("proposed", "engine"),
});

export const roleFitExercises = sqliteTable("role_fit_exercises", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: integer("case_id").notNull(),
  organisatieId: integer("organisatie_id").notNull(),
  hypothesisId: integer("hypothesis_id").notNull(),
  volgorde: integer("volgorde").notNull(),
  methode: text("methode").notNull(),
  titel: text("titel").notNull(),
  instructie: text("instructie").notNull(),
  probesJson: text("probes_json").notNull().default("[]"),
  ankersJson: text("ankers_json").notNull().default("{}"),
  goedgekeurdDoor: integer("goedgekeurd_door"),
  goedgekeurdOp: text("goedgekeurd_op"),
  contentHash: text("content_hash").notNull(),
  ...gemeenschappelijk("approved", "engine"),
});

export const roleFitObserverAssignments = sqliteTable("role_fit_observer_assignments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: integer("case_id").notNull(),
  organisatieId: integer("organisatie_id").notNull(),
  rol: text("rol").notNull(),
  actorNaam: text("actor_naam").notNull(),
  actorEmail: text("actor_email").notNull(),
  adminId: integer("admin_id"),
  tokenHash: text("token_hash").notNull(),
  verlooptOp: text("verloopt_op").notNull(),
  conceptJson: text("concept_json").notNull().default("{}"),
  ingediendOp: text("ingediend_op"),
  contentHash: text("content_hash"),
  ...gemeenschappelijk("issued", "engine"),
});

export const roleFitObservations = sqliteTable("role_fit_observations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: integer("case_id").notNull(),
  organisatieId: integer("organisatie_id").notNull(),
  assignmentId: integer("assignment_id").notNull(),
  exerciseId: integer("exercise_id").notNull(),
  contextTrigger: text("context_trigger").notNull().default(""),
  gedrag: text("gedrag").notNull().default(""),
  quoteActie: text("quote_actie").notNull().default(""),
  effect: text("effect").notNull().default(""),
  barsScore: integer("bars_score"),
  onvoldoendeKans: integer("onvoldoende_kans").notNull().default(0),
  bewijskwaliteit: text("bewijskwaliteit"),
  alternatieveVerklaring: text("alternatieve_verklaring").notNull().default(""),
  confidence: text("confidence"),
  taalsignalenJson: text("taalsignalen_json").notNull().default("[]"),
  correctieReden: text("correctie_reden"),
  contentHash: text("content_hash").notNull(),
  ...gemeenschappelijk("submitted", "mens"),
});

export const roleFitIntegrations = sqliteTable("role_fit_integrations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: integer("case_id").notNull(),
  organisatieId: integer("organisatie_id").notNull(),
  hypothesisId: integer("hypothesis_id").notNull(),
  berekendeStatus: text("berekende_status").notNull(),
  integratieStatus: text("integratie_status").notNull(),
  detailJson: text("detail_json").notNull().default("{}"),
  overrideReden: text("override_reden"),
  reviewerId: integer("reviewer_id"),
  regelversie: text("regelversie").notNull(),
  contentHash: text("content_hash").notNull(),
  ...gemeenschappelijk("active", "engine"),
});

export const roleFitDecisions = sqliteTable("role_fit_decisions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: integer("case_id").notNull(),
  organisatieId: integer("organisatie_id").notNull(),
  aanbeveling: text("aanbeveling").notNull(),
  rationale: text("rationale").notNull(),
  detailJson: text("detail_json").notNull().default("{}"),
  signerAdminId: integer("signer_admin_id").notNull(),
  signedAt: text("signed_at").notNull(),
  inputHash: text("input_hash").notNull(),
  contentHash: text("content_hash").notNull(),
  ...gemeenschappelijk("signed", "mens"),
});

export const roleFitArtifacts = sqliteTable("role_fit_artifacts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: integer("case_id").notNull(),
  organisatieId: integer("organisatie_id").notNull(),
  type: text("type").notNull(),
  contractJson: text("contract_json").notNull(),
  inputHash: text("input_hash").notNull(),
  pdfBase64: text("pdf_base64"),
  gegenereerdDoor: integer("gegenereerd_door"),
  contractversie: text("contractversie").notNull(),
  contentHash: text("content_hash").notNull(),
  ...gemeenschappelijk("final", "engine"),
});

export const roleFitAiRuns = sqliteTable("role_fit_ai_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: integer("case_id").notNull(),
  organisatieId: integer("organisatie_id").notNull(),
  taak: text("taak").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  promptversie: text("promptversie").notNull(),
  bronIdsJson: text("bron_ids_json").notNull().default("[]"),
  inputHash: text("input_hash").notNull(),
  outputHash: text("output_hash"),
  fout: text("fout"),
  aantalVoorstellen: integer("aantal_voorstellen").notNull().default(0),
  gestartDoor: integer("gestart_door"),
  contentHash: text("content_hash"),
  versie: integer("versie").notNull().default(1),
  status: text("status").notNull(),
  herkomst: text("herkomst").notNull().default("ai"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const ROLE_FIT_DRIZZLE_TABELLEN = [
  roleFitCases,
  roleFitSources,
  roleFitContextClaims,
  roleFitRequirements,
  roleFitProfileClaims,
  roleFitFitItems,
  roleFitHypotheses,
  roleFitExercises,
  roleFitObserverAssignments,
  roleFitObservations,
  roleFitIntegrations,
  roleFitDecisions,
  roleFitArtifacts,
  roleFitAiRuns,
];
