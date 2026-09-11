import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * Module Kwaliteit & Evaluaties — datamodel voor Fase 1, deelstap 1:
 * organisatie-evaluatie (flow 1 uit de bouwspecificatie).
 * ------------------------------------------------------------------
 * OPZET. Deze module bouwt op de bestaande tabel `organisaties`
 * (shared/schema.ts) voor de organisatie zelf, en krijgt daarnaast eigen
 * tabellen voor wat er nog niet bestond: contactpersonen bij een
 * organisatie, coaches/facilitators, opleidingssessies, uitnodigingen,
 * de organisatie-evaluatie zelf, de individuele antwoorden en
 * kwaliteitssignalen.
 *
 * NAAMGEVING EN BOTSING. De bouwspecificatie noemt deze module
 * "Kwaliteit & Evaluaties", maar het prefix `kwaliteit_` is al bezet door
 * de bestaande STM-module (kwaliteit_normen, kwaliteit_overrides,
 * kwaliteit_alerts, kwaliteit_maillog, kwaliteit_notities in
 * server/stm/schema.ts) en de route /admin/kwaliteit bestaat al voor die
 * module. Deze module gebruikt daarom het prefix `evaluatie_` en de route
 * /admin/kwaliteit-evaluaties, zodat er geen enkele botsing ontstaat met
 * bestaande tabellen, routes of navigatie.
 *
 * SCOPE VAN DEZE STAP. Op vraag van de opdrachtgever wordt eerst en alleen
 * de organisatie-evaluatieflow gebouwd (§7 van de specificatie), met enkel
 * het datamodel dat daarvoor nodig is. Deelnemerscampagnes en
 * coach-zelfevaluatie (§8 en §9) volgen in een latere stap. De vragen zelf
 * staan daarom nog niet in een beheerbare vragenbibliotheek
 * (evaluation_questions/evaluation_question_versions, §10 — Fase 2): ze
 * staan vast in server/kwaliteit-evaluaties/vragen.ts, met per antwoord een
 * snapshot van vraagcode en vraagtekst (evaluatieAntwoorden.vraagTekst),
 * zodat een latere overstap naar een editable bibliotheek geen bestaande
 * antwoorden ongeldig maakt.
 *
 * VERSIEBEHEER VAN METING. De meta-regel uit de implementatiebrief geldt
 * onverkort: taal en gebruiksgemak mogen vaak verfijnd worden, maar de
 * betekenis van een vraag (haar code, haar plaats in een domein, haar
 * gewicht in de score) verandert nooit stilzwijgend. Wie de vragenset in
 * vragen.ts wijzigt op een manier die de meting raakt, moet de vraagcode
 * aanpassen (nooit hergebruiken voor een andere betekenis) en dit in het
 * CHANGELOG en een bouwrapport vastleggen.
 */

// ---- Contactpersoon bij een organisatie ------------------------------------
export const evaluatieOrganisatieContacten = sqliteTable("evaluatie_organisatie_contacten", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organisatieId: integer("organisatie_id").notNull(),
  naam: text("naam").notNull(),
  email: text("email").notNull(),
  functie: text("functie"),
  actief: integer("actief", { mode: "boolean" }).notNull().default(true),
  aangemaaktOp: text("aangemaakt_op").notNull(),
});

export const insertEvaluatieOrganisatieContactSchema = createInsertSchema(
  evaluatieOrganisatieContacten,
).omit({ id: true, actief: true, aangemaaktOp: true });
export type InsertEvaluatieOrganisatieContact = z.infer<
  typeof insertEvaluatieOrganisatieContactSchema
>;
export type EvaluatieOrganisatieContact = typeof evaluatieOrganisatieContacten.$inferSelect;

// ---- Coach/facilitator (eigen entiteit; server/coach-register.ts is enkel
// een statische verwijslijst voor een chatbot en geen databanktabel) --------
export const evaluatieCoaches = sqliteTable("evaluatie_coaches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  naam: text("naam").notNull(),
  email: text("email"),
  actief: integer("actief", { mode: "boolean" }).notNull().default(true),
  aangemaaktOp: text("aangemaakt_op").notNull(),
});

export const insertEvaluatieCoachSchema = createInsertSchema(evaluatieCoaches).omit({
  id: true,
  actief: true,
  aangemaaktOp: true,
});
export type InsertEvaluatieCoach = z.infer<typeof insertEvaluatieCoachSchema>;
export type EvaluatieCoach = typeof evaluatieCoaches.$inferSelect;

// ---- Opleidingssessie (training_session uit §15.2, minimale velden) -------
export const EVALUATIE_SESSIE_STATUSSEN = [
  "gepland",
  "uitgevoerd",
  "geannuleerd",
] as const;
export type EvaluatieSessieStatus = (typeof EVALUATIE_SESSIE_STATUSSEN)[number];

export const evaluatieSessies = sqliteTable("evaluatie_sessies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  titel: text("titel").notNull(),
  organisatieId: integer("organisatie_id").notNull(),
  coachId: integer("coach_id"),
  startDatetime: text("start_datetime").notNull(),
  eindDatetime: text("eind_datetime"),
  locatie: text("locatie"),
  taal: text("taal").notNull().default("nl"),
  aantalDeelnemersVerwacht: integer("aantal_deelnemers_verwacht"),
  aantalDeelnemersWerkelijk: integer("aantal_deelnemers_werkelijk"),
  // JSON-array van strings; bevestigde doelstellingen (§15.2 confirmedObjectives).
  bevestigdeDoelstellingen: text("bevestigde_doelstellingen").notNull().default("[]"),
  status: text("status").notNull().default("gepland"),
  isTestdata: integer("is_testdata", { mode: "boolean" }).notNull().default(false),
  aangemaaktOp: text("aangemaakt_op").notNull(),
});

export const insertEvaluatieSessieSchema = createInsertSchema(evaluatieSessies)
  .omit({ id: true, status: true, isTestdata: true, aangemaaktOp: true })
  .extend({
    bevestigdeDoelstellingen: z.array(z.string()).default([]),
  });
export type InsertEvaluatieSessie = z.infer<typeof insertEvaluatieSessieSchema>;
export type EvaluatieSessie = typeof evaluatieSessies.$inferSelect;

// ---- Uitnodiging (token-toegang; veiligheidspatroon van server/magic-link.ts,
// maar met langere geldigheid en pas eenmalig bij indienen, niet bij eerste
// opening: de organisatiecontact moet tussentijds kunnen terugkeren). -------
export const EVALUATIE_UITNODIGING_TYPES = ["organisatie"] as const;
export type EvaluatieUitnodigingType = (typeof EVALUATIE_UITNODIGING_TYPES)[number];

export const evaluatieUitnodigingen = sqliteTable("evaluatie_uitnodigingen", {
  token: text("token").primaryKey(),
  type: text("type").notNull().default("organisatie"),
  sessieId: integer("sessie_id").notNull(),
  contactId: integer("contact_id").notNull(),
  taal: text("taal").notNull().default("nl"),
  verloogtOp: text("verloopt_op").notNull(),
  ingewisseldOp: text("ingewisseld_op"),
  ingetrokkenOp: text("ingetrokken_op"),
  aangemaaktOp: text("aangemaakt_op").notNull(),
});
export type EvaluatieUitnodiging = typeof evaluatieUitnodigingen.$inferSelect;

// ---- Organisatie-evaluatie (de ingediende/concept-evaluatie zelf) ---------
export const EVALUATIE_STATUSSEN = ["concept", "verzonden"] as const;
export type EvaluatieStatus = (typeof EVALUATIE_STATUSSEN)[number];

export const evaluatieOrganisatieEvaluaties = sqliteTable("evaluatie_organisatie_evaluaties", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  uitnodigingToken: text("uitnodiging_token").notNull(),
  sessieId: integer("sessie_id").notNull(),
  organisatieId: integer("organisatie_id").notNull(),
  contactId: integer("contact_id").notNull(),
  taal: text("taal").notNull().default("nl"),
  status: text("status").notNull().default("concept"),
  // §7.3 contextkaart-check.
  basisinfoKlopt: text("basisinfo_klopt"), // ja | gedeeltelijk | nee
  basisinfoToelichting: text("basisinfo_toelichting"),
  // §6.3 scores per domein (0-10) en het totaal, berekend bij indienen.
  scorePassend: real("score_passend"),
  scoreProfessioneel: real("score_professioneel"),
  scoreActiverend: real("score_activerend"),
  scoreToepasbaar: real("score_toepasbaar"),
  scoreDuurzaam: real("score_duurzaam"),
  scoreTotaal: real("score_totaal"),
  aanbevelingsscore: real("aanbevelingsscore"),
  // §7.5 signaal.
  signaalNiveau: text("signaal_niveau"), // geen | aandachtspunt | ernstig
  signaalTypes: text("signaal_types"), // JSON-array
  signaalBeschrijving: text("signaal_beschrijving"),
  signaalWilContact: integer("signaal_wil_contact", { mode: "boolean" }),
  signaalContactNaam: text("signaal_contact_naam"),
  signaalContactEmail: text("signaal_contact_email"),
  signaalContactTelefoon: text("signaal_contact_telefoon"),
  // §7.5 afronding.
  magContactOpnemen: integer("mag_contact_opnemen", { mode: "boolean" }),
  isTestdata: integer("is_testdata", { mode: "boolean" }).notNull().default(false),
  ingediendOp: text("ingediend_op"),
  aangemaaktOp: text("aangemaakt_op").notNull(),
  bijgewerktOp: text("bijgewerkt_op").notNull(),
});
export type EvaluatieOrganisatieEvaluatie = typeof evaluatieOrganisatieEvaluaties.$inferSelect;

// ---- Individuele antwoorden (evaluation_answers uit §15.5), met een
// snapshot van de vraagtekst zodat een latere vragenbibliotheek (Fase 2)
// bestaande antwoorden nooit met terugwerkende kracht kan veranderen. ------
export const evaluatieAntwoorden = sqliteTable("evaluatie_antwoorden", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  evaluatieType: text("evaluatie_type").notNull().default("organisatie"),
  evaluatieId: integer("evaluatie_id").notNull(),
  vraagCode: text("vraag_code").notNull(),
  vraagTekst: text("vraag_tekst").notNull(),
  taal: text("taal").notNull().default("nl"),
  numeriekeWaarde: real("numerieke_waarde"),
  tekstWaarde: text("tekst_waarde"),
  aangemaaktOp: text("aangemaakt_op").notNull(),
  bijgewerktOp: text("bijgewerkt_op").notNull(),
});
export type EvaluatieAntwoord = typeof evaluatieAntwoorden.$inferSelect;

// ---- Kwaliteitssignalen (§6.5 / §7.5). Enkel opslag van het signaal in
// deze stap; de triage/kwaliteitscase-workflow en het dashboard volgen in
// een latere fase (zie docs/kwaliteit-evaluaties bouwrapport). -------------
export const evaluatieSignalen = sqliteTable("evaluatie_signalen", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bronType: text("bron_type").notNull().default("organisatie_evaluatie"),
  bronId: integer("bron_id").notNull(),
  sessieId: integer("sessie_id").notNull(),
  organisatieId: integer("organisatie_id").notNull(),
  coachId: integer("coach_id"),
  ernst: text("ernst").notNull(), // aandachtspunt | ernstig | automatisch_laag
  types: text("types").notNull().default("[]"), // JSON-array
  beschrijving: text("beschrijving"),
  wilContact: integer("wil_contact", { mode: "boolean" }).notNull().default(false),
  contactNaam: text("contact_naam"),
  contactEmail: text("contact_email"),
  contactTelefoon: text("contact_telefoon"),
  status: text("status").notNull().default("nieuw"), // nieuw | in_behandeling | afgesloten
  aangemaaktOp: text("aangemaakt_op").notNull(),
});
export type EvaluatieSignaal = typeof evaluatieSignalen.$inferSelect;
