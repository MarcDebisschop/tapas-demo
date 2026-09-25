-- ---------------------------------------------------------------------------
-- 0012_role_fit: journey Recruitment & Role Fit met de methodieklaag
-- H-BOM Evidence Check.
--
-- AANLEIDING. Het platform had voor recruitment enkel een publieke
-- oplossingspagina. Deze migratie legt de veertien tabellen aan die een
-- volledige case nodig heeft: case, bronnen, contextclaims, vereisten,
-- profielclaims uit het T4P Business Kompas, fit-items, hypothesen,
-- oefeningen, observatoropdrachten, observaties, integratie, besluit,
-- rapportartefacten en AI-runs.
--
-- STRIKT ADDITIEF. Alleen CREATE TABLE, CREATE INDEX en CREATE TRIGGER, alles
-- met IF NOT EXISTS. Geen ALTER, geen DROP, geen herbouw van een bestaande
-- tabel. Elke regel kan zonder fout een tweede keer lopen. Deze migratie
-- raakt geen enkele bestaande tabel of rij.
--
-- ZELFDRAGEND. server/role-fit/storage.ts voert dezelfde definitie uit bij het
-- opstarten (server/role-fit/ddl.ts). De tekst hieronder is daar letterlijk
-- aan gelijk; tests/role-fit-migratie.test.ts bewaakt dat.
--
-- ONVERANDERLIJKHEID. Drie triggers weigeren elke UPDATE op ingediende
-- observaties, getekende besluiten en rapportartefacten.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `role_fit_cases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organisatie_id` integer NOT NULL,
	`afname_id` integer NOT NULL,
	`kandidaat_label` text NOT NULL,
	`functie_titel` text NOT NULL,
	`beslisdoel` text NOT NULL,
	`senioriteit` text DEFAULT '' NOT NULL,
	`beslisdatum` text DEFAULT '' NOT NULL,
	`taal` text DEFAULT 'nl' NOT NULL,
	`owner_admin_id` integer NOT NULL,
	`recruiter_naam` text NOT NULL,
	`recruiter_email` text NOT NULL,
	`recruiter_admin_id` integer,
	`hm_naam` text NOT NULL,
	`hm_email` text NOT NULL,
	`hm_admin_id` integer,
	`signer_admin_id` integer NOT NULL,
	`reviewer_admin_id` integer,
	`rechtsgrond` text NOT NULL,
	`kandidaat_geinformeerd` integer DEFAULT 0 NOT NULL,
	`bewaar_tot` text NOT NULL,
	`wizard_json` text DEFAULT '{}' NOT NULL,
	`pakket` text,
	`recruiter_bevestigd_op` text,
	`hm_bevestigd_op` text,
	`freeze_override_reden` text,
	`bevroren_op` text,
	`gearchiveerd_op` text,
	`verwijderd_op` text,
	`versie` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`content_hash` text,
	`herkomst` text DEFAULT 'mens' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_role_fit_cases_org` ON `role_fit_cases` (`organisatie_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `role_fit_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` integer NOT NULL,
	`organisatie_id` integer NOT NULL,
	`type` text NOT NULL,
	`titel` text DEFAULT '' NOT NULL,
	`url` text,
	`tekst` text NOT NULL,
	`lengte` integer NOT NULL,
	`toegevoegd_door` integer,
	`versie` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`content_hash` text NOT NULL,
	`herkomst` text DEFAULT 'mens' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_role_fit_sources_case` ON `role_fit_sources` (`case_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `role_fit_context_claims` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` integer NOT NULL,
	`organisatie_id` integer NOT NULL,
	`source_id` integer,
	`categorie` text NOT NULL,
	`claim` text NOT NULL,
	`bronpassage` text DEFAULT '' NOT NULL,
	`passage_start` integer,
	`confidence` text DEFAULT 'low' NOT NULL,
	`ai_run_id` integer,
	`beoordeeld_door` integer,
	`beoordeeld_op` text,
	`versie` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'proposed' NOT NULL,
	`content_hash` text,
	`herkomst` text DEFAULT 'engine' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_role_fit_claims_case` ON `role_fit_context_claims` (`case_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `role_fit_requirements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` integer NOT NULL,
	`organisatie_id` integer NOT NULL,
	`dimensie` text NOT NULL,
	`fit_type` text NOT NULL,
	`vereiste` text NOT NULL,
	`niveau` text NOT NULL,
	`kriticiteit` text NOT NULL,
	`bron_claim_ids` text DEFAULT '[]' NOT NULL,
	`gate_status` text,
	`gate_toelichting` text,
	`toegevoegd_door` integer,
	`versie` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`content_hash` text,
	`herkomst` text DEFAULT 'mens' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_role_fit_requirements_case` ON `role_fit_requirements` (`case_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `role_fit_profile_claims` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` integer NOT NULL,
	`organisatie_id` integer NOT NULL,
	`afname_id` integer NOT NULL,
	`bron_instrument` text NOT NULL,
	`bron_contractversie` text DEFAULT '' NOT NULL,
	`claim_code` text NOT NULL,
	`construct` text NOT NULL,
	`familie` text DEFAULT '' NOT NULL,
	`net` real,
	`gem_energie` real,
	`energie_status` text,
	`volledig` integer DEFAULT 0 NOT NULL,
	`versie` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`content_hash` text NOT NULL,
	`herkomst` text DEFAULT 't4p-contract' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_role_fit_profile_case` ON `role_fit_profile_claims` (`case_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `role_fit_fit_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` integer NOT NULL,
	`organisatie_id` integer NOT NULL,
	`requirement_id` integer NOT NULL,
	`fit_type` text NOT NULL,
	`indicatie` text NOT NULL,
	`confidence` text NOT NULL,
	`kriticiteit` text NOT NULL,
	`ontwikkelafstand` text NOT NULL,
	`energie` text,
	`detail_json` text DEFAULT '{}' NOT NULL,
	`regelversie` text NOT NULL,
	`versie` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`content_hash` text NOT NULL,
	`herkomst` text DEFAULT 'engine' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_role_fit_items_case` ON `role_fit_fit_items` (`case_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `role_fit_hypotheses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` integer NOT NULL,
	`organisatie_id` integer NOT NULL,
	`fit_item_id` integer,
	`requirement_id` integer NOT NULL,
	`stelling` text NOT NULL,
	`tegenhypothese` text NOT NULL,
	`bron_claim_ids` text DEFAULT '[]' NOT NULL,
	`kriticiteit` text NOT NULL,
	`onzekerheid` integer NOT NULL,
	`observeerbaarheid` text NOT NULL,
	`prioriteit` integer NOT NULL,
	`methode` text NOT NULL,
	`detail_json` text DEFAULT '{}' NOT NULL,
	`verboden_inferentie` text NOT NULL,
	`rang` integer NOT NULL,
	`geselecteerd` integer DEFAULT 0 NOT NULL,
	`regelversie` text NOT NULL,
	`versie` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'proposed' NOT NULL,
	`content_hash` text NOT NULL,
	`herkomst` text DEFAULT 'engine' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_role_fit_hypotheses_case` ON `role_fit_hypotheses` (`case_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `role_fit_exercises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` integer NOT NULL,
	`organisatie_id` integer NOT NULL,
	`hypothesis_id` integer NOT NULL,
	`volgorde` integer NOT NULL,
	`methode` text NOT NULL,
	`titel` text NOT NULL,
	`instructie` text NOT NULL,
	`probes_json` text DEFAULT '[]' NOT NULL,
	`ankers_json` text DEFAULT '{}' NOT NULL,
	`goedgekeurd_door` integer,
	`goedgekeurd_op` text,
	`versie` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'approved' NOT NULL,
	`content_hash` text NOT NULL,
	`herkomst` text DEFAULT 'engine' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_role_fit_exercises_case` ON `role_fit_exercises` (`case_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `role_fit_observer_assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` integer NOT NULL,
	`organisatie_id` integer NOT NULL,
	`rol` text NOT NULL,
	`actor_naam` text NOT NULL,
	`actor_email` text NOT NULL,
	`admin_id` integer,
	`token_hash` text NOT NULL,
	`verloopt_op` text NOT NULL,
	`concept_json` text DEFAULT '{}' NOT NULL,
	`ingediend_op` text,
	`versie` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'issued' NOT NULL,
	`content_hash` text,
	`herkomst` text DEFAULT 'engine' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_role_fit_assign_token` ON `role_fit_observer_assignments` (`token_hash`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_role_fit_assign_rol` ON `role_fit_observer_assignments` (`case_id`,`rol`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `role_fit_observations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` integer NOT NULL,
	`organisatie_id` integer NOT NULL,
	`assignment_id` integer NOT NULL,
	`exercise_id` integer NOT NULL,
	`context_trigger` text DEFAULT '' NOT NULL,
	`gedrag` text DEFAULT '' NOT NULL,
	`quote_actie` text DEFAULT '' NOT NULL,
	`effect` text DEFAULT '' NOT NULL,
	`bars_score` integer,
	`onvoldoende_kans` integer DEFAULT 0 NOT NULL,
	`bewijskwaliteit` text,
	`alternatieve_verklaring` text DEFAULT '' NOT NULL,
	`confidence` text,
	`taalsignalen_json` text DEFAULT '[]' NOT NULL,
	`correctie_reden` text,
	`versie` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`content_hash` text NOT NULL,
	`herkomst` text DEFAULT 'mens' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_role_fit_obs_versie` ON `role_fit_observations` (`assignment_id`,`exercise_id`,`versie`);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_role_fit_observations_immutable` BEFORE UPDATE ON `role_fit_observations` BEGIN SELECT RAISE(ABORT, 'role_fit_observations is onveranderlijk'); END;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `role_fit_integrations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` integer NOT NULL,
	`organisatie_id` integer NOT NULL,
	`hypothesis_id` integer NOT NULL,
	`berekende_status` text NOT NULL,
	`integratie_status` text NOT NULL,
	`detail_json` text DEFAULT '{}' NOT NULL,
	`override_reden` text,
	`reviewer_id` integer,
	`regelversie` text NOT NULL,
	`versie` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`content_hash` text NOT NULL,
	`herkomst` text DEFAULT 'engine' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_role_fit_integrations_case` ON `role_fit_integrations` (`case_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `role_fit_decisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` integer NOT NULL,
	`organisatie_id` integer NOT NULL,
	`aanbeveling` text NOT NULL,
	`rationale` text NOT NULL,
	`detail_json` text DEFAULT '{}' NOT NULL,
	`signer_admin_id` integer NOT NULL,
	`signed_at` text NOT NULL,
	`input_hash` text NOT NULL,
	`versie` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'signed' NOT NULL,
	`content_hash` text NOT NULL,
	`herkomst` text DEFAULT 'mens' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_role_fit_decisions_case` ON `role_fit_decisions` (`case_id`);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_role_fit_decisions_immutable` BEFORE UPDATE ON `role_fit_decisions` BEGIN SELECT RAISE(ABORT, 'role_fit_decisions is onveranderlijk'); END;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `role_fit_artifacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` integer NOT NULL,
	`organisatie_id` integer NOT NULL,
	`type` text NOT NULL,
	`contract_json` text NOT NULL,
	`input_hash` text NOT NULL,
	`pdf_base64` text,
	`gegenereerd_door` integer,
	`contractversie` text NOT NULL,
	`versie` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'final' NOT NULL,
	`content_hash` text NOT NULL,
	`herkomst` text DEFAULT 'engine' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_role_fit_artifacts_versie` ON `role_fit_artifacts` (`case_id`,`type`,`versie`);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_role_fit_artifacts_immutable` BEFORE UPDATE ON `role_fit_artifacts` BEGIN SELECT RAISE(ABORT, 'role_fit_artifacts is onveranderlijk'); END;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `role_fit_ai_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` integer NOT NULL,
	`organisatie_id` integer NOT NULL,
	`taak` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`promptversie` text NOT NULL,
	`bron_ids_json` text DEFAULT '[]' NOT NULL,
	`input_hash` text NOT NULL,
	`output_hash` text,
	`fout` text,
	`aantal_voorstellen` integer DEFAULT 0 NOT NULL,
	`gestart_door` integer,
	`versie` integer DEFAULT 1 NOT NULL,
	`status` text NOT NULL,
	`content_hash` text,
	`herkomst` text DEFAULT 'ai' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_role_fit_ai_runs_case` ON `role_fit_ai_runs` (`case_id`);
